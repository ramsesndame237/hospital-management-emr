# PART 0 — GLOBAL BRIEF & DESIGN SYSTEM (read this first, applies to every screen)

> You are a senior healthcare product designer. Design the COMPLETE UI of **Sanjeevani EMR**, a hospital management platform (Electronic Medical Record + hospital operations) used by every kind of hospital staff and by patients. Produce ALL screens, ALL states and ALL flows listed in the following parts. **Do not skip, merge or summarize any screen.** Every screen ID listed (e.g. `PAT-07`) must exist as its own named frame. If a screen is listed, design it; if a flow is listed, wire it as a prototype connection.

## 0.1 Product in one paragraph
A secure, multilingual (French primary, English parity) web platform for a hospital or clinic network in francophone Africa. It covers: patient registration & appointments, outpatient consultations, inpatient care (admission/ADT, wards, beds, nursing), emergency, laboratory, radiology/imaging (DICOM), pharmacy & dispensary, inventory & ward supply, billing & cash, insurance claims, accounting, payroll, fixed assets, reporting, a document/file manager, a patient portal, and administration & security (roles, audit, privacy). Health data is extremely sensitive: the UI must make security visible but never obstructive (MFA, session timeout warnings, audit banners, break-glass access with reason, masked sensitive fields).

> **Convention ★:** a feature marked ★ is a *proposed* addition that does not exist in the legacy application. Design it, and add the suffix ` ★` to the frame name so it can be reviewed separately.

## 0.2 The 11 user profiles (design order = from FEWEST features to MOST)
1. **Patient** (external, mobile-first portal) — Part 2
2. **Receptionist / Admission desk** — Part 3
3. **Cashier / Billing** — Part 4
4. **DPO / Auditor** (privacy & compliance, read-mostly) — Part 5
5. **Accountant** — Part 6
6. **Laboratory technician** — Part 7
7. **Radiologist / imaging** — Part 8
8. **Pharmacist** — Part 9
9. **Nurse** — Part 10
10. **Doctor** — Part 11
11. **System administrator** — Part 12 (manages accounts, settings and security; **has NO access to clinical patient data** — separation of duties; show this explicitly in the UI)

Shared screens used by several profiles (authentication, app shell, file manager, printing templates, queue TV display) are in **Part 1**. A role only sees the menu entries and actions its permissions allow; where a permission is partial show a **locked / "not available for your role"** state rather than hiding silently, at least once per profile.

## 0.3 Figma file structure (create exactly this)
- Page `00 · Design System` — tokens (as Figma Variables with Light/Dark modes), type, icons, every component with all variants & states, patterns, empty-state illustrations.
- Page `01 · Shared` — Part 1 screens.
- Pages `02 · Patient` … `12 · System admin` — one page per profile. On each page: a **Flow Index** frame at the top (the flow diagrams as connected frames with arrows), then the screens grouped by section (sections named after the menu entries).
- Frame naming: `ID · French title` (e.g. `PAT-07 · Détail du rendez-vous`). States as variants or adjacent frames named `ID · title — vide / chargement / erreur`.
- Frame sizes: **Desktop 1440×1024** (default for all staff), **Tablet 1024×768** (nurse bedside, doctor rounds, pharmacy counter, cash desk variants), **Mobile 390×844** (entire patient portal + mobile variants of: login, notifications, nurse vitals entry, nurse MAR, doctor results inbox, doctor schedule), **TV 1920×1080** (queue display). Provide a Dark-mode version of at least: login, dashboard of each profile, one data table, one form.
- Wire prototype connections for every flow in each profile's **Flows** section (use the exact screen IDs).

## 0.4 Visual identity & inspiration
**Sober, corporate, trustworthy and efficient — an enterprise application, not a consumer app.** Take the information density and safety patterns of Epic Hyperspace / Cerner / Athenahealth (clinician side), the structure of enterprise ERP and admin consoles (finance, administration), and the clarity of Doctolib (patient side, still restrained). Generous whitespace on patient screens, **compact high-density mode** on clinical tables and worklists.

> ### STRICT STYLE RULES (apply to EVERY screen and component — do not break them)
> 1. **Flat design only. NO gradients anywhere** — not in backgrounds, hero/brand panels, buttons, cards, charts or illustrations. Every fill is a **solid color** from the tokens below. Area charts use a flat fill at 12% opacity, never a fade.
> 2. **No rounded, bubbly or "soft" shapes.** Corners are square or nearly square (see radii below). **No pill shapes** (badges and segmented controls are rectangular). Circles are allowed ONLY for avatars and tiny status dots.
> 3. **No glassmorphism, blur/backdrop effects, glow, neon or decorative shadows.** Separate surfaces with **1 px borders** and spacing, not shadows.
> 4. No decorative illustrations or mascots. Empty states use a simple 1-color line icon (monochrome, no gradient).
> 5. Restrained palette: neutrals + one brand color; color is used for meaning (status, severity) and for primary actions only.

Photos: only patient/staff avatars and medical images.

### Color tokens (create as Variables; Light / Dark)
| Token | Light | Dark | Use |
|---|---|---|---|
| `brand/primary` | #0B6E8A | #38BDD6 | primary actions, active nav, links |
| `brand/primary-strong` | #07556B | #7DD6E8 | hover/pressed |
| `brand/deep` | #06324A | #04202F | sidebar and brand-panel background — **solid fill, never a gradient** |
| `brand/accent` | #14B8A6 | #2DD4BF | highlights, positive emphasis, progress |
| `surface/bg` | #F4F7FA | #0A121C | app background |
| `surface/card` | #FFFFFF | #111D2B | cards, tables |
| `surface/raised` | #FFFFFF | #16263A | popovers, dialogs |
| `border/default` | #DBE3EC | #223448 | dividers |
| `text/primary` | #0F1B2D | #E8EEF6 | body |
| `text/muted` | #5A6B80 | #9DB0C5 | secondary |
| `status/critical` | #B42318 | #FF8F85 | critical values, allergies, errors, destructive |
| `status/warning` | #B54708 | #FDB022 | abnormal, expiring, pending approval |
| `status/success` | #067647 | #62D49A | normal, completed, paid |
| `status/info` | #175CD3 | #84ADFF | information, in progress |
| `status/neutral` | #475467 | #98A2B3 | draft, cancelled, inactive |
Clinical semantic palettes (each with bg / border / text, light+dark):
- **Triage (ESI 1–5):** 1 red #D92D20 · 2 orange #F79009 · 3 yellow #FDB022 · 4 green #12B76A · 5 blue #2E90FA.
- **Lab flags:** normal (neutral) · low (blue) · high (amber) · critical low/high (red, bold, with icon) · pending (grey).
- **Bed status:** free (green) · occupied (teal) · reserved (blue) · cleaning (amber) · isolation (purple) · out-of-service (grey hatched).
- **Appointment status:** booked · checked-in · in consultation · completed · no-show · cancelled · rescheduled.
- **Order/Result lifecycle:** ordered → collected → received → in analysis → resulted → verified → released (stepper with colors).
- **Medication status (MAR):** scheduled · due now · given · late · held · refused · not given · discontinued.
- **Data-viz categorical (8):** #0B6E8A #14B8A6 #F79009 #7A5AF8 #2E90FA #EE46BC #67A00C #D92D20 (color-blind safe; always pair color with icon/label/pattern).

### Typography
Inter (UI) + JetBrains Mono (IDs, codes, barcodes, lab values alignment). Scale: Display 36/44 · H1 28/36 · H2 22/30 · H3 18/26 · Body 14/22 (clinical tables 13/20 in compact mode) · Small 12/18 · Overline 11/16 caps +6% tracking. Tabular numerals everywhere numbers are compared (labs, vitals, money). Min body size 14px (16px on mobile inputs).

### Shape, space, elevation, motion
4/8 px grid · **radii: 0 px for tables, data grids, banners, sidebars and cards; 2 px for inputs, buttons, dialogs, popovers and badges (rectangular tags); never more than 4 px anywhere; no pills** · **elevation: none — 1 px borders (`border/default`) instead of shadows**; the only permitted shadow is a hairline `0 1px 2px rgba(15,27,45,.16)` under popovers, menus and dialogs · focus ring: 2 px solid `brand/primary`, offset 2 px, no glow · motion 100–200 ms ease-out, none when reduced-motion.

### Iconography
Lucide-style 1.75px stroke, 20px default. Medical set to include: stethoscope, pill, syringe, vial/test-tube, microscope, x-ray/scan, bed, ambulance, heart-pulse, thermometer, droplet (blood), baby, activity (vitals), clipboard-list, file-medical, shield-check, lock, scan-barcode, printer, qr-code, calendar-clock, hospital, wheelchair, bandage, dna.

## 0.5 Component library (design every component with ALL variants & states: default, hover, focus, active, disabled, loading, error, read-only; light+dark; comfortable+compact)
**Foundations:** Button (primary, secondary, outline, ghost, destructive, link; sizes xs–lg; icon-only; loading; split button) · Input, Textarea, Password (show/hide), OTP/6-digit code input, Search input, Number with unit, Currency (FCFA, thousands separators), Phone (+237…), Date, Date-range, Time, Date-time, Select, Combobox (async search with recent items), Multi-select with chips, Tags input, Checkbox, Radio, Switch, Slider, Segmented control, Stepper (wizard), Tabs, Accordion, Breadcrumbs, Pagination, Tooltip, Popover, Dropdown/Context menu, Command palette (global search), Dialog (sm/md/lg/full), Confirmation dialog (with required reason field for critical actions), Drawer/Side sheet, Toast/Snackbar, Inline Alert (info/success/warning/critical), Banner (system-wide), Badge/Status tag (rectangular, 2 px radius, never a pill), Avatar (with presence/role), Skeleton loaders, Empty state, Error state, Progress (bar, ring, steps), File dropzone with per-file progress, Calendar (month/week/day/agenda with resources), Timeline, Data table (sticky header, column resize, sortable, filter chips, bulk select, row actions, density toggle, inline edit, expandable row, export menu, saved views), Kanban board, Tree view, Tag/Chip, Key-value list, Stat/KPI card with delta, Charts (line, area, bar, stacked, donut, sparkline, heat-map, Gantt-like schedule).
**Clinical components:** Patient banner (photo/initials, full name, age·sex, MRN, DOB, location/bed, attending, allergy chip(s) in red, code status, isolation flag, payer, "break-glass active" flag) in **full / compact / mobile** forms · Allergy & alert strip · Vital-sign tile (value, unit, trend sparkline, abnormal state) · NEWS2/early-warning badge · Lab result row (name, value, unit, reference range, flag, previous value, delta) · Result trend chart with reference band · Diagnosis chip (ICD-10) · Order card (lab/imaging/procedure/medication) · Medication row (drug, strength, route, frequency, duration, instructions, status) · Drug-interaction/allergy alert block (severity levels, override with reason) · MAR grid cell · Intake/Output chart · Body-diagram / pain-scale / Glasgow scale inputs · SOAP note editor with templates & macros · Signature block (e-signature, date, name, role) · Barcode/QR scan input with success/fail feedback · Bed tile · Queue ticket card · Appointment slot picker · Invoice line item & totals panel · Payment-method selector (cash, card, mobile money, cheque, insurance, credit) · Stock level bar with expiry badge and batch table · Audit-log row with integrity (hash-chain ✔/✖) badge · Permission matrix cell · File tile/row with classification badge (Public/Internal/Confidential/Clinical) · DICOM viewport frame with tool rail · Print preview frame (A4 / A5 / receipt 80mm / wristband / label).

## 0.6 Layout & navigation patterns
- **Staff shell (desktop):** left sidebar (deep teal, collapsible to icons, grouped menu with role-specific entries, badge counters), top bar (breadcrumbs · global search ⌘K · **patient context chip** when a patient is open · notifications bell · help · language FR/EN · theme · user menu), content area with page header (title, subtitle, primary action, secondary actions), optional right drawer for context. Clinical screens add the **sticky Patient banner** under the top bar.
- **Tablet shell:** icon rail + bottom action bar for bedside tasks; large touch targets (≥44px).
- **Mobile shell (patient & selected staff views):** bottom tab bar (max 5), large cards, sticky primary CTA, pull-to-refresh pattern, sheets instead of dialogs.
- **Page templates to design once and reuse:** Dashboard (KPI row + charts + task lists) · List/Index (filters, table, bulk actions) · Detail (header, tabs, side panel) · Wizard (stepper, summary rail, save draft) · Form (sections, sticky save bar) · Worklist (queue/status columns) · Split view (list + detail) · Calendar/Scheduler · Report viewer (filters, chart, table, export) · Settings (left sub-nav + form cards) · Document viewer · Print preview.

## 0.7 Mandatory states & behaviours for EVERY screen
1. **Loading** (skeleton), **empty** (illustration + guidance + primary action), **filtered-empty** (clear filters), **error** (retry + support code), **offline/session-expired** overlay, **no permission** (locked state with who to ask).
2. Forms: inline validation messages (translated, field-level + summary), required markers, unsaved-changes guard, autosave/draft indicator for long clinical notes, disabled & submitting states, success toast with undo when reversible.
3. Destructive or clinically critical actions (cancel bill, discard order, override alert, discharge, delete file, disable account) → confirmation dialog **with mandatory reason** and the consequences stated.
4. **Security UX:** idle-timeout warning modal (auto-logoff countdown), "last sign-in" info, masked sensitive fields with reveal-on-click (logged), audit footer on clinical screens ("Your access to this record is logged"), break-glass modal (reason + acknowledgement) with persistent red banner while active, MFA prompts at sensitive actions.
5. **Internationalisation:** French first, English parity; design for 30–40% longer strings; dates `24 oct. 2026`, 24-hour time, currency `12 500 FCFA`, units SI; right-sized for names with accents. No text baked into images.
6. **Accessibility:** WCAG 2.2 AA minimum, contrast ≥4.5:1, visible focus, full keyboard operation, status never conveyed by color alone, touch targets ≥44px on touch layouts, motion-reduce variants.
7. **Print/PDF:** every document listed in Part 1 §PRN has a print-ready frame.
8. **Realistic content:** use plausible francophone African sample data (names, +237 phone numbers, FCFA amounts, ICD-10 codes, real drug names with strengths, realistic lab reference ranges). Never lorem ipsum. Never real people.

## 0.8 Deliverable checklist (the AI must self-verify at the end)
- Every screen ID in Parts 1–12 exists; every flow in each **Flows** section is wired; the design-system page contains every component in §0.5; the Flow Index frame exists on each profile page; dark-mode samples exist; the final frame count per part matches the "Screen count" line at the end of that part.


---

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


---

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


---

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


---

# PART 4 — PROFILE 3 · CASHIER / BILLING — `CSH-xx`

**Who:** cashiers at counters (OPD, IPD, pharmacy counter) and billing clerks. **Goal:** bill, collect, refund, reconcile and manage insurance claims accurately with a full audit trail. **Sees:** patient identity + financial data only (never clinical details). **Rules to make visible in the UI:** every discount/cancellation/refund needs a reason and, above a threshold, a supervisor approval; every receipt reprint is logged; cash sessions must be opened before collecting and closed with a count. Desktop 1440 + a **tablet/POS compact variant** for the counter. ★ = proposed.

**Sidebar:** Tableau de bord · Caisse (session) · Facturation · Encaissements · Acomptes · Remboursements · Hospitalisation · Assurances & réclamations · Impayés · Rapports · Tarifs & archives.

## Flows
- **F-CSH-01 Cash session lifecycle:** CSH-02 → CSH-03 → CSH-04 → CSH-05.
- **F-CSH-02 OPD payment (main flow):** CSH-01 → CSH-06 → CSH-07 → [CSH-08 add item ↔ CSH-09 lookup] → [CSH-10 discount → CSH-11 approval] → CSH-12 (insurance split, if insured) → CSH-15 → CSH-16 (digital methods) → CSH-17 (receipt printed/SMS) → CSH-19.
- **F-CSH-03 Credit billing:** CSH-07 → CSH-13 (authorizer, due date) → CSH-19 (status "À crédit") → CSH-35.
- **F-CSH-04 Estimate to bill:** CSH-14 → (patient accepts) → CSH-08 → CSH-15.
- **F-CSH-05 Deposits:** CSH-22 → CSH-23 → (use at discharge CSH-28) | CSH-24 (refund remaining).
- **F-CSH-06 Refund / return:** CSH-19 → CSH-25 → approval (CSH-11) → CSH-26 (credit note) → refund method confirmation.
- **F-CSH-07 Inpatient billing:** CSH-27 (running) → CSH-29 (packages) → CSH-28 (interim → final) → clearance sent to REC-37.
- **F-CSH-08 Insurance claims:** CSH-12 → CSH-30 → CSH-31 → CSH-32 → (rejected → CSH-33 → CSH-31 resubmit) | (paid → CSH-34).
- **F-CSH-09 Outstanding follow-up:** CSH-35 → CSH-36 → CSH-15 (payment received).
- **F-CSH-10 Cancel a bill:** CSH-19 → CSH-20 (reason + approval) → CSH-19 (status cancelled, locked).
- **F-CSH-11 Reprint:** CSH-42 → CSH-21 (reason logged).

## Screens
### Home & cash session
- **CSH-01 Dashboard** — session status, collected today by method (donut), pending bills, approvals waiting, quick actions (Encaisser, Nouvelle facture, Acompte).
- **CSH-02 Open cash session** — counter, opening float counted by denomination (banknotes/coins grid), confirm.
- **CSH-03 Session overview** — running totals by payment method, transactions list, voids/discounts counters, "Clôturer".
- **CSH-04 Close session & cash count** — expected vs counted by denomination, discrepancy highlight + mandatory explanation, sign-off, supervisor co-sign if variance above limit.
- **CSH-05 Shift handover report** — printable summary (PRN-style) with totals and variances.

### Billing
- **CSH-06 Find patient / bills** — search by name/MRN/visit/invoice no./scan; recent; shows balance chip.
- **CSH-07 Pending items** — items grouped by department (consultation, lab, radiology, pharmacy, procedures, IPD) with checkboxes, totals panel, "Facturer la sélection".
- **CSH-08 Create / edit bill** — line items (service, qty, unit price, doctor, department), taxes, totals; add item opens CSH-09; save draft; lock after payment.
- **CSH-09 Price lookup** — searchable service/price catalog with package badge and effective date.
- **CSH-10 Discount** — percent/amount, scope (line/bill), reason list, threshold indicator → "Envoyer pour approbation" when above limit.
- **CSH-11 Approvals queue** — supervisor view of discount/cancel/refund requests with context, approve/reject + comment (cashier view shows status chips).
- **CSH-12 Insurance split** — coverage rules, patient share vs insurer share per line, limits & co-pay, eligibility badge, "Facture assureur".
- **CSH-13 Credit bill** — credit to company/staff/patient: authorizer, credit limit check, due date, signature.
- **CSH-14 Estimate / proforma** — create, print, validity, convert to bill.

### Collection
- **CSH-15 Collect payment** — amount due, split across methods (cash, card, mobile money, cheque, insurance, deposit balance), tendered amount + change calculator, reference fields per method.
- **CSH-16 Digital payment processing** — three frames: waiting for customer confirmation (mobile money USSD/push), success, failure/timeout with retry or switch method.
- **CSH-17 Payment success & receipt** — success state, print receipt (PRN-08), send SMS/e-mail, "Nouvelle encaissement".
- **CSH-18 Partial payment & schedule** — balance, installment plan, promise-to-pay date.
- **CSH-19 Bill detail** — header (status chip), lines, payments, adjustments, audit trail tab, actions (pay, print, cancel, refund).
- **CSH-20 Cancel bill** — reason (required), consequences, approval routing, locked result state.
- **CSH-21 Reprint receipt / invoice** — copy watermark "DUPLICATA", mandatory reason, logged.

### Deposits & refunds
- **CSH-22 Collect deposit** — patient/admission, amount, method, receipt.
- **CSH-23 Deposit ledger** — per-patient deposits, utilisation, balance, timeline.
- **CSH-24 Refund deposit** — remaining balance refund with approval.
- **CSH-25 Refund / return request** — select paid lines, reason, refund method, approval status.
- **CSH-26 Credit note** — issue & print, linked to original bill.

### Inpatient billing
- **CSH-27 Inpatient running bill** — per day/ward charges (bed, nursing, drugs, procedures), live total vs deposit.
- **CSH-28 Interim & final bill** — itemized bill, deposits applied, insurer share, balance, "Autoriser la sortie" → clearance to REC-37.
- **CSH-29 Package billing** — maternity/surgery packages: inclusions/exclusions, extras beyond package, package consumption bar.

### Insurance claims
- **CSH-30 Insurance billing queue** — bills awaiting claim, filters by insurer/period.
- **CSH-31 Create claim / batch submission** — select bills, attach documents, validation errors list, submit.
- **CSH-32 Claim tracker** — kanban/table by status (draft, submitted, approved, partially paid, rejected), aging.
- **CSH-33 Claim rejection handling** — rejection reasons, fix & resubmit workflow, notes.
- **CSH-34 Insurer reconciliation** — remittance upload, auto-match to claims, unmatched items, difference handling.

### Outstanding & follow-up
- **CSH-35 Outstanding balances & aging** — buckets (0–30/31–60/61–90/90+), patients and companies, bulk reminder.
- **CSH-36 Follow-up log** — contact attempts (call/SMS), outcome, promise date, next action.

### Reports & archive
- **CSH-37 Daily collection** (by method/cashier/counter) · **CSH-38 Cash reconciliation** (sessions vs bank deposits) · **CSH-39 Revenue by department/service** · **CSH-40 Discounts & cancellations audit** — each a report viewer (filters, charts, table, export).
- **CSH-41 Price list** — read-only catalog, packages, effective dates, history.
- **CSH-42 Receipts & invoices archive** — search by number/patient/date/amount, preview, reprint (→ CSH-21).

**Required extra states:** cash session not open (blocking banner), payer ineligible, terminal/mobile-money provider down, approval pending/rejected, bill locked after payment, negative/over-payment warning, duplicate-payment protection, printer offline.

**Screen count — Part 4:** **42 screens** (CSH-01 … CSH-42), plus tablet/POS compact variants of CSH-06, CSH-07, CSH-15, CSH-17.


---

# PART 5 — PROFILE 4 · DPO / AUDITOR (privacy & compliance) — `DPO-xx`

**Who:** Data Protection Officer, internal auditor, compliance manager. **MFA mandatory.** **Goal:** prove and monitor that sensitive health data is accessed legitimately; handle patients' privacy rights; manage incidents and retention. **Permissions:** read audit journal, read users & roles, handle privacy requests; **no clinical data editing, no clinical content** (audit shows WHO accessed WHAT category and WHY, never the medical content itself — make this visible with a small "contenu clinique masqué" label). Desktop 1440, data-dense but calm; investigative tone. Standards to evoke in wording: RGPD/GDPR, HIPAA audit controls. ★ = proposed.

**Sidebar:** Conformité (tableau de bord) · Journal d'audit · Revue des accès · Accès d'urgence · Sécurité · Droits des personnes · Consentements · Conservation & registres · Utilisateurs & rôles (lecture) · Rapports.

## Flows
- **F-DPO-01 Daily review:** DPO-01 → DPO-02 → DPO-03 → DPO-06 (drill into a patient record's access).
- **F-DPO-02 Integrity check:** DPO-01 (integrity widget) → DPO-04 (verify) → [valid ✔ | broken ✖ → evidence package export + incident → DPO-28].
- **F-DPO-03 Anomaly investigation:** DPO-08 → DPO-09 → DPO-10 (case) → outcome (dismiss / warn user / escalate → DPO-28).
- **F-DPO-04 Break-glass review:** DPO-11 → DPO-12 → (justified | follow-up needed | misuse → DPO-10 case).
- **F-DPO-05 Data-subject request:** DPO-16 → DPO-17 → (export: DPO-18 | erasure: DPO-19) → DPO-20 response → request closed (back to DPO-16).
- **F-DPO-06 Personal-data breach ★:** DPO-13 / DPO-14 / DPO-04 signal → DPO-27 → DPO-28 (72 h notification countdown, authority & patient notification drafts) → closed.
- **F-DPO-07 Access recertification ★:** DPO-34 (launch campaign) → reviewers confirm → results → DPO-33 conflicts → remediation.
- **F-DPO-08 Compliance reporting:** DPO-35 → DPO-36 (archive, PRN-16 cover).
- **F-DPO-09 Security monitoring:** DPO-13 → DPO-14 → DPO-15 → user detail DPO-31.

## Screens
### Home
- **DPO-01 Compliance dashboard** — KPIs (access events 24 h, denied accesses, open break-glass reviews, failed logins, privacy requests due with SLA countdown, open anomalies), **audit-chain integrity status card** (last verified, ✔/✖), trend charts, "à traiter aujourd'hui" task list.

### Audit journal
- **DPO-02 Audit log explorer** — filters (actor, action, outcome SUCCESS/FAILURE/DENIED, resource type/id, patient, IP, date-time range), saved views, dense table, export CSV/PDF, "contenu clinique masqué" label.
- **DPO-03 Event detail drawer** — all fields, request context, previous/next event with hash values, integrity badge, related events.
- **DPO-04 Chain integrity verification** — run now, progress, result (valid with count | **broken at entry #N** with evidence, hashes, export evidence package, "Créer un incident").
- **DPO-05 Saved searches & scheduled reports** — list, schedule (daily/weekly), recipients.
- **DPO-37 Clinical file access report** — file accesses, downloads, quarantined/malware events, classification filter.

### Access reviews
- **DPO-06 Record access report** — search a patient → timeline of who accessed which section, when, why, role, outcome; export for the patient's rights request.
- **DPO-07 Staff activity report** — per user: volume by day, records accessed, off-hours, comparison to peers.
- **DPO-08 Anomaly alerts** — list with severity (off-hours bulk access, VIP/colleague record lookup, repeated denied attempts, rapid patient switching ★), status.
- **DPO-09 Anomaly detail & investigation** — evidence panel, user context, notes, assign, decision.
- **DPO-10 Investigation cases** — table/kanban (open, in review, closed), SLA, owner.

### Emergency (break-glass) access
- **DPO-11 Break-glass queue** — pending reviews, reason excerpt, duration, patient (masked until opened), age of request.
- **DPO-12 Break-glass review** — reason, what was viewed, duration, treating context, decision (justified / needs explanation / misuse) + comment, notify manager.

### Security events
- **DPO-13 Authentication events** — failed logins, lockouts, MFA resets, password changes; charts + table; per-IP view.
- **DPO-14 Session & token events** — refresh-token **reuse detected (possible theft)**, revoked families, forced logouts.
- **DPO-15 Access-denied analysis** — 403s by role/resource, repeated attempts, suspicious patterns.

### Data-subject rights
- **DPO-16 Requests inbox** — types (export, correction, erasure, objection, restriction), SLA countdown (30 days), status, requester, assigned.
- **DPO-17 Request workflow** — stepper: identity verification → scope → legal-retention check → decision → response; documents, notes, history.
- **DPO-18 Export package** — dataset inclusion checklist, preview, redaction, secure expiring link, delivery confirmation.
- **DPO-19 Erasure / anonymization assessment** — data inventory, retention conflicts (medical record legal retention), partial erasure options, decision log.
- **DPO-20 Response templates** — letter templates (accepted / partially / refused), editor, preview.

### Consents
- **DPO-21 Consent registry** — per patient/purpose, version, date, proof (signature), status, search/filter.
- **DPO-22 Consent templates & versions** — read-only versions, changelog, effective dates.
- **DPO-23 Consent statistics** — grant/withdraw rates by purpose and period.

### Retention & registers
- **DPO-24 Retention policies** — per data category: legal basis, duration, purge/archive action, next run.
- **DPO-25 Purge & archival jobs** — preview (dry-run), results, exceptions, reversal window.
- **DPO-26 Records of processing (RoPA) ★** — register list + detail (purpose, categories, recipients, transfers, security measures).
- **DPO-27 Breach register ★** — incidents list with severity and deadline status.
- **DPO-28 Breach detail / new ★** — timeline, affected data & people, **72-hour authority notification countdown**, drafts of notifications, containment actions, lessons learned.
- **DPO-29 DPIA register ★** — impact assessments list + detail with risk matrix.

### Users & roles (read-only)
- **DPO-30 Users directory** — MFA status, last login, roles, status, locked flag; filters.
- **DPO-31 User detail** — roles/permissions, recent activity, sessions, security events (read-only banner).
- **DPO-32 Roles & permissions matrix** — read-only matrix (resource × action × scope own/department/all).
- **DPO-33 Segregation-of-duties report ★** — conflicting role combinations, users concerned.
- **DPO-34 Access recertification ★** — campaigns list, reviewer progress, confirm/revoke decisions, completion report.

### Reports
- **DPO-35 Compliance report builder** — choose sections & period, preview, generate.
- **DPO-36 Reports archive** — generated PDFs with cover page (PRN-16), integrity stamp, download.

**Required extra states:** chain broken (critical banner everywhere), SLA overdue (red), no anomalies (positive empty state), large export in progress, read-only banners on user screens, insufficient permission for a section.

**Screen count — Part 5:** **37 screens** (DPO-01 … DPO-37).


---

# PART 6 — PROFILE 5 · ACCOUNTANT — `ACC-xx`

**Who:** accountants, finance managers, payroll officers. **Goal:** keep reliable books for the hospital: general ledger, payables/receivables, bank & cash, period closing, fixed assets, payroll, incentives, budgets and financial statements. **Sees:** financial and administrative data only (no clinical data). **Rules to make visible:** double-entry balance check, period lock status, approval thresholds, immutable posted entries (corrections only by reversal), every posting traceable to its source (billing, pharmacy, inventory, payroll). Desktop 1440, spreadsheet-like density with strong typography for numbers (tabular, right-aligned, negative in red with parentheses). ★ = proposed.

**Sidebar:** Tableau de bord · Écritures & pièces · Grand livre & balances · Fournisseurs · Clients · Banque & trésorerie · Clôtures · Budgets · États financiers · Immobilisations · Paie · Incitations · Fiscalité · Paramètres comptables.

## Flows
- **F-ACC-01 Month-end close:** ACC-16 (clear integration queue) → ACC-30 (bank reconciliation) → ACC-41 (depreciation run) → ACC-49 (payroll posted) → ACC-33 (checklist) → ACC-23 (trial balance) → ACC-24/25/26 (statements) → ACC-35 (lock period).
- **F-ACC-02 Manual voucher lifecycle:** ACC-07 → ACC-08 (or ACC-09/10/11) → ACC-12 (submitted) → ACC-13 (approval) → posted → ACC-14 (reverse if needed).
- **F-ACC-03 Payables:** ACC-20 (supplier invoice from goods receipt) → ACC-19 (sub-ledger) → ACC-21 (payment run) → payment voucher ACC-09 → ACC-30.
- **F-ACC-04 Receivables:** ACC-18 → ACC-22 (statement) → collection actions → receipt voucher ACC-10.
- **F-ACC-05 Fixed-asset life:** ACC-40 (acquire) → ACC-38/39 → ACC-41 (depreciate) → ACC-42 (transfer) → ACC-44 (physical audit) → ACC-43 (dispose).
- **F-ACC-06 Payroll month:** ACC-46/47/48 (masters) → ACC-51 (adjustments) → ACC-49 (run wizard) → ACC-50 (payslips) → ACC-52 → ACC-53 (bank file) → posted journal.
- **F-ACC-07 Incentives:** ACC-55 (schemes) → ACC-56 (calculation) → ACC-57 (approval & payout).
- **F-ACC-08 Budgeting:** ACC-36 (build) → approval → ACC-37 (budget vs actual) → alerts on dashboard.
- **F-ACC-09 Year-end:** ACC-33 → ACC-34 (year-end close & opening balances) → ACC-04 (new fiscal year opens).
- **F-ACC-10 Integration review:** ACC-16 (errors from billing/pharmacy/inventory) → fix mapping ACC-06 → repost.
- **F-ACC-11 Reporting:** ACC-63 (library) → report viewer → export/schedule.
- **F-ACC-12 Tax filing:** ACC-58 → ACC-59 → export return.

## Screens
### Home & setup
- **ACC-01 Finance dashboard** — KPI cards (revenue, expenses, net, cash & bank), receivables/payables aging, budget vs actual bars, period status chip, tasks (approvals, unposted entries, reconciliation due).
- **ACC-02 Chart of accounts** — tree with codes, types (asset/liability/equity/income/expense), balances, search, import/export.
- **ACC-03 Account form** — create/edit (code, name, parent, type, normal side, active, cost-center required).
- **ACC-04 Fiscal years & periods** — periods with status (open/closing/locked), actions.
- **ACC-05 Cost centers & departments** — hierarchy, mapping to hospital departments.
- **ACC-06 Auto-posting mapping** — rules mapping billing categories/pharmacy/inventory/payroll movements to accounts; test posting preview.

### Journal & vouchers
- **ACC-07 Journal entries** — list with filters (period, type, status, source), totals, bulk actions.
- **ACC-08 New journal entry** — header, lines (account, cost center, debit/credit, narration), live **balance check**, attachments, save draft/submit.
- **ACC-09 Payment voucher** · **ACC-10 Receipt voucher** · **ACC-11 Contra / transfer voucher** — specialised forms.
- **ACC-12 Voucher detail** — status stepper (draft → submitted → approved → posted), lines, source link, attachments, audit trail.
- **ACC-13 Approval queue** — thresholds, approve/reject with comment, bulk approve.
- **ACC-14 Reverse / void entry** — reason, reversal preview, locked-period handling.
- **ACC-15 Recurring entries ★** — templates, schedule, next run.
- **ACC-16 Integration queue** — auto-generated postings from billing/pharmacy/inventory: pending / posted / **error** with reason, repost, drill to source.

### Ledgers & statements
- **ACC-17 General ledger** — account & period selectors, running balance, drill-down to voucher.
- **ACC-18 Customers sub-ledger** — balances, aging, filters; **ACC-22 Receivables statement** — per customer/company statement, print.
- **ACC-19 Suppliers sub-ledger** — balances, aging; **ACC-20 Supplier invoice entry** — from goods receipt (3-way match: PO / receipt / invoice) with variance flags; **ACC-21 Supplier payment run** — select due invoices, discounts, approve, generate payment vouchers.
- **ACC-23 Trial balance** · **ACC-24 Balance sheet** · **ACC-25 Profit & loss** (department breakdown) · **ACC-26 Cash-flow statement** · **ACC-27 Comparatives** (period vs prior year, variance %).

### Bank & treasury
- **ACC-28 Bank accounts** — list, balances, last reconciliation.
- **ACC-29 Statement import** — CSV/MT940 upload, mapping, validation.
- **ACC-30 Bank reconciliation** — two-pane matching (statement vs ledger), auto-match suggestions, unmatched, adjustments, difference = 0 indicator, sign-off.
- **ACC-31 Cash book & petty cash** — receipts/payments, replenishment.
- **ACC-32 Cash forecast ★** — 13-week projection chart & assumptions.

### Closing & budgets
- **ACC-33 Period-end checklist** — task list with owners/status (reconciliations, depreciation, payroll, accruals, review).
- **ACC-34 Year-end close** — wizard: pre-checks, closing entries preview, opening balances, confirm.
- **ACC-35 Period lock/unlock** — status, request unlock with reason and approval.
- **ACC-36 Budget builder** — grid by account × month × cost center, copy last year, approval workflow.
- **ACC-37 Budget vs actual** — variance table & charts, drill-down, alerts.

### Fixed assets
- **ACC-38 Asset register** — list (category, location, cost, accumulated depreciation, NBV, status), filters, QR labels.
- **ACC-39 Asset detail** — tabs: general, depreciation schedule chart, transfers, maintenance, documents, history.
- **ACC-40 Acquire asset** — form (supplier, cost, in-service date, useful life, method, location, custodian), attachments.
- **ACC-41 Depreciation run** — period, preview per asset, post.
- **ACC-42 Asset transfer** — department/location/custodian change, approval, transfer slip.
- **ACC-43 Disposal / write-off** — method (sale/scrap/donation), proceeds, gain/loss preview, approval.
- **ACC-44 Physical verification** — scan/tick assets per location, discrepancies, reconcile.
- **ACC-45 Fixed-asset reports** — register, depreciation, disposals, by category/department.

### Payroll
- **ACC-46 Employees (payroll master)** — list with contract, grade, status.
- **ACC-47 Salary structures** — components (basic, allowances, deductions, employer contributions), formulas, grades.
- **ACC-48 Employee payroll profile** — salary, bank, tax/social IDs, history, loans.
- **ACC-49 Payroll run wizard** — period → import attendance/overtime → calculate → review exceptions → approve → post to ledger → lock.
- **ACC-50 Payslips** — list per period/employee, detail, bulk print/e-mail (PRN-15).
- **ACC-51 Adjustments** — advances, loans (repayment schedule), bonuses, deductions.
- **ACC-52 Statutory contributions & tax** — social security, income tax, filings summary.
- **ACC-53 Bank payment file** — generate, validate, download, mark paid.
- **ACC-54 Payroll reports** — summary, by department, variance month-over-month.

### Incentives
- **ACC-55 Incentive schemes** — rules (doctor/referrer %, service categories, thresholds).
- **ACC-56 Incentive calculation & statements** — per period/person, drill to source bills, adjust.
- **ACC-57 Incentive payouts** — approval, payment voucher link, history.

### Tax, valuation, controls, settings
- **ACC-58 VAT/tax summary** — output vs input, return draft, export.
- **ACC-59 Withholding tax register** — entries, certificates.
- **ACC-60 Inventory valuation** — stock value by store/category from pharmacy & stores, reconciliation to ledger.
- **ACC-61 Stock adjustment impact** — adjustments/write-offs and their journal effect.
- **ACC-62 Accounting audit trail** — changes to entries/mappings/periods with user & reason.
- **ACC-63 Reports library** — saved & scheduled reports, favorites, export formats.
- **ACC-64 Accounting settings** — numbering, currency & rounding, tax codes, approval thresholds, voucher types.

**Required extra states:** period locked (read-only banner), out-of-balance entry (blocking), unposted integration errors (warning count), reconciliation difference ≠ 0, approval overdue, import validation errors, long-running calculation (progress).

**Screen count — Part 6:** **64 screens** (ACC-01 … ACC-64).


---

# PART 7 — PROFILE 6 · LABORATORY TECHNICIAN (and lab verifier/pathologist actions) — `LAB-xx`

**Who:** lab technicians, senior technologists, pathologist/biologist who validates. **MFA mandatory.** **Goal:** run the full lab cycle — receive orders, collect and track samples, enter or import results, quality control, verify, release, and report — fast, error-free and traceable. **Sees:** patient identity (name, age, sex, MRN), ordered tests, clinical info relevant to the test; **not** the rest of the chart. **Safety patterns to make visible:** two-identifier patient check at collection (scan wristband), barcode chain of custody, delta checks and critical-value call-back documentation, result amendments with reason and versions. Desktop 1440 (bench PC) + **tablet 1024 for bedside collection** and **TV-style worklist** optional. ★ = proposed.

**Sidebar:** Tableau de bord · Liste de travail · Prélèvements · Réception · Résultats · Validation · Rapports · Catalogue · Qualité · Équipements · Réactifs · Sous-traitance · Statistiques.

## Flows
- **F-LAB-01 Main cycle:** LAB-01 → LAB-02 → LAB-03 → LAB-05 → LAB-06 → LAB-08 → LAB-12 (or LAB-13 / LAB-14 import) → LAB-19 → LAB-20 → LAB-24 (release; appears in doctor DOC- results and patient PAT-15).
- **F-LAB-02 Rejection & recollection:** LAB-07 or LAB-08 → LAB-09 (reason, notify) → LAB-05 (recollection task appears) → LAB-06.
- **F-LAB-03 Critical value:** LAB-12/LAB-20 (critical flag) → LAB-21 (call-back documented) → release LAB-24.
- **F-LAB-04 Analyzer import:** LAB-33 (connection status) → LAB-14 (review incoming, resolve mapping errors) → LAB-20.
- **F-LAB-05 Microbiology:** LAB-02 → LAB-16 (culture → organism → antibiogram) → LAB-19 → LAB-20 → LAB-24 (preliminary & final reports).
- **F-LAB-06 Amend a released result:** LAB-25 → LAB-22 (reason, new version, notify clinician) → LAB-24.
- **F-LAB-07 Repeat test:** LAB-15 (delta alert) or LAB-20 → LAB-23 → LAB-12.
- **F-LAB-08 Daily QC:** LAB-30 → LAB-31 → (violation → LAB-32 corrective action → release run) .
- **F-LAB-09 Outsourced tests:** LAB-37 → LAB-38 (manifest) → result import → LAB-19.
- **F-LAB-10 Reagents:** LAB-34 (low stock) → LAB-35 (request) → LAB-36 (lot change/validation).
- **F-LAB-11 History & trends:** LAB-26 from any result → LAB-24.
- **F-LAB-12 Histology ★:** LAB-17 (gross → micro → diagnosis → sign) → LAB-19 → LAB-24.

## Screens
### Home & worklists
- **LAB-01 Dashboard** — pending by status, STAT queue with timers, TAT gauges, critical results awaiting call-back, analyzer status strip, rejected samples today.
- **LAB-02 Requisition worklist** — dense table: priority (STAT/urgent/routine), patient, tests, section, source (OPD/IPD/ER), ordered time, TAT timer, status chip (ordered → collected → received → in analysis → resulted → verified → released); section tabs (haematology, biochemistry, immunology, microbiology, histology…); bulk actions.
- **LAB-03 Requisition detail** — patient identity strip, ordered tests/panels, clinical notes, ordering doctor/location, status stepper, specimen list, actions.
- **LAB-04 Lab-initiated request ★** — create request from an external prescription/walk-in; test picker; sends to billing.

### Collection & receipt
- **LAB-05 Collection worklist** — ward-round list (inpatients by ward/bed) and OPD collection-point queue; tablet variant.
- **LAB-06 Collect sample** — scan wristband → **identity verification screen** (photo, name, DOB, mismatch error state) → tubes to collect with colors → print labels (PRN-03) → confirm collected (time, collector).
- **LAB-07 Collection issues** — hemolysed, insufficient volume, wrong tube, patient refused/unavailable → recollection or cancel.
- **LAB-08 Sample receiving** — batch barcode scanning, accept/reject per sample, discrepancy highlighting (missing, mislabelled).
- **LAB-09 Reject sample** — reason list, notify requester, auto-create recollection, rejection log.
- **LAB-10 Storage & aliquots** — rack/freezer map, assign location, aliquot creation, retention until date.
- **LAB-11 Sample tracking** — chain-of-custody timeline per barcode (who, when, where, temperature if tracked).

### Results
- **LAB-12 Result entry by test (worksheet)** — grid of samples × analytes, reference ranges per age/sex, auto flags (L/H/critical), units, keyboard-first entry, comments, "enregistrer & suivant".
- **LAB-13 Result entry by patient** — panel view for one patient across sections.
- **LAB-14 Analyzer import review** — incoming results table, mapping errors (unknown test code, wrong sample ID), accept/reject/rerun, auto-verification rules applied.
- **LAB-15 Delta check & calculated tests** — previous value comparison, delta alert reasons, formula-derived values (e.g. eGFR, LDL) with inputs shown.
- **LAB-16 Microbiology** — culture reading entry, organism picker, **antibiogram grid (S/I/R)** by antibiotic, preliminary vs final.
- **LAB-17 Histology/cytology report editor ★** — templates, gross/microscopic description, diagnosis, ICD-O coding, images, sign-off.

- **LAB-18 Interpretive comments & result templates** — library of standard comments/phrases (per test, per flag), insert into results and reports, usage stats.

### Verification & release
- **LAB-19 Verification queue** — results awaiting review (filter by section/technician/age), flags, bulk-verify safe normals.
- **LAB-20 Verification detail** — current vs previous results, flags, instrument QC status, comments; actions approve / return / request re-run.
- **LAB-21 Critical-value notification** — who was notified (name/role), time, read-back confirmed, method; blocks release until documented; timer.
- **LAB-22 Amend released result** — reason, old vs new, new version, clinician notification, audit.
- **LAB-23 Repeat / re-run request** — reason, dilution, new aliquot, links to original.
- **LAB-24 Report preview & release** — report preview (PRN-05), single/batch release, print, send to portal (patient/doctor), signature of verifier.
- **LAB-25 Reports history** — search by patient/test/date/status, reprint, amendments badge.
- **LAB-26 Patient history & cumulative trends** — table + charts per analyte with reference bands.

### Catalog
- **LAB-27 Test catalog** — tests by section, sample type, TAT, container, price, methods; search.
- **LAB-28 Test detail & reference ranges** — age/sex-specific ranges, critical limits, units, instructions; **request change** (admin approves) ★.
- **LAB-29 Panels & profiles** — panel composition view.

### Quality & equipment
- **LAB-30 QC dashboard** — Levey-Jennings charts per analyte & level, Westgard flags, run status.
- **LAB-31 QC data entry** — enter control results per run, accept/reject run.
- **LAB-32 QC violations & corrective actions** — rule violated, investigation, corrective action, release/hold run.
- **LAB-33 Equipment** — analyzers list (status, last calibration, interface connection), calibration & maintenance logs, downtime.

### Reagents & outsourcing
- **LAB-34 Reagent & consumable stock** — levels, lots, expiry, reorder alerts.
- **LAB-35 Reagent requisition** — request to store, status.
- **LAB-36 Lot change & validation log** — new lot verification results.
- **LAB-37 Outsourced tests** — send-out list, partner lab, courier status, expected TAT, result import.
- **LAB-38 Send-out manifest** — printable manifest, sample list, signatures.

### Statistics & misc
- **LAB-39 TAT report** · **LAB-40 Workload by section/technician** · **LAB-41 Test volume & revenue** · **LAB-42 Rejection analysis** · **LAB-43 Critical results report** · **LAB-44 Worksheet print/daily worklist**.
- **LAB-45 Notifications** — new STAT, critical returns, rejected-sample feedback, low reagents.
- **LAB-46 My bench & shift** — choose section/bench/analyzer, shift handover notes.
- **LAB-47 Add-on test request** — add test to an existing sample (sample-volume check, doctor approval status).

**Required extra states:** identity mismatch at collection (blocking), unreadable barcode, analyzer disconnected, QC failed (results on hold banner), result out of analytic range, duplicate sample ID, STAT overdue (pulsing red), session timeout mid-entry (draft preserved), offline entry on tablet.

**Screen count — Part 7:** **47 screens** (LAB-01 … LAB-47).


---

# PART 8 — PROFILE 7 · RADIOLOGIST / IMAGING (radiologist + imaging technologist actions) — `RAD-xx`

**Who:** radiologists (reporting), imaging technologists (acquisition), imaging coordinators. **MFA mandatory.** **Goal:** manage the imaging cycle — vet orders, schedule, acquire, view DICOM studies, report, communicate critical findings, share images — with radiation-safety and quality tracking. **Sees:** patient identity, ordered exam, clinical question, relevant history/prior imaging, allergy/renal/pregnancy flags; **not** the full chart. Desktop 1440 (reporting workstation: **dark, low-glare viewer theme** is the default inside the viewer), tablet variant of the viewer. ★ = proposed.

**Sidebar:** Tableau de bord · Demandes d'imagerie · Planning · Examens (technologue) · Visionneuse DICOM · Comptes rendus · Archive · Sécurité & doses · Catalogue · Équipements · Statistiques.

## Flows
- **F-RAD-01 Main cycle:** RAD-01 → RAD-02 → RAD-03 → RAD-04 (vetting) → RAD-06 (schedule, via RAD-05) → RAD-07 (arrival & safety screening) → RAD-08 (acquisition) → RAD-13 (view) → RAD-19 → RAD-20 → RAD-22 (sign) → RAD-28 (distribute; visible to doctor DOC- and patient PAT-18).
- **F-RAD-02 Emergency / STAT with preliminary read:** RAD-02 (STAT) → RAD-08 → RAD-13 → RAD-24 (preliminary) → RAD-25 (if critical) → later RAD-22 (final).
- **F-RAD-03 Critical finding:** RAD-20 (flag critical) → RAD-25 (communication documented) → RAD-22.
- **F-RAD-04 Compare with priors:** RAD-13 → RAD-14 → RAD-20.
- **F-RAD-05 Addendum / correction:** RAD-27 → RAD-23 → RAD-28.
- **F-RAD-06 External images:** RAD-17 (upload) → RAD-12 → RAD-13.
- **F-RAD-07 Repeat/reject images:** RAD-08 → RAD-09 (reason) → RAD-11 (dose updated) → RAD-08.
- **F-RAD-08 Peer review ★:** RAD-19 → RAD-26 → RAD-30.
- **F-RAD-09 Share study:** RAD-12 → RAD-18 (anonymize/secure link/CD).
- **F-RAD-10 Dose & contrast safety:** RAD-10 → RAD-11 → RAD-35/RAD-36 (and reaction → incident record).
- **F-RAD-11 Order query to clinician:** RAD-04 (needs info) → message to ordering doctor → back to RAD-02.

## Screens
### Home & worklist
- **RAD-01 Dashboard** — studies by status, STAT timers, unreported count, critical findings pending, modality status tiles, TAT vs target.
- **RAD-02 Imaging order worklist** — table by status (ordered → scheduled → arrived → in progress → performed → preliminary → final), priority, modality filters (X-ray, ultrasound, CT, MRI, mammography, fluoroscopy), source, wait time.
- **RAD-03 Order detail** — clinical history & question, prior imaging list, **safety flags** (pregnancy, contrast allergy, renal function, implants), ordering doctor, attachments.
- **RAD-04 Order vetting & protocol** — approve/modify protocol, contrast yes/no, justification for ionizing radiation, request more info from clinician, reject with reason.

### Scheduling & acquisition
- **RAD-05 Modality schedule** — calendar by room/modality, durations, blocked times, drag to reschedule.
- **RAD-06 Schedule exam** — slot picker, preparation instructions (fasting, hydration), patient notification, conflicts.
- **RAD-07 Arrival & safety screening** — check-in, safety questionnaire (pregnancy, implants, claustrophobia, allergies, creatinine), consent, identity verification.
- **RAD-08 Technologist worklist & exam execution** — start/complete exam, images count, accession no., technique notes, **dose entry**, send to archive.
- **RAD-09 Repeat / rejected images** — reason (motion, positioning, exposure), log, impact on dose.
- **RAD-10 Contrast administration record** — agent, dose, route, lot, volume, time, **adverse-reaction capture** (severity, treatment).
- **RAD-11 Radiation dose log** — per-exam dose (DAP/CTDI), patient cumulative dose chart, threshold alerts.

### Images & viewer
- **RAD-12 Study list / archive search** — patient, modality, date, accession, body part, report status; thumbnails; saved filters.
- **RAD-13 DICOM viewer — main** — dark viewer UI: series list, viewport grid (1×1/1×2/2×2), tool rail (window/level presets, zoom, pan, scroll, length/angle/ellipse ROI measurement, annotate, invert, rotate/flip, reset), cine, key-image star, overlay toggles (patient, technique), report side panel, **MPR/3D (★)** states.
- **RAD-14 Viewer — compare priors** — side-by-side with synced scrolling, prior selection list, hanging protocol.
- **RAD-15 Viewer — key images & annotations** — panel listing measurements/annotations with jump-to, send to report.
- **RAD-16 Viewer — tablet light viewer** — touch gestures legend, simplified toolbar (for clinicians/ward rounds).
- **RAD-17 External image upload** — JPEG/PDF/DICOM from outside, link to patient/study, classification, scan status (FILE-03 inline).
- **RAD-18 Share / export study** — anonymize toggle, secure expiring link, burn-to-CD queue, recipient, access log.

### Reporting
- **RAD-19 Reporting worklist** — to report / my drafts / to verify / second read ★; priority and age; filters by modality/subspecialty.
- **RAD-20 Report editor** — split layout (viewer thumbnail rail + editor): technique, comparison, findings, impression; structured templates, macros/auto-text, measurements pulled from viewer, BI-RADS/TI-RADS style structured fields where relevant, **dictation ★** button, critical-finding toggle, save draft.
- **RAD-21 Template library** — templates by modality/region, create/edit, versioning.
- **RAD-22 Preview & sign** — report preview (PRN-06), e-signature, release options (notify doctor, publish to portal).
- **RAD-23 Addendum / amendment** — reason, diff view, notify clinician, new version.
- **RAD-24 Preliminary report** — ER preliminary read workflow, preliminary → final reconciliation, discrepancy note.
- **RAD-25 Critical-finding communication** — documentation (who/when/how, read-back), timer, escalation if unacknowledged.
- **RAD-26 Peer review / second read ★** — blinded second read, discrepancy score, learning note.
- **RAD-27 Report history & versions** — per study, versions, who changed what.
- **RAD-28 Report distribution** — send to ordering doctor, patient portal, external recipient, print; delivery status.

### Quality & teaching
- **RAD-29 Teaching files ★** — anonymized case library, tags, save from viewer.
- **RAD-30 QA / discrepancy dashboard ★** — peer-review stats, learning-opportunity cases, trends.

### Catalog & equipment
- **RAD-31 Exam catalog** — procedures, codes, prep, duration, price, modality, contrast info.
- **RAD-32 Protocol library** — protocols per exam, parameters; request change.
- **RAD-33 Equipment & QA** — modality status, calibration/QA logs, downtime, service tickets.

### Statistics & misc
- **RAD-34 Volumes & TAT** by modality/radiologist · **RAD-35 Dose report** (diagnostic reference levels compliance) · **RAD-36 Contrast usage & reactions** · **RAD-37 Reject/repeat analysis** · **RAD-38 Reporting-time compliance**.
- **RAD-39 Notifications** — STAT arrival, critical acknowledgement overdue, new priors.
- **RAD-40 Viewer preferences ★** — hanging protocols, default presets, layouts.
- **RAD-41 Radiologist handover notes** — shift handover list of pending/complex cases.

**Required extra states:** missing prior images, DICOM load error/partial series, viewer on slow network (progressive load), contrast allergy alert (blocking confirm), pregnancy flag, equipment down (reroute suggestion), critical not acknowledged (escalation), unsigned reports overdue, patient identity mismatch between order and image.

**Screen count — Part 8:** **41 screens** (RAD-01 … RAD-41).


---

# PART 9 — PROFILE 8 · PHARMACIST (dispensary, ward supply, stock, procurement, clinical pharmacy) — `PHA-xx`

**Who:** pharmacists, pharmacy assistants (reduced actions), store keepers of the pharmacy. **MFA mandatory.** **Goal:** verify and dispense prescriptions safely, sell over the counter, supply wards, control stock/expiry and controlled drugs, procure, and provide clinical pharmacy services. **Sees:** patient identity, medications, allergies, relevant diagnoses/renal data for verification; billing hand-off; **not** the rest of the chart. **Safety patterns to make visible:** allergy/interaction/duplicate/dose alerts with severity and **override-with-reason**, FEFO batch selection, expiry warnings, two-person verification for controlled drugs, barcode scanning, label printing with pictograms. Desktop 1440 + **tablet 1024 counter variant** + TV-03 pick-up screen. ★ = proposed.

**Sidebar:** Tableau de bord · Ordonnances · Vente au comptoir · Retours · Hospitalisation (pharmacie de service) · Substances contrôlées · Stock · Approvisionnement · Catalogue & prix · Pharmacie clinique · Rapports.

## Flows
- **F-PHA-01 Outpatient prescription (main):** PHA-01 → PHA-02 → PHA-03 → PHA-04 (alerts → PHA-05 override | PHA-06 substitute | contact prescriber) → PHA-07 (FEFO batches; out-of-stock → PHA-08) → PHA-10 (billing hand-off) → PHA-09 (counseling & labels PRN-14) → PHA-11 (hand-over; TV-03).
- **F-PHA-02 Inpatient supply:** PHA-14 → PHA-15 (unit-dose cart prep) → PHA-17 (issue to ward with signature) → nurse receipt (NUR-xx) → PHA-18 (returns).
- **F-PHA-03 Ward requisition:** PHA-16 (inbox) → approve/adjust → PHA-17 → PHA-19 (par-level update).
- **F-PHA-04 Counter sale:** PHA-20 → PHA-21 (receipt) → PHA-22 (return, if any) ; hold → PHA-24 ; credit → PHA-23.
- **F-PHA-05 Controlled drug dispensing:** PHA-26 (second verifier) → PHA-25 (register entry) → PHA-27 (periodic audit & discrepancy report).
- **F-PHA-06 Expiry management:** PHA-30 → (return to supplier PHA-42 | quarantine PHA-35 | markdown PHA-48) .
- **F-PHA-07 Replenishment to receipt:** PHA-31 → PHA-38 (requisition) → PHA-39 (PO, approval) → PHA-40 (status) → PHA-41 (GRN) → PHA-42 (discrepancy/return if any) → PHA-45 (hand-off to accounting) → PHA-28 stock updated.
- **F-PHA-08 Stock count:** PHA-33 (count sheets, scan) → variance review → PHA-32 (approved adjustment) → PHA-28.
- **F-PHA-09 Transfer between stores:** PHA-34 (request → dispatch → receive).
- **F-PHA-10 New drug / price change:** PHA-47 (request, committee approval) → PHA-46 → PHA-48 (price & margin).
- **F-PHA-11 Clinical pharmacy:** PHA-51 (medication review) → PHA-52 (intervention logged, prescriber response) ; ADR: PHA-53 ; stewardship: PHA-54 ; error: PHA-55.
- **F-PHA-12 Shift:** PHA-66 (open counter, cash float) → operations → close & handover.
- **F-PHA-13 Cold chain ★:** PHA-36 (excursion alert) → quarantine PHA-35 → decision.

## Screens
### Home & prescriptions
- **PHA-01 Dashboard** — prescription queue count & wait, pending verifications, low-stock & expiring-soon counters, controlled-drug balance status, sales today, ward requisitions pending.
- **PHA-02 Prescription queue** — OPD + IPD tabs, status (new, in verification, awaiting stock, ready, dispensed, cancelled), priority, patient, prescriber, age; search/scan prescription QR.
- **PHA-03 Prescription detail** — patient banner (allergies in red), items with dose/route/frequency/duration, prescriber, diagnosis snippet, previous dispenses, alerts summary.
- **PHA-04 Clinical verification** — per-item checks: dose range, duplicate therapy, **drug–drug & drug–allergy interactions**, renal/hepatic/pregnancy considerations, max daily dose; actions: approve / modify / contact prescriber / reject (reason).
- **PHA-05 Alert override** — severity, evidence, mandatory reason, second-pharmacist approval for severe.
- **PHA-06 Substitution** — generic/therapeutic alternatives with price & stock, prescriber-approval requirement flag.
- **PHA-07 Dispense items** — per item batch selection (**FEFO suggested**, expiry colors), quantity, partial dispense, price/discount, barcode scan confirm, running total.
- **PHA-08 Out-of-stock handling** — alternatives, partial dispense, procure/transfer, refer externally, notify prescriber & patient.
- **PHA-09 Counseling & labels** — counseling checklist (how to take, side effects, storage), leaflet, print labels (PRN-14) with pictograms, language choice.
- **PHA-10 Billing at dispensing** — insurance coverage, copay, totals; send to cashier (CSH-) or collect at pharmacy counter.
- **PHA-11 Hand-over** — patient identity check, signature/confirmation, pick-up QR, updates TV-03; dispensed summary.
- **PHA-12 Dispensing history** — per patient medication dispenses timeline, adherence gaps.
- **PHA-13 Medication reconciliation ★** — compare active inpatient/outpatient meds, discrepancy flags.

### Inpatient & ward supply
- **PHA-14 Inpatient medication orders** — active orders by ward, due-for-supply list, stat orders.
- **PHA-15 Unit-dose cart preparation** — per ward checklist, scan-to-pick, completeness verification.
- **PHA-16 Ward requisitions inbox** — requests from nurses, approve/adjust/reject, urgency.
- **PHA-17 Issue to ward** — issue list, scan items, batch capture, receiver signature, delivery note.
- **PHA-18 Ward returns** — returned meds, reason, reintegrate/quarantine decision.
- **PHA-19 Ward stock levels** — par levels per ward, replenishment suggestions, consumption trends.

### Counter sales
- **PHA-20 OTC counter sale** — scan/search items, cart, customer (walk-in/patient), discounts, payment methods, hold.
- **PHA-21 Sale receipt** — receipt preview (PRN-08), reprint, send SMS.
- **PHA-22 Sales return** — against invoice, reason, restock vs quarantine, refund method (approval).
- **PHA-23 Credit sales** — pending credit by company/staff, settle.
- **PHA-24 Held sales** — parked baskets, resume/cancel.

### Controlled substances
- **PHA-25 Controlled-drug register** — per drug running balance, entries (receipt, dispense, waste, return), witness co-signature, immutable.
- **PHA-26 Controlled dispensing** — extra checks: prescriber licence/prescription validity, patient ID verification, **second verifier e-signature**, retained prescription copy.
- **PHA-27 Controlled stock audit** — count vs register, discrepancy investigation form, regulatory report.

### Stock
- **PHA-28 Stock overview** — by item/store/batch, quantity, value, status chips (ok/low/out/expiring), filters, export.
- **PHA-29 Item detail** — batches, movement ledger, reorder levels, pricing, suppliers, substitutes, storage conditions, consumption chart.
- **PHA-30 Expiry management** — expiring in 30/60/90 days, actions (return to supplier, markdown, quarantine, destroy).
- **PHA-31 Low stock & reorder** — suggestions based on consumption, auto-draft requisition.
- **PHA-32 Stock adjustment** — add/remove with reason, evidence, approval.
- **PHA-33 Physical count** — count sheets, scan/enter, variance table, recount, approval to post.
- **PHA-34 Inter-store transfer** — request, dispatch, in-transit, receive, discrepancies.
- **PHA-35 Quarantine, damage & disposal** — quarantine list, destruction record with witness, certificates.
- **PHA-36 Cold chain ★** — temperature charts per fridge, excursion alerts, affected batches, actions.
- **PHA-37 Shelf & barcode labels** — label designer/print queue.

### Procurement
- **PHA-38 Purchase requisitions** — create from low stock or manual, approval flow.
- **PHA-39 Purchase orders** — list + create (supplier, items, price, terms, delivery), approval, send.
- **PHA-40 PO detail & status** — sent/partially received/closed, amendments, communications log.
- **PHA-41 Goods receipt (GRN)** — scan/enter received items vs PO, batch & expiry capture, quantity/quality checks, reject damaged, attach delivery note, post to stock.
- **PHA-42 GRN discrepancies & supplier returns** — shortage/damage, debit note, return slip.
- **PHA-43 Supplier directory** — profiles, performance score (lead time, fill rate, quality), price lists, contracts, documents.
- **PHA-44 Quotation comparison ★** — RFQ, side-by-side supplier quotes, award.
- **PHA-45 Invoice hand-off** — received-not-invoiced list, status of matching in accounting (ACC-20).

### Catalog & pricing
- **PHA-46 Drug catalog / formulary** — generic/brand, strength, form, ATC class, schedule, restrictions, price, active flag, search & filters.
- **PHA-47 New item request ★** — justification, committee approval workflow, status.
- **PHA-48 Pricing & margins** — price lists, markup rules, effective dates, history, approval for changes, markdown on near-expiry.
- **PHA-49 Substitution groups** — therapeutic/generic equivalence sets.
- **PHA-50 Drug information** — monograph, indications, dosing, interactions, pregnancy/lactation, storage; quick lookup from anywhere.

### Clinical pharmacy
- **PHA-51 Medication therapy review ★** — patient med list, issues found, recommendations, follow-up.
- **PHA-52 Pharmacist interventions** — log (type, severity, prescriber response, outcome), statistics.
- **PHA-53 Adverse drug reaction report** — form (drug, reaction, severity, causality), list/history, export to pharmacovigilance.
- **PHA-54 Antimicrobial stewardship ★** — restricted-antibiotic approval requests, criteria checklist, approve/deny/alternative, usage dashboard.
- **PHA-55 Medication error / near-miss** — report form, classification, review.

### Reports & misc
- **PHA-56 Sales** · **PHA-57 Consumption by ward/department** · **PHA-58 Expiry & wastage** · **PHA-59 ABC/VED analysis** · **PHA-60 Stock valuation** · **PHA-61 Controlled drugs report** · **PHA-62 Prescriber patterns** · **PHA-63 Purchases & supplier performance** · **PHA-64 Margin report** — report viewers (filters, charts, tables, export).
- **PHA-65 Notifications** — new STAT prescription, low stock, expiring, requisitions, approvals.
- **PHA-66 Counter session & shift** — open/close counter, cash float, handover notes, discrepancy.

**Required extra states:** severe interaction (blocking red dialog), out of stock everywhere, expired batch selected (blocked), controlled drug balance mismatch, insurance not covering item, barcode not recognized, printer offline (labels), prescription expired/duplicate dispense, partial delivery, temperature excursion, session timeout mid-dispense (draft kept).

**Screen count — Part 9:** **66 screens** (PHA-01 … PHA-66).


---

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


---

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


---

# PART 12 — PROFILE 11 · SYSTEM ADMINISTRATOR (accounts, access, configuration, integrations, operations) — `ADM-xx`

**Who:** IT/system administrators, application managers. **MFA mandatory.** **Goal:** create and secure accounts, define roles, configure the facility, master data, tariffs, templates and integrations, operate and monitor the platform, back up/restore, migrate legacy data, and support users. **Permissions:** everything administrative — **but deliberately NO access to clinical patient data (separation of duties).** Make this principle **visible and reassuring in the UI**: a recurring informational chip "Données cliniques : accès non autorisé pour ce rôle", locked clinical entries in search, masked demographics wherever patient data would appear (e.g. data-quality tools), and a dedicated explanation screen (ADM-21). **Safety patterns:** every destructive/security-sensitive action needs a reason and confirmation (disable account, reset MFA, restore backup, change permissions), re-authentication with MFA for the most sensitive ones, and an **admin-actions audit trail** is always one click away. Desktop 1440; settings use the *left sub-navigation + form cards* template. ★ = proposed.

**Sidebar (grouped):** Tableau de bord · **Accès** (Utilisateurs, Rôles & permissions, Sécurité) · **Organisation** (Établissement, Sites, Départements, Lits & salles, Contextes de travail) · **Données de référence** · **Tarifs & facturation** · **Configuration clinique** · **Modèles & impressions** · **Intégrations** · **Fichiers & stockage** · **Supervision** · **Sauvegardes & maintenance** · **Migration** · **Support** · **Rapports**.

## Flows
- **F-ADM-00 First-run setup:** ADM-96 (facility → admin → MFA → departments → wards → roles check → price lists → import) → ADM-01.
- **F-ADM-01 Create & onboard a user:** ADM-02 → ADM-03 → ADM-04 (temporary password shown once; user then follows F-AUTH-03) → ADM-05.
- **F-ADM-02 Change roles:** ADM-05 → ADM-06 (replace roles; self-change blocked state) → effect banner "appliqué immédiatement" → audit ADM-91.
- **F-ADM-03 Offboard / disable:** ADM-05 → ADM-07 (reason) → sessions revoked → ADM-11 confirms; re-enable path.
- **F-ADM-04 Account problems:** ADM-02 (locked badge) → ADM-08 unlock | ADM-09 reset MFA | ADM-10 force password change.
- **F-ADM-05 Bulk import:** ADM-12 (upload → mapping → validation → preview → results with error report) → ADM-02.
- **F-ADM-06 Create a custom role:** ADM-16 → ADM-18 → ADM-19 (matrix, diff) → ADM-20 (impact) → save → ADM-17.
- **F-ADM-07 Security policy change:** ADM-22 / ADM-23 / ADM-24 (change → impact preview → MFA re-auth → saved) → ADM-91.
- **F-ADM-08 Suspicious activity:** ADM-28 / ADM-11 → revoke sessions → ADM-07 disable → notify DPO.
- **F-ADM-09 Organization build-out:** ADM-31 → ADM-32 → ADM-33 → ADM-34 → ADM-35 → ADM-36.
- **F-ADM-10 Pricing:** ADM-41/42 → ADM-43 → ADM-44 → ADM-45 → ADM-46 → ADM-47 (approval thresholds → ADM-61).
- **F-ADM-11 Clinical catalogs:** ADM-48 / ADM-49 / ADM-50 / ADM-51 / ADM-52 / ADM-53 (draft → review → publish with version).
- **F-ADM-12 Templates & communication:** ADM-57 → ADM-58 (print designer → preview) → ADM-59 → ADM-60.
- **F-ADM-13 Integration setup:** ADM-63 (hub) → ADM-64 (credentials, test connection) → ADM-65 (DICOM nodes) / ADM-66 (analyzer mapping) → verify with logs.
- **F-ADM-14 Storage governance:** ADM-70 → ADM-71 (policies) → ADM-72 (quarantine review) → ADM-73.
- **F-ADM-15 Backup & restore:** ADM-81 (schedule/verify) → ADM-82 (restore wizard, MFA, maintenance mode ADM-83).
- **F-ADM-16 Legacy migration:** ADM-85 (upload → mapping → dry-run → validation report → import → reconciliation) → ADM-86 (data-quality review with masked data).
- **F-ADM-17 Monitoring & incident:** ADM-74 → ADM-75 / ADM-76 / ADM-77 → ADM-78 → announcement ADM-90 / maintenance ADM-83.
- **F-ADM-18 Support:** ADM-87 → ADM-88 → resolution / KB ADM-89.
- **F-ADM-19 Reporting:** ADM-92 → ADM-93 → ADM-95.
- **F-ADM-20 Documentation access:** ADM-68 (manage who can open the API documentation portal; link to it).

## Screens
### Home
- **ADM-01 System dashboard** — service health tiles (API, database, cache, storage, queue), active users & sessions, failed logins, pending tasks (expiring licence, certificates, backups), jobs status, recent admin actions, version.

### Users & access
- **ADM-02 Users** — table (name, username, e-mail, roles, department, **MFA status**, last sign-in, status chips: active/disabled/locked), filters, bulk actions, "Créer un utilisateur".
- **ADM-03 Create user** — identity, username (live validation), e-mail, linked employee, roles (multi-select with MFA-required indicator), department; "mot de passe provisoire généré".
- **ADM-04 User created** — **temporary password shown once** (copy/print), onboarding instructions, warning that the user must change it and (for clinical roles) enrol MFA.
- **ADM-05 User detail** — profile, roles, status, MFA, sessions, linked employee, security events, **admin actions timeline**; action menu.
- **ADM-06 Edit roles** — replace role set with consequences preview ("coupe les sessions, droits recalculés immédiatement"); self-modification blocked state.
- **ADM-07 Disable / enable** — dialog with reason and immediate-effect notice; re-enable variant.
- **ADM-08 Unlock account** — confirm, shows lockout reason/time.
- **ADM-09 Reset MFA** — confirm, consequences (sessions cut, must re-enrol), MFA re-auth of the admin.
- **ADM-10 Force password change** — flag account, notify user.
- **ADM-11 Active sessions** — all sessions (user, device, IP, started, last activity), revoke one/all of a user, suspicious markers.
- **ADM-12 Bulk import users** — CSV upload, column mapping, validation errors, preview, results report.
- **ADM-13 Invitations ★** — staff & patient-portal invitations list (sent, opened, activated, expired), resend, revoke.
- **ADM-14 Employee directory** — HR master: designation, department, licence/registration, contacts, status.
- **ADM-15 Employee form** — create/edit employee, photo, signature image, documents.

### Roles & permissions
- **ADM-16 Roles** — list with system-role badge, users count, MFA required, last modified.
- **ADM-17 Role detail** — permissions grouped by module, users in role, change history.
- **ADM-18 Create / edit role** — name, code, description, MFA requirement, copy-from-role.
- **ADM-19 Permission matrix editor** — resource × action × scope (own / department / all), search, bulk toggles, **diff preview before save**, system roles read-only state, approval workflow ★.
- **ADM-20 Impact analysis ★** — who gains/loses access, affected users list, risky combinations flagged.
- **ADM-21 Separation-of-duties explanation** — why the admin role cannot access clinical data, what it can do instead, how clinical access is granted (care relationship, break-glass), link to audit.

### Security settings
- **ADM-22 Password policy** — min length, breached-password check, forbidden patterns, history, expiry (default none per NIST), live example validator.
- **ADM-23 MFA settings** — enforce by role, grace period, recovery codes count, allowed methods, reset policy.
- **ADM-24 Sessions & lockout** — access-token lifetime, refresh lifetime, idle timeout, lockout thresholds & durations, concurrent sessions rule; impact preview.
- **ADM-25 Network rules ★** — IP allow/deny lists, geo restrictions, per-role rules.
- **ADM-26 API keys & service accounts ★** — create (scopes, expiry), rotate, revoke, last used.
- **ADM-27 Secrets & key status** — inventory of secrets (never values): encryption key age/version, rotation reminders, rotate action ★ with MFA.
- **ADM-28 Security events (technical)** — failed logins, lockouts, token-reuse detections, 403 spikes, IP map; links to sessions/users.
- **ADM-29 Break-glass & alert policy** — reason list, notification recipients, review SLA.
- **ADM-30 Consent & legal texts** — manage consent/terms/privacy-notice texts per language with versions (DPO read-only).

### Organization
- **ADM-31 Facility profile** — name, logos, addresses, phones, registration/tax numbers, letterhead preview.
- **ADM-32 Sites / branches** — multi-site list, per-site settings.
- **ADM-33 Departments & units** — tree editor, department types (OPD, IPD, ER, lab…), heads.
- **ADM-34 Wards, rooms & beds** — ward builder (grid), room/bed types, bed tariffs, status, bulk create.
- **ADM-35 Working contexts** — counters, cash registers, lab benches, pharmacy counters, printers, assignment to sites.
- **ADM-36 Calendar & hours** — working hours, holidays, closures.
- **ADM-37 Clinician schedules** — templates, slot rules, exceptions, bulk apply.
- **ADM-38 Specialities & designations** — catalogs.

### Reference data
- **ADM-39 Master-data hub** — catalog tiles with record counts, last edited, import/export.
- **ADM-40 Generic master editor** — table CRUD (countries, regions, religions, occupations, relations, ethnic groups, etc.), inline edit, import/export, usage count & deactivate instead of delete.
- **ADM-41 Payment modes & currencies** — modes (cash, card, mobile money, cheque, insurance), currency, rounding, exchange rates.
- **ADM-42 Taxes** — tax codes, rates, applicability.
- **ADM-43 Insurance providers & schemes** — providers, plans, coverage rules (% , caps, exclusions), copay, price category mapping, contacts.
- **ADM-44 Price categories & tariffs** — price lists per payer/category, effective dates, bulk % update with preview, history.
- **ADM-45 Billable items catalog** — items/services with codes, department, price per list, taxes, active, import.
- **ADM-46 Packages builder** — inclusions/exclusions, price, validity, consumption rules.
- **ADM-47 Discount schemes** — schemes, eligibility, limits, approval thresholds.
- **ADM-48 Lab catalog editor** — tests, panels, containers, sample types, TAT, reference ranges (age/sex), critical limits, methods; versioned publish.
- **ADM-49 Radiology catalog & protocols editor** — exams, modalities, prep, durations, protocols.
- **ADM-50 Drug master administration** — import/update drug master, ATC classes, schedules, interaction database source/version.
- **ADM-51 Clinical templates & forms builder** — note templates, order sets, structured forms designer (drag-and-drop fields, conditional logic, preview), versioning.
- **ADM-52 Terminology management** — ICD-10 and other code sets, updates, mappings, search.
- **ADM-53 Vaccination schedules** — vaccines, schedules by age, intervals, stock link.
- **ADM-54 Queue configuration** — services, counters, ticket formats/prefixes, priorities, announcement texts/voice.
- **ADM-55 Appointment configuration** — slot lengths, appointment types, booking windows, cancellation rules, reminders.
- **ADM-56 Visit types & follow-up rules** — types, free follow-up days, fee rules.
- **ADM-57 Number sequences** — MRN/invoice/receipt/voucher formats, prefixes, yearly reset, preview.
- **ADM-58 Print template designer** — letterheads, receipts, prescriptions, reports; drag fields, paper sizes (A4/A5/80 mm), live preview with sample data.
- **ADM-59 Notification templates** — SMS/e-mail/push templates with variables, languages, test send.
- **ADM-60 Translations ★** — UI strings FR/EN editor, missing keys, export/import.
- **ADM-61 Approval workflows** — discounts, refunds, POs, vouchers, stock adjustments: thresholds, approvers, escalation.
- **ADM-62 Clinical alert rules** — critical value limits, CDS rule sets, interaction severity thresholds, source versions.

### Integrations
- **ADM-63 Integrations hub** — cards: lab analyzers (LIS), DICOM/PACS, SMS, e-mail (SMTP), payment gateways (mobile money, cards), insurance APIs, national registries, devices; status chips.
- **ADM-64 Integration detail** — endpoint config, credentials (masked; reveal needs MFA), **test connection**, last sync, error log.
- **ADM-65 DICOM nodes** — AE titles, hosts/ports, modality worklist config, echo test.
- **ADM-66 Analyzer interface mapping** — instrument test codes ↔ catalog codes, unit conversions, validation.
- **ADM-67 Webhooks & API usage ★** — outgoing webhooks, deliveries, retries; API usage charts.
- **ADM-68 API documentation access** — who holds the "api.docs:read" permission, session settings, link to the documentation portal, open-in-new-tab.
- **ADM-69 HL7 / FHIR endpoints ★** — enabled resources, test console, auth config.

### Files & storage
- **ADM-70 Storage overview** — buckets/usage/growth/health, by classification (FILE-11 admin variant).
- **ADM-71 Upload & classification policies** — allowed types (magic-byte validation), max sizes per type, scanning on/off, retention defaults.
- **ADM-72 Quarantine management** — malware detections, details, delete/release (with reason), notifications.
- **ADM-73 Lifecycle & purge** — trash retention, versioning, purge schedule (policies set with DPO), dry-run.

### Operations
- **ADM-74 System health** — service status, latency/error charts, dependencies, uptime.
- **ADM-75 Background jobs** — scheduled jobs list, last/next run, duration, failures, retry/run-now.
- **ADM-76 Technical logs** — searchable log viewer (level, service, correlation id), no patient data.
- **ADM-77 Incidents ★** — detected errors/incidents list, status, assignment.
- **ADM-78 Performance ★** — response times, slow queries, capacity indicators.
- **ADM-79 Usage analytics** — module usage, active users by role/day, adoption.
- **ADM-80 Licence & version** — licence validity/expiry notice (full-page variant for expired licence), version, changelog, updates.
- **ADM-81 Backups** — schedule, history, size, **verification status**, retention, download/export.
- **ADM-82 Restore wizard** — choose restore point, impact summary, maintenance-mode requirement, MFA re-auth, progress & result.
- **ADM-83 Maintenance mode** — enable/schedule, banner text per language, allowed users, countdown.
- **ADM-84 Database & migrations** — schema version, pending migrations, applied history, dry-run.
- **ADM-85 Legacy data migration wizard** — 4 frames: upload & source detection → field mapping → dry-run & validation report → import with progress → reconciliation report (counts, checksums).
- **ADM-86 Data quality ★** — duplicate/inconsistency scanner showing **masked** demographics, send to records team; explicit "données masquées" state.

### Support & communication
- **ADM-87 Helpdesk inbox** — all tickets, SLA timers, priority, assignee, filters.
- **ADM-88 Ticket detail** — thread, internal notes, status, attachments, linked user/screen, resolution.
- **ADM-89 Knowledge base editor ★** — articles, categories, visibility by role, versions.
- **ADM-90 Announcements** — broadcast banner/notification to roles/sites, schedule, preview, history.
- **ADM-91 Admin audit trail** — everything admins did (who/what/when/reason) with filters and export.

### Reports & BI
- **ADM-92 Report builder** — operational datasets only (users, sessions, jobs, helpdesk, usage, finance summary, inventory summary…), columns/filters/grouping/chart, preview, save/schedule.
- **ADM-93 Saved reports & schedules** — list, owners, recipients, run history.
- **ADM-94 KPI dashboard builder ★** — widgets drag/resize, data sources, share to roles.
- **ADM-95 Report catalog & permissions** — which role can run which report; request access.

### Onboarding & environment
- **ADM-96 First-run setup wizard** — 8 steps (facility, first admin & MFA, departments, wards, roles review, tariffs, integrations, import) with progress rail, 3 key frames minimum + completion.
- **ADM-97 Environment status** — read-only configuration checklist (database connected, cache connected, encryption key set, HTTPS/cookies secure, backups configured, docs enabled?) with fix hints — **never shows secret values**.

**Required extra states:** self-modification blocked, last-admin protection (cannot disable the only SYSTEM_ADMIN), system roles read-only, MFA re-auth modal for sensitive actions, restore in progress (blocking overlay), integration down, quarantine alert badge, licence expired full-page, pending migrations banner, bulk-import partial failure, maintenance mode active banner for all users.

**Screen count — Part 12:** **97 screens** (ADM-01 … ADM-97).


---

# PART 13 — CROSS-PROFILE END-TO-END JOURNEYS & FINAL CHECKLIST

## 13.1 End-to-end journeys (`E2E-xx`)
These journeys cross profiles. On a dedicated Figma page `13 · End-to-end journeys`, create one **swim-lane flow diagram per journey** (one lane per profile/actor), using the exact screen IDs as linked frames, and wire the prototype connections between the screens of different profiles with a "hand-off" label (notification, status change, printed document, QR scan).

- **E2E-01 Outpatient visit, from booking to follow-up.** Patient books (PAT-03 → PAT-07) → receptionist checks in (REC-21) and creates the visit (REC-14 → REC-15) → cashier collects the consultation fee (CSH-06 → CSH-07 → CSH-15 → CSH-17) → nurse takes vitals (NUR-13) → doctor calls the patient (DOC-03), consults (DOC-06 → DOC-12), orders labs (DOC-13) and prescribes (DOC-16 → DOC-18) → lab: collect (LAB-06), receive (LAB-08), result (LAB-12), verify (LAB-20), release (LAB-24) → doctor reviews (DOC-40 → DOC-41) and communicates (DOC-43) → pharmacist verifies and dispenses (PHA-02 → PHA-04 → PHA-07 → PHA-11) with billing (PHA-10 → CSH-15) → patient sees results, prescription and invoice (PAT-16, PAT-20, PAT-26) and the follow-up appointment (PAT-08).
- **E2E-02 Emergency arrival → admission → stay → discharge.** Registration (REC-39) → triage (NUR-47 → NUR-48) → ED doctor (DOC-60 → DOC-61 → DOC-62: admit) → admission (REC-30 → REC-34) with deposit (CSH-22) → ward receives (NUR-06 → NUR-07 → NUR-08) → admission orders (DOC-49 → DOC-51) → medication round (NUR-19 → NUR-20) with pharmacy supply (PHA-14 → PHA-17) → daily rounds (DOC-46 → DOC-52) → discharge planning (DOC-55 → DOC-57 → DOC-56) → nursing discharge (NUR-44 → NUR-45) → final bill (CSH-27 → CSH-28) → administrative discharge (REC-37) → patient discharge summary (PAT-14) → bed cleaning (NUR-70).
- **E2E-03 Imaging.** Doctor orders (DOC-14) → radiologist vets (RAD-04) → schedule (RAD-06) → patient prep notice (PAT-08) → arrival & safety (RAD-07) → acquisition (RAD-08) → viewing (RAD-13) → report & sign (RAD-20 → RAD-22) → doctor reads (DOC-35 / DOC-41) → patient reads (PAT-17 → PAT-18) → critical finding branch (RAD-25 → DOC-42).
- **E2E-04 Procurement to payment.** Low stock (PHA-31) → requisition (PHA-38) → PO (PHA-39) → goods receipt (PHA-41) → supplier invoice (ACC-20) → payment run (ACC-21) → bank reconciliation (ACC-30).
- **E2E-05 Month-end finance.** Cashier session closes (CSH-04) → collection reports (CSH-37, CSH-38) → integration queue cleared (ACC-16) → depreciation (ACC-41) → payroll posted (ACC-49) → close checklist (ACC-33) → statements (ACC-23 → ACC-26) → lock period (ACC-35).
- **E2E-06 Patient privacy request (RGPD).** Patient requests export (PAT-37 → PAT-39) → DPO receives and verifies (DPO-16 → DPO-17) → package prepared (DPO-18) → response (DPO-20) → patient downloads (PAT-39 status).
- **E2E-07 New staff member onboarding.** Admin creates account (ADM-02 → ADM-03 → ADM-04) → staff first sign-in (AUTH-01 → AUTH-07 → AUTH-08 → AUTH-09 → AUTH-10 → AUTH-02 → AUTH-23) → role dashboard (REC-01 / CSH-01 / DOC-01 / NUR-01 / PHA-01 / LAB-01 / RAD-01 / ACC-01 / DPO-01) → DPO sees the new account in the directory (DPO-30).
- **E2E-08 Break-glass emergency access.** Doctor opens a restricted record (PTS-07) → break-glass (AUTH-20) → record opens with red banner (DOC-28) → DPO queue (DPO-11) → review & decision (DPO-12) → possible investigation case (DPO-10).
- **E2E-09 Maternity.** ANC visits (DOC-68) → admission in labour (REC-30 → REC-34) → nursing labour monitoring (NUR-51 → NUR-52) → delivery (DOC-69) → newborn care & birth notification (NUR-53, PRN-17) → postnatal (NUR-54 / DOC-70) → discharge (E2E-02 end) → vaccination follow-up (NUR-59, PAT-23).
- **E2E-10 Surgery.** Booking (DOC-64) → pre-op & consent (DOC-65) → theatre schedule & checklist (NUR-55 → NUR-56) → intra-op (NUR-57) → recovery (NUR-58) → operation note (DOC-66) → post-op orders (DOC-67) → ward transfer (NUR-43) → billing package (CSH-29).
- **E2E-11 Medication safety loop.** Prescribe with alert (DOC-16 → DOC-17) → pharmacist verification & intervention (PHA-04 → PHA-05 / PHA-52) → ward administration with barcode (NUR-20 → NUR-25) → adverse reaction (PHA-53) → allergy list updated (DOC-32).
- **E2E-12 Insurance claim.** Eligibility at registration (REC-06 → REC-41 → REC-42) → insurance split at billing (CSH-12) → claim batch (CSH-30 → CSH-31) → tracking & rejection handling (CSH-32 → CSH-33) → reconciliation (CSH-34) → ledger (ACC-16).
- **E2E-13 Security incident.** Anomaly alert (DPO-08 / DPO-14) → admin sessions review and revoke (ADM-11 → ADM-07) → breach register (DPO-27 → DPO-28) → announcement to staff (ADM-90).
- **E2E-14 Lab critical value.** Result flagged (LAB-12 / LAB-20) → call-back documentation (LAB-21) → doctor acknowledgement (DOC-42) → nurse notified (NUR-30) → release (LAB-24).

## 13.2 Master screen index (the AI must produce exactly these counts)
| Part | Prefix | Screens |
|---|---|---:|
| 1 Shared | AUTH 23 · SHELL 13 · PTS 7 · FILE 11 · PRN 17 · TV 3 | 74 |
| 2 Patient | PAT | 47 |
| 3 Receptionist | REC | 51 |
| 4 Cashier | CSH | 42 |
| 5 DPO / Auditor | DPO | 37 |
| 6 Accountant | ACC | 64 |
| 7 Lab technician | LAB | 47 |
| 8 Radiologist | RAD | 41 |
| 9 Pharmacist | PHA | 66 |
| 10 Nurse | NUR | 70 |
| 11 Doctor | DOC | 80 |
| 12 System administrator | ADM | 97 |
| **Total** | | **716 screens** (plus the states, dark-mode samples and device variants required by §0.3 and §0.7) |
| 13 | E2E | 14 journey diagrams |

## 13.3 Final self-check (do this before declaring the work complete)
1. Print an inventory per page (`ID · title`) and compare with the counts above; list any missing ID and create it.
2. Every flow listed in Parts 1–12 is a connected prototype path; every `E2E-xx` swim-lane diagram exists.
3. **Style audit:** zero gradients, zero blur/glow/decorative shadows, no pills, no radius above 4 px, circles only for avatars and status dots (see the strict style rules in §0.4). The design-system page contains every component of §0.5 with all variants/states in light & dark; all screens use only tokens from §0.4 and components from §0.5 (no detached one-off styles).
4. Every list/table screen has loading, empty, filtered-empty and error states; every form has validation and submitting states; every critical action has a confirmation with reason.
5. Role integrity: no staff screen shows data its role may not see (receptionist/cashier: no clinical content; admin: no clinical data; DPO: no clinical content in audit; patient: own data only). Locked/denied states exist for each profile.
6. Security UX present: idle-timeout, session expired, MFA prompts, break-glass banner, masked fields with reveal, audit footer on clinical screens.
7. French UI copy with English parity; no lorem ipsum; realistic sample data; accessibility (AA contrast, focus, touch targets) verified on samples.


---

