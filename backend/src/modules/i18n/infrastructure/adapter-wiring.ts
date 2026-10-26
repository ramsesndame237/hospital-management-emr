import type { DynamicModule, Provider } from '@nestjs/common';
import { Locale } from '../domain/locale';

/** Jeton du traducteur « brut » fourni par l'adaptateur choisi, avant l'ajout du décorateur de repli. */
export const RAW_TRANSLATOR = Symbol('RAW_TRANSLATOR');

export interface AdapterOptions {
  readonly catalogsDir: string;
  readonly locales: readonly Locale[];
  readonly defaultLocale: Locale;
  /** Rechargement à chaud des catalogues (développement). */
  readonly watch: boolean;
}

/** Ce qu'un adaptateur apporte au module : éventuellement des modules à importer, et le fournisseur du traducteur brut. */
export interface AdapterWiring {
  readonly imports: DynamicModule[];
  readonly provider: Provider;
}
