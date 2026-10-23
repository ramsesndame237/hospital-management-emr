import { applyDecorators } from '@nestjs/common';
import { ApiBearerAuth, ApiExtension, ApiOperation, ApiParam, ApiProperty, ApiPropertyOptional, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { DocOperationSpec, DocPropertySpec, HttpErrorStatus } from '../../domain/api-docs.port';
import { ErrorBodyDto } from './error-body.dto';

/** Nom du schéma de sécurité dans le document OpenAPI (référencé par le mounteur). */
export const BEARER_SCHEME = 'bearer';
export const PERMISSIONS_EXTENSION = 'x-required-permissions';
export const SETUP_EXTENSION = 'x-allows-setup-scope';

/** Groupes déclarés au chargement des contrôleurs ; repris par le mounteur, dans l'ordre demandé. */
export const groups = new Map<string, { description?: string; order: number }>();

const ERROR_TEXT: Readonly<Record<HttpErrorStatus, string>> = {
  400: 'Données envoyées invalides (voir `errors` pour le détail par champ).',
  401: 'Non authentifié : jeton absent, invalide ou expiré, ou identifiants incorrects.',
  403: 'Accès refusé : permission manquante ou session restreinte (`SETUP_REQUIRED`).',
  404: 'Ressource introuvable.',
  409: "Conflit avec l'état actuel (doublon, action déjà effectuée).",
  422: 'Règle métier non respectée (voir `code` et `message`).',
  429: 'Trop de requêtes : réessayer plus tard.',
  500: 'Erreur interne.',
};

/** Regroupe les opérations d'un contrôleur sous un titre dans l'interface. `order` : position du groupe (croissant). */
export function DocGroup(name: string, description?: string, order = 50): ClassDecorator {
  groups.set(name, { description, order });
  return ApiTags(name);
}

/** Documente un point d'entrée : résumé, sécurité, réponses de succès et erreurs standardisées. */
export function DocOperation(spec: DocOperationSpec): MethodDecorator {
  const decorators: (MethodDecorator | ClassDecorator)[] = [ApiOperation({ summary: spec.summary, description: spec.description })];

  const errors = new Set(spec.errors ?? []);
  if (spec.auth === 'bearer') {
    decorators.push(ApiBearerAuth(BEARER_SCHEME));
    errors.add(401);
  }
  for (const r of spec.responses ?? []) {
    decorators.push(ApiResponse({ status: r.status, description: r.description, type: r.type, isArray: r.isArray }));
  }
  for (const status of [...errors].sort()) {
    decorators.push(ApiResponse({ status, description: ERROR_TEXT[status], type: ErrorBodyDto }));
  }
  for (const p of spec.params ?? []) {
    decorators.push(ApiParam({ name: p.name, description: p.description, example: p.example, format: p.format, required: p.required ?? true }));
  }
  for (const q of spec.query ?? []) {
    decorators.push(ApiQuery({ name: q.name, description: q.description, example: q.example, required: q.required ?? false }));
  }
  return applyDecorators(...decorators) as MethodDecorator;
}

/** Documente une propriété d'un DTO (requête ou réponse). L'exemple alimente le corps pré-rempli de « Try it out ». */
export function DocProperty(spec: DocPropertySpec): PropertyDecorator {
  const options: Record<string, unknown> = {
    description: spec.description,
    example: spec.example,
    nullable: spec.nullable,
    enum: spec.enum ? [...spec.enum] : undefined,
    minLength: spec.minLength,
    maxLength: spec.maxLength,
    format: spec.format,
    type: spec.itemType ? undefined : spec.type,
    ...(spec.itemType ? { type: spec.itemType === 'string' ? [String] : spec.itemType === 'number' ? [Number] : [spec.itemType] } : {}),
  };
  // `ApiPropertyOptions` est une union stricte (ex. `enum` exige `enumName`) ; nos specs restent plus simples.
  return spec.optional ? ApiPropertyOptional(options as never) : ApiProperty(options as never);
}

/** Les permissions exigées apparaissent dans la description de l'opération (voir le mounteur). */
export function DocRequiresPermissions(...permissions: string[]): MethodDecorator & ClassDecorator {
  return applyDecorators(ApiExtension(PERMISSIONS_EXTENSION, permissions), ApiResponse({ status: 403, description: ERROR_TEXT[403], type: ErrorBodyDto })) as MethodDecorator & ClassDecorator;
}

/** Signale qu'un point d'entrée reste accessible avec une session restreinte (`scope: setup`). */
export function DocAllowsSetupScope(): MethodDecorator & ClassDecorator {
  return ApiExtension(SETUP_EXTENSION, true) as MethodDecorator & ClassDecorator;
}
