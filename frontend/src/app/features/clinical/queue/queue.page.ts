import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { hasPermission } from '../../../core/auth/permissions';
import { SessionStore } from '../../../core/auth/session.store';
import { ClinicalGateway } from '../../../core/clinical/clinical.gateway';
import { EncounterSummary, QueueItem } from '../../../core/clinical/clinical.models';
import { Translator } from '../../../core/i18n/translator';
import { Clock } from '../../../core/time/clock';
import { DateTimeFormatter } from '../../../core/time/date-time-formatter';
import { Temporal } from '../../../core/time/temporal';
import { failureMessage, failureNotice } from '../../../shared/failure-message';
import { FormBuilderComponent } from '../../../shared/form-builder/form-builder';
import { StatusTag } from '../../../shared/status-tag';
import { ageText, encounterTag, patientName } from '../clinical-status';

const LINK = 'rounded-[2px] font-medium text-primary underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-50';
const PRIMARY = 'inline-flex min-h-9 items-center rounded-[2px] bg-primary px-3 text-sm font-semibold text-primary-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-50';

/**
 * Consultations : la file d'attente des patients arrivés dans les services de l'utilisateur et pas encore vus (les plus anciens d'abord, les
 * urgences signalées), et ses consultations récentes. Le médecin commence la consultation d'un patient qui attend, ou reprend celle qu'il a
 * commencée ; l'infirmier ouvre une consultation pour relever les constantes.
 */
@Component({
  selector: 'app-clinical-queue-page',
  imports: [RouterLink, FormBuilderComponent, StatusTag],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-col gap-8">
      <header class="flex flex-wrap items-end justify-between gap-4">
        <div class="flex flex-col">
          <h1 class="text-[28px] leading-9 font-semibold text-foreground">{{ i18n.t('clinical.queue.title') }}</h1>
          <p class="text-sm leading-6 text-muted-foreground">{{ i18n.t('clinical.queue.lead') }}</p>
        </div>
        <button type="button" [class]="link" (click)="refresh()">{{ i18n.t('clinical.queue.refresh') }}</button>
      </header>

      @if (error()) {
        <app-form-builder [fields]="failure()" formId="clinical-queue-error" />
      }

      <section class="flex flex-col gap-3" aria-labelledby="queue-title">
        <h2 id="queue-title" class="text-lg leading-[26px] font-semibold text-foreground">{{ i18n.t('clinical.queue.waiting') }}</h2>
        @if (loading()) {
          <p class="text-sm text-muted-foreground" role="status">{{ i18n.t('common.loading') }}</p>
        } @else {
          <div class="overflow-x-auto border border-border bg-card">
            <table class="w-full text-left text-sm leading-6">
              <caption class="sr-only">{{ i18n.t('clinical.queue.waiting') }}</caption>
              <thead class="border-b border-border bg-muted text-xs leading-[18px] text-muted-foreground">
                <tr>
                  <th scope="col" class="px-4 py-2 font-medium">{{ i18n.t('clinical.queue.patient') }}</th>
                  <th scope="col" class="px-4 py-2 font-medium">{{ i18n.t('clinical.queue.type') }}</th>
                  <th scope="col" class="px-4 py-2 font-medium">{{ i18n.t('clinical.queue.arrival') }}</th>
                  <th scope="col" class="px-4 py-2 font-medium">{{ i18n.t('clinical.queue.state') }}</th>
                  <th scope="col" class="px-4 py-2 font-medium"><span class="sr-only">{{ i18n.t('clinical.actions') }}</span></th>
                </tr>
              </thead>
              <tbody>
                @for (q of queue(); track q.admission.id) {
                  <tr class="border-b border-border align-top last:border-b-0" [attr.data-test]="q.admission.number">
                    <td class="px-4 py-3">
                      @if (q.patient; as p) {
                        <span class="font-medium">{{ name(p) }}</span>
                        <span class="block text-xs text-muted-foreground"><span class="font-mono">{{ p.number }}</span> · {{ i18n.t('clinical.sex.' + p.sex) }} · {{ age(p.birthDate) }}</span>
                      }
                    </td>
                    <td class="px-4 py-3">
                      <app-status-tag [tone]="q.admission.type === 'EMERGENCY' ? 'critical' : 'neutral'" [text]="i18n.t('clinical.queue.types.' + q.admission.type)" />
                    </td>
                    <td class="px-4 py-3 whitespace-nowrap">{{ when(q.admission.admittedAt) }}<span class="block text-xs text-muted-foreground">{{ waited(q.admission.admittedAt) }}</span></td>
                    <td class="px-4 py-3">
                      @if (q.encounter; as e) {
                        <app-status-tag tone="warning" [text]="i18n.t('clinical.queue.inProgress')" />
                        <span class="block text-xs text-muted-foreground">{{ e.number }} · {{ e.doctor?.username ?? '' }}</span>
                      } @else {
                        <span class="text-muted-foreground">{{ i18n.t('clinical.queue.toSee') }}</span>
                      }
                    </td>
                    <td class="px-4 py-3 text-right">
                      @if (q.encounter; as e) {
                        <a [routerLink]="['/clinical/encounters', e.id]" [class]="link" [attr.aria-label]="i18n.t(e.mine ? 'clinical.queue.resumeOf' : 'clinical.queue.openOf', { number: e.number })">{{ i18n.t(e.mine ? 'clinical.queue.resume' : 'clinical.queue.open') }}</a>
                      } @else if (canStart()) {
                        <button type="button" [class]="primary" [disabled]="starting() !== null" [attr.aria-label]="i18n.t('clinical.queue.startOf', { name: q.patient ? name(q.patient) : q.admission.number })" (click)="start(q)">{{ i18n.t('clinical.queue.start') }}</button>
                      }
                    </td>
                  </tr>
                } @empty {
                  <tr>
                    <td colspan="5" class="px-4 py-8 text-center text-muted-foreground">{{ i18n.t('clinical.queue.empty') }}</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }
      </section>

      <section class="flex flex-col gap-3" aria-labelledby="mine-title">
        <h2 id="mine-title" class="text-lg leading-[26px] font-semibold text-foreground">{{ i18n.t('clinical.queue.recent') }}</h2>
        <div class="overflow-x-auto border border-border bg-card">
          <table class="w-full text-left text-sm leading-6">
            <caption class="sr-only">{{ i18n.t('clinical.queue.recent') }}</caption>
            <thead class="border-b border-border bg-muted text-xs leading-[18px] text-muted-foreground">
              <tr>
                <th scope="col" class="px-4 py-2 font-medium">{{ i18n.t('clinical.queue.number') }}</th>
                <th scope="col" class="px-4 py-2 font-medium">{{ i18n.t('clinical.queue.patient') }}</th>
                <th scope="col" class="px-4 py-2 font-medium">{{ i18n.t('clinical.queue.diagnosis') }}</th>
                <th scope="col" class="px-4 py-2 font-medium">{{ i18n.t('clinical.queue.state') }}</th>
                <th scope="col" class="px-4 py-2 font-medium"><span class="sr-only">{{ i18n.t('clinical.actions') }}</span></th>
              </tr>
            </thead>
            <tbody>
              @for (e of recent(); track e.id) {
                <tr class="border-b border-border align-top last:border-b-0" [attr.data-test]="e.number">
                  <td class="px-4 py-3 font-mono text-xs">{{ e.number }}<span class="block font-sans text-muted-foreground">{{ when(e.startedAt) }}</span></td>
                  <td class="px-4 py-3">{{ e.patient ? name(e.patient) : '' }}</td>
                  <td class="px-4 py-3">@if (e.primaryDiagnosis; as d) { <span class="font-mono text-xs">{{ d.code }}</span> {{ d.label }} } @else { <span class="text-muted-foreground">—</span> }</td>
                  <td class="px-4 py-3"><app-status-tag [text]="tag(e).label" [tone]="tag(e).tone" /></td>
                  <td class="px-4 py-3 text-right"><a [routerLink]="['/clinical/encounters', e.id]" [class]="link" [attr.aria-label]="i18n.t('clinical.queue.openOf', { number: e.number })">{{ i18n.t('clinical.queue.open') }}</a></td>
                </tr>
              } @empty {
                <tr>
                  <td colspan="5" class="px-4 py-8 text-center text-muted-foreground">{{ i18n.t('clinical.queue.noRecent') }}</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </section>
    </div>
  `,
})
export class ClinicalQueuePage {
  protected readonly i18n = inject(Translator);
  private readonly gateway = inject(ClinicalGateway);
  private readonly router = inject(Router);
  private readonly dates = inject(DateTimeFormatter);
  private readonly clock = inject(Clock);
  private readonly user = inject(SessionStore).user;

  protected readonly link = LINK;
  protected readonly primary = PRIMARY;
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly queue = signal<readonly QueueItem[]>([]);
  protected readonly recent = signal<readonly EncounterSummary[]>([]);
  /** Admission dont la consultation est en cours d'ouverture (un seul clic à la fois). */
  protected readonly starting = signal<string | null>(null);

  protected readonly canStart = computed(() => hasPermission(this.user()?.permissions ?? [], 'clinical.encounters:write:department'));
  protected readonly failure = computed(() => failureNotice(this.error()));

  constructor() {
    void this.load();
  }

  protected refresh(): void {
    void this.load();
  }

  private async load(): Promise<void> {
    try {
      const [queue, mine] = await Promise.all([this.gateway.getQueue(), this.gateway.listEncounters({ mine: true }, 0, 10)]);
      this.queue.set(queue);
      this.recent.set(mine.items);
      this.error.set(null);
    } catch (error) {
      this.error.set(failureMessage(error, this.i18n));
    } finally {
      this.loading.set(false);
    }
  }

  /** Ouvre la consultation d'un patient qui attend et s'y rend ; si un collègue l'a ouverte entre-temps, la file se rafraîchit et le dit. */
  protected async start(item: QueueItem): Promise<void> {
    this.starting.set(item.admission.id);
    try {
      const opened = await this.gateway.startEncounter(item.admission.id);
      await this.router.navigate(['/clinical/encounters', opened.id]);
    } catch (error) {
      // On rafraîchit d'abord (un rechargement réussi efface l'erreur), puis on affiche le refus.
      await this.load();
      this.error.set(failureMessage(error, this.i18n));
    } finally {
      this.starting.set(null);
    }
  }

  protected name(p: { lastName: string; firstName: string }): string {
    return patientName(p);
  }

  protected age(birthDate: string): string {
    return ageText(this.i18n, birthDate, this.clock.now().toString().slice(0, 10));
  }

  protected tag(e: EncounterSummary) {
    return encounterTag(this.i18n, e.status);
  }

  protected when(iso: string): string {
    return this.dates.dateTime(Temporal.Instant.from(iso));
  }

  /** Temps d'attente depuis l'arrivée : « 1 h 05 », « 20 min ». */
  protected waited(iso: string): string {
    const minutes = Math.max(0, Math.floor((this.clock.nowMs() - Date.parse(iso)) / 60_000));
    return minutes >= 60 ? this.i18n.t('clinical.queue.waitedHours', { hours: Math.floor(minutes / 60), minutes: String(minutes % 60).padStart(2, '0') }) : this.i18n.t('clinical.queue.waitedMinutes', { minutes });
  }
}
