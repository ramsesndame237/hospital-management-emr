import { Inject, Injectable, RequestMethod } from '@nestjs/common';
import { DiscoveryService, Reflector } from '@nestjs/core';
import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { RoleRepository, ROLE_REPOSITORY } from '../domain/ports';
import { REQUIRED_PERMISSIONS } from './decorators';

export interface PermissionRoute {
  readonly method: string;
  readonly path: string;
  /** Permission exacte exigée par la route (avec portée). */
  readonly requires: string;
}

export interface PermissionCatalogEntry {
  /** `ressource:action` — la portée n'en fait pas partie : elle se choisit par rôle. */
  readonly permission: string;
  /** Routes de l'API qui exigent cette permission (vide : accordée par un rôle mais jamais exigée). */
  readonly routes: readonly PermissionRoute[];
  /** Rôles qui l'accordent, avec la portée accordée. */
  readonly grantedTo: readonly { readonly role: string; readonly scope: string }[];
}

const asArray = <T>(v: T | T[] | undefined): T[] => (v === undefined ? [] : Array.isArray(v) ? v : [v]);
const join = (...parts: string[]): string => `/${parts.map((p) => p.replace(/^\/+|\/+$/g, '')).filter(Boolean).join('/')}`;

/**
 * Inventaire des permissions de l'API, relevé sur les routes elles-mêmes (`@RequirePermissions`) puis croisé avec les rôles.
 * Il ne peut donc pas diverger du code : une permission exigée par une route y figure toujours, et une permission accordée
 * par un rôle mais exigée par aucune route (probablement obsolète ou en avance sur son module) s'y repère d'un coup d'œil.
 */
@Injectable()
export class PermissionCatalog {
  constructor(
    private readonly discovery: DiscoveryService,
    private readonly reflector: Reflector,
    @Inject(ROLE_REPOSITORY) private readonly roles: RoleRepository,
  ) {}

  async list(): Promise<PermissionCatalogEntry[]> {
    const entries = new Map<string, { routes: PermissionRoute[]; grantedTo: { role: string; scope: string }[] }>();
    const entry = (key: string) => {
      let e = entries.get(key);
      if (!e) entries.set(key, (e = { routes: [], grantedTo: [] }));
      return e;
    };

    for (const wrapper of this.discovery.getControllers()) {
      const controller = wrapper.metatype as (new (...args: never[]) => object) | null;
      if (!controller) continue;
      const basePaths = asArray<string>(Reflect.getMetadata(PATH_METADATA, controller));
      for (const name of Object.getOwnPropertyNames(controller.prototype)) {
        const handler = (controller.prototype as Record<string, unknown>)[name];
        if (name === 'constructor' || typeof handler !== 'function') continue;
        const required = this.reflector.getAllAndOverride<string[] | undefined>(REQUIRED_PERMISSIONS, [handler, controller]);
        const method = Reflect.getMetadata(METHOD_METADATA, handler) as number | undefined;
        if (!required?.length || method === undefined) continue;
        const paths = asArray<string>(Reflect.getMetadata(PATH_METADATA, handler));
        for (const raw of required) {
          const [resource, action, scope = 'all'] = raw.split(':');
          for (const base of basePaths.length ? basePaths : ['']) {
            for (const path of paths.length ? paths : ['']) {
              entry(`${resource}:${action}`).routes.push({ method: RequestMethod[method], path: join(base, path), requires: `${resource}:${action}:${scope}` });
            }
          }
        }
      }
    }

    for (const role of await this.roles.findAll()) {
      for (const p of role.permissions) entry(`${p.resource}:${p.action}`).grantedTo.push({ role: role.code.value, scope: p.scope });
    }

    return [...entries.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([permission, e]) => ({
        permission,
        routes: e.routes.sort((a, b) => a.path.localeCompare(b.path) || a.method.localeCompare(b.method)),
        grantedTo: e.grantedTo.sort((a, b) => a.role.localeCompare(b.role)),
      }));
  }
}
