import { AuditLog } from '../../../audit/domain/audit-log.port';
import { Clock, IdGenerator } from '../../../../shared-kernel/ports';
import { DomainError, err, ok, Result } from '../../../../shared-kernel/result';
import { Facility } from '../../domain/entities/facility';
import { FacilityRepository, OrganizationRepository } from '../../domain/ports';
import { FacilityCode } from '../../domain/value-objects/facility-code';
import { FacilityId } from '../../domain/value-objects/facility-id';
import { FacilityName } from '../../domain/value-objects/facility-name';
import { FacilityStatus } from '../../domain/value-objects/FacilityStatus';
import { FacilityLocation, FacilityLocationInput } from '../../domain/value-objects/facility-location';
import { codePrefix, formatCode, nameInitials, nextSequence } from '../../domain/facility-code-generator';
import { ORGANIZATION_NOT_FOUND } from './organization';

const NOT_FOUND = new DomainError('FACILITY_NOT_FOUND', 'Établissement introuvable.');
const DUPLICATE_CODE = new DomainError('FACILITY_CODE_ALREADY_EXISTS', 'Un établissement utilise déjà ce code.');
const LOCATION_REQUIRED = new DomainError('FACILITY_CODE_LOCATION_REQUIRED', 'Sans code, la localisation (au moins le pays) est obligatoire : le code en est déduit.');
const SEQUENCE_EXHAUSTED = new DomainError('FACILITY_CODE_SEQUENCE_EXHAUSTED', 'Les 99 numéros d’ordre de ce début de code sont pris : précisez une autre commune ou un autre nom.');

/** Compose le code d'un nouvel établissement d'après sa localisation et son nom, avec le premier numéro d'ordre libre. */
async function generateCode(facilities: FacilityRepository, name: FacilityName, location: FacilityLocation): Promise<Result<FacilityCode>> {
  const s = location.state;
  const prefix = codePrefix(s.countryCode, s.commune ?? s.region);
  const initials = nameInitials(name.value);
  const sequence = nextSequence(await facilities.codesWithPrefix(`${prefix}-${initials}-`), prefix, initials);
  if (sequence === null) return err(SEQUENCE_EXHAUSTED);
  return FacilityCode.create(formatCode(prefix, initials, sequence));
}

export interface FacilityLocationView {
  readonly countryCode: string;
  readonly region: string | null;
  readonly commune: string | null;
  readonly street: string | null;
  readonly latitude: number | null;
  readonly longitude: number | null;
}

export interface FacilityView {
  readonly id: string;
  readonly organizationId: string;
  readonly code: string;
  readonly name: string;
  readonly status: string;
  readonly operational: boolean;
  /** Où se trouve l'établissement ; `null` pour un établissement créé avant la localisation. */
  readonly location: FacilityLocationView | null;
}

export const toFacilityView = (f: Facility): FacilityView => ({
  id: f.getId().value,
  organizationId: f.getOrganizationId().value,
  code: f.getCode().value,
  name: f.getName().value,
  status: f.getStatus().getValue(),
  operational: f.isOperational(),
  location: f.getLocation() ? { ...f.getLocation()!.state } : null,
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

  /**
   * Sans `code`, il est composé d'après la localisation et le nom (voir `facility-code-generator`) : la localisation est alors obligatoire. Un `code` fourni
   * est contrôlé et reste accepté (reprise de données). Deux enregistrements simultanés qui visent le même numéro d'ordre ne s'écrasent pas : le second est
   * refait avec le numéro suivant.
   */
  async execute(actorId: string, input: { name: string; code?: string | null; status?: string; location?: FacilityLocationInput | null }): Promise<Result<FacilityView>> {
    const name = FacilityName.create(input.name);
    if (!name.ok) return err(name.error);
    const status = input.status === undefined ? undefined : FacilityStatus.create(input.status);
    if (status && !status.ok) return err(status.error);
    const location = input.location ? FacilityLocation.create(input.location) : null;
    if (location && !location.ok) return err(location.error);

    const organization = await this.organizations.find();
    if (!organization) return err(ORGANIZATION_NOT_FOUND);
    const explicit = (input.code ?? '').trim();
    if (explicit === '' && !location) return err(LOCATION_REQUIRED);

    let created: Result<Facility> | null = null;
    for (let attempt = 0; attempt < 3 && !created?.ok; attempt += 1) {
      const code = explicit !== '' ? FacilityCode.create(explicit) : await generateCode(this.facilities, name.value, (location as { value: FacilityLocation }).value);
      if (!code.ok) return err(code.error);
      if (await this.facilities.findByCode(code.value)) {
        if (explicit !== '') return err(DUPLICATE_CODE);
        continue; // un autre enregistrement vient de prendre ce numéro d'ordre : on recalcule
      }
      const id = FacilityId.create(this.ids.next());
      if (!id.ok) return err(id.error);
      created = Facility.create(name.value, code.value, id.value, organization.getId(), status?.value, location?.value ?? null);
      if (!created.ok) return err(created.error);
      try {
        await this.facilities.save(created.value);
      } catch (error) {
        // Course perdue sur l'index unique du code : si le code est maintenant pris et qu'il était composé, on recommence ; sinon l'erreur est réelle.
        if (explicit === '' && (await this.facilities.findByCode(code.value))) {
          created = null;
          continue;
        }
        throw error;
      }
    }
    if (!created || !created.ok) return err(DUPLICATE_CODE);
    const code = created.value.getCode();
    const id = created.value.getId();
    await this.audit.record({
      action: 'administration.facility.register',
      outcome: 'SUCCESS',
      actorId,
      resourceType: 'facility',
      resourceId: id.value,
      metadata: { code: code.value, name: name.value.value, status: created.value.getStatus().getValue(), generatedCode: explicit === '', ...(location ? { country: location.value.state.countryCode } : {}) },
      occurredAt: this.clock.now(),
    });
    return ok(toFacilityView(created.value));
  }
}

/** Le code que recevrait un établissement de ce nom et de cette localisation, sans rien enregistrer : l'écran le montre avant la création. */
export class PreviewFacilityCodeUseCase {
  constructor(private readonly facilities: FacilityRepository) {}

  async execute(input: { name: string; location: FacilityLocationInput }): Promise<Result<{ code: string }>> {
    const name = FacilityName.create(input.name);
    if (!name.ok) return err(name.error);
    const location = FacilityLocation.create(input.location);
    if (!location.ok) return err(location.error);
    const code = await generateCode(this.facilities, name.value, location.value);
    return code.ok ? ok({ code: code.value.value }) : err(code.error);
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
  async update(actorId: string, id: string, input: { name?: string; code?: string; location?: FacilityLocationInput | null }): Promise<Result<FacilityView>> {
    const name = input.name === undefined ? undefined : FacilityName.create(input.name);
    if (name && !name.ok) return err(name.error);
    const location = input.location === undefined || input.location === null ? undefined : FacilityLocation.create(input.location);
    if (location && !location.ok) return err(location.error);
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
    // `location: null` efface la localisation ; absente, elle reste ; fournie, elle remplace l'ancienne (le code, lui, ne change pas tout seul).
    if (input.location === null && facility.getLocation()) {
      metadata.locationCleared = 'true';
      facility.updateLocation(null);
    } else if (location?.ok && !location.value.equals(facility.getLocation())) {
      metadata.locationChanged = 'true';
      facility.updateLocation(location.value);
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
