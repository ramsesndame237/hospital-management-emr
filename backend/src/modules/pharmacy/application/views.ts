import { AuditLog } from '../../audit/domain/audit-log.port';
import { Calendar, Clock } from '../../../shared-kernel/ports';
import { PlainDate } from '../../../shared-kernel/temporal';
import { Batch, StockLevel } from '../domain/batch';
import { Drug } from '../domain/drug';
import { AdjustmentRepository, DrugRepository, StockRepository, StockRow, UserDirectory } from '../domain/ports';

export interface PharmacyDependencies {
  readonly drugs: DrugRepository;
  readonly stock: StockRepository;
  readonly adjustments: AdjustmentRepository;
  readonly users: UserDirectory;
  readonly audit: AuditLog;
  readonly clock: Clock;
  readonly calendar: Calendar;
  /** Un lot « bientôt périmé » périme dans ce nombre de jours au plus. */
  readonly expiryAlertDays: number;
}

export interface UserSummary {
  readonly id: string;
  readonly username: string;
}

/** Les noms viennent de l'IAM ; un compte disparu donne `null` plutôt qu'une erreur (le journal garde l'identifiant). */
export async function userSummaries(d: PharmacyDependencies, ids: readonly (string | null)[]): Promise<(id: string | null) => UserSummary | null> {
  const found = await d.users.find([...new Set(ids.filter((i): i is string => !!i))]);
  return (id) => (id && found.get(id) ? { id, username: found.get(id)!.username } : null);
}

export interface DrugView {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly genericName: string;
  readonly strength: string | null;
  readonly form: string;
  readonly schedule: string;
  readonly storage: string;
  readonly atcCode: string | null;
  readonly unit: string;
  readonly unitPrice: number;
  readonly reorderLevel: number;
  readonly notes: string | null;
  readonly active: boolean;
}

export function toDrugView(drug: Drug): DrugView {
  const s = drug.state;
  return {
    id: s.id.value, code: s.code.value, name: s.name.value, genericName: s.genericName.value, strength: s.strength, form: s.form, schedule: s.schedule, storage: s.storage, atcCode: s.atcCode,
    unit: s.unit, unitPrice: s.unitPrice.value, reorderLevel: s.reorderLevel, notes: s.notes, active: s.active,
  };
}

export interface DrugSummaryView {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly genericName: string;
  readonly strength: string | null;
  readonly unit: string;
}

export const toDrugSummary = (drug: Drug): DrugSummaryView => ({
  id: drug.state.id.value, code: drug.state.code.value, name: drug.state.name.value, genericName: drug.state.genericName.value, strength: drug.state.strength, unit: drug.state.unit,
});

export interface BatchView {
  readonly id: string;
  readonly drugId: string;
  readonly batchNumber: string;
  readonly expiry: string;
  /** Jours restants avant la péremption ; négatif : périmé depuis. */
  readonly daysToExpiry: number;
  readonly quantity: number;
  readonly unitCost: number;
  readonly status: string;
  readonly expired: boolean;
  readonly expiringSoon: boolean;
  /** Peut être délivré : en stock, non périmé, hors quarantaine. */
  readonly dispensable: boolean;
  readonly quarantineReason: string | null;
  readonly quarantinedBy: UserSummary | null;
  readonly quarantinedAt: string | null;
  readonly receivedAt: string;
}

export function toBatchView(batch: Batch, today: PlainDate, alertDays: number, who: (id: string | null) => UserSummary | null): BatchView {
  const s = batch.state;
  const days = today.until(s.expiry, { largestUnit: 'days' }).days;
  return {
    id: s.id.value, drugId: s.drugId.value, batchNumber: s.batchNumber.value, expiry: s.expiry.toString(), daysToExpiry: days, quantity: s.quantity, unitCost: s.unitCost.value, status: s.status,
    expired: days < 0, expiringSoon: days >= 0 && days <= alertDays, dispensable: batch.isDispensable(today), quarantineReason: s.quarantineReason, quarantinedBy: who(s.quarantinedBy),
    quarantinedAt: s.quarantinedAt?.toString() ?? null, receivedAt: s.receivedAt.toString(),
  };
}

export interface StockRowView {
  readonly drugId: string;
  readonly code: string;
  readonly name: string;
  readonly genericName: string;
  readonly strength: string | null;
  readonly form: string;
  readonly schedule: string;
  readonly unit: string;
  readonly active: boolean;
  readonly reorderLevel: number;
  readonly dispensable: number;
  readonly quarantined: number;
  readonly expired: number;
  readonly expiringSoon: number;
  readonly nextExpiry: string | null;
  readonly level: StockLevel;
  readonly value: number;
}

export const toStockRowView = (r: StockRow): StockRowView => ({
  drugId: r.drugId, code: r.code, name: r.name, genericName: r.genericName, strength: r.strength, form: r.form, schedule: r.schedule, unit: r.unit, active: r.active, reorderLevel: r.reorderLevel,
  dispensable: r.dispensable, quarantined: r.quarantined, expired: r.expired, expiringSoon: r.expiringSoon, nextExpiry: r.nextExpiry?.toString() ?? null, level: r.level, value: r.value,
});

export const pageOf = (offset: number, limit: number) => ({ offset: Math.max(0, Math.trunc(offset)), limit: Math.min(200, Math.max(1, Math.trunc(limit))) });
