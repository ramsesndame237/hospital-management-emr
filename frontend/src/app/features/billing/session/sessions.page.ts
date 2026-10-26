import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CashSessionGateway } from '../../../core/billing/cash-session.gateway';
import { CashSession, SESSION_STATUSES, SessionFilter, SessionStatus } from '../../../core/billing/cash-session.models';
import { MoneyFormatter } from '../../../core/billing/money';
import { Translator } from '../../../core/i18n/translator';
import { DateTimeFormatter } from '../../../core/time/date-time-formatter';
import { Temporal } from '../../../core/time/temporal';
import { failureMessage, failureNotice } from '../../../shared/failure-message';
import { FormBuilderComponent } from '../../../shared/form-builder/form-builder';
import { FieldSchema } from '../../../shared/form-builder/form-schema';
import { StatusTag } from '../../../shared/status-tag';
import { sessionTone } from './session-summary';

const PAGE_SIZE = 25;
const LINK = 'rounded-[2px] font-medium text-primary underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-50';

/**
 * Sessions de caisse : un caissier voit les siennes, un responsable (comptabilité, administrateur système) les voit toutes, avec l'écart de
 * chacune. Le filtre « À valider » isole les clôtures dont l'écart dépasse la limite et qui attendent une contre-signature.
 */
@Component({
  selector: 'app-sessions-page',
  imports: [RouterLink, FormBuilderComponent, StatusTag],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-col gap-6">
      <header class="flex flex-col">
        <h1 class="text-[28px] leading-9 font-semibold text-foreground">{{ i18n.t('billing.sessions.title') }}</h1>
        <p class="text-sm leading-6 text-muted-foreground">{{ i18n.t('billing.sessions.lead') }}</p>
      </header>

      <app-form-builder [fields]="filterFields" formId="sessions-filter" (submitted)="apply($event)" />

      @if (error()) {
        <app-form-builder [fields]="failure()" formId="sessions-error" />
      }

      @if (loading()) {
        <p class="text-sm text-muted-foreground" role="status">{{ i18n.t('common.loading') }}</p>
      } @else {
        <div class="overflow-x-auto border border-border bg-card">
          <table class="w-full text-left text-sm leading-6">
            <caption class="sr-only">{{ i18n.t('billing.sessions.title') }}</caption>
            <thead class="border-b border-border bg-muted text-xs leading-[18px] text-muted-foreground">
              <tr>
                <th scope="col" class="px-4 py-2 font-medium">{{ i18n.t('billing.sessions.number') }}</th>
                <th scope="col" class="px-4 py-2 font-medium">{{ i18n.t('billing.sessions.cashier') }}</th>
                <th scope="col" class="px-4 py-2 font-medium">{{ i18n.t('billing.sessions.status') }}</th>
                <th scope="col" class="px-4 py-2 font-medium">{{ i18n.t('billing.sessions.opened') }}</th>
                <th scope="col" class="px-4 py-2 text-right font-medium">{{ i18n.t('billing.sessions.taken') }}</th>
                <th scope="col" class="px-4 py-2 text-right font-medium">{{ i18n.t('billing.session.variance') }}</th>
                <th scope="col" class="px-4 py-2 font-medium"><span class="sr-only">{{ i18n.t('billing.actions') }}</span></th>
              </tr>
            </thead>
            <tbody>
              @for (s of sessions(); track s.id) {
                <tr class="border-b border-border last:border-b-0">
                  <td class="px-4 py-3 font-mono text-xs">{{ s.number }}<span class="block font-sans text-muted-foreground">{{ s.counter }}</span></td>
                  <td class="px-4 py-3">{{ s.cashier?.username }}</td>
                  <td class="px-4 py-3"><app-status-tag [text]="statusLabel(s)" [tone]="tone(s)" /></td>
                  <td class="px-4 py-3 whitespace-nowrap">{{ when(s.openedAt) }}</td>
                  <td class="px-4 py-3 text-right font-mono">{{ money(s, s.totalTaken) }}</td>
                  <td class="px-4 py-3 text-right font-mono" [class.text-status-critical]="(s.variance ?? 0) !== 0">{{ varianceOf(s) }}</td>
                  <td class="px-4 py-3 text-right">
                    <a [routerLink]="['/billing/sessions', s.id]" [class]="link" [attr.aria-label]="i18n.t('billing.sessions.openOf', { number: s.number })">{{ i18n.t('billing.invoices.open') }}</a>
                  </td>
                </tr>
              } @empty {
                <tr>
                  <td colspan="7" class="px-4 py-8 text-center text-muted-foreground">{{ i18n.t('billing.sessions.empty') }}</td>
                </tr>
              }
            </tbody>
          </table>
        </div>

        @if (total() > pageSize) {
          <nav class="flex items-center justify-between gap-4 text-sm" [attr.aria-label]="i18n.t('billing.sessions.pagination')">
            <p class="text-muted-foreground">{{ i18n.t('billing.range', { from: offset() + 1, to: lastShown(), total: total() }) }}</p>
            <div class="flex gap-4">
              <button type="button" [class]="link" [disabled]="offset() === 0" (click)="goTo(offset() - pageSize)">{{ i18n.t('billing.previous') }}</button>
              <button type="button" [class]="link" [disabled]="lastShown() >= total()" (click)="goTo(offset() + pageSize)">{{ i18n.t('billing.next') }}</button>
            </div>
          </nav>
        }
      }
    </div>
  `,
})
export class SessionsPage {
  protected readonly i18n = inject(Translator);
  private readonly gateway = inject(CashSessionGateway);
  private readonly formatter = inject(MoneyFormatter);
  private readonly dates = inject(DateTimeFormatter);

  protected readonly pageSize = PAGE_SIZE;
  protected readonly link = LINK;
  protected readonly filterFields: FieldSchema[] = [
    { type: 'select', name: 'status', label: 'billing.sessions.status', placeholder: 'billing.sessions.allStatuses', options: SESSION_STATUSES.map((s) => ({ value: s, label: `billing.session.status.${s}` })), span: 5 },
    { type: 'submit', name: 'submit', label: 'billing.filter.apply', span: 3, class: 'sm:self-end' },
  ];
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly sessions = signal<readonly CashSession[]>([]);
  protected readonly total = signal(0);
  protected readonly offset = signal(0);
  private filter: SessionFilter = {};

  protected readonly failure = computed(() => failureNotice(this.error()));
  protected readonly lastShown = computed(() => Math.min(this.offset() + PAGE_SIZE, this.total()));

  constructor() {
    void this.load();
  }

  protected apply(value: Record<string, unknown>): void {
    const status = String(value['status'] ?? '');
    this.filter = status ? { status: status as SessionStatus } : {};
    this.offset.set(0);
    void this.load();
  }

  protected goTo(offset: number): void {
    this.offset.set(Math.max(0, offset));
    void this.load();
  }

  private async load(): Promise<void> {
    this.loading.set(this.sessions().length === 0);
    try {
      const page = await this.gateway.list(this.filter, this.offset(), PAGE_SIZE);
      this.sessions.set(page.items);
      this.total.set(page.total);
      this.error.set(null);
    } catch (error) {
      this.error.set(failureMessage(error, this.i18n));
    } finally {
      this.loading.set(false);
    }
  }

  protected statusLabel(s: CashSession): string {
    return this.i18n.t(`billing.session.status.${s.status}`);
  }

  protected tone(s: CashSession) {
    return sessionTone(s.status);
  }

  protected money(s: CashSession, amount: number): string {
    return this.formatter.format(amount, s.currency, s.currencyDigits);
  }

  /** Écart signé, ou un tiret tant que la caisse n'est pas clôturée. */
  protected varianceOf(s: CashSession): string {
    if (s.variance === null) return '—';
    const text = this.money(s, Math.abs(s.variance));
    return s.variance === 0 ? text : `${s.variance > 0 ? '+' : '−'} ${text}`;
  }

  protected when(iso: string): string {
    return this.dates.dateTime(Temporal.Instant.from(iso));
  }
}
