# PART 3 — PROFILE 2 · RECEPTIONIST / ADMISSION DESK — `REC-xx`

**Who:** front-desk and admission staff (no MFA required, shared desk PCs and tablets). **Goal:** register patients fast, manage appointments, queue, admissions/transfers/discharges (administrative side). **Sees:** demographics, visits, appointments, insurance eligibility, bed availability, basic billing status. **Never sees:** clinical notes, results, prescriptions. Desktop-first (1440), tablet variants for the queue and check-in. ★ = proposed feature not in the legacy app.

**Sidebar:** Tableau de bord · Patients · Visites · Rendez-vous · File d'attente · Admissions & lits · Urgences · Assurances · Documents & impressions · Rapports d'accueil.

## Flows
- **F-REC-01 New patient → visit → cash/queue:** REC-01 → REC-02 → REC-03 → REC-04 → REC-05 → REC-06 → REC-07 → REC-08 → REC-09 → REC-14 → REC-15 → (patient goes to the cashier CSH-06 / queue REC-26).
- **F-REC-02 Returning patient visit:** REC-02 → REC-13 → REC-14 → REC-15.
- **F-REC-03 Duplicate handling:** REC-03 (inline warning) → REC-10 → (use existing → REC-13) | (not a duplicate → continue REC-04).
- **F-REC-04 Appointment lifecycle:** REC-18 → REC-19 → REC-20 → (REC-21 check-in → REC-14 → REC-26) | (REC-22 reschedule) | (no-show / cancel with reason).
- **F-REC-05 Doctor unavailable:** REC-24 → REC-22 (bulk reschedule, propose slots) → REC-51 (notifications sent / failures) → REC-23 (waitlist fill).
- **F-REC-06 Queue operations:** REC-27 (issue ticket) → REC-26 (call next / recall / skip / transfer) → TV-01.
- **F-REC-07 Inpatient admission:** REC-35 or REC-29 → REC-30 → REC-31 → REC-32 → REC-33 → REC-34 → (nursing NUR-01).
- **F-REC-08 Transfer:** REC-35 → REC-36 → REC-29 (board updates).
- **F-REC-09 Administrative discharge:** REC-35 → REC-37 (clearance checklist: final bill CSH-xx, pharmacy returns, belongings, documents) → REC-38.
- **F-REC-10 Emergency arrival:** REC-39 → (ED board DOC-/NUR-) → REC-40 identity reconciliation.
- **F-REC-11 Insurance:** REC-06 or REC-14 → REC-41 → REC-42 (if pre-authorisation needed) → back to the visit/admission.
- **F-REC-12 Merge duplicates:** REC-10 → REC-12 → sent for approval (confirmation state).
- **F-REC-13 Reprint & reminders:** REC-44 (reprint, with reason logged); REC-51 resend reminder.

## Screens
### Home
- **REC-01 Dashboard** — KPI tiles (arrivals today, waiting, no-shows, bed availability), today's appointment timeline, queue snapshot, pending admissions, insurance pre-auth alerts, quick actions (Nouveau patient, Nouvelle visite, Nouvelle admission, Urgence).

### Patients
- **REC-02 Patient search & list** — (PTS-01 enhanced) filters, recent, scan card/QR, bulk none, "Nouveau patient".
- **REC-03 New patient 1/6 · Identity** — name, DOB, sex, national ID, photo capture (webcam) with guidance, **inline duplicate-detection panel**.
- **REC-04 New patient 2/6 · Contact & address** — phones, e-mail, address, region/city, preferred language, communication consent.
- **REC-05 New patient 3/6 · Guarantor & emergency contact** — relationship, contact details, "same as patient" toggle; for minors: legal guardian.
- **REC-06 New patient 4/6 · Insurance / payer** — payer type (self-pay, insurance, company, charity), scheme, policy no., validity, scan card, **eligibility check** button (REC-41).
- **REC-07 New patient 5/6 · Consents & documents** — consent checklist with signature pad, ID scan upload (FILE-03 inline).
- **REC-08 New patient 6/6 · Review** — summary cards with edit shortcuts, create.
- **REC-09 Registration success** — patient card preview (PRN-01), print card/wristband, CTA "Créer une visite".
- **REC-10 Possible duplicate** — side-by-side comparison with match-score and differing fields highlighted; actions: use existing / not a duplicate / request merge.
- **REC-11 Edit patient** — tabbed form (identity, contact, guarantor, insurance, history of changes).
- **REC-12 Merge request** — choose surviving record, field-by-field selection, reason, submit for approval (approval handled by admin/records).
- **REC-13 Patient front-desk view** — PTS-03 variant: banner, demographics, visits, appointments, billing balance, documents (no clinical tabs; show locked clinical tab state).

### Visits (outpatient)
- **REC-14 Create visit** — visit type (new / follow-up / referral / walk-in), department, doctor, payer, priority, referral source, **fee preview** and eligibility result, follow-up free-period rule indicator.
- **REC-15 Visit created** — success, print ticket (PRN-09), "Envoyer en caisse" / "Envoyer en file d'attente", visit number.
- **REC-16 Today's visits** — table with status (registered, paid, in queue, with doctor, done).
- **REC-17 Visit detail / edit / cancel** — change doctor/department, cancel with mandatory reason, audit trail.

### Appointments
- **REC-18 Appointment calendar** — day/week/month, resource columns per doctor/room, color by status, drag to reschedule, filters, legend.
- **REC-19 New appointment** — patient select/create, doctor, slot picker, type & duration, notes, reminder channels, conflict warnings.
- **REC-20 Appointment drawer** — details + actions (check-in, reschedule, cancel, no-show, print, call patient).
- **REC-21 Check-in** — scan appointment QR or search, verify identity (photo, DOB), confirm payer, proceed to payment/queue; tablet kiosk variant.
- **REC-22 Reschedule / bulk reschedule** — single dialog + bulk flow when a doctor is absent (affected list, auto-propose slots, notify).
- **REC-23 Waitlist** — list, priority, auto-fill suggestion when a slot frees, contact attempts log.
- **REC-24 Doctor schedules** — read-only weekly templates, leaves/exceptions, availability heat-map.
- **REC-25 Walk-in fast path** — one-page registration + visit for repeat patients (search → confirm → visit → ticket).

### Queue
- **REC-26 Queue board** — lanes per counter/doctor, tickets with wait time & priority, actions: call next, recall, skip, transfer, pause counter; sound/announcement indicator; tablet variant.
- **REC-27 Issue ticket** — manual ticket for a service (consultation, lab, pharmacy, cashier), priority categories (elderly, disability, pregnant, emergency), print.
- **REC-28 Open/close counter session** — choose counter & services, status, break mode.

### Admissions, beds, ADT (administrative)
- **REC-29 Bed board** — wards as grids of bed tiles (free/occupied/reserved/cleaning/isolation/out-of-service), occupancy %, filters (ward, gender, isolation), click bed → patient/assign.
- **REC-30 Admission 1/4 · Patient & type** — select patient, admission type (planned/emergency/transfer-in), admitting doctor, department, diagnosis (reason), expected stay.
- **REC-31 Admission 2/4 · Ward & bed** — ward and bed picker with requirements (isolation, gender, ICU), reservation.
- **REC-32 Admission 3/4 · Financial guarantee** — deposit amount, payer authorization/pre-auth status, estimate; send to cashier.
- **REC-33 Admission 4/4 · Consents & wristband** — consent forms with signatures, wristband preview/print (PRN-02), belongings inventory.
- **REC-34 Admission confirmed** — summary, handoff notification to nursing, print pack.
- **REC-35 Inpatient list** — current admissions table (bed, ward, doctor, day count, balance), filters, row actions (transfer, discharge, view).
- **REC-36 Transfer** — bed/ward/department transfer dialog: destination bed picker, reason, notify nursing and cashier.
- **REC-37 Administrative discharge** — clearance checklist (billing cleared, pharmacy returns, belongings, documents, follow-up appointment), blocking reasons, discharge confirmation.
- **REC-38 ADT log & census** — admissions/discharges/transfers table with filters and daily census chart; export.

### Emergency
- **REC-39 Emergency quick registration** — unknown/unconscious patient: auto temporary ID, minimal fields (sex, approximate age, arrival mode, complaint), triage hand-off, band print.
- **REC-40 Reconcile identity** — find the real patient, compare, merge temporary record (confirmation, audit).

### Insurance
- **REC-41 Eligibility check** — request → result card (covered/not, coverage %, limits, copay, validity) with error states (service unavailable, policy expired).
- **REC-42 Pre-authorization request** — service/procedure, estimate, attachments, submit, status tracker (draft → sent → approved/denied), history.

### Documents, printing, referrals, reminders
- **REC-43 Patient documents** — FILE-01 scoped variant (ID scans, insurance cards, consents).
- **REC-44 Print center** — cards, wristbands, stickers, tickets; reprint with mandatory reason; printer status.
- **REC-45 Referral source register** — capture referral (doctor, agency, campaign), list, simple stats (marketing referral).
- **REC-50 Visitor management ★** — visitor check-in/out, badge, restricted-hours rules, current visitors list.
- **REC-51 Reminder log** — appointment reminders sent/failed (SMS/e-mail), resend, bounce reasons.

### Reports
- **REC-46 Daily registrations** · **REC-47 Appointment utilization & no-show rate** · **REC-48 Queue wait times** · **REC-49 Admission census** — each as a report viewer (filters, chart, table, export PDF/CSV).

**Required extra states:** payer ineligible, doctor on leave, no beds available (waitlist for bed), printer offline, duplicate suspected, restricted record encountered (PTS-07), session timeout during long registration (draft saved).

**Screen count — Part 3:** **51 screens** (REC-01 … REC-51).
