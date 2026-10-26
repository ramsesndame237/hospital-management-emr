import { FACILITY_STATUSES, Facility, FacilityStatus, NodeKind, ReferenceOption, SERVICE_TYPES, StructureNode } from '../../core/administration/administration.models';
import { FieldSchema, OptionSpec } from '../../shared/form-builder/form-schema';

/** Format du code d'un établissement (même règle que l'API) : 4 chiffres/majuscules, 3 chiffres/minuscules, 2 chiffres. */
const FACILITY_CODE = '^\\s*[0-9A-Z]{4}-[0-9a-z]{3}-[0-9]{2}\\s*$';

/** Statuts après lesquels l'établissement n'accueille plus normalement : le changement demande une confirmation explicite. */
export const DISRUPTIVE_STATUSES: readonly FacilityStatus[] = [
  'ADMIN_SUSPENDED', 'ADMIN_LICENSE_REVOKED', 'OPERATIONAL_TEMPORARILY_CLOSED', 'OPERATIONAL_PERMANENTLY_CLOSED',
];

const statusOptions = (): OptionSpec[] => FACILITY_STATUSES.map((status) => ({ value: status, label: `server.status.${status}` }));

export { failureNotice } from '../../shared/failure-message';
import { failureNotice } from '../../shared/failure-message';

/** Nom de l'organisation. Sans organisation, l'écran sert à la créer : le libellé du bouton le dit. */
export function organizationFields(o: { readonly name: string; readonly exists: boolean; readonly notice: string | null }): FieldSchema[] {
  return [
    ...failureNotice(o.notice),
    {
      type: 'text', name: 'name', label: 'admin.organization.name', hint: 'admin.organization.nameHint', value: o.name, autofocus: !o.exists, normalize: 'trim',
      validators: [{ type: 'required', message: 'admin.organization.nameRequired' }, { type: 'maxLength', value: 200 }],
    },
    { type: 'submit', name: 'submit', label: o.exists ? 'admin.organization.save' : 'admin.organization.create', busyLabel: 'admin.saving' },
  ];
}

/** Création (code, nom, statut initial) ou modification (nom, code) d'un site. */
export function facilityFields(o: { readonly facility: Facility | null; readonly notice: string | null }): FieldSchema[] {
  const creating = o.facility === null;
  return [
    ...failureNotice(o.notice),
    {
      type: 'text', name: 'name', label: 'admin.sites.name', value: o.facility?.name ?? '', autofocus: true, normalize: 'trim',
      validators: [{ type: 'required', message: 'admin.sites.nameRequired' }, { type: 'maxLength', value: 200 }],
    },
    {
      type: 'text', name: 'code', label: 'admin.sites.code', hint: 'admin.sites.codeHint', placeholder: 'admin.sites.codePlaceholder', value: o.facility?.code ?? '', normalize: 'trim', inputClass: 'font-mono',
      validators: [{ type: 'required', message: 'admin.sites.codeRequired' }, { type: 'pattern', value: FACILITY_CODE, message: 'admin.sites.codeFormat' }],
    },
    ...(creating
      ? ([{ type: 'select', name: 'status', label: 'admin.sites.initialStatus', hint: 'admin.sites.initialStatusHint', value: 'OPERATIONAL_UNDER_CONSTRUCTION', options: statusOptions() }] as const)
      : []),
    { type: 'submit', name: 'submit', label: creating ? 'admin.sites.create' : 'admin.save', busyLabel: 'admin.saving' },
    { type: 'button', name: 'cancel', label: 'admin.cancel', variant: 'outline' },
  ];
}

/** Changement de statut ; les statuts qui interrompent l'accueil exigent une case de confirmation. */
export function facilityStatusFields(o: { readonly facility: Facility; readonly notice: string | null }): FieldSchema[] {
  return [
    ...failureNotice(o.notice),
    { type: 'select', name: 'status', label: 'admin.sites.newStatus', value: o.facility.status, autofocus: true, options: statusOptions(), validators: [{ type: 'required' }] },
    { type: 'message', name: 'disruptive', tone: 'warning', appearance: 'outlined', title: 'admin.sites.disruptiveTitle', text: 'admin.sites.disruptiveText', showIf: { field: 'status', in: DISRUPTIVE_STATUSES } },
    { type: 'checkbox', name: 'confirm', label: 'admin.sites.confirmStatus', showIf: { field: 'status', in: DISRUPTIVE_STATUSES }, validators: [{ type: 'required', message: 'admin.sites.confirmRequired' }] },
    { type: 'paragraph', name: 'audit', text: 'admin.auditNote', tone: 'muted' },
    { type: 'submit', name: 'submit', label: 'admin.sites.changeStatus', busyLabel: 'admin.saving' },
    { type: 'button', name: 'cancel', label: 'admin.cancel', variant: 'outline' },
  ];
}

const CODE_RULES = [
  { type: 'required', message: 'admin.structure.codeRequired' },
  { type: 'maxLength', value: 32 },
  { type: 'pattern', value: '^\\s*[A-Za-z0-9_.-]+\\s*$', message: 'admin.structure.codeFormat' },
] as const;

/** Création d'un service (code, nom, nature, spécialité) ou modification (nom, nature, spécialité ; le code ne change plus). */
export function serviceFields(o: { readonly node: StructureNode | null; readonly specialties: readonly ReferenceOption[]; readonly notice: string | null }): FieldSchema[] {
  const creating = o.node === null;
  return [
    ...failureNotice(o.notice),
    ...(creating
      ? ([{ type: 'code', name: 'code', label: 'admin.structure.code', hint: 'admin.structure.codeHint', value: '', normalize: 'uppercase', inputClass: 'font-mono', validators: CODE_RULES }] as const)
      : []),
    { type: 'text', name: 'name', label: 'admin.structure.name', value: o.node?.name ?? '', autofocus: true, normalize: 'trim', validators: [{ type: 'required', message: 'admin.structure.nameRequired' }, { type: 'maxLength', value: 200 }] },
    {
      type: 'select', name: 'serviceType', label: 'admin.structure.serviceType', value: o.node?.serviceType ?? 'CLINICAL',
      options: SERVICE_TYPES.map((type) => ({ value: type, label: `server.structure.${type}` })), validators: [{ type: 'required' }],
    },
    {
      type: 'select', name: 'specialtyCode', label: 'admin.structure.specialty', placeholder: 'admin.structure.noSpecialty', value: o.node?.specialtyCode ?? '',
      options: o.specialties.map((s) => ({ value: s.code, label: s.label })),
    },
    { type: 'submit', name: 'submit', label: creating ? 'admin.structure.addService' : 'admin.save', busyLabel: 'admin.saving' },
    { type: 'button', name: 'cancel', label: 'admin.cancel', variant: 'outline' },
  ];
}

/** Création ou modification d'une unité, d'une salle (avec étage) ou d'un lit. */
export function childFields(o: { readonly kind: NodeKind; readonly node: StructureNode | null; readonly notice: string | null }): FieldSchema[] {
  const creating = o.node === null;
  const addLabel = `admin.structure.add.${o.kind}`;
  return [
    ...failureNotice(o.notice),
    ...(creating
      ? ([{ type: 'code', name: 'code', label: 'admin.structure.code', hint: 'admin.structure.codeHint', value: '', autofocus: true, normalize: 'uppercase', inputClass: 'font-mono', validators: CODE_RULES }] as const)
      : []),
    { type: 'text', name: 'name', label: 'admin.structure.name', value: o.node?.name ?? '', autofocus: !creating, normalize: 'trim', validators: [{ type: 'required', message: 'admin.structure.nameRequired' }, { type: 'maxLength', value: 200 }] },
    ...(o.kind === 'ROOM'
      ? ([{ type: 'text', name: 'floor', label: 'admin.structure.floor', hint: 'admin.structure.floorHint', value: o.node?.floor ?? '', normalize: 'trim', validators: [{ type: 'maxLength', value: 32 }] }] as const)
      : []),
    { type: 'submit', name: 'submit', label: creating ? addLabel : 'admin.save', busyLabel: 'admin.saving' },
    { type: 'button', name: 'cancel', label: 'admin.cancel', variant: 'outline' },
  ];
}

/** Confirmation de la désactivation d'un élément (réversible, mais le lit ou la salle n'accueille plus personne). */
export function deactivateFields(o: { readonly node: StructureNode; readonly blocked: boolean; readonly notice: string | null }): FieldSchema[] {
  return [
    ...failureNotice(o.notice),
    o.blocked
      ? { type: 'message', name: 'blocked', tone: 'warning', appearance: 'outlined', title: 'admin.structure.blockedTitle', text: 'admin.structure.blockedText' }
      : { type: 'message', name: 'warning', tone: 'warning', appearance: 'outlined', title: 'admin.structure.deactivateTitle', text: 'admin.structure.deactivateText' },
    { type: 'paragraph', name: 'audit', text: 'admin.auditNote', tone: 'muted' },
    ...(o.blocked ? [] : ([{ type: 'submit', name: 'submit', label: 'admin.structure.deactivate', busyLabel: 'admin.saving' }] as const)),
    { type: 'button', name: 'cancel', label: 'admin.cancel', variant: 'outline' },
  ];
}
