import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal, viewChild } from '@angular/core';
import { RouterLink } from '@angular/router';
import { hasPermission } from '../../../core/auth/permissions';
import { SessionStore } from '../../../core/auth/session.store';
import { Translator } from '../../../core/i18n/translator';
import { ReceptionGateway } from '../../../core/reception/reception.gateway';
import { Admission, AdmissionFilter, AdmissionStatus, AdmissionType, OccupancyBed, Service } from '../../../core/reception/reception.models';
import { DateTimeFormatter } from '../../../core/time/date-time-formatter';
import { Temporal } from '../../../core/time/temporal';
import { failureMessage, failureNotice } from '../../../shared/failure-message';
import { FormBuilderComponent } from '../../../shared/form-builder/form-builder';
import { FormAction } from '../../../shared/form-builder/form-schema';
import { StatusTag } from '../../../shared/status-tag';
import { ToastService } from '../../../shared/toast/toast.service';
import { admissionTag, personName, typeTag } from '../reception-status';
import { admissionFilterFields, cancelAdmissionFields, dischargeFields, transferFields } from '../reception.forms';

const PAGE_SIZE = 25;
const LINK = 'rounded-[2px] font-medium text-primary underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-50';
const SECONDARY = 'inline-flex min-h-9 items-center rounded-[2px] border border-border bg-background px-3 text-sm font-semibold text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-50';

type Panel = { readonly kind: 'discharge' | 'cancel' | 'transfer'; readonly admission: Admission };

/**
 * Admissions : les patients présents (par défaut les admissions en cours, les plus récentes d'abord), avec leur service et leur lit. L'accueil
 * enregistre ici la sortie, le transfert vers un autre service ou un autre lit, ou l'annulation d'une admission ouverte par erreur.
 */
@Component({
  selector: 'app-admissions-page',
  imports: [RouterLink, FormBuilderComponent, StatusTag],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-col gap-6">
      <header class="flex flex-col">
        <h1 class="text-[28px] leading-9 font-semibold text-foreground">{{ i18n.t('reception.admissions.title') }}</h1>
        <p class="text-sm leading-6 text-muted-foreground">{{ i18n.t('reception.admissions.lead') }}</p>
      </header>

      <app-form-builder [fields]="filterFields" formId="admission-filter" (valueChange)="applyFilter($event)" />

      @if (error()) {
        <app-form-builder [fields]="failure()" formId="admissions-error" />
      }

      <div [class]="layoutClass()">
        <div class="flex min-w-0 flex-col gap-3">
          @if (loading()) {
            <p class="text-sm text-muted-foreground" role="status">{{ i18n.t('common.loading') }}</p>
          } @else {
            <div class="overflow-x-auto border border-border bg-card">
              <table class="w-full text-left text-sm leading-6">
                <caption class="sr-only">{{ i18n.t('reception.admissions.title') }}</caption>
                <thead class="border-b border-border bg-muted text-xs leading-[18px] text-muted-foreground">
                  <tr>
                    <th scope="col" class="px-4 py-2 font-medium">{{ i18n.t('reception.admissions.number') }}</th>
                    <th scope="col" class="px-4 py-2 font-medium">{{ i18n.t('reception.admissions.patient') }}</th>
                    <th scope="col" class="px-4 py-2 font-medium">{{ i18n.t('reception.admissions.type') }}</th>
                    <th scope="col" class="px-4 py-2 font-medium">{{ i18n.t('reception.admissions.place') }}</th>
                    <th scope="col" class="px-4 py-2 font-medium">{{ i18n.t('reception.admissions.arrival') }}</th>
                    <th scope="col" class="px-4 py-2 font-medium">{{ i18n.t('reception.admissions.state') }}</th>
                    <th scope="col" class="px-4 py-2 font-medium"><span class="sr-only">{{ i18n.t('reception.actions') }}</span></th>
                  </tr>
                </thead>
                <tbody>
                  @for (a of items(); track a.id) {
                    <tr class="border-b border-border align-top last:border-b-0" [attr.data-test]="a.number">
                      <td class="px-4 py-3 font-mono text-xs">{{ a.number }}</td>
                      <td class="px-4 py-3">
                        @if (a.patient; as p) { <a [routerLink]="['/patients', p.id]" [class]="link">{{ name(p) }}</a><span class="block font-mono text-xs text-muted-foreground">{{ p.number }}</span> }
                      </td>
                      <td class="px-4 py-3"><app-status-tag [text]="type(a.type).label" [tone]="type(a.type).tone" /></td>
                      <td class="px-4 py-3">{{ serviceName(a.serviceId) }}@if (a.bed) { <span class="block text-xs text-muted-foreground">{{ a.bed.name }} · {{ a.bed.location }}</span> }</td>
                      <td class="px-4 py-3 whitespace-nowrap">{{ when(a.admittedAt) }}</td>
                      <td class="px-4 py-3">
                        <app-status-tag [text]="status(a).label" [tone]="status(a).tone" />
                        @if (a.status === 'DISCHARGED') { <span class="block text-xs text-muted-foreground">{{ i18n.t('reception.admission.discharge.' + a.dischargeType) }}</span> }
                        @if (a.status === 'CANCELLED') { <span class="block text-xs text-muted-foreground">{{ a.cancellationReason }}</span> }
                      </td>
                      <td class="px-4 py-3 text-right">
                        @if (canWrite() && a.status === 'IN_PROGRESS') {
                          <span class="flex flex-wrap justify-end gap-2">
                            <button type="button" [class]="secondary" [attr.aria-label]="i18n.t('reception.admission.dischargeOf', { number: a.number })" (click)="open('discharge', a)">{{ i18n.t('reception.admission.dischargeAction') }}</button>
                            <button type="button" [class]="secondary" [attr.aria-label]="i18n.t('reception.admission.transferOf', { number: a.number })" (click)="open('transfer', a)">{{ i18n.t('reception.admission.transferAction') }}</button>
                            <button type="button" [class]="secondary" [attr.aria-label]="i18n.t('reception.admission.cancelOf', { number: a.number })" (click)="open('cancel', a)">{{ i18n.t('reception.admission.cancelAction') }}</button>
                          </span>
                        }
                      </td>
                    </tr>
                  } @empty {
                    <tr><td colspan="7" class="px-4 py-8 text-center text-muted-foreground">{{ i18n.t('reception.admissions.none') }}</td></tr>
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
          <aside class="flex flex-col gap-4 border border-border bg-card p-6" aria-labelledby="adm-panel-title">
            <h2 id="adm-panel-title" class="text-lg leading-[26px] font-semibold text-foreground">{{ i18n.t('reception.admission.' + current.kind + 'Title', { number: current.admission.number }) }}</h2>
            <app-form-builder #form [fields]="panelFields()" [busy]="busy()" [formId]="'admission-' + current.kind" (submitted)="submit($event)" (action)="onAction($event)" (valueChange)="onValues($event)" />
          </aside>
        }
      </div>
    </div>
  `,
})
export class AdmissionsPage implements OnInit {
  protected readonly i18n = inject(Translator);
  private readonly gateway = inject(ReceptionGateway);
  private readonly dates = inject(DateTimeFormatter);
  private readonly toast = inject(ToastService);
  private readonly user = inject(SessionStore).user;
  private readonly form = viewChild<FormBuilderComponent>('form');

  protected readonly link = LINK;
  protected readonly secondary = SECONDARY;
  protected readonly filterFields = admissionFilterFields();
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly items = signal<readonly Admission[]>([]);
  protected readonly total = signal(0);
  protected readonly offset = signal(0);
  protected readonly services = signal<readonly Service[]>([]);
  protected readonly panel = signal<Panel | null>(null);
  protected readonly busy = signal(false);
  protected readonly notice = signal<string | null>(null);
  protected readonly beds = signal<readonly OccupancyBed[]>([]);
  private filter: AdmissionFilter = { status: 'IN_PROGRESS' };
  private bedsOf: string | null = null;

  protected readonly canWrite = computed(() => hasPermission(this.user()?.permissions ?? [], 'admissions:write:department'));
  protected readonly failure = computed(() => failureNotice(this.error()));
  protected readonly layoutClass = computed(() => (this.panel() ? 'grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_380px]' : 'grid items-start gap-6'));
  protected readonly panelFields = computed(() => {
    const p = this.panel();
    const notice = this.notice();
    if (!p) return [];
    return p.kind === 'discharge'
      ? dischargeFields({ notice })
      : p.kind === 'cancel'
        ? cancelAdmissionFields({ notice })
        : transferFields({ inpatient: p.admission.type === 'INPATIENT', services: this.services(), beds: this.beds(), notice });
  });

  async ngOnInit(): Promise<void> {
    try {
      this.services.set(await this.gateway.listServices());
    } catch {
      // Sans la liste des services on affiche l'identifiant vide plutôt que de bloquer l'écran.
    }
    await this.load(0);
  }

  protected applyFilter(values: Record<string, unknown>): Promise<void> {
    const status = String(values['status'] ?? '') as AdmissionStatus | '';
    const type = String(values['type'] ?? '') as AdmissionType | '';
    const next: AdmissionFilter = { ...(status ? { status } : {}), ...(type ? { type } : {}) };
    if (next.status === this.filter.status && next.type === this.filter.type) return Promise.resolve();
    this.filter = next;
    return this.load(0);
  }

  protected go(direction: -1 | 1): Promise<void> {
    return this.load(Math.max(0, this.offset() + direction * PAGE_SIZE));
  }

  private async load(offset: number): Promise<void> {
    this.loading.set(true);
    try {
      const page = await this.gateway.listAdmissions(this.filter, offset, PAGE_SIZE);
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

  protected open(kind: Panel['kind'], admission: Admission): void {
    this.notice.set(null);
    this.beds.set([]);
    this.bedsOf = null;
    this.panel.set({ kind, admission });
  }

  protected onAction(event: FormAction): void {
    if (event.action === 'cancel') this.panel.set(null);
  }

  /** Transfert d'un hospitalisé : les lits libres du nouveau service. */
  protected async onValues(values: Record<string, unknown>): Promise<void> {
    const p = this.panel();
    const serviceId = String(values['serviceId'] ?? '');
    if (!p || p.kind !== 'transfer' || p.admission.type !== 'INPATIENT' || !serviceId || serviceId === this.bedsOf) return;
    this.bedsOf = serviceId;
    try {
      this.beds.set((await this.gateway.getOccupancy(serviceId)).beds);
    } catch (error) {
      this.bedsOf = null;
      this.notice.set(failureMessage(error, this.i18n));
    }
  }

  protected async submit(values: Record<string, unknown>): Promise<void> {
    const p = this.panel();
    if (!p) return;
    this.busy.set(true);
    this.notice.set(null);
    try {
      const id = p.admission.id;
      if (p.kind === 'discharge') await this.gateway.dischargeAdmission(id, String(values['type']));
      else if (p.kind === 'cancel') await this.gateway.cancelAdmission(id, String(values['reason']).trim());
      else await this.gateway.transferAdmission(id, p.admission.type === 'INPATIENT' ? { bedId: String(values['bedId']) } : { serviceId: String(values['serviceId']) });
      this.toast.show(this.i18n.t(`reception.admission.${p.kind}Done`, { number: p.admission.number }));
      this.panel.set(null);
      await this.load(this.offset());
    } catch (error) {
      this.notice.set(failureMessage(error, this.i18n, this.form()));
    } finally {
      this.busy.set(false);
    }
  }

  protected serviceName(id: string): string {
    return this.services().find((s) => s.id === id)?.name ?? '';
  }

  protected name(p: { lastName: string; firstName: string }): string {
    return personName(p);
  }

  protected type(t: AdmissionType) {
    return typeTag(this.i18n, t);
  }

  protected status(a: Admission) {
    return admissionTag(this.i18n, a.status);
  }

  protected when(iso: string): string {
    return this.dates.dateTime(Temporal.Instant.from(iso));
  }
}
