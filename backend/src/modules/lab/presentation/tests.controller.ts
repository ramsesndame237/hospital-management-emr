import { Body, Controller, DefaultValuePipe, Get, HttpCode, Param, ParseBoolPipe, ParseIntPipe, ParseUUIDPipe, Patch, Post, Put, Query } from '@nestjs/common';
import { DocGroup, DocOperation } from '../../api-docs';
import type { DocParam } from '../../api-docs';
import { CurrentUser, RequirePermissions } from '../../iam/presentation/decorators';
import type { AuthUser } from '../../iam/presentation/decorators';
import { CreateTestUseCase, GetTestUseCase, ListTestsUseCase, ManageTestUseCases } from '../application/use-cases/catalog';
import { CreateTestDto, SetRangesDto, TestDto, TestPageDto, UpdateTestDto } from './dto/tests.dto';
import { unwrap } from './http-errors';

const ID: DocParam = { name: 'id', description: "Identifiant de l'analyse.", example: '5b0f2b8e-2f5d-4a8c-8f0e-7d9c1a3b4e60', format: 'uuid' };

@DocGroup(
  'Laboratoire · Catalogue des analyses',
  [
    "Les analyses que le laboratoire réalise : section, échantillon et contenant, type de résultat, délai de rendu, et **valeurs de référence** par sexe et tranche d'âge avec seuils critiques.",
    '',
    "- Le **code** et le **type de résultat** ne changent jamais (les demandes et les résultats y renvoient) ; rien n'est supprimé : une analyse retirée se **désactive** et ne peut plus être demandée.",
    "- Une analyse `NUMERIC` a une unité et des valeurs de référence ; une analyse `CHOICE` une liste de valeurs admises ; une analyse `TEXT` un texte libre.",
    "- Les médecins et le laboratoire lisent le catalogue ; seul l'administrateur système le modifie. Chaque modification est inscrite au journal d'audit.",
  ].join('\n'),
  54,
)
@Controller('api/v1/lab/tests')
export class LabTestsController {
  constructor(
    private readonly create: CreateTestUseCase,
    private readonly manage: ManageTestUseCases,
    private readonly getOne: GetTestUseCase,
    private readonly listAll: ListTestsUseCase,
  ) {}

  @DocOperation({
    summary: 'Lister les analyses',
    description: "Par défaut seules les analyses **actives** sont renvoyées (celles qu'on peut demander). Les filtres se cumulent.",
    auth: 'bearer',
    responses: [{ status: 200, description: "Une page d'analyses, triées par section puis code.", type: TestPageDto }],
    errors: [400, 422],
    query: [
      { name: 'search', description: 'Texte cherché dans le code et le libellé (insensible à la casse).', example: 'hémo' },
      { name: 'section', description: 'Une section du laboratoire.', example: 'HAEMATOLOGY' },
      { name: 'includeInactive', description: 'Inclure les analyses retirées (`true` ou `false`, défaut `false`).', example: 'false' },
      { name: 'offset', description: "Nombre d'analyses à sauter (pagination).", example: 0 },
      { name: 'limit', description: "Nombre d'analyses par page (1 à 200).", example: 50 },
    ],
  })
  @RequirePermissions('lab.catalog:read') @Get()
  async list(
    @Query('search') search: string | undefined,
    @Query('section') section: string | undefined,
    @Query('includeInactive', new DefaultValuePipe(false), ParseBoolPipe) includeInactive: boolean,
    @Query('offset', new DefaultValuePipe(0), ParseIntPipe) offset: number,
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit: number,
  ): Promise<TestPageDto> {
    return unwrap(await this.listAll.execute({ search, section, includeInactive, offset, limit }));
  }

  @DocOperation({
    summary: 'Créer une analyse',
    description: 'Le code est normalisé en majuscules et doit être libre (409 sinon). Les valeurs de référence ne se donnent que pour une analyse numérique ; deux tranches du même sexe ne se chevauchent pas.',
    auth: 'bearer',
    responses: [{ status: 201, description: 'Analyse créée (active).', type: TestDto }],
    errors: [400, 409, 422],
  })
  @RequirePermissions('lab.catalog:manage') @Post()
  async createTest(@CurrentUser() actor: AuthUser, @Body() dto: CreateTestDto): Promise<TestDto> {
    return unwrap(await this.create.execute(actor.userId, dto));
  }

  @DocOperation({
    summary: 'Lire une analyse',
    description: 'Avec ses valeurs de référence.',
    auth: 'bearer',
    responses: [{ status: 200, description: "L'analyse.", type: TestDto }],
    errors: [400, 404],
    params: [ID],
  })
  @RequirePermissions('lab.catalog:read') @Get(':id')
  async get(@Param('id', ParseUUIDPipe) id: string): Promise<TestDto> {
    return unwrap(await this.getOne.execute(id));
  }

  @DocOperation({
    summary: 'Modifier une analyse',
    description: 'Les champs absents sont inchangés. Le code et le type de résultat ne changent pas (champs ignorés). Les champs modifiés sont inscrits au journal.',
    auth: 'bearer',
    responses: [{ status: 200, description: "L'analyse modifiée.", type: TestDto }],
    errors: [400, 404, 422],
    params: [ID],
  })
  @RequirePermissions('lab.catalog:manage') @Patch(':id')
  async update(@CurrentUser() actor: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateTestDto): Promise<TestDto> {
    return unwrap(await this.manage.update(actor.userId, id, dto));
  }

  @DocOperation({
    summary: 'Remplacer les valeurs de référence',
    description: "Remplace d'un bloc toutes les tranches (analyse numérique seulement). Seuils ordonnés (critique bas ≤ limite basse ≤ limite haute ≤ critique haut), tranches du même sexe sans chevauchement.",
    auth: 'bearer',
    responses: [{ status: 200, description: "L'analyse avec ses nouvelles valeurs de référence.", type: TestDto }],
    errors: [400, 404, 422],
    params: [ID],
  })
  @RequirePermissions('lab.catalog:manage') @Put(':id/ranges')
  async setRanges(@CurrentUser() actor: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: SetRangesDto): Promise<TestDto> {
    return unwrap(await this.manage.setRanges(actor.userId, id, dto.ranges));
  }

  @DocOperation({
    summary: 'Retirer une analyse du catalogue',
    description: 'Elle ne peut plus être demandée ; les demandes déjà faites ne changent pas. Sans effet si elle est déjà inactive.',
    auth: 'bearer',
    responses: [{ status: 200, description: "L'analyse désactivée.", type: TestDto }],
    errors: [400, 404],
    params: [ID],
  })
  @RequirePermissions('lab.catalog:manage') @HttpCode(200) @Post(':id/deactivate')
  async deactivate(@CurrentUser() actor: AuthUser, @Param('id', ParseUUIDPipe) id: string): Promise<TestDto> {
    return unwrap(await this.manage.setActive(actor.userId, id, false));
  }

  @DocOperation({
    summary: 'Remettre une analyse au catalogue',
    description: 'Sans effet si elle est déjà active.',
    auth: 'bearer',
    responses: [{ status: 200, description: "L'analyse réactivée.", type: TestDto }],
    errors: [400, 404],
    params: [ID],
  })
  @RequirePermissions('lab.catalog:manage') @HttpCode(200) @Post(':id/activate')
  async activate(@CurrentUser() actor: AuthUser, @Param('id', ParseUUIDPipe) id: string): Promise<TestDto> {
    return unwrap(await this.manage.setActive(actor.userId, id, true));
  }
}
