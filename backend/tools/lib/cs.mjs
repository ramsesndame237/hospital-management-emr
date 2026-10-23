// Utilitaires d'analyse statique du C# (sans dépendance) : suffisant pour l'inventaire de migration.
// Ce n'est pas un compilateur : on neutralise commentaires et chaînes, puis on suit les accolades.
import fs from 'node:fs';
import path from 'node:path';

export const REPO = path.resolve(import.meta.dirname, '../../..');
export const CODE = path.join(REPO, 'Code');

/** Liste récursive des fichiers .cs (hors bin/obj/node_modules). */
export function listCs(dir) {
  const out = [];
  const walk = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      if (e.name === 'bin' || e.name === 'obj' || e.name === 'node_modules' || e.name === 'wwwroot' || e.name === '.git') continue;
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name.endsWith('.cs')) out.push(p);
    }
  };
  walk(dir);
  return out;
}

export const read = (f) => fs.readFileSync(f, 'utf8').replace(/^﻿/, '');

/**
 * Remplace commentaires et contenu des chaînes par des blancs de même longueur : les positions restent valables,
 * et les accolades/parenthèses des textes ne perturbent plus le suivi. `keepStrings` conserve le contenu des chaînes
 * (utile pour lire un nom de route ou de procédure) mais pas celui des commentaires.
 */
export function mask(src, { keepStrings = false } = {}) {
  let out = '';
  let i = 0;
  const n = src.length;
  while (i < n) {
    const c = src[i], d = src[i + 1];
    if (c === '/' && d === '/') { // commentaire de ligne
      while (i < n && src[i] !== '\n') { out += ' '; i++; }
    } else if (c === '/' && d === '*') { // commentaire de bloc
      out += '  '; i += 2;
      while (i < n && !(src[i] === '*' && src[i + 1] === '/')) { out += src[i] === '\n' ? '\n' : ' '; i++; }
      out += '  '; i += 2;
    } else if (c === '@' && d === '"') { // chaîne verbatim
      out += keepStrings ? '@"' : '  '; i += 2;
      while (i < n) {
        if (src[i] === '"' && src[i + 1] === '"') { out += keepStrings ? '""' : '  '; i += 2; continue; }
        if (src[i] === '"') break;
        out += keepStrings || src[i] === '\n' ? src[i] : ' '; i++;
      }
      out += '"'; i++;
    } else if (c === '"') { // chaîne normale
      out += '"'; i++;
      while (i < n && src[i] !== '"' && src[i] !== '\n') {
        if (src[i] === '\\') { out += keepStrings ? src.substr(i, 2) : '  '; i += 2; continue; }
        out += keepStrings ? src[i] : ' '; i++;
      }
      out += '"'; i++;
    } else if (c === "'" && src[i + 2] === "'") { // caractère
      out += "' '"; i += 3;
    } else { out += c; i++; }
  }
  return out;
}

/** Index de l'accolade fermante correspondant à l'accolade ouvrante `open` (sur un texte déjà masqué). */
export function matchBrace(masked, open) {
  let depth = 0;
  for (let i = open; i < masked.length; i++) {
    if (masked[i] === '{') depth++;
    else if (masked[i] === '}') { depth--; if (depth === 0) return i; }
  }
  return masked.length - 1;
}

/** Index de la parenthèse fermante correspondant à la parenthèse ouvrante `open`. */
export function matchParen(masked, open) {
  let depth = 0;
  for (let i = open; i < masked.length; i++) {
    if (masked[i] === '(') depth++;
    else if (masked[i] === ')') { depth--; if (depth === 0) return i; }
  }
  return masked.length - 1;
}

export const lineOf = (src, idx) => src.slice(0, idx).split('\n').length;

/** Lignes de code utiles (non vides) d'un extrait masqué. */
export const codeLines = (maskedSnippet) => maskedSnippet.split('\n').filter((l) => l.trim().length > 0).length;

/** Découpe une liste de paramètres C# sur les virgules de premier niveau. */
export function splitParams(text) {
  const parts = []; let depth = 0, cur = '';
  for (const ch of text) {
    if ('<([{'.includes(ch)) depth++;
    if ('>)]}'.includes(ch)) depth--;
    if (ch === ',' && depth === 0) { parts.push(cur.trim()); cur = ''; } else cur += ch;
  }
  if (cur.trim()) parts.push(cur.trim());
  return parts;
}
