import { Body, Controller, DefaultValuePipe, Get, HttpCode, Param, ParseIntPipe, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { DocGroup, DocOperation } from '../../api-docs';
import type { DocParam } from '../../api-docs';
import { CurrentUser, RequirePermissions } from '../../iam/presentation/decorators';
import type { AuthUser } from '../../iam/presentation/decorators';
import {
  CancelRequisitionUseCase, FindBySpecimenUseCase, GetRequisitionUseCase, ListRequisitionsUseCase, OrderRequisitionUseCase, SpecimenUseCases,
} from '../application/use-cases/requisitions';
import { CollectSpecimenDto, OrderRequisitionDto, ReasonDto, RejectSpecimenDto, RequisitionBySpecimenDto, RequisitionDto, RequisitionPageDto } from './dto/requisitions.dto';
import { unwrap } from './http-errors';

const ID: DocParam = { name: 'id', description: "Identifiant de la demande d'analyses.", example: '2a3b4c5d-6e7f-4a8b-9c0d-1e2f3a4b5c6d', format: 'uuid' };
const SPECIMEN: DocParam = { name: 'id', description: "Identifiant de l'échantillon.", example: '8a7b6c5d-4e3f-4a2b-9c1d-0e9f8a7b6c5d', format: 'uuid' };

@DocGroup(
  'Laboratoire · Demandes et échantillons',
  [
    "Le médecin **prescrit** des analyses ; le laboratoire **prélève**, **reçoit** ou **rejette** les échantillons.",
    '',
    "- Un **échantillon** est prévu par couple (type d'échantillon, contenant) : deux analyses sur le même tube partagent l'échantillon. Chacun a un **code-barres** (`SPC-…`) à coller sur le tube.",
    "- **Prélèvement** : le préleveur confirme **deux identifiants** lus sur le bracelet (numéro de dossier ET date de naissance). Un écart bloque le prélèvement (409) et la tentative est inscrite au journal.",
    "- **Réception** : seul un échantillon prélevé peut être reçu.",
    "- **Rejet** : motif de la liste (hémolysé, volume insuffisant…), précision obligatoire pour « autre ». Un **nouveau prélèvement** est créé automatiquement et les analyses lui sont rattachées ; l'échantillon rejeté reste dans l'historique.",
    "- **Traçabilité** : chaque échantillon garde la chaîne de ses étapes (qui, quand), jamais réécrite.",
    "- **Visibilité** : un prescripteur voit ses demandes ; le laboratoire et l'administrateur système (arbitrage) voient toutes les demandes. Chaque action est inscrite au journal d'audit.",
  ].join('\n'),
  55,
)
@Controller('api/v1/lab')
export class LabRequisitionsController {
  constructor(
    private readonly order: OrderRequisitionUseCase,
    private readonly getOne: GetRequisitionUseCase,
    private readonly listAll: ListRequisitionsUseCase,
    private readonly cancel: CancelRequisitionUseCase,
    private readonly bySpecimen: FindBySpecimenUseCase,
    private readonly specimens: SpecimenUseCases,
  ) {}

  @DocOperation({
    summary: "Lister les demandes d'analyses",
    description:
      "Les demandes actives d'abord (STAT, urgent, routine ; la plus ancienne en tête), puis les terminées. Un prescripteur ne voit que les siennes ; le laboratoire et l'administrateur système voient toutes les demandes. La consultation est inscrite au journal.",
    auth: 'bearer',
    responses: [{ status: 200, description: 'Une page de demandes.', type: RequisitionPageDto }],
    errors: [400, 422],
    query: [
      { name: 'status', description: '`ORDERED`, `PARTIALLY_COLLECTED`, `COLLECTED`, `RECEIVED` ou `CANCELLED`.', example: 'ORDERED' },
      { name: 'priority', description: '`ROUTINE`, `URGENT` ou `STAT`.', example: 'STAT' },
      { name: 'source', description: '`OPD`, `IPD`, `ER` ou `EXTERNAL`.', example: 'ER' },
      { name: 'section', description: 'Demandes qui comportent une analyse de cette section.', example: 'BIOCHEMISTRY' },
      { name: 'patientId', description: 'Un patient.', example: '3f2b8c1e-7a4d-4e5f-9b60-1c2d3e4f5a6b' },
      { name: 'number', description: 'Un numéro de demande.', example: 'LAB-0000123' },
      { name: 'barcode', description: 'Demande qui porte cet échantillon.', example: 'SPC-0000042' },
      { name: 'offset', description: 'Nombre de demandes à sauter (pagination).', example: 0 },
      { name: 'limit', description: 'Nombre de demandes par page (1 à 200).', example: 50 },
    ],
  })
  @RequirePermissions('lab.requisitions:read:own') @Get('requisitions')
  async list(
    @CurrentUser() actor: AuthUser,
    @Query('status') status: string | undefined,
    @Query('priority') priority: string | undefined,
    @Query('source') source: string | undefined,
    @Query('section') section: string | undefined,
    @Query('patientId') patientId: string | undefined,
    @Query('number') number: string | undefined,
    @Query('barcode') barcode: string | undefined,
    @Query('offset', new DefaultValuePipe(0), ParseIntPipe) offset: number,
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit: number,
  ): Promise<RequisitionPageDto> {
    return unwrap(await this.listAll.execute(actor.userId, { status, priority, source, section, patientId, number, barcode, offset, limit }));
  }

  @DocOperation({
    summary: "Prescrire des analyses",
    description:
      "Crée la demande d'un patient avec ses analyses (1 à 30, chacune une fois, actives au catalogue) et prévoit les **échantillons** à prélever, avec leurs codes-barres. Priorité `ROUTINE` par défaut, provenance `OPD`.",
    auth: 'bearer',
    responses: [{ status: 201, description: 'Demande créée (`ORDERED`).', type: RequisitionDto }],
    errors: [400, 404, 409, 422],
  })
  @RequirePermissions('lab.requisitions:order') @Post('requisitions')
  async orderRequisition(@CurrentUser() actor: AuthUser, @Body() dto: OrderRequisitionDto): Promise<RequisitionDto> {
    return unwrap(await this.order.execute(actor.userId, dto));
  }

  @DocOperation({
    summary: 'Lire une demande',
    description: "Avec ses analyses, ses échantillons et leur chaîne de traçabilité. Une demande qui n'est pas la sienne est « introuvable » pour un prescripteur. La consultation est inscrite au journal.",
    auth: 'bearer',
    responses: [{ status: 200, description: 'La demande.', type: RequisitionDto }],
    errors: [400, 404],
    params: [ID],
  })
  @RequirePermissions('lab.requisitions:read:own') @Get('requisitions/:id')
  async get(@CurrentUser() actor: AuthUser, @Param('id', ParseUUIDPipe) id: string): Promise<RequisitionDto> {
    return unwrap(await this.getOne.execute(actor.userId, id));
  }

  @DocOperation({
    summary: 'Annuler une demande',
    description: "Le prescripteur annule sa demande, le laboratoire n'importe laquelle. Le motif est obligatoire. Refusée (409) si la demande est déjà annulée ou si un échantillon est déjà arrivé au laboratoire.",
    auth: 'bearer',
    responses: [{ status: 200, description: 'Demande annulée.', type: RequisitionDto }],
    errors: [400, 404, 409, 422],
    params: [ID],
  })
  @RequirePermissions('lab.requisitions:cancel') @HttpCode(200) @Post('requisitions/:id/cancel')
  async cancelRequisition(@CurrentUser() actor: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: ReasonDto): Promise<RequisitionDto> {
    return unwrap(await this.cancel.execute(actor.userId, id, dto.reason));
  }

  @DocOperation({
    summary: 'Retrouver une demande par code-barres',
    description: "Pour le scan à la réception : renvoie la demande qui porte l'échantillon et l'identifiant de cet échantillon.",
    auth: 'bearer',
    responses: [{ status: 200, description: "La demande et l'échantillon scanné.", type: RequisitionBySpecimenDto }],
    errors: [404],
    params: [{ name: 'barcode', description: "Code-barres de l'échantillon.", example: 'SPC-0000042' }],
  })
  @RequirePermissions('lab.requisitions:read:own') @Get('specimens/by-barcode/:barcode')
  async findByBarcode(@CurrentUser() actor: AuthUser, @Param('barcode') barcode: string): Promise<RequisitionBySpecimenDto> {
    return unwrap(await this.bySpecimen.execute(actor.userId, barcode));
  }

  @DocOperation({
    summary: 'Prélever un échantillon',
    description:
      "Le préleveur confirme **deux identifiants** lus sur le bracelet : le numéro de dossier et la date de naissance. Un écart bloque le prélèvement (409 `LAB_IDENTITY_MISMATCH`) et la tentative est inscrite au journal. Refusé (409) si l'échantillon a déjà été prélevé ou rejeté, ou si la demande est annulée.",
    auth: 'bearer',
    responses: [{ status: 200, description: 'La demande avec son échantillon prélevé.', type: RequisitionDto }],
    errors: [400, 404, 409],
    params: [SPECIMEN],
  })
  @RequirePermissions('lab.specimens:collect') @HttpCode(200) @Post('specimens/:id/collect')
  async collect(@CurrentUser() actor: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: CollectSpecimenDto): Promise<RequisitionDto> {
    return unwrap(await this.specimens.collect(actor.userId, id, dto));
  }

  @DocOperation({
    summary: 'Recevoir un échantillon au laboratoire',
    description: "Seul un échantillon prélevé peut être reçu (409 sinon).",
    auth: 'bearer',
    responses: [{ status: 200, description: 'La demande avec son échantillon reçu.', type: RequisitionDto }],
    errors: [400, 404, 409],
    params: [SPECIMEN],
  })
  @RequirePermissions('lab.specimens:receive') @HttpCode(200) @Post('specimens/:id/receive')
  async receive(@CurrentUser() actor: AuthUser, @Param('id', ParseUUIDPipe) id: string): Promise<RequisitionDto> {
    return unwrap(await this.specimens.receive(actor.userId, id));
  }

  @DocOperation({
    summary: 'Rejeter un échantillon',
    description:
      "Motif de la liste (hémolysé, volume insuffisant, mauvais tube…), précision obligatoire pour `OTHER`. Un **nouveau prélèvement** est créé (avec un nouveau code-barres) et les analyses lui sont rattachées ; l'échantillon rejeté reste dans l'historique.",
    auth: 'bearer',
    responses: [{ status: 200, description: 'La demande avec son échantillon rejeté et son remplaçant.', type: RequisitionDto }],
    errors: [400, 404, 409, 422],
    params: [SPECIMEN],
  })
  @RequirePermissions('lab.specimens:reject') @HttpCode(200) @Post('specimens/:id/reject')
  async reject(@CurrentUser() actor: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: RejectSpecimenDto): Promise<RequisitionDto> {
    return unwrap(await this.specimens.reject(actor.userId, id, dto));
  }
}
