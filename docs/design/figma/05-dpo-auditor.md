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
