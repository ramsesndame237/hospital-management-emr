import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ApiError } from '../../../core/http/api-error';
import { IdentityAdminGateway } from '../../../core/iam/identity-admin.gateway';
import { FakeIdentityAdminGateway, managedUser } from '../../../core/iam/testing/fake-identity-admin-gateway';
import { ToastService } from '../../../shared/toast/toast.service';
import { configureApp, settle, watchMissingKeys } from '../../../testing/app-testing';
import { UsersPage } from './users.page';

const MANAGE = ['iam.users:read', 'iam.users:manage', 'iam.roles:read'];

describe('UsersPage', () => {
  let fixture: ComponentFixture<UsersPage>;
  let admin: FakeIdentityAdminGateway;
  let missingKeys: () => string[];
  const root = () => fixture.nativeElement as HTMLElement;
  const q = <T extends HTMLElement>(selector: string) => root().querySelector<T>(selector);
  const text = () => root().textContent ?? '';
  const rows = () => [...root().querySelectorAll('tbody tr')].map((tr) => tr.textContent?.replace(/\s+/g, ' ').trim() ?? '');
  const buttonNamed = (label: string) => [...root().querySelectorAll<HTMLButtonElement>('button')].find((b) => (b.getAttribute('aria-label') ?? b.textContent ?? '').trim() === label)!;

  async function setup(permissions: readonly string[] = MANAGE, prepare?: (gateway: FakeIdentityAdminGateway) => void) {
    admin = new FakeIdentityAdminGateway();
    prepare?.(admin);
    const { i18n } = configureApp({ roles: ['SYSTEM_ADMIN'], permissions, profile: { id: 'u-0', username: 'dsi.admin' }, providers: [{ provide: IdentityAdminGateway, useValue: admin }] });
    missingKeys = watchMissingKeys(i18n);
    fixture = TestBed.createComponent(UsersPage);
    await settle(fixture);
  }

  async function click(button: HTMLElement) {
    button.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await settle(fixture);
  }

  async function type(selector: string, value: string) {
    const input = q<HTMLInputElement>(selector)!;
    input.value = value;
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  }

  async function tick(selector: string, checked = true) {
    const box = q<HTMLInputElement>(selector)!;
    box.checked = checked;
    box.dispatchEvent(new Event('change'));
    fixture.detectChanges();
  }

  async function submit(formId: string) {
    q<HTMLFormElement>(`#${formId}`)!.dispatchEvent(new Event('submit'));
    await settle(fixture);
  }

  afterEach(() => expect(missingKeys()).toEqual([]));

  it('liste les comptes avec leurs rôles, leur état et leur double authentification', async () => {
    await setup();
    const list = rows();
    expect(list).toHaveLength(5);
    expect(list[0]).toContain('dsi.admin');
    expect(list[0]).toContain('(vous)');
    expect(list[1]).toContain('marie.curie');
    expect(list[1]).toContain('Médecin');
    expect(list[1]).toContain('Actif');
    expect(list[1]).toContain('Double authentification activée');
    expect(list[2]).toContain('En attente d’activation');
    expect(list[2]).toContain('Double authentification non inscrite');
    expect(list[3]).toContain('Désactivé');
    expect(list[4]).toContain('Verrouillé');
  });

  it('ne propose aucune action de modification sur son propre compte', async () => {
    await setup();
    const own = root().querySelector('tbody tr')!;
    const labels = [...own.querySelectorAll('button')].map((b) => b.getAttribute('aria-label'));
    expect(labels).toEqual(['Droits de dsi.admin']);
  });

  it('crée un compte, exige un rôle, puis affiche le mot de passe provisoire une seule fois', async () => {
    await setup();
    await click(buttonNamed('Créer un utilisateur'));
    await type('#users-create-username', '  pharma.un ');
    await type('#users-create-email', 'pharma@hopital.test');
    await submit('users-create');
    expect(q('aside [role=alert]')?.textContent).toContain('Choisissez au moins un rôle.');
    expect(admin.createUser).not.toHaveBeenCalled();

    await tick('#users-create-role_CASHIER');
    await submit('users-create');
    expect(admin.createUser).toHaveBeenCalledWith({ username: 'pharma.un', email: 'pharma@hopital.test', roles: ['CASHIER'] });
    expect(q('aside h2')?.textContent).toContain('Compte créé');
    expect(text()).toContain('k7Qm2xWvB9nRtE4y');
    expect(text()).toContain('Il ne sera plus affiché');
    expect(admin.listUsers).toHaveBeenCalledTimes(2); // la liste est relue

    await click(buttonNamed('J’ai transmis le mot de passe'));
    expect(q('aside')).toBeNull();
    expect(text()).not.toContain('k7Qm2xWvB9nRtE4y');
  });

  it('signale la mention de double authentification dans les rôles proposés', async () => {
    await setup();
    await click(buttonNamed('Créer un utilisateur'));
    const labels = [...root().querySelectorAll('aside label')].map((l) => l.textContent?.trim());
    expect(labels).toContain('Médecin · double authentification requise');
    expect(labels).toContain('Caissier(ère)');
    expect(labels).toContain('Chef de laboratoire'); // rôle ajouté par l'établissement : nom enregistré
  });

  it('valide l’identifiant et l’adresse avant tout appel', async () => {
    await setup();
    await click(buttonNamed('Créer un utilisateur'));
    await type('#users-create-username', 'a b');
    await type('#users-create-email', 'pas-un-email');
    await tick('#users-create-role_CASHIER');
    await submit('users-create');
    expect(text()).toContain('Identifiant invalide');
    expect(admin.createUser).not.toHaveBeenCalled();
  });

  it('explique le refus d’un identifiant déjà pris et garde la saisie', async () => {
    await setup((MANAGE), (g) => g.createUser.mockRejectedValue(new ApiError(409, 'USER_ALREADY_EXISTS', 'Un compte existe déjà avec cet identifiant ou cet e-mail.')));
    await click(buttonNamed('Créer un utilisateur'));
    await type('#users-create-username', 'marie.curie');
    await type('#users-create-email', 'x@hopital.test');
    await tick('#users-create-role_CASHIER');
    await submit('users-create');
    expect(q('aside [role=alert]')?.textContent).toContain('Un compte existe déjà');
    expect(q<HTMLInputElement>('#users-create-username')?.value).toBe('marie.curie');
  });

  it('remplace les rôles d’un compte, rôles actuels pré-cochés', async () => {
    await setup();
    await click(buttonNamed('Rôles de marie.curie'));
    expect(q<HTMLInputElement>('#users-roles-u-1-role_DOCTOR')?.checked).toBe(true);
    expect(q<HTMLInputElement>('#users-roles-u-1-role_CASHIER')?.checked).toBe(false);
    expect(text()).toContain('Prise d’effet immédiate');
    await tick('#users-roles-u-1-role_CASHIER');
    await submit('users-roles-u-1');
    expect(admin.assignRoles).toHaveBeenCalledWith('u-1', ['DOCTOR', 'CASHIER']);
    expect(TestBed.inject(ToastService).toasts()[0].message).toBe('Rôles de « marie.curie » enregistrés.');
    expect(q('aside')).toBeNull();
  });

  it('refuse de retirer tous les rôles', async () => {
    await setup();
    await click(buttonNamed('Rôles de marie.curie'));
    await tick('#users-roles-u-1-role_DOCTOR', false);
    await submit('users-roles-u-1');
    expect(text()).toContain('Choisissez au moins un rôle.');
    expect(admin.assignRoles).not.toHaveBeenCalled();
  });

  it('demande confirmation avant de désactiver un compte', async () => {
    await setup();
    await click(buttonNamed('Désactiver marie.curie'));
    expect(text()).toContain('Ce compte ne pourra plus se connecter');
    expect(text()).toContain('journal d’audit');
    expect(admin.setActive).not.toHaveBeenCalled();
    await submit('users-disable-u-1');
    expect(admin.setActive).toHaveBeenCalledWith('u-1', false);
  });

  it('réactive un compte désactivé et déverrouille un compte verrouillé en un clic', async () => {
    await setup();
    await click(buttonNamed('Réactiver ancien.agent'));
    expect(admin.setActive).toHaveBeenCalledWith('u-3', true);
    await click(buttonNamed('Déverrouiller agent.verrouille'));
    expect(admin.unlock).toHaveBeenCalledWith('u-4');
    expect(admin.listUsers).toHaveBeenCalledTimes(3);
  });

  it('n’offre « Déverrouiller » qu’aux comptes verrouillés et « Réinitialiser » qu’à ceux qui ont une double authentification', async () => {
    await setup();
    expect(root().querySelectorAll('[aria-label^="Déverrouiller"]')).toHaveLength(1);
    expect(buttonNamed('Réinitialiser la double authentification de paul.caissier')).toBeUndefined();
    expect(buttonNamed('Réinitialiser la double authentification de marie.curie')).toBeDefined();
  });

  it('demande confirmation avant de réinitialiser la double authentification', async () => {
    await setup();
    await click(buttonNamed('Réinitialiser la double authentification de marie.curie'));
    expect(text()).toContain('devra réinscrire sa double authentification');
    await submit('users-reset-u-1');
    expect(admin.resetMfa).toHaveBeenCalledWith('u-1');
  });

  it('affiche le refus du serveur sans détail technique', async () => {
    await setup(MANAGE, (g) => g.setActive.mockRejectedValue(new ApiError(503, 'UNKNOWN', 'UPDATE iam_users failed')));
    await click(buttonNamed('Désactiver marie.curie'));
    await submit('users-disable-u-1');
    expect(q('aside [role=alert]')?.textContent).toContain('momentanément indisponible');
    expect(text()).not.toContain('UPDATE');
  });

  it('montre les droits effectifs d’un compte, groupés par ressource', async () => {
    await setup();
    await click(buttonNamed('Droits de marie.curie'));
    expect(admin.access).toHaveBeenCalledWith('u-1');
    expect(q('aside h2')?.textContent).toContain('Droits de marie.curie');
    expect(text()).toContain('files.clinical');
    expect(text()).toContain('read (son service), write (son service)');
    expect(text()).toContain('appointments');
    expect(text()).toContain('read (les siens)');
    expect(text()).toContain('1 service(s)');
    await click(buttonNamed('Fermer'));
    expect(q('aside')).toBeNull();
  });

  it('dit qu’un compte désactivé n’a plus aucun droit', async () => {
    await setup(MANAGE, (g) => g.access.mockResolvedValue({ userId: 'u-3', username: 'ancien.agent', active: false, roles: [], permissions: ['x:read'], departments: [] }));
    await click(buttonNamed('Droits de ancien.agent'));
    expect(text()).toContain('Compte désactivé : plus aucun droit.');
  });

  it('pagine la liste', async () => {
    const many = Array.from({ length: 60 }, (_, i) => managedUser({ id: `m-${i}`, username: `agent.${i}`, email: `a${i}@h.test` }));
    await setup(MANAGE, (g) => (g.users = many));
    expect(rows()).toHaveLength(25);
    expect(text()).toContain('1 à 25 sur 60');
    expect(buttonNamed('Précédent').disabled).toBe(true);
    await click(buttonNamed('Suivant'));
    expect(admin.listUsers).toHaveBeenLastCalledWith(25, 25);
    expect(text()).toContain('26 à 50 sur 60');
    await click(buttonNamed('Suivant'));
    expect(text()).toContain('51 à 60 sur 60');
    expect(buttonNamed('Suivant').disabled).toBe(true);
  });

  it('reste en lecture seule sans le droit de gérer les comptes', async () => {
    await setup(['iam.users:read', 'iam.roles:read']);
    expect(buttonNamed('Créer un utilisateur')).toBeUndefined();
    const labels = [...root().querySelectorAll('tbody button')].map((b) => b.getAttribute('aria-label') ?? '');
    expect(labels.every((l) => l.startsWith('Droits de'))).toBe(true);
  });

  it('continue de libeller les rôles quand leur lecture est refusée', async () => {
    await setup(['iam.users:read', 'iam.users:manage'], (g) => g.roles.mockRejectedValue(new ApiError(403, 'FORBIDDEN', 'Vous n’avez pas le droit d’effectuer cette action.')));
    expect(rows()[1]).toContain('Médecin'); // catalogue de l'interface
    expect(buttonNamed('Créer un utilisateur')).toBeUndefined(); // sans rôles à proposer, pas de création
  });

  it('signale une lecture impossible', async () => {
    await setup(MANAGE, (g) => g.listUsers.mockRejectedValue(new ApiError(0, 'NETWORK', 'Http failure')));
    expect(q('[role=alert]')?.textContent).toContain('connexion réseau a été interrompue');
  });
});
