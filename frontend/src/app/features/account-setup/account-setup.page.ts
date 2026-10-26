import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { SessionStore } from '../../core/auth/session.store';
import { Translator } from '../../core/i18n/translator';
import { AuthCard } from '../auth/shared/auth-card';
import { AuthenticatorStep } from './steps/authenticator-step';
import { PasswordStep } from './steps/password-step';
import { ReadyStep } from './steps/ready-step';
import { RecoveryCodesStep } from './steps/recovery-codes-step';

type Step = 'password' | 'authenticator' | 'recovery' | 'ready';

const HEADINGS: Readonly<Record<Step, { title: string; lead: string }>> = {
  password: { title: 'setup.title', lead: 'setup.lead' },
  authenticator: { title: 'authenticator.title', lead: 'authenticator.lead' },
  recovery: { title: 'recoveryCodes.title', lead: 'recoveryCodes.lead' },
  ready: { title: 'ready.title', lead: 'ready.lead' },
};

/**
 * Première connexion (session restreinte `setup`), en trois étapes puis l'écran « compte prêt » :
 * 1. mot de passe personnel · 2. application d'authentification (QR code) · 3. codes de récupération.
 * Reprise possible : si le mot de passe a déjà été remplacé (rechargement de la page), on repart de l'étape 2.
 */
@Component({
  selector: 'app-account-setup-page',
  imports: [AuthCard, PasswordStep, AuthenticatorStep, RecoveryCodesStep, ReadyStep],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-auth-card [eyebrow]="i18n.t('auth.eyebrow')" [title]="i18n.t(heading().title)" [lead]="i18n.t(heading().lead, { name: username() })" titleId="setup-title">
      @switch (step()) {
        @case ('password') {
          <app-password-step (done)="step.set('authenticator')" />
        }
        @case ('authenticator') {
          <app-authenticator-step (done)="onCodes($event)" />
        }
        @case ('recovery') {
          <app-recovery-codes-step [codes]="codes()" (done)="onFinished()" />
        }
        @default {
          <app-ready-step (open)="open()" />
        }
      }
    </app-auth-card>
  `,
})
export class AccountSetupPage {
  protected readonly i18n = inject(Translator);
  private readonly router = inject(Router);
  private readonly user = inject(SessionStore).user;

  protected readonly step = signal<Step>(this.user()?.mustChangePassword === false ? 'authenticator' : 'password');
  protected readonly codes = signal<readonly string[]>([]);
  protected readonly heading = computed(() => HEADINGS[this.step()]);
  protected readonly username = computed(() => this.user()?.username ?? '');

  protected onCodes(codes: readonly string[]): void {
    this.codes.set(codes);
    this.step.set('recovery');
  }

  /** Les codes ne sont plus nécessaires à l'écran : on ne les garde pas en mémoire plus longtemps. */
  protected onFinished(): void {
    this.codes.set([]);
    this.step.set('ready');
  }

  protected open(): void {
    void this.router.navigateByUrl('/');
  }
}
