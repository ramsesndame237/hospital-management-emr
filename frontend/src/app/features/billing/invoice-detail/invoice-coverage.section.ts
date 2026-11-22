import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal, untracked, viewChild } from '@angular/core';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { hasPermission } from '../../../core/auth/permissions';
import { SessionStore } from '../../../core/auth/session.store';
import { BillingGateway } from '../../../core/billing/billing.gateway';
import { Invoice, PatientCoverage, Payer } from '../../../core/billing/billing.models';
import { Translator } from '../../../core/i18n/translator';
import { failureMessage, failureNotice } from '../../../shared/failure-message';
import { FormBuilderComponent } from '../../../shared/form-builder/form-builder';
import { FormAction } from '../../../shared/form-builder/form-schema';
import { ToastService } from '../../../shared/toast/toast.service';
import { coverageFields } from '../billing.forms';

const LINK = 'rounded-[2px] font-medium text-primary underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-50';

/**
 * Assurance (tiers payant) d'un brouillon de facture : on y applique une couverture valable du patient — l'assureur prend en charge son pourcentage de ce qui
 * reste après remise, et le patient ne règle que le reste — ou on en enregistre une nouvelle. Après l'émission, la section ne fait plus que dire ce qui a été décidé.
 */
@Component({
  selector: 'app-invoice-coverage',
  imports: [HlmButtonImports, FormBuilderComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="border border-border bg-card" aria-labelledby="coverage-title">
      <h2 id="coverage-title" class="border-b border-border px-4 py-3 text-lg leading-[26px] font-semibold text-foreground">{{ i18n.t('billing.coverage.title') }}</h2>
      <div class="flex flex-col gap-4 px-4 py-4 text-sm leading-6">
        @if (error()) {
          <app-form-builder [fields]="failure()" formId="coverage-error" />
        }

        @if (invoice().coverage; as c) {
          <div class="flex flex-wrap items-start justify-between gap-3">
            <p>
              <span class="font-medium">{{ c.payerName ?? c.payerId }}</span> · {{ i18n.t('billing.coverage.percent', { percent: c.percent }) }}
              @if (c.policyNumber) { · <span class="font-mono text-xs">{{ c.policyNumber }}</span> }
              @if (c.settledAt) {
                <span class="text-status-success"> · {{ i18n.t('billing.coverage.settledRef', { reference: c.settlementReference ?? '' }) }}</span>
              }
            </p>
            @if (editable()) {
              <button type="button" [class]="link" [disabled]="busy()" (click)="remove()">{{ i18n.t('billing.coverage.remove') }}</button>
            }
          </div>
        } @else if (!editable()) {
          <p class="text-muted-foreground">{{ i18n.t('billing.coverage.none') }}</p>
        }

        @if (editable()) {
          @if (usable().length > 0) {
            <div class="flex flex-wrap items-end gap-3">
              <label class="flex min-w-60 flex-col gap-1">
                <span class="text-xs leading-[18px] text-muted-foreground">{{ i18n.t('billing.coverage.choose') }}</span>
                <select #choice class="h-11 rounded-[2px] border border-input bg-background px-3 text-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none" (change)="chosen.set(choice.value)">
                  @for (cov of usable(); track cov.id) {
                    <option [value]="cov.id" [selected]="cov.id === selected()">{{ label(cov) }}</option>
                  }
                </select>
              </label>
              <button hlmBtn type="button" variant="outline" class="h-auto min-h-11 rounded-[2px] px-4 py-[11px] text-sm leading-[22px] font-semibold shadow-none" [disabled]="busy()" (click)="apply()">
                {{ i18n.t('billing.coverage.apply') }}
              </button>
            </div>
          } @else if (loaded()) {
            <p class="text-muted-foreground">{{ i18n.t('billing.coverage.noneValid') }}</p>
          }

          @if (canRecord()) {
            @if (adding()) {
              <app-form-builder #form [fields]="recordFields()" [busy]="busy()" formId="coverage-new" (submitted)="record($event)" (action)="onAction($event)" />
            } @else {
              <button type="button" [class]="link" class="w-fit" (click)="startAdding()">{{ i18n.t('billing.coverage.add') }}</button>
            }
          }
        }
      </div>
    </section>
  `,
})
export class InvoiceCoverageSection {
  protected readonly i18n = inject(Translator);
  private readonly gateway = inject(BillingGateway);
  private readonly toast = inject(ToastService);
  private readonly user = inject(SessionStore).user;
  private readonly form = viewChild<FormBuilderComponent>('form');

  readonly invoice = input.required<Invoice>();
  /** Émis avec la facture mise à jour (couverture appliquée ou retirée). */
  readonly updated = output<Invoice>();

  protected readonly link = LINK;
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly loaded = signal(false);
  protected readonly coverages = signal<readonly PatientCoverage[]>([]);
  protected readonly payers = signal<readonly Payer[]>([]);
  protected readonly adding = signal(false);
  protected readonly chosen = signal<string | null>(null);
  private readonly notice = signal<string | null>(null);

  private readonly permissions = computed(() => this.user()?.permissions ?? []);
  /** Seul un brouillon se modifie, par qui peut écrire une facture. */
  protected readonly editable = computed(() => this.invoice().status === 'DRAFT' && hasPermission(this.permissions(), 'billing.invoices:write'));
  protected readonly canRecord = computed(() => hasPermission(this.permissions(), 'billing.coverages:write'));
  protected readonly failure = computed(() => failureNotice(this.error()));
  protected readonly usable = computed(() => this.coverages().filter((c) => c.validToday));
  protected readonly selected = computed(() => this.chosen() ?? this.usable()[0]?.id ?? '');
  protected readonly recordFields = computed(() => coverageFields({ payers: this.payers().filter((p) => p.active), notice: this.notice() }));

  constructor() {
    effect(() => {
      const patientId = this.invoice().patient?.id;
      if (patientId && this.editable()) untracked(() => void this.load(patientId));
    });
  }

  private async load(patientId: string): Promise<void> {
    try {
      this.coverages.set(await this.gateway.listCoverages(patientId));
    } catch (error) {
      this.error.set(failureMessage(error, this.i18n));
    } finally {
      this.loaded.set(true);
    }
  }

  protected label(c: PatientCoverage): string {
    return this.i18n.t('billing.coverage.option', { payer: c.payer?.name ?? '—', percent: c.percent, policy: c.policyNumber });
  }

  protected async apply(): Promise<void> {
    const id = this.selected();
    if (!id) return;
    await this.run(async () => {
      const next = await this.gateway.applyCoverage(this.invoice().id, id);
      this.toast.show(this.i18n.t('billing.coverage.applied'));
      this.updated.emit(next);
    });
  }

  protected async remove(): Promise<void> {
    await this.run(async () => {
      const next = await this.gateway.removeCoverage(this.invoice().id);
      this.toast.show(this.i18n.t('billing.coverage.removed'));
      this.updated.emit(next);
    });
  }

  protected async startAdding(): Promise<void> {
    this.notice.set(null);
    this.adding.set(true);
    try {
      if (this.payers().length === 0) this.payers.set((await this.gateway.listPayers('', false, 0, 200)).items);
    } catch (error) {
      this.notice.set(failureMessage(error, this.i18n));
    }
  }

  protected onAction(event: FormAction): void {
    if (event.action === 'cancel') this.adding.set(false);
  }

  protected async record(value: Record<string, unknown>): Promise<void> {
    const patientId = this.invoice().patient?.id;
    if (!patientId) return;
    this.notice.set(null);
    this.busy.set(true);
    try {
      const created = await this.gateway.recordCoverage(patientId, {
        payerId: String(value['payerId']),
        policyNumber: String(value['policyNumber']).trim(),
        percent: Number(String(value['percent']).trim()),
        ...(String(value['validFrom'] ?? '').trim() ? { validFrom: String(value['validFrom']).trim() } : {}),
        ...(String(value['validUntil'] ?? '').trim() ? { validUntil: String(value['validUntil']).trim() } : {}),
      });
      this.coverages.update((list) => [created, ...list]);
      this.chosen.set(created.id);
      this.adding.set(false);
      this.toast.show(this.i18n.t('billing.coverage.recorded'));
    } catch (error) {
      this.notice.set(failureMessage(error, this.i18n, this.form()));
    } finally {
      this.busy.set(false);
    }
  }

  private async run(action: () => Promise<void>): Promise<void> {
    this.busy.set(true);
    this.error.set(null);
    try {
      await action();
    } catch (error) {
      this.error.set(failureMessage(error, this.i18n));
    } finally {
      this.busy.set(false);
    }
  }
}
