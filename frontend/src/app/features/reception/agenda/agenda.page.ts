import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal, viewChild } from '@angular/core';
import { RouterLink } from '@angular/router';
import { hasPermission } from '../../../core/auth/permissions';
import { SessionStore } from '../../../core/auth/session.store';
import { Translator } from '../../../core/i18n/translator';
import { ReceptionGateway } from '../../../core/reception/reception.gateway';
import { Appointment, AppointmentFilter, AppointmentStatus, PatientSummary, Practitioner, Service } from '../../../core/reception/reception.models';
import { Clock } from '../../../core/time/clock';
import { Temporal } from '../../../core/time/temporal';
import { failureMessage, failureNotice } from '../../../shared/failure-message';
import { FormBuilderComponent } from '../../../shared/form-builder/form-builder';
import { FormAction } from '../../../shared/form-builder/form-schema';
import { StatusTag } from '../../../shared/status-tag';
import { ToastService } from '../../../shared/toast/toast.service';
import { appointmentTag, personName } from '../reception-status';
import { agendaFilterFields, bookingFields, cancelAppointmentFields, rescheduleFields } from '../reception.forms';
import { dayRange, localDate, localTime, toInstantIso } from './agenda-time';

const PAGE_SIZE = 50;
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const LINK = 'rounded-[2px] font-medium text-primary underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-50';
const PRIMARY = 'inline-flex min-h-11 items-center rounded-[2px] bg-primary px-4 text-sm font-semibold text-primary-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-50';
const SECONDARY = 'inline-flex min-h-9 items-center rounded-[2px] border border-border bg-background px-3 text-sm font-semibold text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-50';
const CELL = 'h-9 w-full border border-input bg-background px-2 text-sm rounded-[2px] focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none';

type Panel = { readonly kind: 'book' } | { readonly kind: 'move' | 'cancel'; readonly appointment: Appointment };

/**
 * Agenda : les rendez-vous d'un jour (tous les services de l'utilisateur ou un seul), avec ce qu'on en fait à l'accueil — prendre un
 * rendez-vous, le déplacer, l'annuler (motif obligatoire), constater l'absence du patient, et surtout enregistrer son ARRIVÉE : cela ouvre
 * l'admission qui honore le rendez-vous et le patient apparaît dans la file du médecin.
 */
@Component({
  selector: 'app-agenda-page',
  imports: [RouterLink, FormBuilderComponent, StatusTag],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-col gap-6">
      <header class="flex flex-wrap items-end justify-between gap-4">
        <div class="flex flex-col">
          <h1 class="text-[28px] leading-9 font-semibold text-foreground">{{ i18n.t('reception.agenda.title') }}</h1>
          <p class="text-sm leading-6 text-muted-foreground">{{ i18n.t('reception.agenda.lead') }}</p>
        </div>
        @if (canWrite() && panel()?.kind !== 'book') {
          <button type="button" [class]="primary" (click)="startBooking()">{{ i18n.t('reception.agenda.new') }}</button>
        }
      </header>

      @if (ready()) {
        <app-form-builder [fields]="filterFields()" formId="agenda-filter" (valueChange)="applyFilter($event)" />
      }

      @if (error()) {
        <app-form-builder [fields]="failure()" formId="agenda-error" />
      }

      <div [class]="layoutClass()">
        <div class="flex min-w-0 flex-col gap-3">
          @if (loading()) {
            <p class="text-sm text-muted-foreground" role="status">{{ i18n.t('common.loading') }}</p>
          } @else {
            <div class="overflow-x-auto border border-border bg-card">
              <table class="w-full text-left text-sm leading-6">
                <caption class="sr-only">{{ i18n.t('reception.agenda.title') }}</caption>
                <thead class="border-b border-border bg-muted text-xs leading-[18px] text-muted-foreground">
                  <tr>
                    <th scope="col" class="px-4 py-2 font-medium">{{ i18n.t('reception.agenda.slot') }}</th>
                    <th scope="col" class="px-4 py-2 font-medium">{{ i18n.t('reception.admissions.patient') }}</th>
                    <th scope="col" class="px-4 py-2 font-medium">{{ i18n.t('reception.agenda.practitioner') }}</th>
                    <th scope="col" class="px-4 py-2 font-medium">{{ i18n.t('reception.admission.service') }}</th>
                    <th scope="col" class="px-4 py-2 font-medium">{{ i18n.t('reception.admissions.state') }}</th>
                    <th scope="col" class="px-4 py-2 font-medium"><span class="sr-only">{{ i18n.t('reception.actions') }}</span></th>
                  </tr>
                </thead>
                <tbody>
                  @for (a of items(); track a.id) {
                    <tr class="border-b border-border align-top last:border-b-0" [attr.data-test]="a.number">
                      <td class="px-4 py-3 whitespace-nowrap font-mono text-xs">{{ slot(a) }}<span class="block font-sans text-muted-foreground">{{ a.number }}</span></td>
                      <td class="px-4 py-3">
                        @if (a.patient; as p) { <a [routerLink]="['/patients', p.id]" [class]="link">{{ name(p) }}</a><span class="block font-mono text-xs text-muted-foreground">{{ p.number }}</span> }
                      </td>
                      <td class="px-4 py-3">@if (a.practitioner; as d) { {{ name(d) }} }</td>
                      <td class="px-4 py-3">{{ serviceName(a.serviceId) }}</td>
                      <td class="px-4 py-3">
                        <app-status-tag [text]="status(a).label" [tone]="status(a).tone" />
                        @if (a.status === 'CANCELLED') { <span class="block text-xs text-muted-foreground">{{ a.cancellationReason }}</span> }
                      </td>
                      <td class="px-4 py-3 text-right">
                        @if (canWrite() && a.status === 'SCHEDULED') {
                          <span class="flex flex-wrap justify-end gap-2">
                            @if (canAdmit()) {
                              <button type="button" [class]="primary" class="min-h-9 px-3" [disabled]="busy()" [attr.aria-label]="i18n.t('reception.agenda.arrivedOf', { number: a.number })" (click)="arrived(a)">{{ i18n.t('reception.agenda.arrived') }}</button>
                            }
                            <button type="button" [class]="secondary" [attr.aria-label]="i18n.t('reception.agenda.moveOf', { number: a.number })" (click)="open('move', a)">{{ i18n.t('reception.agenda.move') }}</button>
                            <button type="button" [class]="secondary" [disabled]="busy()" [attr.aria-label]="i18n.t('reception.agenda.noShowOf', { number: a.number })" (click)="noShow(a)">{{ i18n.t('reception.agenda.noShow') }}</button>
                            <button type="button" [class]="secondary" [attr.aria-label]="i18n.t('reception.agenda.cancelOf', { number: a.number })" (click)="open('cancel', a)">{{ i18n.t('reception.agenda.cancel') }}</button>
                          </span>
                        }
                      </td>
                    </tr>
                  } @empty {
                    <tr><td colspan="6" class="px-4 py-8 text-center text-muted-foreground">{{ i18n.t('reception.agenda.none') }}</td></tr>
                  }
                </tbody>
              </table>
            </div>
            @if (total() > items().length || offset() > 0) {
              <nav class="flex items-center justify-between gap-3 text-sm" [attr.aria-label]="i18n.t('reception.patients.pagination')">
                <span class="text-muted-foreground">{{ i18n.t('reception.patients.range', { from: offset() + 1, to: offset() + items().length, total: total() }) }}</span>
                <span class="flex gap-2">
                  <button type="button" [class]="secondary" [disabled]="offset() === 0" (click)="go(-1)">{{ i18n.t('reception.patients.previous') }}</button>
                  <button type="button" [class]="secondary" [disabled]="offset() + items().length >= total()" (click)="go(1)">{{ i18n.t('reception.patients.next') }}</button>
                </span>
              </nav>
            }
          }
        </div>

        @if (panel(); as current) {
          <aside class="flex flex-col gap-4 border border-border bg-card p-6" aria-labelledby="agenda-panel-title">
            <h2 id="agenda-panel-title" class="text-lg leading-[26px] font-semibold text-foreground">{{ panelTitle() }}</h2>
            @if (current.kind === 'book') {
              <section class="flex flex-col gap-2" aria-labelledby="patient-pick-title">
                <h3 id="patient-pick-title" class="text-sm font-medium">{{ i18n.t('reception.agenda.patient') }}</h3>
                @if (picked(); as p) {
                  <p class="flex flex-wrap items-center justify-between gap-2 border border-border p-2 text-sm" data-test="picked">
                    <span><span class="font-medium">{{ name(p) }}</span> <span class="font-mono text-xs">{{ p.number }}</span> · {{ p.birthDate }}</span>
                    <button type="button" [class]="link" class="text-xs" (click)="picked.set(null)">{{ i18n.t('reception.agenda.changePatient') }}</button>
                  </p>
                } @else {
                  <input id="agenda-patient-search" [class]="cell" type="search" autocomplete="off" [value]="query()" [placeholder]="i18n.t('reception.agenda.patientHint')" [attr.aria-label]="i18n.t('reception.agenda.patient')" (input)="onSearch($any($event.target).value)" />
                  @if (results().length > 0) {
                    <ul class="flex flex-col divide-y divide-border border border-border" data-test="patient-results">
                      @for (p of results(); track p.id) {
                        <li><button type="button" class="flex w-full flex-wrap items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none" [attr.data-test]="'pick-' + p.number" (click)="pick(p)">
                          <span class="font-medium">{{ name(p) }}</span><span class="font-mono text-xs text-muted-foreground">{{ p.number }} · {{ p.birthDate }}</span></button></li>
                      }
                    </ul>
                  } @else if (searched() && query().trim().length >= 2) {
                    <p class="text-sm text-muted-foreground">{{ i18n.t('reception.patients.none') }}</p>
                  }
                }
              </section>
            }
            <app-form-builder #form [fields]="panelFields()" [busy]="busy()" [formId]="'agenda-' + current.kind" (submitted)="submit($event)" (action)="onAction($event)" (valueChange)="onValues($event)" />
          </aside>
        }
      </div>
    </div>
  `,
})
export class AgendaPage implements OnInit {
  protected readonly i18n = inject(Translator);
  private readonly gateway = inject(ReceptionGateway);
  private readonly clock = inject(Clock);
  private readonly toast = inject(ToastService);
  private readonly user = inject(SessionStore).user;
  private readonly form = viewChild<FormBuilderComponent>('form');

  protected readonly link = LINK;
  protected readonly primary = PRIMARY;
  protected readonly secondary = SECONDARY;
  protected readonly cell = CELL;
  protected readonly today = localDate(this.clock.now());
  protected readonly ready = signal(false);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly items = signal<readonly Appointment[]>([]);
  protected readonly total = signal(0);
  protected readonly offset = signal(0);
  protected readonly services = signal<readonly Service[]>([]);
  protected readonly practitioners = signal<readonly Practitioner[]>([]);
  protected readonly panel = signal<Panel | null>(null);
  protected readonly busy = signal(false);
  protected readonly notice = signal<string | null>(null);
  protected readonly query = signal('');
  protected readonly results = signal<readonly PatientSummary[]>([]);
  protected readonly searched = signal(false);
  protected readonly picked = signal<PatientSummary | null>(null);
  private filter: { date: string; serviceId: string; status: string } = { date: this.today, serviceId: '', status: '' };
  private practitionersOf: string | null = null;
  private searchSeq = 0;

  private readonly permissions = computed(() => this.user()?.permissions ?? []);
  protected readonly canWrite = computed(() => hasPermission(this.permissions(), 'appointments:write:department'));
  protected readonly canAdmit = computed(() => hasPermission(this.permissions(), 'admissions:write:department'));
  protected readonly failure = computed(() => failureNotice(this.error()));
  protected readonly filterFields = computed(() => agendaFilterFields({ services: this.services(), today: this.today }));
  protected readonly layoutClass = computed(() => (this.panel() ? 'grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_380px]' : 'grid items-start gap-6'));
  protected readonly panelTitle = computed(() => {
    const p = this.panel();
    return !p ? '' : p.kind === 'book' ? this.i18n.t('reception.agenda.new') : this.i18n.t(`reception.agenda.${p.kind}Title`, { number: p.appointment.number });
  });
  protected readonly panelFields = computed(() => {
    const p = this.panel();
    const notice = this.notice();
    if (!p) return [];
    if (p.kind === 'book') return bookingFields({ services: this.services(), practitioners: this.practitioners(), today: this.today, notice });
    if (p.kind === 'cancel') return cancelAppointmentFields({ notice });
    const start = Temporal.Instant.from(p.appointment.startsAt);
    return rescheduleFields({ date: localDate(start), time: localTime(start), duration: p.appointment.durationMinutes, notice });
  });

  async ngOnInit(): Promise<void> {
    try {
      this.services.set(await this.gateway.listServices());
    } catch {
      // Sans la liste des services, l'agenda s'affiche quand même (le service n'est alors pas nommé).
    }
    this.ready.set(true);
    await this.load(0);
  }

  protected applyFilter(values: Record<string, unknown>): Promise<void> {
    const next = { date: String(values['date'] ?? ''), serviceId: String(values['serviceId'] ?? ''), status: String(values['status'] ?? '') };
    if (!DAY.test(next.date) || !dayRange(next.date)) return Promise.resolve();
    if (next.date === this.filter.date && next.serviceId === this.filter.serviceId && next.status === this.filter.status) return Promise.resolve();
    this.filter = next;
    return this.load(0);
  }

  protected go(direction: -1 | 1): Promise<void> {
    return this.load(Math.max(0, this.offset() + direction * PAGE_SIZE));
  }

  private async load(offset: number): Promise<void> {
    const range = dayRange(this.filter.date);
    if (!range) return;
    this.loading.set(true);
    try {
      const filter: AppointmentFilter = {
        from: range.from, to: range.to, ...(this.filter.serviceId ? { serviceId: this.filter.serviceId } : {}), ...(this.filter.status ? { status: this.filter.status as AppointmentStatus } : {}),
      };
      const page = await this.gateway.listAppointments(filter, offset, PAGE_SIZE);
      this.items.set(page.items);
      this.total.set(page.total);
      this.offset.set(page.offset);
      this.error.set(null);
    } catch (error) {
      this.error.set(failureMessage(error, this.i18n));
    } finally {
      this.loading.set(false);
    }
  }

  protected startBooking(): void {
    this.resetPanel();
    this.panel.set({ kind: 'book' });
  }

  protected open(kind: 'move' | 'cancel', appointment: Appointment): void {
    this.resetPanel();
    this.panel.set({ kind, appointment });
  }

  private resetPanel(): void {
    this.notice.set(null);
    this.practitioners.set([]);
    this.practitionersOf = null;
    this.picked.set(null);
    this.query.set('');
    this.results.set([]);
    this.searched.set(false);
  }

  protected onAction(event: FormAction): void {
    if (event.action === 'cancel') this.panel.set(null);
  }

  /** Les professionnels proposés sont ceux du service choisi. */
  protected async onValues(values: Record<string, unknown>): Promise<void> {
    const p = this.panel();
    const serviceId = String(values['serviceId'] ?? '');
    if (p?.kind !== 'book' || !serviceId || serviceId === this.practitionersOf) return;
    this.practitionersOf = serviceId;
    try {
      this.practitioners.set(await this.gateway.listPractitioners(serviceId));
    } catch (error) {
      this.practitionersOf = null;
      this.notice.set(failureMessage(error, this.i18n));
    }
  }

  protected async onSearch(text: string): Promise<void> {
    this.query.set(text);
    const mine = ++this.searchSeq;
    if (text.trim().length < 2) {
      this.results.set([]);
      this.searched.set(false);
      return;
    }
    try {
      const page = await this.gateway.searchPatients({ q: text.trim() }, 0, 8);
      if (mine !== this.searchSeq) return;
      this.results.set(page.items);
      this.searched.set(true);
    } catch (error) {
      if (mine === this.searchSeq) this.notice.set(failureMessage(error, this.i18n));
    }
  }

  protected pick(patient: PatientSummary): void {
    this.picked.set(patient);
    this.query.set('');
    this.results.set([]);
    this.searched.set(false);
    this.searchSeq++;
  }

  protected async submit(values: Record<string, unknown>): Promise<void> {
    const p = this.panel();
    if (!p) return;
    const startsAt = p.kind === 'cancel' ? null : toInstantIso(String(values['date']), String(values['time']));
    if (p.kind !== 'cancel' && !startsAt) return this.notice.set(this.i18n.t('reception.agenda.dateInvalid'));
    if (p.kind === 'book' && !this.picked()) return this.notice.set(this.i18n.t('reception.agenda.patientRequired'));
    this.busy.set(true);
    this.notice.set(null);
    try {
      if (p.kind === 'book') {
        const saved = await this.gateway.scheduleAppointment({
          patientId: this.picked()!.id, practitionerId: String(values['practitionerId']), locationId: String(values['serviceId']), startsAt: startsAt!, durationMinutes: Number(values['duration']),
        });
        this.toast.show(this.i18n.t('reception.agenda.booked', { number: saved.number }));
      } else if (p.kind === 'move') {
        await this.gateway.rescheduleAppointment(p.appointment.id, { startsAt: startsAt!, durationMinutes: Number(values['duration']) });
        this.toast.show(this.i18n.t('reception.agenda.moved', { number: p.appointment.number }));
      } else {
        await this.gateway.cancelAppointment(p.appointment.id, String(values['reason']).trim());
        this.toast.show(this.i18n.t('reception.agenda.cancelled', { number: p.appointment.number }));
      }
      this.panel.set(null);
      await this.load(this.offset());
    } catch (error) {
      this.notice.set(failureMessage(error, this.i18n, this.form()));
    } finally {
      this.busy.set(false);
    }
  }

  /** Le patient s'est présenté : l'admission qui honore le rendez-vous s'ouvre, et le patient rejoint la file du médecin. */
  protected async arrived(a: Appointment): Promise<void> {
    if (!a.patient) return;
    await this.act(async () => {
      const admission = await this.gateway.openAdmission({ patientId: a.patient!.id, type: 'OUTPATIENT', appointmentId: a.id });
      this.toast.show(this.i18n.t('reception.agenda.admitted', { number: admission.number }));
    });
  }

  protected noShow(a: Appointment): Promise<void> {
    return this.act(async () => {
      await this.gateway.markNoShow(a.id);
      this.toast.show(this.i18n.t('reception.agenda.noShowDone', { number: a.number }));
    });
  }

  private async act(run: () => Promise<void>): Promise<void> {
    this.busy.set(true);
    try {
      await run();
      await this.load(this.offset());
    } catch (error) {
      this.error.set(failureMessage(error, this.i18n));
    } finally {
      this.busy.set(false);
    }
  }

  protected slot(a: Appointment): string {
    return `${localTime(Temporal.Instant.from(a.startsAt))} – ${localTime(Temporal.Instant.from(a.endsAt))}`;
  }

  protected serviceName(id: string): string {
    return this.services().find((s) => s.id === id)?.name ?? '';
  }

  protected name(p: { lastName: string; firstName: string }): string {
    return personName(p);
  }

  protected status(a: Appointment) {
    return appointmentTag(this.i18n, a.status);
  }
}
