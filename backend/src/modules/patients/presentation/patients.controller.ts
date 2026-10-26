import { Body, Controller, DefaultValuePipe, Get, HttpCode, Param, ParseIntPipe, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { DocGroup, DocOperation } from '../../api-docs';
import type { DocParam } from '../../api-docs';
import { CurrentUser, RequirePermissions } from '../../iam/presentation/decorators';
import type { AuthUser } from '../../iam/presentation/decorators';
import {
  CheckDuplicatesUseCase, GetPatientHistoryUseCase, GetPatientUseCase, RecordPatientDeathUseCase, RegisterPatientUseCase, SearchPatientsUseCase, UpdatePatientUseCase,
} from '../application/use-cases/patients';
import { DuplicateCandidateDto, DuplicateCheckDto, PatientDto, PatientPageDto, RecordDeathDto, RegisterPatientDto, RevisionDto, UpdatePatientDto } from './dto/patients.dto';
import { unwrap } from './http-errors';

const ID: DocParam = { name: 'id', description: 'Identifiant technique du patient (champ `id`, pas le numéro de dossier).', example: '3f2b8c1e-7a4d-4e5f-9b60-1c2d3e4f5a6b', format: 'uuid' };

@DocGroup(
  'Patients',
  [
    "Identité et **dossier administratif** des patients. Aucune donnée médicale ici : les modules cliniques s'appuieront sur le numéro de dossier.",
    '',
    '- Le **numéro de dossier** (`PAT-0000123`) est attribué par le système, une fois pour toutes, et jamais réutilisé.',
    "- **Doublons** : avant d'ouvrir un dossier, le système cherche les dossiers qui lui ressemblent (même pièce d'identité, même nom et même naissance, même téléphone et même naissance). S'il y en a, l'ouverture est refusée avec la liste ; `ignoreDuplicates` confirme que la personne est bien différente.",
    '- **Patient non identifié** (urgence, nouveau-né sans nom) : identité `PROVISIONAL`, à confirmer ensuite. La date de naissance peut être une estimation (`birthDateEstimated`).',
    '- Rien n\'est supprimé. Chaque correction **archive une nouvelle version** du dossier (auteur, date, motif) ; l\'historique est en ajout seul.',
    '- **Confidentialité** : pas de liste de tous les patients (au moins un critère de recherche, 50 résultats au plus) ; chaque ouverture de dossier, recherche et consultation d\'historique est inscrite au journal d\'audit (identifiants et critères utilisés, jamais de nom ni de coordonnées).',
  ].join('\n'),
  45,
)
@Controller('api/v1/patients')
export class PatientsController {
  constructor(
    private readonly register: RegisterPatientUseCase,
    private readonly update: UpdatePatientUseCase,
    private readonly death: RecordPatientDeathUseCase,
    private readonly getPatient: GetPatientUseCase,
    private readonly searchPatients: SearchPatientsUseCase,
    private readonly duplicates: CheckDuplicatesUseCase,
    private readonly history: GetPatientHistoryUseCase,
  ) {}

  @DocOperation({
    summary: 'Rechercher des patients',
    description:
      "Au moins un critère est obligatoire (422 sinon). `q` accepte un numéro de dossier (`PAT-0000123`) ou des mots du nom/prénom (sans accents ni casse, dans n'importe quel ordre, 2 lettres au moins par mot). Les résultats sont des **résumés** ; ouvrez le dossier pour le détail.",
    auth: 'bearer',
    responses: [{ status: 200, description: 'Une page de résumés, triés par nom.', type: PatientPageDto }],
    errors: [400, 422],
    query: [
      { name: 'q', description: 'Numéro de dossier ou mots du nom/prénom.', example: 'mbarga elisabeth' },
      { name: 'birthDate', description: 'Date de naissance exacte (`AAAA-MM-JJ`).', example: '1990-03-14' },
      { name: 'phone', description: 'Téléphone (les espaces et le « + » sont sans importance).', example: '+237 655 00 00 00' },
      { name: 'identityNumber', description: "Numéro de pièce d'identité exact.", example: '123456789' },
      { name: 'status', description: '`ACTIVE` ou `DECEASED`.', example: 'ACTIVE' },
      { name: 'offset', description: 'Nombre de résultats à sauter (pagination).', example: 0 },
      { name: 'limit', description: 'Nombre de résultats par page (1 à 50).', example: 20 },
    ],
  })
  @RequirePermissions('patients:read') @Get()
  async search(
    @CurrentUser() actor: AuthUser,
    @Query('q') q: string | undefined,
    @Query('birthDate') birthDate: string | undefined,
    @Query('phone') phone: string | undefined,
    @Query('identityNumber') identityNumber: string | undefined,
    @Query('status') status: string | undefined,
    @Query('offset', new DefaultValuePipe(0), ParseIntPipe) offset: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ): Promise<PatientPageDto> {
    return unwrap(await this.searchPatients.execute(actor.userId, { q, birthDate, phone, identityNumber, status, offset, limit }));
  }

  @DocOperation({
    summary: 'Ouvrir un dossier patient',
    description:
      "Nom, prénom, sexe et date de naissance sont obligatoires. Cherche d'abord les dossiers ressemblants : s'il y en a, **409 `PATIENT_POSSIBLE_DUPLICATE`** avec la liste (`candidates`) et rien n'est créé, sauf `ignoreDuplicates: true`. Une identité `PROVISIONAL` n'est pas comparée. Renvoie le dossier avec son numéro.",
    auth: 'bearer',
    responses: [{ status: 201, description: 'Dossier ouvert.', type: PatientDto }],
    errors: [400, 409, 422],
  })
  @RequirePermissions('patients:write') @Post()
  async create(@CurrentUser() actor: AuthUser, @Body() dto: RegisterPatientDto): Promise<PatientDto> {
    return unwrap(await this.register.execute(actor.userId, dto));
  }

  @DocOperation({
    summary: 'Vérifier les doublons avant saisie',
    description: "Renvoie les dossiers qui ressemblent à la personne décrite, avec la raison de la ressemblance. Ne crée rien. Sert à avertir l'accueil avant de remplir tout le dossier.",
    auth: 'bearer',
    responses: [{ status: 200, description: 'Les dossiers ressemblants (liste vide : aucun).', type: DuplicateCandidateDto, isArray: true }],
    errors: [400, 422],
  })
  @RequirePermissions('patients:write') @HttpCode(200) @Post('duplicates')
  async checkDuplicates(@CurrentUser() actor: AuthUser, @Body() dto: DuplicateCheckDto): Promise<DuplicateCandidateDto[]> {
    return unwrap(await this.duplicates.execute(actor.userId, dto));
  }

  @DocOperation({
    summary: 'Ouvrir un dossier patient en lecture',
    description: "Le dossier administratif complet. **Chaque ouverture est inscrite au journal d'audit** (qui, quand, quel dossier).",
    auth: 'bearer',
    responses: [{ status: 200, description: 'Le dossier.', type: PatientDto }],
    errors: [400, 404],
    params: [ID],
  })
  @RequirePermissions('patients:read') @Get(':id')
  async get(@CurrentUser() actor: AuthUser, @Param('id', ParseUUIDPipe) id: string): Promise<PatientDto> {
    return unwrap(await this.getPatient.execute(actor.userId, id));
  }

  @DocOperation({
    summary: 'Corriger un dossier patient',
    description:
      "Champs absents : inchangés ; `null` retire un champ facultatif ; adresse, pièce d'identité et personne à prévenir sont **remplacées** d'un bloc. Archive une nouvelle version avec son auteur et son `reason`. Une correction qui rapproche le dossier d'un autre est refusée (409) sauf `ignoreDuplicates`. Le numéro de dossier ne change jamais. Passer `identityStatus` à `CONFIRMED` établit l'identité d'un patient provisoire.",
    auth: 'bearer',
    responses: [{ status: 200, description: 'Dossier à jour.', type: PatientDto }],
    errors: [400, 404, 409, 422],
    params: [ID],
  })
  @RequirePermissions('patients:write') @Patch(':id')
  async correct(@CurrentUser() actor: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdatePatientDto): Promise<PatientDto> {
    return unwrap(await this.update.execute(actor.userId, id, dto));
  }

  @DocOperation({
    summary: 'Enregistrer un décès',
    description: "Date le décès (aujourd'hui par défaut, jamais avant la naissance ni dans le futur). Une seule fois : 409 si le décès est déjà enregistré.",
    auth: 'bearer',
    responses: [{ status: 200, description: 'Dossier à jour.', type: PatientDto }],
    errors: [400, 404, 409, 422],
    params: [ID],
  })
  @RequirePermissions('patients.death:record') @HttpCode(200) @Post(':id/death')
  async recordDeath(@CurrentUser() actor: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: RecordDeathDto): Promise<PatientDto> {
    return unwrap(await this.death.execute(actor.userId, id, dto));
  }

  @DocOperation({
    summary: "Historique des versions d'un dossier",
    description: "Chaque version du dossier (ouverture, corrections, décès) avec son auteur, sa date, son motif et les champs modifiés, de la plus récente à la plus ancienne. Données d'identité : accès restreint, et **la consultation est inscrite au journal d'audit**.",
    auth: 'bearer',
    responses: [{ status: 200, description: 'Les versions.', type: RevisionDto, isArray: true }],
    errors: [400, 404],
    params: [ID],
  })
  @RequirePermissions('patients.history:read') @Get(':id/history')
  async getHistory(@CurrentUser() actor: AuthUser, @Param('id', ParseUUIDPipe) id: string): Promise<RevisionDto[]> {
    return unwrap(await this.history.execute(actor.userId, id)) as RevisionDto[];
  }
}
