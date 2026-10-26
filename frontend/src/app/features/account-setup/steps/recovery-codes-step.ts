import { Clipboard } from '@angular/cdk/clipboard';
import { DOCUMENT } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { SessionService } from '../../../core/auth/session.service';
import { Translator } from '../../../core/i18n/translator';
import { FormBuilderComponent } from '../../../shared/form-builder/form-builder';
import { FieldSchema, FormAction } from '../../../shared/form-builder/form-schema';
import { StepProgress } from '../../../shared/step-progress';
import { ToastService } from '../../../shared/toast/toast.service';

/**
 * Étape 3 sur 3 : conserver les codes de récupération (usage unique, affichés cette seule fois). Copier, télécharger ou imprimer ;
 * la sécurisation ne se termine qu'après la case « J'ai conservé ces codes en lieu sûr ». Terminer renouvelle la session : le
 * serveur la passe alors de « finalisation » à « complète ».
 */
@Component({
  selector: 'app-recovery-codes-step',
  imports: [FormBuilderComponent, StepProgress],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex flex-col gap-5' },
  template: `
    <app-step-progress [current]="3" [total]="3" nameKey="setup.steps.recovery" />
    <app-form-builder [fields]="fields()" [busy]="submitting()" formId="recovery-codes" (submitted)="onSubmit()" (action)="onAction($event)" (valueChange)="saved.set(!!$event['saved'])" />
  `,
})
export class RecoveryCodesStep {
  private readonly i18n = inject(Translator);
  private readonly session = inject(SessionService);
  private readonly clipboard = inject(Clipboard);
  private readonly toast = inject(ToastService);
  private readonly document = inject(DOCUMENT);

  readonly codes = input.required<readonly string[]>();
  /** La session est complète : le compte est sécurisé. */
  readonly done = output<void>();

  protected readonly submitting = signal(false);
  protected readonly saved = signal(false);
  private readonly failure = signal<string | null>(null);

  protected readonly fields = computed<FieldSchema[]>(() => {
    const failure = this.failure();
    return [
      { type: 'message', name: 'once', tone: 'warning', title: 'recoveryCodes.noticeTitle', text: 'recoveryCodes.noticeText', params: { count: this.codes().length } },
      { type: 'codes', name: 'codes', values: this.codes() },
      { type: 'button', name: 'copy', label: 'common.copy', variant: 'outline', span: 4 },
      { type: 'button', name: 'download', label: 'recoveryCodes.download', variant: 'outline', span: 4 },
      { type: 'button', name: 'print', label: 'recoveryCodes.print', variant: 'outline', span: 4 },
      { type: 'checkbox', name: 'saved', label: 'recoveryCodes.saved' },
      ...(failure ? ([{ type: 'message', name: 'failure', tone: 'critical', title: failure }] as const) : []),
      { type: 'submit', name: 'submit', label: 'recoveryCodes.finish', busyLabel: 'setup.saving', disabledIf: { field: 'saved', equals: false } },
      { type: 'paragraph', name: 'helper', text: this.saved() ? 'recoveryCodes.helperSaved' : 'recoveryCodes.helper', tone: 'muted' },
    ];
  });

  protected onAction(event: FormAction): void {
    switch (event.action) {
      case 'copy':
        if (this.clipboard.copy(this.codes().join('\n'))) this.toast.show(this.i18n.t('recoveryCodes.copied'));
        break;
      case 'download':
        this.download();
        break;
      case 'print':
        this.document.defaultView?.print();
        break;
    }
  }

  protected async onSubmit(): Promise<void> {
    this.failure.set(null);
    this.submitting.set(true);
    try {
      if (await this.session.finishSetup()) this.done.emit();
      else this.failure.set(this.i18n.t('login.errors.generic'));
    } finally {
      this.submitting.set(false);
    }
  }

  /** Fichier texte local : les codes ne transitent par aucun serveur. */
  private download(): void {
    const lines = [this.i18n.t('app.name'), this.i18n.t('recoveryCodes.fileTitle'), '', ...this.codes()];
    const url = URL.createObjectURL(new Blob([lines.join('\n') + '\n'], { type: 'text/plain;charset=utf-8' }));
    const link = this.document.createElement('a');
    link.href = url;
    link.download = 'sanjeevani-recovery-codes.txt';
    link.click();
    URL.revokeObjectURL(url);
  }
}
