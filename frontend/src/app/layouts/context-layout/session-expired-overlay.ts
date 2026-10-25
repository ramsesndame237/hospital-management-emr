import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { SessionService } from '../../core/auth/session.service';
import { Translator } from '../../core/i18n/translator';
import { DraftStatus } from '../../core/session/draft-status';
import { DateTimeFormatter } from '../../core/time/date-time-formatter';
import { expiredFields } from '../../features/auth/session-expired/expired.form';
import { FormBuilderComponent } from '../../shared/form-builder/form-builder';
import { FormAction } from '../../shared/form-builder/form-schema';
import { ContextLayout } from './context-layout';
import { SecurityDialog } from './security-dialog';

/**
 * Session terminée PENDANT l'utilisation de l'application (design AUTH-05, variante dialogue) : le contenu est masqué, le
 * dialogue explique et propose de reprendre au même endroit après vérification de l'identité.
 */
@Component({
  selector: 'app-session-expired-overlay',
  imports: [ContextLayout, SecurityDialog, FormBuilderComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'fixed inset-0 z-50 block overflow-auto' },
  template: `
    <app-context-layout>
      <app-security-dialog dialogId="expired" [eyebrow]="i18n.t('expired.dialogEyebrow')" [title]="i18n.t('expired.title')">
        <app-form-builder [fields]="fields()" formId="expired-dialog" (action)="onAction($event)" />
      </app-security-dialog>
    </app-context-layout>
  `,
})
export class SessionExpiredOverlay {
  protected readonly i18n = inject(Translator);
  private readonly session = inject(SessionService);
  private readonly draft = inject(DraftStatus);
  private readonly formatter = inject(DateTimeFormatter);

  protected readonly fields = computed(() => {
    const saved = this.draft.savedAt();
    return expiredFields(saved ? this.formatter.dateTime(saved) : null);
  });

  protected onAction(event: FormAction): void {
    void this.session.leaveExpired(event.action === 'relogin');
  }
}
