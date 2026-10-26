import fs from 'node:fs';
import path from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { PgRoleRepository } from '../../src/modules/iam/infrastructure/persistence/pg-role.repository';
import { Patient } from '../../src/modules/patients/domain/patient';
import { parsePatientInput } from '../../src/modules/patients/domain/patient-input';
import { IdentityStatus, PatientId, PatientNumber, PhoneNumber, Sex } from '../../src/modules/patients/domain/values';
import { PgPatientRepository } from '../../src/modules/patients/infrastructure/persistence/pg-patient.repository';
import { Temporal } from '../../src/shared-kernel/temporal';
import { must } from '../iam/fakes';
import { PgliteSql } from '../iam/pglite-sql';

const DDL = ['iam.pg.sql', 'patients.pg.sql'].map((f) => fs.readFileSync(path.join(__dirname, '../../migration/schema', f), 'utf8'));
const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const TODAY = Temporal.PlainDate.from('2026-10-23');
const NOW = Temporal.Instant.from('2026-10-23T10:00:00Z');
const rev = (reason: string | null = null, changedFields: string[] = ['registration']) => ({ actorId: 'actor-1', at: NOW, reason, changedFields });

type Input = Parameters<typeof parsePatientInput>[0];
const BASE: Input = { lastName: 'Mbarga', firstName: 'Élisabeth', sex: 'FEMALE', birthDate: '1990-03-14' };

/** Construit un patient valide à partir d'une saisie ; `n` fixe l'identifiant et le numéro. */
function patient(n: number, input: Input = {}): Patient {
  const c = must(parsePatientInput({ ...BASE, ...input }));
  return must(
    Patient.register(
      {
        id: must(PatientId.create(uuid(n))), number: must(PatientNumber.fromSequence(n)), identityStatus: c.identityStatus ?? IdentityStatus.CONFIRMED, lastName: c.lastName!, firstName: c.firstName!,
        sex: c.sex as Sex, birthDate: c.birthDate!, birthDateEstimated: c.birthDateEstimated ?? false, birthPlace: c.birthPlace ?? null, nationality: c.nationality ?? null,
        maritalStatus: c.maritalStatus ?? null, occupation: c.occupation ?? null, phone: c.phone ?? null, email: c.email ?? null, address: c.address ?? null,
        identityDocument: c.identityDocument ?? null, nextOfKin: c.nextOfKin ?? null,
      },
      TODAY,
    ),
  );
}

describe('schéma des patients sur PostgreSQL', () => {
  let db: PGlite;
  let sql: PgliteSql;
  let repo: PgPatientRepository;
  beforeEach(async () => {
    db = new PGlite();
    for (const ddl of DDL) await db.exec(ddl);
    sql = new PgliteSql(db);
    repo = new PgPatientRepository(sql);
  });
  afterEach(() => db.close());

  it('est idempotent : le rejouer ne casse rien, ne duplique pas les droits et garde la séquence', async () => {
    const first = await repo.nextNumber();
    await repo.save(patient(1), rev());
    for (const ddl of DDL) await db.exec(ddl);
    for (const ddl of DDL) await db.exec(ddl);
    expect(await repo.findById(must(PatientId.create(uuid(1))))).not.toBeNull();
    expect((await repo.nextNumber()).value).not.toBe(first.value);
    for (const r of await new PgRoleRepository(sql).findAll()) expect(new Set(r.permissions.map((p) => p.value)).size).toBe(r.permissions.length);
  });

  it("répartit les droits : lecture au personnel et aux contrôleurs, écriture à l'accueil et à l'administrateur, décès aux médecins, historique aux contrôleurs", async () => {
    const roles = new Map((await new PgRoleRepository(sql).findAll()).map((r) => [r.code.value, new Set(r.permissions.map((p) => p.value))]));
    const holders = (permission: string) => [...roles].filter(([, set]) => set.has(permission)).map(([code]) => code).sort();
    expect(holders('patients:read:all')).toEqual(['CASHIER', 'DOCTOR', 'DPO_AUDITOR', 'LAB_TECHNICIAN', 'NURSE', 'PHARMACIST', 'RADIOLOGIST', 'RECEPTIONIST', 'SYSTEM_ADMIN']);
    expect(holders('patients:write:all')).toEqual(['RECEPTIONIST', 'SYSTEM_ADMIN']);
    expect(holders('patients.death:record:all')).toEqual(['DOCTOR', 'SYSTEM_ADMIN']);
    expect(holders('patients.history:read:all')).toEqual(['DPO_AUDITOR', 'SYSTEM_ADMIN']);
    expect(roles.get('PATIENT')!.has('patients:read:all')).toBe(false);
  });

  describe('dossiers', () => {
    it('attribue des numéros croissants au format PAT-0000001, sans jamais en réutiliser', async () => {
      const numbers = [await repo.nextNumber(), await repo.nextNumber(), await repo.nextNumber()].map((n) => n.value);
      expect(numbers).toEqual(['PAT-0000001', 'PAT-0000002', 'PAT-0000003']);
    });

    it('conserve tous les champs (accents, dates sans décalage, blocs) et les relit à l\'identique', async () => {
      const p = patient(1, {
        lastName: 'Ngo-Bassa', firstName: 'Zoë Hélène', birthDate: '2000-02-29', birthDateEstimated: true, birthPlace: 'Douala', nationality: 'cm', maritalStatus: 'married', occupation: 'Enseignante',
        phone: '+237 655 00 00 00', email: 'ZOE@Example.org', address: { line: 'Rue de la Joie', quarter: 'Bastos', city: 'Yaoundé', region: 'Centre', country: 'cm' },
        identityDocument: { type: 'passport', number: 'ab 123456' }, nextOfKin: { name: 'Jeanne Ngo', relationship: 'spouse', phone: '+237 677 00 00 00' },
      });
      await repo.save(p, rev());
      const loaded = (await repo.findById(p.id))!;
      expect(loaded.state).toEqual(p.state);
      expect(loaded.state.birthDate.toString()).toBe('2000-02-29');
      expect(loaded.state.email?.value).toBe('zoe@example.org');
      expect(loaded.nameKey).toBe('bassa helene ngo zoe');
      expect(await repo.findById(must(PatientId.create(uuid(99))))).toBeNull();
    });

    it('met à jour sur place, garde le numéro et enregistre le décès', async () => {
      const p = patient(1);
      await repo.save(p, rev());
      p.apply(must(parsePatientInput({ lastName: 'Nkoa', occupation: 'Médecin' })), TODAY);
      p.recordDeath(Temporal.PlainDate.from('2026-10-01'), TODAY);
      await repo.save(p, rev('Constat', ['lastName', 'occupation', 'dateOfDeath']));
      const again = (await repo.findById(p.id))!;
      expect([again.number.value, again.state.lastName.value, again.state.occupation?.value, again.state.dateOfDeath?.toString()]).toEqual(['PAT-0000001', 'Nkoa', 'Médecin', '2026-10-01']);
      expect((await sql.query<{ n: number }>('SELECT count(*)::int AS n FROM patients'))[0].n).toBe(1);
    });

    it('refuse en base les valeurs incohérentes, même si l\'application est contournée', async () => {
      await repo.save(patient(1), rev());
      const insert = (over: Record<string, unknown>) => {
        const row = { id: uuid(50), patient_number: 'PAT-0000050', identity_status: 'CONFIRMED', last_name: 'A', first_name: 'B', name_key: 'a b', sex: 'MALE', birth_date: '1990-01-01', ...over };
        return sql.query(`INSERT INTO patients (${Object.keys(row).join(', ')}) VALUES (${Object.keys(row).map((_, i) => `$${i + 1}`).join(', ')})`, Object.values(row));
      };
      await expect(insert({})).resolves.toBeDefined(); // la ligne de référence est valide
      for (const [name, over] of Object.entries({
        'sexe inconnu': { sex: 'X', id: uuid(51), patient_number: 'PAT-0000051' },
        'naissance avant 1880': { birth_date: '1879-12-31', id: uuid(52), patient_number: 'PAT-0000052' },
        'statut inconnu': { identity_status: 'MAYBE', id: uuid(53), patient_number: 'PAT-0000053' },
        'numéro mal formé': { patient_number: 'P1', id: uuid(54) },
        'pièce sans numéro': { document_type: 'PASSPORT', id: uuid(55), patient_number: 'PAT-0000055' },
        'personne à prévenir incomplète': { kin_name: 'X', id: uuid(56), patient_number: 'PAT-0000056' },
        'décès avant naissance': { date_of_death: '1980-01-01', id: uuid(57), patient_number: 'PAT-0000057' },
        'pays invalide': { nationality: 'CMR', id: uuid(58), patient_number: 'PAT-0000058' },
        'nom vide': { last_name: ' ', id: uuid(59), patient_number: 'PAT-0000059' },
      })) {
        await expect(insert(over)).rejects.toThrow();
        expect(name).toBeTruthy();
      }
    });

    it('garantit un numéro de dossier et une pièce d\'identité uniques, et annule tout (dossier ET version) en cas d\'échec', async () => {
      const doc = { identityDocument: { type: 'NATIONAL_ID', number: '123456789' } };
      await repo.save(patient(1, doc), rev());
      await expect(repo.save(patient(2, { ...doc, lastName: 'Autre' }), rev())).rejects.toThrow();
      expect(await repo.findById(must(PatientId.create(uuid(2))))).toBeNull();
      expect((await sql.query<{ n: number }>('SELECT count(*)::int AS n FROM patients_revisions'))[0].n).toBe(1);
      const sameNumber = Patient.restore({ ...patient(3).state, number: must(PatientNumber.fromSequence(1)) });
      await expect(repo.save(sameNumber, rev())).rejects.toThrow();
    });
  });

  describe('historique', () => {
    it('archive une version par enregistrement, numérotée, avec auteur, motif, champs et état complet', async () => {
      const p = patient(1);
      await repo.save(p, rev());
      p.apply(must(parsePatientInput({ lastName: 'Nkoa' })), TODAY);
      await repo.save(p, { actorId: 'admin-2', at: Temporal.Instant.from('2026-10-24T08:00:00Z'), reason: 'Acte de naissance', changedFields: ['lastName'] });
      const history = await repo.history(p.id);
      expect(history.map((r) => r.revision)).toEqual([2, 1]);
      expect(history[0]).toMatchObject({ changedBy: 'admin-2', reason: 'Acte de naissance', changedFields: ['lastName'] });
      expect(history[0].changedAt.toString()).toBe('2026-10-24T08:00:00Z');
      expect(history[0].snapshot).toMatchObject({ lastName: 'Nkoa', firstName: 'Élisabeth', birthDate: '1990-03-14', address: null });
      expect(history[1]).toMatchObject({ changedBy: 'actor-1', reason: null, changedFields: ['registration'] });
      expect(history[1].snapshot).toMatchObject({ lastName: 'Mbarga' }); // l'ancien nom reste lisible
    });

    it('est en ajout seul : aucune version ne peut être modifiée, supprimée ni vidée', async () => {
      await repo.save(patient(1), rev());
      await expect(sql.query("UPDATE patients_revisions SET changed_by = 'x'")).rejects.toThrow(/ajout seul/);
      await expect(sql.query('DELETE FROM patients_revisions')).rejects.toThrow(/ajout seul/);
      await expect(sql.query('TRUNCATE patients_revisions')).rejects.toThrow(/ajout seul/);
    });

    it('numérote sans trou ni doublon, version par version', async () => {
      const p = patient(1);
      await repo.save(p, rev());
      for (const reason of ['a', 'b', 'c']) await repo.save(p, rev(reason, ['x']));
      expect((await repo.history(p.id)).map((r) => r.revision)).toEqual([4, 3, 2, 1]);
    });
  });

  describe('doublons', () => {
    const key = (n: number, input: Input, excludeSelf = false) => {
      const p = patient(n, input);
      return { excludeId: excludeSelf ? p.id : undefined, nameKey: p.nameKey, birthDate: p.state.birthDate, phone: p.state.phone, identityDocument: p.state.identityDocument };
    };

    beforeEach(async () => {
      await repo.save(patient(1, { phone: '+237 655 00 00 00', identityDocument: { type: 'NATIONAL_ID', number: '123456789' } }), rev());
    });

    it('rapproche par nom et naissance, quels que soient l\'ordre, les accents et la casse', async () => {
      const matches = await repo.findDuplicates(key(2, { lastName: 'ÉLISABETH', firstName: 'mbarga' }));
      expect(matches.map((m) => [m.patient.number.value, m.reasons])).toEqual([['PAT-0000001', ['NAME_AND_BIRTH_DATE']]]);
    });

    it('rapproche par téléphone (avec ou sans indicatif) et naissance, ou par pièce d\'identité', async () => {
      expect((await repo.findDuplicates(key(2, { lastName: 'Autre', firstName: 'Nom', phone: '655-00-00-00' }))).map((m) => m.reasons)).toEqual([['PHONE_AND_BIRTH_DATE']]);
      expect((await repo.findDuplicates(key(2, { lastName: 'Autre', firstName: 'Nom', birthDate: '1970-01-01', identityDocument: { type: 'national_id', number: '123 456 789' } }))).map((m) => m.reasons)).toEqual([['IDENTITY_DOCUMENT']]);
      const all = await repo.findDuplicates(key(2, { phone: '+237 655 00 00 00', identityDocument: { type: 'NATIONAL_ID', number: '123456789' } }));
      expect(all[0].reasons).toEqual(['IDENTITY_DOCUMENT', 'NAME_AND_BIRTH_DATE', 'PHONE_AND_BIRTH_DATE']);
    });

    it('ne signale pas deux personnes simplement homonymes, ou de même téléphone mais de naissances différentes', async () => {
      expect(await repo.findDuplicates(key(2, { birthDate: '1991-03-14' }))).toEqual([]);
      expect(await repo.findDuplicates(key(2, { lastName: 'Autre', firstName: 'Nom', phone: '+237 655 00 00 00', birthDate: '1980-01-01' }))).toEqual([]);
      expect(await repo.findDuplicates(key(2, { lastName: 'Autre', firstName: 'Nom', identityDocument: { type: 'PASSPORT', number: '123456789' } }))).toEqual([]); // autre type de pièce
    });

    it('ignore le dossier que l\'on corrige', async () => {
      expect(await repo.findDuplicates(key(1, {}, true))).toEqual([]);
    });
  });

  describe('recherche', () => {
    beforeEach(async () => {
      await repo.save(patient(1, { lastName: 'Zola', firstName: 'Anne', phone: '+237 655 00 00 00', identityDocument: { type: 'PASSPORT', number: 'AB123456' } }), rev());
      await repo.save(patient(2, { lastName: 'abel', firstName: 'Paul Marie', sex: 'MALE', birthDate: '1975-06-01' }), rev());
      const gone = patient(3, { lastName: 'Moreau', firstName: 'Léa', birthDate: '1950-01-01' });
      gone.recordDeath(Temporal.PlainDate.from('2026-01-31'), TODAY);
      await repo.save(gone, rev('Décès', ['dateOfDeath']));
    });
    const names = async (criteria: Parameters<PgPatientRepository['search']>[0], offset = 0, limit = 50) => (await repo.search(criteria, offset, limit)).items.map((p) => p.state.lastName.value);

    it('trie par nom sans tenir compte de la casse, et pagine avec le total', async () => {
      expect(await names({ nameTokens: [] })).toEqual(['abel', 'Moreau', 'Zola']);
      expect(await names({ nameTokens: [] }, 1, 1)).toEqual(['Moreau']);
      expect((await repo.search({ nameTokens: [] }, 0, 1)).total).toBe(3);
    });

    it('cherche par mots du nom (sans accents ni ordre), numéro, naissance, téléphone et pièce', async () => {
      expect(await names({ nameTokens: ['marie', 'abel'] })).toEqual(['abel']);
      expect(await names({ nameTokens: ['lea'] })).toEqual(['Moreau']);
      expect(await names({ nameTokens: ['ol'] })).toEqual(['Zola']); // fragment de mot
      expect(await names({ number: must(PatientNumber.fromSequence(2)) })).toEqual(['abel']);
      expect(await names({ birthDate: Temporal.PlainDate.from('1975-06-01') })).toEqual(['abel']);
      expect(await names({ phone: must(PhoneNumber.create('655 00 00 00')) })).toEqual(['Zola']);
      expect(await names({ identityNumber: 'AB123456' })).toEqual(['Zola']);
      expect(await names({ nameTokens: ['zzz'] })).toEqual([]);
    });

    it('cumule les critères et filtre par situation', async () => {
      expect(await names({ nameTokens: ['a'], birthDate: Temporal.PlainDate.from('1990-03-14') })).toEqual(['Zola']);
      expect(await names({ nameTokens: [], status: 'DECEASED' })).toEqual(['Moreau']);
      expect(await names({ nameTokens: [], status: 'ACTIVE' })).toEqual(['abel', 'Zola']);
    });

    it('traite les mots cherchés littéralement (aucun caractère joker)', async () => {
      expect(await names({ nameTokens: ['%'] })).toEqual([]);
      expect(await names({ nameTokens: ['_'] })).toEqual([]);
    });
  });
});
