import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Translator } from '../../../core/i18n/translator';
import { DraftStatus } from '../../../core/session/draft-status';
import { DateTimeFormatter } from '../../../core/time/date-time-formatter';
import { FormBuilderComponent } from '../../../shared/form-builder/form-builder';
import { FieldSchema, FormAction } from '../../../shared/form-builder/form-schema';
import { AuthCard } from '../shared/auth-card';
import { safeReturnUrl } from '../shared/return-url';

/**
 * Session expirée (inactivité ou refus du serveur) : on explique, on rassure sur le travail conservé et on propose de
 * reprendre au même endroit. La page demandée est retenue dans l'adresse (`returnUrl`) ; « autre compte » l'oublie.
 */
@Component({
  selector: 'app-session-expired-page',
  imports: [AuthCard, FormBuilderComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-auth-card [eyebrow]="i18n.t('auth.eyebrow')" [title]="i18n.t('expired.title')" [lead]="i18n.t('expired.lead')" titleId="expired-title">
      <app-form-builder [fields]="fields()" formId="expired" (action)="onAction($event)" />
    </app-auth-card>
  `,
})
export class SessionExpiredPage {
  protected readonly i18n = inject(Translator);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly draft = inject(DraftStatus);
  private readonly formatter = inject(DateTimeFormatter);

  private readonly returnUrl = safeReturnUrl(this.route.snapshot.queryParamMap.get('returnUrl'));

  protected readonly fields = computed<FieldSchema[]>(() => {
    const saved = this.draft.savedAt();
    return [
      { type: 'message', name: 'notice', tone: 'warning', title: 'expired.noticeTitle', text: 'expired.noticeText' },
      { type: 'paragraph', name: 'kept', text: 'expired.kept', size: 'sm' },
      ...(saved ? ([{ type: 'paragraph', name: 'draft', text: 'expired.draftSaved', params: { when: this.formatter.dateTime(saved) }, tone: 'success' }] as const) : []),
      { type: 'button', name: 'relogin', label: 'expired.relogin', variant: 'primary' },
      { type: 'link', name: 'otherAccount', label: 'expired.otherAccount' },
    ];
  });

  protected onAction(event: FormAction): void {
    const queryParams = event.action === 'relogin' && this.returnUrl !== '/' ? { returnUrl: this.returnUrl } : {};
    void this.router.navigate(['/login'], { queryParams });
  }
}
