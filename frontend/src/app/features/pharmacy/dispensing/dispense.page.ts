import { ChangeDetectionStrategy, Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { hasPermission } from '../../../core/auth/permissions';
import { SessionStore } from '../../../core/auth/session.store';
import { Translator } from '../../../core/i18n/translator';
import { PharmacyGateway } from '../../../core/pharmacy/pharmacy.gateway';
import { DispenseInput, PrescriptionToDispense, RxLine } from '../../../core/pharmacy/pharmacy.models';
import { DateTimeFormatter } from '../../../core/time/date-time-formatter';
import { Temporal } from '../../../core/time/temporal';
import { failureMessage } from '../../../shared/failure-message';
import { StatusTag } from '../../../shared/status-tag';
import { ToastService } from '../../../shared/toast/toast.service';

const LINK = 'rounded-[2px] font-medium text-primary underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-50';
const PRIMARY = 'inline-flex min-h-11 items-center rounded-[2px] bg-primary px-4 text-sm font-semibold text-primary-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-50';
const CELL = 'h-9 w-full border border-input bg-background px-2 text-sm rounded-[2px] focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none';

/**
 * Délivrance d'une ordonnance : ce qui est prescrit, ce qui est déjà délivré, ce qui reste, le stock délivrable et les lots qui seraient prélevés
 * (premier périmé, premier sorti). Le pharmacien choisit la quantité à délivrer maintenant pour chaque ligne (tout ou partie) ; les allergies
 * ACTIVES du patient sont revérifiées ici — si le médecin n'en avait pas tenu compte, le pharmacien donne son propre motif. Si un médicament manque,
 * rien ne sort.
 */
@Component({
  selector: 'app-dispense-page',
  imports: [RouterLink, StatusTag],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-col gap-6">
      <a routerLink="/pharmacy/prescriptions" [class]="link" class="w-fit text-sm">← {{ i18n.t('pharmacy.dispensing.back') }}</a>

      @if (error()) {
        <p class="border-l-4 border-status-critical bg-card p-3 text-sm text-status-critical" role="alert" data-test="error">{{ error() }}</p>
      }

      @if (rx(); as r) {
        <header class="flex flex-wrap items-start justify-between gap-3">
          <div class="flex flex-col gap-1">
            <h1 class="text-[28px] leading-9 font-semibold text-foreground">{{ i18n.t('pharmacy.dispensing.prescription', { number: r.number }) }}</h1>
            @if (r.patient; as p) {
              <p class="text-sm text-muted-foreground" data-test="patient"><span class="font-medium text-foreground">{{ p.lastName }} {{ p.firstName }}</span> · <span class="font-mono">{{ p.number }}</span> · {{ p.birthDate }}</p>
            }
            <p class="text-xs text-muted-foreground">{{ i18n.t('pharmacy.dispensing.issuedBy', { who: r.doctor?.username ?? '', when: when(r.issuedAt) }) }}</p>
          </div>
          <app-status-tag [tone]="r.status === 'CANCELLED' ? 'critical' : r.dispensing === 'COMPLETE' ? 'success' : r.dispensing === 'PARTIAL' ? 'warning' : 'neutral'" [text]="stateLabel(r)" />
        </header>

        @if (r.notes) { <p class="border-l-4 border-border bg-card p-3 text-sm">{{ r.notes }}</p> }

        <section class="flex flex-col gap-3" aria-labelledby="lines-title">
          <h2 id="lines-title" class="text-lg leading-[26px] font-semibold text-foreground">{{ i18n.t('pharmacy.dispensing.lines') }}</h2>
          <div class="flex flex-col divide-y divide-border border border-border bg-card" data-test="lines">
            @for (l of r.lines; track l.position) {
              <div class="grid gap-3 p-4 lg:grid-cols-[minmax(0,1fr)_auto]" [attr.data-test]="'line-' + l.position">
                <div class="flex min-w-0 flex-col gap-1">
                  <span class="text-sm font-medium">{{ l.drug?.name ?? '—' }}@if (l.drug?.strength) { · {{ l.drug?.strength }}} <span class="text-xs font-normal text-muted-foreground">({{ l.drug?.genericName }})</span></span>
                  <span class="text-sm text-muted-foreground">{{ l.dose }} · {{ l.frequency }}@if (l.durationDays) { · {{ i18n.t('pharmacy.dispensing.days', { n: l.durationDays }) }}}</span>
                  @if (l.instructions) { <span class="text-sm text-muted-foreground">{{ l.instructions }}</span> }
                  <span class="font-mono text-xs" data-test="amounts">{{ i18n.t('pharmacy.dispensing.amounts', { prescribed: l.prescribed, dispensed: l.dispensed, remaining: l.remaining, unit: l.drug?.unit ?? '' }) }}</span>
                  <span class="text-xs text-muted-foreground">{{ i18n.t('pharmacy.dispensing.stock', { n: l.dispensable }) }}
                    @if (l.suggestion.length > 0) { · {{ i18n.t('pharmacy.dispensing.fefo') }} @for (s of l.suggestion; track s.batchNumber; let last = $last) { <span class="font-mono">{{ s.batchNumber }}</span> ({{ s.expiry }}) × {{ s.quantity }}@if (!last) { ; } } }
                  </span>
                  @if (l.allergyOverride) { <span class="text-sm text-status-warning">{{ i18n.t('pharmacy.dispensing.doctorOverride', { reason: l.allergyOverride }) }}</span> }
                  @if (l.allergyAlerts.length > 0) {
                    <span class="text-sm font-medium text-status-critical" role="alert" [attr.data-test]="'alert-' + l.position">
                      @for (a of l.allergyAlerts; track a.substance; let last = $last) { {{ i18n.t('pharmacy.dispensing.alert', { substance: a.substance, severity: i18n.t('pharmacy.dispensing.severity.' + a.severity) }) }}@if (!last) { ; } }
                    </span>
                  }
                </div>
                @if (canDispense(r) && l.remaining > 0) {
                  <div class="flex min-w-48 flex-col gap-2">
                    <label class="flex flex-col gap-1 text-xs">{{ i18n.t('pharmacy.dispensing.now') }}
                      <input [class]="cell" class="font-mono" [id]="'dsp-' + l.position + '-qty'" type="text" inputmode="numeric" [value]="quantity(l)" (input)="setQuantity(l.position, $any($event.target).value)" />
                    </label>
                    @if (l.needsAcknowledgement) {
                      <label class="flex flex-col gap-1 text-xs">{{ i18n.t('pharmacy.dispensing.ack') }}
                        <input [class]="cell" [id]="'dsp-' + l.position + '-ack'" type="text" [value]="acks()[l.position] ?? ''" (input)="setAck(l.position, $any($event.target).value)" />
                      </label>
                    }
                  </div>
                }
              </div>
            }
          </div>

          @if (canDispense(r)) {
            <label class="flex flex-col gap-1 text-sm">{{ i18n.t('pharmacy.dispensing.notes') }}
              <input id="dsp-notes" [class]="cell" type="text" maxlength="200" [value]="notes()" (input)="notes.set($any($event.target).value)" />
            </label>
            @if (notice()) { <p class="border-l-4 border-status-critical bg-card p-3 text-sm text-status-critical" role="alert" data-test="notice">{{ notice() }}</p> }
            <div><button type="button" [class]="primary" [disabled]="busy()" (click)="submit(r)">{{ i18n.t('pharmacy.dispensing.submit') }}</button></div>
          } @else if (r.status === 'CANCELLED') {
            <p class="text-sm text-muted-foreground">{{ i18n.t('pharmacy.dispensing.cancelled') }}</p>
          } @else if (r.dispensing === 'COMPLETE') {
            <p class="text-sm text-muted-foreground">{{ i18n.t('pharmacy.dispensing.complete') }}</p>
          }
        </section>

        <section class="flex flex-col gap-3" aria-labelledby="history-title">
          <h2 id="history-title" class="text-lg leading-[26px] font-semibold text-foreground">{{ i18n.t('pharmacy.dispensing.history') }}</h2>
          <ul class="flex flex-col divide-y divide-border border border-border bg-card" data-test="history">
            @for (d of r.dispensations; track d.id) {
              <li class="flex flex-col gap-1 px-4 py-3 text-sm" [attr.data-test]="d.number">
                <span><span class="font-mono text-xs">{{ d.number }}</span> · {{ i18n.t('pharmacy.dispensing.by', { who: d.dispensedBy?.username ?? '', when: when(d.dispensedAt) }) }}</span>
                @for (x of d.lines; track $index) {
                  <span class="text-muted-foreground">{{ i18n.t('pharmacy.dispensing.picked', { line: x.prescriptionPosition + 1, qty: x.quantity, batch: x.batchNumber, expiry: x.expiry }) }}@if (x.allergyOverride) { · {{ i18n.t('pharmacy.dispensing.myOverride', { reason: x.allergyOverride }) }}}</span>
                }
                @if (d.notes) { <span class="text-muted-foreground">{{ d.notes }}</span> }
              </li>
            } @empty {
              <li class="px-4 py-3 text-sm text-muted-foreground">{{ i18n.t('pharmacy.dispensing.noneYet') }}</li>
            }
          </ul>
        </section>
      } @else if (loading()) {
        <p class="text-sm text-muted-foreground" role="status">{{ i18n.t('common.loading') }}</p>
      }
    </div>
  `,
})
export class DispensePage implements OnInit {
  readonly id = input.required<string>();

  protected readonly i18n = inject(Translator);
  private readonly gateway = inject(PharmacyGateway);
  private readonly dates = inject(DateTimeFormatter);
  private readonly toast = inject(ToastService);
  private readonly user = inject(SessionStore).user;

  protected readonly link = LINK;
  protected readonly primary = PRIMARY;
  protected readonly cell = CELL;
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly notice = signal<string | null>(null);
  protected readonly busy = signal(false);
  protected readonly rx = signal<PrescriptionToDispense | null>(null);
  /** Quantités saisies (texte), par rang de ligne ; absent : la proposition (le reste, dans la limite du stock). */
  protected readonly typed = signal<Record<number, string>>({});
  protected readonly acks = signal<Record<number, string>>({});
  protected readonly notes = signal('');

  private readonly mayDispense = computed(() => hasPermission(this.user()?.permissions ?? [], 'pharmacy.dispensing:dispense'));

  async ngOnInit(): Promise<void> {
    try {
      this.rx.set(await this.gateway.getPrescription(this.id()));
      this.error.set(null);
    } catch (error) {
      this.error.set(failureMessage(error, this.i18n));
    } finally {
      this.loading.set(false);
    }
  }

  protected canDispense(r: PrescriptionToDispense): boolean {
    return this.mayDispense() && r.status === 'ISSUED' && r.dispensing !== 'COMPLETE';
  }

  /** Ce qu'on propose de délivrer d'emblée : tout le reste, dans la limite de ce qui est délivrable. */
  private proposal(l: RxLine): number {
    return Math.max(0, Math.min(l.remaining, l.dispensable));
  }

  protected quantity(l: RxLine): string {
    return this.typed()[l.position] ?? String(this.proposal(l));
  }

  protected setQuantity(position: number, value: string): void {
    this.typed.update((t) => ({ ...t, [position]: value }));
  }

  protected setAck(position: number, value: string): void {
    this.acks.update((a) => ({ ...a, [position]: value }));
  }

  /** Contrôle de saisie avant d'appeler le serveur (qui garde le dernier mot) ; renvoie ce qu'il faut envoyer, ou `null` après avoir dit pourquoi. */
  private build(r: PrescriptionToDispense): DispenseInput | null {
    const lines: { position: number; quantity: number; allergyOverride?: string }[] = [];
    for (const l of r.lines) {
      if (l.remaining <= 0) continue;
      const raw = this.quantity(l).trim();
      if (raw === '' || raw === '0') continue;
      const n = l.position + 1;
      if (!/^\d{1,5}$/.test(raw)) return this.refuse('pharmacy.dispensing.quantityInvalid', n);
      const quantity = Number(raw);
      if (quantity > l.remaining) return this.refuse('pharmacy.dispensing.tooMuch', n, { remaining: l.remaining });
      if (quantity > l.dispensable) return this.refuse('pharmacy.dispensing.noStock', n, { available: l.dispensable });
      const ack = (this.acks()[l.position] ?? '').trim();
      if (l.needsAcknowledgement && ack.length < 3) return this.refuse('pharmacy.dispensing.ackRequired', n);
      lines.push({ position: l.position, quantity, ...(l.needsAcknowledgement ? { allergyOverride: ack } : {}) });
    }
    if (lines.length === 0) return this.refuse('pharmacy.dispensing.nothing', 0);
    const notes = this.notes().trim();
    return { lines, ...(notes !== '' ? { notes } : {}) };
  }

  private refuse(key: string, n: number, params: Record<string, number> = {}): null {
    this.notice.set(this.i18n.t(key, { n, ...params }));
    return null;
  }

  protected async submit(r: PrescriptionToDispense): Promise<void> {
    this.notice.set(null);
    const input = this.build(r);
    if (!input) return;
    this.busy.set(true);
    try {
      const done = await this.gateway.dispense(r.id, input);
      this.rx.set(done);
      this.typed.set({});
      this.acks.set({});
      this.notes.set('');
      this.toast.show(this.i18n.t('pharmacy.dispensing.done', { number: done.dispensations.at(-1)?.number ?? '' }));
    } catch (error) {
      this.notice.set(failureMessage(error, this.i18n));
    } finally {
      this.busy.set(false);
    }
  }

  protected stateLabel(r: PrescriptionToDispense): string {
    return r.status === 'CANCELLED' ? this.i18n.t('pharmacy.dispensing.cancelledTag') : this.i18n.t('pharmacy.dispensing.states.' + r.dispensing);
  }

  protected when(iso: string): string {
    return this.dates.dateTime(Temporal.Instant.from(iso));
  }
}
