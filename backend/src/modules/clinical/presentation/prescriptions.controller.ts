import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { DocGroup, DocOperation } from '../../api-docs';
import type { DocParam } from '../../api-docs';
import { CurrentUser, RequirePermissions } from '../../iam/presentation/decorators';
import type { AuthUser } from '../../iam/presentation/decorators';
import { CancelPrescriptionUseCase, GetPrescriptionUseCase, IssuePrescriptionUseCase, ListEncounterPrescriptionsUseCase, SearchDrugsUseCase } from '../application/use-cases/prescriptions';
import { CancelPrescriptionDto, DrugSuggestionDto, IssuePrescriptionDto, PrescriptionDto } from './dto/prescriptions.dto';
import { unwrap } from './http-errors';

const ENCOUNTER: DocParam = { name: 'id', description: 'Identifiant de la consultation.', example: '5b0f2b8e-2f5d-4a8c-8f0e-7d9c1a3b4e60', format: 'uuid' };
const PRESCRIPTION: DocParam = { name: 'id', description: 'Identifiant de l’ordonnance.', example: '8c1d4a7e-3b2f-4d6a-9e0b-1f2a3b4c5d6e', format: 'uuid' };

@DocGroup(
  'Clinique · Ordonnances',
  [
    'Ce qu’un médecin prescrit à un patient pendant une consultation : des lignes (médicament du formulaire de la pharmacie, dose, rythme, durée, quantité).',
    '',
    '- Elle s’émet **pendant la consultation en cours**, par le **médecin qui la conduit** ; elle ne se réécrit pas : une erreur se corrige en l’**annulant** (motif obligatoire) et en en émettant une autre.',
    '- **Alerte allergie** : si une allergie active du patient vise un médicament (rapprochement de noms), la ligne exige un **motif** pour prescrire malgré tout ; le motif reste sur la ligne.',
    '- Une consultation qui a des ordonnances en cours ne s’annule pas : on annule d’abord les ordonnances.',
    '- Le journal d’audit garde qui a fait quoi, **jamais les médicaments ni les motifs**. Hors de leur service, les ordonnances « n’existent pas » (404).',
  ].join('\n'),
  59.55,
)
@Controller('api/v1/clinical')
export class ClinicalPrescriptionsController {
  constructor(
    private readonly search: SearchDrugsUseCase,
    private readonly issue: IssuePrescriptionUseCase,
    private readonly listOfEncounter: ListEncounterPrescriptionsUseCase,
    private readonly getOne: GetPrescriptionUseCase,
    private readonly cancelOne: CancelPrescriptionUseCase,
  ) {}

  @DocOperation({
    summary: 'Chercher un médicament à prescrire',
    description: 'Les médicaments **actifs** du formulaire dont le code, le nom ou la dénomination commune contient le texte (2 caractères au moins, 15 résultats au plus), chacun avec les **alertes d’allergie** du patient de la consultation.',
    auth: 'bearer',
    responses: [{ status: 200, description: 'Les médicaments trouvés.', type: DrugSuggestionDto, isArray: true }],
    errors: [400, 404],
    params: [ENCOUNTER],
    query: [{ name: 'search', description: 'Texte cherché (2 caractères au moins).', example: 'amox' }],
  })
  @RequirePermissions('clinical.prescriptions:write:department') @Get('encounters/:id/drugs')
  async drugs(@CurrentUser() actor: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Query('search') search: string | undefined): Promise<DrugSuggestionDto[]> {
    return unwrap(await this.search.execute(actor.userId, id, search ?? ''));
  }

  @DocOperation({
    summary: 'Ordonnances d’une consultation',
    description: 'Dans l’ordre d’émission, annulées comprises.',
    auth: 'bearer',
    responses: [{ status: 200, description: 'Les ordonnances de la consultation.', type: PrescriptionDto, isArray: true }],
    errors: [400, 404],
    params: [ENCOUNTER],
  })
  @RequirePermissions('clinical.prescriptions:read:department') @Get('encounters/:id/prescriptions')
  async listPrescriptions(@CurrentUser() actor: AuthUser, @Param('id', ParseUUIDPipe) id: string): Promise<PrescriptionDto[]> {
    return unwrap(await this.listOfEncounter.execute(actor.userId, id));
  }

  @DocOperation({
    summary: 'Émettre une ordonnance',
    description: [
      'Pour la **consultation en cours** du médecin. Refus : consultation introuvable ou hors de vos services (404), consultation d’un confrère (403), signée ou annulée (409), médicament introuvable (404) ou désactivé (409), ',
      'allergie connue sans motif (409 `CLINICAL_ALLERGY_CONFLICT`), ligne invalide (422).',
    ].join(''),
    auth: 'bearer',
    responses: [{ status: 201, description: 'L’ordonnance émise.', type: PrescriptionDto }],
    errors: [400, 403, 404, 409, 422],
    params: [ENCOUNTER],
  })
  @RequirePermissions('clinical.prescriptions:write:department') @Post('encounters/:id/prescriptions')
  async issuePrescription(@CurrentUser() actor: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: IssuePrescriptionDto): Promise<PrescriptionDto> {
    return unwrap(await this.issue.execute(actor.userId, id, dto));
  }

  @DocOperation({
    summary: 'Lire une ordonnance',
    description: 'Avec ses lignes et leur médicament. L’accès est inscrit au journal d’audit.',
    auth: 'bearer',
    responses: [{ status: 200, description: 'L’ordonnance.', type: PrescriptionDto }],
    errors: [400, 404],
    params: [PRESCRIPTION],
  })
  @RequirePermissions('clinical.prescriptions:read:department') @Get('prescriptions/:id')
  async getPrescription(@CurrentUser() actor: AuthUser, @Param('id', ParseUUIDPipe) id: string): Promise<PrescriptionDto> {
    return unwrap(await this.getOne.execute(actor.userId, id));
  }

  @DocOperation({
    summary: 'Annuler une ordonnance',
    description: 'Réservé au médecin qui l’a émise (403 sinon), avec un motif. 409 si elle est déjà annulée.',
    auth: 'bearer',
    responses: [{ status: 200, description: 'L’ordonnance, annulée.', type: PrescriptionDto }],
    errors: [400, 403, 404, 409, 422],
    params: [PRESCRIPTION],
  })
  @RequirePermissions('clinical.prescriptions:write:department') @HttpCode(200) @Post('prescriptions/:id/cancel')
  async cancelPrescription(@CurrentUser() actor: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: CancelPrescriptionDto): Promise<PrescriptionDto> {
    return unwrap(await this.cancelOne.execute(actor.userId, id, dto.reason));
  }
}
