import { Body, Controller, DefaultValuePipe, Get, HttpCode, Param, ParseBoolPipe, ParseIntPipe, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { DocGroup, DocOperation } from '../../api-docs';
import type { DocParam } from '../../api-docs';
import { CurrentUser, RequirePermissions } from '../../iam/presentation/decorators';
import type { AuthUser } from '../../iam/presentation/decorators';
import { CreateExamTypeUseCase, GetExamTypeUseCase, ListExamTypesUseCase, ManageExamTypeUseCases } from '../application/use-cases/catalog';
import { CreateExamTypeDto, ExamTypeDto, ExamTypePageDto, UpdateExamTypeDto } from './dto/exam-types.dto';
import { unwrap } from './http-errors';

const ID: DocParam = { name: 'id', description: "Identifiant de l'examen.", example: '5b0f2b8e-2f5d-4a8c-8f0e-7d9c1a3b4e60', format: 'uuid' };

@DocGroup(
  'Imagerie · Catalogue des examens',
  [
    "Les examens que le service d'imagerie réalise : modalité (radiographie, échographie, scanner, IRM, mammographie, scopie), région, durée du créneau, préparation du patient, produit de contraste.",
    '',
    "- Le **code** et la **modalité** ne changent jamais (les demandes y renvoient ; la modalité décide si l'examen est irradiant) ; rien n'est supprimé : un examen retiré se **désactive** et ne peut plus être demandé.",
    "- Les médecins et le radiologue lisent le catalogue ; seul l'administrateur système le modifie. Chaque modification est inscrite au journal d'audit.",
  ].join('\n'),
  56.4,
)
@Controller('api/v1/imaging/exam-types')
export class ImagingExamTypesController {
  constructor(
    private readonly create: CreateExamTypeUseCase,
    private readonly manage: ManageExamTypeUseCases,
    private readonly getOne: GetExamTypeUseCase,
    private readonly listAll: ListExamTypesUseCase,
  ) {}

  @DocOperation({
    summary: 'Lister les examens',
    description: "Par défaut seuls les examens **actifs** sont renvoyés (ceux qu'on peut demander). Les filtres se cumulent.",
    auth: 'bearer',
    responses: [{ status: 200, description: "Une page d'examens, triés par modalité puis code.", type: ExamTypePageDto }],
    errors: [400, 422],
    query: [
      { name: 'search', description: 'Texte cherché dans le code et le libellé (insensible à la casse).', example: 'thorax' },
      { name: 'modality', description: 'Une modalité.', example: 'XRAY' },
      { name: 'includeInactive', description: 'Inclure les examens retirés (`true` ou `false`, défaut `false`).', example: 'false' },
      { name: 'offset', description: "Nombre d'examens à sauter (pagination).", example: 0 },
      { name: 'limit', description: "Nombre d'examens par page (1 à 200).", example: 50 },
    ],
  })
  @RequirePermissions('imaging.catalog:read') @Get()
  async list(
    @Query('search') search: string | undefined,
    @Query('modality') modality: string | undefined,
    @Query('includeInactive', new DefaultValuePipe(false), ParseBoolPipe) includeInactive: boolean,
    @Query('offset', new DefaultValuePipe(0), ParseIntPipe) offset: number,
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit: number,
  ): Promise<ExamTypePageDto> {
    return unwrap(await this.listAll.execute({ search, modality, includeInactive, offset, limit }));
  }

  @DocOperation({
    summary: 'Créer un examen',
    description: 'Le code est normalisé en majuscules et doit être libre (409 sinon).',
    auth: 'bearer',
    responses: [{ status: 201, description: 'Examen créé (actif).', type: ExamTypeDto }],
    errors: [400, 409, 422],
  })
  @RequirePermissions('imaging.catalog:manage') @Post()
  async createExam(@CurrentUser() actor: AuthUser, @Body() dto: CreateExamTypeDto): Promise<ExamTypeDto> {
    return unwrap(await this.create.execute(actor.userId, dto));
  }

  @DocOperation({
    summary: 'Lire un examen',
    description: 'Avec sa durée de créneau et sa préparation.',
    auth: 'bearer',
    responses: [{ status: 200, description: "L'examen.", type: ExamTypeDto }],
    errors: [400, 404],
    params: [ID],
  })
  @RequirePermissions('imaging.catalog:read') @Get(':id')
  async get(@Param('id', ParseUUIDPipe) id: string): Promise<ExamTypeDto> {
    return unwrap(await this.getOne.execute(id));
  }

  @DocOperation({
    summary: 'Modifier un examen',
    description: 'Les champs absents sont inchangés. Le code et la modalité ne changent pas. Les champs modifiés sont inscrits au journal.',
    auth: 'bearer',
    responses: [{ status: 200, description: "L'examen modifié.", type: ExamTypeDto }],
    errors: [400, 404, 422],
    params: [ID],
  })
  @RequirePermissions('imaging.catalog:manage') @Patch(':id')
  async update(@CurrentUser() actor: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateExamTypeDto): Promise<ExamTypeDto> {
    return unwrap(await this.manage.update(actor.userId, id, dto));
  }

  @DocOperation({
    summary: 'Retirer un examen du catalogue',
    description: 'Il ne peut plus être demandé ; les demandes déjà faites ne changent pas. Sans effet s’il est déjà inactif.',
    auth: 'bearer',
    responses: [{ status: 200, description: "L'examen (inactif).", type: ExamTypeDto }],
    errors: [400, 404],
    params: [ID],
  })
  @RequirePermissions('imaging.catalog:manage') @HttpCode(200) @Post(':id/deactivate')
  async deactivate(@CurrentUser() actor: AuthUser, @Param('id', ParseUUIDPipe) id: string): Promise<ExamTypeDto> {
    return unwrap(await this.manage.setActive(actor.userId, id, false));
  }

  @DocOperation({
    summary: 'Remettre un examen au catalogue',
    description: 'Il peut de nouveau être demandé. Sans effet s’il est déjà actif.',
    auth: 'bearer',
    responses: [{ status: 200, description: "L'examen (actif).", type: ExamTypeDto }],
    errors: [400, 404],
    params: [ID],
  })
  @RequirePermissions('imaging.catalog:manage') @HttpCode(200) @Post(':id/activate')
  async activate(@CurrentUser() actor: AuthUser, @Param('id', ParseUUIDPipe) id: string): Promise<ExamTypeDto> {
    return unwrap(await this.manage.setActive(actor.userId, id, true));
  }
}
