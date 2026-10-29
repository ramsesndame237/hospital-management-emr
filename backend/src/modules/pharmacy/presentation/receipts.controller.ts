import { Body, Controller, DefaultValuePipe, Get, HttpCode, Param, ParseIntPipe, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { DocGroup, DocOperation } from '../../api-docs';
import type { DocParam } from '../../api-docs';
import { CurrentUser, RequirePermissions } from '../../iam/presentation/decorators';
import type { AuthUser } from '../../iam/presentation/decorators';
import { AdjustmentUseCases } from '../application/use-cases/adjustments';
import { GetReceiptUseCase, ListReceiptsUseCase, PostReceiptUseCase } from '../application/use-cases/receipts';
import { AdjustmentDto, AdjustmentPageDto, ApproveAdjustmentDto, RejectAdjustmentDto, RequestAdjustmentDto } from './dto/adjustments.dto';
import { PostReceiptDto, ReceiptDto, ReceiptPageDto } from './dto/receipts.dto';
import { unwrap } from './http-errors';

const GROUP = 'Pharmacie · Réceptions et ajustements';
const GROUP_DESCRIPTION = [
  'Les deux façons de faire entrer ou corriger du stock, toutes deux tracées.',
  '',
  '- **Réception de marchandises** : une livraison, ligne par ligne (médicament, lot, péremption, quantité, coût). Tout ou rien : si une ligne est refusée, rien n’est enregistré. Un lot déjà en stock s’augmente (même péremption exigée) ; un lot déjà périmé est refusé.',
  '- **Ajustement** : correction d’un lot (inventaire, casse, perte, péremption, article retrouvé). Il ne change rien tant qu’un **autre** pharmacien ne l’a pas approuvé ; au refus, le motif est obligatoire. Un seul ajustement en attente par lot.',
].join('\n');
const RECEIPT_ID: DocParam = { name: 'id', description: 'Identifiant de la réception.', example: '5b0f2b8e-2f5d-4a8c-8f0e-7d9c1a3b4e60', format: 'uuid' };
const ADJUSTMENT_ID: DocParam = { name: 'id', description: 'Identifiant de l’ajustement.', example: '8c1d4a7e-3b2f-4d6a-9e0b-1f2a3b4c5d6e', format: 'uuid' };

@DocGroup(GROUP, GROUP_DESCRIPTION, 59)
@Controller('api/v1/pharmacy/receipts')
export class PharmacyReceiptsController {
  constructor(private readonly post: PostReceiptUseCase, private readonly getOne: GetReceiptUseCase, private readonly listAll: ListReceiptsUseCase) {}

  @DocOperation({
    summary: 'Enregistrer une réception de marchandises',
    description: 'Crée les lots nouveaux, augmente les lots existants et inscrit les entrées au grand livre, dans une seule transaction. Refus : médicament inconnu (404) ou retiré du formulaire (409), lot périmé (422), péremption différente de celle d’un lot existant (409), même lot deux fois dans la livraison (422).',
    auth: 'bearer',
    responses: [{ status: 201, description: 'La réception enregistrée, avec son numéro.', type: ReceiptDto }],
    errors: [400, 404, 409, 422],
  })
  @RequirePermissions('pharmacy.stock:receive') @Post()
  async receive(@CurrentUser() actor: AuthUser, @Body() dto: PostReceiptDto): Promise<ReceiptDto> {
    return unwrap(await this.post.execute(actor.userId, dto));
  }

  @DocOperation({
    summary: 'Lister les réceptions',
    description: 'De la plus récente à la plus ancienne.',
    auth: 'bearer',
    responses: [{ status: 200, description: 'Une page de réceptions.', type: ReceiptPageDto }],
    errors: [400, 404],
    query: [
      { name: 'supplier', description: 'Texte cherché dans le nom du fournisseur.', example: 'pharma' },
      { name: 'drugId', description: 'Seulement les réceptions qui contiennent ce médicament.', example: '5b0f2b8e-2f5d-4a8c-8f0e-7d9c1a3b4e60' },
      { name: 'offset', description: 'Nombre de réceptions à sauter.', example: 0 },
      { name: 'limit', description: 'Nombre de réceptions par page (1 à 200).', example: 50 },
    ],
  })
  @RequirePermissions('pharmacy.stock:read') @Get()
  async list(
    @Query('supplier') supplier: string | undefined,
    @Query('drugId') drugId: string | undefined,
    @Query('offset', new DefaultValuePipe(0), ParseIntPipe) offset: number,
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit: number,
  ): Promise<ReceiptPageDto> {
    return unwrap(await this.listAll.execute({ supplier, drugId, offset, limit }));
  }

  @DocOperation({
    summary: 'Lire une réception',
    description: 'Avec toutes ses lignes.',
    auth: 'bearer',
    responses: [{ status: 200, description: 'La réception.', type: ReceiptDto }],
    errors: [400, 404],
    params: [RECEIPT_ID],
  })
  @RequirePermissions('pharmacy.stock:read') @Get(':id')
  async get(@Param('id', ParseUUIDPipe) id: string): Promise<ReceiptDto> {
    return unwrap(await this.getOne.execute(id));
  }
}

@DocGroup(GROUP, GROUP_DESCRIPTION, 59)
@Controller('api/v1/pharmacy/adjustments')
export class PharmacyAdjustmentsController {
  constructor(private readonly adjustments: AdjustmentUseCases) {}

  @DocOperation({
    summary: 'Demander un ajustement de stock',
    description: 'Ne change rien tant qu’un autre pharmacien ne l’a pas approuvé. Refus immédiats : sortie supérieure au stock du lot (409), entrée dans un lot périmé (409), motif qui ne convient pas au sens ou « autre » sans précision (422), demande déjà en attente sur ce lot (409).',
    auth: 'bearer',
    responses: [{ status: 201, description: 'La demande, en attente.', type: AdjustmentDto }],
    errors: [400, 404, 409, 422],
  })
  @RequirePermissions('pharmacy.stock:adjust') @Post()
  async request(@CurrentUser() actor: AuthUser, @Body() dto: RequestAdjustmentDto): Promise<AdjustmentDto> {
    return unwrap(await this.adjustments.request(actor.userId, dto));
  }

  @DocOperation({
    summary: 'Lister les ajustements',
    description: 'Les demandes en attente d’abord par ancienneté (`status=PENDING`), sinon l’historique du plus récent au plus ancien. `mine=true` ne garde que celles que vous avez demandées.',
    auth: 'bearer',
    responses: [{ status: 200, description: 'Une page d’ajustements.', type: AdjustmentPageDto }],
    errors: [400, 404, 422],
    query: [
      { name: 'status', description: 'Un statut : `PENDING`, `APPROVED` ou `REJECTED`.', example: 'PENDING' },
      { name: 'drugId', description: 'Un médicament.', example: '5b0f2b8e-2f5d-4a8c-8f0e-7d9c1a3b4e60' },
      { name: 'batchId', description: 'Un lot.', example: '8c1d4a7e-3b2f-4d6a-9e0b-1f2a3b4c5d6e' },
      { name: 'mine', description: 'Seulement mes demandes (`true`).', example: 'false' },
      { name: 'offset', description: 'Nombre d’ajustements à sauter.', example: 0 },
      { name: 'limit', description: 'Nombre d’ajustements par page (1 à 200).', example: 50 },
    ],
  })
  @RequirePermissions('pharmacy.stock:read') @Get()
  async list(
    @CurrentUser() actor: AuthUser,
    @Query('status') status: string | undefined,
    @Query('drugId') drugId: string | undefined,
    @Query('batchId') batchId: string | undefined,
    @Query('mine') mine: string | undefined,
    @Query('offset', new DefaultValuePipe(0), ParseIntPipe) offset: number,
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit: number,
  ): Promise<AdjustmentPageDto> {
    return unwrap(await this.adjustments.list({ status, drugId, batchId, mine: mine === 'true' ? actor.userId : undefined, offset, limit }));
  }

  @DocOperation({
    summary: 'Lire un ajustement',
    description: 'Avec le médicament et le lot concernés.',
    auth: 'bearer',
    responses: [{ status: 200, description: 'L’ajustement.', type: AdjustmentDto }],
    errors: [400, 404],
    params: [ADJUSTMENT_ID],
  })
  @RequirePermissions('pharmacy.stock:read') @Get(':id')
  async get(@Param('id', ParseUUIDPipe) id: string): Promise<AdjustmentDto> {
    return unwrap(await this.adjustments.get(id));
  }

  @DocOperation({
    summary: 'Approuver un ajustement',
    description: 'Applique l’ajustement au lot et inscrit le mouvement au grand livre. Refus : vous êtes le demandeur (409), déjà décidé (409), le lot ne contient plus assez (409 : la demande reste en attente).',
    auth: 'bearer',
    responses: [{ status: 200, description: 'L’ajustement approuvé et appliqué.', type: AdjustmentDto }],
    errors: [400, 404, 409, 422],
    params: [ADJUSTMENT_ID],
  })
  @RequirePermissions('pharmacy.stock:approve') @HttpCode(200) @Post(':id/approve')
  async approve(@CurrentUser() actor: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: ApproveAdjustmentDto): Promise<AdjustmentDto> {
    return unwrap(await this.adjustments.approve(actor.userId, id, dto.comment));
  }

  @DocOperation({
    summary: 'Refuser un ajustement',
    description: 'Le stock ne change pas. Le motif est obligatoire. Refus : vous êtes le demandeur (409), déjà décidé (409).',
    auth: 'bearer',
    responses: [{ status: 200, description: 'L’ajustement refusé.', type: AdjustmentDto }],
    errors: [400, 404, 409, 422],
    params: [ADJUSTMENT_ID],
  })
  @RequirePermissions('pharmacy.stock:approve') @HttpCode(200) @Post(':id/reject')
  async reject(@CurrentUser() actor: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: RejectAdjustmentDto): Promise<AdjustmentDto> {
    return unwrap(await this.adjustments.reject(actor.userId, id, dto.comment));
  }
}
