import { PermissionGroup } from '../../core/iam/identity-admin.models';
import { Translator } from '../../core/i18n/translator';

/** « read (service), write (service) » : les actions d'une ressource avec leur portée, dans la langue de l'interface. */
export function grantsText(i18n: Translator, group: PermissionGroup): string {
  return group.grants.map((grant) => `${grant.action} (${i18n.t(`admin.scope.${grant.scope}`)})`).join(', ');
}
