import { Directive, Signal, input } from '@angular/core';
import { AbstractControl, FormControl } from '@angular/forms';
import { FieldSchema, InputFieldSchema } from './form-schema';

/**
 * Ce que le formulaire met à disposition de chacun de ses champs (injecté, pas passé en entrée : un champ personnalisé
 * enregistré dans le catalogue obtient le même contexte sans écrire de plomberie).
 */
export abstract class FieldContext {
  /** Le formulaire est en cours d'envoi : boutons inactifs. */
  abstract readonly busy: Signal<boolean>;
  /** Un envoi a déjà été tenté : les erreurs de tous les champs deviennent visibles. */
  abstract readonly attempted: Signal<boolean>;
  /** Compteur de changements (valeur, validité, « touché »). À lire dans un gabarit pour qu'il suive l'état du contrôle. */
  abstract readonly version: Signal<number>;
  abstract readonly values: Signal<Readonly<Record<string, unknown>>>;
  /** Identifiant DOM stable et unique d'un champ (étiquette ↔ saisie, `aria-describedby`). */
  abstract inputId(name: string): string;
  /** Faut-il montrer l'erreur de ce contrôle maintenant ? (champ quitté, ou envoi déjà tenté) */
  abstract showError(control: AbstractControl): boolean;
  /** Message d'erreur dans la langue courante, ou `null` si le champ est valide. */
  abstract errorMessage(field: InputFieldSchema, control: AbstractControl): string | null;
  /** Déclenche l'événement `action` du formulaire. */
  abstract dispatch(action: string): void;
}

/** Base d'un champ qui porte une valeur : reçoit sa description JSON et son contrôle Angular. */
@Directive()
export abstract class InputRenderer<T extends InputFieldSchema = InputFieldSchema> {
  readonly field = input.required<T>();
  readonly control = input.required<FormControl>();
}

/** Base d'un élément sans valeur (message, paragraphe, bouton). */
@Directive()
export abstract class DisplayRenderer<T extends FieldSchema = FieldSchema> {
  readonly field = input.required<T>();
}
