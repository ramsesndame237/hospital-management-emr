import { DOCUMENT } from '@angular/common';
import { Injectable, inject, signal } from '@angular/core';
import { RouterStateSnapshot, TitleStrategy } from '@angular/router';
import { Translator } from './translator';

/**
 * Titre des pages : la propriété `title` d'une route est une CLÉ de catalogue, traduite ici. L'onglet du navigateur (et le fil
 * d'Ariane de l'espace de travail, via `currentKey`) suit donc la langue choisie. Le titre se met aussi à jour quand la langue change.
 */
@Injectable({ providedIn: 'root' })
export class TranslatedTitleStrategy extends TitleStrategy {
  private readonly document = inject(DOCUMENT);
  private readonly i18n = inject(Translator);
  private readonly key = signal<string | undefined>(undefined);

  /** Clé de titre de la page affichée. */
  readonly currentKey = this.key.asReadonly();

  override updateTitle(snapshot: RouterStateSnapshot): void {
    this.key.set(this.buildTitle(snapshot));
    this.render();
  }

  /** À rappeler après un changement de langue pour retraduire l'onglet. */
  render(): void {
    const key = this.key();
    const app = this.i18n.t('app.name');
    this.document.title = key ? `${this.i18n.t(key)} · ${app}` : app;
  }
}
