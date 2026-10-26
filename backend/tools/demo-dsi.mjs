// Démonstration commentée : le DSI (administrateur système) installe son établissement de A à Z, uniquement par l'API.
//
//   Terminal 1 :  npm run playground          (API complète sur une base en mémoire, http://localhost:3100)
//   Terminal 2 :  npm run demo:dsi
//
// Le scénario s'exécute sur le bac à sable (données en mémoire) : rien n'est écrit dans une vraie base.
const BASE = process.env.API ?? 'http://localhost:3100';
const PASSWORD = process.env.DEMO_PASSWORD ?? 'Demo-Passw0rd-2026'; // mot de passe public du bac à sable (voir tools/playground.ts)
const PAUSE = Number(process.env.DEMO_PAUSE_MS ?? 150);

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const line = '─'.repeat(78);
const title = (text) => console.log(`\n${line}\n  ${text}\n${line}`);
const say = (text) => console.log(`  ${text}`);
const done = (text) => console.log(`  ✔ ${text}`);

let token = '';
async function call(method, path, body, expected = [200, 201]) {
  const res = await fetch(`${BASE}/api/v1${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  const json = text ? JSON.parse(text) : null;
  if (!expected.includes(res.status)) {
    console.error(`\n  ✘ ${method} /api/v1${path} → ${res.status}\n  ${text}`);
    process.exit(1);
  }
  await wait(PAUSE);
  return json;
}
const api = {
  get: (p) => call('GET', p),
  post: (p, b) => call('POST', p, b ?? {}),
  put: (p, b) => call('PUT', p, b),
};

const KIND = { SERVICE: 'Service', UNIT: 'Unité', ROOM: 'Salle', BED: 'Lit' };
const TYPE = { CLINICAL: 'soins', MEDICO_TECHNICAL: 'médico-technique', ADMINISTRATIVE: 'administratif', SUPPORT: 'support' };
function printTree(nodes, prefix = '') {
  nodes.forEach((n, i) => {
    const last = i === nodes.length - 1;
    const details = [n.serviceType && TYPE[n.serviceType], n.specialtyCode && `spécialité ${n.specialtyCode}`, n.floor && `étage ${n.floor}`].filter(Boolean).join(', ');
    console.log(`  ${prefix}${last ? '└─' : '├─'} ${KIND[n.kind].padEnd(7)} ${n.code.padEnd(5)} ${n.name}${details ? `  (${details})` : ''}`);
    printTree(n.children, prefix + (last ? '   ' : '│  '));
  });
}

// ─────────────────────────────────────────────────────────────────────────────────────────────
title('1. Connexion du DSI (compte « system_admin », profil Administrateur système, MFA obligatoire)');
const totp = await (await fetch(`${BASE}/dev/totp`)).json(); // à la place de l'application d'authentification, dans le bac à sable
say('POST /auth/login   { username: "system_admin", password: "••••••••", totpCode: "' + totp.code + '" }');
const session = await call('POST', '/auth/login', { username: 'system_admin', password: PASSWORD, totpCode: totp.code }, [200]);
token = session.accessToken;
done(`session ouverte (portée « ${session.scope} »), jeton d'accès de courte durée ; le jeton de rafraîchissement reste dans un cookie httpOnly`);
const me = await api.get('/auth/me');
done(`profil : ${me.username} · rôle ${me.roles.join(', ')} · ${me.permissions.length} permissions, dont l'administration de l'organisation, de la structure, du personnel et la lecture de l'audit`);
const dsiId = me.id;

// ─────────────────────────────────────────────────────────────────────────────────────────────
title("2. L'organisation (une par installation)");
say('PUT /organization   { name: "Groupe Hospitalier Sanjeevani" }');
const org = await api.put('/organization', { name: 'Groupe Hospitalier Sanjeevani' });
done(`organisation créée : « ${org.name} »`);

// ─────────────────────────────────────────────────────────────────────────────────────────────
title("3. Les deux sites de l'organisation");
say('POST /facilities   { name: "Hôpital Central de Yaoundé", code: "YDE1-hcy-01", status: "OPERATIONAL_OPEN" }');
const yaounde = await api.post('/facilities', { name: 'Hôpital Central de Yaoundé', code: 'YDE1-hcy-01', status: 'OPERATIONAL_OPEN' });
done(`${yaounde.name} · code ${yaounde.code} · ${yaounde.status} → opérationnel : ${yaounde.operational}`);
say('POST /facilities   { name: "Clinique Annexe de Douala", code: "DLA1-cad-02" }   (sans statut : « en construction »)');
const douala = await api.post('/facilities', { name: 'Clinique Annexe de Douala', code: 'DLA1-cad-02' });
done(`${douala.name} · code ${douala.code} · ${douala.status} → opérationnel : ${douala.operational}`);
say("La clinique ouvre : POST /facilities/{id}/status   { status: \"OPERATIONAL_OPEN\" }");
const opened = await api.post(`/facilities/${douala.id}/status`, { status: 'OPERATIONAL_OPEN' });
done(`${opened.name} est maintenant ${opened.status}`);
const sites = await api.get('/facilities');
done(`liste des sites : ${sites.items.map((f) => f.name).join(' · ')}`);

// ─────────────────────────────────────────────────────────────────────────────────────────────
title("4. Tout ce qu'il y a dans un site : services, unités, salles, lits");
const node = async (path, body) => (await api.post(path, body)).id;
const service = (site, code, name, serviceType, specialtyCode) => node(`/facilities/${site}/services`, { code, name, serviceType, ...(specialtyCode ? { specialtyCode } : {}) });
const child = (parent, code, name, floor) => node(`/structure/${parent}/children`, { code, name, ...(floor ? { floor } : {}) });

say("Hôpital Central de Yaoundé — les services (la spécialité est contrôlée dans les référentiels) :");
const urg = await service(yaounde.id, 'URG', 'Urgences', 'CLINICAL', 'EMERGENCY_MEDICINE');
const ped = await service(yaounde.id, 'PED', 'Pédiatrie', 'CLINICAL', 'PEDIATRICS');
const mat = await service(yaounde.id, 'MAT', 'Maternité', 'CLINICAL', 'OBSTETRICS_GYNECOLOGY');
const chi = await service(yaounde.id, 'CHI', 'Chirurgie', 'CLINICAL', 'GENERAL_SURGERY');
const rad = await service(yaounde.id, 'RAD', 'Imagerie médicale', 'MEDICO_TECHNICAL', 'RADIOLOGY');
const lab = await service(yaounde.id, 'LAB', 'Laboratoire', 'MEDICO_TECHNICAL');
const pha = await service(yaounde.id, 'PHA', 'Pharmacie', 'SUPPORT');
const acc = await service(yaounde.id, 'ACC', 'Accueil et admissions', 'ADMINISTRATIVE');
done('8 services créés (soins, médico-technique, support, administratif)');

say('…leurs unités, salles et lits :');
const pedNeo = await child(ped, 'NEO', 'Néonatologie');
const pedNeoRoom = await child(pedNeo, 'S1', 'Salle de néonatologie', 'RDC');
const pedGen = await child(ped, 'GEN', 'Pédiatrie générale');
const pedRoom2 = await child(pedGen, 'S2', 'Salle 2', '1');
const pedRoom3 = await child(pedGen, 'S3', 'Salle 3', '1');
const urgBox = await child(urg, 'BOX', 'Salles de soins');
const urgRoom = await child(urgBox, 'SAU', "Salle d'accueil des urgences", 'RDC');
const matLabour = await child(mat, 'ACC', 'Suites de couches');
const matRoom = await child(matLabour, 'S1', 'Chambre 1', '2');
const chiPost = await child(chi, 'PO', 'Post-opératoire');
const chiRoom = await child(chiPost, 'S1', 'Salle de réveil', '2');
const beds = [];
for (const [room, codes] of [[pedNeoRoom, ['B1', 'B2', 'B3']], [pedRoom2, ['B1', 'B2']], [pedRoom3, ['B1', 'B2']], [urgRoom, ['B1', 'B2', 'B3', 'B4']], [matRoom, ['B1', 'B2']], [chiRoom, ['B1', 'B2', 'B3']]]) {
  for (const code of codes) beds.push(await child(room, code, `Lit ${code.slice(1)}`));
}
done(`${beds.length} lits installés ; Laboratoire, Imagerie, Pharmacie et Accueil n'ont pas de lits (ce sont des services sans hospitalisation)`);

say('Clinique Annexe de Douala — une structure plus légère :');
const dConsult = await service(douala.id, 'CEX', 'Consultations externes', 'CLINICAL', 'GENERAL_MEDICINE');
const dMat = await service(douala.id, 'MAT', 'Maternité', 'CLINICAL', 'OBSTETRICS_GYNECOLOGY');
const dUnit = await child(dMat, 'U1', 'Suites de couches');
const dRoom = await child(dUnit, 'S1', 'Chambre 1', '1');
await child(dRoom, 'B1', 'Lit 1');
await child(dRoom, 'B2', 'Lit 2');
await child(dConsult, 'C1', 'Cabinet 1');
done('2 services, 2 lits');

// ─────────────────────────────────────────────────────────────────────────────────────────────
title('5. Le personnel du site et ses affectations (profession et spécialité viennent des référentiels)');
const staff = async (number, first, last, profession, specialty, site, hiredOn) => {
  const body = { staffNumber: number, firstName: first, lastName: last, professionCode: profession, hiredOn, ...(specialty ? { specialtyCode: specialty } : {}) };
  const member = await api.post('/staff', body);
  await api.post(`/staff/${member.id}/assignments`, { nodeId: site, startDate: hiredOn, primary: true });
  return member;
};
const drCurie = await staff('MAT-0001', 'Marie', 'Curie', 'DOCTOR', 'PEDIATRICS', ped, '2022-03-01');
const nurseAbel = await staff('MAT-0002', 'Paul', 'Abel', 'NURSE', null, ped, '2023-01-15');
const midwife = await staff('MAT-0003', 'Aïcha', 'Bello', 'MIDWIFE', null, mat, '2021-09-01');
const surgeon = await staff('MAT-0004', 'Jean', 'Nkoa', 'DOCTOR', 'GENERAL_SURGERY', chi, '2020-06-01');
const receptionist = await staff('MAT-0005', 'Anne', 'Zola', 'ADMINISTRATIVE_STAFF', null, acc, '2024-02-01');
const pharmacist = await staff('MAT-0006', 'Samuel', 'Etoga', 'PHARMACIST', null, pha, '2022-11-01');
done('6 membres du personnel enregistrés, chacun affecté à son service');

say("Comptes de connexion (le DSI crée le compte, un mot de passe provisoire est généré — il n'est affiché nulle part ici) :");
const account = async (member, username, role) => {
  const created = await api.post('/users', { username, email: `${username}@sanjeevani.example`, roles: [role] });
  await api.put(`/staff/${member.id}/account`, { userId: created.user.id });
  return created.user.id;
};
await account(drCurie, 'marie.curie', 'DOCTOR');
await account(nurseAbel, 'paul.abel', 'NURSE');
const receptionUser = await account(receptionist, 'anne.zola', 'RECEPTIONIST');
done('3 comptes créés et reliés à leur fiche : médecin, infirmier, réceptionniste');

say("Droits « par service » du médecin (calculés à partir de son affectation) :");
const dr = await api.get(`/users/${(await api.get('/staff/' + drCurie.id)).userId}/access`);
done(`${dr.username} : rôle ${dr.roles[0].code} · services accessibles : ${dr.departments.length} (Pédiatrie) · ex. ${dr.permissions.filter((p) => p.startsWith('admissions')).join(', ')}`);
void midwife; void surgeon; void pharmacist; void receptionUser;

// ─────────────────────────────────────────────────────────────────────────────────────────────
title("6. Le site en un coup d'œil (GET /facilities/{id}/structure)");
const tree = await api.get(`/facilities/${yaounde.id}/structure`);
console.log(`\n  ${yaounde.name} (${yaounde.code})`);
printTree(tree.services);
console.log(`\n  Totaux : ${tree.totals.services} services · ${tree.totals.units} unités · ${tree.totals.rooms} salle(s) · ${tree.totals.beds} lits (capacité d'accueil)`);

const staffList = await api.get('/staff?limit=50');
console.log('\n  Personnel :');
for (const s of staffList.items) console.log(`    ${s.staffNumber}  ${s.lastName.padEnd(8)} ${s.firstName.padEnd(8)} ${s.professionCode.padEnd(22)} ${s.userId ? 'compte relié' : ''}`);

const dTree = await api.get(`/facilities/${douala.id}/structure`);
console.log(`\n  ${douala.name} (${douala.code})`);
printTree(dTree.services);
console.log(`\n  Totaux : ${dTree.totals.services} services · ${dTree.totals.units} unités · ${dTree.totals.rooms} salle(s) · ${dTree.totals.beds} lits`);

// ─────────────────────────────────────────────────────────────────────────────────────────────
title('7. Pour vérifier que tout marche ensemble : un patient, un rendez-vous, une hospitalisation');
const patient = await api.post('/patients', { lastName: 'Mbarga', firstName: 'Élisabeth', sex: 'FEMALE', birthDate: '2019-03-14', phone: '+237 655 00 00 00', nextOfKin: { name: 'Jeanne Mbarga', relationship: 'PARENT', phone: '+237 677 00 00 00' } });
done(`dossier ouvert : ${patient.number} (numéro attribué par le système)`);
const dup = await call('POST', '/patients', { lastName: 'MBARGA', firstName: 'elisabeth', sex: 'FEMALE', birthDate: '2019-03-14' }, [409]);
done(`même personne ressaisie → refusée (${dup.code}), ${dup.candidates.length} dossier ressemblant signalé`);
const tomorrow = new Date(Date.now() + 24 * 3600 * 1000);
tomorrow.setUTCHours(9, 0, 0, 0);
const appt = await api.post('/appointments', { patientId: patient.id, practitionerId: drCurie.id, locationId: ped, startsAt: tomorrow.toISOString(), durationMinutes: 30, reasonCode: 'ROUTINE_CONSULTATION' });
done(`rendez-vous ${appt.number} avec Dr ${appt.practitioner.lastName}, demain 09:00 UTC, 30 min`);
const clash = await call('POST', '/appointments', { patientId: patient.id, practitionerId: drCurie.id, locationId: ped, startsAt: tomorrow.toISOString(), durationMinutes: 30 }, [409]);
done(`même créneau redemandé → refusé (${clash.code})`);
const stay = await api.post('/admissions', { patientId: patient.id, type: 'INPATIENT', bedId: beds[0], practitionerId: drCurie.id, reasonCode: 'EMERGENCY' });
done(`hospitalisation ${stay.number} dans « ${stay.bed.location} › ${stay.bed.name} » (Pédiatrie)`);
const board = await api.get(`/admissions/occupancy?serviceId=${ped}`);
console.log(`\n  Tableau des lits — Pédiatrie : ${board.occupied} occupé(s) sur ${board.capacity}, ${board.free} libre(s)`);
for (const b of board.beds) console.log(`    ${(b.location + ' › ' + b.name).padEnd(44)} ${b.occupied ? `occupé par ${b.patient.firstName} ${b.patient.lastName} (${b.patient.number})` : 'libre'}`);
const other = await call('POST', '/admissions', { patientId: (await api.post('/patients', { lastName: 'Ndongo', firstName: 'Paul', sex: 'MALE', birthDate: '2015-05-05' })).id, type: 'INPATIENT', bedId: beds[0] }, [409]);
done(`même lit demandé pour un autre patient → refusé (${other.code})`);

// ─────────────────────────────────────────────────────────────────────────────────────────────
title("8. Tout est tracé : le journal d'audit du DSI");
const events = await api.get(`/audit/events?actorId=${dsiId}&limit=200`);
const counts = new Map();
for (const e of events.items) counts.set(e.action, (counts.get(e.action) ?? 0) + 1);
for (const [action, n] of [...counts.entries()].sort()) console.log(`    ${String(n).padStart(3)} ×  ${action}`);
const chain = await api.get('/audit/verify');
done(`${events.items.length} actions du DSI journalisées · chaîne d'intégrité de ${chain.checked} entrées : ${chain.valid ? 'intacte' : 'ALTÉRÉE'}`);
say('Le journal ne contient que des identifiants et des numéros — jamais de nom ni de coordonnées.');
console.log(`\n${line}\n  Terminé. Explorez le résultat dans la documentation interactive : ${BASE}/api-docs\n${line}\n`);
