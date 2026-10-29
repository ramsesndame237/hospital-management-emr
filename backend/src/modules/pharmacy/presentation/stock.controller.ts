import { Body, Controller, DefaultValuePipe, Get, HttpCode, Param, ParseBoolPipe, ParseIntPipe, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { DocGroup, DocOperation } from '../../api-docs';
import type { DocParam } from '../../api-docs';
import { CurrentUser, RequirePermissions } from '../../iam/presentation/decorators';
import type { AuthUser } from '../../iam/presentation/decorators';
import {
  BatchActionUseCases, GetDrugStockUseCase, ListExpiryUseCase, ListMovementsUseCase, ListStockUseCase, StockSummaryUseCase, SuggestBatchesUseCase,
} from '../application/use-cases/stock';
import { BatchDto, DrugStockDto, ExpiryPageDto, FefoDto, MovementPageDto, QuarantineDto, StockPageDto, StockSummaryDto } from './dto/stock.dto';
import { unwrap } from './http-errors';

const DRUG_ID: DocParam = { name: 'id', description: 'Identifiant du médicament.', example: '5b0f2b8e-2f5d-4a8c-8f0e-7d9c1a3b4e60', format: 'uuid' };
const BATCH_ID: DocParam = { name: 'id', description: 'Identifiant du lot.', example: '8c1d4a7e-3b2f-4d6a-9e0b-1f2a3b4c5d6e', format: 'uuid' };

@DocGroup(
  'Pharmacie · Stock',
  [
    'Le stock **par lot** (numéro de lot, péremption, quantité, coût), son grand livre de mouvements et les alertes qui en découlent.',
    '',
    '- Un lot est **délivrable** s’il est en stock, non périmé et hors quarantaine. Il est périmé le lendemain de sa date de péremption.',
    '- **Niveaux** : `OUT` (rien de délivrable), `LOW` (au seuil de réapprovisionnement ou en dessous), `OK`.',
    '- **Premier périmé, premier sorti** : `GET /pharmacy/drugs/{id}/fefo` propose les lots à prélever pour une quantité.',
    '- La quarantaine met un lot de côté sans le retirer du stock ; le motif est obligatoire.',
    '- Le grand livre ne s’écrit qu’à l’ajout : chaque mouvement porte l’auteur, l’heure, le solde du lot et le document à l’origine.',
  ].join('\n'),
  58,
)
@Controller('api/v1/pharmacy')
export class PharmacyStockController {
  constructor(
    private readonly list: ListStockUseCase,
    private readonly summary: StockSummaryUseCase,
    private readonly drugStock: GetDrugStockUseCase,
    private readonly suggest: SuggestBatchesUseCase,
    private readonly expiry: ListExpiryUseCase,
    private readonly movements: ListMovementsUseCase,
    private readonly batches: BatchActionUseCases,
  ) {}

  @DocOperation({
    summary: 'Vue d’ensemble du stock',
    description: 'Un médicament par ligne, avec sa quantité délivrable, en quarantaine, périmée et bientôt périmée. Les ruptures sont en tête, puis les stocks bas. Les filtres se cumulent.',
    auth: 'bearer',
    responses: [{ status: 200, description: 'Une page de lignes de stock.', type: StockPageDto }],
    errors: [400, 422],
    query: [
      { name: 'search', description: 'Texte cherché dans le code, le nom et la dénomination commune.', example: 'paracé' },
      { name: 'level', description: 'Un niveau de stock : `OK`, `LOW` ou `OUT`.', example: 'LOW' },
      { name: 'expiring', description: 'Seulement ceux qui ont du stock qui périme dans la fenêtre d’alerte (`true`).', example: 'false' },
      { name: 'hasExpired', description: 'Seulement ceux qui ont du stock périmé (`true`).', example: 'false' },
      { name: 'includeInactive', description: 'Inclure les médicaments retirés du formulaire (`true` ou `false`, défaut `false`).', example: 'false' },
      { name: 'offset', description: 'Nombre de lignes à sauter.', example: 0 },
      { name: 'limit', description: 'Nombre de lignes par page (1 à 200).', example: 50 },
    ],
  })
  @RequirePermissions('pharmacy.stock:read') @Get('stock')
  async overview(
    @Query('search') search: string | undefined,
    @Query('level') level: string | undefined,
    @Query('expiring', new DefaultValuePipe(false), ParseBoolPipe) expiring: boolean,
    @Query('hasExpired', new DefaultValuePipe(false), ParseBoolPipe) hasExpired: boolean,
    @Query('includeInactive', new DefaultValuePipe(false), ParseBoolPipe) includeInactive: boolean,
    @Query('offset', new DefaultValuePipe(0), ParseIntPipe) offset: number,
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit: number,
  ): Promise<StockPageDto> {
    return unwrap(await this.list.execute({ search, level, expiring, hasExpired, includeInactive, offset, limit }));
  }

  @DocOperation({
    summary: 'Tableau de bord du stock',
    description: 'Les compteurs à surveiller : ruptures, stocks bas, péremptions proches ou dépassées, lots en quarantaine, ajustements en attente, valeur du stock.',
    auth: 'bearer',
    responses: [{ status: 200, description: 'Les compteurs du jour.', type: StockSummaryDto }],
    errors: [],
  })
  @RequirePermissions('pharmacy.stock:read') @Get('stock/summary')
  async getSummary(): Promise<StockSummaryDto> {
    return this.summary.execute();
  }

  @DocOperation({
    summary: 'Péremptions',
    description: 'Lots en stock qui périment dans `days` jours au plus (par défaut la fenêtre d’alerte), **périmés compris**, les plus proches d’abord. `quarantinedOnly` liste à la place les lots mis de côté.',
    auth: 'bearer',
    responses: [{ status: 200, description: 'Une page de lots.', type: ExpiryPageDto }],
    errors: [400, 422],
    query: [
      { name: 'days', description: 'Horizon en jours (0 à 3 650) ; défaut : la fenêtre d’alerte.', example: 90 },
      { name: 'quarantinedOnly', description: 'Seulement les lots en quarantaine (`true`).', example: 'false' },
      { name: 'offset', description: 'Nombre de lots à sauter.', example: 0 },
      { name: 'limit', description: 'Nombre de lots par page (1 à 200).', example: 50 },
    ],
  })
  @RequirePermissions('pharmacy.stock:read') @Get('stock/expiry')
  async listExpiry(
    @Query('days') days: string | undefined,
    @Query('quarantinedOnly', new DefaultValuePipe(false), ParseBoolPipe) quarantinedOnly: boolean,
    @Query('offset', new DefaultValuePipe(0), ParseIntPipe) offset: number,
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit: number,
  ): Promise<ExpiryPageDto> {
    return unwrap(await this.expiry.execute({ days: days === undefined || days === '' ? undefined : Number(days), quarantinedOnly, offset, limit }));
  }

  @DocOperation({
    summary: 'Grand livre des mouvements',
    description: 'Les entrées et sorties de stock, du plus récent au plus ancien, filtrables par médicament ou par lot.',
    auth: 'bearer',
    responses: [{ status: 200, description: 'Une page de mouvements.', type: MovementPageDto }],
    errors: [400, 404],
    query: [
      { name: 'drugId', description: 'Un médicament.', example: '5b0f2b8e-2f5d-4a8c-8f0e-7d9c1a3b4e60' },
      { name: 'batchId', description: 'Un lot.', example: '8c1d4a7e-3b2f-4d6a-9e0b-1f2a3b4c5d6e' },
      { name: 'offset', description: 'Nombre de mouvements à sauter.', example: 0 },
      { name: 'limit', description: 'Nombre de mouvements par page (1 à 200).', example: 50 },
    ],
  })
  @RequirePermissions('pharmacy.stock:read') @Get('stock/movements')
  async listMovements(
    @Query('drugId') drugId: string | undefined,
    @Query('batchId') batchId: string | undefined,
    @Query('offset', new DefaultValuePipe(0), ParseIntPipe) offset: number,
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit: number,
  ): Promise<MovementPageDto> {
    return unwrap(await this.movements.execute({ drugId, batchId, offset, limit }));
  }

  @DocOperation({
    summary: 'Stock d’un médicament',
    description: 'Le médicament, ses totaux (délivrable, quarantaine, périmé, bientôt périmé, niveau, valeur) et ses lots en stock, ceux qui périment le plus tôt d’abord.',
    auth: 'bearer',
    responses: [{ status: 200, description: 'Le stock du médicament.', type: DrugStockDto }],
    errors: [400, 404],
    params: [DRUG_ID],
  })
  @RequirePermissions('pharmacy.stock:read') @Get('drugs/:id/stock')
  async getDrugStock(@Param('id', ParseUUIDPipe) id: string): Promise<DrugStockDto> {
    return unwrap(await this.drugStock.execute(id));
  }

  @DocOperation({
    summary: 'Lots à prélever (premier périmé, premier sorti)',
    description: 'Répartit la quantité demandée sur les lots délivrables, ceux qui périment le plus tôt d’abord (périmés et quarantaine exclus). `shortfall` : ce qui manque. Ne réserve rien : c’est une suggestion pour la dispensation.',
    auth: 'bearer',
    responses: [{ status: 200, description: 'Les lots proposés.', type: FefoDto }],
    errors: [400, 404, 422],
    params: [DRUG_ID],
    query: [{ name: 'quantity', description: 'Quantité souhaitée (1 à 1 000 000).', example: 70 }],
  })
  @RequirePermissions('pharmacy.stock:read') @Get('drugs/:id/fefo')
  async getFefo(@Param('id', ParseUUIDPipe) id: string, @Query('quantity', ParseIntPipe) quantity: number): Promise<FefoDto> {
    return unwrap(await this.suggest.execute(id, quantity));
  }

  @DocOperation({
    summary: 'Mettre un lot en quarantaine',
    description: 'Rappel de lot, doute sur la conservation : le lot n’est plus délivrable mais son stock reste visible. Le motif est obligatoire. 409 si le lot y est déjà.',
    auth: 'bearer',
    responses: [{ status: 200, description: 'Le lot en quarantaine.', type: BatchDto }],
    errors: [400, 404, 409, 422],
    params: [BATCH_ID],
  })
  @RequirePermissions('pharmacy.stock:quarantine') @HttpCode(200) @Post('batches/:id/quarantine')
  async quarantine(@CurrentUser() actor: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: QuarantineDto): Promise<BatchDto> {
    return unwrap(await this.batches.quarantine(actor.userId, id, dto.reason));
  }

  @DocOperation({
    summary: 'Libérer un lot de la quarantaine',
    description: 'Le lot redevient délivrable (s’il n’est pas périmé). 409 s’il n’est pas en quarantaine.',
    auth: 'bearer',
    responses: [{ status: 200, description: 'Le lot libéré.', type: BatchDto }],
    errors: [400, 404, 409],
    params: [BATCH_ID],
  })
  @RequirePermissions('pharmacy.stock:quarantine') @HttpCode(200) @Post('batches/:id/release')
  async release(@CurrentUser() actor: AuthUser, @Param('id', ParseUUIDPipe) id: string): Promise<BatchDto> {
    return unwrap(await this.batches.release(actor.userId, id));
  }
}
