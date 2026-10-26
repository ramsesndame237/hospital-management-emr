import { Body, Controller, DefaultValuePipe, Get, HttpCode, Param, ParseIntPipe, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { DocGroup, DocOperation } from '../../api-docs';
import type { DocParam } from '../../api-docs';
import { CurrentUser, RequirePermissions } from '../../iam/presentation/decorators';
import type { AuthUser } from '../../iam/presentation/decorators';
import { GetAdmissionUseCase, GetOccupancyUseCase, ListAdmissionsUseCase, ManageAdmissionUseCases, OpenAdmissionUseCase } from '../application/use-cases/admissions';
import { AdmissionDto, AdmissionPageDto, CancelAdmissionDto, DischargeAdmissionDto, MovementDto, OccupancyDto, OpenAdmissionDto, TransferAdmissionDto } from './dto/admissions.dto';
import { unwrap } from './http-errors';

const ID: DocParam = { name: 'id', description: "Identifiant de l'admission.", example: '8b9c0d1e-2f3a-4b4c-8d5e-6f7081920a1b', format: 'uuid' };

@DocGroup(
  'Admissions',
  [
    "Arrivée d'un patient dans un service — consultation, urgence ou **hospitalisation** — jusqu'à sa sortie, et occupation des lits.",
    '',
    "- **Hospitalisation** : un lit libre et actif est exigé ; le service est celui du lit. **Un lit n'a qu'un occupant** et **un patient n'a qu'une hospitalisation en cours** — garanti par la base, même si deux postes visent le même lit en même temps (le second reçoit 409).",
    "- **Rendez-vous** : avec `appointmentId`, l'admission honore le rendez-vous du patient, qui passe à `ARRIVED`.",
    "- **Cycle de vie** : `IN_PROGRESS` → `DISCHARGED` (sortie enregistrée, lit libéré) ou `CANCELLED` (ouverte par erreur, motif obligatoire). Rien n'est supprimé ; chaque arrivée, transfert, sortie et annulation est archivé (`/movements`), en ajout seul.",
    "- **Périmètre** : l'accueil et l'administrateur système gèrent tous les services ; médecins et infirmiers ceux de leur service. Hors périmètre, une admission est « introuvable ».",
    "- Ouvertures, consultations et tableaux de lits sont inscrits au journal d'audit (identifiants et critères, jamais de nom).",
  ].join('\n'),
  47,
)
@Controller('api/v1/admissions')
export class AdmissionsController {
  constructor(
    private readonly open: OpenAdmissionUseCase,
    private readonly manage: ManageAdmissionUseCases,
    private readonly getOne: GetAdmissionUseCase,
    private readonly listAll: ListAdmissionsUseCase,
    private readonly occupancy: GetOccupancyUseCase,
  ) {}

  @DocOperation({
    summary: "Tableau d'occupation des lits d'un service",
    description: "Tous les lits du service avec leur occupant, la capacité (lits actifs), le nombre d'occupés et de libres. La consultation est inscrite au journal d'audit.",
    auth: 'bearer',
    responses: [{ status: 200, description: "L'occupation du service.", type: OccupancyDto }],
    errors: [400, 404],
    query: [{ name: 'serviceId', description: 'Le service (pas une unité).', example: '9b1c0a5e-34d2-4b8e-a8c1-52f3b7a1d001' }],
  })
  @RequirePermissions('admissions:read:department') @Get('occupancy')
  async getOccupancy(@CurrentUser() actor: AuthUser, @Query('serviceId', ParseUUIDPipe) serviceId: string): Promise<OccupancyDto> {
    return unwrap(await this.occupancy.execute(actor.userId, serviceId));
  }

  @DocOperation({
    summary: 'Lister les admissions',
    description: 'Les admissions des services que vous pouvez voir, des plus récentes aux plus anciennes. Les filtres se cumulent. La consultation est inscrite au journal d\'audit.',
    auth: 'bearer',
    responses: [{ status: 200, description: 'Une page d\'admissions.', type: AdmissionPageDto }],
    errors: [400, 422],
    query: [
      { name: 'status', description: '`IN_PROGRESS`, `DISCHARGED` ou `CANCELLED`.', example: 'IN_PROGRESS' },
      { name: 'type', description: '`OUTPATIENT`, `EMERGENCY` ou `INPATIENT`.', example: 'INPATIENT' },
      { name: 'patientId', description: 'Un patient.', example: '3f2b8c1e-7a4d-4e5f-9b60-1c2d3e4f5a6b' },
      { name: 'practitionerId', description: 'Un professionnel responsable.', example: 'c0a8f1d2-5b7e-4c1a-9d3f-6e2b8a4f7c11' },
      { name: 'serviceId', description: 'Un service.', example: '9b1c0a5e-34d2-4b8e-a8c1-52f3b7a1d001' },
      { name: 'from', description: "Début de période d'arrivée (ISO 8601 avec fuseau, inclus).", example: '2026-11-01T00:00:00+01:00' },
      { name: 'to', description: "Fin de période d'arrivée (ISO 8601 avec fuseau, exclue).", example: '2026-11-08T00:00:00+01:00' },
      { name: 'offset', description: "Nombre d'admissions à sauter (pagination).", example: 0 },
      { name: 'limit', description: "Nombre d'admissions par page (1 à 200).", example: 50 },
    ],
  })
  @RequirePermissions('admissions:read:department') @Get()
  async list(
    @CurrentUser() actor: AuthUser,
    @Query('status') status: string | undefined,
    @Query('type') type: string | undefined,
    @Query('patientId') patientId: string | undefined,
    @Query('practitionerId') practitionerId: string | undefined,
    @Query('serviceId') serviceId: string | undefined,
    @Query('from') from: string | undefined,
    @Query('to') to: string | undefined,
    @Query('offset', new DefaultValuePipe(0), ParseIntPipe) offset: number,
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit: number,
  ): Promise<AdmissionPageDto> {
    return unwrap(await this.listAll.execute(actor.userId, { status, type, patientId, practitionerId, serviceId, from, to, offset, limit }));
  }

  @DocOperation({
    summary: 'Ouvrir une admission',
    description:
      "Vérifie le patient (vivant), le lieu (lit libre et actif pour une hospitalisation ; service ou unité actif sinon), le périmètre, le professionnel (en poste et affecté), le motif et le rendez-vous éventuel. Aucune écriture si un contrôle échoue. Si le rendez-vous ne peut pas être marqué `ARRIVED` après coup, l'admission est conservée et l'incident est inscrit au journal d'audit.",
    auth: 'bearer',
    responses: [{ status: 201, description: 'Admission ouverte.', type: AdmissionDto }],
    errors: [400, 403, 404, 409, 422],
  })
  @RequirePermissions('admissions:write:department') @Post()
  async create(@CurrentUser() actor: AuthUser, @Body() dto: OpenAdmissionDto): Promise<AdmissionDto> {
    return unwrap(await this.open.execute(actor.userId, dto));
  }

  @DocOperation({
    summary: 'Lire une admission',
    auth: 'bearer',
    responses: [{ status: 200, description: "L'admission.", type: AdmissionDto }],
    errors: [400, 404],
    params: [ID],
  })
  @RequirePermissions('admissions:read:department') @Get(':id')
  async get(@CurrentUser() actor: AuthUser, @Param('id', ParseUUIDPipe) id: string): Promise<AdmissionDto> {
    return unwrap(await this.getOne.execute(actor.userId, id));
  }

  @DocOperation({
    summary: "Historique des mouvements d'une admission",
    description: "Arrivée, transferts, sortie ou annulation, avec le service, le lit, l'auteur et l'heure — dans l'ordre. En ajout seul.",
    auth: 'bearer',
    responses: [{ status: 200, description: 'Les mouvements.', type: MovementDto, isArray: true }],
    errors: [400, 404],
    params: [ID],
  })
  @RequirePermissions('admissions:read:department') @Get(':id/movements')
  async movements(@CurrentUser() actor: AuthUser, @Param('id', ParseUUIDPipe) id: string): Promise<MovementDto[]> {
    return unwrap(await this.getOne.movements(actor.userId, id));
  }

  @DocOperation({
    summary: 'Transférer un patient',
    description: "Hospitalisation : `bedId` du nouveau lit (libre, actif ; le service suit le lit). Autre admission : `serviceId` du nouveau service ou de la nouvelle unité. L'ancien lit est libéré. Le lieu doit changer (409 sinon). Le mouvement est archivé.",
    auth: 'bearer',
    responses: [{ status: 200, description: 'Admission mise à jour.', type: AdmissionDto }],
    errors: [400, 403, 404, 409, 422],
    params: [ID],
  })
  @RequirePermissions('admissions:write:department') @HttpCode(200) @Post(':id/transfer')
  async transfer(@CurrentUser() actor: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: TransferAdmissionDto): Promise<AdmissionDto> {
    return unwrap(await this.manage.transfer(actor.userId, id, dto));
  }

  @DocOperation({
    summary: 'Enregistrer la sortie',
    description: "Termine l'admission (heure de sortie : maintenant par défaut, entre l'arrivée et maintenant) et libère le lit. Une admission déjà terminée ou annulée ne se modifie plus (409).",
    auth: 'bearer',
    responses: [{ status: 200, description: 'Sortie enregistrée.', type: AdmissionDto }],
    errors: [400, 404, 409, 422],
    params: [ID],
  })
  @RequirePermissions('admissions:write:department') @HttpCode(200) @Post(':id/discharge')
  async discharge(@CurrentUser() actor: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: DischargeAdmissionDto): Promise<AdmissionDto> {
    return unwrap(await this.manage.discharge(actor.userId, id, dto));
  }

  @DocOperation({
    summary: 'Annuler une admission ouverte par erreur',
    description: 'Le motif est obligatoire. Libère le lit. L\'admission est conservée, au statut `CANCELLED`.',
    auth: 'bearer',
    responses: [{ status: 200, description: 'Admission annulée.', type: AdmissionDto }],
    errors: [400, 404, 409, 422],
    params: [ID],
  })
  @RequirePermissions('admissions:write:department') @HttpCode(200) @Post(':id/cancel')
  async cancel(@CurrentUser() actor: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: CancelAdmissionDto): Promise<AdmissionDto> {
    return unwrap(await this.manage.cancel(actor.userId, id, dto.reason));
  }
}
