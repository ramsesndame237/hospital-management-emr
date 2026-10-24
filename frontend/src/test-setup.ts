import { Temporal } from 'temporal-polyfill';

// Les tests tournent dans Node/jsdom, où Temporal n'est pas toujours présent : même polyfill qu'en production.
if (!('Temporal' in globalThis)) Object.assign(globalThis, { Temporal });
