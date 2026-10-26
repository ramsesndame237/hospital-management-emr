import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { CashSessionDetail } from '../../../core/billing/cash-session.models';
import { PAYMENT_MODES } from '../../../core/billing/billing.models';
import { MoneyFormatter } from '../../../core/billing/money';
import { Translator } from '../../../core/i18n/translator';
import { DateTimeFormatter } from '../../../core/time/date-time-formatter';
import { Temporal } from '../../../core/time/temporal';
import { StatusTag, StatusTone } from '../../../shared/status-tag';

/** Ton du statut d'une session : verte une fois close, orange tant qu'un responsable doit contre-signer, neutre quand elle est ouverte. */
export function sessionTone(status: string): StatusTone {
  return status === 'CLOSED' ? 'success' : status === 'AWAITING_REVIEW' ? 'warning' : 'neutral';
}

/**
 * Rapport d'une session de caisse : qui, quand, combien, par mode de paiement, le rapprochement des espèces (fonds + encaissé = attendu,
 * comparé au compté) et les encaissements. C'est aussi la fiche de passation imprimable : `printable` la marque comme le bloc à imprimer.
 * Les montants sont ceux de l'API ; l'écran n'en calcule aucun.
 */
@Component({
  selector: 'app-session-summary',
  imports: [StatusTag],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[class]': 'hostClass()' },
  template: `
    @let s = session();
    <header class="flex flex-wrap items-start justify-between gap-3">
      <div class="flex flex-col gap-1">
        <h2 class="flex flex-wrap items-center gap-3 text-lg leading-[26px] font-semibold text-foreground">
          <span class="font-mono">{{ s.number }}</span>
          <app-status-tag [text]="statusLabel()" [tone]="tone()" />
        </h2>
        <p class="text-sm leading-6">{{ s.counter }}@if (s.cashier) { · <span class="font-medium">{{ s.cashier.username }}</span>}</p>
        <p class="text-xs leading-[18px] text-muted-foreground">
          {{ i18n.t('billing.session.openedAt', { date: when(s.openedAt) }) }}@if (s.closedAt) { · {{ i18n.t('billing.session.closedAt', { date: when(s.closedAt) }) }}}
        </p>
      </div>
    </header>

    <dl class="grid grid-cols-2 gap-px border border-border bg-border sm:grid-cols-4">
      <div class="flex flex-col bg-card p-3"><dt class="text-xs leading-[18px] text-muted-foreground">{{ i18n.t('billing.session.float') }}</dt><dd class="font-mono text-base font-semibold">{{ money(s.openingFloat) }}</dd></div>
      <div class="flex flex-col bg-card p-3"><dt class="text-xs leading-[18px] text-muted-foreground">{{ i18n.t('billing.session.taken') }}</dt><dd class="font-mono text-base font-semibold">{{ money(s.totalTaken) }}</dd></div>
      <div class="flex flex-col bg-card p-3"><dt class="text-xs leading-[18px] text-muted-foreground">{{ i18n.t('billing.session.payments') }}</dt><dd class="font-mono text-base font-semibold">{{ s.paymentCount }}</dd></div>
      <div class="flex flex-col bg-card p-3"><dt class="text-xs leading-[18px] text-muted-foreground">{{ i18n.t('billing.session.expected') }}</dt><dd class="font-mono text-base font-semibold">{{ money(s.expectedCash) }}</dd></div>
    </dl>

    <section class="flex flex-col gap-2">
      <h3 class="text-sm leading-[22px] font-semibold text-foreground">{{ i18n.t('billing.session.byMode') }}</h3>
      <dl class="flex flex-col gap-1 text-sm leading-6">
        @for (mode of modes; track mode) {
          <div class="flex justify-between gap-4"><dt class="text-muted-foreground">{{ i18n.t('billing.mode.' + mode) }}</dt><dd class="font-mono">{{ money(s.takings[mode]) }}</dd></div>
        }
      </dl>
    </section>

    @if (s.countedCash !== null) {
      <section class="flex flex-col gap-2 border-t border-border pt-3">
        <h3 class="text-sm leading-[22px] font-semibold text-foreground">{{ i18n.t('billing.session.reconciliation') }}</h3>
        <dl class="flex flex-col gap-1 text-sm leading-6">
          <div class="flex justify-between gap-4"><dt class="text-muted-foreground">{{ i18n.t('billing.session.expected') }}</dt><dd class="font-mono">{{ money(s.expectedCash) }}</dd></div>
          <div class="flex justify-between gap-4"><dt class="text-muted-foreground">{{ i18n.t('billing.session.counted') }}</dt><dd class="font-mono">{{ money(s.countedCash) }}</dd></div>
          <div class="flex justify-between gap-4 text-base font-semibold" [class.text-status-critical]="(s.variance ?? 0) !== 0" [class.text-status-success]="s.variance === 0">
            <dt>{{ i18n.t('billing.session.variance') }}</dt><dd class="font-mono">{{ varianceText() }}</dd>
          </div>
        </dl>
        @if (s.varianceReason) {
          <p class="text-sm leading-6"><span class="text-muted-foreground">{{ i18n.t('billing.session.varianceReason') }} :</span> {{ s.varianceReason }}</p>
        }
        @if (s.requiresCosign) {
          <p class="text-sm leading-6" [class.text-status-warning]="!s.cosignedBy">
            @if (s.cosignedBy; as by) {
              {{ i18n.t('billing.session.cosignedBy', { name: by.username, date: when(s.cosignedAt ?? s.closedAt ?? s.openedAt) }) }}@if (s.cosignComment) { — {{ s.cosignComment }}}
            } @else {
              {{ i18n.t('billing.session.awaitingCosign', { limit: money(s.varianceLimit) }) }}
            }
          </p>
        }
      </section>
    }

    @if (s.payments.length > 0) {
      <section class="flex flex-col gap-2 border-t border-border pt-3">
        <h3 class="text-sm leading-[22px] font-semibold text-foreground">{{ i18n.t('billing.session.paymentList') }}</h3>
        <table class="w-full text-left text-sm leading-6">
          <caption class="sr-only">{{ i18n.t('billing.session.paymentList') }}</caption>
          <thead class="border-b border-border text-xs leading-[18px] text-muted-foreground">
            <tr>
              <th scope="col" class="py-1 pr-3 font-medium">{{ i18n.t('billing.detail.receipt') }}</th>
              <th scope="col" class="py-1 pr-3 font-medium">{{ i18n.t('billing.receipt.invoice') }}</th>
              <th scope="col" class="py-1 pr-3 font-medium">{{ i18n.t('billing.detail.mode') }}</th>
              <th scope="col" class="py-1 text-right font-medium">{{ i18n.t('billing.detail.amount') }}</th>
            </tr>
          </thead>
          <tbody>
            @for (p of s.payments; track p.id) {
              <tr class="border-b border-border last:border-b-0">
                <td class="py-1.5 pr-3 font-mono text-xs">{{ p.receiptNumber }}</td>
                <td class="py-1.5 pr-3 font-mono text-xs">{{ p.invoiceNumber }}</td>
                <td class="py-1.5 pr-3">{{ i18n.t('billing.mode.' + p.mode) }}</td>
                <td class="py-1.5 text-right font-mono">{{ money(p.amount) }}</td>
              </tr>
            }
          </tbody>
        </table>
      </section>
    }
  `,
})
export class SessionSummary {
  protected readonly i18n = inject(Translator);
  private readonly formatter = inject(MoneyFormatter);
  private readonly dates = inject(DateTimeFormatter);

  readonly session = input.required<CashSessionDetail>();
  /** Marque ce bloc comme celui qui sort sur papier (fiche de passation). */
  readonly printable = input(false);

  protected readonly modes = PAYMENT_MODES;
  protected readonly hostClass = computed(() => `flex flex-col gap-4 border border-border bg-card p-6 ${this.printable() ? 'print-area' : ''}`);
  protected readonly statusLabel = computed(() => this.i18n.t(`billing.session.status.${this.session().status}`));
  protected readonly tone = computed(() => sessionTone(this.session().status));
  protected readonly varianceText = computed(() => {
    const variance = this.session().variance ?? 0;
    const text = this.money(Math.abs(variance));
    return variance === 0 ? text : `${variance > 0 ? '+' : '−'} ${text}`;
  });

  protected money(amount: number): string {
    const s = this.session();
    return this.formatter.format(amount, s.currency, s.currencyDigits);
  }

  protected when(iso: string): string {
    return this.dates.dateTime(Temporal.Instant.from(iso));
  }
}
