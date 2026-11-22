import { Body, Controller, DefaultValuePipe, Delete, Get, HttpCode, Param, ParseBoolPipe, ParseIntPipe, ParseUUIDPipe, Patch, Post, Put, Query } from '@nestjs/common';
import { DocGroup, DocOperation } from '../../api-docs';
import type { DocParam } from '../../api-docs';
import { CurrentUser, RequirePermissions } from '../../iam/presentation/decorators';
import type { AuthUser } from '../../iam/presentation/decorators';
import { CoverageUseCases, InvoiceCoverageUseCases, ListClaimsUseCase, PayerUseCases } from '../application/use-cases/payers';
import { InvoiceDto } from './dto/billing.dto';
import { ApplyCoverageDto, ClaimPageDto, CoverageDto, CreatePayerDto, PayerDto, PayerPageDto, RecordCoverageDto, SettleDto, UpdatePayerDto } from './dto/payers.dto';
import { unwrap } from './http-errors';

const PAYER: DocParam = { name: 'id', description: "Identifiant de l'assureur.", example: '5d81b4cd-ecd1-47f4-9185-d6c4be1e1c73', format: 'uuid' };
const PATIENT: DocParam = { name: 'patientId', description: 'Identifiant du patient.', example: '3f2b8c1e-7a4d-4e5f-9b60-1c2d3e4f5a6b', format: 'uuid' };
const COVERAGE: DocParam = { name: 'id', description: 'Identifiant de la couverture.', example: '2a3b4c5d-6e7f-4a8b-9c0d-1e2f3a4b5c6d', format: 'uuid' };
const INVOICE: DocParam = { name: 'id', description: 'Identifiant de la facture.', example: '2a3b4c5d-6e7f-4a8b-9c0d-1e2f3a4b5c6d', format: 'uuid' };

@DocGroup(
  'Facturation · Assurances (tiers payant)',
  [
    "Un **assureur** prend en charge une part (en %) des soins de ses assurés. Le patient ne règle que le reste ; la part de l'assureur devient une **créance** qu'on suit jusqu'à son règlement.",
    '',
    "- **Couverture** : l'assureur, le numéro d'assuré, le pourcentage (1 à 100) et la période de validité. Une couverture ne s'efface pas : elle se désactive.",
    "- **Sur une facture** : on applique une couverture **valable aujourd'hui** à un **brouillon**. La part de l'assureur est son pourcentage de ce qui reste **après remise**, recalculée tant que la facture est un brouillon, puis figée à l'émission. `total` est ce que doit le **patient**.",
    "- **100 %** : la facture s'émet déjà soldée pour le patient (rien à encaisser), et la créance de l'assureur est suivie à part.",
    "- **Règlement** : la comptabilité constate que l'assureur a payé sa part (référence obligatoire). Une seule fois ; ensuite la facture ne peut plus être annulée.",
    "- Une facture annulée n'a pas de créance. Chaque opération est inscrite au journal d'audit (numéros et pourcentages, jamais de nom).",
  ].join('\n'),
  53.7,
)
@Controller('api/v1/billing')
export class BillingPayersController {
  constructor(
    private readonly payers: PayerUseCases,
    private readonly coverages: CoverageUseCases,
    private readonly onInvoice: InvoiceCoverageUseCases,
    private readonly claims: ListClaimsUseCase,
  ) {}

  @DocOperation({
    summary: 'Lister les assureurs',
    auth: 'bearer',
    responses: [{ status: 200, description: 'Une page d\'assureurs.', type: PayerPageDto }],
    query: [
      { name: 'search', description: 'Texte cherché dans le code et le nom.', example: 'santé' },
      { name: 'includeInactive', description: 'Inclure les assureurs retirés (faux par défaut).', example: 'false' },
      { name: 'offset', description: 'Nombre d\'assureurs à sauter.', example: 0 },
      { name: 'limit', description: "Nombre d'assureurs par page (1 à 200).", example: 50 },
    ],
  })
  @RequirePermissions('billing.payers:read') @Get('payers')
  async listPayers(
    @Query('search') search: string | undefined,
    @Query('includeInactive', new DefaultValuePipe(false), ParseBoolPipe) includeInactive: boolean,
    @Query('offset', new DefaultValuePipe(0), ParseIntPipe) offset: number,
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit: number,
  ): Promise<PayerPageDto> {
    return this.payers.list({ search, includeInactive, offset, limit });
  }

  @DocOperation({
    summary: 'Ajouter un assureur',
    auth: 'bearer',
    responses: [{ status: 201, description: 'Assureur créé.', type: PayerDto }],
    errors: [400, 409, 422],
  })
  @RequirePermissions('billing.payers:manage') @Post('payers')
  async createPayer(@CurrentUser() actor: AuthUser, @Body() dto: CreatePayerDto): Promise<PayerDto> {
    return unwrap(await this.payers.create(actor.userId, dto));
  }

  @DocOperation({
    summary: "Renommer un assureur",
    auth: 'bearer',
    responses: [{ status: 200, description: 'Assureur mis à jour.', type: PayerDto }],
    errors: [400, 404, 422],
    params: [PAYER],
  })
  @RequirePermissions('billing.payers:manage') @Patch('payers/:id')
  async updatePayer(@CurrentUser() actor: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdatePayerDto): Promise<PayerDto> {
    return unwrap(await this.payers.update(actor.userId, id, dto));
  }

  @DocOperation({ summary: 'Retirer un assureur', description: "Il reste lisible, avec ses couvertures et ses factures, mais n'accepte plus de nouvelle couverture. Réversible.", auth: 'bearer', responses: [{ status: 200, description: 'Assureur retiré.', type: PayerDto }], errors: [400, 404], params: [PAYER] })
  @RequirePermissions('billing.payers:manage') @HttpCode(200) @Post('payers/:id/deactivate')
  async deactivatePayer(@CurrentUser() actor: AuthUser, @Param('id', ParseUUIDPipe) id: string): Promise<PayerDto> {
    return unwrap(await this.payers.setActive(actor.userId, id, false));
  }

  @DocOperation({ summary: 'Réactiver un assureur', auth: 'bearer', responses: [{ status: 200, description: 'Assureur réactivé.', type: PayerDto }], errors: [400, 404], params: [PAYER] })
  @RequirePermissions('billing.payers:manage') @HttpCode(200) @Post('payers/:id/activate')
  async activatePayer(@CurrentUser() actor: AuthUser, @Param('id', ParseUUIDPipe) id: string): Promise<PayerDto> {
    return unwrap(await this.payers.setActive(actor.userId, id, true));
  }

  @DocOperation({
    summary: "Lister les couvertures d'un patient",
    description: "Les couvertures actives, les plus récentes d'abord ; `validToday` dit si elle peut s'appliquer aujourd'hui.",
    auth: 'bearer',
    responses: [{ status: 200, description: 'Les couvertures du patient.', type: CoverageDto, isArray: true }],
    errors: [400, 404],
    params: [PATIENT],
  })
  @RequirePermissions('billing.payers:read') @Get('patients/:patientId/coverages')
  async listCoverages(@Param('patientId', ParseUUIDPipe) patientId: string): Promise<CoverageDto[]> {
    return unwrap(await this.coverages.forPatient(patientId));
  }

  @DocOperation({
    summary: "Enregistrer la couverture d'un patient",
    auth: 'bearer',
    responses: [{ status: 201, description: 'Couverture enregistrée.', type: CoverageDto }],
    errors: [400, 404, 409, 422],
    params: [PATIENT],
  })
  @RequirePermissions('billing.coverages:write') @Post('patients/:patientId/coverages')
  async recordCoverage(@CurrentUser() actor: AuthUser, @Param('patientId', ParseUUIDPipe) patientId: string, @Body() dto: RecordCoverageDto): Promise<CoverageDto> {
    return unwrap(await this.coverages.record(actor.userId, patientId, dto));
  }

  @DocOperation({ summary: 'Désactiver une couverture', description: 'Elle ne pourra plus être appliquée à une facture ; les factures déjà établies la gardent.', auth: 'bearer', responses: [{ status: 200, description: 'Couverture désactivée.', type: CoverageDto }], errors: [400, 404], params: [COVERAGE] })
  @RequirePermissions('billing.coverages:write') @HttpCode(200) @Post('coverages/:id/deactivate')
  async deactivateCoverage(@CurrentUser() actor: AuthUser, @Param('id', ParseUUIDPipe) id: string): Promise<CoverageDto> {
    return unwrap(await this.coverages.deactivate(actor.userId, id));
  }

  @DocOperation({
    summary: 'Appliquer une couverture à une facture',
    description: "Réservé à un **brouillon**. La couverture doit être celle du patient de la facture et valable aujourd'hui, son assureur actif. Elle remplace la précédente.",
    auth: 'bearer',
    responses: [{ status: 200, description: 'Facture avec la part de l\'assureur.', type: InvoiceDto }],
    errors: [400, 404, 409, 422],
    params: [INVOICE],
  })
  @RequirePermissions('billing.invoices:write') @Put('invoices/:id/coverage')
  async applyCoverage(@CurrentUser() actor: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: ApplyCoverageDto): Promise<InvoiceDto> {
    return unwrap(await this.onInvoice.apply(actor.userId, id, dto.coverageId)) as InvoiceDto;
  }

  @DocOperation({ summary: "Retirer la couverture d'une facture", description: 'Réservé à un brouillon : le patient doit alors tout le total.', auth: 'bearer', responses: [{ status: 200, description: 'Facture sans couverture.', type: InvoiceDto }], errors: [400, 404, 409], params: [INVOICE] })
  @RequirePermissions('billing.invoices:write') @HttpCode(200) @Delete('invoices/:id/coverage')
  async removeCoverage(@CurrentUser() actor: AuthUser, @Param('id', ParseUUIDPipe) id: string): Promise<InvoiceDto> {
    return unwrap(await this.onInvoice.remove(actor.userId, id)) as InvoiceDto;
  }

  @DocOperation({
    summary: "Lister les créances d'assureurs",
    description: "La part des factures émises que les assureurs doivent régler, les plus anciennes d'abord. `settled=false` : à recouvrer ; `settled=true` : réglées.",
    auth: 'bearer',
    responses: [{ status: 200, description: 'Une page de créances.', type: ClaimPageDto }],
    query: [
      { name: 'payerId', description: 'Un assureur.', example: '5d81b4cd-ecd1-47f4-9185-d6c4be1e1c73' },
      { name: 'settled', description: '`false` : à recouvrer ; `true` : réglées ; absent : toutes.', example: 'false' },
      { name: 'offset', description: 'Nombre de créances à sauter.', example: 0 },
      { name: 'limit', description: 'Nombre de créances par page (1 à 200).', example: 50 },
    ],
  })
  @RequirePermissions('billing.payers:settle') @Get('claims')
  async listClaims(
    @Query('payerId') payerId: string | undefined,
    @Query('settled') settled: string | undefined,
    @Query('offset', new DefaultValuePipe(0), ParseIntPipe) offset: number,
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit: number,
  ): Promise<ClaimPageDto> {
    return this.claims.execute({ payerId: payerId?.trim() || undefined, settled: settled === 'true' ? true : settled === 'false' ? false : undefined, offset, limit });
  }

  @DocOperation({
    summary: "Constater le règlement de la part de l'assureur",
    description: "Une seule fois, sur une facture émise dont l'assureur doit quelque chose. La référence (virement, bordereau) est obligatoire. Ensuite la facture ne peut plus être annulée.",
    auth: 'bearer',
    responses: [{ status: 200, description: 'Facture avec le règlement constaté.', type: InvoiceDto }],
    errors: [400, 404, 409, 422],
    params: [INVOICE],
  })
  @RequirePermissions('billing.payers:settle') @HttpCode(200) @Post('invoices/:id/payer-settlement')
  async settle(@CurrentUser() actor: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: SettleDto): Promise<InvoiceDto> {
    return unwrap(await this.onInvoice.settle(actor.userId, id, dto.reference)) as InvoiceDto;
  }
}
