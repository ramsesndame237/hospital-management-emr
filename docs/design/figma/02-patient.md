# PART 2 — PROFILE 1 · PATIENT (external user, mobile-first portal) — `PAT-xx`

**Who:** patients and, with delegation, their relatives/dependents. **Goal:** self-service without calling the hospital. **Tone:** reassuring but sober (same corporate, flat, square-cornered style as the staff screens — see the strict style rules in Part 0), plain language, large type, no jargon (explain medical terms). **Permissions:** own data only (`own` scope); never other patients; no staff tools. Design **mobile 390×844 first**, then a responsive desktop (1280) layout with a left sidebar. Mark ★ = proposed feature not in the legacy application (keep, but tag ★ in the frame name).

**Navigation (mobile bottom tabs):** Accueil · Rendez-vous · Résultats · Factures · Plus (documents, ordonnances, vaccins, assurance, proches, confidentialité, messages ★, aide). **Desktop sidebar:** same entries expanded.

## Flows
- **F-PAT-00 Onboarding:** AUTH-22 → AUTH-21 → PAT-47 (first-time tour) → PAT-01.
- **F-PAT-01 Book an appointment:** PAT-01 / PAT-02 → PAT-03 → PAT-04 → PAT-05 → PAT-06 → PAT-07 → PAT-08. Alternate: no availability → waitlist sheet on PAT-05.
- **F-PAT-02 Reschedule / cancel:** PAT-08 → PAT-09 → PAT-07 ; PAT-08 → PAT-10 → PAT-02 (status cancelled).
- **F-PAT-03 Pre-check-in (★):** PAT-08 → PAT-11 → PAT-08 (status "prêt").
- **F-PAT-04 See results:** PAT-01 (new-result badge) or notification → PAT-15 → PAT-16 ; imaging: PAT-17 → PAT-18.
- **F-PAT-05 Visits & discharge:** PAT-12 → PAT-13 → PAT-14.
- **F-PAT-06 Prescriptions & refill:** PAT-19 → PAT-20 → PAT-21 → status chip on PAT-19. ★ PAT-22 reminders.
- **F-PAT-07 Pay an invoice:** PAT-25 → PAT-26 → PAT-27 (select → processing → success | failure → retry) → PAT-28.
- **F-PAT-08 Insurance:** PAT-29 (scan/upload card) → PAT-31 → PAT-29.
- **F-PAT-09 Documents:** PAT-30 → PAT-31 → PAT-32.
- **F-PAT-10 Profile:** PAT-33 → PAT-34 (OTP verify) / PAT-35.
- **F-PAT-11 Family (★):** PAT-36 → add dependent → verify relationship → switch person (banner shows "Vous consultez le dossier de …").
- **F-PAT-12 Privacy rights:** PAT-37 → PAT-38 (consent changes) ; PAT-37 → PAT-39 (export) ; PAT-37 → PAT-40 (correction/erasure) — each with re-authentication step and request status tracker.
- **F-PAT-13 Messages (★):** PAT-42 inbox → thread → compose → sent.
- **F-PAT-14 Feedback (★):** notification after visit → PAT-46 → thank-you.
- **F-PAT-15 Security:** PAT-45 → change password / manage MFA / sessions.

## Screens
### Home
- **PAT-01 Home dashboard** — greeting, next appointment card (countdown, directions, check-in QR), "Nouveaux résultats" badge, unpaid bills summary, medication reminders (★), quick actions (Prendre RDV, Mes ordonnances, Mes documents), health-summary strip, facility emergency number.
- **PAT-47 First-time tour** — 3–4 swipeable cards (appointments, results, privacy) + notification permission ask.

### Appointments
- **PAT-02 Appointments** — tabs À venir / Passés / Annulés; card list; empty state with "Prendre rendez-vous".
- **PAT-03 Book 1/4 · Reason & specialty** — search + popular reasons + specialties grid; "Pour moi / pour un proche (★)".
- **PAT-04 Book 2/4 · Doctor & location** — doctor cards (photo, specialty, languages, next availability, consultation fee), filters (location, gender, language), "Peu importe".
- **PAT-05 Book 3/4 · Date & time** — week strip + calendar, time-slot chips grouped morning/afternoon, no-slot state with **waitlist** option.
- **PAT-06 Book 4/4 · Review & confirm** — summary, payer (self / insurance), reminder channels, preparation notes, terms; submit.
- **PAT-07 Booking confirmed** — success, add to calendar, share, get directions, check-in QR, what to bring.
- **PAT-08 Appointment detail** — status timeline (booked → confirmed → checked-in → done), doctor, location map, instructions, documents to bring, actions (reschedule / cancel / pre-check-in ★).
- **PAT-09 Reschedule** — slot picker with current slot highlighted, change reason.
- **PAT-10 Cancel** — reason select, cancellation policy, confirm dialog.
- **PAT-11 Pre-check-in ★** — update contact, insurance, medical questionnaire, consents, e-signature; progress bar; save & resume.

### Care records (read-only)
- **PAT-12 Visit history** — chronological list, filters (year, type: consultation/hospitalisation/urgence).
- **PAT-13 Visit detail** — date, doctor, reason, diagnoses (plain language), procedures, prescriptions given, linked results, linked invoice, documents.
- **PAT-14 Discharge summary** — hospital stay summary, instructions at home, follow-up appointment, warning signs, download PDF.
- **PAT-15 Lab results** — list with status chips (normal / à voir / en attente), "nouveau" badge, filters.
- **PAT-16 Lab result detail** — values vs reference range with visual scale, flags, plain-language explanation, trend chart over time, download PDF, "Poser une question" (★ → messages).
- **PAT-17 Imaging reports** — list (modality icon, body part, date).
- **PAT-18 Imaging report detail** — report text/impression, "Demander mes images (CD/lien sécurisé)".
- **PAT-19 Medications & prescriptions** — Actives / Terminées tabs, refill-status chips.
- **PAT-20 Prescription detail** — drugs, dosage, duration, instructions, doctor, pharmacy pick-up QR, refill button.
- **PAT-21 Refill request** — select items, preferred pharmacy, notes, confirmation, status tracker (reçu → en préparation → prêt).
- **PAT-22 Medication reminders ★** — schedule, snooze, adherence calendar, notification settings.
- **PAT-23 Vaccination record** — card/timeline, due-next badge, download certificate.
- **PAT-24 Allergies & conditions** — read-only summary with "Signaler une erreur" action.

### Billing & insurance
- **PAT-25 Invoices** — tabs À payer / Payées / En attente assurance, total outstanding.
- **PAT-26 Invoice detail** — line items, insurer vs patient share, discounts, balance, download PDF.
- **PAT-27 Pay online** — three frames: choose method (mobile money / card), processing, success **and** failure with retry.
- **PAT-28 Payment history & receipts** — list, download receipt.
- **PAT-29 Insurance & coverage** — insurer card visual, policy number, validity, eligibility status, update card (camera).

### Documents
- **PAT-30 My documents** — folders (Identité, Assurance, Médical, Imagerie, Autres), grid/list; uses FILE-01 patient variant **(M)**.
- **PAT-31 Upload** — camera scan / gallery / file, classification (only allowed ones), progress, scan status.
- **PAT-32 Document viewer** — image/PDF with download & share-with-doctor (★).

### Profile & family
- **PAT-33 My profile** — photo, identity, contact, language preference.
- **PAT-34 Edit contact** — phone/e-mail change with OTP verification dialog.
- **PAT-35 Emergency contacts & next of kin** — list, add/edit.
- **PAT-36 My family ★** — dependents list, add dependent (relationship proof), switch person, revoke access.

### Privacy & security (RGPD)
- **PAT-37 Privacy center** — "Qui a consulté mon dossier" (PTS-06 patient variant: staff role & date, no clinical content), consent summary, my rights shortcuts.
- **PAT-38 Consent management** — per purpose toggles (care sharing, research, marketing, portal communications), signed-consents list, history.
- **PAT-39 Data export request** — explanation, format choice, re-authentication, confirmation, request tracker, download when ready (expiring link).
- **PAT-40 Correction / erasure request** — select data, justification, legal-retention explanation, submit, tracker.
- **PAT-45 Security** — patient variant of SHELL-09 (password, optional MFA, sessions, recovery codes).

### Communication & info
- **PAT-41 Notifications & preferences** — channels (SMS/e-mail/push), categories (appointments, results, billing, reminders), quiet hours; inbox of notifications.
- **PAT-42 Secure messages ★** — inbox, thread, compose with attachment, "Non urgent — en cas d'urgence appelez le …" notice, triage tags.
- **PAT-43 Facility information** — departments, opening hours, map/directions, parking, emergency numbers, visitor rules.
- **PAT-44 Help & contact** — FAQ search, contact options, call/WhatsApp buttons.
- **PAT-46 Satisfaction survey ★** — 1–5 face scale, comments, thanks.

**Required extra states for this profile:** results "en attente de validation", "résultat sensible — à discuter avec votre médecin" (hidden until clinician release), session expired, no network (offline banner), dependent-mode banner, accessibility variant with 125% text size.

**Screen count — Part 2:** **47 screens** (PAT-01 … PAT-47), mobile + desktop responsive, dark mode samples for PAT-01, PAT-16, PAT-25.
