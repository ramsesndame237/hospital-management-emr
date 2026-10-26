/**
 * Façade publique du module de documentation d'API : LE point d'import pour tout code qui documente un endpoint.
 * Les contrôleurs et les DTO importent d'ici, jamais d'une bibliothèque de documentation. Un test d'architecture
 * (`test/architecture.spec.ts`) le vérifie.
 */
export type {
  ApiDocsAccess,
  ApiDocsOptions,
  DocsAccessDecision,
  PortalLocalization,
  PortalTexts,
  PortalTextsProvider,
  DocOperationSpec,
  DocParam,
  DocPropertySpec,
  DocResponse,
  HttpErrorStatus,
} from './domain/api-docs.port';
export { ErrorBodyDto, FieldErrorDto } from './infrastructure/swagger/error-body.dto';
export {
  DocAllowsSetupScope,
  DocGroup,
  DocOperation,
  DocProperty,
  DocRequiresPermissions,
} from './infrastructure/swagger/swagger-decorators';
export { API_DOCS_ACCESS, PORTAL_TEXTS_PROVIDER, PORTAL_TEXT_KEYS } from './domain/api-docs.port';
export type { PortalTextKey } from './domain/api-docs.port';
export { mountApiDocs } from './infrastructure/swagger/swagger-mounter';
export type { ApiDocsIntegration } from './infrastructure/swagger/swagger-mounter';
