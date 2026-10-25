import { Body, Controller, DefaultValuePipe, Get, HttpCode, Param, ParseBoolPipe, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { DocGroup, DocOperation } from '../../api-docs';
import type { DocParam } from '../../api-docs';
import { CurrentUser, RequirePermissions } from '../../iam/presentation/decorators';
import type { AuthUser } from '../../iam/presentation/decorators';
import { ListNodeAssignmentsUseCase, ListStaffAssignmentsUseCase, ManageAssignmentsUseCases } from '../application/use-cases/assignments';
import { AssignDto, AssignmentDto, EndAssignmentDto, NodeAssignmentDto, SetPrimaryDto } from './dto/staff.dto';
import { unwrap } from './http-errors';

const STAFF: DocParam = { name: 'id', description: 'Identifiant de la fiche du personnel.', example: 'c0a8f1d2-5b7e-4c1a-9d3f-6e2b8a4f7c11', format: 'uuid' };
const NODE: DocParam = { name: 'id', description: 'Identifiant du service ou de l\'unité.', example: '9b1c0a5e-34d2-4b8e-a8c1-52f3b7a1d001', format: 'uuid' };
const ASSIGNMENT: DocParam = { name: 'id', description: "Identifiant de l'affectation.", example: 'a3d5e7f9-1b2c-4d6e-8f01-23456789abcd', format: 'uuid' };

@DocGroup(
  'Affectations',
  [
    "Rattachement du personnel aux **services** et **unités** de l'établissement, sur une période.",
    '',
    "- On affecte à un **service** ou une **unité** (jamais une salle ni un lit), à condition qu'il soit actif.",
    "- La période doit rester dans l'**emploi** de la personne (après l'embauche, jusqu'au départ).",
    "- Pas de chevauchement au même endroit ; **une seule affectation principale** à la fois par personne.",
    "- L'historique est conservé : une affectation **prend fin** (date de fin), elle n'est jamais supprimée.",
  ].join('\n'),
  37,
)
@Controller('api/v1')
export class AssignmentsController {
  constructor(
    private readonly manage: ManageAssignmentsUseCases,
    private readonly byStaff: ListStaffAssignmentsUseCase,
    private readonly byNode: ListNodeAssignmentsUseCase,
  ) {}

  @DocOperation({
    summary: "Lister les affectations d'une personne",
    description: "Toutes, de la plus récente à la plus ancienne, terminées comprises.",
    auth: 'bearer',
    responses: [{ status: 200, description: 'Les affectations.', type: AssignmentDto, isArray: true }],
    errors: [400, 404],
    params: [STAFF],
  })
  @RequirePermissions('staff:read') @Get('staff/:id/assignments')
  async listForStaff(@Param('id', ParseUUIDPipe) id: string): Promise<AssignmentDto[]> {
    return unwrap(await this.byStaff.execute(id));
  }

  @DocOperation({
    summary: 'Affecter une personne',
    description: "Affecte la personne à un service ou une unité. Début : aujourd'hui par défaut ; fin : ouverte par défaut. Refusé si l'élément est désactivé (409), si la période sort de l'emploi (422), si elle chevauche une affectation au même endroit (409) ou si elle serait principale en même temps qu'une autre (409).",
    auth: 'bearer',
    responses: [{ status: 201, description: 'Affectation créée.', type: AssignmentDto }],
    errors: [400, 404, 409, 422],
    params: [STAFF],
  })
  @RequirePermissions('staff:manage') @Post('staff/:id/assignments')
  async assign(@CurrentUser() actor: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: AssignDto): Promise<AssignmentDto> {
    return unwrap(await this.manage.assign(actor.userId, id, dto));
  }

  @DocOperation({
    summary: "Lister le personnel d'un service ou d'une unité",
    description: "Les affectations du service ou de l'unité, avec la personne. Par défaut sans celles terminées avant aujourd'hui.",
    auth: 'bearer',
    responses: [{ status: 200, description: 'Les affectations, triées par nom.', type: NodeAssignmentDto, isArray: true }],
    errors: [400, 404],
    params: [NODE],
    query: [{ name: 'includeEnded', description: 'Inclure les affectations terminées (`true` ou `false`, défaut `false`).', example: 'false' }],
  })
  @RequirePermissions('staff:read') @Get('structure/:id/staff')
  async listForNode(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('includeEnded', new DefaultValuePipe(false), ParseBoolPipe) includeEnded: boolean,
  ): Promise<NodeAssignmentDto[]> {
    return unwrap(await this.byNode.execute(id, includeEnded));
  }

  @DocOperation({
    summary: 'Terminer une affectation',
    description: "Date la fin (aujourd'hui par défaut), jamais avant le début ni après le départ de la personne. Une affectation déjà terminée ne se re-termine pas (409).",
    auth: 'bearer',
    responses: [{ status: 200, description: 'Affectation terminée.', type: AssignmentDto }],
    errors: [400, 404, 409, 422],
    params: [ASSIGNMENT],
  })
  @RequirePermissions('staff:manage') @HttpCode(200) @Post('assignments/:id/end')
  async end(@CurrentUser() actor: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: EndAssignmentDto): Promise<AssignmentDto> {
    return unwrap(await this.manage.end(actor.userId, id, dto));
  }

  @DocOperation({
    summary: "Changer le statut d'affectation principale",
    description: "`primary: true` en fait l'affectation de référence de la personne (409 si elle en a déjà une autre sur la même période) ; `false` lui retire ce statut. Sans effet si l'état est déjà celui demandé.",
    auth: 'bearer',
    responses: [{ status: 200, description: 'Affectation mise à jour.', type: AssignmentDto }],
    errors: [400, 404, 409],
    params: [ASSIGNMENT],
  })
  @RequirePermissions('staff:manage') @Patch('assignments/:id')
  async setPrimary(@CurrentUser() actor: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: SetPrimaryDto): Promise<AssignmentDto> {
    return unwrap(await this.manage.setPrimary(actor.userId, id, dto.primary));
  }
}
