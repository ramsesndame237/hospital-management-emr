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
