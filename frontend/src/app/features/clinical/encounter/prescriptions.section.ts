import { ChangeDetectionStrategy, Component, OnInit, computed, inject, input, signal, viewChild } from '@angular/core';
import { hasPermission } from '../../../core/auth/permissions';
import { SessionStore } from '../../../core/auth/session.store';
import { ClinicalGateway } from '../../../core/clinical/clinical.gateway';
import { DrugSuggestion, Prescription, PrescriptionLineInput } from '../../../core/clinical/clinical.models';
import { Translator } from '../../../core/i18n/translator';
import { DateTimeFormatter } from '../../../core/time/date-time-formatter';
import { Temporal } from '../../../core/time/temporal';
import { failureMessage } from '../../../shared/failure-message';
import { FormBuilderComponent } from '../../../shared/form-builder/form-builder';
import { FormAction } from '../../../shared/form-builder/form-schema';
import { StatusTag } from '../../../shared/status-tag';
import { ToastService } from '../../../shared/toast/toast.service';
import { cancelPrescriptionFields } from '../clinical.forms';

const LINK = 'rounded-[2px] font-medium text-primary underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-50';
const PRIMARY = 'inline-flex min-h-11 items-center rounded-[2px] bg-primary px-4 text-sm font-semibold text-primary-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-50';
const SECONDARY = 'inline-flex min-h-11 items-center rounded-[2px] border border-border bg-background px-4 text-sm font-semibold text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-50';
const CELL = 'h-9 w-full border border-input bg-background px-2 text-sm rounded-[2px] focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none';

/** Une ligne en cours de saisie : tout est du texte tant que l'ordonnance n'est pas émise. */
interface Draft {
  readonly drug: DrugSuggestion;
  dose: string;
  frequency: string;
  durationDays: string;
  quantity: string;
  instructions: string;
  override: string;
}

/**
 * Ordonnances d'une consultation : celles déjà émises (annulables par leur auteur) et, pendant la consultation en cours, le composeur d'une
 * nouvelle ordonnance. La recherche de médicaments rapporte les alertes d'allergie du patient ; prescrire malgré une alerte exige un motif, que
 * l'ordonnance conserve.
 */
@Component({
  selector: 'app-prescriptions-section',
  imports: [FormBuilderComponent, StatusTag],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="flex flex-col gap-3" aria-labelledby="rx-title">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <h2 id="rx-title" class="text-lg leading-[26px] font-semibold text-foreground">{{ i18n.t('clinical.rx.title') }}</h2>
        @if (canIssue() && !composing()) {
          <button type="button" [class]="secondary" (click)="startComposing()">{{ i18n.t('clinical.rx.new') }}</button>
        }
      </div>

      @if (error()) {
        <p class="border-l-4 border-status-critical bg-card p-3 text-sm text-status-critical" role="alert">{{ error() }}</p>
      }

      @if (composing() && canIssue()) {
        <div class="flex flex-col gap-4 border border-border bg-card p-4" data-test="composer">
          <label class="flex flex-col gap-1 text-sm">
            {{ i18n.t('clinical.rx.search') }}
            <input id="rx-search" [class]="cell" type="search" autocomplete="off" [value]="query()" [placeholder]="i18n.t('clinical.rx.searchHint')" (input)="onSearch($any($event.target).value)" />
          </label>
          @if (results().length > 0) {
            <ul class="flex flex-col divide-y divide-border border border-border" data-test="results" [attr.aria-label]="i18n.t('clinical.rx.results')">
              @for (d of results(); track d.id) {
                <li>
                  <button type="button" class="flex w-full flex-wrap items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none" [attr.data-test]="'result-' + d.code" (click)="pick(d)">
                    <span><span class="font-medium">{{ d.name }}</span>@if (d.strength) { · {{ d.strength }}} <span class="text-xs text-muted-foreground">({{ d.genericName }} · {{ d.code }})</span></span>
                    @if (d.allergyAlerts.length > 0) {
                      <app-status-tag tone="critical" [text]="i18n.t('clinical.rx.allergyTag')" />
                    }
                  </button>
                </li>
              }
            </ul>
          } @else if (searched() && query().trim().length >= 2) {
            <p class="text-sm text-muted-foreground">{{ i18n.t('clinical.rx.noResult') }}</p>
          }

          @for (row of drafts(); track row.drug.id; let i = $index) {
            <fieldset class="grid gap-2 border border-border p-3 sm:grid-cols-6" [attr.data-test]="'draft-' + row.drug.code">
              <legend class="px-1 text-sm font-medium">{{ row.drug.name }}@if (row.drug.strength) { · {{ row.drug.strength }}} <span class="text-xs font-normal text-muted-foreground">({{ row.drug.unit }})</span></legend>
              <label class="flex flex-col gap-1 text-xs sm:col-span-2">{{ i18n.t('clinical.rx.dose') }}<input [class]="cell" [id]="'rx-' + i + '-dose'" type="text" [value]="row.dose" (input)="set(i, 'dose', $any($event.target).value)" /></label>
              <label class="flex flex-col gap-1 text-xs sm:col-span-2">{{ i18n.t('clinical.rx.frequency') }}<input [class]="cell" [id]="'rx-' + i + '-frequency'" type="text" [value]="row.frequency" (input)="set(i, 'frequency', $any($event.target).value)" /></label>
              <label class="flex flex-col gap-1 text-xs">{{ i18n.t('clinical.rx.duration') }}<input [class]="cell" class="font-mono" [id]="'rx-' + i + '-days'" type="text" inputmode="numeric" [value]="row.durationDays" (input)="set(i, 'durationDays', $any($event.target).value)" /></label>
              <label class="flex flex-col gap-1 text-xs">{{ i18n.t('clinical.rx.quantity', { unit: row.drug.unit }) }}<input [class]="cell" class="font-mono" [id]="'rx-' + i + '-quantity'" type="text" inputmode="numeric" [value]="row.quantity" (input)="set(i, 'quantity', $any($event.target).value)" /></label>
              <label class="flex flex-col gap-1 text-xs sm:col-span-5">{{ i18n.t('clinical.rx.instructions') }}<input [class]="cell" [id]="'rx-' + i + '-instructions'" type="text" [value]="row.instructions" (input)="set(i, 'instructions', $any($event.target).value)" /></label>
              <div class="flex items-end"><button type="button" [class]="link" class="pb-2 text-xs" [attr.aria-label]="i18n.t('clinical.rx.removeOf', { name: row.drug.name })" (click)="remove(i)">{{ i18n.t('clinical.diagnoses.remove') }}</button></div>
              @if (row.drug.allergyAlerts.length > 0) {
                <div class="flex flex-col gap-2 border-l-4 border-status-critical bg-muted p-3 sm:col-span-6" role="alert" [attr.data-test]="'alert-' + row.drug.code">
                  <p class="text-sm font-medium text-status-critical">
                    @for (a of row.drug.allergyAlerts; track a.allergyId; let last = $last) { {{ i18n.t('clinical.rx.alert', { substance: a.substance, severity: i18n.t('clinical.severity.' + a.severity) }) }}@if (!last) { ; } }
                  </p>
                  <label class="flex flex-col gap-1 text-xs">{{ i18n.t('clinical.rx.override') }}<input [class]="cell" [id]="'rx-' + i + '-override'" type="text" [value]="row.override" (input)="set(i, 'override', $any($event.target).value)" /></label>
                </div>
              }
            </fieldset>
          }

          <label class="flex flex-col gap-1 text-sm">{{ i18n.t('clinical.rx.notes') }}<input id="rx-notes" [class]="cell" type="text" maxlength="300" [value]="notes()" (input)="notes.set($any($event.target).value)" /></label>

          @if (composeNotice()) {
            <p class="border-l-4 border-status-critical bg-card p-3 text-sm text-status-critical" role="alert" data-test="compose-error">{{ composeNotice() }}</p>
          }
          <div class="flex flex-wrap gap-3">
            <button type="button" [class]="primary" [disabled]="busy() === 'issue' || drafts().length === 0" (click)="issue()">{{ i18n.t('clinical.rx.issue') }}</button>
            <button type="button" [class]="secondary" (click)="stopComposing()">{{ i18n.t('clinical.cancelAction') }}</button>
          </div>
        </div>
      }

      @if (loading()) {
        <p class="text-sm text-muted-foreground" role="status">{{ i18n.t('common.loading') }}</p>
      } @else {
        <ul class="flex flex-col gap-3" data-test="prescriptions">
          @for (p of prescriptions(); track p.id) {
            <li class="flex flex-col gap-2 border border-border bg-card p-4" [attr.data-test]="p.number">
              <div class="flex flex-wrap items-center justify-between gap-2">
                <span class="flex items-center gap-2 text-sm"><span class="font-mono font-medium">{{ p.number }}</span><app-status-tag [tone]="p.status === 'ISSUED' ? 'success' : 'critical'" [text]="i18n.t('clinical.rx.status.' + p.status)" />
                  @if (p.status === 'ISSUED' && p.dispensing !== 'NONE') { <app-status-tag [tone]="p.dispensing === 'COMPLETE' ? 'success' : 'warning'" [text]="i18n.t('clinical.rx.dispensing.' + p.dispensing)" /> }</span>
                <span class="text-xs text-muted-foreground">{{ i18n.t('clinical.rx.issuedBy', { who: p.doctor?.username ?? '', when: when(p.issuedAt) }) }}</span>
              </div>
              <ul class="flex flex-col divide-y divide-border text-sm">
                @for (l of p.lines; track l.position) {
                  <li class="flex flex-col gap-0.5 py-2">
                    <span><span class="font-medium">{{ l.drug?.name ?? '—' }}</span>@if (l.drug?.strength) { · {{ l.drug?.strength }}}</span>
                    <span class="text-muted-foreground">{{ l.dose }} · {{ l.frequency }}@if (l.durationDays) { · {{ i18n.t('clinical.rx.days', { n: l.durationDays }) }}} · {{ i18n.t('clinical.rx.qty', { n: l.quantity, unit: l.drug?.unit ?? '' }) }}</span>
                    @if (l.instructions) { <span class="text-muted-foreground">{{ l.instructions }}</span> }
                    @if (l.allergyOverride) { <span class="text-status-critical">{{ i18n.t('clinical.rx.overridden', { reason: l.allergyOverride }) }}</span> }
                  </li>
                }
              </ul>
              @if (p.notes) { <p class="text-sm">{{ p.notes }}</p> }
              @if (p.status === 'CANCELLED') {
                <p class="text-sm text-muted-foreground">{{ i18n.t('clinical.rx.cancelledNotice', { who: p.cancelledBy?.username ?? '', reason: p.cancellationReason ?? '' }) }}</p>
              } @else if (canCancel(p)) {
                <div><button type="button" [class]="link" class="text-sm" [attr.aria-label]="i18n.t('clinical.rx.cancelOf', { number: p.number })" (click)="openCancel(p)">{{ i18n.t('clinical.rx.cancel') }}</button></div>
              }
              @if (cancelling()?.id === p.id) {
                <div class="border-t border-border pt-3">
                  <app-form-builder #cancelForm [fields]="cancelFields()" [busy]="busy() === 'cancel'" [formId]="'rx-cancel'" (submitted)="cancel($event)" (action)="onAction($event)" />
                </div>
              }
            </li>
          } @empty {
            <li class="border border-border bg-card px-4 py-3 text-sm text-muted-foreground">{{ i18n.t('clinical.rx.none') }}</li>
          }
        </ul>
      }
    </section>
  `,
})
export class PrescriptionsSection implements OnInit {
  readonly encounterId = input.required<string>();
  /** Le médecin de la consultation, tant qu'elle est en cours : il peut émettre. */
  readonly canIssue = input(false);

  protected readonly i18n = inject(Translator);
  private readonly gateway = inject(ClinicalGateway);
  private readonly dates = inject(DateTimeFormatter);
  private readonly toast = inject(ToastService);
  private readonly user = inject(SessionStore).user;
  private readonly cancelForm = viewChild<FormBuilderComponent>('cancelForm');

  protected readonly link = LINK;
  protected readonly primary = PRIMARY;
  protected readonly secondary = SECONDARY;
  protected readonly cell = CELL;
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly prescriptions = signal<readonly Prescription[]>([]);
  protected readonly composing = signal(false);
  protected readonly query = signal('');
  protected readonly results = signal<readonly DrugSuggestion[]>([]);
  protected readonly searched = signal(false);
  protected readonly drafts = signal<readonly Draft[]>([]);
  protected readonly notes = signal('');
  protected readonly composeNotice = signal<string | null>(null);
  protected readonly cancelling = signal<Prescription | null>(null);
  protected readonly cancelNotice = signal<string | null>(null);
  protected readonly busy = signal<'issue' | 'cancel' | null>(null);
  /** Numéro de la dernière recherche : une réponse tardive d'une recherche périmée est ignorée. */
  private searchSeq = 0;

  private readonly permissions = computed(() => this.user()?.permissions ?? []);
  protected readonly cancelFields = computed(() => cancelPrescriptionFields({ notice: this.cancelNotice() }));

  ngOnInit(): void {
    void this.load();
  }

  private async load(): Promise<void> {
    try {
      this.prescriptions.set(await this.gateway.listPrescriptions(this.encounterId()));
      this.error.set(null);
    } catch (error) {
      this.error.set(failureMessage(error, this.i18n));
    } finally {
      this.loading.set(false);
    }
  }

  protected startComposing(): void {
    this.composing.set(true);
    this.composeNotice.set(null);
  }

  protected stopComposing(): void {
    this.composing.set(false);
    this.query.set('');
    this.results.set([]);
    this.searched.set(false);
    this.drafts.set([]);
    this.notes.set('');
    this.composeNotice.set(null);
  }

  protected async onSearch(text: string): Promise<void> {
    this.query.set(text);
    const mine = ++this.searchSeq;
    if (text.trim().length < 2) {
      this.results.set([]);
      this.searched.set(false);
      return;
    }
    try {
      const found = await this.gateway.searchDrugs(this.encounterId(), text.trim());
      if (mine !== this.searchSeq) return;
      this.results.set(found);
      this.searched.set(true);
    } catch (error) {
      if (mine === this.searchSeq) this.composeNotice.set(failureMessage(error, this.i18n));
    }
  }

  protected pick(drug: DrugSuggestion): void {
    if (!this.drafts().some((d) => d.drug.id === drug.id)) {
      this.drafts.update((rows) => [...rows, { drug, dose: '', frequency: '', durationDays: '', quantity: '', instructions: '', override: '' }]);
    }
    this.query.set('');
    this.results.set([]);
    this.searched.set(false);
    this.searchSeq++;
  }

  protected remove(index: number): void {
    this.drafts.update((rows) => rows.filter((_, i) => i !== index));
  }

  protected set(index: number, field: 'dose' | 'frequency' | 'durationDays' | 'quantity' | 'instructions' | 'override', value: string): void {
    this.drafts.update((rows) => rows.map((r, i) => (i === index ? { ...r, [field]: value } : r)));
  }

  /** Contrôle de saisie avant d'appeler le serveur (qui garde le dernier mot) ; renvoie les lignes à envoyer, ou `null` après avoir dit pourquoi. */
  private build(): PrescriptionLineInput[] | null {
    const lines: PrescriptionLineInput[] = [];
    for (const [i, r] of this.drafts().entries()) {
      const n = i + 1;
      const quantity = r.quantity.trim();
      const days = r.durationDays.trim();
      if (r.dose.trim() === '') return this.refuse('clinical.rx.doseRequired', n);
      if (r.frequency.trim() === '') return this.refuse('clinical.rx.frequencyRequired', n);
      if (!/^\d{1,5}$/.test(quantity) || Number(quantity) < 1 || Number(quantity) > 10000) return this.refuse('clinical.rx.quantityInvalid', n);
      if (days !== '' && (!/^\d{1,3}$/.test(days) || Number(days) < 1 || Number(days) > 365)) return this.refuse('clinical.rx.durationInvalid', n);
      if (r.drug.allergyAlerts.length > 0 && r.override.trim().length < 3) return this.refuse('clinical.rx.overrideRequired', n);
      lines.push({
        drugId: r.drug.id, dose: r.dose.trim(), frequency: r.frequency.trim(), quantity: Number(quantity),
        ...(days !== '' ? { durationDays: Number(days) } : {}),
        ...(r.instructions.trim() !== '' ? { instructions: r.instructions.trim() } : {}),
        ...(r.drug.allergyAlerts.length > 0 ? { allergyOverride: r.override.trim() } : {}),
      });
    }
    return lines;
  }

  private refuse(key: string, line: number): null {
    this.composeNotice.set(this.i18n.t(key, { n: line }));
    return null;
  }

  protected async issue(): Promise<void> {
    this.composeNotice.set(null);
    const lines = this.build();
    if (!lines) return;
    this.busy.set('issue');
    try {
      const notes = this.notes().trim();
      const issued = await this.gateway.issuePrescription(this.encounterId(), { lines, ...(notes !== '' ? { notes } : {}) });
      this.prescriptions.update((all) => [...all, issued]);
      this.toast.show(this.i18n.t('clinical.rx.issued', { number: issued.number }));
      this.stopComposing();
    } catch (error) {
      this.composeNotice.set(failureMessage(error, this.i18n));
    } finally {
      this.busy.set(null);
    }
  }

  protected canCancel(p: Prescription): boolean {
    return p.status === 'ISSUED' && p.dispensing === 'NONE' && !!p.doctor && p.doctor.id === this.user()?.id && hasPermission(this.permissions(), 'clinical.prescriptions:write:department');
  }

  protected openCancel(p: Prescription): void {
    this.cancelNotice.set(null);
    this.cancelling.set(p);
  }

  protected onAction(event: FormAction): void {
    if (event.action === 'cancel') this.cancelling.set(null);
  }

  protected async cancel(value: Record<string, unknown>): Promise<void> {
    const target = this.cancelling();
    if (!target) return;
    this.busy.set('cancel');
    this.cancelNotice.set(null);
    try {
      const done = await this.gateway.cancelPrescription(target.id, String(value['reason']).trim());
      this.prescriptions.update((all) => all.map((p) => (p.id === done.id ? done : p)));
      this.toast.show(this.i18n.t('clinical.rx.cancelled', { number: done.number }));
      this.cancelling.set(null);
    } catch (error) {
      this.cancelNotice.set(failureMessage(error, this.i18n, this.cancelForm()));
    } finally {
      this.busy.set(null);
    }
  }

  protected when(iso: string): string {
    return this.dates.dateTime(Temporal.Instant.from(iso));
  }
}
