import { AuditLog } from '../../../audit/domain/audit-log.port';
import { Clock, IdGenerator } from '../../../../shared-kernel/ports';
import { DomainError, err, ok, Result } from '../../../../shared-kernel/result';
import { Organization } from '../../domain/entities/organization';
import { OrganizationRepository } from '../../domain/ports';
import { OrganizationId } from '../../domain/value-objects/organization-id';
import { OrganizationName } from '../../domain/value-objects/organization-name';

export const ORGANIZATION_NOT_FOUND = new DomainError('ORGANIZATION_NOT_FOUND', "L'organisation n'est pas encore configurée.");

export interface OrganizationView {
  readonly id: string;
  readonly name: string;
}

export const toOrganizationView = (o: Organization): OrganizationView => ({ id: o.getId().value, name: o.getName().value });

export class GetOrganizationUseCase {
  constructor(private readonly organizations: OrganizationRepository) {}

  async execute(): Promise<Result<OrganizationView>> {
    const organization = await this.organizations.find();
    return organization ? ok(toOrganizationView(organization)) : err(ORGANIZATION_NOT_FOUND);
  }
}

/**
 * Configure l'organisation de l'installation : la crée au premier appel, la renomme ensuite. Une seule organisation
 * existe par installation, donc l'opération est idempotente (rejouer le même nom ne change rien et n'est pas journalisé).
 */
export class SetupOrganizationUseCase {
  constructor(
    private readonly organizations: OrganizationRepository,
    private readonly ids: IdGenerator,
    private readonly audit: AuditLog,
    private readonly clock: Clock,
  ) {}

  async execute(actorId: string, input: { name: string }): Promise<Result<OrganizationView>> {
    const name = OrganizationName.create(input.name);
    if (!name.ok) return err(name.error);

    const existing = await this.organizations.find();
    if (existing) {
      if (existing.getName().equals(name.value)) return ok(toOrganizationView(existing));
      const previous = existing.getName().value;
      existing.updateName(name.value);
      await this.organizations.save(existing);
      await this.record(actorId, 'administration.organization.rename', existing, { previousName: previous });
      return ok(toOrganizationView(existing));
    }

    const id = OrganizationId.create(this.ids.next());
    if (!id.ok) return err(id.error);
    const created = Organization.create(id.value, name.value);
    if (!created.ok) return err(created.error);
    await this.organizations.save(created.value);
    await this.record(actorId, 'administration.organization.create', created.value, {});
    return ok(toOrganizationView(created.value));
  }

  private record(actorId: string, action: string, organization: Organization, metadata: Record<string, string>): Promise<void> {
    return this.audit.record({
      action,
      outcome: 'SUCCESS',
      actorId,
      resourceType: 'organization',
      resourceId: organization.getId().value,
      metadata: { name: organization.getName().value, ...metadata },
      occurredAt: this.clock.now(),
    });
  }
}
