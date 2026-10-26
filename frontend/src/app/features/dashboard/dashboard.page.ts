import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { hasPermission } from '../../core/auth/permissions';
import { SessionStore } from '../../core/auth/session.store';
import { ESTABLISHMENT } from '../../core/config/establishment.config';
import { Translator } from '../../core/i18n/translator';
import { Clock } from '../../core/time/clock';
import { DateTimeFormatter } from '../../core/time/date-time-formatter';
import { PanelCard } from '../../shared/panel-card';
import { FormBuilderComponent } from '../../shared/form-builder/form-builder';
import { FieldSchema } from '../../shared/form-builder/form-schema';
import { DashboardGateway, DashboardSnapshot } from './dashboard.gateway';

type Perimeter = 'all' | 'department' | 'own';

/** Périmètre le plus large que les permissions de l'utilisateur lui donnent sur les données de soins. */
export function perimeterOf(permissions: readonly string[]): Perimeter {
  const scopes = permissions.map((p) => p.split(':')[2] ?? 'all');
  return scopes.includes('all') ? 'all' : scopes.includes('department') ? 'department' : 'own';
}

const QUICK_ACCESS = [
  { labelKey: 'nav.agenda', route: '/modules/agenda' },
  { labelKey: 'nav.consultations', route: '/modules/consultations' },
  { labelKey: 'dashboard.quick.profile', route: '/profile' },
  { labelKey: 'dashboard.quick.help', route: '/modules/help' },
] as const;

/** « Mon espace de travail » : vue du jour, périmètre du rôle, activité et accès rapides (design SHELL-01). */
@Component({
  selector: 'app-dashboard-page',
  imports: [RouterLink, PanelCard, FormBuilderComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-col gap-6">
      <header class="flex flex-col">
        <h1 class="text-[28px] leading-9 font-semibold text-foreground">{{ i18n.t('dashboard.title') }}</h1>
        <p class="text-xs leading-6 font-semibold text-primary">{{ roleLabel() }}</p>
        <p class="text-sm leading-6 text-muted-foreground">{{ i18n.t('dashboard.subtitle', { date: today() }) }}</p>
      </header>

      @if (data(); as d) {
        @if (d.openPatient; as patient) {
          <p class="w-full max-w-[340px] border border-border bg-card p-2.5 text-xs leading-[18px] text-foreground">
            {{ patient.name }} · {{ patient.record }} · {{ i18n.t('dashboard.recordOpen') }}
          </p>
        }

        <app-form-builder [fields]="scopeNotice()" formId="dashboard-scope" />

        <div class="grid items-start gap-6 lg:grid-cols-2">
          <div class="flex flex-col gap-6">
            <app-panel-card [heading]="i18n.t('dashboard.today')">
              <dl class="flex flex-col gap-3 text-sm leading-6">
                <div class="flex justify-between gap-4"><dt>{{ i18n.t('dashboard.consultations') }}</dt><dd class="font-mono">{{ d.consultationsToday }}</dd></div>
                <div class="flex justify-between gap-4"><dt>{{ i18n.t('dashboard.results') }}</dt><dd class="font-mono">{{ d.resultsToReview }}</dd></div>
                <div class="flex justify-between gap-4"><dt>{{ i18n.t('dashboard.documents') }}</dt><dd class="font-mono">{{ d.documentsToSign }}</dd></div>
              </dl>
            </app-panel-card>

            <app-panel-card [heading]="i18n.t('dashboard.perimeter')">
              <ul class="flex flex-col gap-3 text-sm leading-6">
                <li>{{ i18n.t('dashboard.perimeterOf.' + perimeter()) }}</li>
                @if (rolesLocked()) {
                  <li class="text-muted-foreground">{{ i18n.t('dashboard.locked') }}</li>
                }
              </ul>
            </app-panel-card>
          </div>

          <div class="flex flex-col gap-6">
            <app-panel-card [heading]="i18n.t('dashboard.activity')">
              <ul class="flex flex-col gap-4 text-sm leading-6">
                @for (visit of d.visits; track visit.time) {
                  <li>
                    <p>{{ visit.time }} · {{ visit.patient }}</p>
                    <p class="text-muted-foreground">{{ i18n.t(visit.kindKey) }} · {{ i18n.t(visit.statusKey) }}</p>
                  </li>
                } @empty {
                  <li class="text-muted-foreground">{{ i18n.t('dashboard.noActivity') }}</li>
                }
              </ul>
            </app-panel-card>

            <app-panel-card [heading]="i18n.t('dashboard.quick.title')">
              <ul class="flex flex-col text-sm leading-6">
                @for (link of quickAccess; track link.route) {
                  <li>
                    <a [routerLink]="link.route" class="block rounded-[2px] py-2 text-foreground hover:text-primary focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none">{{ i18n.t(link.labelKey) }}</a>
                  </li>
                }
              </ul>
            </app-panel-card>
          </div>
        </div>
      } @else {
        <p class="text-sm text-muted-foreground" role="status">{{ i18n.t('common.loading') }}</p>
      }
    </div>
  `,
})
export class DashboardPage {
  protected readonly i18n = inject(Translator);
  private readonly user = inject(SessionStore).user;
  private readonly formatter = inject(DateTimeFormatter);
  private readonly now = inject(Clock).now();
  protected readonly establishment = inject(ESTABLISHMENT);

  protected readonly data = signal<DashboardSnapshot | null>(null);
  protected readonly quickAccess = QUICK_ACCESS;

  protected readonly today = computed(() => this.formatter.date(this.now));
  protected readonly perimeter = computed(() => perimeterOf(this.user()?.permissions ?? []));
  protected readonly roleLabel = computed(() => {
    const role = this.user()?.roles[0];
    return role ? this.i18n.t(`roles.${role}`) : '';
  });
  /** Le rôle n'administre pas les rôles : on le dit, plutôt que de laisser croire à un oubli. */
  protected readonly rolesLocked = computed(() => !hasPermission(this.user()?.permissions ?? [], 'iam.roles:manage'));

  protected readonly scopeNotice = computed<FieldSchema[]>(() => [
    { type: 'message', name: 'scope', tone: 'info', appearance: 'outlined', title: `dashboard.perimeterOf.${this.perimeter()}`, text: 'dashboard.scopeText' },
  ]);

  constructor() {
    void inject(DashboardGateway)
      .snapshot()
      .then((snapshot) => this.data.set(snapshot));
  }
}
