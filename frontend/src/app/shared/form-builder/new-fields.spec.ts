import { Component, signal, viewChild } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { JsonTranslator } from '../../core/i18n/json-translator';
import { Translator } from '../../core/i18n/translator';
import { FormBuilderComponent } from './form-builder';
import { FieldSchema, FormAction } from './form-schema';

@Component({
  imports: [FormBuilderComponent],
  template: `<app-form-builder #fb [fields]="fields()" formId="t" (submitted)="submitted.push($event)" (action)="actions.push($event)" />`,
})
class Host {
  readonly fb = viewChild.required<FormBuilderComponent>('fb');
  readonly fields = signal<FieldSchema[]>([]);
  readonly submitted: Record<string, unknown>[] = [];
  readonly actions: FormAction[] = [];
}

describe('nouveaux champs du constructeur', () => {
  let fixture: ComponentFixture<Host>;
  let host: Host;
  const root = () => fixture.nativeElement as HTMLElement;
  const q = <T extends HTMLElement>(sel: string) => root().querySelector<T>(sel);
  const cells = () => [...root().querySelectorAll<HTMLInputElement>('app-otp-field input')];

  async function settle(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  async function setup(fields: FieldSchema[]): Promise<void> {
    localStorage.clear();
    TestBed.configureTestingModule({ providers: [provideRouter([]), { provide: Translator, useClass: JsonTranslator }] });
    TestBed.inject(Translator).setLocale('fr');
    fixture = TestBed.createComponent(Host);
    host = fixture.componentInstance;
    host.fields.set(fields);
    await settle();
  }

  const OTP: FieldSchema = { type: 'otp', name: 'code', label: 'mfa.code', hint: 'mfa.hint', validators: [{ type: 'required' }, { type: 'pattern', value: '^\\d{6}$' }] };

  function enter(index: number, value: string): void {
    const cell = cells()[index];
    cell.value = value;
    cell.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  }

  function paste(index: number, content: string): void {
    const event = new Event('paste', { cancelable: true, bubbles: true }) as Event & { clipboardData: unknown };
    event.clipboardData = { getData: () => content };
    cells()[index].dispatchEvent(event);
    fixture.detectChanges();
  }

  describe('otp (code en cases)', () => {
    it('affiche 6 cases étiquetées, un indice et un champ obligatoire', async () => {
      await setup([OTP]);
      expect(cells().length).toBe(6);
      expect(cells()[0].id).toBe('t-code');
      expect(cells()[2].getAttribute('aria-label')).toBe('Chiffre 3 sur 6');
      expect(q('[role=group]')?.textContent).toContain('Code de vérification *');
      expect(root().textContent).toContain('Collez les 6 chiffres');
      expect(cells()[0].getAttribute('autocomplete')).toBe('one-time-code');
    });

    it('la saisie avance de case en case et la valeur du formulaire est la suite des chiffres', async () => {
      await setup([OTP]);
      enter(0, '2');
      expect(root().ownerDocument.activeElement).toBe(cells()[1]);
      '84951'.split('').forEach((digit, i) => enter(i + 1, digit));
      expect(host.fb().value()).toEqual({ code: '284951' });
    });

    it('refuse tout ce qui n’est pas un chiffre', async () => {
      await setup([OTP]);
      enter(0, 'a');
      expect(cells()[0].value).toBe('');
      expect(host.fb().value()).toEqual({ code: '' });
    });

    it('un code collé est réparti sur les cases (espaces et tirets ignorés)', async () => {
      await setup([OTP]);
      paste(0, '284 951');
      expect(cells().map((c) => c.value).join('')).toBe('284951');
      expect(host.fb().value()).toEqual({ code: '284951' });
      expect(root().ownerDocument.activeElement).toBe(cells()[5]);
    });

    it('plusieurs chiffres livrés d’un coup dans une case (clavier mobile, remplissage automatique) sont répartis', async () => {
      await setup([OTP]);
      enter(0, '284951');
      expect(cells().map((c) => c.value).join('')).toBe('284951');
      expect(host.fb().value()).toEqual({ code: '284951' });
    });

    it('un chiffre tapé derrière un chiffre déjà présent le remplace', async () => {
      await setup([OTP]);
      enter(0, '2');
      enter(0, '27'); // curseur placé après le « 2 » : le nouveau chiffre est le « 7 »
      expect(host.fb().value()).toEqual({ code: '7' });
    });

    it('un collage trop long est tronqué à la longueur du code', async () => {
      await setup([OTP]);
      paste(0, '1234567890');
      expect(host.fb().value()).toEqual({ code: '123456' });
    });

    it('Retour arrière sur une case vide efface la précédente et y revient', async () => {
      await setup([OTP]);
      paste(0, '123');
      cells()[3].dispatchEvent(new KeyboardEvent('keydown', { key: 'Backspace' }));
      fixture.detectChanges();
      expect(host.fb().value()).toEqual({ code: '12' });
      expect(root().ownerDocument.activeElement).toBe(cells()[2]);
    });

    it('les flèches déplacent le curseur sans modifier le code', async () => {
      await setup([OTP]);
      cells()[2].focus();
      cells()[2].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft' }));
      expect(root().ownerDocument.activeElement).toBe(cells()[1]);
      cells()[1].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
      expect(root().ownerDocument.activeElement).toBe(cells()[2]);
      expect(host.fb().value()).toEqual({ code: '' });
    });

    it('un envoi incomplet est refusé et les cases passent en rouge', async () => {
      await setup([OTP, { type: 'submit', name: 's', label: 'mfa.verify' }]);
      paste(0, '12');
      q<HTMLFormElement>('form')!.dispatchEvent(new Event('submit'));
      await settle();
      expect(host.submitted).toEqual([]);
      expect(cells()[0].className).toContain('border-status-critical');
      expect(cells()[0].getAttribute('aria-invalid')).toBe('true');
    });

    it('envoie le code complet', async () => {
      await setup([OTP, { type: 'submit', name: 's', label: 'mfa.verify' }]);
      paste(0, '284951');
      q<HTMLFormElement>('form')!.dispatchEvent(new Event('submit'));
      await settle();
      expect(host.submitted).toEqual([{ code: '284951' }]);
    });

    it('marquer le champ invalide met les cases en rouge sans afficher de texte, et l’état survit au redessin du formulaire', async () => {
      await setup([OTP]);
      paste(0, '284951');
      host.fb().markInvalid('code');
      host.fields.set([{ type: 'message', name: 'm', tone: 'warning', title: 'mfa.invalid.title' }, OTP]); // le bandeau est ajouté juste après
      await settle();
      expect(cells()[0].className).toContain('border-status-critical');
      expect(root().querySelector('#t-code-error')).toBeNull();
      expect(cells().map((c) => c.value).join('')).toBe('284951'); // saisie conservée pour correction
      enter(5, '2'); // l'utilisateur corrige : l'erreur du serveur disparaît
      await settle();
      expect(cells()[0].className).not.toContain('border-status-critical');
    });

    it('accepte une longueur personnalisée', async () => {
      await setup([{ ...OTP, length: 4 } as FieldSchema]);
      expect(cells().length).toBe(4);
    });
  });

  describe('changement de formulaire', () => {
    it('de nouveaux champs de saisie repartent sans erreur affichée, alors qu’un simple bandeau ajouté conserve l’état', async () => {
      const credentials: FieldSchema[] = [
        { type: 'text', name: 'username', label: 'login.username', validators: [{ type: 'required' }] },
        { type: 'submit', name: 's', label: 'login.submit' },
      ];
      await setup(credentials);
      q<HTMLFormElement>('form')!.dispatchEvent(new Event('submit'));
      await settle();
      expect(q('#t-username-error')).not.toBeNull();

      host.fields.set([{ type: 'message', name: 'm', tone: 'critical', title: 'login.network.title' }, ...credentials]);
      await settle();
      expect(q('#t-username-error')).not.toBeNull(); // même formulaire : l'erreur reste

      host.fields.set([OTP, { type: 'submit', name: 's', label: 'mfa.verify' }]);
      await settle();
      expect(root().textContent).not.toContain('obligatoire'); // autre formulaire : on repart propre
      expect(cells()[0].className).not.toContain('border-status-critical');
    });
  });

  describe('champs d’affichage', () => {
    it('codes : liste des valeurs sur deux colonnes, marquée à imprimer', async () => {
      await setup([{ type: 'codes', name: 'c', values: ['AAAAA-BBBBB', 'CCCCC-DDDDD'] }]);
      expect(q('ul.print-area')?.className).toContain('grid-cols-2');
      expect([...root().querySelectorAll('li')].map((li) => li.textContent)).toEqual(['AAAAA-BBBBB', 'CCCCC-DDDDD']);
    });

    it('checklist : une coche par ligne, avec paramètres', async () => {
      await setup([{ type: 'checklist', name: 'r', items: ['ready.codes', 'ready.password'], params: { count: 10 } }]);
      expect([...root().querySelectorAll('li')].map((li) => li.textContent?.trim())).toEqual(['✓10 codes de récupération conservés', '✓Mot de passe personnel défini']);
    });

    it('disclosure : section dépliable fermée par défaut, ouverte à la demande', async () => {
      await setup([
        { type: 'disclosure', name: 'a', title: 'authenticator.help.title', text: 'authenticator.help.text' },
        { type: 'disclosure', name: 'b', title: 'authenticator.help.title', text: 'authenticator.help.text', open: true },
      ]);
      const [closed, open] = [...root().querySelectorAll<HTMLDetailsElement>('details')];
      expect(closed.open).toBe(false);
      expect(open.open).toBe(true);
      expect(closed.textContent).toContain('Le code n’est pas reconnu ?');
    });

    it('paragraphe en demi-gras (intertitre d’étape)', async () => {
      await setup([{ type: 'paragraph', name: 'p', text: 'authenticator.confirm', size: 'sm', strong: true }]);
      expect(q('p')?.className).toContain('font-semibold');
      expect(q('p')?.className).toContain('text-sm');
    });
  });

  describe('boutons', () => {
    const BASE: FieldSchema[] = [
      { type: 'checkbox', name: 'saved', label: 'recoveryCodes.saved' },
      { type: 'submit', name: 's', label: 'recoveryCodes.finish', disabledIf: { field: 'saved', equals: false } },
    ];

    it('un bouton avec `disabledIf` reste inactif tant que la condition est vraie', async () => {
      await setup(BASE);
      expect(q<HTMLButtonElement>('button[type=submit]')?.disabled).toBe(true);
      q<HTMLInputElement>('input[type=checkbox]')!.click();
      await settle();
      expect(q<HTMLButtonElement>('button[type=submit]')?.disabled).toBe(false);
    });

    it('un bouton `disabled` est inactif', async () => {
      await setup([{ type: 'submit', name: 's', label: 'login.submit', disabled: true }]);
      expect(q<HTMLButtonElement>('button[type=submit]')?.disabled).toBe(true);
    });

    it('un lien `href` s’ouvre dans un nouvel onglet sans transmettre la page d’origine', async () => {
      await setup([{ type: 'link', name: 'l', label: 'login.status', href: 'https://etat.example/service' }]);
      const link = q<HTMLAnchorElement>('a')!;
      expect(link.getAttribute('href')).toBe('https://etat.example/service');
      expect(link.target).toBe('_blank');
      expect(link.rel).toContain('noopener');
    });
  });

  describe('mot de passe compromis', () => {
    it('la jauge reste pleine mais passe en alerte et le libellé le dit', async () => {
      await setup([
        { type: 'password', name: 'pw', label: 'setup.newPassword', value: 'Cheval-pile-agrafe-2026', compromised: true, validators: [{ type: 'passwordPolicy', value: 12, rules: ['notCommon'] }] },
      ]);
      expect(root().textContent).toContain('Force élevée · mot de passe compromis');
      expect(root().querySelectorAll('.bg-status-warning').length).toBe(4);
      expect(root().querySelectorAll('.bg-status-success').length).toBe(0);
    });
  });
});
