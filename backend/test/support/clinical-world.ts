import { generateSync } from 'otplib';
import request from 'supertest';
import { createTestWorld, TOTP_SECRET, TestWorld } from '../iam/e2e-app';

const PWD = 'une phrase de passe solide';
export const api = (path: string) => `/api/v1${path}`;

export interface ClinicalWorld {
  w: TestWorld;
  /** Jetons d'accès par profil : admin, accueil, medecin (service PED), infirmier (service CHI), comptable, caisse, labo (technicien de laboratoire), patient. */
  token: Record<string, string>;
  http: () => request.Agent;
  bearer: (who: string) => { Authorization: string };
  ids: {
    facility: string;
    /** Services PED (pédiatrie) et CHI (chirurgie), avec leur unité. */
    ped: string; chi: string; pedUnit: string; chiUnit: string;
    /** Lits : B1 et B2 en pédiatrie, B1 en chirurgie. */
    pedBed1: string; pedBed2: string; chiBed1: string;
    /** Fiches du personnel : médecin de PED (compte `medecin`), infirmier de CHI (compte `infirmier`), médecin de CHI, médecin affecté nulle part. */
    docPed: string; nurseChi: string; docChi: string; docNowhere: string;
    patients: string[];
  };
  close: () => Promise<void>;
}

/**
 * Établissement complet, construit par l'API comme en production : organisation, deux services avec unité, salle et lits, personnel
 * affecté, comptes reliés aux fiches (donc périmètre « service »), et trois patients.
 */
export async function buildClinicalWorld(): Promise<ClinicalWorld> {
  const w = await createTestWorld();
  const http = () => request(w.app.getHttpServer());
  const token: Record<string, string> = {};
  const bearer = (who: string) => ({ Authorization: `Bearer ${token[who]}` });
  const accounts: [string, string, boolean][] = [
    ['admin', 'SYSTEM_ADMIN', true], ['accueil', 'RECEPTIONIST', false], ['medecin', 'DOCTOR', true], ['infirmier', 'NURSE', true], ['comptable', 'ACCOUNTANT', false], ['caisse', 'CASHIER', false], ['labo', 'LAB_TECHNICIAN', true], ['labo2', 'LAB_TECHNICIAN', true], ['patient', 'PATIENT', false],
  ];
  const userIds: Record<string, string> = {};
  for (const [username, role, mfa] of accounts) userIds[username] = (await w.seed({ username, password: PWD, roles: [role], mfa })).id.value;
  for (const [username, , mfa] of accounts) {
    const res = await http().post(api('/auth/login')).send({ username, password: PWD, ...(mfa ? { totpCode: generateSync({ secret: TOTP_SECRET }) } : {}) }).expect(200);
    token[username] = res.body.accessToken as string;
  }
  const post = async (path: string, body: object, who = 'admin', expected = 201) => (await http().post(api(path)).set(bearer(who)).send(body).expect(expected)).body;

  await http().put(api('/organization')).set(bearer('admin')).send({ name: 'Hôpital' }).expect(200);
  const facility = (await post('/facilities', { name: 'Site', code: 'A1B2-abc-01' })).id as string;
  const service = async (code: string, name: string) => (await post(`/facilities/${facility}/services`, { code, name, serviceType: 'CLINICAL' })).id as string;
  const child = async (parent: string, code: string, name: string) => (await post(`/structure/${parent}/children`, { code, name })).id as string;
  const ped = await service('PED', 'Pédiatrie');
  const chi = await service('CHI', 'Chirurgie');
  const pedUnit = await child(ped, 'U1', 'Unité pédiatrie');
  const chiUnit = await child(chi, 'U1', 'Unité chirurgie');
  const pedRoom = await child(pedUnit, 'R1', 'Salle 1');
  const chiRoom = await child(chiUnit, 'R1', 'Salle 1');
  const pedBed1 = await child(pedRoom, 'B1', 'Lit 1');
  const pedBed2 = await child(pedRoom, 'B2', 'Lit 2');
  const chiBed1 = await child(chiRoom, 'B1', 'Lit 1');

  const staff = async (number: string, last: string, node: string | null, account?: string) => {
    const id = (await post('/staff', { staffNumber: number, firstName: 'Doc', lastName: last, professionCode: number.startsWith('N') ? 'NURSE' : 'DOCTOR', hiredOn: '2019-01-01' })).id as string;
    if (node) await post(`/staff/${id}/assignments`, { nodeId: node, startDate: '2020-01-01' });
    if (account) await http().put(api(`/staff/${id}/account`)).set(bearer('admin')).send({ userId: userIds[account] }).expect(200);
    return id;
  };
  const docPed = await staff('D-PED', 'Curie', ped, 'medecin');
  const nurseChi = await staff('N-CHI', 'Abel', chi, 'infirmier');
  const docChi = await staff('D-CHI', 'Pasteur', chi);
  const docNowhere = await staff('D-NOWHERE', 'Errant', null);

  const patients: string[] = [];
  for (const [last, first] of [['Mbarga', 'Élisabeth'], ['Ndongo', 'Paul'], ['Nkoa', 'Samuel']]) {
    patients.push((await post('/patients', { lastName: last, firstName: first, sex: 'FEMALE', birthDate: '1990-03-14', phone: `+237 6${patients.length}5 00 00 00` }, 'accueil')).id as string);
  }
  return {
    w, token, http, bearer,
    ids: { facility, ped, chi, pedUnit, chiUnit, pedBed1, pedBed2, chiBed1, docPed, nurseChi, docChi, docNowhere, patients },
    close: () => w.close(),
  };
}
