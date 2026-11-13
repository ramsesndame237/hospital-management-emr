import { ChangeDetectionStrategy, Component, OnInit, inject, input, signal } from '@angular/core';
import { Translator } from '../../../core/i18n/translator';
import { PortalGateway } from '../../../core/portal/portal.gateway';
import { PortalAccount } from '../../../core/portal/portal.models';
import { DateTimeFormatter } from '../../../core/time/date-time-formatter';
import { Temporal } from '../../../core/time/temporal';
import { failureMessage } from '../../../shared/failure-message';
import { ToastService } from '../../../shared/toast/toast.service';

const PRIMARY = 'inline-flex min-h-11 items-center rounded-[2px] bg-primary px-4 text-sm font-semibold text-primary-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-50';
const CELL = 'h-9 w-full border border-input bg-background px-2 text-sm rounded-[2px] focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none';

/**
 * Compte du portail d'un patient : l'accueil relie un compte de connexion (rôle Patient) au dossier, une fois pour toutes (un lien ne se modifie pas) ;
 * le patient voit alors ses rendez-vous, résultats publiés, ordonnances et factures. Le compte lui-même est créé par l'administration.
 */
@Component({
  selector: 'app-portal-account-section',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="flex flex-col gap-3" aria-labelledby="portal-title">
      <h2 id="portal-title" class="text-lg leading-[26px] font-semibold text-foreground">{{ i18n.t('reception.portal.title') }}</h2>
      @if (loading()) {
        <p class="text-sm text-muted-foreground" role="status">{{ i18n.t('common.loading') }}</p>
      } @else if (account(); as a) {
        <p class="border border-border bg-card p-4 text-sm" data-test="linked">{{ i18n.t('reception.portal.linked', { username: a.username ?? '', when: when(a.linkedAt) }) }}</p>
      } @else {
        <div class="flex flex-col gap-3 border border-border bg-card p-4">
          <p class="text-sm text-muted-foreground">{{ i18n.t('reception.portal.none') }}</p>
          <label class="flex flex-col gap-1 text-sm">{{ i18n.t('reception.portal.username') }}
            <input id="portal-username" [class]="cell" type="text" autocomplete="off" [value]="username()" (input)="username.set($any($event.target).value)" />
          </label>
          @if (error()) { <p class="border-l-4 border-status-critical bg-card p-3 text-sm text-status-critical" role="alert" data-test="error">{{ error() }}</p> }
          <div><button type="button" [class]="primary" [disabled]="busy() || username().trim() === ''" (click)="link()">{{ i18n.t('reception.portal.link') }}</button></div>
        </div>
      }
    </section>
  `,
})
export class PortalAccountSection implements OnInit {
  readonly patientId = input.required<string>();

  protected readonly i18n = inject(Translator);
  private readonly gateway = inject(PortalGateway);
  private readonly dates = inject(DateTimeFormatter);
  private readonly toast = inject(ToastService);

  protected readonly primary = PRIMARY;
  protected readonly cell = CELL;
  protected readonly loading = signal(true);
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly account = signal<PortalAccount | null>(null);
  protected readonly username = signal('');

  async ngOnInit(): Promise<void> {
    try {
      this.account.set(await this.gateway.getAccountOf(this.patientId()));
    } catch (error) {
      this.error.set(failureMessage(error, this.i18n));
    } finally {
      this.loading.set(false);
    }
  }

  protected async link(): Promise<void> {
    this.busy.set(true);
    this.error.set(null);
    try {
      this.account.set(await this.gateway.linkAccount(this.username().trim(), this.patientId()));
      this.toast.show(this.i18n.t('reception.portal.done'));
    } catch (error) {
      this.error.set(failureMessage(error, this.i18n));
    } finally {
      this.busy.set(false);
    }
  }

  protected when(iso: string): string {
    return this.dates.dateTime(Temporal.Instant.from(iso));
  }
}
