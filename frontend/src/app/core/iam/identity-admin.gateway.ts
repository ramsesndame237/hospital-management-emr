import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, firstValueFrom } from 'rxjs';
import { API_BASE } from '../config/api.config';
import { toApiError } from '../http/api-error';
import { CreateUserInput, CreatedUser, ManagedUser, RoleInfo, UserAccess, UserPage } from './identity-admin.models';

/**
 * Port d'administration des comptes et lecture des rôles. Les écrans ne connaissent que ce contrat ; toutes les méthodes
 * rejettent avec une `ApiError`. L'API refuse l'auto-modification (rôles, désactivation de son propre compte).
 */
export abstract class IdentityAdminGateway {
  abstract listUsers(offset: number, limit: number): Promise<UserPage>;
  abstract createUser(input: CreateUserInput): Promise<CreatedUser>;
  /** La liste envoyée REMPLACE les rôles actuels ; les sessions du compte sont coupées. */
  abstract assignRoles(id: string, roles: readonly string[]): Promise<ManagedUser>;
  abstract setActive(id: string, active: boolean): Promise<ManagedUser>;
  abstract unlock(id: string): Promise<ManagedUser>;
  /** Efface le secret et les codes de secours : le titulaire réinscrira sa double authentification. */
  abstract resetMfa(id: string): Promise<ManagedUser>;
  abstract access(id: string): Promise<UserAccess>;
  abstract roles(): Promise<readonly RoleInfo[]>;
}

/** Adaptateur HTTP de l'API `/api/v1` (comptes, rôles). */
@Injectable()
export class HttpIdentityAdminGateway extends IdentityAdminGateway {
  private readonly http = inject(HttpClient);
  private readonly base = inject(API_BASE);

  override listUsers(offset: number, limit: number): Promise<UserPage> {
    return this.call(this.http.get<UserPage>(`${this.base}/users`, { params: { offset, limit } }));
  }

  override createUser(input: CreateUserInput): Promise<CreatedUser> {
    return this.call(this.http.post<CreatedUser>(`${this.base}/users`, input));
  }

  override assignRoles(id: string, roles: readonly string[]): Promise<ManagedUser> {
    return this.call(this.http.put<ManagedUser>(`${this.base}/users/${id}/roles`, { roles }));
  }

  override setActive(id: string, active: boolean): Promise<ManagedUser> {
    return this.call(this.http.post<ManagedUser>(`${this.base}/users/${id}/${active ? 'enable' : 'disable'}`, null));
  }

  override unlock(id: string): Promise<ManagedUser> {
    return this.call(this.http.post<ManagedUser>(`${this.base}/users/${id}/unlock`, null));
  }

  override resetMfa(id: string): Promise<ManagedUser> {
    return this.call(this.http.post<ManagedUser>(`${this.base}/users/${id}/reset-mfa`, null));
  }

  override access(id: string): Promise<UserAccess> {
    return this.call(this.http.get<UserAccess>(`${this.base}/users/${id}/access`));
  }

  override roles(): Promise<readonly RoleInfo[]> {
    return this.call(this.http.get<RoleInfo[]>(`${this.base}/roles`));
  }

  private async call<T>(request: Observable<T>): Promise<T> {
    try {
      return await firstValueFrom(request);
    } catch (error) {
      throw toApiError(error);
    }
  }
}
