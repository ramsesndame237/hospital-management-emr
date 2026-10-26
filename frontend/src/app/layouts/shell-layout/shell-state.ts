import { Injectable, signal } from '@angular/core';

const STORAGE_KEY = 'sanjeevani.nav.collapsed';

/** Navigation réduite ou développée, retenue d'une visite à l'autre (confort : sans stockage, elle s'ouvre développée). */
@Injectable({ providedIn: 'root' })
export class ShellState {
  private readonly state = signal(this.stored());
  readonly collapsed = this.state.asReadonly();

  toggle(): void {
    this.state.update((v) => !v);
    try {
      localStorage.setItem(STORAGE_KEY, String(this.state()));
    } catch {
      // stockage indisponible : le choix vaut pour cette visite seulement
    }
  }

  private stored(): boolean {
    try {
      return localStorage.getItem(STORAGE_KEY) === 'true';
    } catch {
      return false;
    }
  }
}
