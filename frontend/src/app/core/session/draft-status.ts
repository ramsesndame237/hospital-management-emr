import { Injectable, signal } from '@angular/core';
import { Instant } from '../time/temporal';

/**
 * Dernier enregistrement automatique d'un brouillon (note clinique, formulaire…). Les écrans de saisie appellent `markSaved`
 * à chaque sauvegarde ; l'avertissement d'inactivité et l'écran « session expirée » le lisent pour rassurer l'utilisateur
 * (« Brouillon enregistré à 10:42 ») ou, à défaut, ne rien affirmer.
 */
@Injectable({ providedIn: 'root' })
export class DraftStatus {
  private readonly saved = signal<Instant | null>(null);
  readonly savedAt = this.saved.asReadonly();

  markSaved(at: Instant): void {
    this.saved.set(at);
  }

  clear(): void {
    this.saved.set(null);
  }
}
