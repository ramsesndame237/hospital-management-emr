import { Injectable } from '@angular/core';
import { ApiError } from '../http/api-error';

/**
 * Port de la demande de réinitialisation du mot de passe (« Mot de passe oublié ? »). L'écran ne dépend que de ce contrat.
 * Le serveur doit répondre de la même façon que le compte existe ou non (aucune fuite d'information sur les comptes).
 */
export abstract class PasswordResetGateway {
  /** Demande l'envoi d'un lien de réinitialisation. Rejette avec une `ApiError` ; `NOT_AVAILABLE` si le service n'existe pas encore. */
  abstract request(identifier: string): Promise<void>;
}

/**
 * Adaptateur PROVISOIRE : l'API n'expose pas encore de réinitialisation par e-mail (il faut d'abord un service d'envoi de
 * messages). Plutôt que de simuler un envoi qui n'aura pas lieu, il refuse clairement ; l'écran renvoie alors vers l'administrateur.
 * À remplacer par un adaptateur HTTP dès que l'endpoint existera, sans toucher à l'écran.
 */
@Injectable()
export class UnavailablePasswordResetGateway extends PasswordResetGateway {
  override request(): Promise<void> {
    return Promise.reject(new ApiError(501, 'NOT_AVAILABLE', 'Password reset is not available yet.'));
  }
}
