import { types } from 'pg';

/**
 * Formats de date/heure compatibles avec le JSON du backend .NET (que l'Angular analyse avec moment) :
 *  - `timestamp` (sans fuseau, comme `datetime` SQL Server) : « 2026-10-07T08:30:00 », sans « Z » ni décalage ;
 *    laisser `pg` produire un `Date` JavaScript ajouterait « Z » et décalerait les heures affichées.
 *  - `interval` (équivalent de `TimeSpan`) : « 08:30:00 ».
 * À appeler une seule fois, avant la première connexion.
 */
export function configurePgTypes(): void {
  types.setTypeParser(1114, (v: string) => v.replace(' ', 'T')); // timestamp
  types.setTypeParser(1082, (v: string) => v); // date : « 2026-10-07 », laissé en texte
  types.setTypeParser(1186, (v: string) => v.replace(/^(\d):/, '0$1:').replace(/\.\d+$/, '')); // interval
}
