import { Body, Controller, DefaultValuePipe, Get, HttpCode, Param, ParseBoolPipe, ParseIntPipe, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { DocGroup, DocOperation } from '../../api-docs';
import type { DocParam } from '../../api-docs';
import { CurrentUser, RequirePermissions } from '../../iam/presentation/decorators';
import type { AuthUser } from '../../iam/presentation/decorators';
import { CreateItemUseCase, GetItemUseCase, ListItemsUseCase, ManageItemUseCases } from '../application/use-cases/catalog';
import { CreateItemDto, ItemDto, ItemPageDto, UpdateItemDto } from './dto/billing.dto';
import { unwrap } from './http-errors';

const ID: DocParam = { name: 'id', description: "Identifiant de l'acte.", example: '5b0f2b8e-2f5d-4a8c-8f0e-7d9c1a3b4e60', format: 'uuid' };

@DocGroup(
  'Facturation · Catalogue des actes',
  [
    "Les actes facturables et leur prix : consultations, examens, médicaments, hospitalisation…",
    '',
    "- **Montants** : entiers dans la plus petite unité de la devise de l'installation (le franc CFA n'a pas de centimes). Jamais de nombre décimal.",
    "- Le **code** ne change jamais (les factures y renvoient) ; rien n'est supprimé : un acte retiré du catalogue se **désactive** et ne peut plus être facturé.",
    "- Changer un prix ne touche **jamais** une facture déjà établie : chaque ligne garde une copie du code, du libellé et du prix.",
    "- La caisse, la comptabilité et l'accueil lisent le catalogue ; seul l'administrateur système le modifie. Chaque modification est inscrite au journal d'audit (avec l'ancien prix).",
  ].join('\n'),
  50,
)
@Controller('api/v1/billing/items')
export class BillingCatalogController {
  constructor(
    private readonly create: CreateItemUseCase,
    private readonly manage: ManageItemUseCases,
    private readonly getOne: GetItemUseCase,
    private readonly listAll: ListItemsUseCase,
  ) {}

  @DocOperation({
    summary: 'Lister les actes',
    description: 'Par défaut seuls les actes **actifs** sont renvoyés (ceux qu\'on peut facturer). Les filtres se cumulent.',
    auth: 'bearer',
    responses: [{ status: 200, description: 'Une page d\'actes, triés par code.', type: ItemPageDto }],
    errors: [400, 422],
    query: [
      { name: 'search', description: 'Texte cherché dans le code et le libellé (insensible à la casse).', example: 'consult' },
      { name: 'category', description: 'Une catégorie.', example: 'CONSULTATION' },
      { name: 'serviceId', description: 'Un service.', example: '9b1c0a5e-34d2-4b8e-a8c1-52f3b7a1d001' },
      { name: 'includeInactive', description: 'Inclure les actes retirés (`true` ou `false`, défaut `false`).', example: 'false' },
      { name: 'offset', description: "Nombre d'actes à sauter (pagination).", example: 0 },
      { name: 'limit', description: "Nombre d'actes par page (1 à 200).", example: 50 },
    ],
  })
  @RequirePermissions('billing.catalog:read') @Get()
  async list(
    @Query('search') search: string | undefined,
    @Query('category') category: string | undefined,
    @Query('serviceId') serviceId: string | undefined,
    @Query('includeInactive', new DefaultValuePipe(false), ParseBoolPipe) includeInactive: boolean,
    @Query('offset', new DefaultValuePipe(0), ParseIntPipe) offset: number,
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit: number,
  ): Promise<ItemPageDto> {
    return unwrap(await this.listAll.execute({ search, category, serviceId, includeInactive, offset, limit }));
  }

  @DocOperation({
    summary: 'Ajouter un acte',
    description: "Le code est unique et ne pourra plus être modifié. L'acte est créé **actif**. Le service, s'il est donné, doit exister et être actif.",
    auth: 'bearer',
    responses: [{ status: 201, description: 'Acte créé.', type: ItemDto }],
    errors: [400, 404, 409, 422],
  })
  @RequirePermissions('billing.catalog:manage') @Post()
  async createItem(@CurrentUser() actor: AuthUser, @Body() dto: CreateItemDto): Promise<ItemDto> {
    return unwrap(await this.create.execute(actor.userId, dto));
  }

  @DocOperation({
    summary: 'Lire un acte',
    auth: 'bearer',
    responses: [{ status: 200, description: "L'acte.", type: ItemDto }],
    errors: [400, 404],
    params: [ID],
  })
  @RequirePermissions('billing.catalog:read') @Get(':id')
  async get(@Param('id', ParseUUIDPipe) id: string): Promise<ItemDto> {
    return unwrap(await this.getOne.execute(id));
  }

  @DocOperation({
    summary: 'Modifier un acte',
    description: "Change le libellé, la catégorie, le prix et/ou le service. Champs absents : inchangés ; `serviceId: null` détache l'acte de son service. Le code ne change jamais. Les factures déjà établies gardent l'ancien prix.",
    auth: 'bearer',
    responses: [{ status: 200, description: 'Acte mis à jour.', type: ItemDto }],
    errors: [400, 404, 409, 422],
    params: [ID],
  })
  @RequirePermissions('billing.catalog:manage') @Patch(':id')
  async update(@CurrentUser() actor: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateItemDto): Promise<ItemDto> {
    return unwrap(await this.manage.update(actor.userId, id, dto));
  }

  @DocOperation({
    summary: 'Retirer un acte du catalogue',
    description: "L'acte ne peut plus être ajouté à une facture ; il reste lisible et les factures existantes ne changent pas. Réversible avec `activate`.",
    auth: 'bearer',
    responses: [{ status: 200, description: 'Acte désactivé.', type: ItemDto }],
    errors: [400, 404],
    params: [ID],
  })
  @RequirePermissions('billing.catalog:manage') @HttpCode(200) @Post(':id/deactivate')
  async deactivate(@CurrentUser() actor: AuthUser, @Param('id', ParseUUIDPipe) id: string): Promise<ItemDto> {
    return unwrap(await this.manage.setActive(actor.userId, id, false));
  }

  @DocOperation({
    summary: 'Remettre un acte au catalogue',
    auth: 'bearer',
    responses: [{ status: 200, description: 'Acte réactivé.', type: ItemDto }],
    errors: [400, 404],
    params: [ID],
  })
  @RequirePermissions('billing.catalog:manage') @HttpCode(200) @Post(':id/activate')
  async activate(@CurrentUser() actor: AuthUser, @Param('id', ParseUUIDPipe) id: string): Promise<ItemDto> {
    return unwrap(await this.manage.setActive(actor.userId, id, true));
  }
}
