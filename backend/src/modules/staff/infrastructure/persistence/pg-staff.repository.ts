import { SqlExecutor } from '../../../../database/sql-executor';
import { Temporal } from '../../../../shared-kernel/temporal';
import { StaffFilter, StaffRepository } from '../../domain/ports';
import { StaffMember } from '../../domain/staff-member';
import { ContactEmail, PersonName, PhoneNumber, ReferenceCode, StaffId, StaffNumber, UserRef } from '../../domain/values';

interface StaffRow {
  id: string;
  staff_number: string;
  first_name: string;
  last_name: string;
  profession_code: string;
  specialty_code: string | null;
  email: string | null;
  phone: string | null;
  hired_on: string | null;
  departed_on: string | null;
  user_id: string | null;
}

// Les dates sont lues en texte (`::text`) : le pilote ne les convertit pas en `Date`, et `Temporal.PlainDate` les analyse telles quelles.
const COLUMNS = 'id, staff_number, first_name, last_name, profession_code, specialty_code, email, phone, hired_on::text AS hired_on, departed_on::text AS departed_on, user_id';

function toStaff(row: StaffRow): StaffMember {
  const corrupted = () => new Error(`Fiche du personnel corrompue en base : ${row.id}`);
  const id = StaffId.create(row.id);
  const staffNumber = StaffNumber.create(row.staff_number);
  const firstName = PersonName.create(row.first_name, 'firstName');
  const lastName = PersonName.create(row.last_name, 'lastName');
  const profession = ReferenceCode.create(row.profession_code, 'STAFF_PROFESSION_UNKNOWN');
  const specialty = row.specialty_code === null ? null : ReferenceCode.create(row.specialty_code, 'STAFF_SPECIALTY_UNKNOWN');
  const email = row.email === null ? null : ContactEmail.create(row.email);
  const phone = row.phone === null ? null : PhoneNumber.create(row.phone);
  const userId = row.user_id === null ? null : UserRef.create(row.user_id);
  if (!id.ok || !staffNumber.ok || !firstName.ok || !lastName.ok || !profession.ok || (specialty && !specialty.ok) || (email && !email.ok) || (phone && !phone.ok) || (userId && !userId.ok)) {
    throw corrupted();
  }
  return StaffMember.restore({
    id: id.value, staffNumber: staffNumber.value, firstName: firstName.value, lastName: lastName.value, professionCode: profession.value,
    specialtyCode: specialty && specialty.ok ? specialty.value : null,
    email: email && email.ok ? email.value : null,
    phone: phone && phone.ok ? phone.value : null,
    hiredOn: row.hired_on === null ? null : Temporal.PlainDate.from(row.hired_on),
    departedOn: row.departed_on === null ? null : Temporal.PlainDate.from(row.departed_on),
    userId: userId && userId.ok ? userId.value : null,
  });
}

const params = (s: StaffMember) => [
  s.id.value, s.staffNumber.value, s.firstName.value, s.lastName.value, s.professionCode.value, s.specialtyCode?.value ?? null,
  s.email?.value ?? null, s.phone?.value ?? null, s.hiredOn?.toString() ?? null, s.departedOn?.toString() ?? null, s.userId?.value ?? null,
];

const UPSERT = `INSERT INTO staff_members (id, staff_number, first_name, last_name, profession_code, specialty_code, email, phone, hired_on, departed_on, user_id)
  VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::date, $10::date, $11)
  ON CONFLICT (id) DO UPDATE SET first_name = EXCLUDED.first_name, last_name = EXCLUDED.last_name, profession_code = EXCLUDED.profession_code,
    specialty_code = EXCLUDED.specialty_code, email = EXCLUDED.email, phone = EXCLUDED.phone, hired_on = EXCLUDED.hired_on,
    departed_on = EXCLUDED.departed_on, user_id = EXCLUDED.user_id, updated_at = now()`;

export class PgStaffRepository implements StaffRepository {
  constructor(private readonly sql: SqlExecutor) {}

  async findById(id: StaffId): Promise<StaffMember | null> {
    const rows = await this.sql.query<StaffRow>(`SELECT ${COLUMNS} FROM staff_members WHERE id = $1`, [id.value]);
    return rows[0] ? toStaff(rows[0]) : null;
  }

  async findByNumber(number: StaffNumber): Promise<StaffMember | null> {
    const rows = await this.sql.query<StaffRow>(`SELECT ${COLUMNS} FROM staff_members WHERE staff_number = $1`, [number.value]);
    return rows[0] ? toStaff(rows[0]) : null;
  }

  async findByUserId(userId: UserRef): Promise<StaffMember | null> {
    const rows = await this.sql.query<StaffRow>(`SELECT ${COLUMNS} FROM staff_members WHERE user_id = $1`, [userId.value]);
    return rows[0] ? toStaff(rows[0]) : null;
  }

  async save(staff: StaffMember): Promise<void> {
    // Le matricule n'est jamais mis à jour : il identifie la personne dans les documents qui le citent.
    await this.sql.query(UPSERT, params(staff));
  }

  async saveDeparture(staff: StaffMember): Promise<void> {
    if (!staff.departedOn) throw new Error('saveDeparture : aucune date de départ');
    const departedOn = staff.departedOn.toString();
    await this.sql.transaction(async (tx) => {
      await tx.query(UPSERT, params(staff));
      await tx.query(
        'UPDATE staff_assignments SET end_date = $2::date, updated_at = now() WHERE staff_id = $1 AND (end_date IS NULL OR end_date > $2::date)',
        [staff.id.value, departedOn],
      );
    });
  }

  async list(filter: StaffFilter, offset: number, limit: number): Promise<{ items: StaffMember[]; total: number }> {
    const where: string[] = [];
    const args: unknown[] = [];
    const arg = (v: unknown) => (args.push(v), `$${args.length}`);
    if (filter.search) {
      // `position` plutôt que `LIKE` : le texte cherché est pris tel quel, sans caractères joker à échapper.
      where.push(`position(lower(${arg(filter.search)}) in lower(staff_number || ' ' || first_name || ' ' || last_name || ' ' || coalesce(email, ''))) > 0`);
    }
    if (filter.professionCode) where.push(`profession_code = ${arg(filter.professionCode)}`);
    if (filter.status) {
      const today = arg(filter.today.toString());
      where.push(filter.status === 'DEPARTED' ? `departed_on <= ${today}::date` : `(departed_on IS NULL OR departed_on > ${today}::date)`);
    }
    const condition = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const rows = await this.sql.query<StaffRow>(
      `SELECT ${COLUMNS} FROM staff_members ${condition} ORDER BY lower(last_name), lower(first_name), staff_number OFFSET ${arg(offset)} LIMIT ${arg(limit)}`,
      args,
    );
    const total = await this.sql.query<{ n: number }>(`SELECT count(*)::int AS n FROM staff_members ${condition}`, args.slice(0, args.length - 2));
    return { items: rows.map(toStaff), total: total[0]?.n ?? 0 };
  }
}
