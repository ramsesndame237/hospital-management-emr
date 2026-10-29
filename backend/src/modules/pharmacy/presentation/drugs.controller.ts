import { Body, Controller, DefaultValuePipe, Get, HttpCode, Param, ParseBoolPipe, ParseIntPipe, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { DocGroup, DocOperation } from '../../api-docs';
import type { DocParam } from '../../api-docs';
import { CurrentUser, RequirePermissions } from '../../iam/presentation/decorators';
import type { AuthUser } from '../../iam/presentation/decorators';
import { CreateDrugUseCase, GetDrugUseCase, ListDrugsUseCase, ManageDrugUseCases } from '../application/use-cases/catalog';
import { CreateDrugDto, DrugDto, DrugPageDto, UpdateDrugDto } from './dto/drugs.dto';
import { unwrap } from './http-errors';

const ID: DocParam = { name: 'id', description: 'Identifiant du médicament.', example: '5b0f2b8e-2f5d-4a8c-8f0e-7d9c1a3b4e60', format: 'uuid' };

@DocGroup(
  'Pharmacie · Catalogue des médicaments',
  [
    'Le formulaire de l’établissement : dénomination commune, forme, dosage, classe de délivrance (libre, ordonnance, contrôlée), conservation, code ATC, unité de dispensation, prix et seuil de réapprovisionnement.',
    '',
    '- Le **code** ne change jamais (les lots, les réceptions et, plus tard, les ordonnances y renvoient) ; rien n’est supprimé : un médicament retiré se **désactive** et ne peut plus être reçu.',
    '- Les prix sont des **entiers** en plus petite unité monétaire de l’installation.',
    '- Les médecins et les infirmiers consultent le formulaire ; le pharmacien (et l’administrateur système) le tient. Chaque modification est inscrite au journal d’audit, avec l’ancien et le nouveau prix.',
  ].join('\n'),
  57,
)
@Controller('api/v1/pharmacy/drugs')
export class PharmacyDrugsController {
  constructor(
    private readonly create: CreateDrugUseCase,
    private readonly manage: ManageDrugUseCases,
    private readonly getOne: GetDrugUseCase,
    private readonly listAll: ListDrugsUseCase,
  ) {}

  @DocOperation({
    summary: 'Lister les médicaments',
    description: 'Par défaut seuls les médicaments **actifs** sont renvoyés. Les filtres se cumulent.',
    auth: 'bearer',
    responses: [{ status: 200, description: 'Une page de médicaments, triés par dénomination commune puis nom.', type: DrugPageDto }],
    errors: [400, 422],
    query: [
      { name: 'search', description: 'Texte cherché dans le code, le nom et la dénomination commune (insensible à la casse).', example: 'paracé' },
      { name: 'form', description: 'Une forme galénique.', example: 'TABLET' },
      { name: 'schedule', description: 'Une classe de délivrance.', example: 'PRESCRIPTION' },
      { name: 'includeInactive', description: 'Inclure les médicaments retirés (`true` ou `false`, défaut `false`).', example: 'false' },
      { name: 'offset', description: 'Nombre de médicaments à sauter (pagination).', example: 0 },
      { name: 'limit', description: 'Nombre de médicaments par page (1 à 200).', example: 50 },
    ],
  })
  @RequirePermissions('pharmacy.catalog:read') @Get()
  async list(
    @Query('search') search: string | undefined,
    @Query('form') form: string | undefined,
    @Query('schedule') schedule: string | undefined,
    @Query('includeInactive', new DefaultValuePipe(false), ParseBoolPipe) includeInactive: boolean,
    @Query('offset', new DefaultValuePipe(0), ParseIntPipe) offset: number,
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit: number,
  ): Promise<DrugPageDto> {
    return unwrap(await this.listAll.execute({ search, form, schedule, includeInactive, offset, limit }));
  }

  @DocOperation({
    summary: 'Ajouter un médicament au formulaire',
    description: 'Le code est normalisé en majuscules et doit être libre (409 sinon).',
    auth: 'bearer',
    responses: [{ status: 201, description: 'Médicament créé (actif).', type: DrugDto }],
    errors: [400, 409, 422],
  })
  @RequirePermissions('pharmacy.catalog:manage') @Post()
  async createDrug(@CurrentUser() actor: AuthUser, @Body() dto: CreateDrugDto): Promise<DrugDto> {
    return unwrap(await this.create.execute(actor.userId, dto));
  }

  @DocOperation({
    summary: 'Lire un médicament',
    description: 'Sans son stock (voir `GET /pharmacy/drugs/{id}/stock`).',
    auth: 'bearer',
    responses: [{ status: 200, description: 'Le médicament.', type: DrugDto }],
    errors: [400, 404],
    params: [ID],
  })
  @RequirePermissions('pharmacy.catalog:read') @Get(':id')
  async get(@Param('id', ParseUUIDPipe) id: string): Promise<DrugDto> {
    return unwrap(await this.getOne.execute(id));
  }

  @DocOperation({
    summary: 'Modifier un médicament',
    description: 'Les champs absents sont inchangés ; `null` efface le dosage, le code ATC ou les remarques. Le code ne change pas. Un changement de prix inscrit l’ancien et le nouveau au journal d’audit.',
    auth: 'bearer',
    responses: [{ status: 200, description: 'Le médicament modifié.', type: DrugDto }],
    errors: [400, 404, 422],
    params: [ID],
  })
  @RequirePermissions('pharmacy.catalog:manage') @Patch(':id')
  async update(@CurrentUser() actor: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateDrugDto): Promise<DrugDto> {
    return unwrap(await this.manage.update(actor.userId, id, dto));
  }

  @DocOperation({
    summary: 'Retirer un médicament du formulaire',
    description: 'Il ne peut plus être reçu ; son stock existant reste visible et délivrable. Sans effet s’il est déjà inactif.',
    auth: 'bearer',
    responses: [{ status: 200, description: 'Le médicament désactivé.', type: DrugDto }],
    errors: [400, 404],
    params: [ID],
  })
  @RequirePermissions('pharmacy.catalog:manage') @HttpCode(200) @Post(':id/deactivate')
  async deactivate(@CurrentUser() actor: AuthUser, @Param('id', ParseUUIDPipe) id: string): Promise<DrugDto> {
    return unwrap(await this.manage.setActive(actor.userId, id, false));
  }

  @DocOperation({
    summary: 'Remettre un médicament au formulaire',
    description: 'Sans effet s’il est déjà actif.',
    auth: 'bearer',
    responses: [{ status: 200, description: 'Le médicament réactivé.', type: DrugDto }],
    errors: [400, 404],
    params: [ID],
  })
  @RequirePermissions('pharmacy.catalog:manage') @HttpCode(200) @Post(':id/activate')
  async activate(@CurrentUser() actor: AuthUser, @Param('id', ParseUUIDPipe) id: string): Promise<DrugDto> {
    return unwrap(await this.manage.setActive(actor.userId, id, true));
  }
}
