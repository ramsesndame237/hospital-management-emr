import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { TONE_TEXT } from '../form-builder/field-styles';
import { ToastService } from './toast.service';

/** Pile de notifications en bas à droite (design : 360 px, filet 1 px, texte du ton en demi-gras). Annoncée poliment aux lecteurs d'écran. */
@Component({
  selector: 'app-toast-host',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'pointer-events-none fixed right-4 bottom-6 z-[60] flex w-[calc(100vw-2rem)] max-w-[360px] flex-col gap-2 sm:right-8', role: 'status', 'aria-live': 'polite' },
  template: `
    @for (toast of toasts.toasts(); track toast.id) {
      <p class="pointer-events-auto border border-border bg-card p-4 text-sm font-semibold" [class]="tone[toast.tone]">{{ toast.message }}</p>
    }
  `,
})
export class ToastHost {
  protected readonly toasts = inject(ToastService);
  protected readonly tone = TONE_TEXT;
}
