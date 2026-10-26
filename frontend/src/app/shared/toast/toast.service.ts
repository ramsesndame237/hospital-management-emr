import { Injectable, signal } from '@angular/core';

export type ToastTone = 'success' | 'info' | 'warning' | 'critical';

export interface Toast {
  readonly id: number;
  readonly message: string;
  readonly tone: ToastTone;
}

const DEFAULT_DURATION_MS = 5_000;

/**
 * Notification brève et non bloquante (« ✓ Copié »). Elle disparaît toute seule et n'est jamais le seul porteur d'une
 * information importante : un échec ou un choix à faire s'affiche dans la page, pas ici.
 */
@Injectable({ providedIn: 'root' })
export class ToastService {
  private nextId = 1;
  private readonly state = signal<readonly Toast[]>([]);
  readonly toasts = this.state.asReadonly();

  show(message: string, tone: ToastTone = 'success', durationMs = DEFAULT_DURATION_MS): void {
    const toast: Toast = { id: this.nextId++, message, tone };
    this.state.update((list) => [...list, toast]);
    setTimeout(() => this.dismiss(toast.id), durationMs);
  }

  dismiss(id: number): void {
    this.state.update((list) => list.filter((t) => t.id !== id));
  }
}
