import {
  CheckDuplicatesUseCase, GetPatientHistoryUseCase, GetPatientUseCase, RecordPatientDeathUseCase, RegisterPatientUseCase, SearchPatientsUseCase, UpdatePatientUseCase,
} from '../../src/modules/patients/application/use-cases/patients';
import { Patient, snapshotOf } from '../../src/modules/patients/domain/patient';
import { parsePatientInput } from '../../src/modules/patients/domain/patient-input';
import {
  DuplicateKey, DuplicateMatch, DuplicateReason, PatientRepository, PatientRevision, PatientSearch, RevisionInfo,
} from '../../src/modules/patients/domain/ports';
import {
  Address, IdentityDocument, nameKey, NextOfKin, parseDate, PatientId, PatientNumber, PersonName, PhoneNumber, ShortText,
} from '../../src/modules/patients/domain/values';
import { Calendar } from '../../src/shared-kernel/ports';
import { PlainDate, Temporal } from '../../src/shared-kernel/temporal';
import { FixedClock, MemoryAudit, must, SeqIds } from '../iam/fakes';

class FixedCalendar implements Calendar {
  constructor(public date: PlainDate = Temporal.PlainDate.from('2026-10-23')) {}
  today() { return this.date; }
}

/** Comme une vraie base : chaque lecture renvoie un nouvel objet, une modification non enregistrée ne laisse aucune trace. */
class InMemoryPatients implements PatientRepository {
  readonly rows = new Map<string, Patient>();
  readonly revisions = new Map<string, PatientRevision[]>();
  private seq = 0;
  async nextNumber() { this.seq += 1; return must(PatientNumber.fromSequence(this.seq)); }
  async findById(id: PatientId) { const p = this.rows.get(id.value); return p ? Patient.restore(p.state) : null; }
  async save(patient: Patient, info: RevisionInfo) {
    this.rows.set(patient.id.value, Patient.restore(patient.state));
    const list = this.revisions.get(patient.id.value) ?? [];
    list.unshift({ revision: list.length + 1, changedAt: info.at, changedBy: info.actorId, reason: info.reason, changedFields: info.changedFields, snapshot: snapshotOf(patient.state) });
    this.revisions.set(patient.id.value, list);
  }
  async findDuplicates(key: DuplicateKey): Promise<DuplicateMatch[]> {
    const out: DuplicateMatch[] = [];
    for (const p of this.rows.values()) {
      if (key.excludeId?.equals(p.id)) continue;
      const reasons: DuplicateReason[] = [];
      if (key.identityDocument && p.state.identityDocument?.equals(key.identityDocument)) reasons.push('IDENTITY_DOCUMENT');
      if (p.nameKey === key.nameKey && p.state.birthDate.equals(key.birthDate)) reasons.push('NAME_AND_BIRTH_DATE');
      if (key.phone && p.state.phone?.matchKey === key.phone.matchKey && p.state.birthDate.equals(key.birthDate)) reasons.push('PHONE_AND_BIRTH_DATE');
      if (reasons.length) out.push({ patient: Patient.restore(p.state), reasons });
    }
    return out;
  }
  async search(c: PatientSearch, offset: number, limit: number) {
    const all = [...this.rows.values()]
      .filter((p) => !c.number || p.number.equals(c.number))
      .filter((p) => (c.nameTokens ?? []).every((t) => p.nameKey.includes(t)))
      .filter((p) => !c.birthDate || p.state.birthDate.equals(c.birthDate))
      .filter((p) => !c.phone || p.state.phone?.matchKey === c.phone.matchKey)
      .filter((p) => !c.identityNumber || p.state.identityDocument?.number === c.identityNumber)
      .filter((p) => !c.status || (c.status === 'DECEASED') === p.isDeceased)
      .sort((a, b) => a.state.lastName.value.localeCompare(b.state.lastName.value));
    return { items: all.slice(offset, offset + limit).map((p) => Patient.restore(p.state)), total: all.length };
  }
  async history(id: PatientId) { return this.revisions.get(id.value) ?? []; }
}

function build() {
  const patients = new InMemoryPatients();
  const audit = new MemoryAudit();
  const clock = new FixedClock();
  const calendar = new FixedCalendar();
  const ids = new SeqIds();
  return {
    patients, audit, calendar,
    register: new RegisterPatientUseCase(patients, ids, audit, clock, calendar),
    update: new UpdatePatientUseCase(patients, audit, clock, calendar),
    death: new RecordPatientDeathUseCase(patients, audit, clock, calendar),
    get: new GetPatientUseCase(patients, audit, clock, calendar),
    search: new SearchPatientsUseCase(patients, audit, clock, calendar),
    duplicates: new CheckDuplicatesUseCase(patients, audit, clock, calendar),
    history: new GetPatientHistoryUseCase(patients, audit, clock),
  };
}

const ACTOR = 'reception-1';
const codeOf = <T>(r: { ok: true; value: T } | { ok: false; error: { code: string } }) => (r.ok ? 'OK' : r.error.code);
const MBARGA = { lastName: 'Mbarga', firstName: 'Élisabeth', sex: 'female', birthDate: '1990-03-14', phone: '+237 655 00 00 00', nationality: 'cm' };
const NO_PII = /Mbarga|Élisabeth|Elisabeth|1990|655|Douala|Jeanne/;

describe('patients : valeurs', () => {
  it('construit une clé de nom sans accents, casse, ponctuation ni ordre', () => {
    expect(nameKey('Ngo-Bassa', 'Élisabeth  Marie')).toBe('bassa elisabeth marie ngo');
    expect(nameKey('élisabeth marie', 'NGO BASSA')).toBe(nameKey('Ngo-Bassa', 'Élisabeth  Marie'));
    expect(nameKey('Müller', 'Zoë')).toBe('muller zoe');
    expect(nameKey('', '  ')).toBe('');
  });

  it('formate et valide le numéro de dossier', () => {
    expect(must(PatientNumber.fromSequence(123)).value).toBe('PAT-0000123');
    expect(must(PatientNumber.create(' pat-0000123 ')).value).toBe('PAT-0000123');
    for (const bad of ['', 'PAT-12', 'ABC-0000123', 'PAT-00000x1']) expect(codeOf(PatientNumber.create(bad))).toBe('PATIENT_NUMBER_INVALID');
  });

  it('valide noms, textes courts, téléphone et pièce d\'identité', () => {
    expect(must(PersonName.create('  Jean   Pierre ', 'firstName')).value).toBe('Jean Pierre');
    for (const bad of ['', '  ', 'x'.repeat(101), 'a\u0000b']) expect(codeOf(PersonName.create(bad, 'lastName'))).toBe('PATIENT_NAME_INVALID');
    expect(codeOf(ShortText.create('x'.repeat(101), 'birthPlace', 100))).toBe('PATIENT_FIELD_INVALID');
    expect(must(PhoneNumber.create('+237 655 00 00 00')).digits).toBe('237655000000');
    expect(must(PhoneNumber.create('+237 655 00 00 00')).matchKey).toBe(must(PhoneNumber.create('655-00-00-00')).matchKey);
    for (const bad of ['abc', '+12', '12345', '']) expect(codeOf(PhoneNumber.create(bad))).toBe('PATIENT_PHONE_INVALID');
    expect(must(IdentityDocument.create('national_id', ' 12 34-56/78 ')).number).toBe('1234-56/78');
    expect(codeOf(IdentityDocument.create('LAISSEZ_PASSER', '123456'))).toBe('PATIENT_ENUM_INVALID');
    expect(codeOf(IdentityDocument.create('PASSPORT', 'a!'))).toBe('PATIENT_DOCUMENT_INVALID');
    expect(must(IdentityDocument.create('PASSPORT', 'ab123')).equals(must(IdentityDocument.create('passport', 'AB 123')))).toBe(true);
  });

  it('valide l\'adresse (vide = aucune), la personne à prévenir et les dates', () => {
    expect(must(Address.create({}))).toBeNull();
    expect(must(Address.create({ line: '  ', city: '' }))).toBeNull();
    expect(must(Address.create({ city: 'Yaoundé', country: 'cm' }))?.country?.value).toBe('CM');
    expect(codeOf(Address.create({ country: 'CMR' }))).toBe('PATIENT_COUNTRY_INVALID');
    expect(codeOf(Address.create({ line: 'x'.repeat(201) }))).toBe('PATIENT_FIELD_INVALID');
    expect(must(NextOfKin.create({ name: 'Jeanne Ngo', relationship: 'spouse', phone: '+237 677 00 00 00' })).relationship).toBe('SPOUSE');
    expect(codeOf(NextOfKin.create({ name: 'Jeanne', relationship: 'VOISIN', phone: '+237 677 00 00 00' }))).toBe('PATIENT_ENUM_INVALID');
    expect(codeOf(NextOfKin.create({ name: 'Jeanne', relationship: 'SPOUSE', phone: '1' }))).toBe('PATIENT_PHONE_INVALID');
    expect(must(parseDate('2024-02-29', 'd')).toString()).toBe('2024-02-29');
    for (const bad of ['2023-02-29', '2024-13-01', '14/03/1990', '1990-3-14', '', 'hier']) expect(codeOf(parseDate(bad, 'd'))).toBe('PATIENT_DATE_INVALID');
  });

  it('transforme la saisie en objets de valeur : absent = inchangé, null ou vide = retiré', () => {
    const parsed = must(parsePatientInput({ lastName: ' Mbarga ', sex: 'female', phone: '', email: null, birthPlace: undefined, address: { city: 'Yaoundé' } }));
    expect(parsed.lastName?.value).toBe('Mbarga');
    expect(parsed.sex).toBe('FEMALE');
    expect(parsed.phone).toBeNull();
    expect(parsed.email).toBeNull();
    expect('birthPlace' in parsed).toBe(false);
    expect(parsed.address?.city?.value).toBe('Yaoundé');
    expect(codeOf(parsePatientInput({ sex: 'robot' }))).toBe('PATIENT_ENUM_INVALID');
    expect(codeOf(parsePatientInput({ email: 'pas-un-email' }))).toBe('PATIENT_EMAIL_INVALID');
  });
});

describe('patients : ouverture d\'un dossier', () => {
  it('ouvre un dossier normalisé avec un numéro système, archive la version 1 et ne met aucune donnée personnelle dans l\'audit', async () => {
    const w = build();
    const p = must(await w.register.execute(ACTOR, MBARGA));
    expect(p).toMatchObject({ number: 'PAT-0000001', identityStatus: 'CONFIRMED', lastName: 'Mbarga', firstName: 'Élisabeth', sex: 'FEMALE', nationality: 'CM', ageYears: 36, status: 'ACTIVE', birthDateEstimated: false });
    const [v1] = w.patients.revisions.get(p.id)!;
    expect(v1).toMatchObject({ revision: 1, changedBy: ACTOR, reason: null, changedFields: ['registration'] });
    const entry = w.audit.last('patient.record.register')!;
    expect(entry).toMatchObject({ actorId: ACTOR, resourceType: 'patient', resourceId: p.id, metadata: { patientNumber: 'PAT-0000001', identityStatus: 'CONFIRMED', duplicatesIgnored: false } });
    expect(JSON.stringify(w.audit.entries)).not.toMatch(NO_PII);
    expect(must(await w.register.execute(ACTOR, { ...MBARGA, lastName: 'Autre', phone: undefined })).number).toBe('PAT-0000002');
  });

  it('exige nom, prénom, sexe et date de naissance, et refuse les valeurs invalides', async () => {
    const w = build();
    for (const field of ['lastName', 'firstName', 'sex', 'birthDate'] as const) {
      const input: Record<string, unknown> = { ...MBARGA };
      delete input[field];
      const r = await w.register.execute(ACTOR, input);
      expect(codeOf(r)).toBe('PATIENT_FIELD_REQUIRED');
      if (!r.ok) expect(r.error.details).toEqual({ field });
    }
    expect(codeOf(await w.register.execute(ACTOR, { ...MBARGA, birthDate: '2026-10-24' }))).toBe('PATIENT_BIRTH_DATE_INVALID'); // demain
    expect(codeOf(await w.register.execute(ACTOR, { ...MBARGA, birthDate: '1879-12-31' }))).toBe('PATIENT_BIRTH_DATE_INVALID');
    expect(codeOf(await w.register.execute(ACTOR, { ...MBARGA, birthDate: '1990-02-30' }))).toBe('PATIENT_DATE_INVALID');
    expect(codeOf(await w.register.execute(ACTOR, { ...MBARGA, sex: 'x' }))).toBe('PATIENT_ENUM_INVALID');
    expect(w.patients.rows.size).toBe(0);
  });

  it('refuse un dossier ressemblant (avec les candidats), sans gaspiller de numéro ; l\'inversion nom/prénom ne trompe pas', async () => {
    const w = build();
    must(await w.register.execute(ACTOR, MBARGA));
    for (const variant of [{ lastName: 'ÉLISABETH', firstName: 'mbarga' }, { phone: '237655000000', lastName: 'Autre', firstName: 'Nom' }]) {
      const r = await w.register.execute(ACTOR, { ...MBARGA, ...variant });
      expect(codeOf(r)).toBe('PATIENT_POSSIBLE_DUPLICATE');
      if (!r.ok) {
        const candidates = r.error.details?.candidates as { number: string; reasons: string[] }[];
        expect(r.error.details?.count).toBe(1);
        expect(candidates[0].number).toBe('PAT-0000001');
      }
    }
    expect(w.patients.rows.size).toBe(1);
    // le numéro suivant n'a pas été consommé par les refus
    expect(must(await w.register.execute(ACTOR, { ...MBARGA, lastName: 'Different', phone: undefined })).number).toBe('PAT-0000002');
  });

  it('rapproche aussi par pièce d\'identité, même avec un autre nom', async () => {
    const w = build();
    must(await w.register.execute(ACTOR, { ...MBARGA, identityDocument: { type: 'NATIONAL_ID', number: '123456789' } }));
    const r = await w.register.execute(ACTOR, { lastName: 'Tout', firstName: 'Autre', sex: 'MALE', birthDate: '1970-01-01', identityDocument: { type: 'national_id', number: '123 456 789' } });
    expect(codeOf(r)).toBe('PATIENT_POSSIBLE_DUPLICATE');
    if (!r.ok) expect((r.error.details?.candidates as { reasons: string[] }[])[0].reasons).toEqual(['IDENTITY_DOCUMENT']);
  });

  it('permet de passer outre (tracé) et ne compare pas une identité provisoire', async () => {
    const w = build();
    must(await w.register.execute(ACTOR, MBARGA));
    const twin = must(await w.register.execute(ACTOR, { ...MBARGA, ignoreDuplicates: true }));
    expect(w.audit.last('patient.record.register')).toMatchObject({ resourceId: twin.id, metadata: { duplicatesIgnored: true } });
    const unknown = must(await w.register.execute(ACTOR, { ...MBARGA, identityStatus: 'provisional' }));
    expect(unknown.identityStatus).toBe('PROVISIONAL');
    expect(w.patients.rows.size).toBe(3);
  });

  it('ouvre un patient non identifié, avec une date de naissance estimée', async () => {
    const w = build();
    const p = must(await w.register.execute(ACTOR, { lastName: 'INCONNU', firstName: 'Urgence-12', sex: 'MALE', birthDate: '1985-01-01', birthDateEstimated: true, identityStatus: 'PROVISIONAL' }));
    expect(p).toMatchObject({ identityStatus: 'PROVISIONAL', birthDateEstimated: true, ageYears: 41 });
  });
});

describe('patients : corrections', () => {
  async function opened(w: ReturnType<typeof build>, input: Record<string, unknown> = MBARGA) {
    return must(await w.register.execute(ACTOR, input));
  }

  it('applique les corrections, archive une version avec son motif et ne journalise que les noms des champs', async () => {
    const w = build();
    const p = await opened(w);
    const updated = must(await w.update.execute('admin-2', p.id, { lastName: 'Mbarga-Nkoa', occupation: 'Enseignante', address: { city: 'Yaoundé', quarter: 'Bastos' }, reason: 'Acte de naissance présenté' }));
    expect(updated).toMatchObject({ lastName: 'Mbarga-Nkoa', occupation: 'Enseignante', address: { city: 'Yaoundé', quarter: 'Bastos', line: null }, number: p.number });
    const [v2] = w.patients.revisions.get(p.id)!;
    expect(v2).toMatchObject({ revision: 2, changedBy: 'admin-2', reason: 'Acte de naissance présenté' });
    expect([...v2.changedFields].sort()).toEqual(['address', 'lastName', 'occupation']);
    expect(v2.snapshot).toMatchObject({ lastName: 'Mbarga-Nkoa', address: { city: 'Yaoundé' } });
    expect(w.audit.last('patient.record.update')?.metadata).toMatchObject({ patientNumber: p.number, changed: expect.stringContaining('lastName') });
    expect(JSON.stringify(w.audit.entries)).not.toMatch(/Nkoa|Enseignante|Yaoundé|Acte de naissance/);
  });

  it('retire un champ facultatif avec null, remplace un bloc d\'un coup, et ne fait rien si rien ne change', async () => {
    const w = build();
    const p = await opened(w, { ...MBARGA, occupation: 'Enseignante', nextOfKin: { name: 'Jeanne', relationship: 'SPOUSE', phone: '+237 677 00 00 00' } });
    expect(must(await w.update.execute(ACTOR, p.id, { occupation: null, phone: '' })).occupation).toBeNull();
    const replaced = must(await w.update.execute(ACTOR, p.id, { nextOfKin: { name: 'Paul', relationship: 'parent', phone: '+237 688 00 00 00' } }));
    expect(replaced.nextOfKin).toEqual({ name: 'Paul', relationship: 'PARENT', phone: '+237 688 00 00 00' });
    expect(must(await w.update.execute(ACTOR, p.id, { nextOfKin: null })).nextOfKin).toBeNull();

    const revisions = w.patients.revisions.get(p.id)!.length;
    const before = w.audit.entries.length;
    must(await w.update.execute(ACTOR, p.id, { lastName: 'Mbarga', sex: 'FEMALE', occupation: null }));
    must(await w.update.execute(ACTOR, p.id, {}));
    expect(w.patients.revisions.get(p.id)).toHaveLength(revisions);
    expect(w.audit.entries).toHaveLength(before);
  });

  it('refuse une valeur invalide, un motif trop long et un dossier inconnu — sans rien écrire', async () => {
    const w = build();
    const p = await opened(w);
    const revisions = w.patients.revisions.get(p.id)!.length;
    expect(codeOf(await w.update.execute(ACTOR, p.id, { birthDate: '2999-01-01' }))).toBe('PATIENT_BIRTH_DATE_INVALID');
    expect(codeOf(await w.update.execute(ACTOR, p.id, { email: 'x' }))).toBe('PATIENT_EMAIL_INVALID');
    expect(codeOf(await w.update.execute(ACTOR, p.id, { lastName: 'Autre', reason: 'x'.repeat(201) }))).toBe('PATIENT_FIELD_INVALID');
    expect(codeOf(await w.update.execute(ACTOR, '99999999-9999-4999-8999-999999999999', { lastName: 'X' }))).toBe('PATIENT_NOT_FOUND');
    expect(codeOf(await w.update.execute(ACTOR, 'pas-un-uuid', { lastName: 'X' }))).toBe('PATIENT_NOT_FOUND');
    expect(w.patients.revisions.get(p.id)).toHaveLength(revisions);
    expect((await w.patients.findById(must(PatientId.create(p.id))))!.state.lastName.value).toBe('Mbarga');
  });

  it('revérifie les doublons quand une correction rapproche deux dossiers, sans se comparer à soi-même', async () => {
    const w = build();
    const a = await opened(w);
    const b = await opened(w, { lastName: 'Ndongo', firstName: 'Paul', sex: 'MALE', birthDate: '1990-03-14' });
    expect(must(await w.update.execute(ACTOR, a.id, { firstName: 'Élisabeth', lastName: 'MBARGA' })).number).toBe(a.number); // soi-même exclu
    expect(codeOf(await w.update.execute(ACTOR, b.id, { lastName: 'Mbarga', firstName: 'Élisabeth' }))).toBe('PATIENT_POSSIBLE_DUPLICATE');
    expect(must(await w.update.execute(ACTOR, b.id, { lastName: 'Mbarga', firstName: 'Élisabeth', ignoreDuplicates: true })).lastName).toBe('Mbarga');
    expect(must(await w.update.execute(ACTOR, a.id, { occupation: 'Médecin' })).occupation).toBe('Médecin'); // pas de revérification : champ sans rapport
  });

  it('confirme une identité provisoire (avec contrôle des doublons) et ne permet pas le retour en arrière', async () => {
    const w = build();
    must(await w.register.execute(ACTOR, MBARGA));
    const x = must(await w.register.execute(ACTOR, { lastName: 'INCONNU', firstName: 'X-1', sex: 'FEMALE', birthDate: '1990-01-01', birthDateEstimated: true, identityStatus: 'PROVISIONAL' }));
    expect(must(await w.update.execute(ACTOR, x.id, { occupation: 'Commerçante' })).identityStatus).toBe('PROVISIONAL'); // correction sans confirmation : pas de comparaison
    const identified = { lastName: 'Mbarga', firstName: 'Élisabeth', birthDate: '1990-03-14', birthDateEstimated: false, identityStatus: 'CONFIRMED' };
    expect(codeOf(await w.update.execute(ACTOR, x.id, identified))).toBe('PATIENT_POSSIBLE_DUPLICATE');
    const confirmed = must(await w.update.execute(ACTOR, x.id, { ...identified, firstName: 'Marie-Élisabeth', reason: 'Identifiée par sa famille' }));
    expect(confirmed.identityStatus).toBe('CONFIRMED');
    expect(codeOf(await w.update.execute(ACTOR, x.id, { identityStatus: 'PROVISIONAL' }))).toBe('PATIENT_IDENTITY_STATUS_INVALID');
  });
});

describe('patients : décès', () => {
  it('enregistre le décès une fois, dans les bornes, avec une version archivée', async () => {
    const w = build();
    const p = must(await w.register.execute(ACTOR, MBARGA));
    expect(codeOf(await w.death.execute(ACTOR, p.id, { dateOfDeath: '2026-10-24' }))).toBe('PATIENT_DEATH_DATE_INVALID'); // futur
    expect(codeOf(await w.death.execute(ACTOR, p.id, { dateOfDeath: '1990-03-13' }))).toBe('PATIENT_DEATH_DATE_INVALID'); // avant la naissance
    expect(codeOf(await w.death.execute(ACTOR, p.id, { dateOfDeath: 'hier' }))).toBe('PATIENT_DATE_INVALID');
    const dead = must(await w.death.execute('doctor-1', p.id, { dateOfDeath: '2026-10-20', reason: 'Constat du Dr Nkoa' }));
    expect(dead).toMatchObject({ status: 'DECEASED', dateOfDeath: '2026-10-20', ageYears: 36 });
    const [v] = w.patients.revisions.get(p.id)!;
    expect(v).toMatchObject({ changedBy: 'doctor-1', reason: 'Constat du Dr Nkoa', changedFields: ['dateOfDeath'] });
    expect(w.audit.last('patient.record.death')?.metadata).toMatchObject({ dateOfDeath: '2026-10-20' });
    expect(codeOf(await w.death.execute(ACTOR, p.id, {}))).toBe('PATIENT_ALREADY_DECEASED');
    expect(codeOf(await w.death.execute(ACTOR, 'nope', {}))).toBe('PATIENT_NOT_FOUND');
  });

  it("empêche une correction de date de naissance postérieure au décès", async () => {
    const w = build();
    const p = must(await w.register.execute(ACTOR, MBARGA));
    must(await w.death.execute(ACTOR, p.id, { dateOfDeath: '2020-01-01' }));
    expect(codeOf(await w.update.execute(ACTOR, p.id, { birthDate: '2021-01-01' }))).toBe('PATIENT_DEATH_DATE_INVALID');
    expect(must(await w.update.execute(ACTOR, p.id, { birthDate: '1989-01-01' })).ageYears).toBe(31);
  });
});

describe('patients : consultation', () => {
  it('inscrit chaque ouverture de dossier au journal, sans donnée personnelle', async () => {
    const w = build();
    const p = must(await w.register.execute(ACTOR, MBARGA));
    const opened = must(await w.get.execute('doctor-1', p.id));
    expect(opened).toMatchObject({ number: 'PAT-0000001', phone: '+237 655 00 00 00', identityDocument: null, address: null, nextOfKin: null });
    expect(w.audit.last('patient.record.read')).toMatchObject({ actorId: 'doctor-1', resourceType: 'patient', resourceId: p.id, outcome: 'SUCCESS', metadata: { patientNumber: 'PAT-0000001' } });
    expect(JSON.stringify(w.audit.entries)).not.toMatch(NO_PII);
    const before = w.audit.entries.length;
    expect(codeOf(await w.get.execute('doctor-1', '99999999-9999-4999-8999-999999999999'))).toBe('PATIENT_NOT_FOUND');
    expect(w.audit.entries).toHaveLength(before);
  });

  it("exige un critère de recherche et refuse les critères trop courts : pas de parcours de tous les dossiers", async () => {
    const w = build();
    for (const input of [{}, { q: '  ' }, { status: 'ACTIVE' }]) expect(codeOf(await w.search.execute(ACTOR, { ...input, offset: 0, limit: 20 }))).toBe('PATIENT_SEARCH_CRITERIA_REQUIRED');
    for (const q of ['a', 'é', '- .']) expect(codeOf(await w.search.execute(ACTOR, { q, offset: 0, limit: 20 }))).toBe('PATIENT_SEARCH_TOO_BROAD');
    expect(codeOf(await w.search.execute(ACTOR, { identityNumber: 'ab', offset: 0, limit: 20 }))).toBe('PATIENT_SEARCH_TOO_BROAD');
    expect(codeOf(await w.search.execute(ACTOR, { q: 'mbarga', status: 'GONE', offset: 0, limit: 20 }))).toBe('PATIENT_STATUS_FILTER_INVALID');
    expect(codeOf(await w.search.execute(ACTOR, { birthDate: '1990-02-30', offset: 0, limit: 20 }))).toBe('PATIENT_DATE_INVALID');
    expect(codeOf(await w.search.execute(ACTOR, { phone: '12', offset: 0, limit: 20 }))).toBe('PATIENT_PHONE_INVALID');
  });

  it('cherche par nom (sans accents ni ordre), numéro, naissance, téléphone ou pièce, et renvoie des résumés', async () => {
    const w = build();
    must(await w.register.execute(ACTOR, { ...MBARGA, identityDocument: { type: 'PASSPORT', number: 'AB123456' }, occupation: 'Enseignante' }));
    must(await w.register.execute(ACTOR, { lastName: 'Ndongo', firstName: 'Paul', sex: 'MALE', birthDate: '1975-06-01' }));
    const found = async (q: Record<string, string>) => must(await w.search.execute(ACTOR, { offset: 0, limit: 20, ...q })).items.map((p) => p.lastName);
    expect(await found({ q: 'elisabeth MBARGA' })).toEqual(['Mbarga']);
    expect(await found({ q: 'mbar' })).toEqual(['Mbarga']);
    expect(await found({ q: 'pat-1' })).toEqual(['Mbarga']);
    expect(await found({ q: 'PAT0000002' })).toEqual(['Ndongo']);
    expect(await found({ birthDate: '1975-06-01' })).toEqual(['Ndongo']);
    expect(await found({ phone: '237 655 00 00 00' })).toEqual(['Mbarga']);
    expect(await found({ identityNumber: 'ab 123456' })).toEqual(['Mbarga']);
    expect(await found({ q: 'zzz' })).toEqual([]);
    expect(await found({ q: 'ndongo', birthDate: '1990-03-14' })).toEqual([]); // critères cumulés
    const [summary] = must(await w.search.execute(ACTOR, { q: 'mbarga', offset: 0, limit: 20 })).items;
    expect(Object.keys(summary).sort()).toEqual(['ageYears', 'birthDate', 'birthDateEstimated', 'firstName', 'id', 'identityStatus', 'lastName', 'number', 'sex', 'status']);
  });

  it('borne la page à 50 et inscrit au journal les critères utilisés, jamais leurs valeurs', async () => {
    const w = build();
    must(await w.register.execute(ACTOR, MBARGA));
    expect(must(await w.search.execute(ACTOR, { q: 'mbarga', offset: -3, limit: 9999 }))).toMatchObject({ offset: 0, limit: 50, total: 1 });
    must(await w.search.execute('doctor-1', { q: 'mbarga', birthDate: '1990-03-14', phone: '655 00 00 00', offset: 0, limit: 20 }));
    expect(w.audit.last('patient.record.search')).toMatchObject({ actorId: 'doctor-1', metadata: { criteria: 'name,birthDate,phone', returned: 1, total: 1 } });
    expect(JSON.stringify(w.audit.entries)).not.toMatch(NO_PII);
  });

  it('filtre par situation (actifs, décédés)', async () => {
    const w = build();
    const a = must(await w.register.execute(ACTOR, MBARGA));
    must(await w.register.execute(ACTOR, { lastName: 'Mbarga', firstName: 'Pierre', sex: 'MALE', birthDate: '1960-01-01' }));
    must(await w.death.execute(ACTOR, a.id, { dateOfDeath: '2026-01-01' }));
    const names = async (status: string) => must(await w.search.execute(ACTOR, { q: 'mbarga', status, offset: 0, limit: 20 })).items.map((p) => p.firstName);
    expect(await names('deceased')).toEqual(['Élisabeth']);
    expect(await names('ACTIVE')).toEqual(['Pierre']);
  });

  it('vérifie les doublons sans rien créer, et le journalise sans donnée personnelle', async () => {
    const w = build();
    must(await w.register.execute(ACTOR, MBARGA));
    const none = must(await w.duplicates.execute(ACTOR, { lastName: 'Autre', firstName: 'Personne', birthDate: '1980-01-01' }));
    expect(none).toEqual([]);
    const hit = must(await w.duplicates.execute(ACTOR, { lastName: 'mbarga', firstName: 'elisabeth', birthDate: '1990-03-14' }));
    expect(hit).toMatchObject([{ number: 'PAT-0000001', reasons: ['NAME_AND_BIRTH_DATE'] }]);
    expect(w.patients.rows.size).toBe(1);
    expect(w.audit.last('patient.record.duplicate-check')?.metadata).toEqual({ candidates: 1 });
    expect(JSON.stringify(w.audit.entries)).not.toMatch(NO_PII);
    expect(codeOf(await w.duplicates.execute(ACTOR, { lastName: 'x', firstName: '', birthDate: '1990-03-14' }))).toBe('PATIENT_NAME_INVALID');
  });

  it("restitue l'historique (plus récent d'abord) et le journalise", async () => {
    const w = build();
    const p = must(await w.register.execute(ACTOR, MBARGA));
    must(await w.update.execute('admin-2', p.id, { occupation: 'Enseignante', reason: 'Ajout' }));
    const history = must(await w.history.execute('dpo-1', p.id));
    expect(history.map((r) => [r.revision, r.changedBy, r.changedFields])).toEqual([[2, 'admin-2', ['occupation']], [1, ACTOR, ['registration']]]);
    expect(history[1].snapshot).toMatchObject({ lastName: 'Mbarga', occupation: null });
    expect(w.audit.last('patient.history.read')).toMatchObject({ actorId: 'dpo-1', metadata: { patientNumber: p.number, revisions: 2 } });
    expect(codeOf(await w.history.execute('dpo-1', 'nope'))).toBe('PATIENT_NOT_FOUND');
  });
});
