import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, firstValueFrom } from 'rxjs';
import { API_BASE } from '../config/api.config';
import { toApiError } from '../http/api-error';
import { CurrentUser, LoginCredentials, LoginResponse, TokenResponse } from './auth.models';

/**
 * Port d'accès au serveur d'identité. L'application ne connaît que ce contrat : le jour où l'authentification change
 * (SSO, autre API), on écrit un nouvel adaptateur sans toucher ni à l'état de session, ni aux gardes, ni aux écrans.
 * Toutes les méthodes rejettent avec une `ApiError`.
 */
export abstract class AuthGateway {
  abstract login(credentials: LoginCredentials): Promise<LoginResponse>;
  /** Échange le cookie de rafraîchissement (`httpOnly`, invisible au JavaScript) contre un nouveau jeton d'accès. */
  abstract refresh(): Promise<TokenResponse>;
  abstract logout(): Promise<void>;
  abstract me(): Promise<CurrentUser>;
}

/** Adaptateur HTTP de l'API `/api/v1/auth`. */
@Injectable()
export class HttpAuthGateway extends AuthGateway {
  private readonly http = inject(HttpClient);
  private readonly base = inject(API_BASE);

  override login(credentials: LoginCredentials): Promise<LoginResponse> {
    return this.call(this.http.post<LoginResponse>(`${this.base}/auth/login`, credentials, { withCredentials: true }));
  }

  override refresh(): Promise<TokenResponse> {
    return this.call(this.http.post<TokenResponse>(`${this.base}/auth/refresh`, null, { withCredentials: true }));
  }

  override logout(): Promise<void> {
    return this.call(this.http.post<void>(`${this.base}/auth/logout`, null, { withCredentials: true }));
  }

  override me(): Promise<CurrentUser> {
    return this.call(this.http.get<CurrentUser>(`${this.base}/auth/me`));
  }

  private async call<T>(request: Observable<T>): Promise<T> {
    try {
      return await firstValueFrom(request);
    } catch (error) {
      throw toApiError(error);
    }
  }
}
