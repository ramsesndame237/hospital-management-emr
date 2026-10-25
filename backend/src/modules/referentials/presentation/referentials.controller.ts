import { Body, Controller, DefaultValuePipe, Get, HttpCode, Param, ParseBoolPipe, ParseIntPipe, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { DocGroup, DocOperation } from '../../api-docs';
import type { DocParam } from '../../api-docs';
import { CurrentUser, RequirePermissions } from '../../iam/presentation/decorators';
import type { AuthUser } from '../../iam/presentation/decorators';
import { ListCatalogsUseCase, ListEntriesUseCase, ManageEntriesUseCases } from '../application/use-cases/referentials';
import { CatalogDto, CreateEntryDto, EntryDto, EntryPageDto, UpdateEntryDto } from './dto/referentials.dto';
import { unwrap } from './http-errors';

const CATALOG: DocParam = { name: 'catalog', description: 'Code du catalogue (voir `GET /api/v1/referentials`).', example: 'SPECIALTY' };
const ID: DocParam = { name: 'id', description: "Identifiant de l'entrée.", example: '2f6d1f6e-9a0c-4b5e-8f2e-6a1d4c9b7e10', format: 'uuid' };

@DocGroup(
  'Référentiels',
  [
    'Nomenclatures de l\'établissement : spécialités, unités de mesure, motifs de consultation…',
    '',
    '- Les **catalogues** sont fixés par l\'application ; les **entrées** sont gérées par les administrateurs.',
    '- Chaque entrée porte un **code stable** (jamais modifié) et un libellé **par langue**.',
    '- Une entrée n\'est **jamais supprimée** (d\'autres données y renvoient) : on la **désactive**. Elle reste lisible mais n\'est plus proposée à la saisie.',
    "- Tout le personnel peut lire ; seul l'administrateur système peut modifier. Chaque modification est inscrite au journal d'audit.",
  ].join('\n'),
  40,
)
@Controller('api/v1/referentials')
export class ReferentialsController {
  constructor(
    private readonly listCatalogs: ListCatalogsUseCase,
    private readonly listEntries: ListEntriesUseCase,
    private readonly manage: ManageEntriesUseCases,
  ) {}

  @DocOperation({
    summary: 'Lister les catalogues',
    auth: 'bearer',
    responses: [{ status: 200, description: 'Tous les catalogues, avec leur nombre d\'entrées.', type: CatalogDto, isArray: true }],
  })
  @RequirePermissions('referentials:read') @Get()
  catalogs(): Promise<CatalogDto[]> {
    return this.listCatalogs.execute();
  }

  @DocOperation({
    summary: "Lister les entrées d'un catalogue",
    description: 'Par défaut, seules les entrées **actives** sont renvoyées (celles qu\'on propose à la saisie). `includeInactive=true` ajoute les entrées désactivées.',
    auth: 'bearer',
    responses: [{ status: 200, description: 'Une page d\'entrées.', type: EntryPageDto }],
    errors: [400, 404],
    params: [CATALOG],
    query: [
      { name: 'includeInactive', description: 'Inclure les entrées désactivées (`true` ou `false`, défaut `false`).', example: 'false' },
      { name: 'search', description: 'Texte cherché dans le code et les libellés (insensible à la casse).', example: 'pédi' },
      { name: 'offset', description: "Nombre d'entrées à sauter (pagination).", example: 0 },
      { name: 'limit', description: "Nombre d'entrées par page (1 à 200).", example: 50 },
    ],
  })
  @RequirePermissions('referentials:read') @Get(':catalog/entries')
  async entries(
    @Param('catalog') catalog: string,
    @Query('includeInactive', new DefaultValuePipe(false), ParseBoolPipe) includeInactive: boolean,
    @Query('search') search: string | undefined,
    @Query('offset', new DefaultValuePipe(0), ParseIntPipe) offset: number,
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit: number,
  ): Promise<EntryPageDto> {
    return unwrap(await this.listEntries.execute(catalog, { includeInactive, search, offset, limit }));
  }

  @DocOperation({
    summary: 'Ajouter une entrée',
    description: 'Le code est unique dans le catalogue et ne pourra plus être modifié. L\'entrée est créée **active**.',
    auth: 'bearer',
    responses: [{ status: 201, description: 'Entrée créée.', type: EntryDto }],
    errors: [400, 404, 409, 422],
    params: [CATALOG],
  })
  @RequirePermissions('referentials:manage') @Post(':catalog/entries')
  async create(@CurrentUser() actor: AuthUser, @Param('catalog') catalog: string, @Body() dto: CreateEntryDto): Promise<EntryDto> {
    return unwrap(await this.manage.create(actor.userId, catalog, dto));
  }

  @DocOperation({
    summary: 'Modifier une entrée',
    description: "Change les libellés (qui **remplacent** les actuels) et/ou la position. Le code ne change jamais. Les champs absents restent inchangés.",
    auth: 'bearer',
    responses: [{ status: 200, description: 'Entrée mise à jour.', type: EntryDto }],
    errors: [400, 404, 422],
    params: [CATALOG, ID],
  })
  @RequirePermissions('referentials:manage') @Patch(':catalog/entries/:id')
  async update(@CurrentUser() actor: AuthUser, @Param('catalog') catalog: string, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateEntryDto): Promise<EntryDto> {
    return unwrap(await this.manage.update(actor.userId, catalog, id, dto));
  }

  @DocOperation({
    summary: 'Désactiver une entrée',
    description: "L'entrée n'est plus proposée à la saisie mais reste lisible pour les données existantes. Réversible avec `activate`. Sans effet si elle est déjà désactivée.",
    auth: 'bearer',
    responses: [{ status: 200, description: 'Entrée désactivée.', type: EntryDto }],
    errors: [400, 404],
    params: [CATALOG, ID],
  })
  @RequirePermissions('referentials:manage') @HttpCode(200) @Post(':catalog/entries/:id/deactivate')
  async deactivate(@CurrentUser() actor: AuthUser, @Param('catalog') catalog: string, @Param('id', ParseUUIDPipe) id: string): Promise<EntryDto> {
    return unwrap(await this.manage.setActive(actor.userId, catalog, id, false));
  }

  @DocOperation({
    summary: 'Réactiver une entrée',
    auth: 'bearer',
    responses: [{ status: 200, description: 'Entrée réactivée.', type: EntryDto }],
    errors: [400, 404],
    params: [CATALOG, ID],
  })
  @RequirePermissions('referentials:manage') @HttpCode(200) @Post(':catalog/entries/:id/activate')
  async activate(@CurrentUser() actor: AuthUser, @Param('catalog') catalog: string, @Param('id', ParseUUIDPipe) id: string): Promise<EntryDto> {
    return unwrap(await this.manage.setActive(actor.userId, catalog, id, true));
  }
}
