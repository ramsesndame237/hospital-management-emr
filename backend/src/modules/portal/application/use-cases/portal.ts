import { AuditLog } from '../../../audit/domain/audit-log.port';
import { Clock } from '../../../../shared-kernel/ports';
import { DomainError, err, ok, Result } from '../../../../shared-kernel/result';
import {
  PortalAccountRepository, PortalAppointments, PortalInvoices, PortalPatient, PortalPatients, PortalPrescriptions, PortalResults, PortalUsers,
} from '../../domain/ports';

export interface PortalDependencies {
  readonly accounts: PortalAccountRepository;
  readonly patients: PortalPatients;
  readonly users: PortalUsers;
  readonly appointments: PortalAppointments;
  readonly results: PortalResults;
  readonly prescriptions: PortalPrescriptions;
  readonly invoices: PortalInvoices;
  readonly audit: AuditLog;
  readonly clock: Clock;
}

const NOT_LINKED = new DomainError('PORTAL_NOT_LINKED', 'Votre compte n’est relié à aucun dossier patient : rendez-vous à l’accueil pour le faire relier.');
const LIMIT = 30;

export interface AccountView {
  readonly username: string | null;
  readonly linkedAt: string;
}

/**
 * Le portail du patient : il ne lit que les données du dossier auquel SON compte est relié (le lien vient de l'accueil, jamais d'un paramètre de la requête :
 * un patient ne peut pas demander le dossier d'un autre). Chaque lecture est inscrite au journal (section lue, pas le contenu).
 */
export class PortalReadUseCases {
  constructor(private readonly d: PortalDependencies) {}

  private async patientOf(userId: string): Promise<Result<string>> {
    const account = await this.d.accounts.findByUser(userId);
    return account ? ok(account.patientId) : err(NOT_LINKED);
  }

  private audit(userId: string, patientId: string, section: string, returned?: number): Promise<void> {
    return this.d.audit.record({
      action: 'portal.read', outcome: 'SUCCESS', actorId: userId, resourceType: 'portal-account', resourceId: userId,
      metadata: { section, patientId, ...(returned === undefined ? {} : { returned }) }, occurredAt: this.d.clock.now(),
    });
  }

  async me(userId: string): Promise<Result<PortalPatient>> {
    const patientId = await this.patientOf(userId);
    if (!patientId.ok) return err(patientId.error);
    const patient = await this.d.patients.find(patientId.value);
    if (!patient) return err(NOT_LINKED);
    await this.audit(userId, patientId.value, 'me');
    return ok(patient);
  }

  private async section<T>(userId: string, name: string, read: (patientId: string) => Promise<T[]>): Promise<Result<T[]>> {
    const patientId = await this.patientOf(userId);
    if (!patientId.ok) return err(patientId.error);
    const items = await read(patientId.value);
    await this.audit(userId, patientId.value, name, items.length);
    return ok(items);
  }

  appointments(userId: string) {
    return this.section(userId, 'appointments', (p) => this.d.appointments.listOf(p, LIMIT));
  }

  results(userId: string) {
    return this.section(userId, 'results', (p) => this.d.results.listOf(p, LIMIT));
  }

  prescriptions(userId: string) {
    return this.section(userId, 'prescriptions', (p) => this.d.prescriptions.listOf(p, LIMIT));
  }

  invoices(userId: string) {
    return this.section(userId, 'invoices', (p) => this.d.invoices.listOf(p, LIMIT));
  }
}

/** L'accueil relie un compte patient à un dossier ; un lien ne se modifie pas. */
export class PortalAccountUseCases {
  constructor(private readonly d: PortalDependencies) {}

  async link(actorId: string, input: { username: string; patientId: string }): Promise<Result<AccountView>> {
    const patient = await this.d.patients.find((input.patientId ?? '').trim().toLowerCase());
    if (!patient) return err(new DomainError('PORTAL_PATIENT_NOT_FOUND', 'Patient introuvable.'));
    const user = await this.d.users.findByUsername((input.username ?? '').trim());
    if (!user) return err(new DomainError('PORTAL_USER_NOT_FOUND', 'Compte introuvable.'));
    if (!user.roles.includes('PATIENT')) return err(new DomainError('PORTAL_USER_NOT_PATIENT', 'Ce compte n’a pas le rôle Patient : seul un compte patient se relie à un dossier.'));
    if (!user.active) return err(new DomainError('PORTAL_USER_INACTIVE', 'Ce compte est désactivé.'));
    const at = this.d.clock.now();
    const inserted = await this.d.accounts.insert({ userId: user.id, patientId: patient.id, linkedBy: actorId, linkedAt: at });
    if (!inserted) return err(new DomainError('PORTAL_ALREADY_LINKED', 'Ce compte, ou ce dossier, est déjà relié : un lien ne se modifie pas.'));
    await this.d.audit.record({
      action: 'portal.account.link', outcome: 'SUCCESS', actorId, resourceType: 'portal-account', resourceId: user.id, metadata: { patientId: patient.id }, occurredAt: at,
    });
    return ok({ username: user.username, linkedAt: at.toString() });
  }

  /** Le compte du portail d'un patient, s'il en a un. */
  async ofPatient(patientId: string): Promise<Result<AccountView>> {
    const account = await this.d.accounts.findByPatient((patientId ?? '').trim().toLowerCase());
    if (!account) return err(new DomainError('PORTAL_ACCOUNT_NOT_FOUND', 'Ce patient n’a pas de compte de portail.'));
    const user = (await this.d.users.find([account.userId])).get(account.userId);
    return ok({ username: user?.username ?? null, linkedAt: account.linkedAt.toString() });
  }
}
