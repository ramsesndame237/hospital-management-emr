import { AdapterOptions, AdapterWiring, RAW_TRANSLATOR } from '../adapter-wiring';
import { JsonCatalogTranslator } from './json-catalog.translator';

/** Adaptateur sans bibliothèque : lit directement les catalogues JSON. */
export function jsonCatalogAdapter(options: AdapterOptions): AdapterWiring {
  return { imports: [], provider: { provide: RAW_TRANSLATOR, useFactory: () => new JsonCatalogTranslator(options.catalogsDir) } };
}
