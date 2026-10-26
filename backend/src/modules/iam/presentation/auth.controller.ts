import { Body, Controller, Get, HttpCode, Post, Req, Res } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { DocGroup, DocOperation } from '../../api-docs';
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
import { CurrentUserDto, LoginResponseDto, MfaEnrollmentDto, RecoveryCodesDto, TokenResponseDto } from './dto/responses.dto';
import { unwrap } from './http-errors';
import { RefreshCookie } from './refresh-cookie';

/** Le jeton de rafraîchissement part en cookie ; seul le jeton d'accès (court) est dans le corps, à garder en mémoire côté client. */
const tokenBody = (t: TokenPair): TokenResponseDto => ({ accessToken: t.accessToken, accessExpiresAt: t.accessExpiresAt.toString(), scope: t.scope });
const LIMIT_AUTH = { default: { limit: 10, ttl: 60_000 } };

@DocGroup(
  'Authentification',
  [
    'Connexion, sessions et double authentification (MFA).',
    '',
    '**Parcours type**',
    "1. `POST /auth/login`. Si la réponse est `mfa_required`, renvoyer la même requête avec `totpCode` (ou `recoveryCode`).",
    "2. La réponse contient un **jeton d'accès** (15 min) ; le **jeton de rafraîchissement** est posé dans un cookie `httpOnly` (invisible au JavaScript).",
    "3. Un compte neuf ou aux rôles cliniques reçoit une **session restreinte** (`scope: setup`) : changer le mot de passe (`/auth/password/change`) et inscrire la double authentification (`/auth/mfa/enroll` puis `/auth/mfa/activate`), puis appeler `/auth/refresh` pour obtenir une session complète.",
    "4. Avant l'expiration, `POST /auth/refresh` renvoie un nouveau jeton d'accès (le cookie est renouvelé à chaque appel).",
    '',
    "**Dans cette page** : après une connexion réussie le jeton est enregistré automatiquement dans *Authorize* ; le cookie de rafraîchissement est envoyé par le navigateur.",
    '',
    '**Langue** des messages : paramètre `?lang=fr|en`, en-tête `X-Locale`, ou `Accept-Language` (français par défaut).',
  ].join('\n'),
  10,
)
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

  @DocOperation({
    summary: 'Ouvrir une session',
    description:
      "Vérifie l'identifiant et le mot de passe. Pour un compte protégé par la double authentification, la première réponse est `{ status: 'mfa_required' }` : renvoyer la requête avec `totpCode` ou `recoveryCode`.\n\n" +
      "Limité à 10 tentatives par minute et par adresse IP ; 5 échecs consécutifs verrouillent le compte (15 min, puis le délai double). Pour ne rien révéler, un compte inconnu, verrouillé ou désactivé reçoit la même réponse `INVALID_CREDENTIALS` qu'un mauvais mot de passe.",
    auth: 'none',
    responses: [{ status: 200, description: 'Session ouverte, ou second facteur demandé.', type: LoginResponseDto }],
    errors: [400, 401, 429],
  })
  @Public() @Throttle(LIMIT_AUTH) @HttpCode(200) @Post('login')
  async login(@Body() dto: LoginDto, @Client() client: ClientInfo, @Res({ passthrough: true }) res: Response): Promise<LoginResponseDto> {
    const outcome = unwrap(await this.loginUc.execute({ ...dto, ...client }));
    if (outcome.kind === 'mfa_required') return { status: 'mfa_required' };
    this.cookie.set(res, outcome.tokens.refreshToken, outcome.tokens.refreshExpiresAt);
    return {
      status: 'authenticated',
      ...tokenBody(outcome.tokens),
      mustChangePassword: outcome.mustChangePassword,
      mfaEnrollmentRequired: outcome.mfaEnrollmentRequired,
    };
  }

  @DocOperation({
    summary: "Renouveler le jeton d'accès",
    description:
      "Échange le cookie de rafraîchissement (`sanjeevani_rt`, envoyé automatiquement par le navigateur) contre un nouveau jeton d'accès, et renouvelle le cookie (rotation à usage unique).\n\n" +
      "**Détection de vol** : rejouer un ancien cookie révoque toute la session. La portée est recalculée : un compte qui vient de changer son mot de passe et d'inscrire la MFA passe de `setup` à `full`.",
    auth: 'none',
    responses: [{ status: 200, description: "Nouveau jeton d'accès.", type: TokenResponseDto }],
    errors: [401, 429],
  })
  @Public() @Throttle(LIMIT_AUTH) @HttpCode(200) @Post('refresh')
  async refresh(@Req() req: Request, @Client() client: ClientInfo, @Res({ passthrough: true }) res: Response): Promise<TokenResponseDto> {
    const result = await this.refreshUc.execute(this.cookie.read(req) ?? '', client);
    if (!result.ok) this.cookie.clear(res);
    const tokens = unwrap(result);
    this.cookie.set(res, tokens.refreshToken, tokens.refreshExpiresAt);
    return tokenBody(tokens);
  }

  @DocOperation({
    summary: 'Fermer la session',
    description: 'Révoque la session du cookie de rafraîchissement et efface le cookie. Sans effet (et sans erreur) si le cookie est absent ou inconnu.',
    auth: 'none',
    responses: [{ status: 204, description: 'Session fermée.' }],
  })
  @Public() @HttpCode(204) @Post('logout')
  async logout(@Req() req: Request, @Client() client: ClientInfo, @Res({ passthrough: true }) res: Response): Promise<void> {
    await this.logoutUc.execute(this.cookie.read(req), client);
    this.cookie.clear(res);
  }

  @DocOperation({
    summary: 'Profil et permissions de la session',
    description: "Identité, rôles et permissions effectives de l'utilisateur connecté. À appeler au démarrage d'une application pour construire menus et gardes de routes.",
    auth: 'bearer',
    responses: [{ status: 200, description: "Profil de l'utilisateur connecté.", type: CurrentUserDto }],
    errors: [404],
  })
  @AllowSetup() @Get('me')
  async me(@CurrentUser() user: AuthUser): Promise<CurrentUserDto> {
    return unwrap(await this.currentUser.execute(user.userId, user.scope));
  }

  @DocOperation({
    summary: 'Changer le mot de passe',
    description:
      'Exige le mot de passe actuel. Le nouveau doit respecter la politique (12 caractères minimum, ni courant, ni compromis, ni dérivé de l\'identifiant). **Toutes les sessions existantes sont révoquées** et une nouvelle est ouverte (cookie renouvelé).',
    auth: 'bearer',
    responses: [{ status: 200, description: 'Nouvelle session.', type: TokenResponseDto }],
    errors: [400, 422, 429],
  })
  @AllowSetup() @Throttle(LIMIT_AUTH) @HttpCode(200) @Post('password/change')
  async changePassword(@CurrentUser() user: AuthUser, @Body() dto: ChangePasswordDto, @Client() client: ClientInfo, @Res({ passthrough: true }) res: Response): Promise<TokenResponseDto> {
    const tokens = unwrap(await this.changePasswordUc.execute(user.userId, dto.currentPassword, dto.newPassword, client));
    this.cookie.set(res, tokens.refreshToken, tokens.refreshExpiresAt);
    return tokenBody(tokens);
  }

  @DocOperation({
    summary: 'Démarrer l\'inscription à la double authentification',
    description: "Génère un secret TOTP (stocké chiffré) en attente de confirmation. Afficher `keyUri` en QR code, puis confirmer avec `POST /auth/mfa/activate`.",
    auth: 'bearer',
    responses: [{ status: 200, description: 'Secret à enregistrer dans une application d\'authentification.', type: MfaEnrollmentDto }],
    errors: [404, 409],
  })
  @AllowSetup() @HttpCode(200) @Post('mfa/enroll')
  async enrollMfa(@CurrentUser() user: AuthUser): Promise<MfaEnrollmentDto> {
    return unwrap(await this.beginMfa.execute(user.userId));
  }

  @DocOperation({
    summary: 'Confirmer la double authentification',
    description:
      "Un premier code valide prouve que l'application est bien configurée ; la MFA est alors active. Renvoie **dix codes de secours** à usage unique, affichés une seule fois. Appeler ensuite `POST /auth/refresh` pour passer en session complète.",
    auth: 'bearer',
    responses: [{ status: 200, description: 'MFA activée.', type: RecoveryCodesDto }],
    errors: [400, 401, 404, 409, 429],
  })
  @AllowSetup() @Throttle(LIMIT_AUTH) @HttpCode(200) @Post('mfa/activate')
  async activateMfaEndpoint(@CurrentUser() user: AuthUser, @Body() dto: ActivateMfaDto): Promise<RecoveryCodesDto> {
    return { recoveryCodes: unwrap(await this.activateMfa.execute(user.userId, dto.code)) };
  }
}
