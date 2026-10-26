import type { Request, Response } from 'express';
import { Instant, Temporal } from '../../../shared-kernel/temporal';

export const REFRESH_COOKIE = 'sanjeevani_rt';
const COOKIE_PATH = '/api/v1/auth';

/**
 * Le jeton de rafraîchissement ne vit que dans un cookie `httpOnly` (inaccessible au JavaScript, donc à une faille XSS),
 * `SameSite=Strict` (jamais envoyé depuis un autre site : pas de CSRF) et limité au chemin d'authentification.
 */
export class RefreshCookie {
  constructor(private readonly secure: boolean) {}

  set(res: Response, token: string, expiresAt: Instant): void {
    res.cookie(REFRESH_COOKIE, token, {
      httpOnly: true,
      secure: this.secure,
      sameSite: 'strict',
      path: COOKIE_PATH,
      maxAge: Math.max(0, expiresAt.epochMilliseconds - Temporal.Now.instant().epochMilliseconds),
    });
  }

  clear(res: Response): void {
    res.clearCookie(REFRESH_COOKIE, { httpOnly: true, secure: this.secure, sameSite: 'strict', path: COOKIE_PATH });
  }

  read(req: Request): string | undefined {
    const v = (req.cookies as Record<string, unknown> | undefined)?.[REFRESH_COOKIE];
    return typeof v === 'string' ? v : undefined;
  }
}
