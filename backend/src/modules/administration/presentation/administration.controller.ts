import { Body, Controller, DefaultValuePipe, Get, HttpCode, Param, ParseIntPipe, ParseUUIDPipe, Patch, Post, Put, Query } from '@nestjs/common';
import { DocGroup, DocOperation } from '../../api-docs';
import type { DocParam } from '../../api-docs';
import { CurrentUser, RequirePermissions } from '../../iam/presentation/decorators';
import type { AuthUser } from '../../iam/presentation/decorators';
import { GetFacilityUseCase, ListFacilitiesUseCase, ManageFacilityUseCases, RegisterFacilityUseCase } from '../application/use-cases/facilities';
import { GetOrganizationUseCase, SetupOrganizationUseCase } from '../application/use-cases/organization';
import { ChangeFacilityStatusDto, FacilityDto, FacilityPageDto, OrganizationDto, RegisterFacilityDto, SetupOrganizationDto, UpdateFacilityDto } from './dto/administration.dto';
import { unwrap } from './http-errors';

const ID: DocParam = { name: 'id', description: "Identifiant de l'établissement.", example: '7c1e0c1e-6f2a-4f55-8c61-0b6f3e0d9a21', format: 'uuid' };

@DocGroup(
  'Organisation et établissements',
  [
    "Structure de l'installation : **une organisation** (l'hôpital ou le groupe) et ses **établissements** (sites).",
    '',
    "- L'organisation est unique par installation ; la configurer deux fois la renomme.",
    '- Un établissement créé sans statut est « en construction » : il n\'est pas opérationnel.',
    '- Chaque création, modification ou changement de statut est inscrit au journal d\'audit, avec l\'ancienne valeur.',
  ].join('\n'),
  30,
)
@Controller('api/v1')
export class AdministrationController {
  constructor(
    private readonly getOrganization: GetOrganizationUseCase,
    private readonly setupOrganization: SetupOrganizationUseCase,
    private readonly listFacilities: ListFacilitiesUseCase,
    private readonly getFacility: GetFacilityUseCase,
    private readonly registerFacility: RegisterFacilityUseCase,
    private readonly manageFacilities: ManageFacilityUseCases,
  ) {}

  @DocOperation({
    summary: "Lire l'organisation",
    auth: 'bearer',
    responses: [{ status: 200, description: "L'organisation de l'installation.", type: OrganizationDto }],
    errors: [404],
  })
  @RequirePermissions('administration.organization:read') @Get('organization')
  async organization(): Promise<OrganizationDto> {
    return unwrap(await this.getOrganization.execute());
  }

  @DocOperation({
    summary: "Configurer l'organisation",
    description: "Crée l'organisation au premier appel, la **renomme** ensuite. Rejouer le même nom ne change rien.",
    auth: 'bearer',
    responses: [{ status: 200, description: "L'organisation à jour.", type: OrganizationDto }],
    errors: [400, 422],
  })
  @RequirePermissions('administration.organization:manage') @Put('organization')
  async setup(@CurrentUser() actor: AuthUser, @Body() dto: SetupOrganizationDto): Promise<OrganizationDto> {
    return unwrap(await this.setupOrganization.execute(actor.userId, dto));
  }

  @DocOperation({
    summary: 'Lister les établissements',
    auth: 'bearer',
    responses: [{ status: 200, description: 'Une page d\'établissements, triés par nom.', type: FacilityPageDto }],
    query: [
      { name: 'offset', description: "Nombre d'établissements à sauter (pagination).", example: 0 },
      { name: 'limit', description: "Nombre d'établissements par page (1 à 200).", example: 50 },
    ],
  })
  @RequirePermissions('administration.facilities:read') @Get('facilities')
  list(
    @Query('offset', new DefaultValuePipe(0), ParseIntPipe) offset: number,
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit: number,
  ): Promise<FacilityPageDto> {
    return this.listFacilities.execute(offset, limit);
  }

  @DocOperation({
    summary: 'Lire un établissement',
    auth: 'bearer',
    responses: [{ status: 200, description: "L'établissement.", type: FacilityDto }],
    errors: [400, 404],
    params: [ID],
  })
  @RequirePermissions('administration.facilities:read') @Get('facilities/:id')
  async get(@Param('id', ParseUUIDPipe) id: string): Promise<FacilityDto> {
    return unwrap(await this.getFacility.execute(id));
  }

  @DocOperation({
    summary: 'Enregistrer un établissement',
    description: "Rattache un nouvel établissement à l'organisation, qui doit déjà être configurée. Le code est unique. Sans `status`, l'établissement est « en construction ».",
    auth: 'bearer',
    responses: [{ status: 201, description: 'Établissement créé.', type: FacilityDto }],
    errors: [400, 404, 409, 422],
  })
  @RequirePermissions('administration.facilities:manage') @Post('facilities')
  async register(@CurrentUser() actor: AuthUser, @Body() dto: RegisterFacilityDto): Promise<FacilityDto> {
    return unwrap(await this.registerFacility.execute(actor.userId, dto));
  }

  @DocOperation({
    summary: 'Modifier un établissement',
    description: 'Change le nom et/ou le code. Les champs absents restent inchangés. Le statut se change séparément.',
    auth: 'bearer',
    responses: [{ status: 200, description: 'Établissement mis à jour.', type: FacilityDto }],
    errors: [400, 404, 409, 422],
    params: [ID],
  })
  @RequirePermissions('administration.facilities:manage') @Patch('facilities/:id')
  async update(@CurrentUser() actor: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateFacilityDto): Promise<FacilityDto> {
    return unwrap(await this.manageFacilities.update(actor.userId, id, dto));
  }

  @DocOperation({
    summary: "Changer le statut d'un établissement",
    description: "L'ancien statut est conservé dans le journal d'audit. Demander le statut actuel ne change rien.",
    auth: 'bearer',
    responses: [{ status: 200, description: 'Établissement mis à jour.', type: FacilityDto }],
    errors: [400, 404, 422],
    params: [ID],
  })
  @RequirePermissions('administration.facilities:manage') @HttpCode(200) @Post('facilities/:id/status')
  async changeStatus(@CurrentUser() actor: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: ChangeFacilityStatusDto): Promise<FacilityDto> {
    return unwrap(await this.manageFacilities.changeStatus(actor.userId, id, dto.status));
  }
}
