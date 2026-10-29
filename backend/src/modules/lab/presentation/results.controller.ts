import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Put } from '@nestjs/common';
import { DocGroup, DocOperation } from '../../api-docs';
import type { DocParam } from '../../api-docs';
import { CurrentUser, RequirePermissions } from '../../iam/presentation/decorators';
import type { AuthUser } from '../../iam/presentation/decorators';
import { GetReportUseCase } from '../application/use-cases/reports';
import { ResultUseCases } from '../application/use-cases/results';
import { RequisitionDto } from './dto/requisitions.dto';
import { AmendResultDto, BatchResultDto, CriticalNotificationInputDto, EnterResultDto, ReportDto, ReturnResultDto } from './dto/results.dto';
import { unwrap } from './http-errors';

const ID: DocParam = { name: 'id', description: "Identifiant de la demande d'analyses.", example: '2a3b4c5d-6e7f-4a8b-9c0d-1e2f3a4b5c6d', format: 'uuid' };
const TEST: DocParam = { name: 'testId', description: "Identifiant de l'analyse dans la demande.", example: '5b0f2b8e-2f5d-4a8c-8f0e-7d9c1a3b4e60', format: 'uuid' };

@DocGroup(
  'Laboratoire · Résultats',
  [
    "Du résultat saisi au résultat publié : **saisie → validation → (appel du clinicien si valeur critique) → publication**, et **amendement** d'un résultat publié.",
    '',
    "- **Saisie** : seulement quand l'échantillon est arrivé au laboratoire. Le serveur calcule la position (`LOW`, `HIGH`, `CRITICAL_LOW`, `CRITICAL_HIGH`, `NORMAL`) d'après les valeurs de référence du **sexe** et de l'**âge** du patient le jour du prélèvement, et signale une variation de plus de 30 % par rapport à son dernier résultat publié (*delta check*).",
    "- **Quatre yeux** : un résultat n'est jamais validé ni publié par son auteur. Un résultat validé ne se retouche pas : on le **renvoie** (motif obligatoire) pour le corriger.",
    "- **Valeur critique** : la publication est **bloquée** tant que l'appel du clinicien n'est pas documenté (personne prévenue, fonction, moyen, relecture confirmée).",
    "- **Amendement** : sur un résultat publié, avec un motif ; une nouvelle version est créée, à valider puis publier. Toutes les versions sont conservées, et le prescripteur continue de lire la version publiée en attendant.",
    "- **Confidentialité** : un prescripteur ne lit **que les résultats publiés** (`IN_PROGRESS` tant que rien n'est publié). Le journal d'audit ne contient jamais la valeur d'un résultat.",
  ].join('\n'),
  56,
)
@Controller('api/v1/lab/requisitions')
export class LabResultsController {
  constructor(private readonly results: ResultUseCases, private readonly report: GetReportUseCase) {}

  @DocOperation({
    summary: 'Rapport de la demande',
    description:
      "Rapport imprimable : les résultats **publiés** (valeur, unité, position, valeurs de référence, validateur et publicateur, amendements) et, pour les autres analyses, `PENDING`. Jamais une valeur non publiée. Le prescripteur l'obtient pour ses demandes, le laboratoire pour toutes ; chaque édition est inscrite au journal.",
    auth: 'bearer',
    responses: [{ status: 200, description: 'Le rapport.', type: ReportDto }],
    errors: [400, 404],
    params: [ID],
  })
  @RequirePermissions('lab.requisitions:read:own') @Get(':id/report')
  async getReport(@CurrentUser() actor: AuthUser, @Param('id', ParseUUIDPipe) id: string): Promise<ReportDto> {
    return unwrap(await this.report.execute(actor.userId, id));
  }

  @DocOperation({
    summary: 'Valider tous les résultats saisis',
    description: "Valide d'un coup les résultats saisis de la demande, sauf ceux de l'appelant (quatre yeux) : ils sont listés dans `skipped`. Renvoie le nombre de résultats traités.",
    auth: 'bearer',
    responses: [{ status: 200, description: 'La demande et le détail du traitement.', type: BatchResultDto }],
    errors: [400, 404],
    params: [ID],
  })
  @RequirePermissions('lab.results:verify') @HttpCode(200) @Post(':id/results/verify')
  async verifyAll(@CurrentUser() actor: AuthUser, @Param('id', ParseUUIDPipe) id: string): Promise<BatchResultDto> {
    return unwrap(await this.results.verifyAll(actor.userId, id));
  }

  @DocOperation({
    summary: 'Publier tous les résultats validés',
    description:
      "Publie d'un coup les résultats validés de la demande, sauf ceux de l'appelant et les valeurs critiques dont l'appel du clinicien n'est pas documenté : ils sont listés dans `skipped` avec leur raison.",
    auth: 'bearer',
    responses: [{ status: 200, description: 'La demande et le détail du traitement.', type: BatchResultDto }],
    errors: [400, 404],
    params: [ID],
  })
  @RequirePermissions('lab.results:release') @HttpCode(200) @Post(':id/results/release')
  async releaseAll(@CurrentUser() actor: AuthUser, @Param('id', ParseUUIDPipe) id: string): Promise<BatchResultDto> {
    return unwrap(await this.results.releaseAll(actor.userId, id));
  }

  @DocOperation({
    summary: 'Saisir ou corriger un résultat',
    description:
      "Saisit le résultat d'une analyse dont l'échantillon est arrivé au laboratoire (409 sinon). Tant que le résultat n'est pas validé, une nouvelle saisie crée une nouvelle version ; un résultat validé ou publié est verrouillé (409). Valeur non conforme au type de résultat : 422.",
    auth: 'bearer',
    responses: [{ status: 200, description: 'La demande avec le résultat saisi (`ENTERED`).', type: RequisitionDto }],
    errors: [400, 404, 409, 422],
    params: [ID, TEST],
  })
  @RequirePermissions('lab.results:enter') @Put(':id/results/:testId')
  async enter(@CurrentUser() actor: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Param('testId', ParseUUIDPipe) testId: string, @Body() dto: EnterResultDto): Promise<RequisitionDto> {
    return unwrap(await this.results.enter(actor.userId, id, testId, dto));
  }

  @DocOperation({
    summary: 'Valider un résultat',
    description: "Un autre technicien que l'auteur de la saisie valide (409 `LAB_VERIFY_SELF` sinon). Seul un résultat `ENTERED` se valide.",
    auth: 'bearer',
    responses: [{ status: 200, description: 'Résultat validé (`VERIFIED`).', type: RequisitionDto }],
    errors: [400, 404, 409],
    params: [ID, TEST],
  })
  @RequirePermissions('lab.results:verify') @HttpCode(200) @Post(':id/results/:testId/verify')
  async verify(@CurrentUser() actor: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Param('testId', ParseUUIDPipe) testId: string): Promise<RequisitionDto> {
    return unwrap(await this.results.verify(actor.userId, id, testId));
  }

  @DocOperation({
    summary: 'Renvoyer un résultat pour correction',
    description: "Un résultat saisi ou validé revient à son auteur (`RETURNED`) avec un motif obligatoire ; il devra être ressaisi.",
    auth: 'bearer',
    responses: [{ status: 200, description: 'Résultat renvoyé.', type: RequisitionDto }],
    errors: [400, 404, 409, 422],
    params: [ID, TEST],
  })
  @RequirePermissions('lab.results:verify') @HttpCode(200) @Post(':id/results/:testId/return')
  async returnResult(@CurrentUser() actor: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Param('testId', ParseUUIDPipe) testId: string, @Body() dto: ReturnResultDto): Promise<RequisitionDto> {
    return unwrap(await this.results.returnForCorrection(actor.userId, id, testId, dto.reason));
  }

  @DocOperation({
    summary: "Documenter l'appel du clinicien (valeur critique)",
    description:
      "Pour un résultat critique : la personne prévenue, sa fonction, le moyen et la **relecture de la valeur** (`readBackConfirmed` doit être vrai, 422 sinon). Sans cet appel, la publication est refusée (409 `LAB_CRITICAL_NOT_NOTIFIED`). Refusé si le résultat n'est pas critique ou s'il est déjà publié.",
    auth: 'bearer',
    responses: [{ status: 200, description: "La demande avec l'appel documenté.", type: RequisitionDto }],
    errors: [400, 404, 409, 422],
    params: [ID, TEST],
  })
  @RequirePermissions('lab.results:notify') @HttpCode(200) @Post(':id/results/:testId/critical-notification')
  async notifyCritical(
    @CurrentUser() actor: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Param('testId', ParseUUIDPipe) testId: string, @Body() dto: CriticalNotificationInputDto,
  ): Promise<RequisitionDto> {
    return unwrap(await this.results.notifyCritical(actor.userId, id, testId, dto));
  }

  @DocOperation({
    summary: 'Publier un résultat',
    description: "Publie un résultat validé : jamais par l'auteur de la saisie (409), et pour une valeur critique seulement après l'appel du clinicien (409). Le prescripteur peut alors le lire.",
    auth: 'bearer',
    responses: [{ status: 200, description: 'Résultat publié (`RELEASED`).', type: RequisitionDto }],
    errors: [400, 404, 409],
    params: [ID, TEST],
  })
  @RequirePermissions('lab.results:release') @HttpCode(200) @Post(':id/results/:testId/release')
  async release(@CurrentUser() actor: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Param('testId', ParseUUIDPipe) testId: string): Promise<RequisitionDto> {
    return unwrap(await this.results.release(actor.userId, id, testId));
  }

  @DocOperation({
    summary: 'Amender un résultat publié',
    description:
      "Nouvelle version d'un résultat publié, avec un motif obligatoire. Elle repasse par la validation et la publication ; en attendant, le prescripteur continue de lire la version publiée. Toutes les versions sont conservées.",
    auth: 'bearer',
    responses: [{ status: 200, description: 'La demande avec la version amendée (`ENTERED`).', type: RequisitionDto }],
    errors: [400, 404, 409, 422],
    params: [ID, TEST],
  })
  @RequirePermissions('lab.results:amend') @HttpCode(200) @Post(':id/results/:testId/amend')
  async amend(@CurrentUser() actor: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Param('testId', ParseUUIDPipe) testId: string, @Body() dto: AmendResultDto): Promise<RequisitionDto> {
    return unwrap(await this.results.amend(actor.userId, id, testId, dto));
  }
}
