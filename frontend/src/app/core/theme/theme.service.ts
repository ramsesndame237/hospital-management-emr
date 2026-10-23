import { DOCUMENT } from '@angular/common';
import { Injectable, computed, inject, signal } from '@angular/core';

export type ThemePreference = 'system' | 'light' | 'dark';
const STORAGE_KEY = 'sanjeevani.theme';

/**
 * Thème clair/sombre. Par défaut il suit le système ; un choix explicite est retenu. Le thème sombre est la classe `dark`
 * sur `<html>` (convention des composants Spartan). Le stockage n'est qu'un confort : s'il est indisponible, ça marche.
 */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly document = inject(DOCUMENT);
  private readonly media = typeof matchMedia === 'function' ? matchMedia('(prefers-color-scheme: dark)') : null;
  private readonly systemDark = signal(this.media?.matches ?? false);

  readonly preference = signal<ThemePreference>(this.stored());
  readonly isDark = computed(() => (this.preference() === 'system' ? this.systemDark() : this.preference() === 'dark'));

  constructor() {
    this.media?.addEventListener('change', (e) => {
      this.systemDark.set(e.matches);
      this.apply();
    });
    this.apply();
  }

  set(preference: ThemePreference): void {
    this.preference.set(preference);
    try {
      localStorage.setItem(STORAGE_KEY, preference);
    } catch {
      // stockage indisponible : le choix vaut pour cette session seulement
    }
    this.apply();
  }

  /** Bascule clair ↔ sombre à partir de l'apparence actuellement affichée. */
  toggle(): void {
    this.set(this.isDark() ? 'light' : 'dark');
  }

  private apply(): void {
    this.document.documentElement.classList.toggle('dark', this.isDark());
  }

  private stored(): ThemePreference {
    try {
      const value = localStorage.getItem(STORAGE_KEY);
      return value === 'light' || value === 'dark' || value === 'system' ? value : 'system';
    } catch {
      return 'system';
    }
  }
}
