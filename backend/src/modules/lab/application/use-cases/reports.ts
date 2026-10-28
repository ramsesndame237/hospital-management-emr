import { Result, err, ok } from '../../../../shared-kernel/result';
import { Requisition } from '../../domain/requisition';
import { RequisitionDependencies, loadFor, PatientSummary, UserSummary } from './requisitions';

export interface ReportItem {
  readonly testCode: string;
  readonly testName: string;
  readonly section: string;
  /** `RELEASED` : résultat publié ; `PENDING` : pas encore publié (le rapport est alors partiel). */
  readonly status: 'RELEASED' | 'PENDING';
  readonly value: string | null;
  readonly unit: string | null;
  readonly flag: string | null;
  readonly refLow: number | null;
  readonly refHigh: number | null;
  readonly criticalLow: number | null;
  readonly criticalHigh: number | null;
  /** Version publiée ; supérieure à 1 quand le résultat a été amendé. */
  readonly version: number | null;
  /** Cette version amende un résultat déjà publié. */
  readonly amended: boolean;
  readonly amendmentReason: string | null;
  readonly verifiedBy: UserSummary | null;
  readonly releasedBy: UserSummary | null;
  readonly releasedAt: string | null;
}

/** Rapport d'une demande : ce qui est publié, avec les signatures. Jamais une valeur qui n'est pas encore publiée. */
export interface ReportView {
  readonly number: string;
  readonly patient: PatientSummary | null;
  readonly priority: string;
  readonly source: string;
  readonly orderedBy: UserSummary | null;
  readonly orderedAt: string;
  readonly clinicalNotes: string | null;
  /** Tous les résultats de la demande sont publiés. */
  readonly complete: boolean;
  readonly items: readonly ReportItem[];
  readonly generatedAt: string;
}

export class GetReportUseCase {
  constructor(private readonly d: RequisitionDependencies) {}

  /** Rapport imprimable : le prescripteur (pour ses demandes) ou le laboratoire. Chaque édition est inscrite au journal. */
  async execute(actorId: string, rawId: string): Promise<Result<ReportView>> {
    const loaded = await loadFor(this.d, actorId, rawId);
    if (!loaded.ok) return err(loaded.error);
    const requisition: Requisition = loaded.value;
    const s = requisition.state;
    const ids = new Set<string>([s.orderedBy]);
    for (const t of s.tests) for (const id of [t.result?.verifiedBy, t.result?.releasedBy]) if (id) ids.add(id);
    const users = await this.d.users.find([...ids]);
    const who = (id: string | null): UserSummary | null => (id && users.get(id) ? { id, username: users.get(id)!.username } : null);
    const patient = (await this.d.patients.find([s.patientId.value])).get(s.patientId.value) ?? null;
    const items = s.tests.map((t): ReportItem => {
      const released = t.result?.versions.find((v) => v.version === t.result?.releasedVersion);
      const base = { testCode: t.code.value, testName: t.name.value, section: t.section };
      if (!t.result || !released) {
        return { ...base, status: 'PENDING', value: null, unit: null, flag: null, refLow: null, refHigh: null, criticalLow: null, criticalHigh: null, version: null, amended: false, amendmentReason: null, verifiedBy: null, releasedBy: null, releasedAt: null };
      }
      return {
        ...base, status: 'RELEASED', value: released.value, unit: released.unit, flag: released.flag, refLow: released.refLow, refHigh: released.refHigh, criticalLow: released.criticalLow, criticalHigh: released.criticalHigh,
        version: released.version, amended: released.amendmentReason !== null, amendmentReason: released.amendmentReason, verifiedBy: who(t.result.verifiedBy), releasedBy: who(t.result.releasedBy), releasedAt: t.result.releasedAt?.toString() ?? null,
      };
    });
    await this.d.audit.record({
      action: 'lab.report.read', outcome: 'SUCCESS', actorId, resourceType: 'lab-requisition', resourceId: s.id.value,
      metadata: { requisitionNumber: s.number.value, patientId: s.patientId.value, released: items.filter((i) => i.status === 'RELEASED').length, total: items.length }, occurredAt: this.d.clock.now(),
    });
    return ok({
      number: s.number.value, patient: patient ? { id: patient.id, number: patient.number, lastName: patient.lastName, firstName: patient.firstName, sex: patient.sex, birthDate: patient.birthDate } : null,
      priority: s.priority, source: s.source, orderedBy: who(s.orderedBy), orderedAt: s.orderedAt.toString(), clinicalNotes: s.clinicalNotes, complete: items.length > 0 && items.every((i) => i.status === 'RELEASED'),
      items, generatedAt: this.d.clock.now().toString(),
    });
  }
}
