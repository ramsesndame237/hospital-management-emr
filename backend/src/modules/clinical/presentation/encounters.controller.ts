import { Body, Controller, DefaultValuePipe, Get, HttpCode, Param, ParseBoolPipe, ParseIntPipe, ParseUUIDPipe, Post, Put, Query } from '@nestjs/common';
import { DocGroup, DocOperation } from '../../api-docs';
import type { DocParam } from '../../api-docs';
import { CurrentUser, RequirePermissions } from '../../iam/presentation/decorators';
import type { AuthUser } from '../../iam/presentation/decorators';
import { EncounterActionUseCases, GetEncounterUseCase, ListEncountersUseCase, QueueUseCase, StartEncounterUseCase } from '../application/use-cases/encounters';
import {
  AddendumDto, CancelEncounterDto, EncounterDto, EncounterPageDto, QueueItemDto, SetDiagnosesDto, StartEncounterDto, UpdateNoteDto, VitalsInputDto,
} from './dto/encounters.dto';
import { unwrap } from './http-errors';

const ID: DocParam = { name: 'id', description: 'Identifiant de la consultation.', example: '5b0f2b8e-2f5d-4a8c-8f0e-7d9c1a3b4e60', format: 'uuid' };

@DocGroup(
  'Clinique · Consultations',
  [
    'La consultation d’un patient par un médecin : constantes, note SOAP, diagnostics CIM-10, signature.',
    '',
    '- Elle s’ouvre pour un patient **arrivé** (admission en cours, consultation externe ou urgence) dans un service où le médecin exerce ; une admission n’a qu’**une consultation en cours**.',
    '- Tant qu’elle est `IN_PROGRESS`, le **médecin qui la conduit** rédige la note et les diagnostics ; le médecin ou l’infirmier du service relèvent les constantes.',
    '- Elle se **signe** (il faut un diagnostic principal et une évaluation) : elle est alors **verrouillée**, en base aussi ; les corrections passent par des **addenda** datés et signés. Une consultation ouverte par erreur s’annule avec un motif.',
    '- Chaque accès et chaque modification sont inscrits au journal d’audit, **sans le contenu clinique**. Hors de leur service, les consultations « n’existent pas » (404).',
  ].join('\n'),
  59.5,
)
@Controller('api/v1/clinical')
export class ClinicalEncountersController {
  constructor(
    private readonly start: StartEncounterUseCase,
    private readonly getOne: GetEncounterUseCase,
    private readonly listAll: ListEncountersUseCase,
    private readonly queue: QueueUseCase,
    private readonly actions: EncounterActionUseCases,
  ) {}

  @DocOperation({
    summary: 'File d’attente du médecin',
    description: 'Les patients arrivés (consultation externe, urgence) et pas encore vus, dans vos services, les plus anciens d’abord. Ceux dont la consultation est en cours y figurent avec elle ; ceux dont la consultation est signée n’y figurent plus.',
    auth: 'bearer',
    responses: [{ status: 200, description: 'La file d’attente (100 patients au plus).', type: QueueItemDto, isArray: true }],
    errors: [],
  })
  @RequirePermissions('clinical.encounters:read:department') @Get('queue')
  async getQueue(@CurrentUser() actor: AuthUser): Promise<QueueItemDto[]> {
    return (await this.queue.execute(actor.userId)) as QueueItemDto[];
  }

  @DocOperation({
    summary: 'Lister les consultations',
    description: 'Dans vos services, les plus récentes d’abord. `patientId` donne l’historique d’un patient ; `mine=true` ne garde que celles que vous conduisez.',
    auth: 'bearer',
    responses: [{ status: 200, description: 'Une page de consultations (sans le texte des notes).', type: EncounterPageDto }],
    errors: [400, 422],
    query: [
      { name: 'status', description: 'Un statut : `IN_PROGRESS`, `SIGNED` ou `CANCELLED`.', example: 'SIGNED' },
      { name: 'patientId', description: 'Un patient.', example: '5b0f2b8e-2f5d-4a8c-8f0e-7d9c1a3b4e60' },
      { name: 'mine', description: 'Seulement mes consultations (`true`).', example: 'false' },
      { name: 'offset', description: 'Nombre de consultations à sauter.', example: 0 },
      { name: 'limit', description: 'Nombre de consultations par page (1 à 200).', example: 50 },
    ],
  })
  @RequirePermissions('clinical.encounters:read:department') @Get('encounters')
  async list(
    @CurrentUser() actor: AuthUser,
    @Query('status') status: string | undefined,
    @Query('patientId') patientId: string | undefined,
    @Query('mine', new DefaultValuePipe(false), ParseBoolPipe) mine: boolean,
    @Query('offset', new DefaultValuePipe(0), ParseIntPipe) offset: number,
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit: number,
  ): Promise<EncounterPageDto> {
    return unwrap(await this.listAll.execute(actor.userId, { status, patientId, mine, offset, limit }));
  }

  @DocOperation({
    summary: 'Ouvrir une consultation',
    description: 'Pour un patient arrivé (admission en cours, hors hospitalisation). Refus : admission introuvable ou hors de vos services (404), terminée (409), hospitalisation (409), consultation déjà en cours (409 : la file d’attente donne celle à reprendre).',
    auth: 'bearer',
    responses: [{ status: 201, description: 'La consultation ouverte, au nom du médecin.', type: EncounterDto }],
    errors: [400, 404, 409],
  })
  @RequirePermissions('clinical.encounters:write:department') @Post('encounters')
  async startEncounter(@CurrentUser() actor: AuthUser, @Body() dto: StartEncounterDto): Promise<EncounterDto> {
    return unwrap(await this.start.execute(actor.userId, dto.admissionId));
  }

  @DocOperation({
    summary: 'Lire une consultation',
    description: 'Avec la note, les diagnostics, les addenda, les constantes et les allergies actives du patient. L’accès est inscrit au journal d’audit.',
    auth: 'bearer',
    responses: [{ status: 200, description: 'La consultation.', type: EncounterDto }],
    errors: [400, 404],
    params: [ID],
  })
  @RequirePermissions('clinical.encounters:read:department') @Get('encounters/:id')
  async get(@CurrentUser() actor: AuthUser, @Param('id', ParseUUIDPipe) id: string): Promise<EncounterDto> {
    return unwrap(await this.getOne.execute(actor.userId, id));
  }

  @DocOperation({
    summary: 'Relever les constantes',
    description: 'Remplace le relevé précédent. Par le médecin ou l’infirmier du service, tant que la consultation est en cours (409 sinon). Bornes plausibles, une décimale pour température, poids et taille, diastolique inférieure à la systolique.',
    auth: 'bearer',
    responses: [{ status: 200, description: 'La consultation avec ses constantes.', type: EncounterDto }],
    errors: [400, 404, 409, 422],
    params: [ID],
  })
  @RequirePermissions('clinical.vitals:record:department') @Put('encounters/:id/vitals')
  async vitals(@CurrentUser() actor: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: VitalsInputDto): Promise<EncounterDto> {
    return unwrap(await this.actions.recordVitals(actor.userId, id, dto));
  }

  @DocOperation({
    summary: 'Rédiger la note',
    description: 'Les champs absents sont inchangés, un champ vide est effacé. Réservé au médecin qui conduit la consultation (403 pour un autre), tant qu’elle est en cours (409 sinon).',
    auth: 'bearer',
    responses: [{ status: 200, description: 'La consultation avec sa note.', type: EncounterDto }],
    errors: [400, 403, 404, 409, 422],
    params: [ID],
  })
  @RequirePermissions('clinical.encounters:write:department') @Put('encounters/:id/note')
  async note(@CurrentUser() actor: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateNoteDto): Promise<EncounterDto> {
    return unwrap(await this.actions.updateNote(actor.userId, id, dto));
  }

  @DocOperation({
    summary: 'Poser les diagnostics',
    description: 'Remplace d’un bloc les diagnostics CIM-10 : au plus 10, un seul principal, pas deux fois le même code. Réservé au médecin de la consultation, tant qu’elle est en cours.',
    auth: 'bearer',
    responses: [{ status: 200, description: 'La consultation avec ses diagnostics.', type: EncounterDto }],
    errors: [400, 403, 404, 409, 422],
    params: [ID],
  })
  @RequirePermissions('clinical.encounters:write:department') @Put('encounters/:id/diagnoses')
  async diagnoses(@CurrentUser() actor: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: SetDiagnosesDto): Promise<EncounterDto> {
    return unwrap(await this.actions.setDiagnoses(actor.userId, id, dto.diagnoses));
  }

  @DocOperation({
    summary: 'Signer la consultation',
    description: 'Verrouille la consultation (en base aussi). Il faut un diagnostic principal et une évaluation : sinon 409, avec ce qui manque. Réservé au médecin de la consultation.',
    auth: 'bearer',
    responses: [{ status: 200, description: 'La consultation signée.', type: EncounterDto }],
    errors: [400, 403, 404, 409],
    params: [ID],
  })
  @RequirePermissions('clinical.encounters:write:department') @HttpCode(200) @Post('encounters/:id/sign')
  async sign(@CurrentUser() actor: AuthUser, @Param('id', ParseUUIDPipe) id: string): Promise<EncounterDto> {
    return unwrap(await this.actions.sign(actor.userId, id));
  }

  @DocOperation({
    summary: 'Ajouter un addendum',
    description: 'Complète ou corrige une consultation **signée** sans la modifier : le texte est daté, signé et ajouté à la suite. Réservé au médecin de la consultation. 409 si elle n’est pas signée.',
    auth: 'bearer',
    responses: [{ status: 200, description: 'La consultation avec son nouvel addendum.', type: EncounterDto }],
    errors: [400, 403, 404, 409, 422],
    params: [ID],
  })
  @RequirePermissions('clinical.encounters:write:department') @HttpCode(200) @Post('encounters/:id/addenda')
  async addendum(@CurrentUser() actor: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: AddendumDto): Promise<EncounterDto> {
    return unwrap(await this.actions.addAddendum(actor.userId, id, dto.text));
  }

  @DocOperation({
    summary: 'Annuler la consultation',
    description: 'Pour une consultation ouverte par erreur, tant qu’elle est en cours. Le motif est obligatoire. Réservé au médecin de la consultation.',
    auth: 'bearer',
    responses: [{ status: 200, description: 'La consultation annulée.', type: EncounterDto }],
    errors: [400, 403, 404, 409, 422],
    params: [ID],
  })
  @RequirePermissions('clinical.encounters:write:department') @HttpCode(200) @Post('encounters/:id/cancel')
  async cancel(@CurrentUser() actor: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: CancelEncounterDto): Promise<EncounterDto> {
    return unwrap(await this.actions.cancel(actor.userId, id, dto.reason));
  }
}
