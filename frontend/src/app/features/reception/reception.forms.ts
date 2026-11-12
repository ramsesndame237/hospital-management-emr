import {
  ADMISSION_STATUSES, ADMISSION_TYPES, APPOINTMENT_STATUSES, AdmissionStatus, AdmissionType, DISCHARGE_TYPES, DOCUMENT_TYPES, MARITAL_STATUSES, OccupancyBed, Patient, PatientInput, Practitioner, RELATIONSHIPS, SEXES, Service,
} from '../../core/reception/reception.models';
import { failureNotice } from '../../shared/failure-message';
import { FieldSchema, OptionSpec } from '../../shared/form-builder/form-schema';

const options = (values: readonly string[], prefix: string): OptionSpec[] => values.map((v) => ({ value: v, label: `${prefix}.${v}` }));

const DATE = '^\\d{4}-\\d{2}-\\d{2}$';

/** Recherche de patients : au moins un critère, rempli au clavier ; le serveur refuse une recherche trop large. */
export function patientSearchFields(): FieldSchema[] {
  return [
    { type: 'text', name: 'q', label: 'reception.search.q', hint: 'reception.search.qHint', span: 6, normalize: 'trim', autofocus: true },
    { type: 'text', name: 'birthDate', label: 'reception.search.birthDate', placeholder: 'reception.dateFormat', span: 3, normalize: 'trim', inputClass: 'font-mono', validators: [{ type: 'pattern', value: `${DATE.slice(0, -1)}$|^$`, message: 'reception.patient.dateInvalid' }] },
    { type: 'tel', name: 'phone', label: 'reception.search.phone', span: 3, normalize: 'trim' },
    { type: 'text', name: 'identityNumber', label: 'reception.search.identityNumber', span: 6, normalize: 'trim', inputClass: 'font-mono' },
    { type: 'submit', name: 'submit', label: 'reception.search.submit', busyLabel: 'reception.search.busy', class: 'self-end' },
  ];
}

const section = (name: string, text: string): FieldSchema => ({ type: 'paragraph', name, text, class: 'mt-2 text-sm font-semibold text-foreground', span: 12 });

/** Dossier patient, à l'ouverture ou à la correction (la correction exige un motif, archivé avec la nouvelle version). */
export function patientFields(o: { readonly patient: Patient | null; readonly editing: boolean; readonly notice: string | null }): FieldSchema[] {
  const p = o.patient;
  const text = (name: string, span: ColumnSpanLike, over: Partial<FieldSchema> = {}): FieldSchema =>
    ({ type: 'text', name, label: `reception.patient.${name}`, span, normalize: 'trim', ...over }) as FieldSchema;
  const select = (name: string, span: ColumnSpanLike, values: readonly string[], prefix: string, value: string | null | undefined, extra: Partial<FieldSchema> = {}): FieldSchema =>
    ({ type: 'select', name, label: `reception.patient.${name}`, placeholder: 'reception.choose', span, options: options(values, prefix), value: value ?? '', ...extra }) as FieldSchema;
  const required = { type: 'required', message: 'reception.patient.required' };
  return [
    ...failureNotice(o.notice),
    ...(!o.editing || p?.identityStatus === 'PROVISIONAL'
      ? [select('identityStatus', 12, ['CONFIRMED', 'PROVISIONAL'], 'reception.identityStatus', p?.identityStatus ?? 'CONFIRMED', { hint: 'reception.patient.identityStatusHint' })]
      : []),
    text('lastName', 6, { value: p?.lastName ?? '', autofocus: true, validators: [required, { type: 'maxLength', value: 100 }] }),
    text('firstName', 6, { value: p?.firstName ?? '', validators: [required, { type: 'maxLength', value: 100 }] }),
    select('sex', 4, SEXES, 'reception.sex', p?.sex, { validators: [required] }),
    text('birthDate', 4, { value: p?.birthDate ?? '', placeholder: 'reception.dateFormat', inputClass: 'font-mono', validators: [required, { type: 'pattern', value: DATE, message: 'reception.patient.dateInvalid' }] }),
    { type: 'checkbox', name: 'birthDateEstimated', label: 'reception.patient.birthDateEstimated', span: 4, value: p?.birthDateEstimated ?? false, class: 'self-end' },
    text('birthPlace', 4, { value: p?.birthPlace ?? '' }),
    text('nationality', 2, { value: p?.nationality ?? '', normalize: 'uppercase', hint: 'reception.patient.countryHint', validators: [{ type: 'pattern', value: '^([A-Za-z]{2})?$', message: 'reception.patient.countryInvalid' }] }),
    select('maritalStatus', 3, MARITAL_STATUSES, 'reception.marital', p?.maritalStatus),
    text('occupation', 3, { value: p?.occupation ?? '' }),
    section('s-contact', 'reception.patient.contactTitle'),
    { type: 'tel', name: 'phone', label: 'reception.patient.phone', span: 6, value: p?.phone ?? '', normalize: 'trim' },
    { type: 'email', name: 'email', label: 'reception.patient.email', span: 6, value: p?.email ?? '', normalize: 'trim' },
    text('addressLine', 12, { value: p?.address?.line ?? '' }),
    text('addressQuarter', 4, { value: p?.address?.quarter ?? '' }),
    text('addressCity', 4, { value: p?.address?.city ?? '' }),
    text('addressRegion', 3, { value: p?.address?.region ?? '' }),
    text('addressCountry', 1, { value: p?.address?.country ?? '', normalize: 'uppercase', validators: [{ type: 'pattern', value: '^([A-Za-z]{2})?$', message: 'reception.patient.countryInvalid' }] }),
    section('s-document', 'reception.patient.documentTitle'),
    select('documentType', 4, DOCUMENT_TYPES, 'reception.document', p?.identityDocument?.type),
    text('documentNumber', 8, { value: p?.identityDocument?.number ?? '', inputClass: 'font-mono' }),
    section('s-kin', 'reception.patient.kinTitle'),
    text('kinName', 5, { value: p?.nextOfKin?.name ?? '' }),
    select('kinRelationship', 3, RELATIONSHIPS, 'reception.relationship', p?.nextOfKin?.relationship),
    { type: 'tel', name: 'kinPhone', label: 'reception.patient.kinPhone', span: 4, value: p?.nextOfKin?.phone ?? '', normalize: 'trim' },
    ...(o.editing
      ? [text('reason', 12, { hint: 'reception.patient.reasonHint', validators: [{ type: 'required', message: 'reception.patient.reasonRequired' }, { type: 'maxLength', value: 200 }] })]
      : []),
    { type: 'submit', name: 'submit', label: o.editing ? 'reception.patient.save' : 'reception.patient.create', busyLabel: 'reception.saving', span: 12 },
    { type: 'button', name: 'cancel', label: 'reception.cancelAction', variant: 'outline', span: 12 },
  ];
}

type ColumnSpanLike = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;

/** Valeurs du formulaire → corps de l'API. À la correction, un champ vidé est retiré (`null`) ; à l'ouverture il est simplement omis. */
export function toPatientInput(values: Readonly<Record<string, unknown>>, editing: boolean): { readonly input: PatientInput } | { readonly error: string } {
  const str = (key: string): string => String(values[key] ?? '').trim();
  const optional = (key: string): string | null | undefined => (str(key) !== '' ? str(key) : editing ? null : undefined);
  const doc = [str('documentType'), str('documentNumber')];
  if (doc.filter(Boolean).length === 1) return { error: 'reception.patient.documentIncomplete' };
  const kin = [str('kinName'), str('kinRelationship'), str('kinPhone')];
  if (kin.filter(Boolean).length > 0 && kin.filter(Boolean).length < 3) return { error: 'reception.patient.kinIncomplete' };
  const address = { line: str('addressLine'), quarter: str('addressQuarter'), city: str('addressCity'), region: str('addressRegion'), country: str('addressCountry') };
  const hasAddress = Object.values(address).some(Boolean);
  const clean = Object.fromEntries(Object.entries({
    ...(values['identityStatus'] ? { identityStatus: str('identityStatus') } : {}),
    lastName: str('lastName'), firstName: str('firstName'), sex: str('sex'), birthDate: str('birthDate'), birthDateEstimated: values['birthDateEstimated'] === true,
    birthPlace: optional('birthPlace'), nationality: optional('nationality'), maritalStatus: optional('maritalStatus'), occupation: optional('occupation'), phone: optional('phone'), email: optional('email'),
    address: hasAddress ? Object.fromEntries(Object.entries(address).map(([k, v]) => [k, v === '' ? null : v])) : editing ? null : undefined,
    identityDocument: doc[0] ? { type: doc[0], number: doc[1] } : editing ? null : undefined,
    nextOfKin: kin[0] ? { name: kin[0], relationship: kin[1], phone: kin[2] } : editing ? null : undefined,
    ...(editing ? { reason: str('reason') } : {}),
  }).filter(([, v]) => v !== undefined));
  return { input: clean as PatientInput };
}

/** Ouverture d'une admission : le type, le service, et pour une hospitalisation un lit libre de ce service. */
export function openAdmissionFields(o: { readonly services: readonly Service[]; readonly beds: readonly OccupancyBed[]; readonly notice: string | null }): FieldSchema[] {
  const required = { type: 'required', message: 'reception.admission.required' };
  return [
    ...failureNotice(o.notice),
    { type: 'select', name: 'type', label: 'reception.admission.type', placeholder: 'reception.choose', options: options(ADMISSION_TYPES, 'reception.admission.types'), validators: [required], autofocus: true },
    { type: 'select', name: 'serviceId', label: 'reception.admission.service', placeholder: 'reception.choose', options: o.services.map((s) => ({ value: s.id, label: `${s.name} (${s.code})` })), validators: [required] },
    {
      type: 'select', name: 'bedId', label: 'reception.admission.bed', placeholder: 'reception.admission.bedPlaceholder', showIf: { field: 'type', equals: 'INPATIENT' }, validators: [required],
      options: o.beds.filter((b) => b.active && !b.occupied).map((b) => ({ value: b.bedId, label: `${b.location} · ${b.name}` })),
      hint: o.beds.some((b) => b.active && !b.occupied) ? undefined : 'reception.admission.noFreeBed',
    },
    { type: 'submit', name: 'submit', label: 'reception.admission.open', busyLabel: 'reception.saving' },
    { type: 'button', name: 'cancel', label: 'reception.cancelAction', variant: 'outline' },
  ];
}

/** Sortie : sa nature (domicile, transfert, contre avis, décès, autre). L'heure est celle de l'enregistrement. */
export function dischargeFields(o: { readonly notice: string | null }): FieldSchema[] {
  return [
    ...failureNotice(o.notice),
    { type: 'select', name: 'type', label: 'reception.admission.dischargeType', placeholder: 'reception.choose', options: options(DISCHARGE_TYPES, 'reception.admission.discharge'), validators: [{ type: 'required', message: 'reception.admission.required' }], autofocus: true },
    { type: 'paragraph', name: 'deathNote', text: 'reception.admission.deathNote', tone: 'muted', showIf: { field: 'type', equals: 'DECEASED' } },
    { type: 'submit', name: 'submit', label: 'reception.admission.dischargeSubmit', busyLabel: 'reception.saving' },
    { type: 'button', name: 'cancel', label: 'reception.cancelAction', variant: 'outline' },
  ];
}

/** Annulation d'une admission ouverte par erreur : le motif est obligatoire. */
export function cancelAdmissionFields(o: { readonly notice: string | null }): FieldSchema[] {
  return [
    ...failureNotice(o.notice),
    { type: 'message', name: 'warning', tone: 'warning', appearance: 'outlined', title: 'reception.admission.cancelWarningTitle', text: 'reception.admission.cancelWarningText' },
    { type: 'text', name: 'reason', label: 'reception.admission.cancelReason', autofocus: true, normalize: 'trim', validators: [{ type: 'required', message: 'reception.admission.reasonRequired' }, { type: 'maxLength', value: 200 }] },
    { type: 'submit', name: 'submit', label: 'reception.admission.cancelSubmit', busyLabel: 'reception.saving' },
    { type: 'button', name: 'cancel', label: 'reception.admission.cancelKeep', variant: 'outline' },
  ];
}

/** Transfert : un autre lit (hospitalisation) ou un autre service. */
export function transferFields(o: { readonly inpatient: boolean; readonly services: readonly Service[]; readonly beds: readonly OccupancyBed[]; readonly notice: string | null }): FieldSchema[] {
  const required = { type: 'required', message: 'reception.admission.required' };
  return [
    ...failureNotice(o.notice),
    ...(o.inpatient
      ? [
          { type: 'select', name: 'serviceId', label: 'reception.admission.service', placeholder: 'reception.choose', options: o.services.map((s) => ({ value: s.id, label: `${s.name} (${s.code})` })), validators: [required], autofocus: true } as FieldSchema,
          {
            type: 'select', name: 'bedId', label: 'reception.admission.bed', placeholder: 'reception.admission.bedPlaceholder', validators: [required],
            options: o.beds.filter((b) => b.active && !b.occupied).map((b) => ({ value: b.bedId, label: `${b.location} · ${b.name}` })),
          } as FieldSchema,
        ]
      : [{ type: 'select', name: 'serviceId', label: 'reception.admission.newService', placeholder: 'reception.choose', options: o.services.map((s) => ({ value: s.id, label: `${s.name} (${s.code})` })), validators: [required], autofocus: true } as FieldSchema]),
    { type: 'submit', name: 'submit', label: 'reception.admission.transferSubmit', busyLabel: 'reception.saving' },
    { type: 'button', name: 'cancel', label: 'reception.cancelAction', variant: 'outline' },
  ];
}

/** Filtre de la liste des admissions : statut et type. */
export function admissionFilterFields(): FieldSchema[] {
  const all = { value: '', label: 'reception.admission.all' };
  return [
    { type: 'select', name: 'status', label: 'reception.admission.status', span: 4, value: 'IN_PROGRESS', options: [all, ...options(ADMISSION_STATUSES as readonly AdmissionStatus[], 'reception.admission.statuses')] },
    { type: 'select', name: 'type', label: 'reception.admission.type', span: 4, value: '', options: [all, ...options(ADMISSION_TYPES as readonly AdmissionType[], 'reception.admission.types')] },
  ];
}

const TIME = '^([01]\\d|2[0-3]):[0-5]\\d$';
export const DURATIONS = ['15', '20', '30', '45', '60', '90'] as const;
const durationOptions = (): OptionSpec[] => DURATIONS.map((d) => ({ value: d, label: `reception.agenda.minutes.${d}` }));
const serviceOptions = (services: readonly Service[]): OptionSpec[] => services.map((s) => ({ value: s.id, label: `${s.name} (${s.code})` }));

/** Filtre de l'agenda : le jour, le service et le statut. */
export function agendaFilterFields(o: { readonly services: readonly Service[]; readonly today: string }): FieldSchema[] {
  const all = { value: '', label: 'reception.agenda.all' };
  return [
    { type: 'text', name: 'date', label: 'reception.agenda.date', span: 3, value: o.today, inputClass: 'font-mono', placeholder: 'reception.dateFormat', validators: [{ type: 'pattern', value: DATE, message: 'reception.patient.dateInvalid' }] },
    { type: 'select', name: 'serviceId', label: 'reception.admission.service', span: 5, value: '', options: [all, ...serviceOptions(o.services)] },
    { type: 'select', name: 'status', label: 'reception.admission.status', span: 4, value: '', options: [all, ...options(APPOINTMENT_STATUSES, 'reception.agenda.statuses')] },
  ];
}

/** Prise de rendez-vous : le service, le professionnel (ceux du service), le jour, l'heure et la durée. Le patient se choisit au-dessus. */
export function bookingFields(o: { readonly services: readonly Service[]; readonly practitioners: readonly Practitioner[]; readonly today: string; readonly notice: string | null }): FieldSchema[] {
  const required = { type: 'required', message: 'reception.admission.required' };
  return [
    ...failureNotice(o.notice),
    { type: 'select', name: 'serviceId', label: 'reception.admission.service', placeholder: 'reception.choose', options: serviceOptions(o.services), validators: [required] },
    {
      type: 'select', name: 'practitionerId', label: 'reception.agenda.practitioner', placeholder: 'reception.choose', validators: [required],
      options: o.practitioners.map((p) => ({ value: p.id, label: `${p.lastName} ${p.firstName} (${p.staffNumber})` })),
      hint: 'reception.agenda.practitionerHint',
    },
    { type: 'text', name: 'date', label: 'reception.agenda.date', span: 6, value: o.today, inputClass: 'font-mono', placeholder: 'reception.dateFormat', validators: [required, { type: 'pattern', value: DATE, message: 'reception.patient.dateInvalid' }] },
    { type: 'text', name: 'time', label: 'reception.agenda.time', span: 6, inputClass: 'font-mono', placeholder: 'HH:MM', validators: [required, { type: 'pattern', value: TIME, message: 'reception.agenda.timeInvalid' }] },
    { type: 'select', name: 'duration', label: 'reception.agenda.duration', value: '30', options: durationOptions(), validators: [required] },
    { type: 'submit', name: 'submit', label: 'reception.agenda.book', busyLabel: 'reception.saving' },
    { type: 'button', name: 'cancel', label: 'reception.cancelAction', variant: 'outline' },
  ];
}

/** Déplacement d'un rendez-vous à venir : un autre jour, une autre heure, une autre durée. */
export function rescheduleFields(o: { readonly date: string; readonly time: string; readonly duration: number; readonly notice: string | null }): FieldSchema[] {
  const required = { type: 'required', message: 'reception.admission.required' };
  return [
    ...failureNotice(o.notice),
    { type: 'text', name: 'date', label: 'reception.agenda.date', span: 6, value: o.date, inputClass: 'font-mono', placeholder: 'reception.dateFormat', autofocus: true, validators: [required, { type: 'pattern', value: DATE, message: 'reception.patient.dateInvalid' }] },
    { type: 'text', name: 'time', label: 'reception.agenda.time', span: 6, value: o.time, inputClass: 'font-mono', placeholder: 'HH:MM', validators: [required, { type: 'pattern', value: TIME, message: 'reception.agenda.timeInvalid' }] },
    { type: 'select', name: 'duration', label: 'reception.agenda.duration', value: String(o.duration), options: durationOptions(), validators: [required] },
    { type: 'submit', name: 'submit', label: 'reception.agenda.move', busyLabel: 'reception.saving' },
    { type: 'button', name: 'cancel', label: 'reception.cancelAction', variant: 'outline' },
  ];
}

/** Annulation d'un rendez-vous : le motif est obligatoire et libère le créneau. */
export function cancelAppointmentFields(o: { readonly notice: string | null }): FieldSchema[] {
  return [
    ...failureNotice(o.notice),
    { type: 'text', name: 'reason', label: 'reception.agenda.cancelReason', autofocus: true, normalize: 'trim', validators: [{ type: 'required', message: 'reception.admission.reasonRequired' }, { type: 'maxLength', value: 200 }] },
    { type: 'submit', name: 'submit', label: 'reception.agenda.cancelSubmit', busyLabel: 'reception.saving' },
    { type: 'button', name: 'cancel', label: 'reception.agenda.cancelKeep', variant: 'outline' },
  ];
}
