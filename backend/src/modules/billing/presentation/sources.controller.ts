import { Body, Controller, DefaultValuePipe, Get, ParseIntPipe, Post, Query } from '@nestjs/common';
import { DocGroup, DocOperation } from '../../api-docs';
import { CurrentUser, RequirePermissions } from '../../iam/presentation/decorators';
import type { AuthUser } from '../../iam/presentation/decorators';
import { BillFromSourceUseCase, ListBillableUseCase } from '../application/use-cases/sources';
import { InvoiceDto } from './dto/billing.dto';
import { BillablePageDto, BillFromSourceDto } from './dto/sources.dto';
import { unwrap } from './http-errors';

@DocGroup(
  'Facturation · Actes à facturer',
  [
    "Relie la facture à ce qui a été fait : une **demande d'analyses**, un **examen d'imagerie réalisé** ou une **délivrance de médicaments** devient une facture, au prix du catalogue.",
    '',
    "- **Prix** : un acte du catalogue (catégorie laboratoire, radiologie ou pharmacie) porte le **code source** de l'analyse, de l'examen ou du médicament qu'il tarifie. Sans acte correspondant, la facture est refusée (`422 BILLING_SOURCE_UNPRICED`, avec la liste des codes) : rien n'est facturé à zéro ni en silence.",
    "- **Une seule facture par élément** : un élément déjà facturé est refusé (`409 BILLING_SOURCE_ALREADY_BILLED`), même si deux caisses essaient en même temps. **Annuler** la facture libère l'élément, qui redevient « à facturer ».",
    "- La facture créée est un **brouillon** : la caisse peut y ajouter des lignes, appliquer une remise, puis l'émettre et l'encaisser comme n'importe quelle facture.",
    "- Ne sont à facturer que : les demandes d'analyses non annulées, les examens **réalisés** (ou compte-rendu signé), et les délivrances de médicaments. Aucune donnée clinique n'est exposée.",
  ].join('\n'),
  53.5,
)
@Controller('api/v1/billing')
export class BillingSourcesController {
  constructor(
    private readonly list: ListBillableUseCase,
    private readonly bill: BillFromSourceUseCase,
  ) {}

  @DocOperation({
    summary: 'Lister ce qui reste à facturer',
    description: 'Demandes d\'analyses, examens réalisés ou délivrances sans facture non annulée, les plus anciens d\'abord, avec le prix du catalogue de chaque ligne.',
    auth: 'bearer',
    responses: [{ status: 200, description: 'Une page d\'éléments à facturer.', type: BillablePageDto }],
    errors: [400, 422],
    query: [
      { name: 'type', description: '`LAB_REQUISITION`, `IMAGING_ORDER` ou `DISPENSATION`.', example: 'LAB_REQUISITION' },
      { name: 'offset', description: "Nombre d'éléments à sauter (pagination).", example: 0 },
      { name: 'limit', description: "Nombre d'éléments par page (1 à 100).", example: 50 },
    ],
  })
  @RequirePermissions('billing.invoices:write') @Get('billable')
  async listBillable(
    @Query('type') type: string | undefined,
    @Query('offset', new DefaultValuePipe(0), ParseIntPipe) offset: number,
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit: number,
  ): Promise<BillablePageDto> {
    return unwrap(await this.list.execute({ type, offset, limit })) as BillablePageDto;
  }

  @DocOperation({
    summary: 'Établir la facture d\'une demande, d\'un examen ou d\'une délivrance',
    description: 'Crée un **brouillon** : une ligne par code au prix du catalogue, quantités d\'après ce qui a été fait. Refusé si un code n\'a pas de prix configuré (422) ou si l\'élément a déjà une facture non annulée (409).',
    auth: 'bearer',
    responses: [{ status: 201, description: 'Facture brouillon créée.', type: InvoiceDto }],
    errors: [400, 404, 409, 422],
  })
  @RequirePermissions('billing.invoices:write') @Post('invoices/from-source')
  async billFromSource(@CurrentUser() actor: AuthUser, @Body() dto: BillFromSourceDto): Promise<InvoiceDto> {
    return unwrap(await this.bill.execute(actor.userId, { type: dto.sourceType, sourceId: dto.sourceId })) as InvoiceDto;
  }
}
