import { ChangeDetectionStrategy, Component, output } from '@angular/core';
import { FormBuilderComponent } from '../../../shared/form-builder/form-builder';
import { FieldSchema } from '../../../shared/form-builder/form-schema';

/** Fin du parcours (design AUTH-10, « Votre compte est prêt ») : récapitulatif des trois protections et accès à l'espace de travail. */
@Component({
  selector: 'app-ready-step',
  imports: [FormBuilderComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<app-form-builder [fields]="fields" formId="ready" (action)="open.emit()" />`,
})
export class ReadyStep {
  readonly open = output<void>();

  protected readonly fields: FieldSchema[] = [
    { type: 'message', name: 'done', tone: 'success', title: 'ready.noticeTitle', text: 'ready.noticeText' },
    { type: 'checklist', name: 'recap', items: ['ready.password', 'ready.authenticator', 'ready.codes'], params: { count: 10 } },
    { type: 'button', name: 'open', label: 'ready.open', variant: 'primary' },
    { type: 'paragraph', name: 'note', text: 'ready.note', tone: 'muted' },
  ];
}
