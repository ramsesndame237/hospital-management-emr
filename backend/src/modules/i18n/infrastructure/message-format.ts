import { TranslationParams } from '../domain/ports';

/** Remplit les `{nom}` d'un message. Un paramètre absent laisse le `{nom}` visible plutôt que d'écrire « undefined ». */
export function formatMessage(message: string, params?: TranslationParams): string {
  if (!params) return message;
  return message.replace(/\{(\w+)\}/g, (whole, name: string) => (name in params ? String(params[name]) : whole));
}
