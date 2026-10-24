/**
 * Seules les adresses internes sont acceptées comme destination après connexion : `//evil.example` ou `https://…`
 * transformeraient la page de connexion en redirection ouverte (hameçonnage).
 */
export function safeReturnUrl(raw: string | null | undefined): string {
  if (!raw || !raw.startsWith('/') || raw.startsWith('//') || raw.includes('\\')) return '/';
  return raw;
}
