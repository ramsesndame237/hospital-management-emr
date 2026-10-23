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
