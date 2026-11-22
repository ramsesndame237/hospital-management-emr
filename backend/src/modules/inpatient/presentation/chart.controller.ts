import { Body, Controller, Get, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { DocGroup, DocOperation } from '../../api-docs';
import type { DocParam } from '../../api-docs';
import { CurrentUser, RequirePermissions } from '../../iam/presentation/decorators';
import type { AuthUser } from '../../iam/presentation/decorators';
import { AddNoteUseCase, GetChartUseCase, ListWardUseCase, RecordAdministrationUseCase, RecordObservationUseCase } from '../application/use-cases/chart';
import { AddNoteDto, AdministrationDto, ChartDto, NoteDto, RecordAdministrationDto, RecordedObservationDto, RecordObservationDto, WardRowDto } from './dto/chart.dto';
import { unwrap } from './http-errors';

const ID: DocParam = { name: 'id', description: "Identifiant de l'admission (hospitalisation).", example: '8b9c0d1e-2f3a-4b4c-8d5e-6f7081920a1b', format: 'uuid' };

@DocGroup(
  'Hospitalisation · Soins',
  [
    "Soins au lit du patient hospitalisé : **constantes** avec score d'alerte NEWS2, **administration des médicaments** prescrits (MAR) et **notes de soins**.",
    '',
    "- **Périmètre** : un soignant ne voit et n'écrit que dans les services où il est affecté ; hors de son périmètre, une hospitalisation « n'existe pas » (404).",
    "- **NEWS2** : calculé à la saisie d'après sept paramètres et conservé tel quel. `HIGH` (7 et plus) demande d'appeler le médecin sans attendre (`escalate: true`).",
    "- **Ajout seul** : relevés, administrations et notes ne se modifient ni ne s'effacent (la base l'interdit). Une erreur se corrige par un nouveau relevé et une note.",
    "- **Médicaments** : ne figurent que les lignes des ordonnances émises pendant les **tournées** de cette hospitalisation (consultation d'un patient hospitalisé), non annulées. Un refus ou une suspension exige un motif.",
    "- Plus aucun soin ne peut être ajouté après la sortie du patient.",
    "- Le journal d'audit garde qui a fait quoi, jamais une valeur clinique.",
  ].join('\n'),
  59.7,
)
@Controller('api/v1/inpatient')
export class InpatientChartController {
  constructor(
    private readonly ward: ListWardUseCase,
    private readonly chart: GetChartUseCase,
    private readonly observe: RecordObservationUseCase,
    private readonly administer: RecordAdministrationUseCase,
    private readonly note: AddNoteUseCase,
  ) {}

  @DocOperation({
    summary: 'Lister mes patients hospitalisés',
    description: "Les hospitalisations en cours des services de l'utilisateur, par lit, avec le dernier score NEWS2.",
    auth: 'bearer',
    responses: [{ status: 200, description: 'Les hospitalisés.', type: WardRowDto, isArray: true }],
  })
  @RequirePermissions('inpatient.chart:read:department') @Get('ward')
  async listWard(@CurrentUser() actor: AuthUser): Promise<WardRowDto[]> {
    return unwrap(await this.ward.execute(actor.userId)) as WardRowDto[];
  }

  @DocOperation({
    summary: 'Lire le dossier de soins',
    description: 'Relevés, médicaments à administrer avec leur dernière action, administrations et notes. La lecture est tracée.',
    auth: 'bearer',
    responses: [{ status: 200, description: 'Le dossier de soins.', type: ChartDto }],
    errors: [400, 404],
    params: [ID],
  })
  @RequirePermissions('inpatient.chart:read:department') @Get('admissions/:id/chart')
  async getChart(@CurrentUser() actor: AuthUser, @Param('id', ParseUUIDPipe) id: string): Promise<ChartDto> {
    return unwrap(await this.chart.execute(actor.userId, id)) as ChartDto;
  }

  @DocOperation({
    summary: 'Enregistrer un relevé de constantes',
    description: 'Calcule et conserve le score NEWS2. Un score `HIGH` renvoie `escalate: true`. Tous les paramètres du score sont obligatoires (la diastolique et la remarque sont facultatives).',
    auth: 'bearer',
    responses: [{ status: 201, description: 'Relevé enregistré.', type: RecordedObservationDto }],
    errors: [400, 404, 409, 422],
    params: [ID],
  })
  @RequirePermissions('inpatient.observations:record:department') @Post('admissions/:id/observations')
  async recordObservation(@CurrentUser() actor: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: RecordObservationDto): Promise<RecordedObservationDto> {
    return unwrap(await this.observe.execute(actor.userId, id, dto)) as RecordedObservationDto;
  }

  @DocOperation({
    summary: 'Enregistrer une administration de médicament',
    description: 'Donné, refusé par le patient ou suspendu. Un refus ou une suspension exige un motif. Réservé à l\'infirmier du service.',
    auth: 'bearer',
    responses: [{ status: 201, description: 'Administration enregistrée.', type: AdministrationDto }],
    errors: [400, 404, 409, 422],
    params: [ID],
  })
  @RequirePermissions('inpatient.administrations:record:department') @Post('admissions/:id/administrations')
  async recordAdministration(@CurrentUser() actor: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: RecordAdministrationDto): Promise<AdministrationDto> {
    return unwrap(await this.administer.execute(actor.userId, id, dto)) as AdministrationDto;
  }

  @DocOperation({
    summary: 'Ajouter une note de soins',
    auth: 'bearer',
    responses: [{ status: 201, description: 'Note ajoutée.', type: NoteDto }],
    errors: [400, 404, 409, 422],
    params: [ID],
  })
  @RequirePermissions('inpatient.notes:write:department') @Post('admissions/:id/notes')
  async addNote(@CurrentUser() actor: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: AddNoteDto): Promise<NoteDto> {
    return unwrap(await this.note.execute(actor.userId, id, dto.text)) as NoteDto;
  }
}
