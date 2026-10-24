/**
 * Temporal est natif dans les navigateurs récents ; le polyfill (lourd) n'est téléchargé que s'il manque. L'application est donc
 * importée APRÈS ce contrôle : ses modules lisent `globalThis.Temporal` dès leur évaluation.
 */
if (!('Temporal' in globalThis)) {
  const { Temporal } = await import('temporal-polyfill');
  Object.assign(globalThis, { Temporal });
}

const [{ bootstrapApplication }, { appConfig }, { App }] = await Promise.all([import('@angular/platform-browser'), import('./app/app.config'), import('./app/app')]);

bootstrapApplication(App, appConfig).catch((err) => console.error(err));

export {};
