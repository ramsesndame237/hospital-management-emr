import { Body, Controller, DefaultValuePipe, Get, HttpCode, Param, ParseIntPipe, ParseUUIDPipe, Post, Put, Query } from '@nestjs/common';
import { DocGroup, DocOperation } from '../../api-docs';
import type { DocParam } from '../../api-docs';
import { CurrentUser, RequirePermissions } from '../../iam/presentation/decorators';
import type { AuthUser } from '../../iam/presentation/decorators';
import { ListOrdersUseCase, OrderUseCases, SuggestOrdersUseCase } from '../application/use-cases/orders';
import { OrderDto, OrderInputDto, OrderPageDto, OrderReasonDto, OrderRejectDto, SuggestionListDto } from './dto/orders.dto';
import { unwrap } from './http-errors';

const ID: DocParam = { name: 'id', description: 'Identifiant du bon de commande.', example: '5b0f2b8e-2f5d-4a8c-8f0e-7d9c1a3b4e60', format: 'uuid' };

@DocGroup(
  'Pharmacie · Bons de commande',
  [
    'Les commandes de médicaments aux fournisseurs, de la préparation à la réception.',
    '',
    '- Un bon se prépare en **brouillon**, part à l’approbation (`submit`) et ne peut être approuvé que par un **autre** que son auteur ; un refus (motivé) le renvoie en brouillon.',
    '- Une fois approuvé, les réceptions s’y **imputent** (`POST /pharmacy/receipts` avec `purchaseOrderId`) : jamais plus que commandé. Il devient `PARTIALLY_RECEIVED` puis `RECEIVED`.',
    '- Après une réception partielle dont le solde ne viendra pas, on **clôt** le bon (ce qui est arrivé reste en stock) ; sans réception, on l’**annule**. Dans les deux cas le motif est obligatoire.',
    '- `GET /pharmacy/orders/suggestions` propose les médicaments à recommander (stock bas ou en rupture, déduction faite de ce qui est déjà commandé).',
  ].join('\n'),
  59.2,
)
@Controller('api/v1/pharmacy/orders')
export class PharmacyOrdersController {
  constructor(private readonly orders: OrderUseCases, private readonly listAll: ListOrdersUseCase, private readonly suggest: SuggestOrdersUseCase) {}

  @DocOperation({
    summary: 'Médicaments à recommander',
    description: 'Ceux dont le stock délivrable, augmenté de ce qui est déjà commandé, n’excède pas le seuil de réapprovisionnement ; les médicaments sans seuil ne sont jamais proposés. Quantité proposée : de quoi revenir à deux fois le seuil.',
    auth: 'bearer',
    responses: [{ status: 200, description: 'Les suggestions, ruptures d’abord.', type: SuggestionListDto }],
    errors: [],
  })
  @RequirePermissions('pharmacy.procurement:read') @Get('suggestions')
  async suggestions(): Promise<SuggestionListDto> {
    return this.suggest.execute();
  }

  @DocOperation({
    summary: 'Lister les bons de commande',
    description: 'Les bons à approuver d’abord par ancienneté (`status=PENDING_APPROVAL`), sinon du plus récent au plus ancien. `mine=true` ne garde que ceux que vous avez établis.',
    auth: 'bearer',
    responses: [{ status: 200, description: 'Une page de bons.', type: OrderPageDto }],
    errors: [400, 404, 422],
    query: [
      { name: 'status', description: 'Un statut de bon.', example: 'PENDING_APPROVAL' },
      { name: 'supplierId', description: 'Un fournisseur.', example: '5b0f2b8e-2f5d-4a8c-8f0e-7d9c1a3b4e60' },
      { name: 'drugId', description: 'Seulement les bons qui commandent ce médicament.', example: '5b0f2b8e-2f5d-4a8c-8f0e-7d9c1a3b4e60' },
      { name: 'mine', description: 'Seulement mes bons (`true`).', example: 'false' },
      { name: 'offset', description: 'Nombre de bons à sauter.', example: 0 },
      { name: 'limit', description: 'Nombre de bons par page (1 à 200).', example: 50 },
    ],
  })
  @RequirePermissions('pharmacy.procurement:read') @Get()
  async list(
    @CurrentUser() actor: AuthUser,
    @Query('status') status: string | undefined,
    @Query('supplierId') supplierId: string | undefined,
    @Query('drugId') drugId: string | undefined,
    @Query('mine') mine: string | undefined,
    @Query('offset', new DefaultValuePipe(0), ParseIntPipe) offset: number,
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit: number,
  ): Promise<OrderPageDto> {
    return unwrap(await this.listAll.execute({ status, supplierId, drugId, mine: mine === 'true' ? actor.userId : undefined, offset, limit }));
  }

  @DocOperation({
    summary: 'Établir un bon de commande',
    description: 'Crée un **brouillon**. Refus : fournisseur inconnu (404) ou écarté (409), médicament inconnu (404) ou retiré (409), même médicament deux fois (422), date de livraison passée (422).',
    auth: 'bearer',
    responses: [{ status: 201, description: 'Le brouillon, avec son numéro.', type: OrderDto }],
    errors: [400, 404, 409, 422],
  })
  @RequirePermissions('pharmacy.procurement:manage') @Post()
  async create(@CurrentUser() actor: AuthUser, @Body() dto: OrderInputDto): Promise<OrderDto> {
    return unwrap(await this.orders.create(actor.userId, dto));
  }

  @DocOperation({
    summary: 'Lire un bon de commande',
    description: 'Avec ses lignes (commandé, reçu, reste à recevoir), son historique d’approbation et sa valeur.',
    auth: 'bearer',
    responses: [{ status: 200, description: 'Le bon.', type: OrderDto }],
    errors: [400, 404],
    params: [ID],
  })
  @RequirePermissions('pharmacy.procurement:read') @Get(':id')
  async get(@Param('id', ParseUUIDPipe) id: string): Promise<OrderDto> {
    return unwrap(await this.orders.get(id));
  }

  @DocOperation({
    summary: 'Modifier un brouillon',
    description: 'Remplace d’un bloc le contenu (fournisseur, lignes, date, remarques). Seulement en brouillon, y compris après un refus (409 sinon).',
    auth: 'bearer',
    responses: [{ status: 200, description: 'Le brouillon modifié.', type: OrderDto }],
    errors: [400, 404, 409, 422],
    params: [ID],
  })
  @RequirePermissions('pharmacy.procurement:manage') @Put(':id')
  async update(@CurrentUser() actor: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: OrderInputDto): Promise<OrderDto> {
    return unwrap(await this.orders.update(actor.userId, id, dto));
  }

  @DocOperation({
    summary: 'Soumettre un bon à l’approbation',
    description: 'Le brouillon passe à `PENDING_APPROVAL` (le dernier refus est effacé). 409 si le bon n’est pas un brouillon.',
    auth: 'bearer',
    responses: [{ status: 200, description: 'Le bon, à approuver.', type: OrderDto }],
    errors: [400, 404, 409],
    params: [ID],
  })
  @RequirePermissions('pharmacy.procurement:manage') @HttpCode(200) @Post(':id/submit')
  async submit(@CurrentUser() actor: AuthUser, @Param('id', ParseUUIDPipe) id: string): Promise<OrderDto> {
    return unwrap(await this.orders.submit(actor.userId, id));
  }

  @DocOperation({
    summary: 'Approuver un bon de commande',
    description: 'Le bon passe à `APPROVED` et peut recevoir ses livraisons. Refus : vous en êtes l’auteur (409), il n’est pas à approuver (409).',
    auth: 'bearer',
    responses: [{ status: 200, description: 'Le bon approuvé.', type: OrderDto }],
    errors: [400, 404, 409],
    params: [ID],
  })
  @RequirePermissions('pharmacy.procurement:approve') @HttpCode(200) @Post(':id/approve')
  async approve(@CurrentUser() actor: AuthUser, @Param('id', ParseUUIDPipe) id: string): Promise<OrderDto> {
    return unwrap(await this.orders.approve(actor.userId, id));
  }

  @DocOperation({
    summary: 'Refuser un bon de commande',
    description: 'Le bon revient en **brouillon** avec le motif du refus : son auteur le corrige et le soumet de nouveau. Le motif est obligatoire. Refus : vous en êtes l’auteur (409), il n’est pas à approuver (409).',
    auth: 'bearer',
    responses: [{ status: 200, description: 'Le bon, revenu en brouillon.', type: OrderDto }],
    errors: [400, 404, 409, 422],
    params: [ID],
  })
  @RequirePermissions('pharmacy.procurement:approve') @HttpCode(200) @Post(':id/reject')
  async reject(@CurrentUser() actor: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: OrderRejectDto): Promise<OrderDto> {
    return unwrap(await this.orders.reject(actor.userId, id, dto.comment));
  }

  @DocOperation({
    summary: 'Annuler un bon de commande',
    description: 'Possible tant que rien n’a été reçu (brouillon, à approuver, approuvé). Après une réception partielle, on clôt le bon. Le motif est obligatoire.',
    auth: 'bearer',
    responses: [{ status: 200, description: 'Le bon annulé.', type: OrderDto }],
    errors: [400, 404, 409, 422],
    params: [ID],
  })
  @RequirePermissions('pharmacy.procurement:manage') @HttpCode(200) @Post(':id/cancel')
  async cancel(@CurrentUser() actor: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: OrderReasonDto): Promise<OrderDto> {
    return unwrap(await this.orders.cancel(actor.userId, id, dto.reason));
  }

  @DocOperation({
    summary: 'Clore un bon partiellement reçu',
    description: 'Le solde ne viendra pas : le bon passe à `CLOSED` ; ce qui est arrivé reste en stock. Seulement pour un bon `PARTIALLY_RECEIVED` (409 sinon). Le motif est obligatoire.',
    auth: 'bearer',
    responses: [{ status: 200, description: 'Le bon clos.', type: OrderDto }],
    errors: [400, 404, 409, 422],
    params: [ID],
  })
  @RequirePermissions('pharmacy.procurement:manage') @HttpCode(200) @Post(':id/close')
  async close(@CurrentUser() actor: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: OrderReasonDto): Promise<OrderDto> {
    return unwrap(await this.orders.close(actor.userId, id, dto.reason));
  }
}
