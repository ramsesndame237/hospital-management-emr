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
