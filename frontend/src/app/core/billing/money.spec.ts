import { TestBed } from '@angular/core/testing';
import { Translator } from '../i18n/translator';
import { configureApp } from '../../testing/app-testing';
import { MoneyFormatter, fromMinorUnits, minorDigitsOf, toMinorUnits } from './money';

const plain = (text: string) => text.replace(/\s+/g, ' ');

describe('toMinorUnits (saisie → entier, sans jamais arrondir)', () => {
  it.each([
    ['5000', 0, 5000],
    ['5 000', 0, 5000],
    ['5 000', 0, 5000],
    ['5 000', 0, 5000],
    ['  750  ', 0, 750],
    ['0', 0, 0],
    ['50', 2, 5000],
    ['50,5', 2, 5050],
    ['50.05', 2, 5005],
    ['0,99', 2, 99],
    ['1 250,75', 2, 125075],
    ['2,5', 3, 2500],
  ])('« %s » avec %i décimale(s) vaut %i', (raw, digits, expected) => expect(toMinorUnits(raw, digits)).toBe(expected));

  it.each([
    ['', 0], ['abc', 0], ['12.5', 0], ['12,5', 0], ['-5', 0], ['5000 FCFA', 0], ['1,234', 2], ['1e3', 0], ['5,', 0], [',5', 2], ['5..5', 2],
  ])('refuse « %s » avec %i décimale(s) : un montant inexact n\'est jamais deviné', (raw, digits) => expect(toMinorUnits(raw, digits)).toBeNull());

  it('refuse un montant qui dépasse les entiers sûrs', () => {
    expect(toMinorUnits('9'.repeat(20), 0)).toBeNull();
  });
});

describe('fromMinorUnits (entier → champ de saisie)', () => {
  it('rend l\'entier tel quel sans décimale, et place la virgule sinon', () => {
    expect(fromMinorUnits(5000, 0)).toBe('5000');
    expect(fromMinorUnits(5050, 2)).toBe('50,50');
    expect(fromMinorUnits(5, 2)).toBe('0,05');
    expect(fromMinorUnits(0, 2)).toBe('0,00');
    expect(fromMinorUnits(2500, 3)).toBe('2,500');
    expect(fromMinorUnits(5050, 2, '.')).toBe('50.50');
  });

  it('fait l\'aller-retour avec la saisie', () => {
    for (const [amount, digits] of [[0, 0], [123456, 0], [99, 2], [100, 2], [1234567, 2], [1, 3]] as const) {
      expect(toMinorUnits(fromMinorUnits(amount, digits), digits)).toBe(amount);
    }
  });
});

describe('minorDigitsOf', () => {
  it('0 pour le franc CFA, 3 pour le dinar tunisien, 2 sinon', () => {
    expect(minorDigitsOf('XAF')).toBe(0);
    expect(minorDigitsOf('XOF')).toBe(0);
    expect(minorDigitsOf('TND')).toBe(3);
    expect(minorDigitsOf('EUR')).toBe(2);
    expect(minorDigitsOf('???')).toBe(2);
  });
});

describe('MoneyFormatter', () => {
  function setup(locale: string): MoneyFormatter {
    const { i18n } = configureApp({ signedIn: false });
    (i18n as Translator).setLocale(locale);
    return TestBed.inject(MoneyFormatter);
  }

  it('affiche le franc CFA sans décimale, avec des séparateurs de milliers', () => {
    const money = setup('fr');
    expect(plain(money.format(5000, 'XAF', 0))).toMatch(/^5 000 FCFA$/);
    expect(plain(money.format(1234567, 'XAF', 0))).toMatch(/^1 234 567 FCFA$/);
    expect(plain(money.format(0, 'XAF', 0))).toMatch(/^0 FCFA$/);
  });

  it('suit la langue de l\'interface', () => {
    expect(setup('en').format(5000, 'XAF', 0)).toMatch(/5,000/);
  });

  it('divise par la plus petite unité de la devise', () => {
    const money = setup('fr');
    expect(plain(money.format(5050, 'EUR', 2))).toMatch(/^50,50 €$/);
  });

  it('affiche quand même montant et code pour une devise inconnue', () => {
    const money = setup('fr');
    expect(plain(money.format(1500, '???', 0))).toBe('1 500 ???');
  });
});
