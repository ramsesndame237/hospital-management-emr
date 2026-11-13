import { DomainError, err, ok, Result } from '../../../../shared-kernel/result';
import { ImagingOrder } from '../../domain/order';
import { parseMethod, parseOptionalText, Reason } from '../../domain/values';
import { loadFor, OrderDependencies, OrderView, record, toView } from './orders';

export interface DraftInput {
  technique?: string | null;
  findings?: string | null;
  impression?: string | null;
  critical?: boolean;
}

export interface CommunicationInput {
  notifiedName: string;
  notifiedRole: string;
  method: string;
  readBackConfirmed: boolean;
}

export interface AddendumInput extends DraftInput {
  reason: string;
  /** Obligatoire quand l'addendum signale une découverte critique. */
  communication?: CommunicationInput | null;
}

const NOT_FOUND = new DomainError('IMG_ORDER_NOT_FOUND', "Demande d'examen introuvable.");

function parseCommunication(raw: CommunicationInput) {
  const method = parseMethod(raw.method);
  if (!method.ok) return err(method.error);
  return ok({ notifiedName: raw.notifiedName ?? '', notifiedRole: raw.notifiedRole ?? '', method: method.value, readBackConfirmed: raw.readBackConfirmed === true });
}

/**
 * Compte rendu : brouillon, appel du clinicien pour une découverte critique, signature, addendum. L'audit n'en contient jamais le texte : seulement
 * qui a fait quoi sur quelle demande, et si la découverte est critique.
 */
export class ReportUseCases {
  constructor(private readonly d: OrderDependencies) {}

  private async mutate(actorId: string, id: string, apply: (order: ImagingOrder, now: ReturnType<OrderDependencies['clock']['now']>) => Result<void>): Promise<Result<ImagingOrder>> {
    const loaded = await loadFor(this.d, actorId, id);
    if (!loaded.ok) return err(loaded.error);
    const now = this.d.clock.now();
    const done = await this.d.orders.mutate(loaded.value.id, (o) => apply(o, now));
    if (!done) return err(NOT_FOUND);
    return done;
  }

  /** Enregistre (ou remplace) le brouillon : constatations, impression et indication d'une découverte critique. */
  async saveDraft(actorId: string, id: string, input: DraftInput): Promise<Result<OrderView>> {
    const technique = parseOptionalText(input.technique, 2000, 'IMG_REPORT_TEXT_INVALID');
    if (!technique.ok) return err(technique.error);
    const findings = parseOptionalText(input.findings, 8000, 'IMG_REPORT_TEXT_INVALID');
    if (!findings.ok) return err(findings.error);
    const impression = parseOptionalText(input.impression, 2000, 'IMG_REPORT_TEXT_INVALID');
    if (!impression.ok) return err(impression.error);
    const done = await this.mutate(actorId, id, (o, now) => o.saveDraft({ technique: technique.value, findings: findings.value, impression: impression.value, critical: input.critical === true }, actorId, now));
    if (!done.ok) return err(done.error);
    await record(this.d, actorId, 'imaging.report.draft', done.value, { critical: input.critical === true });
    return ok(await toView(this.d, actorId, done.value));
  }

  /** Documente l'appel du clinicien pour la découverte critique du brouillon : qui, comment, relecture confirmée. */
  async recordCommunication(actorId: string, id: string, input: CommunicationInput): Promise<Result<OrderView>> {
    const parsed = parseCommunication(input);
    if (!parsed.ok) return err(parsed.error);
    const done = await this.mutate(actorId, id, (o, now) => o.recordCommunication(parsed.value, actorId, now));
    if (!done.ok) return err(done.error);
    await record(this.d, actorId, 'imaging.report.critical-communication', done.value, { method: parsed.value.method });
    return ok(await toView(this.d, actorId, done.value));
  }

  /** Signe le compte rendu : il devient lisible par le prescripteur et ne se réécrit plus. */
  async sign(actorId: string, id: string): Promise<Result<OrderView>> {
    const loaded = await loadFor(this.d, actorId, id);
    if (!loaded.ok) return err(loaded.error);
    const critical = loaded.value.state.draft?.critical === true;
    const done = await this.mutate(actorId, id, (o, now) => o.sign(actorId, now));
    if (!done.ok) {
      if (done.error.code === 'IMG_CRITICAL_NOT_COMMUNICATED') await record(this.d, actorId, 'imaging.report.sign', loaded.value, { critical: true, blocked: true }, undefined, 'FAILURE');
      return err(done.error);
    }
    await record(this.d, actorId, 'imaging.report.sign', done.value, { critical, version: 1 });
    return ok(await toView(this.d, actorId, done.value));
  }

  /** Complète un compte rendu signé : nouvelle version signée, avec son motif. */
  async addendum(actorId: string, id: string, input: AddendumInput): Promise<Result<OrderView>> {
    const reason = Reason.create(input.reason);
    if (!reason.ok) return err(reason.error);
    const technique = parseOptionalText(input.technique, 2000, 'IMG_REPORT_TEXT_INVALID');
    if (!technique.ok) return err(technique.error);
    const findings = parseOptionalText(input.findings, 8000, 'IMG_REPORT_TEXT_INVALID');
    if (!findings.ok) return err(findings.error);
    const impression = parseOptionalText(input.impression, 2000, 'IMG_REPORT_TEXT_INVALID');
    if (!impression.ok) return err(impression.error);
    let communication = null;
    if (input.communication) {
      const parsed = parseCommunication(input.communication);
      if (!parsed.ok) return err(parsed.error);
      communication = parsed.value;
    }
    const done = await this.mutate(actorId, id, (o, now) => o.addendum({ reason: reason.value, technique: technique.value, findings: findings.value, impression: impression.value, critical: input.critical === true, communication }, actorId, now));
    if (!done.ok) return err(done.error);
    await record(this.d, actorId, 'imaging.report.addendum', done.value, { critical: input.critical === true, version: done.value.state.versions.length });
    return ok(await toView(this.d, actorId, done.value));
  }
}
