import { ChangeDetectionStrategy, Component, OnInit, computed, inject, input, signal, viewChild } from '@angular/core';
import { RouterLink } from '@angular/router';
import { hasPermission } from '../../../core/auth/permissions';
import { SessionStore } from '../../../core/auth/session.store';
import { Translator } from '../../../core/i18n/translator';
import { DateTimeFormatter } from '../../../core/time/date-time-formatter';
import { Temporal } from '../../../core/time/temporal';
import { ReceptionGateway } from '../../../core/reception/reception.gateway';
import { Admission, AdmissionType, OccupancyBed, Patient, Service } from '../../../core/reception/reception.models';
import { failureMessage } from '../../../shared/failure-message';
import { FormBuilderComponent } from '../../../shared/form-builder/form-builder';
import { FormAction } from '../../../shared/form-builder/form-schema';
import { StatusTag } from '../../../shared/status-tag';
import { ToastService } from '../../../shared/toast/toast.service';
import { admissionTag, personName, typeTag } from '../reception-status';
import { openAdmissionFields } from '../reception.forms';

const LINK = 'rounded-[2px] font-medium text-primary underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-50';
const PRIMARY = 'inline-flex min-h-11 items-center rounded-[2px] bg-primary px-4 text-sm font-semibold text-primary-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-50';
const SECONDARY = 'inline-flex min-h-11 items-center rounded-[2px] border border-border bg-background px-4 text-sm font-semibold text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-50';

/**
 * Dossier d'un patient : son identité, ses coordonnées et ses admissions, avec l'ouverture d'une admission (consultation, urgence ou
 * hospitalisation dans un lit libre) — c'est l'arrivée du patient, qui le fait apparaître dans la file d'attente du médecin du service.
 */
@Component({
  selector: 'app-patient-page',
  imports: [RouterLink, FormBuilderComponent, StatusTag],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-col gap-6">
      <a routerLink="/patients" [class]="link" class="w-fit text-sm">← {{ i18n.t('reception.patient.backToSearch') }}</a>

      @if (error()) {
        <p class="border-l-4 border-status-critical bg-card p-3 text-sm text-status-critical" role="alert">{{ error() }}</p>
      }

      @if (patient(); as p) {
        <header class="flex flex-wrap items-start justify-between gap-4">
          <div class="flex flex-col gap-1">
            <h1 class="text-[28px] leading-9 font-semibold text-foreground">{{ name(p) }}</h1>
            <p class="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <span class="font-mono">{{ p.number }}</span> · {{ i18n.t('reception.sex.' + p.sex) }} · {{ p.birthDate }} ({{ i18n.t('reception.patients.age', { n: p.ageYears }) }}@if (p.birthDateEstimated) { , {{ i18n.t('reception.patients.estimated') }}})
              @if (p.status === 'DECEASED') { <app-status-tag tone="critical" [text]="i18n.t('reception.patients.deceasedOn', { date: p.dateOfDeath ?? '' })" /> }
              @else if (p.identityStatus === 'PROVISIONAL') { <app-status-tag tone="warning" [text]="i18n.t('reception.patients.provisional')" /> }
            </p>
          </div>
          <div class="flex flex-wrap gap-3">
            @if (canWrite()) { <a [routerLink]="['/patients', p.id, 'edit']" [class]="secondary">{{ i18n.t('reception.patient.edit') }}</a> }
            @if (canAdmit() && p.status === 'ACTIVE' && !opening()) {
              <button type="button" [class]="primary" (click)="startOpening()">{{ i18n.t('reception.admission.openFor') }}</button>
            }
          </div>
        </header>

        <div [class]="layoutClass()">
          <div class="flex min-w-0 flex-col gap-6">
            <section class="flex flex-col gap-3" aria-labelledby="identity-title">
              <h2 id="identity-title" class="text-lg leading-[26px] font-semibold text-foreground">{{ i18n.t('reception.patient.identityTitle') }}</h2>
              <dl class="grid gap-x-6 gap-y-3 border border-border bg-card p-4 sm:grid-cols-3" data-test="identity">
                @for (row of rows(p); track row.label) {
                  <div><dt class="text-xs text-muted-foreground">{{ i18n.t(row.label) }}</dt><dd class="text-sm">{{ row.value }}</dd></div>
                }
              </dl>
            </section>

            <section class="flex flex-col gap-3" aria-labelledby="adm-title">
              <h2 id="adm-title" class="text-lg leading-[26px] font-semibold text-foreground">{{ i18n.t('reception.patient.admissionsTitle') }}</h2>
              <ul class="flex flex-col divide-y divide-border border border-border bg-card" data-test="admissions">
                @for (a of admissions(); track a.id) {
                  <li class="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm" [attr.data-test]="a.number">
                    <span class="flex flex-wrap items-center gap-2">
                      <span class="font-mono text-xs">{{ a.number }}</span>
                      <app-status-tag [text]="type(a.type).label" [tone]="type(a.type).tone" />
                      <app-status-tag [text]="status(a).label" [tone]="status(a).tone" />
                      <span class="text-muted-foreground">{{ serviceName(a.serviceId) }}@if (a.bed) { · {{ a.bed.name }} ({{ a.bed.location }})}</span>
                    </span>
                    <span class="text-xs text-muted-foreground">{{ when(a.admittedAt) }}</span>
                  </li>
                } @empty {
                  <li class="px-4 py-3 text-sm text-muted-foreground">{{ i18n.t('reception.patient.noAdmission') }}</li>
                }
              </ul>
              @if (canAdmit()) { <a routerLink="/admissions" [class]="link" class="w-fit text-sm">{{ i18n.t('reception.patient.manageAdmissions') }}</a> }
            </section>
          </div>

          @if (opening()) {
            <aside class="flex flex-col gap-4 border border-border bg-card p-6" aria-labelledby="open-title">
              <h2 id="open-title" class="text-lg leading-[26px] font-semibold text-foreground">{{ i18n.t('reception.admission.openTitle', { name: name(p) }) }}</h2>
              <app-form-builder #form [fields]="openFields()" [busy]="busy()" formId="open-admission" (submitted)="open($event)" (action)="onAction($event)" (valueChange)="onValues($event)" />
            </aside>
          }
        </div>
      } @else if (loading()) {
        <p class="text-sm text-muted-foreground" role="status">{{ i18n.t('common.loading') }}</p>
      }
    </div>
  `,
})
export class PatientPage implements OnInit {
  readonly id = input.required<string>();

  protected readonly i18n = inject(Translator);
  private readonly gateway = inject(ReceptionGateway);
  private readonly dates = inject(DateTimeFormatter);
  private readonly toast = inject(ToastService);
  private readonly user = inject(SessionStore).user;
  private readonly form = viewChild<FormBuilderComponent>('form');

  protected readonly link = LINK;
  protected readonly primary = PRIMARY;
  protected readonly secondary = SECONDARY;
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly patient = signal<Patient | null>(null);
  protected readonly admissions = signal<readonly Admission[]>([]);
  protected readonly services = signal<readonly Service[]>([]);
  protected readonly opening = signal(false);
  protected readonly busy = signal(false);
  protected readonly notice = signal<string | null>(null);
  protected readonly beds = signal<readonly OccupancyBed[]>([]);
  private bedsOf: string | null = null;

  private readonly permissions = computed(() => this.user()?.permissions ?? []);
  protected readonly canWrite = computed(() => hasPermission(this.permissions(), 'patients:write'));
  protected readonly canAdmit = computed(() => hasPermission(this.permissions(), 'admissions:write:department'));
  protected readonly layoutClass = computed(() => (this.opening() ? 'grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_380px]' : 'grid items-start gap-6'));
  protected readonly openFields = computed(() => openAdmissionFields({ services: this.services(), beds: this.beds(), notice: this.notice() }));

  async ngOnInit(): Promise<void> {
    try {
      this.patient.set(await this.gateway.getPatient(this.id()));
      this.error.set(null);
    } catch (error) {
      this.error.set(failureMessage(error, this.i18n));
      this.loading.set(false);
      return;
    }
    this.loading.set(false);
    await this.loadAdmissions();
  }

  private async loadAdmissions(): Promise<void> {
    try {
      const [page, services] = await Promise.all([this.gateway.listAdmissions({ patientId: this.id() }, 0, 10), this.gateway.listServices()]);
      this.admissions.set(page.items);
      this.services.set(services);
    } catch {
      // Les admissions sont un complément du dossier : leur absence (droit manquant) ne masque pas l'identité.
      this.admissions.set([]);
    }
  }

  protected startOpening(): void {
    this.notice.set(null);
    this.beds.set([]);
    this.bedsOf = null;
    this.opening.set(true);
  }

  protected onAction(event: FormAction): void {
    if (event.action === 'cancel') this.opening.set(false);
  }

  /** Une hospitalisation exige un lit libre : on charge ceux du service choisi dès que le type et le service le permettent. */
  protected async onValues(values: Record<string, unknown>): Promise<void> {
    const serviceId = String(values['serviceId'] ?? '');
    if (values['type'] !== 'INPATIENT' || !serviceId || serviceId === this.bedsOf) return;
    this.bedsOf = serviceId;
    try {
      this.beds.set((await this.gateway.getOccupancy(serviceId)).beds);
    } catch (error) {
      this.bedsOf = null;
      this.notice.set(failureMessage(error, this.i18n));
    }
  }

  protected async open(values: Record<string, unknown>): Promise<void> {
    const p = this.patient();
    if (!p) return;
    this.busy.set(true);
    this.notice.set(null);
    const type = String(values['type']) as AdmissionType;
    try {
      const admission = await this.gateway.openAdmission({
        patientId: p.id, type, serviceId: String(values['serviceId']), ...(type === 'INPATIENT' ? { bedId: String(values['bedId']) } : {}),
      });
      this.toast.show(this.i18n.t('reception.admission.opened', { number: admission.number }));
      this.opening.set(false);
      await this.loadAdmissions();
    } catch (error) {
      this.notice.set(failureMessage(error, this.i18n, this.form()));
    } finally {
      this.busy.set(false);
    }
  }

  protected rows(p: Patient): { label: string; value: string }[] {
    const a = p.address;
    const address = a ? [a.line, a.quarter, a.city, a.region, a.country].filter(Boolean).join(', ') : '';
    const kin = p.nextOfKin ? `${p.nextOfKin.name} (${this.i18n.t('reception.relationship.' + p.nextOfKin.relationship)}) · ${p.nextOfKin.phone}` : '';
    const doc = p.identityDocument ? `${this.i18n.t('reception.document.' + p.identityDocument.type)} · ${p.identityDocument.number}` : '';
    return [
      { label: 'reception.patient.birthPlace', value: p.birthPlace ?? '—' },
      { label: 'reception.patient.nationality', value: p.nationality ?? '—' },
      { label: 'reception.patient.maritalStatus', value: p.maritalStatus ? this.i18n.t('reception.marital.' + p.maritalStatus) : '—' },
      { label: 'reception.patient.occupation', value: p.occupation ?? '—' },
      { label: 'reception.patient.phone', value: p.phone ?? '—' },
      { label: 'reception.patient.email', value: p.email ?? '—' },
      { label: 'reception.patient.addressLine', value: address || '—' },
      { label: 'reception.patient.documentTitle', value: doc || '—' },
      { label: 'reception.patient.kinTitle', value: kin || '—' },
    ];
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
