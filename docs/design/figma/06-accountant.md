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
