import { Body, Controller, DefaultValuePipe, Get, HttpCode, Inject, Param, ParseIntPipe, ParseUUIDPipe, Post, Put, Query } from '@nestjs/common';
import { DocGroup, DocOperation } from '../../api-docs';
import type { DocParam } from '../../api-docs';
import { CreateUserUseCase, ListUsersUseCase, ManageUserUseCases } from '../application/use-cases/manage-users';
import { GetUserAccessUseCase } from '../application/use-cases/user-access';
import { ROLE_REPOSITORY } from '../domain/ports';
import type { RoleRepository } from '../domain/ports';
import { CurrentUser, RequirePermissions } from './decorators';
import type { AuthUser } from './decorators';
import { AccessDecisionDto, PermissionCatalogEntryDto, UserAccessDto } from './dto/access.dto';
import { AssignRolesDto, CreateUserDto } from './dto/auth.dto';
import { CreatedUserDto, RoleDto, UserDto, UserPageDto } from './dto/responses.dto';
import { PermissionCatalog } from './permission-catalog';
import { unwrap } from './http-errors';

const ID: DocParam = { name: 'id', description: 'Identifiant du compte.', example: '5d81b4cd-ecd1-47f4-9185-d6c4be1e1c73', format: 'uuid' };

@DocGroup(
  'Utilisateurs et rôles',
  [
    'Administration des comptes. Réservé aux profils qui détiennent les permissions indiquées sur chaque opération.',
    '',
    '- Un administrateur **ne peut pas** modifier ses propres rôles ni désactiver son propre compte (anti-escalade de privilèges).',
    "- **Désactiver** un compte ou **changer ses rôles** prend effet immédiatement, sans attendre l'expiration de son jeton.",
    "- L'administrateur système n'a volontairement **aucune** permission sur les dossiers cliniques (séparation des tâches).",
  ].join('\n'),
  20,
)
@Controller('api/v1')
export class UsersController {
  constructor(
    private readonly listUsers: ListUsersUseCase,
    private readonly createUser: CreateUserUseCase,
    private readonly manage: ManageUserUseCases,
    private readonly access: GetUserAccessUseCase,
    private readonly catalog: PermissionCatalog,
    @Inject(ROLE_REPOSITORY) private readonly roles: RoleRepository,
  ) {}

  @DocOperation({
    summary: 'Lister les comptes',
    auth: 'bearer',
    responses: [{ status: 200, description: 'Une page de comptes.', type: UserPageDto }],
    query: [
      { name: 'offset', description: 'Nombre de comptes à sauter (pagination).', example: 0 },
      { name: 'limit', description: 'Nombre de comptes par page (1 à 200).', example: 50 },
    ],
  })
  @RequirePermissions('iam.users:read') @Get('users')
  list(@Query('offset', new DefaultValuePipe(0), ParseIntPipe) offset: number, @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit: number): Promise<UserPageDto> {
    return this.listUsers.execute(offset, limit);
  }

  @DocOperation({
    summary: 'Créer un compte',
    description: "Crée un compte avec un **mot de passe provisoire** aléatoire, renvoyé une seule fois dans la réponse. À la première connexion, l'utilisateur devra le changer (et inscrire la MFA si ses rôles l'exigent).",
    auth: 'bearer',
    responses: [{ status: 201, description: 'Compte créé.', type: CreatedUserDto }],
    errors: [400, 409, 422],
  })
  @RequirePermissions('iam.users:manage') @Post('users')
  async create(@CurrentUser() actor: AuthUser, @Body() dto: CreateUserDto): Promise<CreatedUserDto> {
    return unwrap(await this.createUser.execute(actor.userId, dto));
  }

  @DocOperation({
    summary: "Remplacer les rôles d'un compte",
    description: "La liste envoyée **remplace** les rôles actuels. Les sessions du compte sont coupées et ses droits recalculés immédiatement.",
    auth: 'bearer',
    responses: [{ status: 200, description: 'Compte mis à jour.', type: UserDto }],
    errors: [400, 403, 404, 422],
    params: [ID],
  })
  @RequirePermissions('iam.users:manage') @Put('users/:id/roles')
  async assignRoles(@CurrentUser() actor: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: AssignRolesDto): Promise<UserDto> {
    return unwrap(await this.manage.assignRoles(actor.userId, id, dto.roles));
  }

  @DocOperation({
    summary: 'Désactiver un compte',
    description: 'Le compte ne peut plus se connecter et toutes ses sessions sont coupées **immédiatement**. Réversible avec `enable`.',
    auth: 'bearer',
    responses: [{ status: 200, description: 'Compte désactivé.', type: UserDto }],
    errors: [400, 403, 404],
    params: [ID],
  })
  @RequirePermissions('iam.users:manage') @HttpCode(200) @Post('users/:id/disable')
  async disable(@CurrentUser() actor: AuthUser, @Param('id', ParseUUIDPipe) id: string): Promise<UserDto> {
    return unwrap(await this.manage.setActive(actor.userId, id, false));
  }

  @DocOperation({
    summary: 'Réactiver un compte',
    auth: 'bearer',
    responses: [{ status: 200, description: 'Compte réactivé (compteur d\'échecs remis à zéro).', type: UserDto }],
    errors: [400, 404],
    params: [ID],
  })
  @RequirePermissions('iam.users:manage') @HttpCode(200) @Post('users/:id/enable')
  async enable(@CurrentUser() actor: AuthUser, @Param('id', ParseUUIDPipe) id: string): Promise<UserDto> {
    return unwrap(await this.manage.setActive(actor.userId, id, true));
  }

  @DocOperation({
    summary: 'Déverrouiller un compte',
    description: "Lève le verrouillage temporaire consécutif à des échecs de connexion, sans attendre son terme.",
    auth: 'bearer',
    responses: [{ status: 200, description: 'Compte déverrouillé.', type: UserDto }],
    errors: [400, 404],
    params: [ID],
  })
  @RequirePermissions('iam.users:manage') @HttpCode(200) @Post('users/:id/unlock')
  async unlock(@CurrentUser() actor: AuthUser, @Param('id', ParseUUIDPipe) id: string): Promise<UserDto> {
    return unwrap(await this.manage.unlock(actor.userId, id));
  }

  @DocOperation({
    summary: 'Réinitialiser la double authentification',
    description: "Cas du téléphone perdu : efface le secret et les codes de secours, et coupe les sessions. L'utilisateur devra réinscrire la MFA à sa prochaine connexion.",
    auth: 'bearer',
    responses: [{ status: 200, description: 'MFA réinitialisée.', type: UserDto }],
    errors: [400, 404],
    params: [ID],
  })
  @RequirePermissions('iam.users:manage') @HttpCode(200) @Post('users/:id/reset-mfa')
  async resetMfa(@CurrentUser() actor: AuthUser, @Param('id', ParseUUIDPipe) id: string): Promise<UserDto> {
    return unwrap(await this.manage.resetMfa(actor.userId, id));
  }

  @DocOperation({
    summary: 'Lister les rôles et leurs permissions',
    description: 'Les rôles sont des données (table `iam_roles`) : un établissement peut en ajouter. Portée des permissions : `own` < `department` < `all`.',
    auth: 'bearer',
    responses: [{ status: 200, description: 'Tous les rôles.', type: RoleDto, isArray: true }],
  })
  @RequirePermissions('iam.roles:read') @Get('roles')
  async listRoles(): Promise<RoleDto[]> {
    const roles = await this.roles.findAll();
    return roles.map((r) => ({ code: r.code.value, name: r.name, requiresMfa: r.requiresMfa, isSystem: r.isSystem, permissions: r.permissions.map((p) => p.value) }));
  }

  @DocOperation({
    summary: "Droits effectifs d'un compte",
    description: "Ce que le compte peut faire **aujourd'hui** : rôles, permissions (avec portée) et services de rattachement. À consulter pour répondre à « qui pouvait quoi ? ».",
    auth: 'bearer',
    responses: [{ status: 200, description: 'Droits effectifs.', type: UserAccessDto }],
    errors: [400, 404],
    params: [ID],
  })
  @RequirePermissions('iam.users:read') @Get('users/:id/access')
  async userAccess(@Param('id', ParseUUIDPipe) id: string): Promise<UserAccessDto> {
    return unwrap(await this.access.execute(id));
  }

  @DocOperation({
    summary: "Expliquer une décision d'accès",
    description:
      "Calcule, sans rien exécuter, si le compte pourrait faire l'action `permission` (`ressource:action`) sur une ressource donnée, et pourquoi. `departmentId` et `ownerId` décrivent la ressource ; une information absente ne donne jamais accès. Même calcul que celui des modules métier.",
    auth: 'bearer',
    responses: [{ status: 200, description: 'La décision et sa raison.', type: AccessDecisionDto }],
    errors: [400, 404, 422],
    params: [ID],
    query: [
      { name: 'permission', description: 'Action testée, sans portée.', example: 'files.clinical:read' },
      { name: 'departmentId', description: 'Service auquel appartient la ressource.', example: '9b1c0a5e-34d2-4b8e-a8c1-52f3b7a1d001', format: 'uuid' },
      { name: 'ownerId', description: 'Titulaire de la ressource (identifiant de compte).', example: '5d81b4cd-ecd1-47f4-9185-d6c4be1e1c73', format: 'uuid' },
    ],
  })
  @RequirePermissions('iam.users:read') @Get('users/:id/access/explain')
  async explainAccess(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('permission') permission: string,
    @Query('departmentId') departmentId?: string,
    @Query('ownerId') ownerId?: string,
  ): Promise<AccessDecisionDto> {
    return unwrap(await this.access.explain(id, permission, { departmentId, ownerId }));
  }

  @DocOperation({
    summary: "Inventaire des permissions de l'API",
    description:
      "Toutes les permissions, relevées sur les routes elles-mêmes puis croisées avec les rôles : où chacune est exigée, et qui l'accorde. Une permission accordée mais exigée par aucune route est probablement obsolète (ou en avance sur son module).",
    auth: 'bearer',
    responses: [{ status: 200, description: 'Les permissions, par ordre alphabétique.', type: PermissionCatalogEntryDto, isArray: true }],
  })
  @RequirePermissions('iam.roles:read') @Get('permissions')
  permissions(): Promise<PermissionCatalogEntryDto[]> {
    return this.catalog.list() as Promise<PermissionCatalogEntryDto[]>;
  }
}
