import { Body, Controller, Get, HttpCode, Post, Req, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { ChangePasswordUseCase } from '../application/use-cases/change-password';
import { GetCurrentUserUseCase } from '../application/use-cases/current-user';
import { LoginUseCase } from '../application/use-cases/login';
import { LogoutUseCase } from '../application/use-cases/logout';
import { ActivateMfaUseCase, BeginMfaEnrollmentUseCase } from '../application/use-cases/mfa';
import { RefreshSessionUseCase } from '../application/use-cases/refresh-session';
import { TokenPair } from '../application/session-issuer';
import { AllowSetup, Client, CurrentUser, Public } from './decorators';
import type { AuthUser, ClientInfo } from './decorators';
import { ActivateMfaDto, ChangePasswordDto, LoginDto } from './dto/auth.dto';
import { unwrap } from './http-errors';
import { RefreshCookie } from './refresh-cookie';

/** Le jeton de rafraîchissement part en cookie ; seul le jeton d'accès (court) est dans le corps, à garder en mémoire côté client. */
const tokenBody = (t: TokenPair) => ({ accessToken: t.accessToken, accessExpiresAt: t.accessExpiresAt.toString(), scope: t.scope });
const LIMIT_AUTH = { default: { limit: 10, ttl: 60_000 } };

@ApiTags('auth')
@Controller('api/v1/auth')
export class AuthController {
  constructor(
    private readonly loginUc: LoginUseCase,
    private readonly refreshUc: RefreshSessionUseCase,
    private readonly logoutUc: LogoutUseCase,
    private readonly beginMfa: BeginMfaEnrollmentUseCase,
    private readonly activateMfa: ActivateMfaUseCase,
    private readonly changePasswordUc: ChangePasswordUseCase,
    private readonly currentUser: GetCurrentUserUseCase,
    private readonly cookie: RefreshCookie,
  ) {}

  @Public() @Throttle(LIMIT_AUTH) @HttpCode(200) @Post('login')
  async login(@Body() dto: LoginDto, @Client() client: ClientInfo, @Res({ passthrough: true }) res: Response) {
    const outcome = unwrap(await this.loginUc.execute({ ...dto, ...client }));
    if (outcome.kind === 'mfa_required') return { status: 'mfa_required' as const };
    this.cookie.set(res, outcome.tokens.refreshToken, outcome.tokens.refreshExpiresAt);
    return {
      status: 'authenticated' as const,
      ...tokenBody(outcome.tokens),
      mustChangePassword: outcome.mustChangePassword,
      mfaEnrollmentRequired: outcome.mfaEnrollmentRequired,
    };
  }

  /** Échange le cookie de rafraîchissement contre un nouveau jeton d'accès (et un nouveau cookie : rotation). */
  @Public() @Throttle(LIMIT_AUTH) @HttpCode(200) @Post('refresh')
  async refresh(@Req() req: Request, @Client() client: ClientInfo, @Res({ passthrough: true }) res: Response) {
    const result = await this.refreshUc.execute(this.cookie.read(req) ?? '', client);
    if (!result.ok) this.cookie.clear(res);
    const tokens = unwrap(result);
    this.cookie.set(res, tokens.refreshToken, tokens.refreshExpiresAt);
    return tokenBody(tokens);
  }

  @Public() @HttpCode(204) @Post('logout')
  async logout(@Req() req: Request, @Client() client: ClientInfo, @Res({ passthrough: true }) res: Response): Promise<void> {
    await this.logoutUc.execute(this.cookie.read(req), client);
    this.cookie.clear(res);
  }

  @ApiBearerAuth() @AllowSetup() @Get('me')
  async me(@CurrentUser() user: AuthUser) {
    return unwrap(await this.currentUser.execute(user.userId, user.scope));
  }

  @ApiBearerAuth() @AllowSetup() @Throttle(LIMIT_AUTH) @HttpCode(200) @Post('password/change')
  async changePassword(@CurrentUser() user: AuthUser, @Body() dto: ChangePasswordDto, @Client() client: ClientInfo, @Res({ passthrough: true }) res: Response) {
    const tokens = unwrap(await this.changePasswordUc.execute(user.userId, dto.currentPassword, dto.newPassword, client));
    this.cookie.set(res, tokens.refreshToken, tokens.refreshExpiresAt);
    return tokenBody(tokens);
  }

  @ApiBearerAuth() @AllowSetup() @HttpCode(200) @Post('mfa/enroll')
  async enrollMfa(@CurrentUser() user: AuthUser) {
    return unwrap(await this.beginMfa.execute(user.userId));
  }

  /** Renvoie les codes de secours en clair, une seule fois. Les sessions sont ensuite renouvelées via `refresh`. */
  @ApiBearerAuth() @AllowSetup() @Throttle(LIMIT_AUTH) @HttpCode(200) @Post('mfa/activate')
  async activateMfaEndpoint(@CurrentUser() user: AuthUser, @Body() dto: ActivateMfaDto) {
    return { recoveryCodes: unwrap(await this.activateMfa.execute(user.userId, dto.code)) };
  }
}
