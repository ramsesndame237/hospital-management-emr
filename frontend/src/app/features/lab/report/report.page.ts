import { DOCUMENT } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { Translator } from '../../../core/i18n/translator';
import { LabGateway } from '../../../core/lab/lab.gateway';
import { Report, ReportItem } from '../../../core/lab/lab.models';
import { DateTimeFormatter } from '../../../core/time/date-time-formatter';
import { Temporal } from '../../../core/time/temporal';
import { failureMessage, failureNotice } from '../../../shared/failure-message';
import { FormBuilderComponent } from '../../../shared/form-builder/form-builder';
import { StatusTag } from '../../../shared/status-tag';
import { flagTag } from '../lab-status';

const LINK = 'rounded-[2px] font-medium text-primary underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none';
const PRIMARY = 'h-auto min-h-11 rounded-[2px] px-4 py-[11px] text-sm leading-[22px] font-semibold shadow-none';

/**
 * Rapport d'analyses d'une demande, à imprimer : uniquement ce qui est publié (valeur, unité, position, valeurs de référence, amendement,
 * validateur et publicateur). Quand des résultats ne sont pas encore publiés, le rapport est partiel et le dit. Chaque édition est tracée côté serveur.
 */
@Component({
  selector: 'app-lab-report-page',
  imports: [RouterLink, HlmButtonImports, FormBuilderComponent, StatusTag],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-col gap-6">
      <div class="flex flex-wrap items-center justify-between gap-4">
        <a [routerLink]="['/lab/requisitions', id()]" [class]="link" class="w-fit text-sm">{{ i18n.t('lab.report.back') }}</a>
        @if (report()) {
          <button hlmBtn type="button" [class]="primary" (click)="print()">{{ i18n.t('lab.report.print') }}</button>
        }
      </div>

      @if (loading()) {
        <p class="text-sm text-muted-foreground" role="status">{{ i18n.t('common.loading') }}</p>
      } @else if (loadError()) {
        <app-form-builder [fields]="loadFailure()" formId="report-load" />
      } @else if (report(); as r) {
        <article class="print-area flex flex-col gap-5 border border-border bg-card p-6 text-sm leading-6">
          <header class="flex flex-wrap items-start justify-between gap-3 border-b border-border pb-4">
            <div class="flex flex-col">
              <h1 class="text-2xl leading-8 font-semibold text-foreground">{{ i18n.t('lab.report.title') }}</h1>
              <p class="font-mono text-base font-semibold">{{ r.number }}</p>
            </div>
            <p class="text-xs text-muted-foreground">{{ i18n.t('lab.report.generated', { date: when(r.generatedAt) }) }}</p>
          </header>

          @if (!r.complete) {
            <p class="border-l-4 border-status-warning p-3" role="status"><strong>{{ i18n.t('lab.report.partialTitle') }}</strong> — {{ i18n.t('lab.report.partialText') }}</p>
          }

          <section class="grid gap-1" [attr.aria-label]="i18n.t('lab.report.patient')">
            @if (r.patient; as p) {
              <p><span class="font-semibold">{{ p.lastName }} {{ p.firstName }}</span> · <span class="font-mono text-xs">{{ p.number }}</span> · {{ i18n.t('lab.report.born', { date: p.birthDate }) }}</p>
            }
            <p class="text-muted-foreground">{{ i18n.t('lab.report.ordered', { date: when(r.orderedAt), name: r.orderedBy?.username ?? '' }) }} · {{ i18n.t('lab.source.' + r.source) }} · {{ i18n.t('lab.priority.' + r.priority) }}</p>
            @if (r.clinicalNotes) {
              <p class="text-muted-foreground">{{ i18n.t('lab.report.notes') }} : {{ r.clinicalNotes }}</p>
            }
          </section>

          <table class="w-full text-left">
            <caption class="sr-only">{{ i18n.t('lab.report.title') }}</caption>
            <thead class="border-b border-border text-xs text-muted-foreground">
              <tr>
                <th scope="col" class="py-2 pr-3 font-medium">{{ i18n.t('lab.report.test') }}</th>
                <th scope="col" class="py-2 pr-3 font-medium">{{ i18n.t('lab.report.result') }}</th>
                <th scope="col" class="py-2 pr-3 font-medium">{{ i18n.t('lab.report.reference') }}</th>
                <th scope="col" class="py-2 font-medium">{{ i18n.t('lab.report.signature') }}</th>
              </tr>
            </thead>
            <tbody>
              @for (item of r.items; track item.testCode) {
                <tr class="border-b border-border align-top last:border-b-0" [attr.data-test]="item.testCode">
                  <td class="py-3 pr-3"><span class="font-medium">{{ item.testName }}</span><span class="block font-mono text-xs text-muted-foreground">{{ item.testCode }}</span></td>
                  <td class="py-3 pr-3">
                    @if (item.status === 'RELEASED') {
                      <span class="font-mono text-base font-semibold">{{ item.value }}@if (item.unit) { {{ item.unit }}}</span>
                      @if (item.flag; as f) {
                        <app-status-tag class="ml-2" [text]="flag(f).label" [tone]="flag(f).tone" />
                      }
                      @if (item.amended) {
                        <span class="block text-xs text-status-warning">{{ i18n.t('lab.report.amended', { n: item.version ?? 0, reason: item.amendmentReason ?? '' }) }}</span>
                      }
                    } @else {
                      <span class="text-muted-foreground">{{ i18n.t('lab.report.pending') }}</span>
                    }
                  </td>
                  <td class="py-3 pr-3 text-xs">{{ refText(item) }}</td>
                  <td class="py-3 text-xs text-muted-foreground">
                    @if (item.status === 'RELEASED') {
                      @if (item.verifiedBy) {
                        <span class="block">{{ i18n.t('lab.report.verifiedBy', { name: item.verifiedBy.username }) }}</span>
                      }
                      @if (item.releasedBy && item.releasedAt) {
                        <span class="block">{{ i18n.t('lab.report.releasedBy', { date: when(item.releasedAt), name: item.releasedBy.username }) }}</span>
                      }
                    }
                  </td>
                </tr>
              }
            </tbody>
          </table>

          <footer class="border-t border-border pt-3 text-xs text-muted-foreground">{{ i18n.t('lab.report.confidential') }}</footer>
        </article>
      }
    </div>
  `,
})
export class LabReportPage {
  protected readonly i18n = inject(Translator);
  private readonly gateway = inject(LabGateway);
  private readonly dates = inject(DateTimeFormatter);
  private readonly document = inject(DOCUMENT);

  /** Identifiant de la demande, lu dans l'adresse (`/lab/requisitions/:id/report`). */
  readonly id = input.required<string>();

  protected readonly link = LINK;
  protected readonly primary = PRIMARY;
  protected readonly loading = signal(true);
  protected readonly loadError = signal<string | null>(null);
  protected readonly report = signal<Report | null>(null);
  protected readonly loadFailure = computed(() => failureNotice(this.loadError()));

  constructor() {
    effect(() => {
      const id = this.id();
      untracked(() => void this.load(id));
    });
  }

  private async load(id: string): Promise<void> {
    this.loading.set(true);
    this.loadError.set(null);
    try {
      this.report.set(await this.gateway.getReport(id));
    } catch (error) {
      this.report.set(null);
      this.loadError.set(failureMessage(error, this.i18n));
    } finally {
      this.loading.set(false);
    }
  }

  protected flag(flag: NonNullable<ReportItem['flag']>) {
    return flagTag(this.i18n, flag);
  }

  protected when(iso: string): string {
    return this.dates.dateTime(Temporal.Instant.from(iso));
  }

  /** Valeurs de référence appliquées, avec les seuils critiques ; vide si aucune tranche ne s'appliquait. */
  protected refText(item: ReportItem): string {
    if (item.status !== 'RELEASED' || (item.refLow === null && item.refHigh === null)) return '';
    const fmt = (n: number | null) => (n === null ? '…' : String(n));
    const base = this.i18n.t('lab.report.refText', { low: fmt(item.refLow), high: fmt(item.refHigh), unit: item.unit ?? '' });
    return item.criticalLow === null && item.criticalHigh === null ? base : `${base} · ${this.i18n.t('lab.result.critical_text', { low: fmt(item.criticalLow), high: fmt(item.criticalHigh) })}`;
  }

  protected print(): void {
    this.document.defaultView?.print();
  }
}
