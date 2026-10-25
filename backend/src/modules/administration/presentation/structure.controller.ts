import { Body, Controller, DefaultValuePipe, Get, HttpCode, Param, ParseBoolPipe, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { DocGroup, DocOperation } from '../../api-docs';
import type { DocParam } from '../../api-docs';
import { CurrentUser, RequirePermissions } from '../../iam/presentation/decorators';
import type { AuthUser } from '../../iam/presentation/decorators';
import { GetStructureNodeUseCase, GetStructureTreeUseCase, ManageStructureUseCases } from '../application/use-cases/structure';
import { CreateChildDto, CreateServiceDto, NodeDto, StructureTreeDto, UpdateNodeDto } from './dto/structure.dto';
import { unwrap } from './http-errors';

const FACILITY: DocParam = { name: 'facilityId', description: "Identifiant de l'établissement.", example: '7c1e0c1e-6f2a-4f55-8c61-0b6f3e0d9a21', format: 'uuid' };
const NODE: DocParam = { name: 'id', description: "Identifiant de l'élément (service, unité, salle ou lit).", example: '9b1c0a5e-34d2-4b8e-a8c1-52f3b7a1d001', format: 'uuid' };

@DocGroup(
  'Structure de l\'établissement',
  [
    "Organisation physique et fonctionnelle d'un établissement : **service → unité → salle → lit**.",
    '',
    "- Le niveau d'un élément est imposé par son parent : sous un service on crée une unité, sous une unité une salle, sous une salle un lit.",
    "- Le **code** et le **rattachement** ne changent jamais (d'autres données y renverront). Le code est unique parmi les éléments de même parent.",
    "- Rien n'est supprimé : un élément se **désactive**. On ne peut pas désactiver un élément qui contient des éléments actifs, ni rien créer ou réactiver sous un élément désactivé.",
    "- Le nombre de **lits actifs** est la capacité d'accueil ; leur occupation viendra avec les admissions.",
    "- Tout le personnel lit la structure ; seul l'administrateur système la modifie. Chaque modification est inscrite au journal d'audit.",
  ].join('\n'),
  35,
)
@Controller('api/v1')
export class StructureController {
  constructor(
    private readonly tree: GetStructureTreeUseCase,
    private readonly node: GetStructureNodeUseCase,
    private readonly manage: ManageStructureUseCases,
  ) {}

  @DocOperation({
    summary: "Lire la structure d'un établissement",
    description: "Arbre complet (services, unités, salles, lits) et totaux d'éléments actifs. Les éléments désactivés sont masqués sauf avec `includeInactive=true`.",
    auth: 'bearer',
    responses: [{ status: 200, description: "L'arbre de l'établissement.", type: StructureTreeDto }],
    errors: [400, 404],
    params: [FACILITY],
    query: [{ name: 'includeInactive', description: 'Inclure les éléments désactivés (`true` ou `false`, défaut `false`).', example: 'false' }],
  })
  @RequirePermissions('administration.structure:read') @Get('facilities/:facilityId/structure')
  async getTree(
    @Param('facilityId', ParseUUIDPipe) facilityId: string,
    @Query('includeInactive', new DefaultValuePipe(false), ParseBoolPipe) includeInactive: boolean,
  ): Promise<StructureTreeDto> {
    return unwrap(await this.tree.execute(facilityId, includeInactive));
  }

  @DocOperation({
    summary: 'Ajouter un service',
    description: "Rattache un service à l'établissement. Le code est unique parmi les services de l'établissement. La spécialité, si elle est donnée, doit être active dans les référentiels.",
    auth: 'bearer',
    responses: [{ status: 201, description: 'Service créé.', type: NodeDto }],
    errors: [400, 404, 409, 422],
    params: [FACILITY],
  })
  @RequirePermissions('administration.structure:manage') @Post('facilities/:facilityId/services')
  async createService(@CurrentUser() actor: AuthUser, @Param('facilityId', ParseUUIDPipe) facilityId: string, @Body() dto: CreateServiceDto): Promise<NodeDto> {
    return unwrap(await this.manage.createService(actor.userId, facilityId, dto));
  }

  @DocOperation({
    summary: 'Lire un élément',
    auth: 'bearer',
    responses: [{ status: 200, description: "L'élément.", type: NodeDto }],
    errors: [400, 404],
    params: [NODE],
  })
  @RequirePermissions('administration.structure:read') @Get('structure/:id')
  async get(@Param('id', ParseUUIDPipe) id: string): Promise<NodeDto> {
    return unwrap(await this.node.execute(id));
  }

  @DocOperation({
    summary: 'Ajouter une unité, une salle ou un lit',
    description: "Crée l'élément du niveau **qui suit celui du parent** : une unité sous un service, une salle sous une unité, un lit sous une salle. Un lit ne peut rien contenir ; un parent désactivé n'accepte rien.",
    auth: 'bearer',
    responses: [{ status: 201, description: 'Élément créé.', type: NodeDto }],
    errors: [400, 404, 409, 422],
    params: [NODE],
  })
  @RequirePermissions('administration.structure:manage') @Post('structure/:id/children')
  async createChild(@CurrentUser() actor: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: CreateChildDto): Promise<NodeDto> {
    return unwrap(await this.manage.createChild(actor.userId, id, dto));
  }

  @DocOperation({
    summary: 'Modifier un élément',
    description: "Change le nom et, selon le niveau, la nature et la spécialité (service) ou l'étage (salle). Les champs absents restent inchangés ; `specialtyCode` ou `floor` à `null` retire la valeur. Un attribut qui ne s'applique pas au niveau est refusé.",
    auth: 'bearer',
    responses: [{ status: 200, description: 'Élément mis à jour.', type: NodeDto }],
    errors: [400, 404, 422],
    params: [NODE],
  })
  @RequirePermissions('administration.structure:manage') @Patch('structure/:id')
  async update(@CurrentUser() actor: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateNodeDto): Promise<NodeDto> {
    return unwrap(await this.manage.update(actor.userId, id, dto));
  }

  @DocOperation({
    summary: 'Désactiver un élément',
    description: "Refusé (409) tant que l'élément contient des éléments actifs. L'élément reste lisible. Réversible avec `activate`. Sans effet s'il est déjà désactivé.",
    auth: 'bearer',
    responses: [{ status: 200, description: 'Élément désactivé.', type: NodeDto }],
    errors: [400, 404, 409],
    params: [NODE],
  })
  @RequirePermissions('administration.structure:manage') @HttpCode(200) @Post('structure/:id/deactivate')
  async deactivate(@CurrentUser() actor: AuthUser, @Param('id', ParseUUIDPipe) id: string): Promise<NodeDto> {
    return unwrap(await this.manage.setActive(actor.userId, id, false));
  }

  @DocOperation({
    summary: 'Réactiver un élément',
    description: "Refusé (409) si le parent est désactivé : réactivez d'abord le parent.",
    auth: 'bearer',
    responses: [{ status: 200, description: 'Élément réactivé.', type: NodeDto }],
    errors: [400, 404, 409],
    params: [NODE],
  })
  @RequirePermissions('administration.structure:manage') @HttpCode(200) @Post('structure/:id/activate')
  async activate(@CurrentUser() actor: AuthUser, @Param('id', ParseUUIDPipe) id: string): Promise<NodeDto> {
    return unwrap(await this.manage.setActive(actor.userId, id, true));
  }
}
