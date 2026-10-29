import { Body, Controller, DefaultValuePipe, Get, HttpCode, Param, ParseIntPipe, ParseUUIDPipe, Post, Put, Query } from '@nestjs/common';
import { DocGroup, DocOperation } from '../../api-docs';
import type { DocParam } from '../../api-docs';
import { CurrentUser, RequirePermissions } from '../../iam/presentation/decorators';
import type { AuthUser } from '../../iam/presentation/decorators';
import {
  CollectPaymentUseCase, CreateInvoiceUseCase, GetInvoiceUseCase, ListInvoicesUseCase, ManageInvoiceUseCases, ReprintReceiptUseCase,
} from '../application/use-cases/invoices';
import { CollectedPaymentDto, CollectPaymentDto, CreateInvoiceDto, InvoiceDto, InvoicePageDto, LineInputDto, ReasonDto, ReceiptDto, SetDiscountDto } from './dto/billing.dto';
import { unwrap } from './http-errors';

const ID: DocParam = { name: 'id', description: 'Identifiant de la facture.', example: '2a3b4c5d-6e7f-4a8b-9c0d-1e2f3a4b5c6d', format: 'uuid' };
const LINE: DocParam = { name: 'lineId', description: 'Identifiant de la ligne.', example: '1c2d3e4f-5a6b-4c7d-8e9f-0a1b2c3d4e5f', format: 'uuid' };
const PAYMENT: DocParam = { name: 'id', description: "Identifiant de l'encaissement.", example: '7e8f9a0b-1c2d-4e3f-8a4b-5c6d7e8f9a0b', format: 'uuid' };

@DocGroup(
  'Facturation · Factures et encaissements',
  [
    "Factures des patients et encaissements. Une facture ne porte que l'**identité** du patient et des **montants** (jamais de donnée clinique).",
    '',
    "- **Cycle de vie** : `DRAFT` (lignes et remise modifiables) → `ISSUED` (émise : verrouillée) → `PARTIALLY_PAID` → `PAID`. Une facture **sans encaissement** peut être `CANCELLED` (motif obligatoire) ; une facture encaissée ne s'annule pas (il faudra la rembourser).",
    "- **Lignes** : copie de l'acte du catalogue au moment de la facturation (code, libellé, prix). Changer ensuite le catalogue ne touche pas la facture.",
    "- **Remise** : sur toute la facture, avec un motif obligatoire ; elle ne peut pas dépasser le total.",
    "- **Encaissement** : jamais plus que le solde, même si deux caisses encaissent en même temps (le solde est relu sous verrou). Un encaissement est écrit une fois et ne se modifie plus ; chaque réimpression de reçu exige un motif et est tracée.",
    "- **Concurrence** : si deux caissiers modifient la même facture, le second reçoit `409 BILLING_INVOICE_CHANGED` (rechargez puis recommencez).",
    "- Chaque création, modification, émission, annulation, encaissement, réimpression et consultation est inscrite au journal d'audit (numéros et montants, jamais de nom).",
  ].join('\n'),
  51,
)
@Controller('api/v1/billing')
export class BillingInvoicesController {
  constructor(
    private readonly create: CreateInvoiceUseCase,
    private readonly manage: ManageInvoiceUseCases,
    private readonly collect: CollectPaymentUseCase,
    private readonly reprint: ReprintReceiptUseCase,
    private readonly getOne: GetInvoiceUseCase,
    private readonly listAll: ListInvoicesUseCase,
  ) {}

  @DocOperation({
    summary: 'Lister les factures',
    description: 'Les plus récentes en premier. Les filtres se cumulent. La consultation est inscrite au journal d\'audit (critères et nombre).',
    auth: 'bearer',
    responses: [{ status: 200, description: 'Une page de factures.', type: InvoicePageDto }],
    errors: [400, 422],
    query: [
      { name: 'patientId', description: 'Un patient.', example: '3f2b8c1e-7a4d-4e5f-9b60-1c2d3e4f5a6b' },
      { name: 'status', description: '`DRAFT`, `ISSUED`, `PARTIALLY_PAID`, `PAID` ou `CANCELLED`.', example: 'ISSUED' },
      { name: 'number', description: 'Un numéro de facture exact.', example: 'FAC-0000123' },
      { name: 'from', description: 'Créée à partir de (ISO 8601 avec fuseau, inclus).', example: '2026-11-01T00:00:00+01:00' },
      { name: 'to', description: "Créée avant (ISO 8601 avec fuseau, exclu).", example: '2026-12-01T00:00:00+01:00' },
      { name: 'offset', description: 'Nombre de factures à sauter (pagination).', example: 0 },
      { name: 'limit', description: 'Nombre de factures par page (1 à 200).', example: 50 },
    ],
  })
  @RequirePermissions('billing.invoices:read') @Get('invoices')
  async list(
    @CurrentUser() actor: AuthUser,
    @Query('patientId') patientId: string | undefined,
    @Query('status') status: string | undefined,
    @Query('number') number: string | undefined,
    @Query('from') from: string | undefined,
    @Query('to') to: string | undefined,
    @Query('offset', new DefaultValuePipe(0), ParseIntPipe) offset: number,
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit: number,
  ): Promise<InvoicePageDto> {
    return unwrap(await this.listAll.execute(actor.userId, { patientId, status, number, from, to, offset, limit }));
  }

  @DocOperation({
    summary: 'Créer une facture',
    description: 'Crée un **brouillon** pour un patient, avec ses premières lignes si on les donne. Chaque acte doit être actif ; son prix du moment est copié sur la ligne.',
    auth: 'bearer',
    responses: [{ status: 201, description: 'Brouillon créé.', type: InvoiceDto }],
    errors: [400, 404, 409, 422],
  })
  @RequirePermissions('billing.invoices:write') @Post('invoices')
  async createInvoice(@CurrentUser() actor: AuthUser, @Body() dto: CreateInvoiceDto): Promise<InvoiceDto> {
    return unwrap(await this.create.execute(actor.userId, dto));
  }

  @DocOperation({
    summary: 'Lire une facture',
    description: 'Avec ses lignes et ses encaissements. La consultation est inscrite au journal d\'audit.',
    auth: 'bearer',
    responses: [{ status: 200, description: 'La facture.', type: InvoiceDto }],
    errors: [400, 404],
    params: [ID],
  })
  @RequirePermissions('billing.invoices:read') @Get('invoices/:id')
  async get(@CurrentUser() actor: AuthUser, @Param('id', ParseUUIDPipe) id: string): Promise<InvoiceDto> {
    return unwrap(await this.getOne.execute(actor.userId, id));
  }

  @DocOperation({
    summary: 'Ajouter une ligne',
    description: 'Seulement sur un **brouillon** (409 sinon). L\'acte doit être actif ; son prix du moment est copié.',
    auth: 'bearer',
    responses: [{ status: 201, description: 'La facture avec sa nouvelle ligne.', type: InvoiceDto }],
    errors: [400, 404, 409, 422],
    params: [ID],
  })
  @RequirePermissions('billing.invoices:write') @Post('invoices/:id/lines')
  async addLine(@CurrentUser() actor: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: LineInputDto): Promise<InvoiceDto> {
    return unwrap(await this.manage.addLine(actor.userId, id, dto));
  }

  @DocOperation({
    summary: 'Retirer une ligne',
    description: 'Seulement sur un **brouillon**. Si la remise dépasse alors ce qui reste à facturer, elle est effacée.',
    auth: 'bearer',
    responses: [{ status: 200, description: 'La facture sans la ligne.', type: InvoiceDto }],
    errors: [400, 404, 409],
    params: [ID, LINE],
  })
  @RequirePermissions('billing.invoices:write') @HttpCode(200) @Post('invoices/:id/lines/:lineId/remove')
  async removeLine(@CurrentUser() actor: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Param('lineId', ParseUUIDPipe) lineId: string): Promise<InvoiceDto> {
    return unwrap(await this.manage.removeLine(actor.userId, id, lineId));
  }

  @DocOperation({
    summary: 'Appliquer une remise',
    description: 'Remise sur toute la facture d\'un **brouillon** : le motif est obligatoire et le montant ne peut pas dépasser le total. Un montant nul retire la remise.',
    auth: 'bearer',
    responses: [{ status: 200, description: 'La facture avec sa remise.', type: InvoiceDto }],
    errors: [400, 404, 409, 422],
    params: [ID],
  })
  @RequirePermissions('billing.invoices:write') @Put('invoices/:id/discount')
  async discount(@CurrentUser() actor: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: SetDiscountDto): Promise<InvoiceDto> {
    return unwrap(await this.manage.setDiscount(actor.userId, id, dto));
  }

  @DocOperation({
    summary: 'Émettre une facture',
    description: 'Verrouille les lignes et la remise : la facture peut alors être encaissée. Refusée (409) si elle est vide ou si son total est nul.',
    auth: 'bearer',
    responses: [{ status: 200, description: 'Facture émise.', type: InvoiceDto }],
    errors: [400, 404, 409],
    params: [ID],
  })
  @RequirePermissions('billing.invoices:write') @HttpCode(200) @Post('invoices/:id/issue')
  async issue(@CurrentUser() actor: AuthUser, @Param('id', ParseUUIDPipe) id: string): Promise<InvoiceDto> {
    return unwrap(await this.manage.issue(actor.userId, id));
  }

  @DocOperation({
    summary: 'Annuler une facture',
    description: 'Le motif est obligatoire. Refusée (409) si la facture a des encaissements ou est déjà annulée. Une facture annulée est verrouillée.',
    auth: 'bearer',
    responses: [{ status: 200, description: 'Facture annulée.', type: InvoiceDto }],
    errors: [400, 404, 409, 422],
    params: [ID],
  })
  @RequirePermissions('billing.invoices:write') @HttpCode(200) @Post('invoices/:id/cancel')
  async cancel(@CurrentUser() actor: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: ReasonDto): Promise<InvoiceDto> {
    return unwrap(await this.manage.cancel(actor.userId, id, dto.reason));
  }

  @DocOperation({
    summary: 'Encaisser',
    description: "Enregistre un paiement sur une facture **émise**. Le montant ne peut pas dépasser le solde (409), même si deux caisses encaissent en même temps. Pour un paiement en espèces, `tendered` (montant remis) permet de calculer la monnaie à rendre. Le statut passe à `PARTIALLY_PAID` ou `PAID`.",
    auth: 'bearer',
    responses: [{ status: 201, description: 'Encaissement enregistré, avec la facture à jour.', type: CollectedPaymentDto }],
    errors: [400, 404, 409, 422],
    params: [ID],
  })
  @RequirePermissions('billing.payments:collect') @Post('invoices/:id/payments')
  async collectPayment(@CurrentUser() actor: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: CollectPaymentDto): Promise<CollectedPaymentDto> {
    return unwrap(await this.collect.execute(actor.userId, id, dto));
  }

  @DocOperation({
    summary: 'Réimprimer un reçu',
    description: 'Renvoie les données du reçu comme **copie** (`duplicate: true`, à marquer « DUPLICATA »). Le motif est obligatoire et la réimpression est inscrite au journal d\'audit.',
    auth: 'bearer',
    responses: [{ status: 200, description: 'Les données du reçu.', type: ReceiptDto }],
    errors: [400, 404, 422],
    params: [PAYMENT],
  })
  @RequirePermissions('billing.payments:collect') @HttpCode(200) @Post('payments/:id/reprint')
  async reprintReceipt(@CurrentUser() actor: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: ReasonDto): Promise<ReceiptDto> {
    return unwrap(await this.reprint.execute(actor.userId, id, dto.reason));
  }
}
