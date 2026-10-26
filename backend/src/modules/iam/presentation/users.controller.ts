import { Body, Controller, DefaultValuePipe, Get, HttpCode, Param, ParseIntPipe, ParseUUIDPipe, Post, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Inject } from '@nestjs/common';
import { CreateUserUseCase, ListUsersUseCase, ManageUserUseCases } from '../application/use-cases/manage-users';
import { ROLE_REPOSITORY } from '../domain/ports';
import type { RoleRepository } from '../domain/ports';
import { CurrentUser, RequirePermissions } from './decorators';
import type { AuthUser } from './decorators';
import { AssignRolesDto, CreateUserDto } from './dto/auth.dto';
import { unwrap } from './http-errors';

@ApiTags('users')
@ApiBearerAuth()
@Controller('api/v1')
export class UsersController {
  constructor(
    private readonly listUsers: ListUsersUseCase,
    private readonly createUser: CreateUserUseCase,
    private readonly manage: ManageUserUseCases,
    @Inject(ROLE_REPOSITORY) private readonly roles: RoleRepository,
  ) {}

  @RequirePermissions('iam.users:read') @Get('users')
  list(@Query('offset', new DefaultValuePipe(0), ParseIntPipe) offset: number, @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit: number) {
    return this.listUsers.execute(offset, limit);
  }

  /** Le mot de passe temporaire n'est renvoyé qu'ici, une fois ; l'utilisateur devra le changer à sa première connexion. */
  @RequirePermissions('iam.users:manage') @Post('users')
  async create(@CurrentUser() actor: AuthUser, @Body() dto: CreateUserDto) {
    return unwrap(await this.createUser.execute(actor.userId, dto));
  }

  @RequirePermissions('iam.users:manage') @Put('users/:id/roles')
  async assignRoles(@CurrentUser() actor: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: AssignRolesDto) {
    return unwrap(await this.manage.assignRoles(actor.userId, id, dto.roles));
  }

  @RequirePermissions('iam.users:manage') @HttpCode(200) @Post('users/:id/disable')
  async disable(@CurrentUser() actor: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return unwrap(await this.manage.setActive(actor.userId, id, false));
  }

  @RequirePermissions('iam.users:manage') @HttpCode(200) @Post('users/:id/enable')
  async enable(@CurrentUser() actor: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return unwrap(await this.manage.setActive(actor.userId, id, true));
  }

  @RequirePermissions('iam.users:manage') @HttpCode(200) @Post('users/:id/unlock')
  async unlock(@CurrentUser() actor: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return unwrap(await this.manage.unlock(actor.userId, id));
  }

  @RequirePermissions('iam.users:manage') @HttpCode(200) @Post('users/:id/reset-mfa')
  async resetMfa(@CurrentUser() actor: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return unwrap(await this.manage.resetMfa(actor.userId, id));
  }

  @RequirePermissions('iam.roles:read') @Get('roles')
  async listRoles() {
    const roles = await this.roles.findAll();
    return roles.map((r) => ({ code: r.code.value, name: r.name, requiresMfa: r.requiresMfa, isSystem: r.isSystem, permissions: r.permissions.map((p) => p.value) }));
  }
}
