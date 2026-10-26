import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { of } from 'rxjs';
import { ApiError } from './core/http/api-error';
import { token } from './core/auth/testing/fake-auth-gateway';
import { SessionService } from './core/auth/session.service';
import { homeGuard } from './core/navigation/home.guard';
import { visibleNavigation, NAVIGATION } from './core/navigation/navigation';
import { DraftStatus } from './core/session/draft-status';
import { IdleService } from './core/session/idle.service';
import { Temporal } from './core/time/temporal';
import { SessionExpiredPage } from './features/auth/session-expired/session-expired.page';
import { DashboardPage, perimeterOf } from './features/dashboard/dashboard.page';
import { ModulePlaceholderPage } from './features/modules/module-placeholder.page';
import { ProfilePage } from './features/profile/profile.page';
import { AuthLayout } from './layouts/auth-layout/auth-layout';
import { InactivityOverlay } from './layouts/context-layout/inactivity-overlay';
import { ShellLayout } from './layouts/shell-layout/shell-layout';
import { initialsOf } from './layouts/shell-layout/user-menu';
import { configureApp, settle, watchMissingKeys } from './testing/app-testing';

const text = (fixture: ComponentFixture<unknown>) => (fixture.nativeElement as HTMLElement).textContent ?? '';
const el = <T extends HTMLElement>(fixture: ComponentFixture<unknown>, selector: string) => (fixture.nativeElement as HTMLElement).querySelector<T>(selector);
const buttonByText = (fixture: ComponentFixture<unknown>, label: string) => [...(fixture.nativeElement as HTMLElement).querySelectorAll('button')].find((b) => b.textContent?.includes(label));

async function type(fixture: ComponentFixture<unknown>, selector: string, value: string): Promise<void> {
  const input = el<HTMLInputElement>(fixture, selector)!;
  input.value = value;
  input.dispatchEvent(new Event('input'));
  fixture.detectChanges();
}

describe('menu de navigation', () => {
  it('montre au médecin son menu complet et aux autres rôles seulement ce qui leur est commun', () => {
    expect(visibleNavigation(NAVIGATION, ['DOCTOR'], []).length).toBe(13);
    expect(visibleNavigation(NAVIGATION, ['CASHIER'], []).map((i) => i.id)).toEqual(['dashboard']);
  });

  it('exige la permission quand une entrée en demande une', () => {
    const items = [{ id: 'x', labelKey: 'nav.reports', icon: 'dashboard' as const, route: '/x', permission: 'files:read:all' }];
    expect(visibleNavigation(items, [], ['files:read:own'])).toEqual([]);
    expect(visibleNavigation(items, [], ['files:read:all'])).toHaveLength(1);
  });

  it("montre à l'administrateur système l'organisation, les sites et la structure, à condition d'en avoir le droit", () => {
    const granted = ['administration.organization:read', 'administration.facilities:read', 'administration.structure:read'];
    expect(visibleNavigation(NAVIGATION, ['SYSTEM_ADMIN'], granted).map((i) => i.id)).toEqual(['dashboard', 'admin-organization', 'admin-sites', 'admin-structure']);
    expect(visibleNavigation(NAVIGATION, ['SYSTEM_ADMIN'], ['administration.facilities:read']).map((i) => i.id)).toEqual(['dashboard', 'admin-sites']);
    expect(visibleNavigation(NAVIGATION, ['DOCTOR'], granted).some((i) => i.id.startsWith('admin-'))).toBe(false);
  });
});

describe("accueil de l'administrateur système", () => {
  const home = () => TestBed.runInInjectionContext(() => homeGuard({} as never, {} as never));

  it("l'envoie sur l'écran Organisation, faute de patients à suivre", () => {
    configureApp({ roles: ['SYSTEM_ADMIN'], permissions: ['administration.organization:read'] });
    expect(String(home())).toBe('/admin/organization');
  });

  it('laisse le tableau de bord à qui cumule un rôle clinique', () => {
    configureApp({ roles: ['SYSTEM_ADMIN', 'DOCTOR'], permissions: ['administration.organization:read'] });
    expect(home()).toBe(true);
  });

  it("laisse le tableau de bord à qui n'a pas le droit de lire l'organisation", () => {
    configureApp({ roles: ['SYSTEM_ADMIN'], permissions: [] });
    expect(home()).toBe(true);
  });
});

describe('initiales', () => {
  it.each([
    ['marie.curie', 'MC'],
    ['amina', 'AM'],
    ['jean-paul_ii', 'JP'],
    ['', '?'],
  ])('%s → %s', (username, expected) => expect(initialsOf(username || '?')).toBe(expected));
});

describe('périmètre du rôle', () => {
  it('retient la portée la plus large des permissions', () => {
    expect(perimeterOf(['files:read:own', 'files.clinical:read:department'])).toBe('department');
    expect(perimeterOf(['files:read:all'])).toBe('all');
    expect(perimeterOf(['files:read'])).toBe('all');
    expect(perimeterOf(['files:read:own'])).toBe('own');
  });
});

describe('SessionExpiredPage', () => {
  let fixture: ComponentFixture<SessionExpiredPage>;
  let navigate: ReturnType<typeof vi.spyOn>;

  async function setup(returnUrl: string | null) {
    const { i18n } = configureApp({
      signedIn: false,
      providers: [{ provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: convertToParamMap(returnUrl ? { returnUrl } : {}) } } }],
    });
    const missing = watchMissingKeys(i18n);
    navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    fixture = TestBed.createComponent(SessionExpiredPage);
    await settle(fixture);
    return missing;
  }

  it("explique l'expiration et rassure : titre, avertissement, page conservée", async () => {
    const missing = await setup('/patients/42');
    expect(text(fixture)).toContain('Reconnectez-vous pour continuer');
    expect(text(fixture)).toContain('Votre session a expiré');
    expect(text(fixture)).toContain('Votre page a été conservée');
    expect(missing()).toEqual([]);
  });

  it("n'affirme un brouillon enregistré que s'il y en a un", async () => {
    await setup(null);
    expect(text(fixture)).not.toContain('Brouillon enregistré');
    TestBed.inject(DraftStatus).markSaved(Temporal.Instant.from('2026-10-24T09:42:00Z'));
    await settle(fixture);
    expect(text(fixture)).toContain('✓ Brouillon enregistré · 24 oct. 2026 à ');
  });

  it("« Se reconnecter » reprend la page demandée ; « autre compte » l'oublie", async () => {
    await setup('/patients/42');
    buttonByText(fixture, 'Se reconnecter')!.click();
    expect(navigate).toHaveBeenLastCalledWith(['/login'], { queryParams: { returnUrl: '/patients/42' } });
    buttonByText(fixture, 'Utiliser un autre compte')!.click();
    expect(navigate).toHaveBeenLastCalledWith(['/login'], { queryParams: {} });
  });

  it('refuse une adresse de retour externe', async () => {
    await setup('//evil.example');
    buttonByText(fixture, 'Se reconnecter')!.click();
    expect(navigate).toHaveBeenLastCalledWith(['/login'], { queryParams: {} });
  });
});

describe('DashboardPage', () => {
  it("affiche la vue du jour, le périmètre du rôle et l'activité (données d'exemple)", async () => {
    const { i18n } = configureApp({ roles: ['DOCTOR'], permissions: ['files.clinical:read:department'] });
    const missing = watchMissingKeys(i18n);
    const fixture = TestBed.createComponent(DashboardPage);
    await settle(fixture);
    const content = text(fixture);
    expect(content).toContain('Mon espace de travail');
    expect(content).toContain('Vue du 24 oct. 2026');
    expect(content).toContain('Médecin');
    expect(content).toContain('Consultations du jour');
    expect(content).toContain('Patients avec relation de soin · Mon service');
    expect(content).toContain('Verrouillé : Administration des rôles');
    expect(content).toContain('09:30 · Évelyne Ndom');
    expect(content).toContain('Mon profil et ma sécurité');
    expect(missing()).toEqual([]);
  });

  it("ne dit pas « verrouillé » à qui administre les rôles", async () => {
    configureApp({ roles: ['SYSTEM_ADMIN'], permissions: ['iam.roles:manage:all'] });
    const fixture = TestBed.createComponent(DashboardPage);
    await settle(fixture);
    expect(text(fixture)).not.toContain('Verrouillé');
    expect(text(fixture)).toContain('Tous les patients de l’établissement');
  });
});

describe('ProfilePage', () => {
  let fixture: ComponentFixture<ProfilePage>;

  async function setup() {
    const { i18n } = configureApp({ roles: ['DOCTOR'] });
    const missing = watchMissingKeys(i18n);
    fixture = TestBed.createComponent(ProfilePage);
    await settle(fixture);
    return missing;
  }

  it('reprend l’e-mail de la session dans des champs « encadrés » (étiquette dans le cadre)', async () => {
    const missing = await setup();
    expect(el<HTMLInputElement>(fixture, '#profile-email')?.value).toBe('marie.curie@hopital.test');
    expect(el(fixture, 'label[for="profile-fullName"]')?.textContent?.trim()).toBe('Nom complet *');
    expect(el(fixture, 'label[for="profile-fullName"]')?.className).toContain('text-xs'); // apparence « boxed »
    expect(missing()).toEqual([]);
  });

  it("le bouton « Enregistrer » est hors du formulaire mais l'envoie (attribut form)", async () => {
    await setup();
    const save = buttonByText(fixture, 'Enregistrer le profil')!;
    expect(save.getAttribute('form')).toBe('profile');
    expect(save.closest('form')?.id).toBe('profile-actions');
  });

  it('exige le nom, valide le téléphone, puis annonce honnêtement que rien n’est encore enregistré', async () => {
    await setup();
    el<HTMLFormElement>(fixture, 'form#profile')!.dispatchEvent(new Event('submit'));
    await settle(fixture);
    expect(el(fixture, '#profile-fullName-error')).not.toBeNull();
    expect(text(fixture)).not.toContain('Enregistrement pas encore disponible');

    await type(fixture, '#profile-fullName', 'Dr Amina Essomba');
    await type(fixture, '#profile-phone', 'pas un numéro');
    el<HTMLFormElement>(fixture, 'form#profile')!.dispatchEvent(new Event('submit'));
    await settle(fixture);
    expect(el(fixture, '#profile-phone-error')?.textContent).toContain('numéro valide');

    await type(fixture, '#profile-phone', '+237 6 77 40 18 62');
    el<HTMLFormElement>(fixture, 'form#profile')!.dispatchEvent(new Event('submit'));
    await settle(fixture);
    expect(text(fixture)).toContain('Enregistrement pas encore disponible');
  });

  it('« Annuler » remet le formulaire à son état initial', async () => {
    await setup();
    await type(fixture, '#profile-fullName', 'Quelqu’un');
    buttonByText(fixture, 'Annuler')!.click();
    await settle(fixture);
    expect(el<HTMLInputElement>(fixture, '#profile-fullName')?.value).toBe('');
    expect(el<HTMLInputElement>(fixture, '#profile-email')?.value).toBe('marie.curie@hopital.test');
  });
});

describe('ModulePlaceholderPage', () => {
  it("porte le nom du module du menu et dit qu'il arrive", async () => {
    configureApp({ providers: [{ provide: ActivatedRoute, useValue: { paramMap: of(convertToParamMap({ module: 'agenda' })) } }] });
    const fixture = TestBed.createComponent(ModulePlaceholderPage);
    await settle(fixture);
    expect(text(fixture)).toContain('Mon agenda');
    expect(text(fixture)).toContain('disponible prochainement');
  });
});

describe('AuthLayout', () => {
  it('affiche le panneau de confiance, les quatre engagements numérotés, la ligne de vie et la date du jour', async () => {
    const { i18n } = configureApp({ signedIn: false });
    const missing = watchMissingKeys(i18n);
    const fixture = TestBed.createComponent(AuthLayout);
    await settle(fixture);
    const content = text(fixture);
    expect(content).toContain('Les soins, en toute sécurité');
    expect(content).toContain('Authentification à deux facteurs');
    expect(content).toContain('04');
    expect(content).toContain('SANJEEVANI EMR');
    expect(content).toContain('24 oct. 2026');
    expect(el(fixture, 'img[src="brand/life-line.svg"]')).not.toBeNull();
    expect(el(fixture, 'img[src="brand/emblem-on-dark.svg"]')).not.toBeNull();
    expect(missing()).toEqual([]);
  });

  it('suit la langue choisie', async () => {
    const { i18n } = configureApp({ signedIn: false });
    const fixture = TestBed.createComponent(AuthLayout);
    await settle(fixture);
    i18n.setLocale('en');
    await settle(fixture);
    expect(text(fixture)).toContain('Care, safely delivered');
  });
});

describe('ShellLayout', () => {
  let fixture: ComponentFixture<ShellLayout>;

  async function setup(roles: string[]) {
    const ctx = configureApp({ roles });
    const missing = watchMissingKeys(ctx.i18n);
    fixture = TestBed.createComponent(ShellLayout);
    await settle(fixture);
    return { ...ctx, missing };
  }

  const links = () => [...(fixture.nativeElement as HTMLElement).querySelectorAll('nav a')].map((a) => a.textContent?.replace(/\s+/g, ' ').trim());

  it('montre au médecin ses 13 entrées et son identité (rôle, établissement)', async () => {
    const { missing } = await setup(['DOCTOR']);
    expect(links()).toHaveLength(13);
    expect(links()).toContain('Hospitalisation (tournées)');
    expect(text(fixture)).toContain('Médecin');
    expect(text(fixture)).toContain('Bonapriso · Douala');
    expect(text(fixture)).toContain('Accès limité à votre rôle');
    expect(text(fixture)).toContain('Votre accès à ce dossier est journalisé. · 24 oct. 2026 · Réseau Sanjeevani / Bonapriso');
    expect(missing()).toEqual([]);
  });

  it("ne montre à une caissière que le tableau de bord : le menu suit le rôle", async () => {
    await setup(['CASHIER']);
    expect(links()).toHaveLength(1);
  });

  it('réduit la navigation en rail d’icônes, retient le choix et le restitue au rechargement', async () => {
    await setup(['DOCTOR']);
    const toggle = buttonByText(fixture, 'Réduire le menu')!;
    expect(el(fixture, 'nav')?.className).not.toContain('md:w-[72px]');
    toggle.click();
    await settle(fixture);
    expect(el(fixture, 'nav')?.className).toContain('md:w-[72px]');
    expect(text(fixture)).toContain('CM'); // sigle de l'établissement
    expect(localStorage.getItem('sanjeevani.nav.collapsed')).toBe('true');
    expect(el(fixture, 'nav a')?.getAttribute('title')).toBe('Tableau de bord'); // infobulle quand seul le pictogramme est visible

    TestBed.resetTestingModule();
    configureApp({ roles: ['DOCTOR'] });
    localStorage.setItem('sanjeevani.nav.collapsed', 'true');
    const reloaded = TestBed.createComponent(ShellLayout);
    await settle(reloaded);
    expect((reloaded.nativeElement as HTMLElement).querySelector('nav')?.className).toContain('md:w-[72px]');
  });

  it('ouvre le menu utilisateur, propose le profil et se ferme à Échap', async () => {
    await setup(['DOCTOR']);
    (el(fixture, 'app-user-menu button') as HTMLButtonElement).click();
    await settle(fixture);
    expect(text(fixture)).toContain('marie.curie@hopital.test');
    expect(text(fixture)).toContain('Mon profil et ma sécurité');
    el(fixture, 'app-user-menu')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    await settle(fixture);
    expect(el(fixture, '[role=menu]')).toBeNull();
  });

  it('« Se déconnecter » du menu ferme la session', async () => {
    await setup(['DOCTOR']);
    const logout = vi.spyOn(TestBed.inject(SessionService), 'logout').mockResolvedValue();
    (el(fixture, 'app-user-menu button') as HTMLButtonElement).click();
    await settle(fixture);
    (el(fixture, '[role=menuitem]:last-child') as HTMLButtonElement).click();
    expect(logout).toHaveBeenCalled();
  });

  it('ouvre le tiroir de navigation sur mobile', async () => {
    await setup(['DOCTOR']);
    expect(el(fixture, 'nav')?.className).toContain('-translate-x-full');
    (el(fixture, 'header button[aria-controls="main-nav"]') as HTMLButtonElement).click();
    await settle(fixture);
    expect(el(fixture, 'nav')?.className).not.toContain('-translate-x-full');
  });
});

describe('InactivityOverlay', () => {
  let fixture: ComponentFixture<InactivityOverlay>;
  let idle: { remainingMs: () => number; remainingRatio: () => number; stayConnected: ReturnType<typeof vi.fn>; signOut: ReturnType<typeof vi.fn> };

  async function setup(remainingMs: number) {
    idle = { remainingMs: () => remainingMs, remainingRatio: () => remainingMs / 60_000, stayConnected: vi.fn().mockResolvedValue(undefined), signOut: vi.fn().mockResolvedValue(undefined) };
    const { i18n } = configureApp({ providers: [{ provide: IdleService, useValue: idle }] });
    const missing = watchMissingKeys(i18n);
    fixture = TestBed.createComponent(InactivityOverlay);
    await settle(fixture);
    return missing;
  }

  it('masque le contexte, annonce « Êtes-vous toujours là ? » et affiche le compte à rebours', async () => {
    const missing = await setup(60_000);
    expect(el(fixture, '[role=alertdialog]')?.getAttribute('aria-modal')).toBe('true');
    expect(text(fixture)).toContain('Êtes-vous toujours là ?');
    expect(text(fixture)).toContain('01:00');
    expect(text(fixture)).toContain('Données masquées pendant l’interruption');
    expect(text(fixture)).not.toContain('Évelyne'); // aucune donnée de santé
    expect(el<HTMLElement>(fixture, '.bg-status-warning')?.style.width).toBe('100%');
    expect(missing()).toEqual([]);
  });

  it('« Rester connecté » et « Se déconnecter » appellent le service', async () => {
    await setup(30_000);
    expect(text(fixture)).toContain('00:30');
    buttonByText(fixture, 'Rester connecté')!.click();
    expect(idle.stayConnected).toHaveBeenCalled();
    buttonByText(fixture, 'Se déconnecter')!.click();
    expect(idle.signOut).toHaveBeenCalled();
  });

  it("rassure sur le brouillon seulement s'il existe", async () => {
    await setup(30_000);
    expect(text(fixture)).not.toContain('Brouillon enregistré');
    TestBed.inject(DraftStatus).markSaved(Temporal.Instant.from('2026-10-24T09:42:00Z'));
    await settle(fixture);
    expect(text(fixture)).toContain('Brouillon enregistré');
    expect(text(fixture)).toContain('sera disponible à votre prochaine connexion');
  });
});
