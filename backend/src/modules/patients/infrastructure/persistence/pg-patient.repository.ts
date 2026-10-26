import { SqlExecutor } from '../../../../database/sql-executor';
import { requiredInstantFromDb } from '../../../../database/temporal-mapping';
import { Temporal } from '../../../../shared-kernel/temporal';
import { Patient, PatientSnapshot, snapshotOf } from '../../domain/patient';
import { DuplicateKey, DuplicateMatch, DuplicateReason, PatientRepository, PatientRevision, PatientSearch, RevisionInfo } from '../../domain/ports';
import {
  Address, ContactEmail, CountryCode, IdentityDocument, IdentityStatus, MaritalStatus, NextOfKin, parseEnum, PatientId, PatientNumber, PersonName, PhoneNumber, Sex, ShortText,
} from '../../domain/values';

interface PatientRow {
  id: string;
  patient_number: string;
  identity_status: string;
  last_name: string;
  first_name: string;
  sex: string;
  birth_date: string;
  birth_date_estimated: boolean;
  birth_place: string | null;
  nationality: string | null;
  marital_status: string | null;
  occupation: string | null;
  phone: string | null;
  email: string | null;
  address_line: string | null;
  address_quarter: string | null;
  address_city: string | null;
  address_region: string | null;
  address_country: string | null;
  document_type: string | null;
  document_number: string | null;
  kin_name: string | null;
  kin_relationship: string | null;
  kin_phone: string | null;
  date_of_death: string | null;
}

// Dates lues en texte (`::text`) : le pilote ne les convertit pas en `Date`, et `Temporal.PlainDate` les analyse telles quelles.
const COLUMNS = `id, patient_number, identity_status, last_name, first_name, sex, birth_date::text AS birth_date, birth_date_estimated, birth_place, nationality,
  marital_status, occupation, phone, email, address_line, address_quarter, address_city, address_region, address_country, document_type, document_number,
  kin_name, kin_relationship, kin_phone, date_of_death::text AS date_of_death`;

/** Reconstitue le patient ; une ligne qui ne passe pas la validation est une corruption de la base, jamais une saisie. */
function toPatient(row: PatientRow): Patient {
  const corrupted = (): never => {
    throw new Error(`Dossier patient corrompu en base : ${row.id}`);
  };
  const need = <T>(r: { ok: true; value: T } | { ok: false }): T => (r.ok ? r.value : corrupted());
  const maybe = <T>(raw: string | null, parse: (v: string) => { ok: true; value: T } | { ok: false }): T | null => (raw === null ? null : need(parse(raw)));

  const address = need(Address.create({ line: row.address_line, quarter: row.address_quarter, city: row.address_city, region: row.address_region, country: row.address_country }));
  return Patient.restore({
    id: need(PatientId.create(row.id)),
    number: need(PatientNumber.create(row.patient_number)),
    identityStatus: need(parseEnum(IdentityStatus, row.identity_status, 'identityStatus')),
    lastName: need(PersonName.create(row.last_name, 'lastName')),
    firstName: need(PersonName.create(row.first_name, 'firstName')),
    sex: need(parseEnum(Sex, row.sex, 'sex')),
    birthDate: Temporal.PlainDate.from(row.birth_date),
    birthDateEstimated: row.birth_date_estimated,
    birthPlace: maybe(row.birth_place, (v) => ShortText.create(v, 'birthPlace', 100)),
    nationality: maybe(row.nationality, (v) => CountryCode.create(v, 'nationality')),
    maritalStatus: maybe(row.marital_status, (v) => parseEnum(MaritalStatus, v, 'maritalStatus')),
    occupation: maybe(row.occupation, (v) => ShortText.create(v, 'occupation', 100)),
    phone: maybe(row.phone, (v) => PhoneNumber.create(v)),
    email: maybe(row.email, ContactEmail.create),
    address,
    identityDocument: row.document_type === null || row.document_number === null ? null : need(IdentityDocument.create(row.document_type, row.document_number)),
    nextOfKin:
      row.kin_name === null || row.kin_relationship === null || row.kin_phone === null
        ? null
        : need(NextOfKin.create({ name: row.kin_name, relationship: row.kin_relationship, phone: row.kin_phone })),
    dateOfDeath: row.date_of_death === null ? null : Temporal.PlainDate.from(row.date_of_death),
  });
}

export class PgPatientRepository implements PatientRepository {
  constructor(private readonly sql: SqlExecutor) {}

  async nextNumber(): Promise<PatientNumber> {
    const rows = await this.sql.query<{ n: string }>("SELECT nextval('patients_number_seq')::text AS n");
    const number = PatientNumber.fromSequence(Number(rows[0].n));
    if (!number.ok) throw new Error(number.error.message);
    return number.value;
  }

  async findById(id: PatientId): Promise<Patient | null> {
    const rows = await this.sql.query<PatientRow>(`SELECT ${COLUMNS} FROM patients WHERE id = $1`, [id.value]);
    return rows[0] ? toPatient(rows[0]) : null;
  }

  async save(patient: Patient, revision: RevisionInfo): Promise<void> {
    const s = patient.state;
    const a = s.address;
    await this.sql.transaction(async (tx) => {
      // Le numéro de dossier n'est jamais mis à jour : il identifie le patient dans tous les documents qui le citent.
      await tx.query(
        `INSERT INTO patients (id, patient_number, identity_status, last_name, first_name, name_key, sex, birth_date, birth_date_estimated, birth_place, nationality,
           marital_status, occupation, phone, phone_digits, email, address_line, address_quarter, address_city, address_region, address_country,
           document_type, document_number, kin_name, kin_relationship, kin_phone, date_of_death)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8::date,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27::date)
         ON CONFLICT (id) DO UPDATE SET identity_status = EXCLUDED.identity_status, last_name = EXCLUDED.last_name, first_name = EXCLUDED.first_name,
           name_key = EXCLUDED.name_key, sex = EXCLUDED.sex, birth_date = EXCLUDED.birth_date, birth_date_estimated = EXCLUDED.birth_date_estimated,
           birth_place = EXCLUDED.birth_place, nationality = EXCLUDED.nationality, marital_status = EXCLUDED.marital_status, occupation = EXCLUDED.occupation,
           phone = EXCLUDED.phone, phone_digits = EXCLUDED.phone_digits, email = EXCLUDED.email, address_line = EXCLUDED.address_line,
           address_quarter = EXCLUDED.address_quarter, address_city = EXCLUDED.address_city, address_region = EXCLUDED.address_region,
           address_country = EXCLUDED.address_country, document_type = EXCLUDED.document_type, document_number = EXCLUDED.document_number,
           kin_name = EXCLUDED.kin_name, kin_relationship = EXCLUDED.kin_relationship, kin_phone = EXCLUDED.kin_phone, date_of_death = EXCLUDED.date_of_death,
           updated_at = now()`,
        [
          s.id.value, s.number.value, s.identityStatus, s.lastName.value, s.firstName.value, patient.nameKey, s.sex, s.birthDate.toString(), s.birthDateEstimated,
          s.birthPlace?.value ?? null, s.nationality?.value ?? null, s.maritalStatus, s.occupation?.value ?? null, s.phone?.value ?? null, s.phone?.digits ?? null,
          s.email?.value ?? null, a?.line?.value ?? null, a?.quarter?.value ?? null, a?.city?.value ?? null, a?.region?.value ?? null, a?.country?.value ?? null,
          s.identityDocument?.type ?? null, s.identityDocument?.number ?? null, s.nextOfKin?.name.value ?? null, s.nextOfKin?.relationship ?? null,
          s.nextOfKin?.phone.value ?? null, s.dateOfDeath?.toString() ?? null,
        ],
      );
      // Le verrou de ligne pris par l'écriture ci-dessus sérialise les corrections concurrentes du même dossier : numéros de version sans doublon.
      await tx.query(
        `INSERT INTO patients_revisions (patient_id, revision, changed_at, changed_by, reason, changed_fields, snapshot)
         SELECT $1::uuid, COALESCE(MAX(revision), 0) + 1, $2::timestamptz, $3::text, $4::text, $5::text[], $6::jsonb FROM patients_revisions WHERE patient_id = $1::uuid`,
        [s.id.value, revision.at.toString(), revision.actorId, revision.reason, revision.changedFields, JSON.stringify(snapshotOf(s))],
      );
    });
  }

  async findDuplicates(key: DuplicateKey): Promise<DuplicateMatch[]> {
    const rows = await this.sql.query<PatientRow & { doc_match: boolean; name_match: boolean; phone_match: boolean }>(
      `SELECT ${COLUMNS},
         COALESCE(document_type = $1::text AND document_number = $2::text, false) AS doc_match,
         (name_key = $3 AND birth_date = $4::date) AS name_match,
         COALESCE(right(phone_digits, 8) = $5::text AND birth_date = $4::date, false) AS phone_match
       FROM patients
       WHERE ($6::uuid IS NULL OR id <> $6::uuid)
         AND (COALESCE(document_type = $1::text AND document_number = $2::text, false)
              OR (name_key = $3 AND birth_date = $4::date)
              OR COALESCE(right(phone_digits, 8) = $5::text AND birth_date = $4::date, false))
       ORDER BY patient_number`,
      [key.identityDocument?.type ?? null, key.identityDocument?.number ?? null, key.nameKey, key.birthDate.toString(), key.phone?.matchKey ?? null, key.excludeId?.value ?? null],
    );
    return rows.map((r) => {
      const reasons: DuplicateReason[] = [];
      if (r.doc_match) reasons.push('IDENTITY_DOCUMENT');
      if (r.name_match) reasons.push('NAME_AND_BIRTH_DATE');
      if (r.phone_match) reasons.push('PHONE_AND_BIRTH_DATE');
      return { patient: toPatient(r), reasons };
    });
  }

  async search(criteria: PatientSearch, offset: number, limit: number): Promise<{ items: Patient[]; total: number }> {
    const where: string[] = [];
    const args: unknown[] = [];
    const arg = (v: unknown) => (args.push(v), `$${args.length}`);
    if (criteria.number) where.push(`patient_number = ${arg(criteria.number.value)}`);
    // `position` plutôt que `LIKE` : les mots cherchés sont pris tels quels, sans caractères joker à échapper.
    for (const token of criteria.nameTokens ?? []) where.push(`position(${arg(token)} in name_key) > 0`);
    if (criteria.birthDate) where.push(`birth_date = ${arg(criteria.birthDate.toString())}::date`);
    if (criteria.phone) where.push(`right(phone_digits, 8) = ${arg(criteria.phone.matchKey)}`);
    if (criteria.identityNumber) where.push(`document_number = ${arg(criteria.identityNumber)}`);
    if (criteria.status) where.push(criteria.status === 'DECEASED' ? 'date_of_death IS NOT NULL' : 'date_of_death IS NULL');
    const condition = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const rows = await this.sql.query<PatientRow>(
      `SELECT ${COLUMNS} FROM patients ${condition} ORDER BY lower(last_name), lower(first_name), patient_number OFFSET ${arg(offset)} LIMIT ${arg(limit)}`,
      args,
    );
    const total = await this.sql.query<{ n: number }>(`SELECT count(*)::int AS n FROM patients ${condition}`, args.slice(0, args.length - 2));
    return { items: rows.map(toPatient), total: total[0]?.n ?? 0 };
  }

  async history(id: PatientId): Promise<PatientRevision[]> {
    const rows = await this.sql.query<{ revision: number; changed_at: Date; changed_by: string; reason: string | null; changed_fields: string[]; snapshot: PatientSnapshot }>(
      'SELECT revision, changed_at, changed_by, reason, changed_fields, snapshot FROM patients_revisions WHERE patient_id = $1 ORDER BY revision DESC',
      [id.value],
    );
    return rows.map((r) => ({
      revision: r.revision, changedAt: requiredInstantFromDb(r.changed_at), changedBy: r.changed_by, reason: r.reason, changedFields: r.changed_fields, snapshot: r.snapshot,
    }));
  }
}
