import { Body, Controller, Delete, DefaultValuePipe, Get, HttpCode, Param, ParseIntPipe, ParseUUIDPipe, Patch, Post, Put, Query } from '@nestjs/common';
import { DocGroup, DocOperation } from '../../api-docs';
import type { DocParam } from '../../api-docs';
import { CurrentUser, RequirePermissions } from '../../iam/presentation/decorators';
import type { AuthUser } from '../../iam/presentation/decorators';
import { GetMyStaffProfileUseCase, GetStaffUseCase, ListStaffUseCase, ManageStaffUseCases, RegisterStaffUseCase } from '../application/use-cases/staff';
import { DepartStaffDto, LinkAccountDto, MyProfileDto, RegisterStaffDto, StaffDto, StaffPageDto, UpdateStaffDto } from './dto/staff.dto';
import { unwrap } from './http-errors';

const ID: DocParam = { name: 'id', description: 'Identifiant de la fiche du personnel.', example: 'c0a8f1d2-5b7e-4c1a-9d3f-6e2b8a4f7c11', format: 'uuid' };

@DocGroup(
  'Personnel',
  [
    "Fiches du personnel de l'établissement : la **personne** qui travaille, avec ou sans compte de connexion.",
    '',
    '- Le **matricule** est unique et ne change jamais. Profession et spécialité viennent des **référentiels**.',
    "- Une fiche n'est **jamais supprimée** : un **départ** est une date. Il termine les affectations qui se poursuivaient.",
    "- Un **compte** de connexion peut être relié à une fiche (un compte pour une fiche, et inversement) ; chacun lit sa propre fiche avec `GET /api/v1/staff/me`.",
    "- Ce sont des **données personnelles** : lecture et gestion réservées à l'administrateur système, lecture seule pour l'auditeur. Le journal d'audit n'en contient aucune (matricule uniquement).",
  ].join('\n'),
  36,
)
@Controller('api/v1/staff')
export class StaffController {
  constructor(
    private readonly register: RegisterStaffUseCase,
    private readonly manage: ManageStaffUseCases,
    private readonly getStaff: GetStaffUseCase,
    private readonly listStaff: ListStaffUseCase,
    private readonly myProfile: GetMyStaffProfileUseCase,
  ) {}

  @DocOperation({
    summary: 'Lister le personnel',
    auth: 'bearer',
    responses: [{ status: 200, description: 'Une page de fiches.', type: StaffPageDto }],
    errors: [400, 422],
    query: [
      { name: 'search', description: 'Texte cherché dans le matricule, le nom, le prénom et l\'e-mail (insensible à la casse).', example: 'curie' },
      { name: 'status', description: "Situation aujourd'hui : `ACTIVE` (en poste) ou `DEPARTED` (parti). Absent : toutes.", example: 'ACTIVE' },
      { name: 'professionCode', description: 'Filtre par profession.', example: 'DOCTOR' },
      { name: 'offset', description: 'Nombre de fiches à sauter (pagination).', example: 0 },
      { name: 'limit', description: 'Nombre de fiches par page (1 à 200).', example: 50 },
    ],
  })
  @RequirePermissions('staff:read') @Get()
  async list(
    @Query('search') search: string | undefined,
    @Query('status') status: string | undefined,
    @Query('professionCode') professionCode: string | undefined,
    @Query('offset', new DefaultValuePipe(0), ParseIntPipe) offset: number,
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit: number,
  ): Promise<StaffPageDto> {
    return unwrap(await this.listStaff.execute({ search, status, professionCode, offset, limit }));
  }

  @DocOperation({
    summary: 'Enregistrer un membre du personnel',
    description: 'Crée la fiche (sans compte de connexion : voir `PUT /staff/{id}/account`). Profession et spécialité doivent être des entrées actives des référentiels.',
    auth: 'bearer',
    responses: [{ status: 201, description: 'Fiche créée.', type: StaffDto }],
    errors: [400, 409, 422],
  })
  @RequirePermissions('staff:manage') @Post()
  async create(@CurrentUser() actor: AuthUser, @Body() dto: RegisterStaffDto): Promise<StaffDto> {
    return unwrap(await this.register.execute(actor.userId, dto));
  }

  @DocOperation({
    summary: 'Lire ma fiche et mes affectations',
    description: "La fiche reliée au compte connecté, avec ses affectations en cours ou à venir. 404 si aucune fiche n'est reliée au compte (p. ex. l'administrateur système).",
    auth: 'bearer',
    responses: [{ status: 200, description: 'Votre fiche et vos affectations.', type: MyProfileDto }],
    errors: [404],
  })
  @RequirePermissions('staff:read:own') @Get('me')
  async me(@CurrentUser() actor: AuthUser): Promise<MyProfileDto> {
    return unwrap(await this.myProfile.execute(actor.userId));
  }

  @DocOperation({
    summary: 'Lire une fiche',
    auth: 'bearer',
    responses: [{ status: 200, description: 'La fiche.', type: StaffDto }],
    errors: [400, 404],
    params: [ID],
  })
  @RequirePermissions('staff:read') @Get(':id')
  async get(@Param('id', ParseUUIDPipe) id: string): Promise<StaffDto> {
    return unwrap(await this.getStaff.execute(id));
  }

  @DocOperation({
    summary: 'Modifier une fiche',
    description: "Identité, profession, spécialité, coordonnées, embauche. Les champs absents restent inchangés ; `null` retire spécialité, e-mail, téléphone ou date d'embauche. Le matricule ne change jamais.",
    auth: 'bearer',
    responses: [{ status: 200, description: 'Fiche mise à jour.', type: StaffDto }],
    errors: [400, 404, 422],
    params: [ID],
  })
  @RequirePermissions('staff:manage') @Patch(':id')
  async update(@CurrentUser() actor: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateStaffDto): Promise<StaffDto> {
    return unwrap(await this.manage.update(actor.userId, id, dto));
  }

  @DocOperation({
    summary: 'Enregistrer le départ',
    description: "Date le départ (aujourd'hui par défaut) et **termine à cette date** les affectations qui se poursuivaient, dans la même opération. Refusé (422) si une affectation commence après cette date, et (409) si un départ est déjà enregistré.",
    auth: 'bearer',
    responses: [{ status: 200, description: 'Fiche mise à jour.', type: StaffDto }],
    errors: [400, 404, 409, 422],
    params: [ID],
  })
  @RequirePermissions('staff:manage') @HttpCode(200) @Post(':id/depart')
  async depart(@CurrentUser() actor: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: DepartStaffDto): Promise<StaffDto> {
    return unwrap(await this.manage.depart(actor.userId, id, dto));
  }

  @DocOperation({
    summary: 'Relier un compte de connexion',
    description: 'Un compte pour une fiche, et inversement. Relier le compte déjà relié à cette fiche ne change rien.',
    auth: 'bearer',
    responses: [{ status: 200, description: 'Fiche mise à jour.', type: StaffDto }],
    errors: [400, 404, 409, 422],
    params: [ID],
  })
  @RequirePermissions('staff:manage') @Put(':id/account')
  async linkAccount(@CurrentUser() actor: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: LinkAccountDto): Promise<StaffDto> {
    return unwrap(await this.manage.linkAccount(actor.userId, id, dto.userId));
  }

  @DocOperation({
    summary: 'Détacher le compte de connexion',
    description: 'La fiche et ses affectations sont conservées ; le compte lui-même n\'est pas modifié. Sans effet si aucun compte n\'est relié.',
    auth: 'bearer',
    responses: [{ status: 200, description: 'Fiche mise à jour.', type: StaffDto }],
    errors: [400, 404],
    params: [ID],
  })
  @RequirePermissions('staff:manage') @HttpCode(200) @Delete(':id/account')
  async unlinkAccount(@CurrentUser() actor: AuthUser, @Param('id', ParseUUIDPipe) id: string): Promise<StaffDto> {
    return unwrap(await this.manage.unlinkAccount(actor.userId, id));
  }
}
