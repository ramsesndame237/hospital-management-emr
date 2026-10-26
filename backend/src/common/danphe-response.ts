import { SetMetadata } from '@nestjs/common';

/**
 * Enveloppe de réponse du backend .NET (DanpheHTTPResponse) : tout l'Angular existant lit `Status`, `Results` et
 * `ErrorMessage`. Elle doit rester identique tant que le front n'a pas été migré.
 * Particularité héritée : une erreur métier renvoie quand même HTTP 200 avec `Status: 'Failed'`.
 */
export type DanpheStatus = 'OK' | 'Failed';

export interface DanpheResponse<T = unknown> {
  Status: DanpheStatus;
  Results?: T;
  ErrorMessage?: string;
}

export const ok = <T>(results: T): DanpheResponse<T> => ({ Status: 'OK', Results: results });
export const failed = (message: string): DanpheResponse<never> => ({ Status: 'Failed', ErrorMessage: message });

/** Marque un contrôleur (ou une action) dont les réponses doivent être enveloppées comme en .NET. */
export const DANPHE_ENVELOPE = 'danphe:envelope';
export const DanpheApi = () => SetMetadata(DANPHE_ENVELOPE, true);
