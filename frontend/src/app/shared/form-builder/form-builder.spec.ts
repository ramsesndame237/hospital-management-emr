import { Component, Type, signal, viewChild } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { JsonTranslator } from '../../core/i18n/json-translator';
import { Translator } from '../../core/i18n/translator';
import { FieldRegistry } from './field-registry';
import { InputRenderer } from './field-context';
import { FormBuilderComponent } from './form-builder';
import { FieldSchema, FormAction } from './form-schema';
import { ValidatorRegistry } from './validator-registry';

@Component({
  imports: [FormBuilderComponent],
  template: `<app-form-builder #fb [fields]="fields()" [data]="data()" [busy]="busy()" [layout]="layout()" formId="t" (submitted)="submitted.push($event)" (invalidSubmit)="invalid = invalid + 1" (action)="actions.push($event)" />`,
})
class Host {
  readonly fb = viewChild.required<FormBuilderComponent>('fb');
  readonly fields = signal<FieldSchema[]>([]);
  readonly data = signal<Record<string, unknown> | null>(null);
  readonly busy = signal(false);
  readonly layout = signal({});
  readonly submitted: Record<string, unknown>[] = [];
  readonly actions: FormAction[] = [];
  invalid = 0;
}

const LOGIN: FieldSchema[] = [
  { type: 'text', name: 'username', label: 'login.username', placeholder: 'login.usernamePlaceholder', normalize: 'trim', validators: [{ type: 'required' }, { type: 'maxLength', value: 10 }] },
  { type: 'password', name: 'password', label: 'login.password', validators: [{ type: 'required', message: 'login.errors.passwordRequired' }] },
  { type: 'submit', name: 'go', label: 'login.submit', busyLabel: 'login.submitting' },
];

describe('FormBuilderComponent', () => {
  let fixture: ComponentFixture<Host>;
  let host: Host;
  const root = () => fixture.nativeElement as HTMLElement;
  const q = <T extends HTMLElement>(selector: string) => root().querySelector<T>(selector);
  const text = () => root().textContent ?? '';

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

  async function type(selector: string, value: string): Promise<void> {
    const input = q<HTMLInputElement>(selector)!;
    input.value = value;
    input.dispatchEvent(new Event('input'));
    await settle();
  }

  async function submit(): Promise<void> {
    q<HTMLFormElement>('form')!.dispatchEvent(new Event('submit'));
    await settle();
  }

  describe('affichage', () => {
    it('dessine chaque champ du tableau JSON avec son étiquette (« * » si obligatoire), son placeholder et ses identifiants', async () => {
      await setup(LOGIN);
      expect(q('label[for="t-username"]')?.textContent?.trim()).toBe('Identifiant *');
      expect(q<HTMLInputElement>('#t-username')?.placeholder).toBe('prenom.nom');
      expect(q<HTMLInputElement>('#t-password')?.type).toBe('password');
      expect(q('button[type=submit]')?.textContent).toContain('Se connecter');
      expect(q('form')?.id).toBe('t');
    });

    it('applique les classes du JSON : conteneur (`class`), saisie (`inputClass`) et largeur (`span`)', async () => {
      await setup([{ type: 'text', name: 'a', label: 'login.username', class: 'ma-classe', inputClass: 'ma-saisie', span: 6 }]);
      expect(q('.ma-classe')?.className).toContain('sm:col-span-6');
      expect(q('#t-a')?.className).toContain('ma-saisie');
    });

    it('applique la mise en forme du formulaire', async () => {
      await setup(LOGIN);
      host.layout.set({ class: 'form-perso', gap: 'gap-y-8' });
      await settle();
      expect(q('form')?.className).toContain('form-perso');
      expect(q('form')?.className).toContain('gap-y-8');
    });

    it("lie la saisie à son aide et à son erreur (`aria-describedby`, `aria-invalid`)", async () => {
      await setup([{ type: 'text', name: 'a', label: 'login.username', hint: 'login.usernamePlaceholder', validators: [{ type: 'required' }] }]);
      expect(q('#t-a')?.getAttribute('aria-describedby')).toBe('t-a-hint');
      await submit();
      expect(q('#t-a')?.getAttribute('aria-invalid')).toBe('true');
      expect(q('#t-a')?.getAttribute('aria-describedby')).toBe('t-a-hint t-a-error');
      expect(q('#t-a-error')?.getAttribute('role')).toBe('alert');
    });

    it("rend un message d'état avec son ton et un paragraphe", async () => {
      await setup([
        { type: 'message', name: 'm', tone: 'critical', title: 'login.network.title', text: 'login.network.text' },
        { type: 'paragraph', name: 'p', text: 'login.supportCode', params: { code: 'AUTH-N01-241026' }, mono: true },
      ]);
      expect(q('[role=alert]')?.textContent).toContain('La connexion réseau a été interrompue');
      expect(text()).toContain("Code d’assistance : AUTH-N01-241026");
    });

    it('rend une liste déroulante, des boutons radio et une case à cocher', async () => {
      await setup([
        { type: 'select', name: 's', label: 'login.username', placeholder: 'login.usernamePlaceholder', options: [{ value: 'a', label: 'roles.DOCTOR' }, { value: 'b', label: 'roles.NURSE' }] },
        { type: 'radio', name: 'r', label: 'login.password', options: [{ value: '1', label: 'roles.DOCTOR' }] },
        { type: 'checkbox', name: 'c', label: 'common.signOut', validators: [{ type: 'required' }] },
      ]);
      expect([...root().querySelectorAll('option')].map((o) => o.textContent?.trim())).toEqual(['prenom.nom', 'Médecin', 'Infirmier(ère)']);
      expect(root().querySelectorAll('input[type=radio]').length).toBe(1);
      expect(q('input[type=checkbox]')).not.toBeNull();
    });
  });

  describe('validation et envoi', () => {
    it("refuse l'envoi, dit pourquoi dans la langue courante avec la phrase de l'API, et place le curseur sur le premier champ invalide", async () => {
      await setup(LOGIN);
      await submit();
      expect(host.submitted).toEqual([]);
      expect(host.invalid).toBe(1);
      expect(q('#t-username-error')?.textContent).toContain('Le champ « identifiant » est obligatoire.'); // `server.validation.isNotEmpty` + `server.fields.username`
      expect(root().ownerDocument.activeElement).toBe(q('#t-username'));
    });

    it("utilise le message du JSON quand il y en a un", async () => {
      await setup(LOGIN);
      await submit();
      expect(q('#t-password-error')?.textContent).toContain('Saisissez votre mot de passe.');
    });

    it("n'affiche aucune erreur avant le premier envoi, puis montre celle d'un champ quitté", async () => {
      await setup(LOGIN);
      expect(q('#t-username-error')).toBeNull();
      q<HTMLInputElement>('#t-username')!.dispatchEvent(new Event('blur'));
      await settle();
      expect(q('#t-username-error')).not.toBeNull();
    });

    it("émet les valeurs normalisées (`trim`) d'un formulaire valide", async () => {
      await setup(LOGIN);
      await type('#t-username', '  marie  ');
      await type('#t-password', 'une phrase de passe');
      await submit();
      expect(host.submitted).toEqual([{ username: 'marie', password: 'une phrase de passe' }]);
    });

    it('applique `maxLength` : attribut HTML et règle de validation', async () => {
      await setup(LOGIN);
      expect(q<HTMLInputElement>('#t-username')?.maxLength).toBe(10);
      await type('#t-username', 'x'.repeat(11));
      await submit();
      expect(q('#t-username-error')?.textContent).toContain('trop long');
    });

    it('valide e-mail, motif et minimum, avec les phrases de l’API quand elles existent', async () => {
      await setup([
        { type: 'email', name: 'mail', label: 'login.username', validators: [{ type: 'email' }] },
        { type: 'text', name: 'code', label: 'mfa.code', validators: [{ type: 'pattern', value: '^\\d{6}$' }] },
        { type: 'number', name: 'age', label: 'login.password', validators: [{ type: 'min', value: 18 }] },
      ]);
      await type('#t-mail', 'pas-un-mail');
      await type('#t-code', '12');
      await type('#t-age', '3');
      await submit();
      expect(q('#t-mail-error')?.textContent).toContain('adresse e-mail valide');
      expect(q('#t-code-error')?.textContent).toContain('pas le bon format');
      expect(q('#t-age-error')?.textContent).toContain('au moins 18');
    });

    it('convertit un champ `number` en nombre à l’envoi', async () => {
      await setup([{ type: 'number', name: 'age', label: 'login.username' }]);
      await type('#t-age', '42');
      await submit();
      expect(host.submitted).toEqual([{ age: 42 }]);
    });

    it("compare deux champs (confirmation) et revalide quand l'autre champ change", async () => {
      await setup([
        { type: 'text', name: 'a', label: 'login.username' },
        { type: 'text', name: 'b', label: 'login.password', validators: [{ type: 'equalsField', field: 'a', message: 'setup.errors.mismatch' }] },
      ]);
      await type('#t-b', 'abc');
      await submit();
      expect(q('#t-b-error')?.textContent).toContain('ne sont pas identiques');
      await type('#t-a', 'abc'); // changer le champ de référence suffit à lever l'erreur
      expect(q('#t-b-error')).toBeNull();
    });

    it("n'envoie pas pendant qu'un envoi est en cours et affiche le libellé d'attente", async () => {
      await setup([{ type: 'text', name: 'a', label: 'login.username' }, LOGIN[2]]);
      host.busy.set(true);
      await settle();
      const button = q<HTMLButtonElement>('button[type=submit]')!;
      expect(button.disabled).toBe(true);
      expect(button.textContent).toContain('Vérification…');
      await submit();
      expect(host.submitted).toEqual([]);
    });
  });

  describe('affichage conditionnel et états', () => {
    const conditional: FieldSchema[] = [
      { type: 'checkbox', name: 'other', label: 'common.signOut' },
      { type: 'text', name: 'detail', label: 'login.username', showIf: { field: 'other', equals: true }, validators: [{ type: 'required' }] },
    ];

    it('masque un champ tant que sa condition est fausse, et ne l’envoie ni ne le valide alors', async () => {
      await setup(conditional);
      expect(q('#t-detail')).toBeNull();
      await submit();
      expect(host.submitted).toEqual([{ other: false }]);
    });

    it('affiche le champ dès que la condition devient vraie', async () => {
      await setup(conditional);
      q<HTMLInputElement>('#t-other')!.click();
      await settle();
      expect(q('#t-detail')).not.toBeNull();
      await submit();
      expect(host.submitted).toEqual([]); // devenu obligatoire
    });

    it('désactive un champ (`disabled`) : il reste affiché mais n’est pas envoyé', async () => {
      await setup([{ type: 'text', name: 'a', label: 'login.username', disabled: true, value: 'figé' }, { type: 'text', name: 'b', label: 'login.password' }]);
      expect(q<HTMLInputElement>('#t-a')?.disabled).toBe(true);
      await submit();
      expect(host.submitted).toEqual([{ b: '' }]);
    });

    it('applique les valeurs fournies (`data`) aux seuls champs connus', async () => {
      await setup(LOGIN);
      host.data.set({ username: 'marie', inconnu: 'x' });
      await settle();
      expect(q<HTMLInputElement>('#t-username')?.value).toBe('marie');
    });
  });

  describe('évolution du tableau de champs', () => {
    it("conserve la saisie quand le tableau est remplacé (message d'erreur ajouté, libellé changé)", async () => {
      await setup(LOGIN);
      await type('#t-username', 'marie');
      host.fields.set([{ type: 'message', name: 'm', tone: 'critical', title: 'login.network.title' }, ...LOGIN.slice(0, 2), { ...LOGIN[2], label: 'login.retry' } as FieldSchema]);
      await settle();
      expect(q<HTMLInputElement>('#t-username')?.value).toBe('marie');
      expect(q('button[type=submit]')?.textContent).toContain('Réessayer');
    });

    it("retire le contrôle d'un champ qui disparaît", async () => {
      await setup(LOGIN);
      host.fields.set([LOGIN[1], LOGIN[2]]);
      await settle();
      expect(q('#t-username')).toBeNull();
      await type('#t-password', 'x');
      await submit();
      expect(host.submitted).toEqual([{ password: 'x' }]);
    });

    it('suit la langue : les messages changent sans reconstruire le formulaire', async () => {
      await setup(LOGIN);
      await submit();
      expect(q('#t-username-error')?.textContent).toContain('est obligatoire');
      TestBed.inject(Translator).setLocale('en');
      await settle();
      expect(q('label[for="t-username"]')?.textContent?.trim()).toBe('Username *');
      expect(q('#t-username-error')?.textContent).toContain('is required');
    });
  });

  describe('erreurs renvoyées par le serveur', () => {
    it("les affiche sur le champ concerné, rend la main sur le reste, et les efface à la modification", async () => {
      await setup(LOGIN);
      await type('#t-username', 'marie');
      const unmatched = host.fb().applyServerErrors([
        { field: 'username', message: 'Identifiant déjà utilisé.' },
        { field: 'inconnu', message: 'Autre erreur.' },
      ]);
      await settle();
      expect(q('#t-username-error')?.textContent).toContain('Identifiant déjà utilisé.');
      expect(unmatched).toEqual([{ field: 'inconnu', message: 'Autre erreur.' }]);
      await type('#t-username', 'marie2');
      expect(q('#t-username-error')).toBeNull();
    });
  });

  describe('actions', () => {
    it('un bouton et un lien émettent leur action avec les valeurs courantes', async () => {
      await setup([
        { type: 'text', name: 'a', label: 'login.username', value: 'x' },
        { type: 'button', name: 'b1', label: 'common.back', action: 'retour' },
        { type: 'link', name: 'l1', label: 'login.forgot' },
      ]);
      const buttons = root().querySelectorAll<HTMLButtonElement>('button');
      buttons[0].click();
      buttons[1].click();
      expect(host.actions).toEqual([
        { action: 'retour', value: { a: 'x' } },
        { action: 'l1', value: { a: 'x' } },
      ]);
    });

    it("un bouton d'envoi peut appartenir à un autre formulaire (attribut `form`)", async () => {
      await setup([{ type: 'submit', name: 's', label: 'login.submit', form: 'ailleurs' }]);
      expect(q('button[type=submit]')?.getAttribute('form')).toBe('ailleurs');
    });
  });

  describe('mot de passe', () => {
    const policy: FieldSchema[] = [
      { type: 'text', name: 'username', label: 'login.username' },
      { type: 'password', name: 'pw', label: 'login.password', validators: [{ type: 'required' }, { type: 'passwordPolicy', value: 12, rules: ['notCommon', 'noIdentity'], identityFields: ['username'] }] },
    ];

    it('bascule entre affichage et masquage avec le bouton « Afficher »', async () => {
      await setup(policy);
      const toggle = [...root().querySelectorAll('button')].find((b) => b.textContent?.trim() === 'Afficher')!;
      toggle.click();
      await settle();
      expect(q<HTMLInputElement>('#t-pw')?.type).toBe('text');
      expect(toggle.textContent?.trim()).toBe('Masquer');
    });

    it('affiche la jauge et coche les règles pendant la frappe', async () => {
      await setup(policy);
      await type('#t-username', 'marie.curie');
      await type('#t-pw', 'marie.curie2026');
      const items = [...root().querySelectorAll('li')].map((li) => li.textContent?.replace(/\s+/g, ' ').trim());
      expect(items[0]).toContain('✓ Au moins 12 caractères');
      expect(items[2]).toContain('○ Sans identifiant ni adresse e-mail'); // contient l'identifiant saisi dans l'autre champ
      expect(text()).toContain('Force faible');

      await type('#t-pw', 'Cheval-pile-agrafe-2026');
      expect([...root().querySelectorAll('li')].every((li) => li.textContent?.includes('✓'))).toBe(true);
      expect(text()).toContain('Force élevée · mot de passe robuste');
    });

    it("refuse un mot de passe qui enfreint la politique, avec le message de la politique", async () => {
      await setup(policy);
      await type('#t-pw', 'password');
      await submit();
      expect(q('#t-pw-error')?.textContent).toContain('politique de sécurité');
    });
  });

  describe('extension', () => {
    it("accepte une règle de validation enregistrée, utilisable ensuite dans le JSON", async () => {
      TestBed.configureTestingModule({ providers: [provideRouter([]), { provide: Translator, useClass: JsonTranslator }] });
      TestBed.inject(ValidatorRegistry).register('even', { create: () => (control) => (Number(control.value) % 2 === 0 ? null : { even: true }) });
      TestBed.inject(Translator).setLocale('fr');
      fixture = TestBed.createComponent(Host);
      host = fixture.componentInstance;
      host.fields.set([{ type: 'number', name: 'n', label: 'login.username', validators: [{ type: 'even', message: 'setup.errors.mismatch' }] }]);
      await settle();
      await type('#t-n', '3');
      await submit();
      expect(q('#t-n-error')).not.toBeNull();
      await type('#t-n', '4');
      expect(q('#t-n-error')).toBeNull();
    });

    it('accepte un nouveau type de champ enregistré dans le catalogue', async () => {
      @Component({ selector: 'app-star-field', template: '<b class="star">{{ field().name }}</b>' })
      class StarField extends InputRenderer {}
      TestBed.configureTestingModule({ providers: [provideRouter([]), { provide: Translator, useClass: JsonTranslator }] });
      TestBed.inject(FieldRegistry).register('star', StarField as Type<unknown>);
      fixture = TestBed.createComponent(Host);
      host = fixture.componentInstance;
      host.fields.set([{ type: 'star' as 'text', name: 'rating' }]);
      await settle();
      expect(q('.star')?.textContent).toBe('rating');
    });

    it('signale tout de suite un type de champ ou une règle inconnus (erreur de programmation)', async () => {
      TestBed.configureTestingModule({ providers: [provideRouter([]), { provide: Translator, useClass: JsonTranslator }] });
      const validators = TestBed.inject(ValidatorRegistry);
      expect(() => validators.build({ type: 'text', name: 'x', validators: [{ type: 'inexistante' }] })).toThrow(/inexistante/);
      expect(() => TestBed.inject(FieldRegistry).componentFor('hologramme')).toThrow(/hologramme/);
    });

    it('refuse deux champs de même nom', async () => {
      TestBed.configureTestingModule({ providers: [provideRouter([]), { provide: Translator, useClass: JsonTranslator }] });
      fixture = TestBed.createComponent(Host);
      fixture.componentInstance.fields.set([LOGIN[0], LOGIN[0]]);
      expect(() => fixture.detectChanges()).toThrow(/deux fois/);
    });
  });
});
