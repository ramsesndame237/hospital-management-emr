# PART 1 — SHARED SCREENS (used by several profiles)

Follow Part 0 for the design system, states and naming. Frames: desktop 1440×1024 unless stated; show mobile 390×844 where marked **(M)**; dark mode where marked **(D)**.

---
## 1.A AUTHENTICATION & ACCOUNT LIFECYCLE (`AUTH-xx`)
Split-screen layout used by every staff sign-in screen: left brand panel (**solid** `brand/deep` fill — no gradient, no blur — with logo, headline "Les soins, en toute sécurité", 4 reassurance points as bordered rectangles: access by role · two-factor authentication · full traceability · FR/EN; a thin one-color heartbeat line), right panel with the form panel (square corners, 1 px border, no shadow), language + theme switch top-right, security footer ("Accès réservé au personnel autorisé. Toutes les connexions sont journalisées.").

| ID | Screen | Content & behaviour |
|---|---|---|
| AUTH-01 | Staff sign-in **(M)(D)** | Username, password (show/hide), primary "Se connecter", "Mot de passe oublié ? Contactez l'administrateur / Réinitialiser". Variants: default, validation errors, submitting, "session expired" notice, generic wrong-credentials alert. |
| AUTH-02 | Two-step verification **(M)** | 6-digit code field (large, auto-advance, paste support), verify, "Use a recovery code", "Back". States: wrong code, expired code, submitting. |
| AUTH-03 | Recovery-code entry | Single code field `ABCDE-FGHJK`, warning that each code is single-use and how many remain (after success a toast "7 codes restants"). |
| AUTH-04 | Sign-in failure states | Full set as separate frames: invalid credentials (same message for unknown/locked/disabled accounts — do NOT reveal which), rate-limited ("Trop de tentatives, réessayez dans 1 min"), network error, server unavailable. |
| AUTH-05 | Session expired | Modal over blurred page + full-page version; "Reconnectez-vous pour continuer" keeps the page the user was on. |
| AUTH-06 | Idle timeout warning | Modal with countdown ring (e.g. 60 s), "Rester connecté" / "Se déconnecter"; unsaved clinical note reassurance ("Brouillon enregistré"). |
| AUTH-07 | First sign-in · step 1/3 Change temporary password | Stepper, current temp password, new password with live policy checklist (≥12 chars, not common, not containing username/e-mail), strength meter, breach-check result ("Ce mot de passe est apparu dans une fuite de données"), confirm field. |
| AUTH-08 | First sign-in · step 2/3 Enrol authenticator | Explanation (Google/Microsoft Authenticator, Aegis…), QR code, manual secret with copy, 6-digit verification field, troubleshooting accordion. |
| AUTH-09 | First sign-in · step 3/3 Recovery codes | 10 single-use codes grid, Copy / Download .txt / Print, forced checkbox "J'ai conservé ces codes en lieu sûr" before continuing. |
| AUTH-10 | Account ready | Success illustration, summary of what was set up, "Accéder à mon espace" CTA. |
| AUTH-11 | Forgot password — request | Identifier/e-mail field, privacy-safe confirmation wording. |
| AUTH-12 | Forgot password — check your inbox | Confirmation, resend timer, "Contact your administrator" fallback. |
| AUTH-13 | Reset password (from link) | New password + policy checklist; states: valid link, **expired/invalid link**, success. |
| AUTH-14 | Account locked / need help | Friendly page explaining lockout after repeated failures, automatic unlock timing, how to contact the administrator, support code. |
| AUTH-15 | Signed out | Confirmation + "Se reconnecter", note to close the browser on shared computers. |
| AUTH-16 | 403 Forbidden | "Vous n'avez pas accès à cette page" + request-access action. |
| AUTH-17 | 404 Not found | Friendly, search + home link. |
| AUTH-18 | 500 Server error | Support code, retry, status page link. |
| AUTH-19 | Maintenance / offline | Planned-maintenance page with end time; offline banner variant for tablets. |
| AUTH-20 | Break-glass access | Modal: patient name, reason (select + free text, required), emergency attestation checkbox, "Cet accès sera immédiatement signalé au DPO"; then the **persistent red "Accès d'urgence actif" banner** with timer and "Terminer". |
| AUTH-21 | Patient portal sign-in **(M)** | Lighter, friendlier variant of AUTH-01 for patients (phone/e-mail/identifier), optional MFA step. |
| AUTH-22 | Patient account activation **(M)** | Landing from invitation link: verify identity (date of birth + last 4 of phone), set password, optional MFA, accept terms/consent. States: expired invitation. |
| AUTH-23 | Select working context | After login for staff with several sites/units: site, department/ward/lab bench/cash counter/pharmacy counter, shift; "remember for today". |

### Flows (wire these)
- **F-AUTH-01 Standard sign-in:** AUTH-01 → AUTH-02 → AUTH-23 → (role dashboard, see each profile part).
- **F-AUTH-02 Recovery code:** AUTH-01 → AUTH-02 → AUTH-03 → AUTH-23 → dashboard.
- **F-AUTH-03 First sign-in of a new account:** AUTH-01 → AUTH-07 → AUTH-08 → AUTH-09 → AUTH-10 → AUTH-02 → AUTH-23 → dashboard.
- **F-AUTH-04 Forgot password:** AUTH-01 → AUTH-11 → AUTH-12 → AUTH-13 (valid) → AUTH-01 ; AUTH-13 (expired) → AUTH-11.
- **F-AUTH-05 Failures:** AUTH-01 → AUTH-04 (each variant) → AUTH-14 (after lockout).
- **F-AUTH-06 Session lifecycle:** any screen → AUTH-06 → (stay) back to screen | (ignore) AUTH-05 → AUTH-01 (returns to previous page) ; any screen → AUTH-15.
- **F-AUTH-07 Break-glass:** PTS-07 → AUTH-20 → PTS-03 with red banner → "Terminer" → PTS-07.
- **F-AUTH-08 Patient activation:** e-mail invitation → AUTH-22 → AUTH-21 → PAT-01.

---
## 1.B APP SHELL & PERSONAL SPACE (`SHELL-xx`)
| ID | Screen | Content & behaviour |
|---|---|---|
| SHELL-01 | Desktop shell **(D)** | Sidebar (grouped menu, counters, collapse), top bar (breadcrumbs, ⌘K search, patient-context chip, notifications, help, language, theme, user menu). Provide one instance per profile showing that profile's menu (the menu content is listed in each profile part). |
| SHELL-02 | Collapsed sidebar | Icon rail with tooltips and flyout groups. |
| SHELL-03 | Tablet shell | Icon rail + bottom action bar, touch sizing. |
| SHELL-04 | Mobile staff shell **(M)** | Bottom tabs (max 5) + "More" sheet. |
| SHELL-05 | Global search / command palette | Search patients (name, MRN, phone), pages, actions ("Nouvelle admission"), recent items; results filtered by permission; keyboard hints. |
| SHELL-06 | Notifications center **(M)** | Tabs Tous / Tâches / Alertes / Système; **critical results & alerts pinned**, mark-all-read, per-item deep links, empty state. |
| SHELL-07 | User menu & quick switch | Avatar menu: profile, security, preferences, switch working context, language, theme, sign out; shows role, facility, last sign-in. |
| SHELL-08 | My profile | Identity, contact, role(s), department, photo upload, signature image (clinicians), licence number. |
| SHELL-09 | Security & sessions | Change password, MFA status, **regenerate recovery codes** (re-auth with MFA), active sessions list (device, location, last activity, "Révoquer"), recent sign-ins & failed attempts. |
| SHELL-10 | Preferences | Language, theme (light/dark/system), density (comfortable/compact), default landing page, notification channels, keyboard shortcuts. |
| SHELL-11 | Help & support | Help articles search, contact form → helpdesk ticket creation, **my tickets** list and ticket detail thread. |
| SHELL-12 | About & shortcuts | Version, licence, keyboard-shortcuts overlay. |
| SHELL-13 | Open-patients switcher | Tab strip/drawer of up to 6 patients open at once with unsaved-state indicators (critical for clinicians). |

**Flow F-SHELL-01 Security self-service:** SHELL-07 → SHELL-09 → regenerate codes (MFA confirm dialog) → new codes view (same layout as AUTH-09) → SHELL-09.
**Flow F-SHELL-02 Raise a ticket:** SHELL-11 → ticket form → confirmation → my tickets → ticket detail.

---
## 1.C PATIENT SEARCH & PATIENT RECORD SHELL (`PTS-xx`) — shared by clinical & front-office staff
The visible sections of the patient record depend on the viewer's role (receptionist: demographics/visits/billing; cashier: billing; lab: orders/results; pharmacist: medications/prescriptions; nurse/doctor: everything clinical). Show a **role-based variant matrix** of PTS-03.
| ID | Screen | Content & behaviour |
|---|---|---|
| PTS-01 | Patient search | Search by name, MRN, phone, national ID, QR/barcode scan, DOB; recent patients; "Nouveau patient" shortcut where permitted. |
| PTS-02 | Search results | Results with photo, age/sex, MRN, last visit, status; **possible-duplicate warning**; empty ("Aucun patient — créer ?"). |
| PTS-03 | Patient 360 overview **(M)** | Sticky patient banner + summary cards (active problems, allergies, current medications, upcoming appointments, recent visits, latest results, alerts, outstanding balance). |
| PTS-04 | Patient timeline | Chronological events (visits, orders, results, notes, admissions, documents) with filters and type icons. |
| PTS-05 | Patient documents tab | Embeds FILE-01 scoped to the patient's folder. |
| PTS-06 | Record access log | "Qui a consulté ce dossier" table (who, when, what, reason) — visible to the patient (portal) and to DPO. |
| PTS-07 | Restricted record gate | VIP/staff-member/sensitive record warning → request access → break-glass (AUTH-20) or cancel. |
**Flow F-PTS-01:** SHELL-05 or PTS-01 → PTS-02 → PTS-03 → (PTS-04 | PTS-05 | PTS-06). **Flow F-PTS-02:** PTS-02 → PTS-07 → AUTH-20 → PTS-03.

---
## 1.D FILE & IMAGE MANAGER (`FILE-xx`) — folders, documents, medical photos
Classification badges: **Public · Internal · Confidential · Clinical** (Clinical needs care relationship or break-glass). Files are never publicly linked.
| ID | Screen | Content & behaviour |
|---|---|---|
| FILE-01 | Explorer **(M)** | Folder tree left, list/grid toggle, breadcrumbs, search, filters (type, classification, date, owner, patient), bulk actions, storage chip. |
| FILE-02 | Folder dialogs | Create / rename / move (tree picker) / delete-with-contents confirmation. |
| FILE-03 | Upload | Drag-and-drop zone, multi-file queue with progress, classification select, link to patient/visit, "scan en cours" status per file. |
| FILE-04 | Upload errors | Frames for: type not allowed, file too large, **malware detected → quarantined** (explain, notify admin), integrity (checksum) mismatch, network interruption with resume. |
| FILE-05 | Preview | Image viewer (zoom/rotate), PDF viewer (pages, search), metadata side panel, download/print. |
| FILE-06 | File details & versions | Metadata, SHA-256 integrity ✔, version history with restore, who accessed (log). |
| FILE-07 | Share & permissions | Access list by user/role/department with read/edit, expiring access, explanation that downloads use short-lived secure links (60 s). |
| FILE-08 | Trash | Deleted items with retention countdown, restore / purge (confirm with reason). |
| FILE-09 | Clinical access gate | "Document clinique — relation de soin requise" → request/break-glass. |
| FILE-10 | Clinical photo gallery | Grid of wound/dermatology photos by date, **before/after compare slider**, annotations. |
| FILE-11 | Storage overview | Usage by folder/classification, growth chart, quarantine count. |
**Flow F-FILE-01 Upload:** FILE-01 → FILE-03 → (success → FILE-01 | error → FILE-04). **Flow F-FILE-02 Review & share:** FILE-01 → FILE-05 → FILE-06 → FILE-07. **Flow F-FILE-03 Delete & restore:** FILE-01 → delete confirm → FILE-08 → restore.

---
## 1.E PRINT / PDF TEMPLATES (`PRN-xx`) — design each as a print-ready frame with letterhead (logo, facility name, address, phone), footer (page x/y, generated-by, timestamp), barcode/QR where noted
PRN-01 Patient ID card (85×54 mm, photo, QR) · PRN-02 Wristband (adult / child / newborn variants, barcode) · PRN-03 Specimen label (barcode, patient, test, date) · PRN-04 Prescription (A5, Rx lines, doctor signature, QR verify) · PRN-05 Lab report (patient, tests, ranges, flags, verifier) · PRN-06 Imaging report (findings, impression, radiologist signature) · PRN-07 Invoice (A4, items, taxes, insurer/patient split, payment status) · PRN-08 Receipt (80 mm thermal) · PRN-09 Appointment slip / queue ticket · PRN-10 Discharge summary · PRN-11 Medical certificate / sick leave · PRN-12 Referral letter · PRN-13 Consent form with signature fields · PRN-14 Medication/dispensing label (patient, drug, dose, instructions, expiry, warnings pictograms) · PRN-15 Payslip · PRN-16 Compliance/audit report cover & summary page · PRN-17 Birth notification (maternity).

---
## 1.F WALL / TV DISPLAYS (`TV-xx`) — 1920×1080, high contrast, large type, readable from 8 m
TV-01 Waiting-room queue display (now serving per counter/doctor, next 5 tickets, audio-call cue indicator, multilingual ticker, clock) · TV-02 Emergency tracking board (staff wall: patient initials, triage color, location, waiting time, assigned doctor, status, alerts) · TV-03 Pharmacy pick-up screen (ticket numbers: preparing / ready).

---
**Screen count — Part 1:** AUTH 23 · SHELL 13 · PTS 7 · FILE 11 · PRN 17 · TV 3 = **74 screens** (each with the states required by §0.7).
