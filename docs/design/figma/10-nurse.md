# PART 10 — PROFILE 9 · NURSE (ward, emergency triage, maternity, theatre, vaccination, ward supply) — `NUR-xx`

**Who:** ward nurses, charge nurses, ED triage nurses, midwives, theatre/recovery nurses, vaccination nurses. **MFA mandatory.** **Goal:** deliver and document bedside care safely and quickly: assessments, vitals, medication administration, orders, wound/line care, handover, transfers, discharge preparation, plus ward consumables. **Sees:** full clinical chart of patients in their care (read) and nursing documentation (write); can **acknowledge** doctor orders and **administer** medications but **cannot prescribe**. **Design priorities:** **tablet 1024×768 / large touch targets first** (bedside) with desktop 1440 and a **mobile 390 variant for vitals & MAR**; one-hand operation, minimal typing, barcode scanning (wristband + medication), high-contrast alerts, offline-tolerant capture with sync indicator. Patient banner is **always** visible (allergies, code status, isolation, fall risk). ★ = proposed.

**Sidebar / tablet rail:** Mon service · Patients · Lits · Tâches · Constantes · MAR (médicaments) · Soins & notes · Passation · Urgences · Maternité · Bloc · Vaccination · Approvisionnement · Stérilisation · Rapports.

## Flows
- **F-NUR-01 Admission to ward:** REC-34 notification → NUR-06 (receive) → NUR-07 (admission assessment) → NUR-08 (risk hub: NUR-09/10/11/12) → NUR-31 (care plan) → NUR-05 (tasks generated).
- **F-NUR-02 Vitals & deterioration:** NUR-05/NUR-02 → NUR-13 (entry, auto NEWS2) → NUR-14 (trends) → if score ≥ threshold NUR-15 (escalate: call doctor, rapid-response record) → NUR-30 (communication log).
- **F-NUR-03 Medication round:** NUR-19 (MAR) → NUR-20 (scan wristband + medication, 5 rights) → done | NUR-21 (hold/refuse/not given) | NUR-24 (high-alert double check) | NUR-25 (alert dialogs); PRN: NUR-22; infusions: NUR-23; transfusion ★: NUR-26.
- **F-NUR-04 New orders:** NUR-27 (acknowledge) → NUR-28 (specimen collection → LAB-06) → results arrive → NUR-29 (view; critical → NUR-30 notify).
- **F-NUR-05 Wound & lines:** NUR-33 (wound care + photo → FILE-10) · NUR-34 (lines/drains/catheters bundle checks) · NUR-35 (procedures) → NUR-40 (charge capture).
- **F-NUR-06 Incident:** any screen → NUR-39 (fall/incident report) → notification to charge nurse / quality.
- **F-NUR-07 Shift handover:** NUR-68 (assignment) → NUR-41 (SBAR per patient, acknowledge) → NUR-42 (print).
- **F-NUR-08 Transfer:** NUR-43 → receiving unit acknowledgement → NUR-03 updates.
- **F-NUR-09 Discharge:** (doctor discharge order) → NUR-44 (checklist) → NUR-37 (education) → NUR-45 (instructions print) → REC-37 / CSH-28 clearance → bed released (NUR-70 cleaning request).
- **F-NUR-10 Death ★:** NUR-46 (documentation, family notification, mortuary hand-off).
- **F-NUR-11 Emergency triage:** REC-39 → NUR-47 (ESI) → NUR-48 (board) → NUR-49 (reassessment timers) → NUR-50 (resus record, if applicable) → admission or discharge.
- **F-NUR-12 Maternity:** NUR-51 → NUR-52 (partograph) → delivery (doctor/midwife) → NUR-53 (newborn care + birth notification PRN-17) → NUR-54 (postnatal) → NUR-44.
- **F-NUR-13 Theatre:** NUR-55 → NUR-56 (WHO checklist) → NUR-57 (intra-op counts) → NUR-58 (recovery) → ward hand-off NUR-43.
- **F-NUR-14 Vaccination:** NUR-59 (session) → NUR-60 (register/stock) ; adverse event → NUR-39.
- **F-NUR-15 Ward supply:** NUR-61 (levels) → NUR-62 (requisition → PHA-16) → NUR-63 (receive) ; sterile supply: NUR-64 ; housekeeping: NUR-65 / NUR-70.
- **F-NUR-16 Allocation ★:** NUR-69 (charge nurse allocates patients) → NUR-02 (each nurse sees theirs).

## Screens
### Dashboard, patients, beds, tasks
- **NUR-01 Ward dashboard** — my patients & acuity, overdue tasks, new orders, critical alerts, bed census, pending admissions/discharges/transfers.
- **NUR-02 My patients** — cards/list with banner, acuity chip, next due task, alerts (falls, isolation, NPO), quick actions (vitals, MAR, notes); **mobile variant**.
- **NUR-03 Ward bed board** — bed tiles with clinical overlays (isolation, fall risk, NPO, allergy, pending discharge), occupancy, filters.
- **NUR-04 Patient chart overview** — PTS-03 nurse variant: summary, orders, results, MAR snapshot, care plan, notes.
- **NUR-05 Shift task list** — timed tasks (vitals, meds, dressings, turns, assessments), overdue highlighting, complete/skip with reason, filter by patient/type.

### Admission & assessments
- **NUR-06 Receive admission** — incoming patient from admission desk, arrival checklist, identity & wristband check, orientation.
- **NUR-07 Nursing admission assessment** — multi-section wizard (history, allergies, home medications, skin, nutrition, mobility, elimination, psychosocial, belongings), save progress, completeness meter.
- **NUR-08 Risk assessments hub** — status of each assessment, due dates, scores.
- **NUR-09 Falls risk (Morse)** · **NUR-10 Pressure injury risk (Braden)** · **NUR-11 Nutrition screening** · **NUR-12 Pain assessment** (numeric/faces/behavioral scales) — scored forms with interpretation and auto-generated care-plan suggestions.

### Observations
- **NUR-13 Vitals entry** — BP, HR, RR, SpO₂, temperature, GCS, pain, consciousness (AVPU); **NEWS2 auto-calculated**; abnormal highlighting; mobile & tablet; optional device-import.
- **NUR-14 Vitals trends / flowsheet** — chart + table over 24–72 h, overlays for medications/events.
- **NUR-15 Deterioration escalation** — NEWS2 threshold alert, escalation pathway, doctor call, rapid-response record, time stamps.
- **NUR-16 Intake & output** — fluid balance chart (oral/IV/urine/drains), running totals per shift.
- **NUR-17 Glucose monitoring** — readings, diabetic chart, insulin sliding-scale reference, hypo/hyper alerts.
- **NUR-18 Growth & anthropometrics ★** — weight/height/BMI, pediatric growth percentiles chart.

### Medication administration
- **NUR-19 MAR** — grid by time slot and drug, statuses (scheduled, due now, given, late, held, refused, not given), PRN/infusion sections, allergy banner, pharmacy-verified badge.
- **NUR-20 Administer medication** — scan wristband then medication barcode, 5-rights confirmation (patient, drug, dose, route, time), dose/site fields, success/mismatch states (wrong patient/drug/dose = blocking red).
- **NUR-21 Hold / refuse / not given** — reason list, notify doctor option, documentation.
- **NUR-22 PRN administration** — indication, last dose check, max-dose guard, reassessment reminder & effect documentation.
- **NUR-23 IV / infusion record** — rate, volume, start/stop, site check, pump integration ★, completion.
- **NUR-24 High-alert double check** — second nurse verification with e-signature (insulin, heparin, opioids, chemo, KCl).
- **NUR-25 Medication alert dialogs** — allergy, duplicate, interaction, late/early dose, with acknowledge/override-reason patterns.
- **NUR-26 Blood transfusion record ★** — pre-transfusion double check, vitals schedule, start/stop, reaction capture & stop-protocol.

### Orders, results, communication
- **NUR-27 Orders to action** — new doctor orders (lab, imaging, diet, procedures, consults, nursing orders) with acknowledge/complete, urgency, unacknowledged timer.
- **NUR-28 Bedside specimen collection** — mobile/tablet flow linked to LAB-06 (scan, tubes, labels).
- **NUR-29 Results review** — patient results (read-only), abnormal/critical flags, notify-doctor action.
- **NUR-30 Doctor communication log** — SBAR call/message record (who, when, read-back, outcome).

### Care documentation
- **NUR-31 Care plan** — problems, goals, interventions, evaluation, linked assessments, review dates.
- **NUR-32 Nursing notes** — shift notes with templates (SOAP/narrative), quick phrases, voice-to-text ★, late-entry marking, signature.
- **NUR-33 Wound care** — wound map/body diagram, measurements, photo capture (FILE-10), dressing used, next due, healing trend.
- **NUR-34 Lines, drains & catheters** — register (type, site, insertion date, day count, bundle checklist, removal due).
- **NUR-35 Nursing procedures** — dressings, catheterization, NG tube, suctioning, etc., with consumables used.
- **NUR-36 Mobility, nutrition & diet** — diet order, meal intake chart, mobility/physio plan, assistance level.
- **NUR-37 Patient education** — topics taught, method, teach-back result, materials given.
- **NUR-38 Isolation & restraints ★** — precautions signage, restraint/seclusion documentation with timed checks.
- **NUR-39 Incident / fall report** — structured report (what/when/where/harm), immediate actions, notifications, follow-up.
- **NUR-40 Charge capture** — consumables/services used → billing (confirm, undo), per patient.

### Handover, transfer, discharge
- **NUR-41 Shift handover** — SBAR per patient (auto-filled, editable), outstanding tasks, risks, acknowledge by incoming nurse.
- **NUR-42 Handover report print** — ward summary.
- **NUR-43 Internal transfer** — request, readiness checklist, receiving-unit acknowledgement, belongings & lines transferred.
- **NUR-44 Discharge preparation** — checklist (education, medications, follow-up, equipment, transport, belongings), blocks until clearance.
- **NUR-45 Discharge instructions** — printable patient instructions (PRN-10 section).
- **NUR-46 Death & post-mortem care ★** — documentation, family notification, certification hand-off, mortuary transfer.

### Emergency (triage nurse)
- **NUR-47 ED arrival & triage** — complaint, vitals, pain, **ESI 1–5** with color, mode of arrival, allergies, assign zone/bed.
- **NUR-48 ED tracking board** — interactive board (rows by bed/zone, triage color, waiting time, assigned doctor/nurse, status, alerts) + wall variant TV-02.
- **NUR-49 ED reassessment** — timers per acuity, vitals re-checks, escalation.
- **NUR-50 Resuscitation record ★** — time-stamped event log (compressions, drugs, defib, airway), roles, outcome.

### Maternity
- **NUR-51 Maternity board** — labour/postnatal beds, status (latent/active/second stage), alerts.
- **NUR-52 Labour monitoring (partograph)** — cervical dilatation, descent, contractions, FHR, maternal vitals, action/alert lines.
- **NUR-53 Newborn care** — APGAR, weight, vitals, feeding, vitamin K, BCG/polio dose, identification band, **birth notification** (PRN-17).
- **NUR-54 Postnatal care** — checklist, bleeding/fundus checks, breastfeeding support, discharge teaching.

### Operating theatre nursing
- **NUR-55 Theatre schedule** — list by room/time, patient status. 
- **NUR-56 Pre-op checklist** — WHO surgical safety (sign-in), consent, site marking, fasting, allergies, implants.
- **NUR-57 Intra-operative record** — timings, counts (swabs/instruments/needles) with reconcile, positioning, implants, specimens.
- **NUR-58 Recovery (PACU)** — Aldrete score, vitals trend, pain/nausea, discharge-to-ward criteria.

### Vaccination
- **NUR-59 Vaccination session** — patient/schedule due list, vaccine/lot scan, site/route, consent, adverse-event capture, certificate.
- **NUR-60 Vaccination register & stock** — coverage dashboard, defaulters list, vaccine stock & cold chain.

### Ward supply, CSSD, housekeeping
- **NUR-61 Ward stock levels** — consumables per par level, consumption.
- **NUR-62 Requisition** — build request to pharmacy/store (→ PHA-16), urgency, status tracker.
- **NUR-63 Receive supplies** — scan, discrepancies, confirm.
- **NUR-64 CSSD requests** — sterile pack requests/returns, cycle status, tracking (sterilization indicators).
- **NUR-65 Housekeeping & equipment requests** — bed cleaning, equipment repair, tracking.

### Reports & misc
- **NUR-66 Ward reports** — census, acuity, falls, pressure injuries, incidents, medication-omission rate.
- **NUR-67 Notifications** — overdue tasks, new orders, critical results, admissions, requisition status.
- **NUR-68 My assignment** — patients allocated for the shift, handover receipt.
- **NUR-69 Patient allocation ★** — charge nurse drag-and-drop allocation board with acuity balance.
- **NUR-70 Bed management request** — mark bed for cleaning/ready, housekeeping status, expected availability.

**Required extra states:** offline capture with sync queue, wristband not recognized, wrong-patient scan (blocking), expired/recalled medication lot, overdue critical task (pulsing), NEWS2 high (red banner), patient on isolation (signage), restricted record (PTS-07), device battery/low-network, session timeout with draft preserved, "documentation locked after sign" with addendum.

**Screen count — Part 10:** **70 screens** (NUR-01 … NUR-70).
