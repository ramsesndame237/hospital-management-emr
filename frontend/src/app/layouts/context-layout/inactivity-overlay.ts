import { A11yModule } from '@angular/cdk/a11y';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { Translator } from '../../core/i18n/translator';
import { DraftStatus } from '../../core/session/draft-status';
import { IdleService } from '../../core/session/idle.service';
import { DateTimeFormatter } from '../../core/time/date-time-formatter';
import { FormBuilderComponent } from '../../shared/form-builder/form-builder';
import { FieldSchema, FormAction } from '../../shared/form-builder/form-schema';
import { ContextLayout } from './context-layout';

/**
 * Avertissement d'inactivité : « Êtes-vous toujours là ? ». Recouvre toute l'application (voir `ContextLayout`), compte à rebours
 * visible, et ne se ferme que par un choix explicite. Les boutons et le message de brouillon sont décrits en JSON, comme les formulaires.
 */
@Component({
  selector: 'app-inactivity-overlay',
  imports: [A11yModule, ContextLayout, FormBuilderComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'fixed inset-0 z-50 block overflow-auto' },
  template: `
    <app-context-layout>
      <div class="fixed inset-0 z-10 flex items-center justify-center p-4">
        <section
          cdkTrapFocus
          [cdkTrapFocusAutoCapture]="true"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="idle-title"
          aria-describedby="idle-description"
          class="flex max-h-full w-[576px] max-w-full flex-col gap-5 overflow-auto border border-border bg-popover p-8 text-popover-foreground"
        >
          <p class="text-xs leading-[18px] text-muted-foreground">{{ i18n.t('inactivity.eyebrow') }}</p>
          <h2 id="idle-title" class="text-[28px] leading-9 font-semibold">{{ i18n.t('inactivity.title') }}</h2>
          <p id="idle-description" class="text-sm leading-[22px] text-muted-foreground">{{ i18n.t('inactivity.lead') }}</p>

          <div class="flex flex-col gap-3">
            <div class="flex items-start justify-between gap-4">
              <p class="text-sm">{{ i18n.t('inactivity.countdownLabel') }}</p>
              <p class="font-mono text-[22px] leading-[30px] text-status-warning" role="timer" aria-live="off">{{ countdown() }}</p>
            </div>
            <div class="h-1 w-full bg-border" aria-hidden="true">
              <div class="h-1 bg-status-warning transition-[width] duration-1000 ease-linear" [style.width.%]="idle.remainingRatio() * 100"></div>
            </div>
          </div>

          <app-form-builder [fields]="fields()" formId="idle" (action)="onAction($event)" />
        </section>
      </div>
    </app-context-layout>
  `,
})
export class InactivityOverlay {
  protected readonly i18n = inject(Translator);
  protected readonly idle = inject(IdleService);
  private readonly draft = inject(DraftStatus);
  private readonly formatter = inject(DateTimeFormatter);

  protected readonly countdown = computed(() => this.formatter.countdown(this.idle.remainingMs() / 1000));

  protected readonly fields = computed<FieldSchema[]>(() => {
    const saved = this.draft.savedAt();
    return [
      ...(saved
        ? ([{ type: 'message', name: 'draft', tone: 'success', title: 'inactivity.draftTitle', text: 'inactivity.draftText', params: { time: this.formatter.time(saved) } }] as const)
        : []),
      { type: 'button', name: 'stay', label: 'inactivity.stay', variant: 'primary' },
      { type: 'button', name: 'signOut', label: 'common.signOut', variant: 'outline' },
    ];
  });

  protected onAction(event: FormAction): void {
    if (event.action === 'stay') void this.idle.stayConnected();
    else void this.idle.signOut();
  }
}
