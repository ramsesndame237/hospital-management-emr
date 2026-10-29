import { ApiError, toApiError } from '../../core/http/api-error';
import { Translator } from '../../core/i18n/translator';
import { FormBuilderComponent } from '../../shared/form-builder/form-builder';

/**
 * Texte à afficher en bandeau pour un échec d'API. Les erreurs de champ sont posées sur les champs du formulaire (s'il y en a un) ;
 * le bandeau ne garde que ce qu'aucun champ ne porte. Un incident réseau ou serveur n'expose jamais de détail technique.
 */
export function failureMessage(error: unknown, i18n: Translator, form?: FormBuilderComponent): string | null {
  const api: ApiError = toApiError(error);
  if (api.isNetwork) return i18n.t('admin.errors.network');
  if (api.isServerError || api.code === 'UNKNOWN') return i18n.t('admin.errors.unavailable');
  if (api.fieldErrors.length > 0 && form) {
    const left = form.applyServerErrors(api.fieldErrors);
    return left.length > 0 ? left[0].message : null;
  }
  return api.message;
}
