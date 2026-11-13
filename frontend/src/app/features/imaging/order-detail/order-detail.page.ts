import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal, untracked, viewChild } from '@angular/core';
import { RouterLink } from '@angular/router';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { hasPermission } from '../../../core/auth/permissions';
import { SessionStore } from '../../../core/auth/session.store';
import { Translator } from '../../../core/i18n/translator';
import { ImagingGateway } from '../../../core/imaging/imaging.gateway';
import { COMMUNICATION_METHODS, CommunicationInput, IONIZING, Order } from '../../../core/imaging/imaging.models';
import { Clock } from '../../../core/time/clock';
import { DateTimeFormatter } from '../../../core/time/date-time-formatter';
import { Temporal } from '../../../core/time/temporal';
import { failureMessage, failureNotice } from '../../../shared/failure-message';
import { FormBuilderComponent } from '../../../shared/form-builder/form-builder';
import { FormAction } from '../../../shared/form-builder/form-schema';
import { StatusTag } from '../../../shared/status-tag';
import { ToastService } from '../../../shared/toast/toast.service';
import { localDate, localTime, toInstantIso } from '../../reception/agenda/agenda-time';
import { orderTag, priorityTag } from '../imaging-status';
import { addendumFields, cancelFields, communicationFormFields, draftFields, performFields, scheduleFields } from '../imaging.forms';

const LINK = 'rounded-[2px] font-medium text-primary underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-50';
const PRIMARY = 'h-auto min-h-11 rounded-[2px] px-4 py-[11px] text-sm leading-[22px] font-semibold shadow-none';

type Panel = 'cancel' | 'schedule' | 'perform' | 'communicate' | 'addendum';

/**
 * Détail d'une demande d'examen. Le service d'imagerie la planifie, la réalise après dépistage de sécurité, rédige le compte rendu (brouillon), documente l'appel du
 * clinicien pour une découverte critique, puis signe ; un compte rendu signé se complète par un addendum motivé. Le prescripteur lit sa demande et seulement les
 * versions signées du compte rendu.
 */
@Component({
  selector: 'app-imaging-order-detail-page',
  imports: [RouterLink, HlmButtonImports, FormBuilderComponent, StatusTag],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-col gap-6">
      <a routerLink="/imaging/worklist" [class]="link" class="w-fit text-sm">{{ i18n.t('imaging.detail.back') }}</a>

      @if (loading()) {
        <p class="text-sm text-muted-foreground" role="status">{{ i18n.t('common.loading') }}</p>
      } @else if (loadError()) {
        <app-form-builder [fields]="loadFailure()" formId="imaging-order-load" />
      } @else if (order(); as o) {
        <header class="flex flex-wrap items-start justify-between gap-4">
          <div class="flex flex-col gap-1">
            <h1 class="flex flex-wrap items-center gap-3 text-[28px] leading-9 font-semibold text-foreground">
              <span class="font-mono">{{ o.number }}</span>
              <app-status-tag [text]="priority().label" [tone]="priority().tone" />
              <app-status-tag [text]="status().label" [tone]="status().tone" />
            </h1>
            @if (o.patient; as p) {
              <p class="text-sm leading-6">
                <span class="font-medium">{{ p.lastName }} {{ p.firstName }}</span> · <span class="font-mono text-xs text-muted-foreground">{{ p.number }}</span>
                · {{ i18n.t('imaging.detail.sex.' + p.sex) }} · {{ i18n.t('imaging.detail.born', { date: p.birthDate }) }}
              </p>
            }
            <p class="text-xs text-muted-foreground">{{ i18n.t('imaging.detail.orderedOn', { date: when(o.orderedAt), name: o.orderedBy?.username ?? '' }) }} · {{ i18n.t('imaging.source.' + o.source) }}</p>
          </div>
          <div class="flex flex-wrap gap-3">
            @if (canSchedule()) {
              <button hlmBtn type="button" variant="outline" [class]="primary" (click)="open('schedule')">{{ i18n.t(o.scheduledFor ? 'imaging.detail.reschedule' : 'imaging.detail.schedule') }}</button>
            }
            @if (canPerformNow()) {
              <button hlmBtn type="button" [class]="primary" (click)="open('perform')">{{ i18n.t('imaging.detail.perform') }}</button>
            }
            @if (cancellable()) {
              <button hlmBtn type="button" variant="outline" [class]="primary" (click)="open('cancel')">{{ i18n.t('imaging.detail.cancel') }}</button>
            }
          </div>
        </header>

        @if (actionError()) {
          <div class="flex flex-col gap-2">
            <app-form-builder [fields]="actionFailure()" formId="imaging-order-action-error" />
            <button type="button" [class]="link" class="w-fit text-sm" (click)="reload()">{{ i18n.t('imaging.detail.reload') }}</button>
          </div>
        }

        @if (o.status === 'CANCELLED') {
          <app-form-builder [fields]="cancelledNotice()" formId="imaging-order-cancelled" />
        }

        <div [class]="layoutClass()">
          <div class="flex min-w-0 flex-col gap-6">
            <section class="flex flex-col gap-3 border border-border bg-card p-4 text-sm leading-6" aria-labelledby="exam-title">
              <h2 id="exam-title" class="text-lg leading-[26px] font-semibold text-foreground">{{ i18n.t('imaging.detail.exam') }}</h2>
              <p><span class="font-medium">{{ o.examName }}</span> <span class="font-mono text-xs text-muted-foreground">{{ o.examCode }}</span> · {{ i18n.t('imaging.modality.' + o.modality) }}</p>
              <div>
                <h3 class="text-xs font-semibold text-muted-foreground">{{ i18n.t('imaging.detail.question') }}</h3>
                <p class="whitespace-pre-line" data-test="question">{{ o.clinicalQuestion }}</p>
              </div>
              @if (o.preparation && isOpenStatus(o)) {
                <p class="text-muted-foreground" data-test="preparation">{{ i18n.t('imaging.detail.preparation', { text: o.preparation }) }}</p>
              }
              @if (o.scheduledFor && o.status === 'SCHEDULED') {
                <p class="text-muted-foreground" data-test="scheduled">{{ i18n.t('imaging.detail.scheduledOn', { date: when(o.scheduledFor), name: o.scheduledBy?.username ?? '' }) }}</p>
              }
              @if (o.performedAt) {
                <p class="text-muted-foreground" data-test="performed">{{ i18n.t('imaging.detail.performedOn', { date: when(o.performedAt), name: o.performedBy?.username ?? '' }) }}</p>
                @if (o.techniqueNote) { <p class="text-muted-foreground">{{ i18n.t('imaging.detail.techniqueNote', { text: o.techniqueNote }) }}</p> }
              }
              @if (o.screening; as s) {
                <div data-test="screening">
                  <h3 class="text-xs font-semibold text-muted-foreground">{{ i18n.t('imaging.detail.screening') }}</h3>
                  <p>{{ i18n.t(s.pregnant ? 'imaging.detail.pregnantYes' : 'imaging.detail.pregnantNo') }} · {{ i18n.t(s.contrastAllergy ? 'imaging.detail.allergyYes' : 'imaging.detail.allergyNo') }}</p>
                  @if (s.overrideReason) { <p class="text-status-warning">{{ i18n.t('imaging.detail.override', { reason: s.overrideReason }) }}</p> }
                </div>
              }
            </section>

            <section class="flex flex-col gap-4 border border-border bg-card p-4" aria-labelledby="report-title">
              <h2 id="report-title" class="text-lg leading-[26px] font-semibold text-foreground">{{ i18n.t('imaging.report.title') }}</h2>

              @for (v of o.report.versions; track v.version) {
                <article class="flex flex-col gap-2 border border-border p-3 text-sm leading-6" [attr.data-test]="'version-' + v.version">
                  <header class="flex flex-wrap items-center gap-2">
                    <h3 class="font-semibold">{{ i18n.t(v.version === 1 ? 'imaging.report.signed' : 'imaging.report.addendum', { n: v.version - 1 }) }}</h3>
                    @if (v.critical) { <app-status-tag tone="critical" [text]="i18n.t('imaging.report.criticalTag')" /> }
                    <span class="text-xs text-muted-foreground">{{ i18n.t('imaging.report.signedOn', { date: when(v.signedAt), name: v.signedBy?.username ?? '' }) }}</span>
                  </header>
                  @if (v.reason) { <p class="text-status-warning">{{ i18n.t('imaging.report.addendumReasonText', { reason: v.reason }) }}</p> }
                  @if (v.technique) {
                    <div><h4 class="text-xs font-semibold text-muted-foreground">{{ i18n.t('imaging.report.technique') }}</h4><p class="whitespace-pre-line">{{ v.technique }}</p></div>
                  }
                  <div><h4 class="text-xs font-semibold text-muted-foreground">{{ i18n.t('imaging.report.findings') }}</h4><p class="whitespace-pre-line">{{ v.findings }}</p></div>
                  <div><h4 class="text-xs font-semibold text-muted-foreground">{{ i18n.t('imaging.report.impression') }}</h4><p class="font-medium whitespace-pre-line">{{ v.impression }}</p></div>
                  @for (c of communicationsOf(o, v.version); track $index) {
                    <p class="border-l-4 border-status-critical pl-3 text-xs" data-test="communication">
                      {{ i18n.t('imaging.report.communicated', { name: c.notifiedName, role: c.notifiedRole, method: i18n.t('imaging.report.method.' + c.method), date: when(c.at), by: c.by?.username ?? '' }) }}
                    </p>
                  }
                </article>
              }

              @if (o.status === 'PERFORMED') {
                @if (canWrite()) {
                  @if (o.report.criticalRequired) {
                    <div class="flex flex-col gap-2 border-l-4 border-status-critical bg-card p-3 text-sm" data-test="critical-block">
                      <p class="font-semibold">{{ i18n.t('imaging.report.criticalBlockTitle') }}</p>
                      @if (o.report.criticalCommunicated) {
                        <p>{{ i18n.t('imaging.report.criticalDone') }}</p>
                      } @else {
                        <p>{{ i18n.t('imaging.report.criticalPending') }}</p>
                        @if (canNotify()) {
                          <button hlmBtn type="button" [class]="primary" class="w-fit" (click)="open('communicate')">{{ i18n.t('imaging.report.communicate') }}</button>
                        }
                      }
                    </div>
                  }
                  <app-form-builder #draftForm [fields]="draftSchema()" [busy]="busy()" formId="imaging-draft" (submitted)="saveDraft($event)" />
                  @if (canSign()) {
                    <div class="flex flex-col gap-2">
                      <p class="text-xs text-muted-foreground">{{ i18n.t('imaging.report.signNote') }}</p>
                      <button hlmBtn type="button" [class]="primary" class="w-fit" [disabled]="busy() || !signable()" (click)="sign()">{{ i18n.t('imaging.report.sign') }}</button>
                      @if (!signable()) { <p class="text-xs text-muted-foreground" data-test="sign-blocked">{{ i18n.t(signBlock()) }}</p> }
                    </div>
                  }
                } @else {
                  <p class="text-sm text-muted-foreground" data-test="pending">{{ i18n.t('imaging.report.pending') }}</p>
                }
              } @else if (o.status === 'REPORTED') {
                @if (canSign()) {
                  <button hlmBtn type="button" variant="outline" [class]="primary" class="w-fit" (click)="open('addendum')">{{ i18n.t('imaging.report.addendumOpen') }}</button>
                }
              } @else if (o.status !== 'CANCELLED') {
                <p class="text-sm text-muted-foreground" data-test="not-performed">{{ i18n.t('imaging.report.notPerformed') }}</p>
              }
            </section>
          </div>

          @if (panelView(); as current) {
            <aside class="flex flex-col gap-4 border border-border bg-card p-6" aria-labelledby="imaging-panel-title">
              <h2 id="imaging-panel-title" class="text-lg leading-[26px] font-semibold text-foreground">{{ current.title }}</h2>
              <app-form-builder #form [fields]="current.fields" [busy]="busy()" [formId]="'imaging-' + current.key" (submitted)="submit($event)" (action)="onAction($event)" />
            </aside>
          }
        </div>
      }
    </div>
  `,
})
export class ImagingOrderDetailPage {
  protected readonly i18n = inject(Translator);
  private readonly gateway = inject(ImagingGateway);
  private readonly dates = inject(DateTimeFormatter);
  private readonly clock = inject(Clock);
  private readonly toast = inject(ToastService);
  private readonly user = inject(SessionStore).user;
  private readonly form = viewChild<FormBuilderComponent>('form');
  private readonly draftFormRef = viewChild<FormBuilderComponent>('draftForm');

  /** Identifiant de la demande, lu dans l'adresse (`/imaging/orders/:id`). */
  readonly id = input.required<string>();

  protected readonly link = LINK;
  protected readonly primary = PRIMARY;
  protected readonly loading = signal(true);
  protected readonly loadError = signal<string | null>(null);
  protected readonly actionError = signal<string | null>(null);
  protected readonly order = signal<Order | null>(null);
  protected readonly panel = signal<Panel | null>(null);
  protected readonly busy = signal(false);
  private readonly notice = signal<string | null>(null);
  private readonly draftNotice = signal<string | null>(null);

  protected readonly canSchedule = computed(() => this.live() && this.has('imaging.orders:schedule') && this.isOpen());
  protected readonly canPerformNow = computed(() => this.live() && this.has('imaging.exams:perform') && this.isOpen());
  protected readonly canWrite = computed(() => this.has('imaging.reports:write'));
  protected readonly canNotify = computed(() => this.has('imaging.reports:notify'));
  protected readonly canSign = computed(() => this.has('imaging.reports:sign'));
  /** Annulable tant que l'examen n'est pas réalisé : par son prescripteur, ou par le service d'imagerie. */
  protected readonly cancellable = computed(() => this.has('imaging.orders:cancel') && this.isOpen());
  protected readonly status = computed(() => orderTag(this.i18n, this.order()?.status ?? 'ORDERED'));
  protected readonly priority = computed(() => priorityTag(this.i18n, this.order()?.priority ?? 'ROUTINE'));
  protected readonly loadFailure = computed(() => failureNotice(this.loadError()));
  protected readonly actionFailure = computed(() => failureNotice(this.actionError()));
  protected readonly layoutClass = computed(() => (this.panel() ? 'grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_400px]' : 'grid items-start gap-6'));
  protected readonly cancelledNotice = computed(() => {
    const o = this.order();
    return [{ type: 'message' as const, name: 'cancelled', tone: 'critical' as const, appearance: 'outlined' as const, title: 'imaging.detail.cancelledTitle', text: this.i18n.t('imaging.detail.cancelledText', { name: o?.cancelledBy?.username ?? '', reason: o?.cancellationReason ?? '' }) }];
  });
  protected readonly draftSchema = computed(() => {
    const o = this.order();
    return o ? draftFields({ notice: this.draftNotice(), report: o.report }) : [];
  });
  /** Signable : un brouillon complet existe, et — pour une découverte critique — l'appel du clinicien est documenté. */
  protected readonly signable = computed(() => this.signBlock() === '');
  /** Clé du message qui explique pourquoi on ne peut pas signer encore (vide : on peut). */
  protected readonly signBlock = computed(() => {
    const d = this.order()?.report.draft;
    if (!d || !d.findings?.trim() || !d.impression?.trim()) return 'imaging.report.signIncomplete';
    return d.critical && !this.order()!.report.criticalCommunicated ? 'imaging.report.signCritical' : '';
  });

  protected readonly panelView = computed(() => {
    const panel = this.panel();
    const o = this.order();
    const notice = this.notice();
    if (!panel || !o) return null;
    switch (panel) {
      case 'cancel':
        return { key: 'cancel', title: this.i18n.t('imaging.cancelRequest.title'), fields: cancelFields({ notice }) };
      case 'schedule': {
        const current = o.scheduledFor ? Temporal.Instant.from(o.scheduledFor) : null;
        const tomorrow = Temporal.PlainDate.from(localDate(Temporal.Instant.fromEpochMilliseconds(this.clock.nowMs()))).add({ days: 1 }).toString();
        return { key: 'schedule', title: this.i18n.t('imaging.schedule.title'), fields: scheduleFields({ notice, date: current ? localDate(current) : tomorrow, time: current ? localTime(current) : '09:00' }) };
      }
      case 'perform':
        return { key: 'perform', title: this.i18n.t('imaging.perform.title'), fields: performFields({ notice, ionizing: IONIZING.includes(o.modality), usesContrast: o.usesContrast }) };
      case 'communicate':
        return { key: 'communicate', title: this.i18n.t('imaging.report.communicateTitle'), fields: communicationFormFields({ notice }) };
      case 'addendum':
        return { key: 'addendum', title: this.i18n.t('imaging.report.addendumTitle'), fields: addendumFields({ notice, report: o.report }) };
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

  private live(): boolean {
    return !!this.order() && this.order()!.status !== 'CANCELLED';
  }

  /** Ni réalisée, ni annulée : on peut encore la planifier, la réaliser ou l'annuler. */
  private isOpen(): boolean {
    const status = this.order()?.status;
    return status === 'ORDERED' || status === 'SCHEDULED';
  }

  private async load(id: string): Promise<void> {
    this.loading.set(true);
    this.loadError.set(null);
    this.panel.set(null);
    try {
      this.order.set(await this.gateway.getOrder(id));
    } catch (error) {
      this.order.set(null);
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

  protected isOpenStatus(o: Order): boolean {
    return o.status === 'ORDERED' || o.status === 'SCHEDULED';
  }

  protected communicationsOf(o: Order, version: number) {
    return o.report.communications.filter((c) => c.version === version);
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

  protected async submit(value: Record<string, unknown>): Promise<void> {
    const panel = this.panel();
    const o = this.order();
    if (!panel || !o) return;
    this.notice.set(null);
    const text = (name: string): string => String(value[name] ?? '').trim();
    switch (panel) {
      case 'cancel':
        await this.act(() => this.gateway.cancel(o.id, text('reason')), (updated) => this.toast.show(this.i18n.t('imaging.cancelRequest.done', { number: updated.number })));
        return;
      case 'schedule': {
        const when = toInstantIso(text('date'), text('time'));
        if (!when) return this.notice.set(this.i18n.t('imaging.schedule.invalid'));
        await this.act(() => this.gateway.schedule(o.id, when), () => this.toast.show(this.i18n.t('imaging.schedule.done')));
        return;
      }
      case 'perform': {
        const override = text('overrideReason');
        const note = text('techniqueNote');
        await this.act(
          () => this.gateway.perform(o.id, { pregnant: value['pregnant'] === true, contrastAllergy: value['contrastAllergy'] === true, ...(override ? { overrideReason: override } : {}), ...(note ? { techniqueNote: note } : {}) }),
          () => this.toast.show(this.i18n.t('imaging.perform.done')),
        );
        return;
      }
      case 'communicate':
        await this.act(() => this.gateway.communicate(o.id, this.communication(value)), () => this.toast.show(this.i18n.t('imaging.report.communicated_done')));
        return;
      case 'addendum': {
        const critical = value['critical'] === true;
        await this.act(
          () => this.gateway.addendum(o.id, {
            reason: text('reason'), technique: text('technique') || null, findings: text('findings'), impression: text('impression'), critical, ...(critical ? { communication: this.communication(value) } : {}),
          }),
          () => this.toast.show(this.i18n.t('imaging.report.addendumDone')),
        );
        return;
      }
    }
  }

  private communication(value: Record<string, unknown>): CommunicationInput {
    const method = String(value['method'] ?? 'PHONE');
    return {
      notifiedName: String(value['notifiedName'] ?? '').trim(), notifiedRole: String(value['notifiedRole'] ?? '').trim(),
      method: (COMMUNICATION_METHODS.find((m) => m === method) ?? 'PHONE'), readBackConfirmed: value['readBack'] === true,
    };
  }

  protected async saveDraft(value: Record<string, unknown>): Promise<void> {
    const o = this.order();
    if (!o) return;
    this.draftNotice.set(null);
    this.busy.set(true);
    try {
      const text = (name: string): string => String(value[name] ?? '').trim();
      this.order.set(await this.gateway.saveDraft(o.id, { technique: text('technique') || null, findings: text('findings') || null, impression: text('impression') || null, critical: value['critical'] === true }));
      this.toast.show(this.i18n.t('imaging.report.draftSaved'));
    } catch (error) {
      this.draftNotice.set(failureMessage(error, this.i18n, this.draftFormRef()));
    } finally {
      this.busy.set(false);
    }
  }

  protected async sign(): Promise<void> {
    const o = this.order();
    if (o) await this.act(() => this.gateway.sign(o.id), () => this.toast.show(this.i18n.t('imaging.report.signedDone')), false);
  }

  /**
   * Exécute une action de l'API : en cas de succès la demande est remplacée par celle que le serveur renvoie (le panneau se ferme) ; en cas
   * d'échec le message apparaît dans le panneau ouvert, ou en haut de page s'il n'y en a pas.
   */
  private async act(call: () => Promise<Order>, done: (updated: Order) => void, inPanel = true): Promise<void> {
    this.busy.set(true);
    try {
      const updated = await call();
      this.order.set(updated);
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
