import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { Translator } from '../core/i18n/translator';

type StatusTone = 'success' | 'warning' | 'critical' | 'neutral';

/** Ton de chaque statut d'établissement : vert = en règle et ouvert, orange = à surveiller, rouge = exercice interrompu. */
const TONES: Readonly<Record<string, StatusTone>> = {
  ADMIN_AUTHORIZED: 'success',
  ADMIN_AUTHORIZATION_EXPIRED: 'warning',
  ADMIN_SUSPENDED: 'critical',
  ADMIN_LICENSE_REVOKED: 'critical',
  OPERATIONAL_OPEN: 'success',
  OPERATIONAL_TEMPORARILY_CLOSED: 'warning',
  OPERATIONAL_PERMANENTLY_CLOSED: 'critical',
  OPERATIONAL_UNDER_CONSTRUCTION: 'neutral',
  QUALITY_CERTIFIED: 'success',
  QUALITY_CERTIFICATION_IN_PROGRESS: 'warning',
  QUALITY_NOT_CERTIFIED: 'neutral',
};

const CLASSES: Readonly<Record<StatusTone, string>> = {
  success: 'border-status-success text-status-success',
  warning: 'border-status-warning text-status-warning',
  critical: 'border-status-critical text-status-critical',
  neutral: 'border-border text-muted-foreground',
};

/**
 * Étiquette de statut : le libellé vient du catalogue partagé avec l'API (`server.status.<CODE>`). La couleur ne porte jamais
 * seule le sens : le texte est toujours affiché. Angles de 2 px, pas de pastille arrondie (charte du design).
 */
@Component({
  selector: 'app-status-tag',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'inline-flex items-center border px-2 py-0.5 text-xs leading-[18px] font-medium whitespace-nowrap rounded-[2px]', '[class]': 'tone()' },
  template: '{{ label() }}',
})
export class StatusTag {
  private readonly i18n = inject(Translator);
  readonly status = input.required<string>();
  protected readonly label = computed(() => this.i18n.t(`server.status.${this.status()}`));
  protected readonly tone = computed(() => CLASSES[TONES[this.status()] ?? 'neutral']);
}
