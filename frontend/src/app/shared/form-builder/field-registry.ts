import { Injectable, Type } from '@angular/core';
import { ActionFieldComponent } from './fields/action-field';
import { CheckboxFieldComponent } from './fields/checkbox-field';
import { ChecklistFieldComponent } from './fields/checklist-field';
import { CodesFieldComponent } from './fields/codes-field';
import { DisclosureFieldComponent } from './fields/disclosure-field';
import { MessageFieldComponent } from './fields/message-field';
import { OtpFieldComponent } from './fields/otp-field';
import { ParagraphFieldComponent } from './fields/paragraph-field';
import { PasswordFieldComponent } from './fields/password-field';
import { QrFieldComponent } from './fields/qr-field';
import { RadioFieldComponent } from './fields/radio-field';
import { SecretFieldComponent } from './fields/secret-field';
import { SelectFieldComponent } from './fields/select-field';
import { TextFieldComponent } from './fields/text-field';
import { TextareaFieldComponent } from './fields/textarea-field';

/**
 * Qui dessine quel type de champ. Ajouter un type (sélecteur de patient, date, signature…) = écrire un composant qui étend
 * `InputRenderer` ou `DisplayRenderer`, puis `registry.register('patient', PatientFieldComponent)` : tous les formulaires JSON
 * peuvent alors écrire `{ "type": "patient" }`, sans modifier le constructeur (principe ouvert/fermé).
 */
@Injectable({ providedIn: 'root' })
export class FieldRegistry {
  private readonly components = new Map<string, Type<unknown>>([
    ['text', TextFieldComponent],
    ['email', TextFieldComponent],
    ['tel', TextFieldComponent],
    ['number', TextFieldComponent],
    ['code', TextFieldComponent],
    ['otp', OtpFieldComponent],
    ['password', PasswordFieldComponent],
    ['textarea', TextareaFieldComponent],
    ['select', SelectFieldComponent],
    ['radio', RadioFieldComponent],
    ['checkbox', CheckboxFieldComponent],
    ['message', MessageFieldComponent],
    ['paragraph', ParagraphFieldComponent],
    ['codes', CodesFieldComponent],
    ['secret', SecretFieldComponent],
    ['qr', QrFieldComponent],
    ['disclosure', DisclosureFieldComponent],
    ['checklist', ChecklistFieldComponent],
    ['submit', ActionFieldComponent],
    ['button', ActionFieldComponent],
    ['link', ActionFieldComponent],
  ]);

  register(type: string, component: Type<unknown>): void {
    this.components.set(type, component);
  }

  componentFor(type: string): Type<unknown> {
    const component = this.components.get(type);
    if (!component) throw new Error(`Type de champ inconnu « ${type} ». Enregistrez-le avec FieldRegistry.register().`);
    return component;
  }
}
