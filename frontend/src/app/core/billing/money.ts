import { Injectable, inject } from '@angular/core';
import { Translator } from '../i18n/translator';

/**
 * Passe d'un texte saisi (« 5000 », « 5 000 », « 50,5 ») à un montant entier dans la plus petite unité de la devise
 * (`digits` décimales : 0 pour le franc CFA, 2 pour l'euro). `null` si le texte n'est pas un montant exact : on ne devine
 * jamais, on n'arrondit jamais (un patient ne doit pas payer un centime de plus ou de moins qu'annoncé).
 */
export function toMinorUnits(raw: string, digits: number): number | null {
  const cleaned = String(raw ?? '').replace(/[\s  ]/g, '').replace(',', '.');
  if (!/^\d+(\.\d+)?$/.test(cleaned)) return null;
  const [whole, fraction = ''] = cleaned.split('.');
  if (fraction.length > digits) return null;
  const minor = Number(whole + fraction.padEnd(digits, '0'));
  return Number.isSafeInteger(minor) ? minor : null;
}

const NO_DECIMALS = new Set(['XAF', 'XOF', 'GNF', 'RWF']);
const THREE_DECIMALS = new Set(['TND']);

/** Décimales de la plus petite unité d'une devise, pour une liste qui ne les porte pas (même table que l'API : 0 pour le franc CFA, 2 par défaut). */
export function minorDigitsOf(currency: string): number {
  return NO_DECIMALS.has(currency) ? 0 : THREE_DECIMALS.has(currency) ? 3 : 2;
}

/** L'inverse, sans séparateur de milliers ni symbole : pour pré-remplir un champ de saisie (5000 → « 5000 », 5050 avec 2 décimales → « 50,50 »). */
export function fromMinorUnits(amount: number, digits: number, decimalSeparator = ','): string {
  if (digits === 0) return String(amount);
  const text = String(amount).padStart(digits + 1, '0');
  return `${text.slice(0, -digits)}${decimalSeparator}${text.slice(-digits)}`;
}

/**
 * Affichage des montants dans la langue de l'interface : « 5 000 FCFA » / « 5,000 XAF ». Les calculs se font toujours sur les
 * entiers de l'API ; la mise en forme n'a lieu qu'ici.
 */
@Injectable({ providedIn: 'root' })
export class MoneyFormatter {
  private readonly i18n = inject(Translator);

  format(amount: number, currency: string, digits: number): string {
    const value = amount / 10 ** digits;
    try {
      return new Intl.NumberFormat(this.i18n.locale(), { style: 'currency', currency, minimumFractionDigits: digits, maximumFractionDigits: digits }).format(value);
    } catch {
      // Code de devise inconnu du navigateur : on affiche quand même le montant et le code.
      return `${new Intl.NumberFormat(this.i18n.locale(), { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(value)} ${currency}`;
    }
  }
}
