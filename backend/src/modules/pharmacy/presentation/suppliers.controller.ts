import { Body, Controller, DefaultValuePipe, Get, HttpCode, Param, ParseBoolPipe, ParseIntPipe, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { DocGroup, DocOperation } from '../../api-docs';
import type { DocParam } from '../../api-docs';
import { CurrentUser, RequirePermissions } from '../../iam/presentation/decorators';
import type { AuthUser } from '../../iam/presentation/decorators';
import { CreateSupplierUseCase, GetSupplierUseCase, ListSuppliersUseCase, ManageSupplierUseCases } from '../application/use-cases/suppliers';
import { CreateSupplierDto, SupplierDto, SupplierPageDto, UpdateSupplierDto } from './dto/suppliers.dto';
import { unwrap } from './http-errors';

const ID: DocParam = { name: 'id', description: 'Identifiant du fournisseur.', example: '5b0f2b8e-2f5d-4a8c-8f0e-7d9c1a3b4e60', format: 'uuid' };

@DocGroup(
  'Pharmacie · Fournisseurs',
  [
    'Les fournisseurs auxquels la pharmacie passe commande : coordonnées, contact et délai de paiement convenu.',
    '',
    '- Le **code** ne change jamais ; rien n’est supprimé : un fournisseur écarté se **désactive** et ne reçoit plus de commande (ses bons existants restent).',
    '- Le pharmacien et l’administrateur système les consultent ; le pharmacien les tient. Chaque modification est inscrite au journal d’audit.',
  ].join('\n'),
  59.1,
)
@Controller('api/v1/pharmacy/suppliers')
export class PharmacySuppliersController {
  constructor(
    private readonly create: CreateSupplierUseCase,
    private readonly manage: ManageSupplierUseCases,
    private readonly getOne: GetSupplierUseCase,
    private readonly listAll: ListSuppliersUseCase,
  ) {}

  @DocOperation({
    summary: 'Lister les fournisseurs',
    description: 'Par défaut seuls les fournisseurs **actifs** sont renvoyés.',
    auth: 'bearer',
    responses: [{ status: 200, description: 'Une page de fournisseurs, par nom.', type: SupplierPageDto }],
    errors: [400],
    query: [
      { name: 'search', description: 'Texte cherché dans le code et le nom (insensible à la casse).', example: 'pharma' },
      { name: 'includeInactive', description: 'Inclure les fournisseurs écartés (`true` ou `false`, défaut `false`).', example: 'false' },
      { name: 'offset', description: 'Nombre de fournisseurs à sauter.', example: 0 },
      { name: 'limit', description: 'Nombre de fournisseurs par page (1 à 200).', example: 50 },
    ],
  })
  @RequirePermissions('pharmacy.procurement:read') @Get()
  async list(
    @Query('search') search: string | undefined,
    @Query('includeInactive', new DefaultValuePipe(false), ParseBoolPipe) includeInactive: boolean,
    @Query('offset', new DefaultValuePipe(0), ParseIntPipe) offset: number,
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit: number,
  ): Promise<SupplierPageDto> {
    return unwrap(await this.listAll.execute({ search, includeInactive, offset, limit }));
  }

  @DocOperation({
    summary: 'Ajouter un fournisseur',
    description: 'Le code est normalisé en majuscules et doit être libre (409 sinon).',
    auth: 'bearer',
    responses: [{ status: 201, description: 'Fournisseur créé (actif).', type: SupplierDto }],
    errors: [400, 409, 422],
  })
  @RequirePermissions('pharmacy.procurement:manage') @Post()
  async createSupplier(@CurrentUser() actor: AuthUser, @Body() dto: CreateSupplierDto): Promise<SupplierDto> {
    return unwrap(await this.create.execute(actor.userId, dto));
  }

  @DocOperation({
    summary: 'Lire un fournisseur',
    description: 'Avec ses coordonnées.',
    auth: 'bearer',
    responses: [{ status: 200, description: 'Le fournisseur.', type: SupplierDto }],
    errors: [400, 404],
    params: [ID],
  })
  @RequirePermissions('pharmacy.procurement:read') @Get(':id')
  async get(@Param('id', ParseUUIDPipe) id: string): Promise<SupplierDto> {
    return unwrap(await this.getOne.execute(id));
  }

  @DocOperation({
    summary: 'Modifier un fournisseur',
    description: 'Les champs absents sont inchangés ; `null` efface le contact, le téléphone, l’e-mail, l’adresse ou les remarques. Le code ne change pas.',
    auth: 'bearer',
    responses: [{ status: 200, description: 'Le fournisseur modifié.', type: SupplierDto }],
    errors: [400, 404, 422],
    params: [ID],
  })
  @RequirePermissions('pharmacy.procurement:manage') @Patch(':id')
  async update(@CurrentUser() actor: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateSupplierDto): Promise<SupplierDto> {
    return unwrap(await this.manage.update(actor.userId, id, dto));
  }

  @DocOperation({
    summary: 'Écarter un fournisseur',
    description: 'On ne peut plus lui passer commande ; ses bons existants ne changent pas. Sans effet s’il est déjà inactif.',
    auth: 'bearer',
    responses: [{ status: 200, description: 'Le fournisseur désactivé.', type: SupplierDto }],
    errors: [400, 404],
    params: [ID],
  })
  @RequirePermissions('pharmacy.procurement:manage') @HttpCode(200) @Post(':id/deactivate')
  async deactivate(@CurrentUser() actor: AuthUser, @Param('id', ParseUUIDPipe) id: string): Promise<SupplierDto> {
    return unwrap(await this.manage.setActive(actor.userId, id, false));
  }

  @DocOperation({
    summary: 'Remettre un fournisseur en service',
    description: 'Sans effet s’il est déjà actif.',
    auth: 'bearer',
    responses: [{ status: 200, description: 'Le fournisseur réactivé.', type: SupplierDto }],
    errors: [400, 404],
    params: [ID],
  })
  @RequirePermissions('pharmacy.procurement:manage') @HttpCode(200) @Post(':id/activate')
  async activate(@CurrentUser() actor: AuthUser, @Param('id', ParseUUIDPipe) id: string): Promise<SupplierDto> {
    return unwrap(await this.manage.setActive(actor.userId, id, true));
  }
}
