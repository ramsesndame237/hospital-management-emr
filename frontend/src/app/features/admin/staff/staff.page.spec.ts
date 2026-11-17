import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FakeIdentityAdminGateway } from '../../../core/iam/testing/fake-identity-admin-gateway';
import { IdentityAdminGateway } from '../../../core/iam/identity-admin.gateway';
import { ApiError } from '../../../core/http/api-error';
import { ReceptionGateway } from '../../../core/reception/reception.gateway';
import { StaffGateway } from '../../../core/staff/staff.gateway';
import { FakeStaffGateway } from '../../../core/staff/testing/fake-staff-gateway';
import { configureApp, settle, watchMissingKeys } from '../../../testing/app-testing';
import { StaffPage } from './staff.page';

const MANAGE = ['staff:read', 'staff:manage'];
const SERVICES = [{ id: 's-1', facilityId: 'f-1', code: 'PED', name: 'Pédiatrie' }];

describe('StaffPage (ADM — Personnel)', () => {
  let fixture: ComponentFixture<StaffPage>;
  let staff: FakeStaffGateway;
  let admin: FakeIdentityAdminGateway;
  let missingKeys: () => string[];
  const root = () => fixture.nativeElement as HTMLElement;
  const q = <T extends HTMLElement>(selector: string) => root().querySelector<T>(selector);
  const text = () => root().textContent ?? '';
  const buttonNamed = (label: string) => [...root().querySelectorAll<HTMLButtonElement>('button')].find((b) => (b.getAttribute('aria-label') ?? b.textContent ?? '').includes(label))!;

  async function setup(permissions: readonly string[] = MANAGE, tweak?: (g: FakeStaffGateway) => void) {
    staff = new FakeStaffGateway();
    admin = new FakeIdentityAdminGateway();
    tweak?.(staff);
    const reception = { listServices: () => Promise.resolve(SERVICES) };
    const { i18n } = configureApp({
      roles: ['SYSTEM_ADMIN'],
      permissions,
      providers: [{ provide: StaffGateway, useValue: staff }, { provide: IdentityAdminGateway, useValue: admin }, { provide: ReceptionGateway, useValue: reception }],
    });
    missingKeys = watchMissingKeys(i18n);
    fixture = TestBed.createComponent(StaffPage);
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

  async function choose(selector: string, value: string) {
    const select = q<HTMLSelectElement>(selector)!;
    select.value = value;
    select.dispatchEvent(new Event('change'));
    fixture.detectChanges();
  }

  async function submit(formId: string) {
    q<HTMLFormElement>(`#${formId}`)!.dispatchEvent(new Event('submit'));
    await settle(fixture);
  }

  afterEach(() => expect(missingKeys()).toEqual([]));

  it('liste les fiches avec la profession en toutes lettres et l’état du lien avec un compte', async () => {
    await setup();
    const rows = [...root().querySelectorAll('tbody tr')].map((tr) => tr.textContent);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toContain('Curie Marie');
    expect(rows[0]).toContain('MAT-0042');
    expect(rows[0]).toContain('Médecin');
    expect(rows[0]).toContain('Sans compte');
    expect(rows[1]).toContain('Compte relié');
  });

  it('sans droit de gestion, la liste est en lecture seule', async () => {
    await setup(['staff:read']);
    expect(q('button[aria-label^="Modifier"]')).toBeNull();
    expect(text()).not.toContain('Ajouter une personne');
  });

  it('enregistre une nouvelle fiche et omet les champs facultatifs vides', async () => {
    await setup();
    await click(buttonNamed('Ajouter une personne'));
    await type('#staff-create-staffNumber', 'MAT-0100');
    await type('#staff-create-lastName', 'Diallo');
    await type('#staff-create-firstName', 'Awa');
    await choose('#staff-create-professionCode', 'NURSE');
    await submit('staff-create');
    expect(staff.register).toHaveBeenCalledWith({
      staffNumber: 'MAT-0100', firstName: 'Awa', lastName: 'Diallo', professionCode: 'NURSE', specialtyCode: undefined, email: undefined, phone: undefined, hiredOn: undefined,
    });
  });

  it('relie un compte à une fiche, en proposant seulement les comptes actifs non pris', async () => {
    await setup();
    await click(buttonNamed('Compte de connexion de Marie Curie'));
    const options = [...root().querySelectorAll('#staff-account-st-1-none-userId option')].map((o) => o.textContent);
    expect(options.join(' ')).toContain('marie.curie');
    await choose('#staff-account-st-1-none-userId', 'u-1');
    await submit('staff-account-st-1-none');
    expect(staff.linkAccount).toHaveBeenCalledWith('st-1', 'u-1');
  });

  it('détache le compte déjà relié après avertissement', async () => {
    await setup();
    await click(buttonNamed('Compte de connexion de Paul Martin'));
    expect(text()).toContain('ne verra plus aucun patient');
    await submit('staff-account-st-2-u-9');
    expect(staff.unlinkAccount).toHaveBeenCalledWith('st-2');
  });

  it('affecte à un service, puis termine une affectation en cours', async () => {
    await setup();
    await click(buttonNamed('Affectations de Marie Curie'));
    expect(text()).toContain('Pédiatrie');
    expect(text()).toContain('Depuis le 2026-11-01');
    await choose('#staff-assign-st-1-nodeId', 's-1');
    await submit('staff-assign-st-1');
    expect(staff.assign).toHaveBeenCalledWith('st-1', { nodeId: 's-1', startDate: undefined, primary: false });
    await click(buttonNamed('Terminer l’affectation à Pédiatrie'));
    expect(staff.endAssignment).toHaveBeenCalledWith('as-1');
  });

  it('enregistre un départ', async () => {
    await setup();
    await click(buttonNamed('Enregistrer le départ de Marie Curie'));
    await submit('staff-depart-st-1');
    expect(staff.depart).toHaveBeenCalledWith('st-1', undefined);
  });

  it('affiche le refus du serveur sans détail technique', async () => {
    await setup(MANAGE, (g) => g.depart.mockRejectedValue(new ApiError(503, 'UNKNOWN', 'UPDATE staff failed')));
    await click(buttonNamed('Enregistrer le départ de Marie Curie'));
    await submit('staff-depart-st-1');
    expect(q('aside [role=alert]')?.textContent).toContain('momentanément indisponible');
    expect(text()).not.toContain('UPDATE');
  });
});
