import { FieldSchema } from '../../../shared/form-builder/form-schema';

/**
 * Contenu commun de l'écran et du dialogue « session expirée » : explication, page conservée, brouillon éventuel, puis les deux
 * issues (reprendre au même endroit, ou changer de compte). `savedAt` est la date déjà formatée du dernier brouillon, s'il y en a un.
 */
export function expiredFields(savedAt: string | null): FieldSchema[] {
  return [
    { type: 'message', name: 'notice', tone: 'warning', title: 'expired.noticeTitle', text: 'expired.noticeText' },
    { type: 'paragraph', name: 'kept', text: 'expired.kept', size: 'sm' },
    ...(savedAt ? ([{ type: 'paragraph', name: 'draft', text: 'expired.draftSaved', params: { when: savedAt }, tone: 'success' }] as const) : []),
    { type: 'button', name: 'relogin', label: 'expired.relogin', variant: 'primary' },
    { type: 'link', name: 'otherAccount', label: 'expired.otherAccount' },
  ];
}
