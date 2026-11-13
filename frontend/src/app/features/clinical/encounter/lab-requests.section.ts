import { ChangeDetectionStrategy, Component, OnInit, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Translator } from '../../../core/i18n/translator';
import { LabGateway } from '../../../core/lab/lab.gateway';
import { RequisitionSummary } from '../../../core/lab/lab.models';
import { DateTimeFormatter } from '../../../core/time/date-time-formatter';
import { Temporal } from '../../../core/time/temporal';
import { failureMessage } from '../../../shared/failure-message';
import { StatusTag } from '../../../shared/status-tag';
import { priorityTag, requisitionTag } from '../../lab/lab-status';

const LINK = 'rounded-[2px] font-medium text-primary underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none';
const SECONDARY = 'inline-flex min-h-11 items-center rounded-[2px] border border-border bg-background px-4 text-sm font-semibold text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none';

/**
 * Analyses de la consultation : les demandes que le médecin a prescrites pendant cette consultation, avec leur avancement au laboratoire, et le
 * raccourci pour en demander d'autres — le patient et la consultation sont alors déjà renseignés.
 */
@Component({
  selector: 'app-lab-requests-section',
  imports: [RouterLink, StatusTag],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="flex flex-col gap-3" aria-labelledby="labs-title">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <h2 id="labs-title" class="text-lg leading-[26px] font-semibold text-foreground">{{ i18n.t('clinical.labs.title') }}</h2>
        @if (canOrder()) {
          <a routerLink="/lab/requisitions/new" [queryParams]="{ patientNumber: patientNumber(), encounterId: encounterId() }" [class]="secondary">{{ i18n.t('clinical.labs.new') }}</a>
        }
      </div>

      @if (error()) {
        <p class="border-l-4 border-status-critical bg-card p-3 text-sm text-status-critical" role="alert">{{ error() }}</p>
      }

      @if (loading()) {
        <p class="text-sm text-muted-foreground" role="status">{{ i18n.t('common.loading') }}</p>
      } @else {
        <ul class="flex flex-col divide-y divide-border border border-border bg-card" data-test="requests">
          @for (r of requests(); track r.id) {
            <li class="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm" [attr.data-test]="r.number">
              <span class="flex flex-wrap items-center gap-2">
                <a [routerLink]="['/lab/requisitions', r.id]" [class]="link" class="font-mono text-xs" [attr.aria-label]="i18n.t('clinical.labs.openOf', { number: r.number })">{{ r.number }}</a>
                <app-status-tag [text]="status(r).label" [tone]="status(r).tone" />
                @if (r.priority !== 'ROUTINE') { <app-status-tag [text]="priority(r).label" [tone]="priority(r).tone" /> }
                <span class="text-muted-foreground">{{ r.testCodes.join(', ') }}</span>
              </span>
              <span class="text-xs text-muted-foreground">{{ when(r.orderedAt) }}</span>
            </li>
          } @empty {
            <li class="px-4 py-3 text-sm text-muted-foreground">{{ i18n.t('clinical.labs.none') }}</li>
          }
        </ul>
      }
    </section>
  `,
})
export class LabRequestsSection implements OnInit {
  readonly encounterId = input.required<string>();
  /** Numéro du dossier du patient : il préremplit la nouvelle demande. */
  readonly patientNumber = input.required<string>();
  readonly canOrder = input(false);

  protected readonly i18n = inject(Translator);
  private readonly lab = inject(LabGateway);
  private readonly dates = inject(DateTimeFormatter);

  protected readonly link = LINK;
  protected readonly secondary = SECONDARY;
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly requests = signal<readonly RequisitionSummary[]>([]);

  async ngOnInit(): Promise<void> {
    try {
      this.requests.set((await this.lab.listRequisitions({ encounterId: this.encounterId() }, 0, 50)).items);
      this.error.set(null);
    } catch (error) {
      this.error.set(failureMessage(error, this.i18n));
    } finally {
      this.loading.set(false);
    }
  }

  protected status(r: RequisitionSummary) {
    return requisitionTag(this.i18n, r.status);
  }

  protected priority(r: RequisitionSummary) {
    return priorityTag(this.i18n, r.priority);
  }

  protected when(iso: string): string {
    return this.dates.dateTime(Temporal.Instant.from(iso));
  }
}
