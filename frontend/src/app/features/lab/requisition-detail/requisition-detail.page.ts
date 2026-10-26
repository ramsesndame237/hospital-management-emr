import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal, untracked, viewChild } from '@angular/core';
import { RouterLink } from '@angular/router';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { hasPermission } from '../../../core/auth/permissions';
import { SessionStore } from '../../../core/auth/session.store';
import { Translator } from '../../../core/i18n/translator';
import { LabGateway } from '../../../core/lab/lab.gateway';
import { Requisition, Specimen, awaitsCollection, awaitsReceipt, isOpen } from '../../../core/lab/lab.models';
import { DateTimeFormatter } from '../../../core/time/date-time-formatter';
import { Temporal } from '../../../core/time/temporal';
import { failureMessage, failureNotice } from '../../../shared/failure-message';
import { FormBuilderComponent } from '../../../shared/form-builder/form-builder';
import { FormAction } from '../../../shared/form-builder/form-schema';
import { StatusTag } from '../../../shared/status-tag';
import { ToastService } from '../../../shared/toast/toast.service';
import { priorityTag, requisitionTag, specimenTag } from '../lab-status';
import { cancelFields, collectFields, rejectFields } from '../lab.forms';

const LINK = 'rounded-[2px] font-medium text-primary underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-50';
const PRIMARY = 'h-auto min-h-11 rounded-[2px] px-4 py-[11px] text-sm leading-[22px] font-semibold shadow-none';

type Panel =
  | { readonly kind: 'collect'; readonly specimen: Specimen }
  | { readonly kind: 'reject'; readonly specimen: Specimen }
  | { readonly kind: 'cancel' };

/**
 * Détail d'une demande d'analyses : le patient, les analyses demandées, et chaque échantillon avec son avancement et sa chaîne de
 * traçabilité. Le laboratoire prélève (après contrôle de deux identifiants), reçoit ou rejette ; un rejet prévoit automatiquement un
 * nouveau prélèvement. Le prescripteur ou le laboratoire annule la demande avec un motif tant qu'aucun échantillon n'est arrivé.
 */
@Component({
  selector: 'app-requisition-detail-page',
  imports: [RouterLink, HlmButtonImports, FormBuilderComponent, StatusTag],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-col gap-6">
      <a routerLink="/lab/worklist" [class]="link" class="w-fit text-sm">{{ i18n.t('lab.detail.back') }}</a>

      @if (loading()) {
        <p class="text-sm text-muted-foreground" role="status">{{ i18n.t('common.loading') }}</p>
      } @else if (loadError()) {
        <app-form-builder [fields]="loadFailure()" formId="requisition-load" />
      } @else if (requisition(); as r) {
        <header class="flex flex-wrap items-start justify-between gap-4">
          <div class="flex flex-col gap-1">
            <h1 class="flex flex-wrap items-center gap-3 text-[28px] leading-9 font-semibold text-foreground">
              <span class="font-mono">{{ r.number }}</span>
              <app-status-tag [text]="priority().label" [tone]="priority().tone" />
              <app-status-tag [text]="status().label" [tone]="status().tone" />
            </h1>
            @if (r.patient; as p) {
              <p class="text-sm leading-6">
                <span class="font-medium">{{ p.lastName }} {{ p.firstName }}</span> · <span class="font-mono text-xs text-muted-foreground">{{ p.number }}</span>
                · {{ sexLabel(p.sex) }} · {{ i18n.t('lab.detail.born', { date: p.birthDate }) }}
              </p>
            }
            <p class="text-xs text-muted-foreground">{{ i18n.t('lab.detail.orderedOn', { date: when(r.orderedAt), name: r.orderedBy?.username ?? '' }) }} · {{ i18n.t('lab.source.' + r.source) }}</p>
          </div>
          @if (cancellable()) {
            <button hlmBtn type="button" variant="outline" [class]="primary" (click)="open({ kind: 'cancel' })">{{ i18n.t('lab.detail.cancel') }}</button>
          }
        </header>

        @if (actionError()) {
          <div class="flex flex-col gap-2">
            <app-form-builder [fields]="actionFailure()" formId="requisition-action-error" />
            <button type="button" [class]="link" class="w-fit text-sm" (click)="reload()">{{ i18n.t('lab.detail.reload') }}</button>
          </div>
        }

        @if (r.status === 'CANCELLED') {
          <app-form-builder [fields]="cancelledNotice()" formId="requisition-cancelled" />
        }

        <div [class]="layoutClass()">
          <div class="flex min-w-0 flex-col gap-6">
            @if (r.clinicalNotes) {
              <section class="border border-border bg-card p-4 text-sm leading-6">
                <h2 class="text-sm font-semibold text-foreground">{{ i18n.t('lab.detail.notes') }}</h2>
                <p class="text-muted-foreground">{{ r.clinicalNotes }}</p>
              </section>
            }

            <section class="border border-border bg-card">
              <h2 class="border-b border-border px-4 py-3 text-lg leading-[26px] font-semibold text-foreground">{{ i18n.t('lab.detail.tests') }}</h2>
              <div class="overflow-x-auto">
                <table class="w-full text-left text-sm leading-6">
                  <caption class="sr-only">{{ i18n.t('lab.detail.tests') }}</caption>
                  <thead class="border-b border-border bg-muted text-xs leading-[18px] text-muted-foreground">
                    <tr>
                      <th scope="col" class="px-4 py-2 font-medium">{{ i18n.t('lab.detail.test') }}</th>
                      <th scope="col" class="px-4 py-2 font-medium">{{ i18n.t('lab.detail.section') }}</th>
                      <th scope="col" class="px-4 py-2 font-medium">{{ i18n.t('lab.detail.sample') }}</th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (t of r.tests; track t.testId) {
                      <tr class="border-b border-border last:border-b-0">
                        <td class="px-4 py-3"><span class="font-medium">{{ t.name }}</span><span class="block font-mono text-xs text-muted-foreground">{{ t.code }}</span></td>
                        <td class="px-4 py-3">{{ i18n.t('lab.section.' + t.section) }}</td>
                        <td class="px-4 py-3 font-mono text-xs">{{ barcodeOf(t.specimenId) }}</td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
            </section>

            <section class="flex flex-col gap-4" aria-labelledby="specimens-title">
              <h2 id="specimens-title" class="text-lg leading-[26px] font-semibold text-foreground">{{ i18n.t('lab.detail.specimens') }}</h2>
              @for (s of r.specimens; track s.id) {
                <article class="flex flex-col gap-3 border border-border bg-card p-4 text-sm leading-6" [class.ring-2]="s.id === specimen()" [class.ring-primary]="s.id === specimen()" [attr.aria-label]="s.barcode">
                  <div class="flex flex-wrap items-start justify-between gap-3">
                    <div class="flex flex-col">
                      <span class="flex flex-wrap items-center gap-2">
                        <span class="font-mono text-base font-semibold">{{ s.barcode }}</span>
                        <app-status-tag [text]="specimenStatus(s).label" [tone]="specimenStatus(s).tone" />
                      </span>
                      <span class="text-muted-foreground">{{ i18n.t('lab.specimenType.' + s.specimenType) }} · {{ i18n.t('lab.container.' + s.container) }}</span>
                      @if (s.recollectionOf) {
                        <span class="text-xs text-muted-foreground">{{ i18n.t('lab.detail.recollectionOf', { barcode: barcodeOf(s.recollectionOf) }) }}</span>
                      }
                    </div>
                    @if (workable()) {
                      <div class="flex flex-wrap gap-3">
                        @if (canCollect() && awaitsCollection(s)) {
                          <button hlmBtn type="button" [class]="primary" [attr.aria-label]="i18n.t('lab.detail.collectOf', { barcode: s.barcode })" (click)="open({ kind: 'collect', specimen: s })">{{ i18n.t('lab.detail.collect') }}</button>
                        }
                        @if (canReceive() && awaitsReceipt(s)) {
                          <button hlmBtn type="button" [class]="primary" [disabled]="busy()" [attr.aria-label]="i18n.t('lab.detail.receiveOf', { barcode: s.barcode })" (click)="receive(s)">{{ i18n.t('lab.detail.receive') }}</button>
                        }
                        @if (canReject() && s.status !== 'REJECTED' && s.status !== 'RECEIVED') {
                          <button hlmBtn type="button" variant="outline" [class]="primary" [attr.aria-label]="i18n.t('lab.detail.rejectOf', { barcode: s.barcode })" (click)="open({ kind: 'reject', specimen: s })">{{ i18n.t('lab.detail.reject') }}</button>
                        }
                      </div>
                    }
                  </div>
                  @if (s.collectedAt) {
                    <p class="text-muted-foreground">{{ i18n.t('lab.detail.collectedOn', { date: when(s.collectedAt), name: s.collectedBy?.username ?? '' }) }}</p>
                  }
                  @if (s.receivedAt) {
                    <p class="text-muted-foreground">{{ i18n.t('lab.detail.receivedOn', { date: when(s.receivedAt), name: s.receivedBy?.username ?? '' }) }}</p>
                  }
                  @if (s.rejectedAt && s.rejectionReason) {
                    <p class="text-status-critical">
                      {{ i18n.t('lab.detail.rejectedOn', { date: when(s.rejectedAt), name: s.rejectedBy?.username ?? '' }) }} — {{ i18n.t('lab.rejection.' + s.rejectionReason) }}@if (s.rejectionNote) { : {{ s.rejectionNote }}}
                    </p>
                  }
                  <div>
                    <h3 class="text-xs font-semibold text-muted-foreground">{{ i18n.t('lab.detail.trace') }}</h3>
                    <ol class="mt-1 flex flex-col gap-1 border-l-2 border-border pl-3">
                      @for (e of s.events; track $index) {
                        <li class="text-xs leading-5">
                          <span class="font-medium">{{ i18n.t('lab.event.' + e.kind) }}</span> · {{ when(e.at) }}@if (e.actor) { · {{ e.actor.username }}}@if (e.note) { — <span class="text-muted-foreground">{{ e.note }}</span>}
                        </li>
                      }
                    </ol>
                  </div>
                </article>
              }
            </section>
          </div>

          @if (panelView(); as current) {
            <aside class="flex flex-col gap-4 border border-border bg-card p-6" aria-labelledby="requisition-panel-title">
              <h2 id="requisition-panel-title" class="text-lg leading-[26px] font-semibold text-foreground">{{ current.title }}</h2>
              <app-form-builder #form [fields]="current.fields" [busy]="busy()" [formId]="'requisition-' + current.key" (submitted)="submit($event)" (action)="onAction($event)" />
            </aside>
          }
        </div>
      }
    </div>
  `,
})
export class RequisitionDetailPage {
  protected readonly i18n = inject(Translator);
  private readonly gateway = inject(LabGateway);
  private readonly dates = inject(DateTimeFormatter);
  private readonly toast = inject(ToastService);
  private readonly user = inject(SessionStore).user;
  private readonly form = viewChild<FormBuilderComponent>('form');

  /** Identifiant de la demande, lu dans l'adresse (`/lab/requisitions/:id`). */
  readonly id = input.required<string>();
  /** Échantillon scanné, mis en évidence (`?specimen=…`). */
  readonly specimen = input<string | undefined>(undefined);

  protected readonly link = LINK;
  protected readonly primary = PRIMARY;
  protected readonly loading = signal(true);
  protected readonly loadError = signal<string | null>(null);
  protected readonly requisition = signal<Requisition | null>(null);
  protected readonly actionError = signal<string | null>(null);
  protected readonly panel = signal<Panel | null>(null);
  protected readonly busy = signal(false);
  private readonly notice = signal<string | null>(null);

  protected readonly awaitsCollection = awaitsCollection;
  protected readonly awaitsReceipt = awaitsReceipt;
  protected readonly canCollect = computed(() => this.has('lab.specimens:collect'));
  protected readonly canReceive = computed(() => this.has('lab.specimens:receive'));
  protected readonly canReject = computed(() => this.has('lab.specimens:reject'));
  /** La demande est encore à traiter (ni annulée ni entièrement reçue). */
  protected readonly workable = computed(() => !!this.requisition() && isOpen(this.requisition()!));
  /** Annulable tant qu'elle est ouverte et qu'aucun échantillon n'est arrivé au laboratoire. */
  protected readonly cancellable = computed(() => {
    const r = this.requisition();
    return !!r && this.has('lab.requisitions:cancel') && isOpen(r) && !r.specimens.some((s) => s.status === 'RECEIVED');
  });
  protected readonly status = computed(() => requisitionTag(this.i18n, this.requisition()?.status ?? 'ORDERED'));
  protected readonly priority = computed(() => priorityTag(this.i18n, this.requisition()?.priority ?? 'ROUTINE'));
  protected readonly loadFailure = computed(() => failureNotice(this.loadError()));
  protected readonly actionFailure = computed(() => failureNotice(this.actionError()));
  protected readonly layoutClass = computed(() => (this.panel() ? 'grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_400px]' : 'grid items-start gap-6'));
  protected readonly cancelledNotice = computed(() => {
    const r = this.requisition();
    return failureNoticeFor(this.i18n.t('lab.detail.cancelledText', { name: r?.cancelledBy?.username ?? '', reason: r?.cancellationReason ?? '' }));
  });

  protected readonly panelView = computed(() => {
    const panel = this.panel();
    const notice = this.notice();
    if (!panel) return null;
    switch (panel.kind) {
      case 'collect':
        return { key: `collect-${panel.specimen.id}`, title: this.i18n.t('lab.collect.title', { barcode: panel.specimen.barcode }), fields: collectFields({ notice }) };
      case 'reject':
        return { key: `reject-${panel.specimen.id}`, title: this.i18n.t('lab.reject.title', { barcode: panel.specimen.barcode }), fields: rejectFields({ notice }) };
      case 'cancel':
        return { key: 'cancel', title: this.i18n.t('lab.cancelRequest.title'), fields: cancelFields({ notice }) };
    }
  });

  constructor() {
    effect(() => {
      const id = this.id();
      untracked(() => void this.load(id));
    });
  }

  private has(permission: string): boolean {
    return hasPermission(this.user()?.permissions ?? [], permission);
  }

  private async load(id: string): Promise<void> {
    this.loading.set(true);
    this.loadError.set(null);
    this.panel.set(null);
    try {
      this.requisition.set(await this.gateway.getRequisition(id));
    } catch (error) {
      this.requisition.set(null);
      this.loadError.set(failureMessage(error, this.i18n));
    } finally {
      this.loading.set(false);
    }
  }

  protected reload(): void {
    this.actionError.set(null);
    this.close();
    void this.load(this.id());
  }

  protected when(iso: string): string {
    return this.dates.dateTime(Temporal.Instant.from(iso));
  }

  protected sexLabel(sex: string): string {
    return this.i18n.t(`lab.detail.sex.${sex}`);
  }

  protected specimenStatus(s: Specimen) {
    return specimenTag(this.i18n, s.status);
  }

  protected barcodeOf(specimenId: string): string {
    return this.requisition()?.specimens.find((s) => s.id === specimenId)?.barcode ?? '';
  }

  protected open(panel: Panel): void {
    this.notice.set(null);
    this.actionError.set(null);
    this.panel.set(panel);
  }

  protected close(): void {
    this.panel.set(null);
    this.notice.set(null);
  }

  protected onAction(event: FormAction): void {
    if (event.action === 'cancel') this.close();
  }

  protected async receive(specimen: Specimen): Promise<void> {
    await this.act(() => this.gateway.receive(specimen.id), () => this.toast.show(this.i18n.t('lab.receive.done', { barcode: specimen.barcode })), false);
  }

  protected async submit(value: Record<string, unknown>): Promise<void> {
    const panel = this.panel();
    const r = this.requisition();
    if (!panel || !r) return;
    this.notice.set(null);
    const text = (name: string): string => String(value[name] ?? '').trim();
    switch (panel.kind) {
      case 'collect':
        await this.act(() => this.gateway.collect(panel.specimen.id, { patientNumber: text('patientNumber'), birthDate: text('birthDate') }), () => this.toast.show(this.i18n.t('lab.collect.done', { barcode: panel.specimen.barcode })));
        return;
      case 'reject': {
        if (text('reason') === 'OTHER' && text('note') === '') return this.notice.set(this.i18n.t('lab.reject.noteRequired'));
        const note = text('note');
        await this.act(
          () => this.gateway.reject(panel.specimen.id, { reason: text('reason') as never, ...(note ? { note } : {}) }),
          () => this.toast.show(this.i18n.t('lab.reject.done', { barcode: panel.specimen.barcode })),
        );
        return;
      }
      case 'cancel':
        await this.act(() => this.gateway.cancel(r.id, text('reason')), (updated) => this.toast.show(this.i18n.t('lab.cancelRequest.done', { number: updated.number })));
        return;
    }
  }

  /**
   * Exécute une action de l'API : en cas de succès la demande est remplacée par celle que le serveur renvoie (le panneau se ferme) ; en cas
   * d'échec le message apparaît dans le panneau ouvert, ou en haut de page s'il n'y en a pas.
   */
  private async act(call: () => Promise<Requisition>, done: (updated: Requisition) => void, inPanel = true): Promise<void> {
    this.busy.set(true);
    try {
      const updated = await call();
      this.requisition.set(updated);
      done(updated);
      if (inPanel) this.close();
    } catch (error) {
      const message = failureMessage(error, this.i18n, inPanel ? this.form() : undefined);
      if (inPanel && this.panel()) this.notice.set(message);
      else this.actionError.set(message);
    } finally {
      this.busy.set(false);
    }
  }
}

function failureNoticeFor(text: string) {
  return [{ type: 'message' as const, name: 'cancelled', tone: 'critical' as const, appearance: 'outlined' as const, title: 'lab.detail.cancelledTitle', text }];
}
