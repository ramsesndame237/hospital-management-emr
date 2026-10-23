# PART 11 — PROFILE 10 · DOCTOR (outpatient, inpatient rounds, emergency, surgery requests, maternity) — `DOC-xx`

**Who:** general practitioners, specialists, residents, emergency physicians, obstetricians, surgeons. **MFA mandatory.** **Goal:** assess, diagnose, order, prescribe, document, follow up, discharge — safely and with minimal clicks. **Sees:** full clinical record of patients they have a care relationship with (department scope), plus break-glass for emergencies. **Can:** prescribe, order labs/imaging/procedures, write notes, sign, refer, discharge. **Design priorities:** the **consultation workspace** (a single page with persistent patient banner, tabbed sections, a right-hand "orders & prescriptions cart", clinical decision support), **speed** (keyboard shortcuts, templates, favorites, autosave), **safety** (allergy/interaction alerts with override reason, double-check on high-risk), and **context** (trends, priors, results at hand). Desktop 1440 first; **tablet 1024 for ward rounds**; **mobile 390 for results inbox, schedule and patient summary**. ★ = proposed.

**Sidebar:** Tableau de bord · Mon agenda · Consultations · Hospitalisation (tournées) · Urgences · Résultats · Tâches & messages · Dossiers patients · Bloc opératoire · Maternité · Documents & certificats · Mon planning · Rapports.

## Flows
- **F-DOC-01 Outpatient consultation (main):** DOC-01 → DOC-03 (queue) → DOC-06 → DOC-07 → DOC-08 → DOC-09 → DOC-10 → DOC-11 → DOC-12 → [DOC-13 lab | DOC-14 imaging | DOC-15 procedures] → DOC-16 (prescribe; alerts → DOC-17) → DOC-18 (review & sign; print PRN-04 / to pharmacy PHA-02) → DOC-20 (note, sign) → [DOC-22 referral | DOC-24 certificate | DOC-25 follow-up] → DOC-26 (complete) → DOC-27 (after-visit summary to patient/portal) → DOC-03.
- **F-DOC-02 Results to action:** notification → DOC-40 → DOC-41 → (normal: acknowledge) | (abnormal: order repeat DOC-13 / call patient DOC-43 / book follow-up DOC-25) ; critical → DOC-42 (read-back) .
- **F-DOC-03 Unsigned work:** DOC-44 → open note DOC-20 / prescription DOC-18 / approval → sign.
- **F-DOC-04 Inpatient admission:** DOC-60/DOC-03 (decision to admit) → DOC-49 (admission orders; DOC-50 order set) → DOC-51 (medication orders) → REC-30 flow & NUR-06.
- **F-DOC-05 Ward rounds:** DOC-46 → DOC-47 (tablet carousel) → DOC-48 → DOC-52 (progress note) → orders (DOC-13/14/51/54) → DOC-55.
- **F-DOC-06 Consult between specialties:** DOC-53 (request) → consultee notified → reply → DOC-48 updates.
- **F-DOC-07 Discharge:** DOC-55 (planning & criteria) → DOC-57 (discharge orders + medication reconciliation) → DOC-56 (summary, sign; PRN-10) → NUR-44 → CSH-28 / REC-37.
- **F-DOC-08 Escalation / transfer:** DOC-48 → DOC-58 (ICU transfer/escalation) → NUR-43.
- **F-DOC-09 Emergency:** DOC-60 → DOC-61 → orders → DOC-62 (disposition: admit → DOC-49 | discharge → DOC-26 | transfer → DOC-58 | died → DOC-59); resuscitation: DOC-63.
- **F-DOC-10 Surgery:** DOC-64 (booking) → DOC-65 (pre-op & consent) → (theatre NUR-55…58) → DOC-66 (operation note) → DOC-67 (post-op orders).
- **F-DOC-11 Maternity:** DOC-68 (ANC visits) → DOC-69 (labour & delivery; → NUR-52/53) → DOC-70 (postnatal & newborn exam) → certificates DOC-72.
- **F-DOC-12 Referrals:** DOC-22 (out) | DOC-23 (in: accept/decline → book DOC-25).
- **F-DOC-13 Record access:** PTS-02 → [PTS-07 restricted → AUTH-20 break-glass] → DOC-28 → (DOC-29 … DOC-39).
- **F-DOC-14 Records requests:** DOC-71 (approve/prepare release) → DOC-72.
- **F-DOC-15 Planning:** DOC-73 (availability, leave request) → DOC-74 (on-call) ; earnings DOC-75.
- **F-DOC-16 Telemedicine ★:** DOC-78 (pre-visit check → video room → notes → close) → DOC-26.
- **F-DOC-17 Templates upkeep:** DOC-19 (Rx favorites) / DOC-21 (note templates) / DOC-50 (order sets).

## Screens
### Home & schedule
- **DOC-01 Dashboard** — today's appointments & queue snapshot, results needing action, unsigned items, inpatients with alerts, tasks, messages, on-call badge.
- **DOC-02 My agenda** — day/week/month, appointment blocks colored by status, walk-ins, blocked time, leave; drag to reschedule (with patient notify).
- **DOC-03 OPD queue** — waiting patients with waiting time, triage/priority, vitals-done indicator, **Call next**, timers; consult-in-progress state; tablet variant.
- **DOC-04 Appointment drawer** — details, history snippet, reschedule/no-show/cancel requests.
- **DOC-05 My patients** — search, recents, favorites, cohorts/panels ★ (e.g. diabetics due for HbA1c), filters.

### Consultation workspace
- **DOC-06 Start consultation** — confirm patient, visit info, vitals taken, last visit summary, allergies; "Commencer".
- **DOC-07 Workspace overview** — sticky banner, section tabs (Résumé · Anamnèse · Examen · Diagnostic · Examens · Ordonnance · Notes), **right cart** (pending orders & prescriptions), timer, autosave indicator, shortcuts hint, previous visits side panel.
- **DOC-08 Complaint & HPI** — structured symptoms (duration, severity, modifiers) + free text, templates, red-flag prompts.
- **DOC-09 History** — past medical/surgical, medications, family & social history, immunizations; reconcile with record.
- **DOC-10 Vitals & measurements** — view/enter, trends mini-charts, BMI/BSA, pediatric percentiles ★.
- **DOC-11 Physical exam** — system-based templates with normal-by-default toggles, body diagram, findings, attachments/photos.
- **DOC-12 Diagnosis** — ICD-10 search with favorites, primary/secondary, provisional/confirmed, links to problem list, differential notes.
- **DOC-13 Lab ordering** — catalog search, panels, favorites, priority, clinical info, fasting notes, duplicate-order warning, cost estimate, add to cart.
- **DOC-14 Imaging ordering** — modality/exam picker, clinical question, **safety checks** (pregnancy, contrast allergy, renal function), prior-imaging display, priority.
- **DOC-15 Procedures & services** — minor procedures, injections, physiotherapy, nursing orders; consumables hint; billing impact.
- **DOC-16 Prescription writer** — drug search (generic/brand), strength/form, dose calculators (weight-based pediatrics, renal adjustment), frequency/duration/quantity, instructions, **real-time allergy/interaction/duplicate alerts**, favorites & templates, controlled-drug flow.
- **DOC-17 CDS alert & override** — severity levels, evidence, alternatives, **mandatory override reason**, second approval for severe.
- **DOC-18 Prescription review & sign** — summary, patient-friendly instructions preview, e-signature, send to pharmacy / print (PRN-04), QR.
- **DOC-19 Prescription favorites & templates** — manage personal/shared sets.
- **DOC-20 Clinical note editor** — SOAP/free text, templates, macros, smart-inserts (vitals, results), **dictation ★**, autosave, sign & lock, addendum flow.
- **DOC-21 Note templates & macros** — manage library, versions, share.
- **DOC-22 Referral out** — recipient (specialist/facility), urgency, reason, summary auto-fill, attachments, letter preview (PRN-12), tracking status.
- **DOC-23 Referrals in** — incoming referrals inbox, accept/decline/redirect, book appointment.
- **DOC-24 Certificates** — sick leave, fitness, attendance, custom; preview (PRN-11), sign, issue log.
- **DOC-25 Follow-up scheduling** — book next visit from consultation (interval presets), reminders, recall list entry.
- **DOC-26 Complete consultation** — checklist (diagnosis, orders, Rx, follow-up, notes signed), billing items auto-collected, end visit, return to queue.
- **DOC-27 After-visit summary** — plain-language summary, instructions, warning signs, share to portal/print.

### Longitudinal patient record
- **DOC-28 Patient 360** — banner + summary cards (problems, meds, allergies, vitals trends, recent labs/imaging, notes, alerts, care gaps ★), customizable layout.
- **DOC-29 Timeline & encounter detail** — chronological events with filters; encounter detail view.
- **DOC-30 Problem list** — active/resolved, onset, status, links to encounters.
- **DOC-31 Medication list** — current/past, reconcile, stop/modify actions.
- **DOC-32 Allergies & adverse reactions** — add/edit/verify with severity and reaction type; "no known allergies" attestation.
- **DOC-33 Immunizations** — history, schedule due/overdue, record external doses.
- **DOC-34 Results history & trends** — flowsheet tables & charts by analyte with reference bands.
- **DOC-35 Imaging history** — report list with thumbnails, open in viewer (RAD-16).
- **DOC-36 Documents** — patient folder (FILE-01 scoped), external records, scan upload.
- **DOC-37 Pediatric growth ★** — growth charts (WHO), milestones, vaccination link.
- **DOC-38 Obstetric history summary** — gravida/para, pregnancies, complications.
- **DOC-39 Care team & contacts** — treating clinicians, next of kin, preferred pharmacy.

### Results, tasks, messages
- **DOC-40 Results inbox (M)** — new results to acknowledge, **critical pinned**, filters (lab/imaging, patient, abnormal), batch acknowledge for normals.
- **DOC-41 Result detail & action** — values/report, trend, comments, actions (acknowledge, repeat test, call patient, book follow-up, forward to colleague).
- **DOC-42 Critical result acknowledgement** — read-back documentation, time to acknowledge, escalation if missed.
- **DOC-43 Communicate result to patient ★** — message template / call script / letter, send to portal, log.
- **DOC-44 Tasks & approvals** — unsigned notes/prescriptions, referral requests, antibiotic approvals, record requests; due dates.
- **DOC-45 Secure messages & consult requests** — staff-to-staff inbox, threads, attachments, patient-linked.

### Inpatient care
- **DOC-46 Inpatient list / rounds** — by ward/room, acuity, new results, overnight events, NEWS2, pending discharge; filters; **tablet variant**.
- **DOC-47 Rounds mode (tablet)** — patient carousel/swipe, one-page snapshot, quick note/order buttons, voice ★.
- **DOC-48 Inpatient workspace** — tabs: overview · progress notes · orders · MAR view · results · vitals & I/O · consults · discharge planning.
- **DOC-49 Admission orders** — admit order set: diagnosis, ward, diet, activity, vitals frequency, meds, labs, isolation, code status.
- **DOC-50 Order sets** — library (admission, sepsis, DKA, post-op…), apply & modify, manage/version ★.
- **DOC-51 Inpatient medication orders** — start/stop/modify, PRN, IV fluids, hold, verification status from pharmacy, alerts.
- **DOC-52 Progress note** — daily problem-based SOAP, auto-pulled data, sign.
- **DOC-53 Consult request & reply** — specialty, question, urgency, response view/answer form.
- **DOC-54 Diet, activity & nursing orders** — order panels.
- **DOC-55 Discharge planning** — criteria, readiness checklist, pending results, social needs, expected date.
- **DOC-56 Discharge summary editor** — diagnoses, hospital course, procedures, discharge meds, follow-up, pending results, instructions; sign; print (PRN-10); sent to portal.
- **DOC-57 Discharge orders & medication reconciliation** — continue/stop/change per home med, discharge prescriptions.
- **DOC-58 Transfer / escalation** — ICU/other ward transfer request, handover summary, acceptance status.
- **DOC-59 Death notification & certificate ★** — cause-of-death form, certification, family communication note, mortuary hand-off.

### Emergency
- **DOC-60 ED tracking board (doctor)** — patients by zone/color, waiting, assigned doctor, pending results, quick actions.
- **DOC-61 ED assessment** — focused history/exam, order quick-panel (labs/imaging/meds), reassessment notes.
- **DOC-62 Disposition** — admit / discharge / transfer / left-against-advice / died workflow with required fields.
- **DOC-63 Resuscitation / trauma view ★** — timeline, ABCDE checklist, drugs given, team roles.

### Surgery
- **DOC-64 OT booking request** — procedure, side, urgency, duration, equipment, anesthesia needs, blood requirements, consent status.
- **DOC-65 Pre-op & anesthesia assessment + consent** — assessment forms, risk scores (ASA), investigations checklist, electronic consent with signatures.
- **DOC-66 Operation note** — procedure details, findings, implants, specimens, EBL, complications, post-op plan; sign.
- **DOC-67 Post-op orders** — analgesia, fluids, monitoring, diet, mobilization.

### Maternity
- **DOC-68 Antenatal visit (ANC)** — gestational age/EDD, measurements, risk screen, investigations, plan, next visit.
- **DOC-69 Labour & delivery (doctor)** — partograph view (read), decision notes (augmentation, C-section), delivery record, newborn hand-off.
- **DOC-70 Postnatal & newborn examination** — maternal check, newborn exam checklist, counseling.

### Records, planning, reporting
- **DOC-71 Medical records requests** — release-of-information requests, scope review, approve/deny, prepared package.
- **DOC-72 Certificates & reports registry** — issued certificates, birth/death notifications, reprint, status.
- **DOC-73 My schedule & availability** — weekly templates, exceptions, leave requests with status.
- **DOC-74 On-call roster** — calendar, swaps, contact details.
- **DOC-75 Earnings & incentives statement ★** — period statement (links ACC-56), drill to cases.
- **DOC-76 My activity reports** — patients seen, diagnoses distribution, order patterns, turnaround; export.
- **DOC-77 Quality dashboard ★** — readmissions, antibiotic stewardship, guideline adherence.
- **DOC-78 Telemedicine ★** — pre-visit device check, waiting room, video consultation with side notes/orders, post-visit summary (3 frames).
- **DOC-79 Mobile quick views (M)** — mobile frames for results inbox, today's schedule, patient summary & alerts.
- **DOC-80 Notifications & alerts center** — critical results, unsigned items, consult replies, admissions, schedule changes.

**Required extra states:** allergy conflict (blocking), duplicate order, restricted/VIP record (PTS-07) and break-glass active banner, unsigned work reminder, result critical unacknowledged, offline draft, sign-locked note with addendum, pregnant-patient imaging warning, pediatric weight missing (dose calc blocked), session timeout with note draft preserved.

**Screen count — Part 11:** **80 screens** (DOC-01 … DOC-80).
