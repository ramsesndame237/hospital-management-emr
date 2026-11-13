import { ChangeDetectionStrategy, Component, OnInit, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Translator } from '../../../core/i18n/translator';
import { ImagingGateway } from '../../../core/imaging/imaging.gateway';
import { OrderSummary } from '../../../core/imaging/imaging.models';
import { DateTimeFormatter } from '../../../core/time/date-time-formatter';
import { Temporal } from '../../../core/time/temporal';
import { failureMessage } from '../../../shared/failure-message';
import { StatusTag } from '../../../shared/status-tag';
import { orderTag, priorityTag } from '../../imaging/imaging-status';

const LINK = 'rounded-[2px] font-medium text-primary underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none';
const SECONDARY = 'inline-flex min-h-11 items-center rounded-[2px] border border-border bg-background px-4 text-sm font-semibold text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none';

/**
 * Imagerie de la consultation : les examens que le médecin a demandés pendant cette consultation, avec leur avancement (le compte rendu signé s'ouvre d'un
 * clic ; une découverte critique est signalée), et le raccourci pour en demander d'autres — le patient et la consultation sont alors déjà renseignés.
 */
@Component({
  selector: 'app-imaging-requests-section',
  imports: [RouterLink, StatusTag],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="flex flex-col gap-3" aria-labelledby="imaging-title">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <h2 id="imaging-title" class="text-lg leading-[26px] font-semibold text-foreground">{{ i18n.t('clinical.imaging.title') }}</h2>
        @if (canOrder()) {
          <a routerLink="/imaging/orders/new" [queryParams]="{ patientNumber: patientNumber(), encounterId: encounterId() }" [class]="secondary">{{ i18n.t('clinical.imaging.new') }}</a>
        }
      </div>

      @if (error()) {
        <p class="border-l-4 border-status-critical bg-card p-3 text-sm text-status-critical" role="alert">{{ error() }}</p>
      }

      @if (loading()) {
        <p class="text-sm text-muted-foreground" role="status">{{ i18n.t('common.loading') }}</p>
      } @else {
        <ul class="flex flex-col divide-y divide-border border border-border bg-card" data-test="orders">
          @for (o of orders(); track o.id) {
            <li class="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm" [attr.data-test]="o.number">
              <span class="flex flex-wrap items-center gap-2">
                <a [routerLink]="['/imaging/orders', o.id]" [class]="link" class="font-mono text-xs" [attr.aria-label]="i18n.t('clinical.imaging.openOf', { number: o.number })">{{ o.number }}</a>
                <app-status-tag [text]="status(o).label" [tone]="status(o).tone" />
                @if (o.priority !== 'ROUTINE') { <app-status-tag [text]="priority(o).label" [tone]="priority(o).tone" /> }
                @if (o.critical) { <app-status-tag tone="critical" [text]="i18n.t('clinical.imaging.critical')" /> }
                <span class="text-muted-foreground">{{ o.examName }}</span>
              </span>
              <span class="text-xs text-muted-foreground">{{ when(o.orderedAt) }}</span>
            </li>
          } @empty {
            <li class="px-4 py-3 text-sm text-muted-foreground">{{ i18n.t('clinical.imaging.none') }}</li>
          }
        </ul>
      }
    </section>
  `,
})
export class ImagingRequestsSection implements OnInit {
  readonly encounterId = input.required<string>();
  /** Numéro du dossier du patient : il préremplit la nouvelle demande. */
  readonly patientNumber = input.required<string>();
  readonly canOrder = input(false);

  protected readonly i18n = inject(Translator);
  private readonly imaging = inject(ImagingGateway);
  private readonly dates = inject(DateTimeFormatter);

  protected readonly link = LINK;
  protected readonly secondary = SECONDARY;
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly orders = signal<readonly OrderSummary[]>([]);

  async ngOnInit(): Promise<void> {
    try {
      this.orders.set((await this.imaging.listOrders({ encounterId: this.encounterId() }, 0, 50)).items);
      this.error.set(null);
    } catch (error) {
      this.error.set(failureMessage(error, this.i18n));
    } finally {
      this.loading.set(false);
    }
  }

  protected status(o: OrderSummary) {
    return orderTag(this.i18n, o.status);
  }

  protected priority(o: OrderSummary) {
    return priorityTag(this.i18n, o.priority);
  }

  protected when(iso: string): string {
    return this.dates.dateTime(Temporal.Instant.from(iso));
  }
}
