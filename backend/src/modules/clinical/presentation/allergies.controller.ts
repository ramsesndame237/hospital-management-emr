import { Body, Controller, DefaultValuePipe, Get, HttpCode, Param, ParseBoolPipe, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { DocGroup, DocOperation } from '../../api-docs';
import type { DocParam } from '../../api-docs';
import { CurrentUser, RequirePermissions } from '../../iam/presentation/decorators';
import type { AuthUser } from '../../iam/presentation/decorators';
import { AllergyUseCases } from '../application/use-cases/allergies';
import { AllergyDto, RecordAllergyDto, UpdateAllergyDto, VoidAllergyDto } from './dto/allergies.dto';
import { unwrap } from './http-errors';

const PATIENT: DocParam = { name: 'patientId', description: 'Identifiant du patient.', example: '5b0f2b8e-2f5d-4a8c-8f0e-7d9c1a3b4e60', format: 'uuid' };
const ID: DocParam = { name: 'id', description: 'Identifiant de l’allergie.', example: '8c1d4a7e-3b2f-4d6a-9e0b-1f2a3b4c5d6e', format: 'uuid' };

@DocGroup(
  'Clinique · Allergies',
  [
    'Les allergies d’un patient : substance, réaction, gravité. On les lit pour prescrire, délivrer ou soigner ; le médecin et l’infirmier les tiennent.',
    '',
    '- **Rien n’est supprimé** : une saisie erronée est déclarée telle, avec son motif, et sort de la liste active (elle reste au dossier).',
    '- Médecin, infirmier et pharmacien lisent ; le médecin et l’infirmier écrivent. L’administrateur système n’a aucun droit sur ces données.',
    '- Le journal d’audit garde qui a fait quoi, **jamais la substance ni la réaction**.',
  ].join('\n'),
  59.6,
)
@Controller('api/v1/clinical')
export class ClinicalAllergiesController {
  constructor(private readonly allergies: AllergyUseCases) {}

  @DocOperation({
    summary: 'Allergies d’un patient',
    description: 'Les plus récentes d’abord ; par défaut seules les allergies **actives**.',
    auth: 'bearer',
    responses: [{ status: 200, description: 'Les allergies du patient.', type: AllergyDto, isArray: true }],
    errors: [400, 404],
    params: [PATIENT],
    query: [{ name: 'includeVoided', description: 'Inclure les saisies déclarées erronées (`true` ou `false`, défaut `false`).', example: 'false' }],
  })
  @RequirePermissions('clinical.allergies:read') @Get('patients/:patientId/allergies')
  async list(@Param('patientId', ParseUUIDPipe) patientId: string, @Query('includeVoided', new DefaultValuePipe(false), ParseBoolPipe) includeVoided: boolean): Promise<AllergyDto[]> {
    return unwrap(await this.allergies.list(patientId, includeVoided)) as AllergyDto[];
  }

  @DocOperation({
    summary: 'Enregistrer une allergie',
    description: 'Substance (1 à 100 caractères), gravité, réaction facultative. 404 si le patient n’existe pas.',
    auth: 'bearer',
    responses: [{ status: 201, description: 'L’allergie enregistrée (active).', type: AllergyDto }],
    errors: [400, 404, 422],
    params: [PATIENT],
  })
  @RequirePermissions('clinical.allergies:write') @Post('patients/:patientId/allergies')
  async record(@CurrentUser() actor: AuthUser, @Param('patientId', ParseUUIDPipe) patientId: string, @Body() dto: RecordAllergyDto): Promise<AllergyDto> {
    return unwrap(await this.allergies.record(actor.userId, patientId, dto));
  }

  @DocOperation({
    summary: 'Corriger une allergie',
    description: 'La réaction et la gravité ; la substance ne change pas (une autre substance est une autre allergie). 409 si la saisie a été déclarée erronée.',
    auth: 'bearer',
    responses: [{ status: 200, description: 'L’allergie corrigée.', type: AllergyDto }],
    errors: [400, 404, 409, 422],
    params: [ID],
  })
  @RequirePermissions('clinical.allergies:write') @Patch('allergies/:id')
  async update(@CurrentUser() actor: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateAllergyDto): Promise<AllergyDto> {
    return unwrap(await this.allergies.update(actor.userId, id, dto));
  }

  @DocOperation({
    summary: 'Déclarer une saisie erronée',
    description: 'L’allergie sort de la liste active mais reste au dossier. Le motif est obligatoire. 409 si elle l’est déjà.',
    auth: 'bearer',
    responses: [{ status: 200, description: 'L’allergie, déclarée erronée.', type: AllergyDto }],
    errors: [400, 404, 409, 422],
    params: [ID],
  })
  @RequirePermissions('clinical.allergies:write') @HttpCode(200) @Post('allergies/:id/void')
  async void(@CurrentUser() actor: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: VoidAllergyDto): Promise<AllergyDto> {
    return unwrap(await this.allergies.void(actor.userId, id, dto.reason));
  }
}
