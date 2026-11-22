// Données de démonstration du pilote : de quoi parcourir TOUTES les fonctions de l'application avec les comptes du bac à sable.
//
//   Terminal 1 :  npm run playground          (API complète sur une base en mémoire, http://localhost:3100)
//   Terminal 2 :  npm run demo:pilot          (peuple le bac à sable ; relançable seulement sur un bac à sable neuf)
//
// Le scénario s'exécute sur le bac à sable (données en mémoire) : rien n'est écrit dans une vraie base. NE PAS le lancer sur une installation réelle :
// il utilise les comptes publics du bac à sable (voir tools/playground.ts).
const BASE = process.env.API ?? 'http://localhost:3100';
const PASSWORD = process.env.DEMO_PASSWORD ?? 'Demo-Passw0rd-2026';
const day = (offset) => new Date(Date.now() + offset * 86_400_000).toISOString().slice(0, 10);

async function login(username, mfa) {
  const body = { username, password: PASSWORD };
  if (mfa) body.totpCode = (await (await fetch(`${BASE}/dev/totp`)).json()).code;
  const res = await fetch(`${BASE}/api/v1/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  if (!res.ok) throw new Error(`connexion de ${username} refusée (${res.status})`);
  return (await res.json()).accessToken;
}

const as = (token) => async (method, path, body, allowed = [200, 201]) => {
  const res = await fetch(`${BASE}/api/v1${path}`, { method, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await res.text();
  const json = text ? JSON.parse(text) : null;
  if (!allowed.includes(res.status)) throw new Error(`${method} ${path} -> ${res.status} ${text.slice(0, 240)}`);
  return json;
};

const step = (text) => console.log(`\n▸ ${text}`);
const done = (text) => console.log(`  ✔ ${text}`);

const admin = as(await login('system_admin', true));
const doctor = as(await login('doctor', true));
const nurse = as(await login('nurse', true));
const reception = as(await login('receptionist', false));
const pharmacist = as(await login('pharmacist', true));
const lab = as(await login('lab_technician', true));
const radio = as(await login('radiologist', true));
const cashier = as(await login('cashier', false));
const accountant = as(await login('accountant', false));

step('1. L’établissement : site, service de médecine, lits');
await admin('PUT', '/organization', { name: 'Groupe Hospitalier Sanjeevani' });
const site = await admin('POST', '/facilities', { name: 'Hôpital Central de Yaoundé', code: 'YDE1-hcy-01', status: 'OPERATIONAL_OPEN' });
const med = (await admin('POST', `/facilities/${site.id}/services`, { code: 'MED', name: 'Médecine interne', serviceType: 'CLINICAL', specialtyCode: 'INTERNAL_MEDICINE' }).catch(() =>
  admin('POST', `/facilities/${site.id}/services`, { code: 'MED', name: 'Médecine interne', serviceType: 'CLINICAL' }))).id;
const unit = (await admin('POST', `/structure/${med}/children`, { code: 'U1', name: 'Unité 1' })).id;
const room = (await admin('POST', `/structure/${unit}/children`, { code: 'S1', name: 'Salle 1' })).id;
const beds = [];
for (const n of [1, 2, 3]) beds.push((await admin('POST', `/structure/${room}/children`, { code: `L${n}`, name: `Lit ${n}` })).id);
done('site, service Médecine interne, 3 lits');

step('2. Le personnel : fiches, affectation au service, lien avec les comptes');
const users = (await admin('GET', '/users?limit=100')).items;
const idOf = (username) => users.find((u) => u.username === username).id;
const staff = async (number, first, last, profession, username) => {
  const member = await admin('POST', '/staff', { staffNumber: number, firstName: first, lastName: last, professionCode: profession, hiredOn: '2022-03-01' });
  await admin('POST', `/staff/${member.id}/assignments`, { nodeId: med, startDate: '2022-03-01', primary: true });
  await admin('PUT', `/staff/${member.id}/account`, { userId: idOf(username) });
  return member;
};
const drCurie = await staff('MAT-0001', 'Marie', 'Curie', 'DOCTOR', 'doctor');
await staff('MAT-0002', 'Paul', 'Abel', 'NURSE', 'nurse');
await staff('MAT-0003', 'Awa', 'Diallo', 'RECEPTIONIST', 'receptionist').catch(() => undefined);
done('médecin, infirmier et réceptionniste reliés à leur compte et affectés à la Médecine interne');

step('3. Le catalogue : médicaments et stock, analyses, examen d’imagerie');
const drug = await pharmacist('POST', '/pharmacy/drugs', { code: 'AMOX500', name: 'Amoxicilline', genericName: 'Amoxicilline', strength: '500 mg', form: 'CAPSULE', schedule: 'PRESCRIPTION', unit: 'gélule', unitPrice: 25, reorderLevel: 50 });
await pharmacist('POST', '/pharmacy/receipts', { supplier: 'Pharma Distrib', lines: [{ drugId: drug.id, batchNumber: 'L2026-01', expiry: day(400), quantity: 500, unitCost: 10 }] });
const NUMERIC = { section: 'HAEMATOLOGY', specimenType: 'BLOOD', container: 'PURPLE', resultType: 'NUMERIC', unit: 'g/dL', decimals: 1, tatMinutes: 120 };
const nfs = await admin('POST', '/lab/tests', { code: 'NFS', name: 'Numération formule sanguine', ...NUMERIC });
const tsh = await admin('POST', '/lab/tests', { code: 'TSH', name: 'Thyréostimuline', ...NUMERIC, section: 'BIOCHEMISTRY', specimenType: 'SERUM', container: 'YELLOW' });
const exam = await admin('POST', '/imaging/exam-types', { code: 'RX-THORAX', name: 'Radiographie du thorax', modality: 'XRAY', bodyPart: 'Thorax', durationMinutes: 20 });
done('Amoxicilline (500 gélules), analyses NFS et TSH, radiographie du thorax');

step('4. Les tarifs (chacun porte le code de ce qu’il tarifie) et un assureur');
await admin('POST', '/billing/items', { code: 'CONS-GEN', name: 'Consultation de médecine générale', category: 'CONSULTATION', unitPrice: 5000 });
await admin('POST', '/billing/items', { code: 'T-NFS', name: 'NFS complète', category: 'LABORATORY', unitPrice: 3500, sourceCode: 'NFS' });
await admin('POST', '/billing/items', { code: 'T-RX', name: 'Radiographie du thorax', category: 'RADIOLOGY', unitPrice: 12000, sourceCode: 'RX-THORAX' });
await admin('POST', '/billing/items', { code: 'T-AMOX', name: 'Amoxicilline 500 mg (la gélule)', category: 'PHARMACY', unitPrice: 150, sourceCode: 'AMOX500' });
// La TSH n'est volontairement pas tarifiée : une demande de TSH montre le cas « aucun prix » dans « À facturer ».
const payer = await accountant('POST', '/billing/payers', { code: 'ASP', name: 'Assurance Santé Plus' });
done('4 actes tarifiés (la TSH n’a pas de prix, pour la démonstration) et l’assureur « Assurance Santé Plus »');

step('5. Des patients, un rendez-vous, une consultation externe');
const patient = async (last, first, sex, birth) => (await reception('POST', '/patients', { lastName: last, firstName: first, sex, birthDate: birth, phone: '+237 655 00 00 00' })).id;
const p1 = await patient('Mbarga', 'Élisabeth', 'FEMALE', '1985-03-14');
const p2 = await patient('Ndongo', 'Paul', 'MALE', '1972-07-02');
const p3 = await patient('Ndom', 'Berthe', 'FEMALE', '1998-11-20');
await reception('POST', `/billing/patients/${p1}/coverages`, { payerId: payer.id, policyNumber: 'AS-123456', percent: 80, validFrom: day(-30) });
await reception('POST', '/appointments', { patientId: p3, practitionerId: drCurie.id, locationId: med, startsAt: new Date(Date.now() + 2 * 3600e3).toISOString(), durationMinutes: 30, reasonCode: 'ROUTINE_CONSULTATION' });
const visit = (await reception('POST', '/admissions', { patientId: p1, type: 'OUTPATIENT', serviceId: med })).id;
const enc = await doctor('POST', '/clinical/encounters', { admissionId: visit });
await doctor('PUT', `/clinical/encounters/${enc.id}/vitals`, { temperature: 38.4, pulse: 96, systolic: 120, diastolic: 80, respiratoryRate: 20, spo2: 97 });
await doctor('POST', `/clinical/encounters/${enc.id}/prescriptions`, { lines: [{ drugId: drug.id, dose: '1 gélule', frequency: '3 fois par jour', durationDays: 7, quantity: 21 }] });
const req1 = await doctor('POST', '/lab/requisitions', { patientId: p1, testIds: [nfs.id], encounterId: enc.id });
await doctor('POST', '/lab/requisitions', { patientId: p3, testIds: [nfs.id, tsh.id] });
const img = await doctor('POST', '/imaging/orders', { patientId: p1, examTypeId: exam.id, clinicalQuestion: 'Toux fébrile depuis 3 jours.', encounterId: enc.id });
await radio('POST', `/imaging/orders/${img.id}/perform`, { pregnant: false, contrastAllergy: false });
for (const s of req1.specimens) {
  await lab('POST', `/lab/specimens/${s.id}/collect`, { patientNumber: req1.patient.number, birthDate: '1985-03-14' });
  await lab('POST', `/lab/specimens/${s.id}/receive`);
}
done('Élisabeth Mbarga (assurée à 80 %) : consultation en cours, ordonnance, NFS reçue au laboratoire, radiographie réalisée ; rendez-vous de Berthe Ndom');

step('6. Une hospitalisation : lit, tournée du médecin, constantes, médicament');
const stay = (await reception('POST', '/admissions', { patientId: p2, type: 'INPATIENT', serviceId: med, bedId: beds[0] })).id;
const round = await doctor('POST', '/clinical/encounters', { admissionId: stay });
await doctor('POST', `/clinical/encounters/${round.id}/prescriptions`, { lines: [{ drugId: drug.id, dose: '1 gélule', frequency: '3 fois par jour', durationDays: 5, quantity: 15 }] });
await nurse('POST', `/inpatient/admissions/${stay}/observations`, { temperature: 37.2, pulse: 78, systolic: 124, diastolic: 78, respiratoryRate: 16, spo2: 97, supplementalOxygen: false, consciousness: 'ALERT' });
await nurse('POST', `/inpatient/admissions/${stay}/observations`, { temperature: 38.9, pulse: 112, systolic: 98, respiratoryRate: 22, spo2: 94, supplementalOxygen: false, consciousness: 'ALERT', note: 'Frissons, fièvre.' });
await nurse('POST', `/inpatient/admissions/${stay}/notes`, { text: 'Patient fébrile depuis ce matin, médecin informé.' });
done('Paul Ndongo hospitalisé au lit 1 : tournée du médecin, ordonnance, deux relevés (le second est à surveiller), une note');

console.log(`
─────────────────────────────────────────────────────────────────────────────
  Démonstration prête. Interface : http://localhost:4200 (npm run start:playground dans frontend/).
  Mot de passe de tous les comptes : ${PASSWORD} ; code de double authentification : ${BASE}/dev/totp

  À essayer :
   • doctor        tableau de bord, consultation d'Élisabeth Mbarga, signer, tournée de Paul Ndongo
   • nurse         Patients hospitalisés → Paul Ndongo : constantes, administrer l'Amoxicilline, notes
   • pharmacist    file d'ordonnances : délivrer l'ordonnance d'Élisabeth
   • lab_technician  saisir et valider le résultat de la NFS (deux personnes différentes pour valider)
   • radiologist   rédiger et signer le compte rendu de la radiographie
   • cashier       À facturer → analyses, imagerie, médicaments ; appliquer l'assurance (80 %) ; encaisser
   • accountant    Créances assureurs : constater le règlement
   • system_admin  Personnel, Utilisateurs (réinitialiser un mot de passe), Catalogue des tarifs
─────────────────────────────────────────────────────────────────────────────`);
