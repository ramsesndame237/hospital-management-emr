import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ApiError } from '../../../core/http/api-error';
import { ReceptionGateway } from '../../../core/reception/reception.gateway';
import { FakeReceptionGateway, admission, appointment, page, practitioner, summary } from '../../../core/reception/testing/fake-reception-gateway';
import { Clock } from '../../../core/time/clock';
import { Temporal } from '../../../core/time/temporal';
import { configureApp, settle, watchMissingKeys } from '../../../testing/app-testing';
import { AgendaPage } from './agenda.page';
import { dayRange, localDate, localTime, toInstantIso } from './agenda-time';

const RECEPTION = ['appointments:read:all', 'appointments:write:all', 'admissions:write:all', 'patients:read'];

function textOf(el: Element | null): string {
  if (!el) return '';
  const parts: string[] = [];
  const walker = el.ownerDocument.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) parts.push(node.textContent ?? '');
  return parts.join(' ').replace(/\s+/g, ' ').trim();
}

describe('AgendaPage', () => {
  let fixture: ComponentFixture<AgendaPage>;
  let reception: FakeReceptionGateway;
  let missingKeys: () => string[];
  let today: string;
  const root = () => fixture.nativeElement as HTMLElement;
  const q = <T extends HTMLElement>(selector: string) => root().querySelector<T>(selector);
  const text = () => textOf(root());
  const buttonNamed = (label: string) => [...root().querySelectorAll<HTMLButtonElement>('button')].find((b) => (b.getAttribute('aria-label') ?? b.textContent ?? '').trim() === label);
  const nextDay = () => {
    const d = new Date(`${today}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() + 1);
    return d.toISOString().slice(0, 10);
  };

  async function setup(options: { permissions?: readonly string[]; prepare?: (g: FakeReceptionGateway) => void } = {}) {
    reception = new FakeReceptionGateway();
    options.prepare?.(reception);
    const { i18n } = configureApp({ roles: ['RECEPTIONIST'], permissions: options.permissions ?? RECEPTION, providers: [{ provide: ReceptionGateway, useValue: reception }] });
    missingKeys = watchMissingKeys(i18n);
    today = localDate(TestBed.inject(Clock).now());
    fixture = TestBed.createComponent(AgendaPage);
    await settle(fixture);
  }

  async function click(button: HTMLElement | undefined) {
    button!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await settle(fixture);
  }

  async function type(selector: string, value: string) {
    const input = q<HTMLInputElement>(selector)!;
    input.value = value;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await settle(fixture);
  }

  async function choose(selector: string, value: string) {
    const select = q<HTMLSelectElement>(selector)!;
    select.value = value;
    select.dispatchEvent(new Event('change', { bubbles: true }));
    await settle(fixture);
  }

  async function submit(formId: string) {
    q<HTMLFormElement>(`#${formId}`)!.dispatchEvent(new Event('submit'));
    await settle(fixture);
  }

  afterEach(() => expect(missingKeys()).toEqual([]));

  describe('liste', () => {
    it('charge les rendez-vous du jour (de minuit à minuit, dans le fuseau de l\'utilisateur) avec créneau, patient, professionnel, service et statut', async () => {
      await setup();
      const range = dayRange(today)!;
      expect(reception.listAppointments).toHaveBeenCalledWith({ from: range.from, to: range.to }, 0, 50);
      const row = textOf(q('[data-test="RDV-0000045"]'));
      expect(row).toContain(`${localTime(Temporal.Instant.from('2026-10-24T09:00:00Z'))} – ${localTime(Temporal.Instant.from('2026-10-24T09:30:00Z'))}`);
      expect(row).toContain('RDV-0000045');
      expect(row).toContain('Mbarga Élisabeth');
      expect(row).toContain('PAT-0000001');
      expect(row).toContain('Curie Marie');
      expect(row).toContain('Pédiatrie');
      expect(row).toContain('À venir');
    });

    it('change de jour, de service ou de statut en rechargeant l\'agenda', async () => {
      await setup();
      const day = nextDay();
      reception.listAppointments.mockClear();
      await type('#agenda-filter-date', day);
      const range = dayRange(day)!;
      expect(reception.listAppointments).toHaveBeenLastCalledWith({ from: range.from, to: range.to }, 0, 50);
      await choose('#agenda-filter-serviceId', 'svc-ped');
      expect(reception.listAppointments).toHaveBeenLastCalledWith({ from: range.from, to: range.to, serviceId: 'svc-ped' }, 0, 50);
      await choose('#agenda-filter-status', 'NO_SHOW');
      expect(reception.listAppointments).toHaveBeenLastCalledWith({ from: range.from, to: range.to, serviceId: 'svc-ped', status: 'NO_SHOW' }, 0, 50);
    });

    it('ignore une date mal écrite ou inexistante', async () => {
      await setup();
      reception.listAppointments.mockClear();
      await type('#agenda-filter-date', '2026-13-45');
      await type('#agenda-filter-date', '24/10/2026');
      expect(reception.listAppointments).not.toHaveBeenCalled();
    });

    it('dit quand il n\'y a aucun rendez-vous, montre le motif d\'une annulation et ne propose aucune action sur un rendez-vous clos', async () => {
      await setup({ prepare: (g) => g.listAppointments.mockResolvedValue(page([appointment({ status: 'CANCELLED', cancellationReason: 'Demande du patient' }), appointment({ id: 'rdv-2', number: 'RDV-0000046', status: 'ARRIVED' })])) });
      expect(textOf(q('[data-test="RDV-0000045"]'))).toContain('Demande du patient');
      expect(textOf(q('[data-test="RDV-0000046"]'))).toContain('Arrivé');
      expect(buttonNamed('Annuler le rendez-vous RDV-0000045')).toBeUndefined();
      expect(buttonNamed('Annuler le rendez-vous RDV-0000046')).toBeUndefined();
    });

    it('n\'offre aucune action sans le droit d\'écrire', async () => {
      await setup({ permissions: ['appointments:read:department'] });
      expect(buttonNamed('Nouveau rendez-vous')).toBeUndefined();
      expect(buttonNamed('Annuler le rendez-vous RDV-0000045')).toBeUndefined();
    });

    it('signale une erreur de chargement', async () => {
      await setup({ prepare: (g) => g.listAppointments.mockRejectedValue(new ApiError(403, 'FORBIDDEN', 'Accès refusé.')) });
      expect(q('[role=alert]')?.textContent).toContain('Accès refusé');
    });
  });

  describe('arrivée et absence', () => {
    it('enregistre l\'arrivée : l\'admission honore le rendez-vous et l\'agenda se recharge', async () => {
      await setup({ prepare: (g) => g.openAdmission.mockResolvedValue(admission({ number: 'ADM-0000046' })) });
      reception.listAppointments.mockClear();
      await click(buttonNamed('Enregistrer l’arrivée du patient du rendez-vous RDV-0000045'));
      expect(reception.openAdmission).toHaveBeenCalledWith({ patientId: 'p-1', type: 'OUTPATIENT', appointmentId: 'rdv-1' });
      expect(reception.listAppointments).toHaveBeenCalledTimes(1);
    });

    it('n\'offre pas l\'arrivée sans le droit d\'ouvrir une admission', async () => {
      await setup({ permissions: ['appointments:read:all', 'appointments:write:all'] });
      expect(buttonNamed('Enregistrer l’arrivée du patient du rendez-vous RDV-0000045')).toBeUndefined();
      expect(buttonNamed('Constater l’absence du patient du rendez-vous RDV-0000045')).toBeDefined();
    });

    it('affiche le refus du serveur pour une arrivée', async () => {
      await setup({ prepare: (g) => g.openAdmission.mockRejectedValue(new ApiError(409, 'ADMISSION_APPOINTMENT_ALREADY_USED', 'Ce rendez-vous a déjà été honoré.')) });
      await click(buttonNamed('Enregistrer l’arrivée du patient du rendez-vous RDV-0000045'));
      expect(q('[role=alert]')?.textContent).toContain('déjà été honoré');
    });

    it('constate l\'absence, ou affiche le refus quand le créneau n\'a pas commencé', async () => {
      await setup();
      await click(buttonNamed('Constater l’absence du patient du rendez-vous RDV-0000045'));
      expect(reception.markNoShow).toHaveBeenCalledWith('rdv-1');
      reception.markNoShow.mockRejectedValue(new ApiError(409, 'APPOINTMENT_NOT_STARTED', 'Le créneau n’a pas encore commencé.'));
      await click(buttonNamed('Constater l’absence du patient du rendez-vous RDV-0000045'));
      expect(q('[role=alert]')?.textContent).toContain('n’a pas encore commencé');
    });
  });

  describe('annulation et déplacement', () => {
    it('annule avec un motif obligatoire', async () => {
      await setup();
      await click(buttonNamed('Annuler le rendez-vous RDV-0000045'));
      expect(q('aside h2')?.textContent).toContain('Annuler RDV-0000045');
      await submit('agenda-cancel');
      expect(reception.cancelAppointment).not.toHaveBeenCalled();
      expect(text()).toContain('Le motif est obligatoire.');
      await type('#agenda-cancel-reason', '  Demande du patient ');
      await submit('agenda-cancel');
      expect(reception.cancelAppointment).toHaveBeenCalledWith('rdv-1', 'Demande du patient');
      expect(q('aside')).toBeNull();
    });

    it('déplace le rendez-vous vers un autre jour et une autre heure, convertis en instant', async () => {
      await setup();
      await click(buttonNamed('Déplacer le rendez-vous RDV-0000045'));
      expect(q<HTMLInputElement>('#agenda-move-time')!.value).toMatch(/^\d{2}:\d{2}$/);
      await type('#agenda-move-date', '2026-11-03');
      await type('#agenda-move-time', '10:30');
      await choose('#agenda-move-duration', '45');
      await submit('agenda-move');
      expect(reception.rescheduleAppointment).toHaveBeenCalledWith('rdv-1', { startsAt: toInstantIso('2026-11-03', '10:30'), durationMinutes: 45 });
    });

    it('refuse une heure mal écrite sans appeler le serveur, et affiche un refus du serveur', async () => {
      await setup({ prepare: (g) => g.rescheduleAppointment.mockRejectedValue(new ApiError(409, 'APPOINTMENT_PRACTITIONER_BUSY', 'Le professionnel a déjà un rendez-vous à ce moment.')) });
      await click(buttonNamed('Déplacer le rendez-vous RDV-0000045'));
      await type('#agenda-move-time', '25:99');
      await submit('agenda-move');
      expect(text()).toContain('Saisissez l’heure au format HH:MM');
      expect(reception.rescheduleAppointment).not.toHaveBeenCalled();
      await type('#agenda-move-time', '11:00');
      await submit('agenda-move');
      expect(q('aside [role=alert]')?.textContent).toContain('déjà un rendez-vous');
    });
  });

  describe('prise de rendez-vous', () => {
    async function pickPatient() {
      await click(buttonNamed('Nouveau rendez-vous'));
      await type('#agenda-patient-search', 'mbarga');
      await click(q('[data-test="pick-PAT-0000001"]')!);
    }

    it('cherche et choisit le patient, charge les professionnels du service choisi, puis prend le rendez-vous', async () => {
      await setup({ prepare: (g) => g.listPractitioners.mockResolvedValue([practitioner(), practitioner({ id: 'st-2', staffNumber: 'D-PED2', lastName: 'Pasteur', firstName: 'Louis' })]) });
      await pickPatient();
      expect(reception.searchPatients).toHaveBeenCalledWith({ q: 'mbarga' }, 0, 8);
      expect(textOf(q('[data-test=picked]'))).toContain('Mbarga Élisabeth');
      await choose('#agenda-book-serviceId', 'svc-ped');
      expect(reception.listPractitioners).toHaveBeenCalledWith('svc-ped');
      expect([...q<HTMLSelectElement>('#agenda-book-practitionerId')!.options].map((o) => o.text.trim())).toContain('Pasteur Louis (D-PED2)');
      await choose('#agenda-book-practitionerId', 'st-2');
      await type('#agenda-book-date', '2026-11-03');
      await type('#agenda-book-time', '09:30');
      await submit('agenda-book');
      expect(reception.scheduleAppointment).toHaveBeenCalledWith({
        patientId: 'p-1', practitionerId: 'st-2', locationId: 'svc-ped', startsAt: toInstantIso('2026-11-03', '09:30'), durationMinutes: 30,
      });
      expect(q('aside')).toBeNull();
    });

    it('exige un patient avant de prendre le rendez-vous', async () => {
      await setup();
      await click(buttonNamed('Nouveau rendez-vous'));
      await choose('#agenda-book-serviceId', 'svc-ped');
      await choose('#agenda-book-practitionerId', 'st-1');
      await type('#agenda-book-time', '09:30');
      await submit('agenda-book');
      expect(text()).toContain('Choisissez le patient du rendez-vous.');
      expect(reception.scheduleAppointment).not.toHaveBeenCalled();
    });

    it('permet de changer de patient et ne cherche pas sous deux caractères', async () => {
      await setup({ prepare: (g) => g.searchPatients.mockResolvedValue(page([summary()])) });
      await click(buttonNamed('Nouveau rendez-vous'));
      await type('#agenda-patient-search', 'm');
      expect(reception.searchPatients).not.toHaveBeenCalled();
      await type('#agenda-patient-search', 'mbarga');
      await click(q('[data-test="pick-PAT-0000001"]')!);
      await click(buttonNamed('Changer'));
      expect(q('[data-test=picked]')).toBeNull();
      expect(q('#agenda-patient-search')).not.toBeNull();
    });

    it('affiche le refus du serveur sans fermer le panneau', async () => {
      await setup({ prepare: (g) => g.scheduleAppointment.mockRejectedValue(new ApiError(409, 'APPOINTMENT_PRACTITIONER_NOT_ASSIGNED', 'Le professionnel n’est pas affecté à ce service ce jour-là.')) });
      await pickPatient();
      await choose('#agenda-book-serviceId', 'svc-ped');
      await choose('#agenda-book-practitionerId', 'st-1');
      await type('#agenda-book-time', '09:30');
      await submit('agenda-book');
      expect(q('aside [role=alert]')?.textContent).toContain('pas affecté');
      expect(q('aside')).not.toBeNull();
    });
  });
});
