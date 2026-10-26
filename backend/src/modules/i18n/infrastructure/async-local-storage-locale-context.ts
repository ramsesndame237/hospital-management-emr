import { AsyncLocalStorage } from 'node:async_hooks';
import { Locale } from '../domain/locale';
import { LocaleContext } from '../domain/ports';

/** Langue de la requête propagée par le stockage asynchrone de Node : disponible partout, sans la passer en paramètre. */
export class AsyncLocalStorageLocaleContext implements LocaleContext {
  private readonly storage = new AsyncLocalStorage<Locale>();

  /** `outsideRequest` : langue utilisée hors requête (tâche planifiée, démarrage). */
  constructor(private readonly outsideRequest: Locale) {}

  current(): Locale {
    return this.storage.getStore() ?? this.outsideRequest;
  }

  run<T>(locale: Locale, work: () => T): T {
    return this.storage.run(locale, work);
  }
}
