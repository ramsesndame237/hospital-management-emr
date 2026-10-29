import { DOCUMENT } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal, viewChild } from '@angular/core';
import { RouterLink } from '@angular/router';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { CashSessionGateway } from '../../../core/billing/cash-session.gateway';
import { CashSessionDetail, DenominationsInfo, countTotal } from '../../../core/billing/cash-session.models';
import { MoneyFormatter } from '../../../core/billing/money';
import { Translator } from '../../../core/i18n/translator';
import { failureMessage, failureNotice } from '../../../shared/failure-message';
import { FormBuilderComponent } from '../../../shared/form-builder/form-builder';
import { FieldSchema, FormAction } from '../../../shared/form-builder/form-schema';
import { ToastService } from '../../../shared/toast/toast.service';
import { closeSessionFields, countFrom, openSessionFields } from './session.forms';
import { SessionSummary } from './session-summary';

const PRIMARY = 'h-auto min-h-11 rounded-[2px] px-4 py-[11px] text-sm leading-[22px] font-semibold shadow-none';

/**
 * « Ma caisse » : le caissier ouvre sa caisse en comptant son fonds, voit ce qu'il encaisse, puis la clôture en comptant ce qu'il a en
 * main. L'écart avec les espèces attendues s'affiche en direct ; il exige une explication, et au-delà de la limite un responsable devra
 * contre-signer. Sans caisse ouverte, l'encaissement est impossible. Une fois clôturée, la fiche de passation s'imprime.
 */
@Component({
  selector: 'app-my-cash-page',
  imports: [RouterLink, HlmButtonImports, FormBuilderComponent, SessionSummary],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-col gap-6">
      <header class="flex flex-wrap items-end justify-between gap-4">
        <div class="flex flex-col">
          <h1 class="text-[28px] leading-9 font-semibold text-foreground">{{ i18n.t('billing.session.title') }}</h1>
          <p class="text-sm leading-6 text-muted-foreground">{{ i18n.t('billing.session.lead') }}</p>
        </div>
        @if (session() && !closing()) {
          <button hlmBtn type="button" [class]="primary" (click)="startClosing()">{{ i18n.t('billing.session.close') }}</button>
        }
      </header>

      @if (loading()) {
        <p class="text-sm text-muted-foreground" role="status">{{ i18n.t('common.loading') }}</p>
      } @else if (loadError()) {
        <app-form-builder [fields]="loadFailure()" formId="my-cash-load" />
      } @else if (session(); as s) {
        <div [class]="layoutClass()">
          <app-session-summary [session]="s" />

          @if (closing()) {
            <aside class="flex flex-col gap-4 border border-border bg-card p-6" aria-labelledby="close-title">
              <h2 id="close-title" class="text-lg leading-[26px] font-semibold text-foreground">{{ i18n.t('billing.session.closeTitle') }}</h2>
              <app-form-builder #form [fields]="closeFields()" [busy]="busy()" formId="close-session" (submitted)="close($event)" (action)="onAction($event)" (valueChange)="values.set($event)" />
              @if (preview(); as p) {
                <div class="flex flex-col gap-1 text-sm leading-6" role="status">
                  <p>{{ i18n.t('billing.session.previewCounted', { counted: p.counted, expected: p.expected }) }}</p>
                  <p class="font-semibold" [class.text-status-critical]="p.off" [class.text-status-success]="!p.off">{{ p.variance }}</p>
                  @if (p.review) {
                    <p class="text-status-warning">{{ i18n.t('billing.session.previewReview', { limit: p.limit }) }}</p>
                  }
                </div>
              }
            </aside>
          }
        </div>
      } @else {
        @if (lastClosed(); as done) {
          <div class="flex flex-col gap-3">
            <app-form-builder [fields]="closedNotice()" formId="my-cash-closed" />
            <app-session-summary [session]="done" [printable]="true" />
            <div class="flex flex-wrap gap-3">
              <button hlmBtn type="button" variant="outline" [class]="primary" (click)="print()">{{ i18n.t('billing.session.print') }}</button>
              <a hlmBtn variant="outline" [routerLink]="['/billing/sessions', done.id]" [class]="primary">{{ i18n.t('billing.session.openDetail') }}</a>
            </div>
          </div>
        }

        <section class="flex max-w-3xl flex-col gap-4 border border-border bg-card p-6">
          <h2 class="text-lg leading-[26px] font-semibold text-foreground">{{ i18n.t(lastClosed() ? 'billing.session.openAnother' : 'billing.session.openTitle') }}</h2>
          <p class="text-sm leading-6 text-muted-foreground">{{ i18n.t('billing.session.openLead') }}</p>
          @if (denominations()) {
            <app-form-builder #form [fields]="openFields()" [busy]="busy()" formId="open-session" (submitted)="open($event)" (valueChange)="values.set($event)" />
            <p class="text-sm leading-6 font-semibold" role="status">{{ i18n.t('billing.session.previewFloat', { amount: money(floatTotal()) }) }}</p>
          }
        </section>
      }
    </div>
  `,
})
export class MyCashPage {
  protected readonly i18n = inject(Translator);
  private readonly gateway = inject(CashSessionGateway);
  private readonly formatter = inject(MoneyFormatter);
  private readonly toast = inject(ToastService);
  private readonly document = inject(DOCUMENT);
  private readonly form = viewChild<FormBuilderComponent>('form');

  protected readonly primary = PRIMARY;
  protected readonly loading = signal(true);
  protected readonly loadError = signal<string | null>(null);
  protected readonly session = signal<CashSessionDetail | null>(null);
  protected readonly lastClosed = signal<CashSessionDetail | null>(null);
  protected readonly denominations = signal<DenominationsInfo | null>(null);
  protected readonly closing = signal(false);
  protected readonly busy = signal(false);
  /** Valeurs courantes du formulaire ouvert : sert à l'aperçu du fonds ou de l'écart. */
  protected readonly values = signal<Record<string, unknown>>({});
  private readonly notice = signal<string | null>(null);

  protected readonly loadFailure = computed(() => failureNotice(this.loadError()));
  protected readonly layoutClass = computed(() => (this.closing() ? 'grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_400px]' : 'grid items-start gap-6'));

  private readonly label = (value: number): string => {
    const info = this.denominations();
    return info ? this.formatter.format(value, info.currency, info.currencyDigits) : String(value);
  };

  protected readonly openFields = computed(() => openSessionFields({ denominations: this.denominations()?.denominations ?? [], label: this.label, notice: this.notice() }));
  protected readonly closeFields = computed(() => closeSessionFields({ denominations: this.denominations()?.denominations ?? [], label: this.label, notice: this.notice() }));
  protected readonly closedNotice = computed<FieldSchema[]>(() => {
    const review = this.lastClosed()?.status === 'AWAITING_REVIEW';
    return [{
      type: 'message', name: 'closed', tone: review ? 'warning' : 'success', appearance: 'outlined',
      title: review ? 'billing.session.awaitingTitle' : 'billing.session.closedTitle', text: review ? 'billing.session.awaitingText' : 'billing.session.closedText',
    }];
  });

  protected readonly floatTotal = computed(() => countTotal(countFrom(this.values(), this.denominations()?.denominations ?? [])));

  /** Aperçu de la clôture : espèces comptées, attendues, écart, et mise en garde si une contre-signature sera nécessaire. */
  protected readonly preview = computed(() => {
    const s = this.session();
    const info = this.denominations();
    if (!s || !info || !this.closing()) return null;
    const counted = countTotal(countFrom(this.values(), info.denominations));
    const variance = counted - s.expectedCash;
    const fmt = (n: number) => this.formatter.format(n, s.currency, s.currencyDigits);
    const text = variance === 0 ? this.i18n.t('billing.session.previewBalanced') : this.i18n.t(variance < 0 ? 'billing.session.previewMissing' : 'billing.session.previewExtra', { amount: fmt(Math.abs(variance)) });
    return { counted: fmt(counted), expected: fmt(s.expectedCash), variance: text, off: variance !== 0, review: Math.abs(variance) > info.varianceLimit, limit: fmt(info.varianceLimit) };
  });

  constructor() {
    void this.load();
  }

  private async load(): Promise<void> {
    try {
      const [info, current] = await Promise.all([this.gateway.denominations(), this.gateway.current()]);
      this.denominations.set(info);
      this.session.set(current);
    } catch (error) {
      this.loadError.set(failureMessage(error, this.i18n));
    } finally {
      this.loading.set(false);
    }
  }

  protected money(amount: number): string {
    const info = this.denominations();
    return info ? this.formatter.format(amount, info.currency, info.currencyDigits) : String(amount);
  }

  protected startClosing(): void {
    this.notice.set(null);
    this.values.set({});
    this.closing.set(true);
  }

  protected print(): void {
    this.document.defaultView?.print();
  }

  protected onAction(event: FormAction): void {
    if (event.action === 'cancel') {
      this.closing.set(false);
      this.notice.set(null);
      this.values.set({});
    }
  }

  protected async open(value: Record<string, unknown>): Promise<void> {
    const info = this.denominations();
    if (!info) return;
    this.notice.set(null);
    this.busy.set(true);
    try {
      const opened = await this.gateway.open({ counter: String(value['counter']), openingCount: countFrom(value, info.denominations) });
      this.session.set(opened);
      this.lastClosed.set(null);
      this.values.set({});
      this.toast.show(this.i18n.t('billing.session.opened', { number: opened.number }));
    } catch (error) {
      this.notice.set(failureMessage(error, this.i18n, this.form()));
    } finally {
      this.busy.set(false);
    }
  }

  protected async close(value: Record<string, unknown>): Promise<void> {
    const s = this.session();
    const info = this.denominations();
    if (!s || !info) return;
    this.notice.set(null);
    const count = countFrom(value, info.denominations);
    const reason = String(value['reason'] ?? '').trim();
    // L'API l'exige aussi, mais on le dit tout de suite : une caisse qui n'est pas juste doit s'expliquer.
    if (countTotal(count) !== s.expectedCash && reason === '') return this.notice.set(this.i18n.t('billing.session.reasonRequired'));
    this.busy.set(true);
    try {
      const done = await this.gateway.close(s.id, { count, ...(reason ? { reason } : {}) });
      this.session.set(null);
      this.lastClosed.set(done);
      this.closing.set(false);
      this.values.set({});
    } catch (error) {
      this.notice.set(failureMessage(error, this.i18n, this.form()));
    } finally {
      this.busy.set(false);
    }
  }
}
