import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmCardImports } from '@spartan-ng/helm/card';
import { SessionService } from '../../core/auth/session.service';
import { Translator } from '../../core/i18n/translator';
import { BrandMark } from '../../shared/brand-mark';
import { Preferences } from '../../shared/preferences';

/**
 * Session restreinte (`scope: setup`) : compte neuf ou profil exigeant la double authentification. L'assistant de
 * finalisation (changement de mot de passe, inscription MFA avec QR code, codes de secours) est l'étape suivante ;
 * en attendant cette page explique la situation au lieu de laisser l'utilisateur face à des erreurs 403.
 */
@Component({
  selector: 'app-account-setup-page',
  imports: [HlmButtonImports, HlmCardImports, BrandMark, Preferences],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex min-h-dvh flex-col bg-muted/30 px-4 py-6">
      <div class="mx-auto flex w-full max-w-lg items-center justify-between text-primary">
        <div class="flex items-center gap-3"><app-brand-mark /><span class="font-bold text-foreground">{{ i18n.t('app.name') }}</span></div>
        <app-preferences />
      </div>
      <div class="grid flex-1 place-items-center">
        <section hlmCard class="w-full max-w-lg rounded-none border border-border shadow-none ring-0" aria-labelledby="setup-title">
          <div hlmCardHeader>
            <h1 hlmCardTitle id="setup-title" class="text-2xl">{{ i18n.t('setup.title') }}</h1>
            <p hlmCardDescription>{{ i18n.t('setup.lead') }}</p>
          </div>
          <div hlmCardContent class="grid gap-3 text-sm">
            <ol class="grid gap-2">
              <li class="flex gap-3 border border-border p-3"><span class="grid size-6 shrink-0 place-items-center bg-primary text-xs font-bold text-primary-foreground">1</span>{{ i18n.t('setup.passwordStep') }}</li>
              <li class="flex gap-3 border border-border p-3"><span class="grid size-6 shrink-0 place-items-center bg-primary text-xs font-bold text-primary-foreground">2</span>{{ i18n.t('setup.mfaStep') }}</li>
            </ol>
            <p class="text-muted-foreground">{{ i18n.t('setup.soon') }}</p>
          </div>
          <div hlmCardFooter>
            <button hlmBtn variant="outline" type="button" (click)="signOut()">{{ i18n.t('common.signOut') }}</button>
          </div>
        </section>
      </div>
    </div>
  `,
})
export class AccountSetupPage {
  protected readonly i18n = inject(Translator);
  private readonly session = inject(SessionService);

  protected signOut(): void {
    void this.session.logout();
  }
}
