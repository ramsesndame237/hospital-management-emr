import { AuditLog } from '../../../audit/domain/audit-log.port';
import { Clock, IdGenerator } from '../../../../shared-kernel/ports';
import { DomainError, err, ok, Result } from '../../../../shared-kernel/result';
import { Claim, ClaimFilter, CoverageRepository, Payer, PatientCoverage, PayerRepository } from '../../domain/payer';
import { Invoice } from '../../domain/invoice';
import { InvoiceRepository, PatientDirectory } from '../../domain/ports';
import { InvoiceId, PatientRef } from '../../domain/values';
import { InvoiceDependencies, InvoiceView, record, toView } from './invoices';

const PAYER_NOT_FOUND = new DomainError('BILLING_PAYER_NOT_FOUND', 'Assureur introuvable.');
const PAYER_INACTIVE = new DomainError('BILLING_PAYER_INACTIVE', 'Cet assureur est désactivé : on ne peut plus lui rattacher de couverture.');
const PAYER_CODE_TAKEN = new DomainError('BILLING_PAYER_CODE_ALREADY_EXISTS', 'Un assureur utilise déjà ce code.');
const PAYER_CODE_INVALID = new DomainError('BILLING_PAYER_CODE_INVALID', 'Le code est invalide (lettres, chiffres, « _ », « - », « . », 20 caractères au plus).');
const PAYER_NAME_INVALID = new DomainError('BILLING_PAYER_NAME_INVALID', 'Le nom de l’assureur doit contenir entre 1 et 120 caractères.');
const COVERAGE_NOT_FOUND = new DomainError('BILLING_COVERAGE_NOT_FOUND', 'Couverture introuvable.');
const COVERAGE_POLICY_INVALID = new DomainError('BILLING_COVERAGE_POLICY_INVALID', 'Le numéro d’assuré doit contenir entre 1 et 40 caractères.');
const COVERAGE_PERCENT_INVALID = new DomainError('BILLING_COVERAGE_PERCENT_INVALID', 'Le pourcentage pris en charge doit être un entier de 1 à 100.');
const COVERAGE_DATE_INVALID = new DomainError('BILLING_COVERAGE_DATE_INVALID', 'Les dates de validité doivent être au format AAAA-MM-JJ, la fin n’étant pas avant le début.');
const COVERAGE_EXPIRED = new DomainError('BILLING_COVERAGE_NOT_VALID', 'Cette couverture n’est pas valable aujourd’hui (désactivée, pas encore commencée ou expirée).');
const COVERAGE_PATIENT_MISMATCH = new DomainError('BILLING_COVERAGE_PATIENT_MISMATCH', 'Cette couverture concerne un autre patient.');
const PATIENT_NOT_FOUND = new DomainError('BILLING_PATIENT_NOT_FOUND', 'Patient introuvable.');
const INVOICE_NOT_FOUND = new DomainError('BILLING_INVOICE_NOT_FOUND', 'Facture introuvable.');
const CHANGED = new DomainError('BILLING_INVOICE_CHANGED', "Cette facture vient d'être modifiée par quelqu'un d'autre : rechargez-la puis recommencez.");
const REFERENCE_INVALID = new DomainError('BILLING_SETTLEMENT_REFERENCE_INVALID', 'La référence du règlement (virement, bordereau) doit contenir entre 1 et 60 caractères.');

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const validDay = (raw: string): boolean => {
  if (!DAY.test(raw)) return false;
  const d = new Date(`${raw}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === raw;
};

export interface PayerView {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly active: boolean;
}

export interface CoverageView {
  readonly id: string;
  readonly patientId: string;
  readonly payer: { readonly id: string; readonly code: string; readonly name: string } | null;
  readonly policyNumber: string;
  readonly percent: number;
  readonly validFrom: string;
  readonly validUntil: string | null;
  /** Valable aujourd'hui : active, commencée, pas expirée. */
  readonly validToday: boolean;
}

export interface ClaimView extends Claim {
  readonly patient: { readonly id: string; readonly number: string; readonly lastName: string; readonly firstName: string } | null;
}

export interface PayerDependencies {
  readonly payers: PayerRepository;
  readonly coverages: CoverageRepository;
  readonly invoices: InvoiceRepository;
  readonly patients: PatientDirectory;
  readonly audit: AuditLog;
  readonly clock: Clock;
}

const payerView = (p: Payer): PayerView => ({ id: p.id, code: p.code, name: p.name, active: p.active });
const today = (clock: Clock): string => clock.now().toString().slice(0, 10);
const validToday = (c: PatientCoverage, day: string): boolean => c.active && c.validFrom <= day && (c.validUntil === null || c.validUntil >= day);

function recordPayer(d: PayerDependencies, actorId: string, action: string, payer: Payer, extra: Record<string, string | number | boolean | null> = {}): Promise<void> {
  return d.audit.record({ action, outcome: 'SUCCESS', actorId, resourceType: 'billing-payer', resourceId: payer.id, metadata: { code: payer.code, ...extra }, occurredAt: d.clock.now() });
}

/** Liste des assureurs : création, changement de nom, retrait et réactivation. Le code ne change jamais (les couvertures et les factures y renvoient). */
export class PayerUseCases {
  constructor(private readonly d: PayerDependencies, private readonly ids: IdGenerator) {}

  async create(actorId: string, input: { code: string; name: string }): Promise<Result<PayerView>> {
    const code = String(input.code ?? '').trim().toUpperCase();
    if (!/^[A-Z0-9][A-Z0-9_.-]{0,19}$/.test(code)) return err(PAYER_CODE_INVALID);
    const name = String(input.name ?? '').trim().replace(/\s+/g, ' ');
    if (name.length < 1 || name.length > 120) return err(PAYER_NAME_INVALID);
    const payer: Payer = { id: this.ids.next(), code, name, active: true };
    if (!(await this.d.payers.insert(payer))) return err(PAYER_CODE_TAKEN);
    await recordPayer(this.d, actorId, 'billing.payer.create', payer);
    return ok(payerView(payer));
  }

  async update(actorId: string, id: string, input: { name?: string }): Promise<Result<PayerView>> {
    const found = await this.d.payers.findById((id ?? '').trim().toLowerCase());
    if (!found) return err(PAYER_NOT_FOUND);
    if (input.name === undefined) return ok(payerView(found));
    const name = String(input.name).trim().replace(/\s+/g, ' ');
    if (name.length < 1 || name.length > 120) return err(PAYER_NAME_INVALID);
    if (name === found.name) return ok(payerView(found));
    const next = { ...found, name };
    await this.d.payers.update(next);
    await recordPayer(this.d, actorId, 'billing.payer.update', next);
    return ok(payerView(next));
  }

  async setActive(actorId: string, id: string, active: boolean): Promise<Result<PayerView>> {
    const found = await this.d.payers.findById((id ?? '').trim().toLowerCase());
    if (!found) return err(PAYER_NOT_FOUND);
    if (found.active === active) return ok(payerView(found));
    const next = { ...found, active };
    await this.d.payers.update(next);
    await recordPayer(this.d, actorId, active ? 'billing.payer.activate' : 'billing.payer.deactivate', next);
    return ok(payerView(next));
  }

  async list(input: { search?: string; includeInactive: boolean; offset: number; limit: number }): Promise<{ items: PayerView[]; total: number; offset: number; limit: number }> {
    const offset = Math.max(0, Math.trunc(input.offset));
    const limit = Math.min(200, Math.max(1, Math.trunc(input.limit)));
    const page = await this.d.payers.list({ search: input.search?.trim() || undefined, includeInactive: input.includeInactive }, offset, limit);
    return { items: page.items.map(payerView), total: page.total, offset, limit };
  }
}

/** Couvertures d'un patient : l'assureur, son numéro d'assuré, le pourcentage pris en charge et la période de validité. */
export class CoverageUseCases {
  constructor(private readonly d: PayerDependencies, private readonly ids: IdGenerator) {}

  async record(actorId: string, rawPatientId: string, input: { payerId: string; policyNumber: string; percent: number; validFrom?: string | null; validUntil?: string | null }): Promise<Result<CoverageView>> {
    const patientRef = PatientRef.create(rawPatientId);
    if (!patientRef.ok || !(await this.d.patients.find([patientRef.value.value])).has(patientRef.value.value)) return err(PATIENT_NOT_FOUND);
    const payer = await this.d.payers.findById((input.payerId ?? '').trim().toLowerCase());
    if (!payer) return err(PAYER_NOT_FOUND);
    if (!payer.active) return err(PAYER_INACTIVE);
    const policy = String(input.policyNumber ?? '').trim();
    if (policy.length < 1 || policy.length > 40) return err(COVERAGE_POLICY_INVALID);
    if (!Number.isInteger(input.percent) || input.percent < 1 || input.percent > 100) return err(COVERAGE_PERCENT_INVALID);
    const validFrom = (input.validFrom ?? '').trim() || today(this.d.clock);
    const validUntil = (input.validUntil ?? '').trim() || null;
    if (!validDay(validFrom) || (validUntil !== null && (!validDay(validUntil) || validUntil < validFrom))) return err(COVERAGE_DATE_INVALID);
    const coverage: PatientCoverage = { id: this.ids.next(), patientId: patientRef.value.value, payerId: payer.id, policyNumber: policy, percent: input.percent, validFrom, validUntil, active: true };
    await this.d.coverages.insert(coverage, actorId);
    await this.d.audit.record({
      action: 'billing.coverage.record', outcome: 'SUCCESS', actorId, resourceType: 'billing-coverage', resourceId: coverage.id,
      metadata: { patientId: coverage.patientId, payerCode: payer.code, percent: coverage.percent }, occurredAt: this.d.clock.now(),
    });
    return ok(this.view(coverage, payer, today(this.d.clock)));
  }

  async forPatient(rawPatientId: string): Promise<Result<CoverageView[]>> {
    const patientRef = PatientRef.create(rawPatientId);
    if (!patientRef.ok || !(await this.d.patients.find([patientRef.value.value])).has(patientRef.value.value)) return err(PATIENT_NOT_FOUND);
    const list = await this.d.coverages.forPatient(patientRef.value.value);
    const payers = await this.d.payers.findByIds([...new Set(list.map((c) => c.payerId))]);
    const day = today(this.d.clock);
    return ok(list.map((c) => this.view(c, payers.get(c.payerId) ?? null, day)));
  }

  async deactivate(actorId: string, id: string): Promise<Result<CoverageView>> {
    const found = await this.d.coverages.findById((id ?? '').trim().toLowerCase());
    if (!found) return err(COVERAGE_NOT_FOUND);
    if (found.active) {
      await this.d.coverages.deactivate(found.id);
      await this.d.audit.record({ action: 'billing.coverage.deactivate', outcome: 'SUCCESS', actorId, resourceType: 'billing-coverage', resourceId: found.id, metadata: { patientId: found.patientId }, occurredAt: this.d.clock.now() });
    }
    const payer = await this.d.payers.findById(found.payerId);
    return ok(this.view({ ...found, active: false }, payer, today(this.d.clock)));
  }

  private view(c: PatientCoverage, payer: Payer | null, day: string): CoverageView {
    return {
      id: c.id, patientId: c.patientId, payer: payer ? { id: payer.id, code: payer.code, name: payer.name } : null, policyNumber: c.policyNumber, percent: c.percent, validFrom: c.validFrom,
      validUntil: c.validUntil, validToday: validToday(c, day),
    };
  }
}

/** Application d'une couverture à un brouillon, retrait, et règlement de la part de l'assureur. */
export class InvoiceCoverageUseCases {
  constructor(private readonly d: InvoiceDependencies, private readonly p: PayerDependencies) {}

  private async load(rawId: string): Promise<Result<Invoice>> {
    const id = InvoiceId.create(rawId);
    const found = id.ok ? await this.d.invoices.findById(id.value) : null;
    return found ? ok(found) : err(INVOICE_NOT_FOUND);
  }

  async apply(actorId: string, invoiceId: string, coverageId: string): Promise<Result<InvoiceView>> {
    const loaded = await this.load(invoiceId);
    if (!loaded.ok) return err(loaded.error);
    const invoice = loaded.value;
    const coverage = await this.p.coverages.findById((coverageId ?? '').trim().toLowerCase());
    if (!coverage) return err(COVERAGE_NOT_FOUND);
    if (coverage.patientId !== invoice.state.patientId.value) return err(COVERAGE_PATIENT_MISMATCH);
    if (!validToday(coverage, today(this.d.clock))) return err(COVERAGE_EXPIRED);
    const payer = await this.p.payers.findById(coverage.payerId);
    if (!payer) return err(PAYER_NOT_FOUND);
    if (!payer.active) return err(PAYER_INACTIVE);
    const applied = invoice.applyCoverage({ payerId: payer.id, percent: coverage.percent, policyNumber: coverage.policyNumber });
    if (!applied.ok) return err(applied.error);
    if ((await this.d.invoices.save(invoice)) !== 'SAVED') return err(CHANGED);
    await record(this.d, actorId, 'billing.invoice.coverage-apply', invoice, { payerCode: payer.code, percent: coverage.percent });
    return ok(await toView(this.d, invoice));
  }

  async remove(actorId: string, invoiceId: string): Promise<Result<InvoiceView>> {
    const loaded = await this.load(invoiceId);
    if (!loaded.ok) return err(loaded.error);
    const invoice = loaded.value;
    const removed = invoice.removeCoverage();
    if (!removed.ok) return err(removed.error);
    if ((await this.d.invoices.save(invoice)) !== 'SAVED') return err(CHANGED);
    await record(this.d, actorId, 'billing.invoice.coverage-remove', invoice);
    return ok(await toView(this.d, invoice));
  }

  /** La comptabilité constate que l'assureur a réglé sa part. Une seule fois ; la facture ne peut plus être annulée ensuite. */
  async settle(actorId: string, invoiceId: string, reference: string): Promise<Result<InvoiceView>> {
    const loaded = await this.load(invoiceId);
    if (!loaded.ok) return err(loaded.error);
    const invoice = loaded.value;
    const ref = String(reference ?? '').trim();
    if (ref.length < 1 || ref.length > 60) return err(REFERENCE_INVALID);
    const settled = invoice.settle({ at: this.d.clock.now(), by: actorId, reference: ref });
    if (!settled.ok) return err(settled.error);
    if ((await this.d.invoices.save(invoice)) !== 'SAVED') return err(CHANGED);
    await record(this.d, actorId, 'billing.invoice.payer-settle', invoice, { amount: invoice.coverageAmount.value }, undefined);
    return ok(await toView(this.d, invoice));
  }
}

/** Créances d'assureurs : ce qu'ils doivent encore, ou ce qu'ils ont réglé. */
export class ListClaimsUseCase {
  constructor(private readonly p: PayerDependencies) {}

  async execute(input: ClaimFilter & { offset: number; limit: number }): Promise<{ items: ClaimView[]; total: number; offset: number; limit: number }> {
    const offset = Math.max(0, Math.trunc(input.offset));
    const limit = Math.min(200, Math.max(1, Math.trunc(input.limit)));
    const page = await this.p.invoices.claims({ payerId: input.payerId, settled: input.settled }, offset, limit);
    const patients = await this.p.patients.find([...new Set(page.items.map((c) => c.patientId))]);
    return {
      items: page.items.map((c): ClaimView => {
        const patient = patients.get(c.patientId);
        return { ...c, patient: patient ? { id: patient.id, number: patient.number, lastName: patient.lastName, firstName: patient.firstName } : null };
      }),
      total: page.total, offset, limit,
    };
  }
}
