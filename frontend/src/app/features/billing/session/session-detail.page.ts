import { DOCUMENT } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal, untracked, viewChild } from '@angular/core';
import { RouterLink } from '@angular/router';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { hasPermission } from '../../../core/auth/permissions';
import { SessionStore } from '../../../core/auth/session.store';
import { CashSessionGateway } from '../../../core/billing/cash-session.gateway';
import { CashSessionDetail, awaitsReview } from '../../../core/billing/cash-session.models';
import { Translator } from '../../../core/i18n/translator';
import { failureMessage, failureNotice } from '../../../shared/failure-message';
import { FormBuilderComponent } from '../../../shared/form-builder/form-builder';
import { FormAction } from '../../../shared/form-builder/form-schema';
import { ToastService } from '../../../shared/toast/toast.service';
import { SessionSummary } from './session-summary';
import { cosignFields } from './session.forms';

const LINK = 'rounded-[2px] font-medium text-primary underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none';
const PRIMARY = 'h-auto min-h-11 rounded-[2px] px-4 py-[11px] text-sm leading-[22px] font-semibold shadow-none';

/** Détail d'une session de caisse : son rapport, la fiche de passation à imprimer, et la contre-signature d'une clôture à écart élevé. */
@Component({
  selector: 'app-session-detail-page',
  imports: [RouterLink, HlmButtonImports, FormBuilderComponent, SessionSummary],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-col gap-6">
      <a routerLink="/billing/sessions" [class]="link" class="w-fit text-sm">{{ i18n.t('billing.sessionDetail.back') }}</a>

      @if (loading()) {
        <p class="text-sm text-muted-foreground" role="status">{{ i18n.t('common.loading') }}</p>
      } @else if (loadError()) {
        <app-form-builder [fields]="loadFailure()" formId="session-load" />
      } @else if (session(); as s) {
        <header class="flex flex-wrap items-end justify-between gap-4">
          <h1 class="text-[28px] leading-9 font-semibold text-foreground">{{ i18n.t('billing.sessionDetail.title') }}</h1>
          <div class="flex flex-wrap gap-3">
            <button hlmBtn type="button" variant="outline" [class]="primary" (click)="print()">{{ i18n.t('billing.session.print') }}</button>
            @if (canCosign() && waiting() && !cosigning()) {
              <button hlmBtn type="button" [class]="primary" (click)="cosigning.set(true)">{{ i18n.t('billing.cosign.open') }}</button>
            }
          </div>
        </header>

        <div [class]="layoutClass()">
          <app-session-summary [session]="s" [printable]="true" />

          @if (cosigning()) {
            <aside class="flex flex-col gap-4 border border-border bg-card p-6" aria-labelledby="cosign-title">
              <h2 id="cosign-title" class="text-lg leading-[26px] font-semibold text-foreground">{{ i18n.t('billing.cosign.panelTitle') }}</h2>
              <app-form-builder #form [fields]="fields()" [busy]="busy()" formId="cosign-session" (submitted)="cosign($event)" (action)="onAction($event)" />
            </aside>
          }
        </div>
      }
    </div>
  `,
})
export class SessionDetailPage {
  protected readonly i18n = inject(Translator);
  private readonly gateway = inject(CashSessionGateway);
  private readonly toast = inject(ToastService);
  private readonly document = inject(DOCUMENT);
  private readonly user = inject(SessionStore).user;
  private readonly form = viewChild<FormBuilderComponent>('form');

  /** Identifiant de la session, lu dans l'adresse (`/billing/sessions/:id`). */
  readonly id = input.required<string>();

  protected readonly link = LINK;
  protected readonly primary = PRIMARY;
  protected readonly loading = signal(true);
  protected readonly loadError = signal<string | null>(null);
  protected readonly session = signal<CashSessionDetail | null>(null);
  protected readonly cosigning = signal(false);
  protected readonly busy = signal(false);
  private readonly notice = signal<string | null>(null);

  protected readonly loadFailure = computed(() => failureNotice(this.loadError()));
  protected readonly fields = computed(() => cosignFields({ notice: this.notice() }));
  protected readonly canCosign = computed(() => hasPermission(this.user()?.permissions ?? [], 'billing.sessions:cosign'));
  protected readonly waiting = computed(() => !!this.session() && awaitsReview(this.session()!));
  protected readonly layoutClass = computed(() => (this.cosigning() ? 'grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_400px]' : 'grid items-start gap-6'));

  constructor() {
    effect(() => {
      const id = this.id();
      untracked(() => void this.load(id));
    });
  }

  private async load(id: string): Promise<void> {
    this.loading.set(true);
    this.loadError.set(null);
    this.cosigning.set(false);
    try {
      this.session.set(await this.gateway.get(id));
    } catch (error) {
      this.session.set(null);
      this.loadError.set(failureMessage(error, this.i18n));
    } finally {
      this.loading.set(false);
    }
  }

  protected print(): void {
    this.document.defaultView?.print();
  }

  protected onAction(event: FormAction): void {
    if (event.action === 'cancel') {
      this.cosigning.set(false);
      this.notice.set(null);
    }
  }

  protected async cosign(value: Record<string, unknown>): Promise<void> {
    const s = this.session();
    if (!s) return;
    this.notice.set(null);
    this.busy.set(true);
    try {
      const comment = String(value['comment'] ?? '').trim();
      this.session.set(await this.gateway.cosign(s.id, comment === '' ? null : comment));
      this.cosigning.set(false);
      this.toast.show(this.i18n.t('billing.cosign.done', { number: s.number }));
    } catch (error) {
      this.notice.set(failureMessage(error, this.i18n, this.form()));
    } finally {
      this.busy.set(false);
    }
  }
}
