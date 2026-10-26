/** Ce qu'une stratégie peut lire d'une requête, sans dépendre d'Express ni d'aucun framework. */
export interface LocaleRequest {
  query(name: string): string | undefined;
  header(name: string): string | undefined;
}

/**
 * Stratégie de choix de la langue (patron Strategy). Renvoie des langues *candidates*, de la plus à la moins souhaitée ;
 * c'est le `LocaleResolver` qui garde la première réellement supportée. Ajouter une source (préférence enregistrée
 * dans le profil, sous-domaine…) = ajouter une classe, sans modifier les autres.
 */
export interface LocaleStrategy {
  candidates(request: LocaleRequest): readonly string[];
}
