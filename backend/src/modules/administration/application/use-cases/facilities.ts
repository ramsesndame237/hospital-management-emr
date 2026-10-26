import { AuditLog } from '../../../audit/domain/audit-log.port';
import { Clock, IdGenerator } from '../../../../shared-kernel/ports';
import { DomainError, err, ok, Result } from '../../../../shared-kernel/result';
import { Facility } from '../../domain/entities/facility';
import { FacilityRepository, OrganizationRepository } from '../../domain/ports';
import { FacilityCode } from '../../domain/value-objects/facility-code';
import { FacilityId } from '../../domain/value-objects/facility-id';
import { FacilityName } from '../../domain/value-objects/facility-name';
import { FacilityStatus } from '../../domain/value-objects/FacilityStatus';
import { ORGANIZATION_NOT_FOUND } from './organization';

const NOT_FOUND = new DomainError('FACILITY_NOT_FOUND', 'Établissement introuvable.');
const DUPLICATE_CODE = new DomainError('FACILITY_CODE_ALREADY_EXISTS', 'Un établissement utilise déjà ce code.');

export interface FacilityView {
  readonly id: string;
  readonly organizationId: string;
  readonly code: string;
  readonly name: string;
  readonly status: string;
  readonly operational: boolean;
}

export const toFacilityView = (f: Facility): FacilityView => ({
  id: f.getId().value,
  organizationId: f.getOrganizationId().value,
  code: f.getCode().value,
  name: f.getName().value,
  status: f.getStatus().getValue(),
  operational: f.isOperational(),
});

async function loadFacility(facilities: FacilityRepository, rawId: string): Promise<Result<Facility>> {
  const id = FacilityId.create(rawId);
  if (!id.ok) return err(NOT_FOUND); // un identifiant mal formé ne désigne aucun établissement
  const facility = await facilities.findById(id.value);
  return facility ? ok(facility) : err(NOT_FOUND);
}

export class GetFacilityUseCase {
  constructor(private readonly facilities: FacilityRepository) {}

  async execute(id: string): Promise<Result<FacilityView>> {
    const facility = await loadFacility(this.facilities, id);
    return facility.ok ? ok(toFacilityView(facility.value)) : err(facility.error);
  }
}

export class ListFacilitiesUseCase {
  constructor(private readonly facilities: FacilityRepository) {}

  async execute(offset: number, limit: number): Promise<{ items: FacilityView[]; total: number; offset: number; limit: number }> {
    const safeOffset = Math.max(0, Math.trunc(offset));
    const safeLimit = Math.min(200, Math.max(1, Math.trunc(limit)));
    const { items, total } = await this.facilities.list(safeOffset, safeLimit);
    return { items: items.map(toFacilityView), total, offset: safeOffset, limit: safeLimit };
  }
}

/** Enregistre un établissement de l'organisation. Sans statut précisé, il démarre « en construction » (donc non opérationnel). */
export class RegisterFacilityUseCase {
  constructor(
    private readonly organizations: OrganizationRepository,
    private readonly facilities: FacilityRepository,
    private readonly ids: IdGenerator,
    private readonly audit: AuditLog,
    private readonly clock: Clock,
  ) {}

  async execute(actorId: string, input: { name: string; code: string; status?: string }): Promise<Result<FacilityView>> {
    const name = FacilityName.create(input.name);
    if (!name.ok) return err(name.error);
    const code = FacilityCode.create(input.code);
    if (!code.ok) return err(code.error);
    const status = input.status === undefined ? undefined : FacilityStatus.create(input.status);
    if (status && !status.ok) return err(status.error);

    const organization = await this.organizations.find();
    if (!organization) return err(ORGANIZATION_NOT_FOUND);
    if (await this.facilities.findByCode(code.value)) return err(DUPLICATE_CODE);

    const id = FacilityId.create(this.ids.next());
    if (!id.ok) return err(id.error);
    const created = Facility.create(name.value, code.value, id.value, organization.getId(), status?.value);
    if (!created.ok) return err(created.error);
    await this.facilities.save(created.value);
    await this.audit.record({
      action: 'administration.facility.register',
      outcome: 'SUCCESS',
      actorId,
      resourceType: 'facility',
      resourceId: id.value.value,
      metadata: { code: code.value.value, name: name.value.value, status: created.value.getStatus().getValue() },
      occurredAt: this.clock.now(),
    });
    return ok(toFacilityView(created.value));
  }
}

/** Modifications d'un établissement existant : identité (nom, code) et statut. Chacune est journalisée avec l'ancienne valeur. */
export class ManageFacilityUseCases {
  constructor(
    private readonly facilities: FacilityRepository,
    private readonly audit: AuditLog,
    private readonly clock: Clock,
  ) {}

  /** Seuls les champs fournis changent ; rien n'est écrit (ni journalisé) si les valeurs sont identiques. */
  async update(actorId: string, id: string, input: { name?: string; code?: string }): Promise<Result<FacilityView>> {
    const name = input.name === undefined ? undefined : FacilityName.create(input.name);
    if (name && !name.ok) return err(name.error);
    const code = input.code === undefined ? undefined : FacilityCode.create(input.code);
    if (code && !code.ok) return err(code.error);

    const loaded = await loadFacility(this.facilities, id);
    if (!loaded.ok) return err(loaded.error);
    const facility = loaded.value;

    const metadata: Record<string, string> = {};
    if (name?.ok && !facility.getName().equals(name.value)) {
      metadata.previousName = facility.getName().value;
      facility.updateName(name.value);
    }
    if (code?.ok && !facility.getCode().equals(code.value)) {
      const owner = await this.facilities.findByCode(code.value);
      if (owner && !owner.getId().equals(facility.getId())) return err(DUPLICATE_CODE);
      metadata.previousCode = facility.getCode().value;
      facility.updateCode(code.value);
    }
    if (Object.keys(metadata).length === 0) return ok(toFacilityView(facility));

    await this.facilities.save(facility);
    await this.record(actorId, 'administration.facility.update', facility, metadata);
    return ok(toFacilityView(facility));
  }

  async changeStatus(actorId: string, id: string, rawStatus: string): Promise<Result<FacilityView>> {
    const status = FacilityStatus.create(rawStatus);
    if (!status.ok) return err(status.error);
    const loaded = await loadFacility(this.facilities, id);
    if (!loaded.ok) return err(loaded.error);
    const facility = loaded.value;

    const previous = facility.getStatus();
    if (previous.equals(status.value)) return ok(toFacilityView(facility));
    facility.updateStatus(status.value);
    await this.facilities.save(facility);
    await this.record(actorId, 'administration.facility.status.change', facility, { previousStatus: previous.getValue() });
    return ok(toFacilityView(facility));
  }

  private record(actorId: string, action: string, facility: Facility, changes: Record<string, string>): Promise<void> {
    return this.audit.record({
      action,
      outcome: 'SUCCESS',
      actorId,
      resourceType: 'facility',
      resourceId: facility.getId().value,
      metadata: { code: facility.getCode().value, name: facility.getName().value, status: facility.getStatus().getValue(), ...changes },
      occurredAt: this.clock.now(),
    });
  }
}
