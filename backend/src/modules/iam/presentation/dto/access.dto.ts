import { DocProperty } from '../../../api-docs';

export class AccessRoleDto {
  @DocProperty({ description: 'Code du rôle.', example: 'DOCTOR' })
  code!: string;

  @DocProperty({ description: 'Nom du rôle.', example: 'Médecin' })
  name!: string;

  @DocProperty({ description: 'Le rôle exige la double authentification.', example: true })
  requiresMfa!: boolean;
}

export class UserAccessDto {
  @DocProperty({ description: 'Identifiant du compte.', example: '5d81b4cd-ecd1-47f4-9185-d6c4be1e1c73', format: 'uuid' })
  userId!: string;

  @DocProperty({ description: 'Identifiant de connexion.', example: 'marie.curie' })
  username!: string;

  @DocProperty({ description: 'Faux si le compte est désactivé : plus aucun droit.', example: true })
  active!: boolean;

  @DocProperty({ description: 'Rôles du compte.', type: AccessRoleDto, itemType: AccessRoleDto })
  roles!: readonly AccessRoleDto[];

  @DocProperty({ description: 'Permissions effectives (`ressource:action:portée`) : union de celles des rôles.', example: ['files:read:department', 'files:upload:all'], itemType: 'string' })
  permissions!: readonly string[];

  @DocProperty({ description: "Services auxquels le compte est rattaché aujourd'hui, d'après les affectations de la fiche du personnel reliée (portée `department`). Vide sans fiche reliée.", example: ['9b1c0a5e-34d2-4b8e-a8c1-52f3b7a1d001'], itemType: 'string' })
  departments!: readonly string[];
}

export class AccessDecisionDto {
  @DocProperty({ description: "L'accès serait accordé.", example: false })
  allowed!: boolean;

  @DocProperty({ description: "Portée la plus large accordée au compte pour cette action ; `null` s'il n'en a aucune.", example: 'department', enum: ['own', 'department', 'all'], nullable: true })
  grantedScope!: 'own' | 'department' | 'all' | null;

  @DocProperty({
    description: "Pourquoi : `ALL`, `DEPARTMENT` ou `OWN` (la portée qui a permis l'accès) ; `INACTIVE` (compte désactivé), `NO_PERMISSION` (aucune permission pour cette action) ou `OUT_OF_SCOPE` (permission trop étroite pour cette ressource).",
    example: 'OUT_OF_SCOPE',
    enum: ['ALL', 'DEPARTMENT', 'OWN', 'INACTIVE', 'NO_PERMISSION', 'OUT_OF_SCOPE'],
  })
  reason!: string;
}

export class PermissionRouteDto {
  @DocProperty({ description: 'Méthode HTTP.', example: 'POST' })
  method!: string;

  @DocProperty({ description: 'Chemin de la route.', example: '/api/v1/users/:id/roles' })
  path!: string;

  @DocProperty({ description: 'Permission exacte exigée (avec portée).', example: 'iam.users:manage:all' })
  requires!: string;
}

export class PermissionGrantDto {
  @DocProperty({ description: 'Code du rôle.', example: 'SYSTEM_ADMIN' })
  role!: string;

  @DocProperty({ description: 'Portée accordée.', example: 'all', enum: ['own', 'department', 'all'] })
  scope!: string;
}

export class PermissionCatalogEntryDto {
  @DocProperty({ description: 'Permission, sans portée (`ressource:action`).', example: 'iam.users:manage' })
  permission!: string;

  @DocProperty({ description: "Routes qui l'exigent. Vide : accordée par un rôle mais exigée par aucune route (obsolète, ou en avance sur son module).", type: PermissionRouteDto, itemType: PermissionRouteDto })
  routes!: readonly PermissionRouteDto[];

  @DocProperty({ description: "Rôles qui l'accordent.", type: PermissionGrantDto, itemType: PermissionGrantDto })
  grantedTo!: readonly PermissionGrantDto[];
}
