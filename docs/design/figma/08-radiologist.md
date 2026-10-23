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
