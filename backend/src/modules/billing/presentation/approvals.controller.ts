import { Body, Controller, DefaultValuePipe, Get, HttpCode, Param, ParseIntPipe, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { DocGroup, DocOperation } from '../../api-docs';
import type { DocParam } from '../../api-docs';
import { CurrentUser, RequirePermissions } from '../../iam/presentation/decorators';
import type { AuthUser } from '../../iam/presentation/decorators';
import { DecideApprovalUseCase, GetApprovalUseCase, ListApprovalsUseCase, RequestApprovalUseCase, WithdrawApprovalUseCase } from '../application/use-cases/approvals';
import { ApprovalDto, ApprovalPageDto, DecideApprovalDto, RequestApprovalDto } from './dto/approvals.dto';
import { unwrap } from './http-errors';

const ID: DocParam = { name: 'id', description: 'Identifiant de la demande.', example: '7b8c9d0e-1f2a-4b3c-8d4e-5f6a7b8c9d0e', format: 'uuid' };

@DocGroup(
  'Facturation · Approbations',
  [
    "Certaines opérations ne se font pas seul : une **remise au-delà du seuil** de l'installation (`BILLING_DISCOUNT_APPROVAL_PERCENT`, en % du sous-total) et l'**annulation d'une facture émise**. Le caissier envoie une **demande motivée** ; un responsable l'accepte ou la refuse.",
    '',
    "- **Quatre yeux** : on ne décide jamais de sa propre demande. Un refus s'explique (commentaire obligatoire).",
    "- **Une demande à la fois** par facture ; tant qu'elle attend, la facture ne bouge plus (lignes, remise, émission, annulation directes refusées).",
    "- **Demande périmée** : si la facture a changé depuis la demande, elle ne peut plus être acceptée (409), seulement refusée ou retirée.",
    "- **Effet atomique** : l'acceptation applique la remise ou l'annulation dans la même transaction que la décision.",
    "- L'auteur peut **retirer** sa demande tant qu'elle n'est pas décidée. Une demande décidée ne se modifie plus et rien ne se supprime.",
    "- **Visibilité** : un caissier voit ses demandes ; la comptabilité et l'administrateur système (arbitrage) les voient toutes. Demande, décision et retrait sont inscrits au journal d'audit.",
  ].join('\n'),
  53,
)
@Controller('api/v1/billing/approvals')
export class BillingApprovalsController {
  constructor(
    private readonly request: RequestApprovalUseCase,
    private readonly decide: DecideApprovalUseCase,
    private readonly withdrawOne: WithdrawApprovalUseCase,
    private readonly getOne: GetApprovalUseCase,
    private readonly listAll: ListApprovalsUseCase,
  ) {}

  @DocOperation({
    summary: 'Lister les demandes',
    description: "Celles qui attendent une décision d'abord (la plus ancienne en tête), puis les autres. Un caissier ne voit que les siennes ; la comptabilité et l'administrateur système voient toutes les demandes et peuvent filtrer par auteur.",
    auth: 'bearer',
    responses: [{ status: 200, description: 'Une page de demandes.', type: ApprovalPageDto }],
    errors: [400, 404, 422],
    query: [
      { name: 'status', description: '`PENDING`, `APPROVED`, `REJECTED` ou `WITHDRAWN`.', example: 'PENDING' },
      { name: 'kind', description: '`DISCOUNT` ou `CANCEL`.', example: 'DISCOUNT' },
      { name: 'invoiceId', description: 'Une facture.', example: '2a3b4c5d-6e7f-4a8b-9c0d-1e2f3a4b5c6d' },
      { name: 'requestedBy', description: 'Un auteur (réservé aux responsables).', example: '5d81b4cd-ecd1-47f4-9185-d6c4be1e1c73' },
      { name: 'offset', description: 'Nombre de demandes à sauter (pagination).', example: 0 },
      { name: 'limit', description: 'Nombre de demandes par page (1 à 200).', example: 50 },
    ],
  })
  @RequirePermissions('billing.approvals:read:own') @Get()
  async list(
    @CurrentUser() actor: AuthUser,
    @Query('status') status: string | undefined,
    @Query('kind') kind: string | undefined,
    @Query('invoiceId') invoiceId: string | undefined,
    @Query('requestedBy') requestedBy: string | undefined,
    @Query('offset', new DefaultValuePipe(0), ParseIntPipe) offset: number,
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit: number,
  ): Promise<ApprovalPageDto> {
    return unwrap(await this.listAll.execute(actor.userId, { status, kind, invoiceId, requestedBy, offset, limit }));
  }

  @DocOperation({
    summary: 'Envoyer une demande',
    description:
      "Demande l'accord d'un responsable pour une **remise au-delà du seuil** (sur un brouillon) ou pour **annuler une facture émise**. Le motif est obligatoire. Refusée (409) si une demande attend déjà pour cette facture, si la remise est dans le seuil ou la facture encore en brouillon (le caissier agit alors directement), ou si la facture vient de changer.",
    auth: 'bearer',
    responses: [{ status: 201, description: 'Demande enregistrée.', type: ApprovalDto }],
    errors: [400, 404, 409, 422],
  })
  @RequirePermissions('billing.approvals:request') @Post()
  async requestApproval(@CurrentUser() actor: AuthUser, @Body() dto: RequestApprovalDto): Promise<ApprovalDto> {
    return unwrap(await this.request.execute(actor.userId, dto));
  }

  @DocOperation({
    summary: 'Lire une demande',
    description: "Avec la facture concernée telle qu'elle est maintenant. Une demande qui n'est pas la sienne est « introuvable » pour un caissier.",
    auth: 'bearer',
    responses: [{ status: 200, description: 'La demande.', type: ApprovalDto }],
    errors: [400, 404],
    params: [ID],
  })
  @RequirePermissions('billing.approvals:read:own') @Get(':id')
  async get(@CurrentUser() actor: AuthUser, @Param('id', ParseUUIDPipe) id: string): Promise<ApprovalDto> {
    return unwrap(await this.getOne.execute(actor.userId, id));
  }

  @DocOperation({
    summary: 'Accepter une demande',
    description:
      "Un responsable accepte : la remise ou l'annulation est **appliquée à la facture dans la même transaction**. Il ne peut pas accepter sa propre demande (409). Refusée (409) si la demande est déjà traitée ou périmée (la facture a changé depuis).",
    auth: 'bearer',
    responses: [{ status: 200, description: 'Demande acceptée et appliquée.', type: ApprovalDto }],
    errors: [400, 404, 409, 422],
    params: [ID],
  })
  @RequirePermissions('billing.approvals:decide') @HttpCode(200) @Post(':id/approve')
  async approve(@CurrentUser() actor: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: DecideApprovalDto): Promise<ApprovalDto> {
    return unwrap(await this.decide.execute(actor.userId, id, true, dto.comment ?? null));
  }

  @DocOperation({
    summary: 'Refuser une demande',
    description: "Un responsable refuse ; le commentaire est **obligatoire**. La facture reste telle quelle. Il ne peut pas refuser sa propre demande (409).",
    auth: 'bearer',
    responses: [{ status: 200, description: 'Demande refusée.', type: ApprovalDto }],
    errors: [400, 404, 409, 422],
    params: [ID],
  })
  @RequirePermissions('billing.approvals:decide') @HttpCode(200) @Post(':id/reject')
  async reject(@CurrentUser() actor: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: DecideApprovalDto): Promise<ApprovalDto> {
    return unwrap(await this.decide.execute(actor.userId, id, false, dto.comment ?? null));
  }

  @DocOperation({
    summary: 'Retirer sa demande',
    description: "L'auteur retire sa demande tant qu'elle n'est pas décidée. Pour un autre utilisateur elle est « introuvable » (404).",
    auth: 'bearer',
    responses: [{ status: 200, description: 'Demande retirée.', type: ApprovalDto }],
    errors: [400, 404, 409],
    params: [ID],
  })
  @RequirePermissions('billing.approvals:request') @HttpCode(200) @Post(':id/withdraw')
  async withdraw(@CurrentUser() actor: AuthUser, @Param('id', ParseUUIDPipe) id: string): Promise<ApprovalDto> {
    return unwrap(await this.withdrawOne.execute(actor.userId, id));
  }
}
