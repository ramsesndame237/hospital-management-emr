import { Body, Controller, DefaultValuePipe, Get, HttpCode, Param, ParseIntPipe, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { DocGroup, DocOperation } from '../../api-docs';
import type { DocParam } from '../../api-docs';
import { CurrentUser, RequirePermissions } from '../../iam/presentation/decorators';
import type { AuthUser } from '../../iam/presentation/decorators';
import { GetAppointmentUseCase, ListAppointmentsUseCase, ManageAppointmentUseCases, ScheduleAppointmentUseCase } from '../application/use-cases/appointments';
import { AppointmentDto, AppointmentPageDto, CancelAppointmentDto, RescheduleAppointmentDto, ScheduleAppointmentDto } from './dto/appointments.dto';
import { unwrap } from './http-errors';

const ID: DocParam = { name: 'id', description: 'Identifiant du rendez-vous.', example: '6a7b8c9d-0e1f-4a2b-8c3d-4e5f6a7b8c9d', format: 'uuid' };

@DocGroup(
  'Rendez-vous',
  [
    "Prise de rendez-vous : un patient est attendu par un professionnel, dans un service ou une unité, sur un créneau.",
    '',
    "- **Contrôles** : le professionnel doit être en poste et affecté au service ce jour-là ; le service doit être actif ; le patient doit être vivant ; ni le professionnel ni le patient ne peuvent avoir deux rendez-vous qui se chevauchent (même en cas de réservations simultanées : la vérification et l'écriture se font sous verrou).",
    "- **Heure** : toujours avec fuseau (`+01:00`, `Z`…). Le jour d'un rendez-vous, pour l'emploi du professionnel, est celui du fuseau de l'établissement.",
    "- **Périmètre** : l'accueil et l'administrateur système voient et gèrent tous les services ; les médecins gèrent ceux de leur service, les infirmiers les consultent. Hors périmètre, un rendez-vous est « introuvable ».",
    "- **Cycle de vie** : `SCHEDULED` → `ARRIVED` (le patient se présente : une admission est ouverte avec `appointmentId`), `CANCELLED` (motif obligatoire) ou `NO_SHOW` (patient absent, une fois le créneau commencé). Rien n'est supprimé.",
    "- Chaque modification, ouverture de rendez-vous et consultation de l'agenda est inscrite au journal d'audit (identifiants et critères, jamais de nom).",
  ].join('\n'),
  46,
)
@Controller('api/v1/appointments')
export class AppointmentsController {
  constructor(
    private readonly schedule: ScheduleAppointmentUseCase,
    private readonly manage: ManageAppointmentUseCases,
    private readonly getOne: GetAppointmentUseCase,
    private readonly listAll: ListAppointmentsUseCase,
  ) {}

  @DocOperation({
    summary: "Consulter l'agenda",
    description: "Les rendez-vous des services que vous pouvez voir, du plus proche au plus lointain. Les filtres se cumulent. La consultation est inscrite au journal d'audit.",
    auth: 'bearer',
    responses: [{ status: 200, description: 'Une page de rendez-vous.', type: AppointmentPageDto }],
    errors: [400, 422],
    query: [
      { name: 'from', description: 'Début de période (ISO 8601 avec fuseau, inclus).', example: '2026-11-02T00:00:00+01:00' },
      { name: 'to', description: 'Fin de période (ISO 8601 avec fuseau, exclue).', example: '2026-11-03T00:00:00+01:00' },
      { name: 'practitionerId', description: 'Un professionnel.', example: 'c0a8f1d2-5b7e-4c1a-9d3f-6e2b8a4f7c11' },
      { name: 'patientId', description: 'Un patient.', example: '3f2b8c1e-7a4d-4e5f-9b60-1c2d3e4f5a6b' },
      { name: 'serviceId', description: 'Un service.', example: '9b1c0a5e-34d2-4b8e-a8c1-52f3b7a1d001' },
      { name: 'status', description: '`SCHEDULED`, `ARRIVED`, `CANCELLED` ou `NO_SHOW`.', example: 'SCHEDULED' },
      { name: 'offset', description: 'Nombre de rendez-vous à sauter (pagination).', example: 0 },
      { name: 'limit', description: 'Nombre de rendez-vous par page (1 à 200).', example: 50 },
    ],
  })
  @RequirePermissions('appointments:read:department') @Get()
  async list(
    @CurrentUser() actor: AuthUser,
    @Query('from') from: string | undefined,
    @Query('to') to: string | undefined,
    @Query('practitionerId') practitionerId: string | undefined,
    @Query('patientId') patientId: string | undefined,
    @Query('serviceId') serviceId: string | undefined,
    @Query('status') status: string | undefined,
    @Query('offset', new DefaultValuePipe(0), ParseIntPipe) offset: number,
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit: number,
  ): Promise<AppointmentPageDto> {
    return unwrap(await this.listAll.execute(actor.userId, { from, to, practitionerId, patientId, serviceId, status, offset, limit }));
  }

  @DocOperation({
    summary: 'Prendre un rendez-vous',
    description: 'Vérifie le patient, le service, l\'emploi et l\'affectation du professionnel à cette date, le motif, puis l\'absence de chevauchement. Aucune écriture si un contrôle échoue.',
    auth: 'bearer',
    responses: [{ status: 201, description: 'Rendez-vous pris.', type: AppointmentDto }],
    errors: [400, 403, 404, 409, 422],
  })
  @RequirePermissions('appointments:write:department') @Post()
  async create(@CurrentUser() actor: AuthUser, @Body() dto: ScheduleAppointmentDto): Promise<AppointmentDto> {
    return unwrap(await this.schedule.execute(actor.userId, dto));
  }

  @DocOperation({
    summary: 'Lire un rendez-vous',
    auth: 'bearer',
    responses: [{ status: 200, description: 'Le rendez-vous.', type: AppointmentDto }],
    errors: [400, 404],
    params: [ID],
  })
  @RequirePermissions('appointments:read:department') @Get(':id')
  async get(@CurrentUser() actor: AuthUser, @Param('id', ParseUUIDPipe) id: string): Promise<AppointmentDto> {
    return unwrap(await this.getOne.execute(actor.userId, id));
  }

  @DocOperation({
    summary: 'Déplacer un rendez-vous',
    description: "Change l'horaire, la durée, le professionnel, le lieu et/ou le motif d'un rendez-vous **à venir** (409 s'il est clos). Champs absents : inchangés. Les contrôles de la prise de rendez-vous s'appliquent à ce qui change.",
    auth: 'bearer',
    responses: [{ status: 200, description: 'Rendez-vous mis à jour.', type: AppointmentDto }],
    errors: [400, 403, 404, 409, 422],
    params: [ID],
  })
  @RequirePermissions('appointments:write:department') @HttpCode(200) @Post(':id/reschedule')
  async reschedule(@CurrentUser() actor: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: RescheduleAppointmentDto): Promise<AppointmentDto> {
    return unwrap(await this.manage.reschedule(actor.userId, id, dto));
  }

  @DocOperation({
    summary: 'Annuler un rendez-vous',
    description: 'Le motif est obligatoire. Libère le créneau. Un rendez-vous déjà honoré, annulé ou clos ne s\'annule pas (409).',
    auth: 'bearer',
    responses: [{ status: 200, description: 'Rendez-vous annulé.', type: AppointmentDto }],
    errors: [400, 404, 409, 422],
    params: [ID],
  })
  @RequirePermissions('appointments:write:department') @HttpCode(200) @Post(':id/cancel')
  async cancel(@CurrentUser() actor: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: CancelAppointmentDto): Promise<AppointmentDto> {
    return unwrap(await this.manage.cancel(actor.userId, id, dto.reason));
  }

  @DocOperation({
    summary: 'Constater une absence',
    description: "Le patient ne s'est pas présenté. Possible seulement une fois le créneau commencé (409 avant).",
    auth: 'bearer',
    responses: [{ status: 200, description: 'Absence constatée.', type: AppointmentDto }],
    errors: [400, 404, 409],
    params: [ID],
  })
  @RequirePermissions('appointments:write:department') @HttpCode(200) @Post(':id/no-show')
  async noShow(@CurrentUser() actor: AuthUser, @Param('id', ParseUUIDPipe) id: string): Promise<AppointmentDto> {
    return unwrap(await this.manage.markNoShow(actor.userId, id));
  }
}
