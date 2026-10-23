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
