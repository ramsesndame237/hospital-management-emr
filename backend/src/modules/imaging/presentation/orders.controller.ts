import { Body, Controller, DefaultValuePipe, Get, HttpCode, Param, ParseIntPipe, ParseUUIDPipe, Post, Put, Query } from '@nestjs/common';
import { DocGroup, DocOperation } from '../../api-docs';
import type { DocParam } from '../../api-docs';
import { CurrentUser, RequirePermissions } from '../../iam/presentation/decorators';
import type { AuthUser } from '../../iam/presentation/decorators';
import { GetOrderUseCase, ListOrdersUseCase, OrderActionUseCases, OrderImagingUseCase } from '../application/use-cases/orders';
import { ReportUseCases } from '../application/use-cases/reports';
import { AddendumDto, CommunicationDto, OrderDto, OrderImagingDto, OrderPageDto, PerformDto, ReasonDto, ReportDraftDto, ScheduleDto } from './dto/orders.dto';
import { unwrap } from './http-errors';

const ID: DocParam = { name: 'id', description: "Identifiant de la demande d'examen.", example: '2a3b4c5d-6e7f-4a8b-9c0d-1e2f3a4b5c6d', format: 'uuid' };

@DocGroup(
  'Imagerie · Demandes et comptes rendus',
  [
    "Le médecin **demande** un examen (avec sa question clinique) ; le service d'imagerie le **planifie**, le **réalise** après dépistage de sécurité, puis rédige et **signe** le compte rendu.",
    '',
    "- **Dépistage de sécurité** : à la réalisation, grossesse et allergie au produit de contraste sont renseignées. Une grossesse avec un examen irradiant, ou une allergie avec un examen à produit de contraste, **bloque** l'examen (409) tant qu'un motif de dérogation n'est pas écrit.",
    "- **Compte rendu** : brouillon modifiable, puis signature (constatations et impression obligatoires). Une signature est définitive : on la complète par un **addendum** motivé (nouvelle version), jamais en la réécrivant.",
    "- **Découverte critique** : le brouillon est marqué critique ; la signature est refusée (409) tant que l'appel du clinicien (qui, comment, relecture confirmée) n'est pas documenté.",
    "- **Visibilité** : un prescripteur voit ses demandes et **seulement les comptes rendus signés** (jamais le brouillon ni le dépistage) ; le service d'imagerie et l'administrateur système (arbitrage) voient tout. Le journal d'audit n'enregistre jamais le texte clinique.",
  ].join('\n'),
  56.6,
)
@Controller('api/v1/imaging/orders')
export class ImagingOrdersController {
  constructor(
    private readonly order: OrderImagingUseCase,
    private readonly getOne: GetOrderUseCase,
    private readonly listAll: ListOrdersUseCase,
    private readonly actions: OrderActionUseCases,
    private readonly reports: ReportUseCases,
  ) {}

  @DocOperation({
    summary: "Lister les demandes d'examens",
    description:
      "Les demandes actives d'abord (STAT, urgent, routine ; la plus ancienne en tête), puis les terminées. Un prescripteur ne voit que les siennes ; le service d'imagerie et l'administrateur système voient toutes les demandes. La consultation est inscrite au journal.",
    auth: 'bearer',
    responses: [{ status: 200, description: 'Une page de demandes.', type: OrderPageDto }],
    errors: [400, 422],
    query: [
      { name: 'status', description: '`ORDERED`, `SCHEDULED`, `PERFORMED`, `REPORTED` ou `CANCELLED`.', example: 'ORDERED' },
      { name: 'priority', description: '`ROUTINE`, `URGENT` ou `STAT`.', example: 'STAT' },
      { name: 'source', description: '`OPD`, `IPD`, `ER` ou `EXTERNAL`.', example: 'ER' },
      { name: 'modality', description: 'Une modalité.', example: 'XRAY' },
      { name: 'patientId', description: 'Un patient.', example: '3f2b8c1e-7a4d-4e5f-9b60-1c2d3e4f5a6b' },
      { name: 'number', description: 'Un numéro de demande.', example: 'IMG-0000123' },
      { name: 'encounterId', description: 'Demandes prescrites pendant cette consultation.', example: '5b0f2b8e-2f5d-4a8c-8f0e-7d9c1a3b4e60' },
      { name: 'offset', description: 'Nombre de demandes à sauter (pagination).', example: 0 },
      { name: 'limit', description: 'Nombre de demandes par page (1 à 200).', example: 50 },
    ],
  })
  @RequirePermissions('imaging.orders:read:own') @Get()
  async list(
    @CurrentUser() actor: AuthUser,
    @Query('status') status: string | undefined,
    @Query('priority') priority: string | undefined,
    @Query('source') source: string | undefined,
    @Query('modality') modality: string | undefined,
    @Query('patientId') patientId: string | undefined,
    @Query('number') number: string | undefined,
    @Query('encounterId') encounterId: string | undefined,
    @Query('offset', new DefaultValuePipe(0), ParseIntPipe) offset: number,
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit: number,
  ): Promise<OrderPageDto> {
    return unwrap(await this.listAll.execute(actor.userId, { status, priority, source, modality, patientId, number, encounterId, offset, limit }));
  }

  @DocOperation({
    summary: "Demander un examen",
    description: "Crée la demande d'un patient pour un examen actif au catalogue. La **question clinique** est obligatoire. Priorité `ROUTINE` par défaut, provenance `OPD`. Peut être rattachée à la consultation en cours du même patient.",
    auth: 'bearer',
    responses: [{ status: 201, description: 'Demande créée (`ORDERED`).', type: OrderDto }],
    errors: [400, 404, 409, 422],
  })
  @RequirePermissions('imaging.orders:order') @Post()
  async orderExam(@CurrentUser() actor: AuthUser, @Body() dto: OrderImagingDto): Promise<OrderDto> {
    return unwrap(await this.order.execute(actor.userId, dto));
  }

  @DocOperation({
    summary: 'Lire une demande',
    description: "Avec son planning, sa réalisation et son compte rendu (un prescripteur ne lit que ce qui est signé). Une demande qui n'est pas la sienne est « introuvable » pour un prescripteur. La consultation est inscrite au journal.",
    auth: 'bearer',
    responses: [{ status: 200, description: 'La demande.', type: OrderDto }],
    errors: [400, 404],
    params: [ID],
  })
  @RequirePermissions('imaging.orders:read:own') @Get(':id')
  async get(@CurrentUser() actor: AuthUser, @Param('id', ParseUUIDPipe) id: string): Promise<OrderDto> {
    return unwrap(await this.getOne.execute(actor.userId, id));
  }

  @DocOperation({
    summary: 'Annuler une demande',
    description: "Le prescripteur annule sa demande, le service d'imagerie n'importe laquelle. Le motif est obligatoire. Refusée (409) si la demande est déjà annulée ou si l'examen est réalisé.",
    auth: 'bearer',
    responses: [{ status: 200, description: 'Demande annulée.', type: OrderDto }],
    errors: [400, 404, 409, 422],
    params: [ID],
  })
  @RequirePermissions('imaging.orders:cancel') @HttpCode(200) @Post(':id/cancel')
  async cancel(@CurrentUser() actor: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: ReasonDto): Promise<OrderDto> {
    return unwrap(await this.actions.cancel(actor.userId, id, dto.reason));
  }

  @DocOperation({
    summary: 'Planifier un examen',
    description: "Fixe (ou change) le créneau d'une demande non réalisée. Le créneau ne peut pas être dans le passé (409).",
    auth: 'bearer',
    responses: [{ status: 200, description: 'Demande planifiée (`SCHEDULED`).', type: OrderDto }],
    errors: [400, 404, 409, 422],
    params: [ID],
  })
  @RequirePermissions('imaging.orders:schedule') @HttpCode(200) @Post(':id/schedule')
  async schedule(@CurrentUser() actor: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: ScheduleDto): Promise<OrderDto> {
    return unwrap(await this.actions.schedule(actor.userId, id, dto.scheduledFor));
  }

  @DocOperation({
    summary: 'Réaliser un examen',
    description:
      "Enregistre la réalisation après le **dépistage de sécurité** (grossesse, allergie au produit de contraste). Une contre-indication (grossesse + examen irradiant, allergie + produit de contraste) est refusée (409) tant qu'aucun `overrideReason` n'est donné ; la tentative est inscrite au journal sans en révéler la nature.",
    auth: 'bearer',
    responses: [{ status: 200, description: 'Examen réalisé (`PERFORMED`) : le compte rendu peut être rédigé.', type: OrderDto }],
    errors: [400, 404, 409, 422],
    params: [ID],
  })
  @RequirePermissions('imaging.exams:perform') @HttpCode(200) @Post(':id/perform')
  async perform(@CurrentUser() actor: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: PerformDto): Promise<OrderDto> {
    return unwrap(await this.actions.perform(actor.userId, id, dto));
  }

  @DocOperation({
    summary: 'Enregistrer le brouillon du compte rendu',
    description: "Remplace le brouillon (technique, constatations, impression, découverte critique). Seulement entre la réalisation et la signature : après, on passe par un addendum (409).",
    auth: 'bearer',
    responses: [{ status: 200, description: 'La demande avec son brouillon.', type: OrderDto }],
    errors: [400, 404, 409, 422],
    params: [ID],
  })
  @RequirePermissions('imaging.reports:write') @Put(':id/report-draft')
  async saveDraft(@CurrentUser() actor: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: ReportDraftDto): Promise<OrderDto> {
    return unwrap(await this.reports.saveDraft(actor.userId, id, dto));
  }

  @DocOperation({
    summary: "Documenter l'appel d'une découverte critique",
    description: "Pour un brouillon marqué critique : qui a été prévenu, sa fonction, le moyen, et la **relecture** de la découverte (`readBackConfirmed` doit être `true`, 422 sinon). Conditionne la signature.",
    auth: 'bearer',
    responses: [{ status: 200, description: 'La demande avec l’appel documenté.', type: OrderDto }],
    errors: [400, 404, 409, 422],
    params: [ID],
  })
  @RequirePermissions('imaging.reports:notify') @HttpCode(200) @Post(':id/critical-communication')
  async communicate(@CurrentUser() actor: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: CommunicationDto): Promise<OrderDto> {
    return unwrap(await this.reports.recordCommunication(actor.userId, id, dto));
  }

  @DocOperation({
    summary: 'Signer le compte rendu',
    description: "Constatations et impression obligatoires ; une découverte critique exige l'appel documenté (409 sinon). La demande passe à `REPORTED` et le prescripteur peut lire le compte rendu. Définitif : la suite passe par un addendum.",
    auth: 'bearer',
    responses: [{ status: 200, description: 'Compte rendu signé (`REPORTED`).', type: OrderDto }],
    errors: [400, 404, 409],
    params: [ID],
  })
  @RequirePermissions('imaging.reports:sign') @HttpCode(200) @Post(':id/report/sign')
  async sign(@CurrentUser() actor: AuthUser, @Param('id', ParseUUIDPipe) id: string): Promise<OrderDto> {
    return unwrap(await this.reports.sign(actor.userId, id));
  }

  @DocOperation({
    summary: 'Compléter un compte rendu signé (addendum)',
    description: "Nouvelle version signée avec son motif ; les versions précédentes restent lisibles. Une découverte critique exige `communication` (409 sinon).",
    auth: 'bearer',
    responses: [{ status: 200, description: 'La demande avec sa nouvelle version.', type: OrderDto }],
    errors: [400, 404, 409, 422],
    params: [ID],
  })
  @RequirePermissions('imaging.reports:sign') @HttpCode(200) @Post(':id/report/addendum')
  async addendum(@CurrentUser() actor: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: AddendumDto): Promise<OrderDto> {
    return unwrap(await this.reports.addendum(actor.userId, id, dto));
  }
}
