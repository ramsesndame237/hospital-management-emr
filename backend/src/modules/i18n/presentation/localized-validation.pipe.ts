import { BadRequestException, ValidationPipe } from '@nestjs/common';
import type { ValidationError } from 'class-validator';
import { Localizer } from '../application/localizer';

export interface FieldError {
  readonly field: string;
  /** Nom de la règle violée (`minLength`, `isEmail`…), stable : sert aux clients pour réagir par programme. */
  readonly rule: string;
  readonly message: string;
}

/** Une clé de catalogue peut être donnée directement comme message d'un décorateur : `@Matches(re, { message: 'validation.sixDigits' })`. */
const KEY_PREFIX = 'validation.';

function flatten(errors: readonly ValidationError[], parent = ''): { field: string; rule: string; custom?: string }[] {
  return errors.flatMap((e) => {
    const field = parent ? `${parent}.${e.property}` : e.property;
    const own = Object.entries(e.constraints ?? {}).map(([rule, message]) => ({ field, rule, custom: message.startsWith(KEY_PREFIX) ? message.slice(KEY_PREFIX.length) : undefined }));
    return [...own, ...flatten(e.children ?? [], field)];
  });
}

/**
 * Validation des entrées avec des erreurs dans la langue de la requête et un format stable :
 * `{ statusCode: 400, code: 'VALIDATION_FAILED', message, errors: [{ field, rule, message }] }`.
 * Conserve le comportement de la validation d'origine (`whitelist` : champs inconnus retirés, `transform`).
 */
export function createLocalizedValidationPipe(localizer: Localizer): ValidationPipe {
  return new ValidationPipe({
    whitelist: true,
    transform: true,
    exceptionFactory: (errors: ValidationError[]) => {
      const list: FieldError[] = flatten(errors).map(({ field, rule, custom }) => {
        const leaf = field.split('.').pop() as string;
        const params = { field: localizer.field(leaf) };
        const key = `validation.${custom ?? rule}`;
        const specific = localizer.text(key, params, '');
        return { field, rule: custom ?? rule, message: specific || localizer.text('validation.generic', params) };
      });
      return new BadRequestException({
        statusCode: 400,
        code: 'VALIDATION_FAILED',
        message: localizer.error('VALIDATION_FAILED'),
        errors: list,
      });
    },
  });
}
