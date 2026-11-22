import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { InpatientGateway } from '../../../core/inpatient/inpatient.gateway';
import { WardRow } from '../../../core/inpatient/inpatient.models';
import { Translator } from '../../../core/i18n/translator';
import { DateTimeFormatter } from '../../../core/time/date-time-formatter';
import { Temporal } from '../../../core/time/temporal';
import { failureMessage, failureNotice } from '../../../shared/failure-message';
import { FormBuilderComponent } from '../../../shared/form-builder/form-builder';
import { StatusTag } from '../../../shared/status-tag';
import { riskTone } from '../inpatient.forms';

const LINK = 'rounded-[2px] font-medium text-primary underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none';

/** Mes patients hospitalisés : le lit, le jour d'hospitalisation et le dernier score d'alerte (NEWS2), les plus à risque d'abord après chaque lit. */
@Component({
  selector: 'app-ward-page',
  imports: [RouterLink, FormBuilderComponent, StatusTag],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-col gap-6">
      <header class="flex flex-col">
        <h1 class="text-[28px] leading-9 font-semibold text-foreground">{{ i18n.t('inpatient.ward.title') }}</h1>
        <p class="text-sm leading-6 text-muted-foreground">{{ i18n.t('inpatient.ward.lead') }}</p>
      </header>

      @if (error()) {
        <app-form-builder [fields]="failure()" formId="ward-error" />
      }

      @if (loading()) {
        <p class="text-sm text-muted-foreground" role="status">{{ i18n.t('common.loading') }}</p>
      } @else {
        @if (alerts() > 0) {
          <p class="border border-status-critical bg-card p-3 text-sm leading-6 font-medium text-status-critical" role="alert">{{ i18n.t('inpatient.ward.alerts', { count: alerts() }) }}</p>
        }
        <div class="overflow-x-auto border border-border bg-card">
          <table class="w-full text-left text-sm leading-6">
            <caption class="sr-only">{{ i18n.t('inpatient.ward.title') }}</caption>
            <thead class="border-b border-border bg-muted text-xs leading-[18px] text-muted-foreground">
              <tr>
                <th scope="col" class="px-4 py-2 font-medium">{{ i18n.t('inpatient.ward.bed') }}</th>
                <th scope="col" class="px-4 py-2 font-medium">{{ i18n.t('inpatient.ward.patient') }}</th>
                <th scope="col" class="px-4 py-2 font-medium">{{ i18n.t('inpatient.ward.day') }}</th>
                <th scope="col" class="px-4 py-2 font-medium">{{ i18n.t('inpatient.ward.latest') }}</th>
                <th scope="col" class="px-4 py-2 font-medium"><span class="sr-only">{{ i18n.t('inpatient.actions') }}</span></th>
              </tr>
            </thead>
            <tbody>
              @for (row of rows(); track row.stay.admissionId) {
                <tr class="border-b border-border last:border-b-0">
                  <td class="px-4 py-3 font-medium">{{ row.stay.bed ?? '—' }}</td>
                  <td class="px-4 py-3">
                    <p class="font-medium">{{ name(row) }}</p>
                    <p class="font-mono text-xs leading-[18px] text-muted-foreground">{{ row.patient?.number }}</p>
                  </td>
                  <td class="px-4 py-3 font-mono">{{ row.stay.days }}</td>
                  <td class="px-4 py-3">
                    @if (row.latest; as latest) {
                      <app-status-tag [text]="i18n.t('inpatient.score', { score: latest.news2, risk: i18n.t('inpatient.risk.' + latest.risk) })" [tone]="tone(latest.risk)" />
                      <p class="mt-1 text-xs leading-[18px] text-muted-foreground">{{ when(latest.recordedAt) }}</p>
                    } @else {
                      <span class="text-muted-foreground">{{ i18n.t('inpatient.ward.noObservation') }}</span>
                    }
                  </td>
                  <td class="px-4 py-3 text-right">
                    <a [routerLink]="['/ward', row.stay.admissionId]" [class]="link" [attr.aria-label]="i18n.t('inpatient.ward.openOf', { name: name(row) })">{{ i18n.t('inpatient.ward.open') }}</a>
                  </td>
                </tr>
              } @empty {
                <tr>
                  <td colspan="5" class="px-4 py-8 text-center text-muted-foreground">{{ i18n.t('inpatient.ward.empty') }}</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }
    </div>
  `,
})
export class WardPage {
  protected readonly i18n = inject(Translator);
  private readonly gateway = inject(InpatientGateway);
  private readonly dates = inject(DateTimeFormatter);

  protected readonly link = LINK;
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly rows = signal<readonly WardRow[]>([]);
  protected readonly failure = computed(() => failureNotice(this.error()));
  /** Patients dont le dernier score est élevé : à voir sans attendre. */
  protected readonly alerts = computed(() => this.rows().filter((r) => r.latest?.risk === 'HIGH').length);

  constructor() {
    void this.load();
  }

  private async load(): Promise<void> {
    try {
      this.rows.set(await this.gateway.ward());
      this.error.set(null);
    } catch (error) {
      this.error.set(failureMessage(error, this.i18n));
    } finally {
      this.loading.set(false);
    }
  }

  protected readonly tone = riskTone;

  protected name(row: WardRow): string {
    return row.patient ? `${row.patient.lastName} ${row.patient.firstName}` : this.i18n.t('inpatient.unknownPatient');
  }

  protected when(iso: string): string {
    return this.dates.dateTime(Temporal.Instant.from(iso));
  }
}
