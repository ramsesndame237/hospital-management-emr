/* GÉNÉRÉ par tools/generate-entities.mjs depuis migration/inventory/entities.json : ne pas modifier à la main. */
import { Column, Entity, PrimaryColumn, PrimaryGeneratedColumn } from 'typeorm';
import { NUM } from '../transformers';

@Entity({ name: 'acc_bill_ledger_mapping' })
export class AccountingBillLedgerMappingModel {
  @PrimaryGeneratedColumn({ name: 'bill_ledger_mapping_id' })
  BillLedgerMappingId!: number;

  @Column({ name: 'ledger_id', type: 'integer', nullable: false })
  LedgerId!: number;

  @Column({ name: 'service_department_id', type: 'integer', nullable: false })
  ServiceDepartmentId!: number;

  @Column({ name: 'item_id', type: 'integer', nullable: false })
  ItemId!: number;

  @Column({ name: 'hospital_id', type: 'integer', nullable: false })
  HospitalId!: number;

  @Column({ name: 'sub_ledger_id', type: 'integer', nullable: true })
  SubLedgerId!: number | null;

  @Column({ name: 'is_active', type: 'boolean', nullable: false })
  IsActive!: boolean;

  @Column({ name: 'billing_type', type: 'text', nullable: true })
  BillingType!: string | null;

}

@Entity({ name: 'acc_fiscal_year_log' })
export class FiscalYearLogModel {
  @PrimaryGeneratedColumn({ name: 'log_id' })
  LogId!: number;

  @Column({ name: 'fiscal_year_id', type: 'integer', nullable: true })
  FiscalYearId!: number | null;

  @Column({ name: 'log_type', type: 'text', nullable: true })
  LogType!: string | null;

  @Column({ name: 'log_details', type: 'text', nullable: true })
  LogDetails!: string | null;

  @Column({ name: 'created_on', type: 'timestamp', nullable: true })
  CreatedOn!: string | null;

  @Column({ name: 'created_by', type: 'integer', nullable: true })
  CreatedBy!: number | null;

  @Column({ name: 'hospital_id', type: 'integer', nullable: true })
  HospitalId!: number | null;

}

@Entity({ name: 'acc_ledger' })
export class LedgerModel {
  @PrimaryGeneratedColumn({ name: 'ledger_id' })
  LedgerId!: number;

  @Column({ name: 'ledger_group_id', type: 'integer', nullable: false })
  LedgerGroupId!: number;

  @Column({ name: 'ledger_name', type: 'text', nullable: true })
  LedgerName!: string | null;

  @Column({ name: 'ledger_reference_id', type: 'integer', nullable: true })
  LedgerReferenceId!: number | null;

  @Column({ name: 'description', type: 'text', nullable: true })
  Description!: string | null;

  @Column({ name: 'section_id', type: 'integer', nullable: true })
  SectionId!: number | null;

  @Column({ name: 'created_on', type: 'timestamp', nullable: false })
  CreatedOn!: string;

  @Column({ name: 'created_by', type: 'integer', nullable: false })
  CreatedBy!: number;

  @Column({ name: 'is_active', type: 'boolean', nullable: false })
  IsActive!: boolean;

  @Column({ name: 'is_cost_center_applicable', type: 'boolean', nullable: true })
  IsCostCenterApplicable!: boolean | null;

  @Column({ name: 'opening_balance', type: 'numeric', nullable: false, transformer: NUM })
  OpeningBalance!: number;

  @Column({ name: 'dr_cr', type: 'boolean', nullable: false })
  DrCr!: boolean;

  @Column({ name: 'name', type: 'text', nullable: true })
  Name!: string | null;

  @Column({ name: 'ledger_type', type: 'text', nullable: true })
  LedgerType!: string | null;

  @Column({ name: 'code', type: 'text', nullable: true })
  Code!: string | null;

  @Column({ name: 'pan_no', type: 'text', nullable: true })
  PANNo!: string | null;

  @Column({ name: 'address', type: 'text', nullable: true })
  Address!: string | null;

  @Column({ name: 'mobile_no', type: 'text', nullable: true })
  MobileNo!: string | null;

  @Column({ name: 'credit_period', type: 'integer', nullable: true })
  CreditPeriod!: number | null;

  @Column({ name: 'tds_percent', type: 'numeric', nullable: true, transformer: NUM })
  TDSPercent!: number | null;

  @Column({ name: 'landline_no', type: 'text', nullable: true })
  LandlineNo!: string | null;

  @Column({ name: 'hospital_id', type: 'integer', nullable: false })
  HospitalId!: number;

  @Column({ name: 'legal_ledger_name', type: 'text', nullable: true })
  LegalLedgerName!: string | null;

}

@Entity({ name: 'acc_ledger_mapping' })
export class LedgerMappingModel {
  @PrimaryGeneratedColumn({ name: 'ledger_mapping_id' })
  LedgerMappingId!: number;

  @Column({ name: 'ledger_id', type: 'integer', nullable: false })
  LedgerId!: number;

  @Column({ name: 'reference_id', type: 'integer', nullable: false })
  ReferenceId!: number;

  @Column({ name: 'ledger_type', type: 'text', nullable: true })
  LedgerType!: string | null;

  @Column({ name: 'hospital_id', type: 'integer', nullable: false })
  HospitalId!: number;

  @Column({ name: 'cost_center_id', type: 'integer', nullable: true })
  CostCenterId!: number | null;

  @Column({ name: 'sub_ledger_id', type: 'integer', nullable: true })
  SubLedgerId!: number | null;

}

@Entity({ name: 'acc_ledger_balance_history' })
export class LedgerBalanceHistoryModel {
  @PrimaryGeneratedColumn({ name: 'ledger_balance_history_id' })
  LedgerBalanceHistoryId!: number;

  @Column({ name: 'fiscal_year_id', type: 'integer', nullable: false })
  FiscalYearId!: number;

  @Column({ name: 'ledger_id', type: 'integer', nullable: false })
  LedgerId!: number;

  @Column({ name: 'opening_balance', type: 'numeric', nullable: false, transformer: NUM })
  OpeningBalance!: number;

  @Column({ name: 'opening_dr_cr', type: 'boolean', nullable: false })
  OpeningDrCr!: boolean;

  @Column({ name: 'closing_balance', type: 'numeric', nullable: false, transformer: NUM })
  ClosingBalance!: number;

  @Column({ name: 'closing_dr_cr', type: 'boolean', nullable: false })
  ClosingDrCr!: boolean;

  @Column({ name: 'created_by', type: 'integer', nullable: false })
  CreatedBy!: number;

  @Column({ name: 'created_on', type: 'timestamp', nullable: false })
  CreatedOn!: string;

  @Column({ name: 'modified_on', type: 'timestamp', nullable: true })
  ModifiedOn!: string | null;

  @Column({ name: 'modified_by', type: 'integer', nullable: true })
  ModifiedBy!: number | null;

  @Column({ name: 'hospital_id', type: 'integer', nullable: false })
  HospitalId!: number;

}

@Entity({ name: 'acc_log_edit_voucher' })
export class EditVoucherLogModel {
  @PrimaryGeneratedColumn({ name: 'log_id' })
  LogId!: number;

  @Column({ name: 'transaction_date', type: 'timestamp', nullable: true })
  TransactionDate!: string | null;

  @Column({ name: 'section_id', type: 'integer', nullable: true })
  SectionId!: number | null;

  @Column({ name: 'voucher_number', type: 'text', nullable: true })
  VoucherNumber!: string | null;

  @Column({ name: 'reason', type: 'text', nullable: true })
  Reason!: string | null;

  @Column({ name: 'old_vocher_json_data', type: 'text', nullable: true })
  OldVocherJsonData!: string | null;

  @Column({ name: 'fiscal_year_id', type: 'integer', nullable: true })
  FiscalYearId!: number | null;

  @Column({ name: 'hospital_id', type: 'integer', nullable: true })
  HospitalId!: number | null;

  @Column({ name: 'created_on', type: 'timestamp', nullable: true })
  CreatedOn!: string | null;

  @Column({ name: 'created_by', type: 'integer', nullable: true })
  CreatedBy!: number | null;

}

@Entity({ name: 'acc_map_bank_and_suspense_account_reconciliation' })
export class BankAndSuspenseAccountReconciliationMapModel {
  @PrimaryGeneratedColumn({ name: 'bank_and_suspense_account_reconciliation_id' })
  BankAndSuspenseAccountReconciliationId!: number;

  @Column({ name: 'bank_reconciliation_voucher_number', type: 'text', nullable: true })
  BankReconciliationVoucherNumber!: string | null;

  @Column({ name: 'suspens_reconciliation_voucher_number', type: 'text', nullable: true })
  SuspensReconciliationVoucherNumber!: string | null;

  @Column({ name: 'bank_ledger_id', type: 'integer', nullable: false })
  BankLedgerId!: number;

}

@Entity({ name: 'acc_map_txn_item_cost_center_item' })
export class MapTransactionItemCostCenterItemModel {
  @PrimaryGeneratedColumn({ name: 'txn_item_cost_center_item_id' })
  TxnItemCostCenterItemId!: number;

  @Column({ name: 'transaction_item_id', type: 'integer', nullable: false })
  TransactionItemId!: number;

  @Column({ name: 'cost_center_item_id', type: 'integer', nullable: false })
  CostCenterItemId!: number;

  @Column({ name: 'amount', type: 'double precision', nullable: true })
  Amount!: number | null;

  @Column({ name: 'created_on', type: 'timestamp', nullable: true })
  CreatedOn!: string | null;

  @Column({ name: 'created_by', type: 'integer', nullable: false })
  CreatedBy!: number;

  @Column({ name: 'hospital_id', type: 'integer', nullable: true })
  HospitalId!: number | null;

}

@Entity({ name: 'acc_mst_bank_reconciliation_category' })
export class BankReconciliationCategoryModel {
  @PrimaryGeneratedColumn({ name: 'category_id' })
  CategoryId!: number;

  @Column({ name: 'category_name', type: 'text', nullable: true })
  CategoryName!: string | null;

  @Column({ name: 'description', type: 'text', nullable: true })
  Description!: string | null;

  @Column({ name: 'created_on', type: 'timestamp', nullable: true })
  CreatedOn!: string | null;

  @Column({ name: 'created_by', type: 'integer', nullable: false })
  CreatedBy!: number;

  @Column({ name: 'is_active', type: 'boolean', nullable: false })
  IsActive!: boolean;

  @Column({ name: 'mapped_ledger_id', type: 'integer', nullable: true })
  MappedLedgerId!: number | null;

  @Column({ name: 'sub_ledger_id', type: 'integer', nullable: true })
  SubLedgerId!: number | null;

  @Column({ name: 'dr_cr', type: 'boolean', nullable: false })
  DrCr!: boolean;

}

@Entity({ name: 'acc_mst_chart_of_accounts' })
export class ChartOfAccountModel {
  @PrimaryGeneratedColumn({ name: 'chart_of_account_id' })
  ChartOfAccountId!: number;

  @Column({ name: 'chart_of_account_name', type: 'text', nullable: true })
  ChartOfAccountName!: string | null;

  @Column({ name: 'primary_group_id', type: 'integer', nullable: false })
  PrimaryGroupId!: number;

  @Column({ name: 'coa_code', type: 'text', nullable: true })
  COACode!: string | null;

  @Column({ name: 'description', type: 'text', nullable: true })
  Description!: string | null;

  @Column({ name: 'created_on', type: 'timestamp', nullable: false })
  CreatedOn!: string;

  @Column({ name: 'modified_on', type: 'timestamp', nullable: true })
  ModifiedOn!: string | null;

  @Column({ name: 'modified_by', type: 'integer', nullable: true })
  ModifiedBy!: number | null;

  @Column({ name: 'created_by', type: 'integer', nullable: false })
  CreatedBy!: number;

  @Column({ name: 'is_active', type: 'boolean', nullable: false })
  IsActive!: boolean;

}

@Entity({ name: 'acc_mst_code_details' })
export class AccountingCodeDetailsModel {
  @PrimaryGeneratedColumn({ name: 'id' })
  Id!: number;

  @Column({ name: 'code', type: 'text', nullable: true })
  Code!: string | null;

  @Column({ name: 'name', type: 'text', nullable: true })
  Name!: string | null;

  @Column({ name: 'description', type: 'text', nullable: true })
  Description!: string | null;

  @Column({ name: 'hospital_id', type: 'integer', nullable: false })
  HospitalId!: number;

}

@Entity({ name: 'acc_mst_cost_center' })
export class CostCenterModel {
  @PrimaryGeneratedColumn({ name: 'cost_center_id' })
  CostCenterId!: number;

  @Column({ name: 'cost_center_code', type: 'text', nullable: true })
  CostCenterCode!: string | null;

  @Column({ name: 'business_center_name', type: 'text', nullable: true })
  BusinessCenterName!: string | null;

  @Column({ name: 'cost_center_name', type: 'text', nullable: true })
  CostCenterName!: string | null;

  @Column({ name: 'description', type: 'text', nullable: true })
  Description!: string | null;

  @Column({ name: 'parent_cost_center_id', type: 'integer', nullable: true })
  ParentCostCenterId!: number | null;

  @Column({ name: 'hierarchy_level', type: 'integer', nullable: false })
  HierarchyLevel!: number;

  @Column({ name: 'is_active', type: 'boolean', nullable: false })
  IsActive!: boolean;

  @Column({ name: 'is_default', type: 'boolean', nullable: false })
  IsDefault!: boolean;

  @Column({ name: 'created_by', type: 'integer', nullable: false })
  CreatedBy!: number;

  @Column({ name: 'created_on', type: 'timestamp', nullable: true })
  CreatedOn!: string | null;

  @Column({ name: 'modified_by', type: 'integer', nullable: true })
  ModifiedBy!: number | null;

  @Column({ name: 'modified_on', type: 'timestamp', nullable: true })
  ModifiedOn!: string | null;

}

@Entity({ name: 'acc_mst_cost_center_items' })
export class CostCenterItemModel {
  @PrimaryGeneratedColumn({ name: 'cost_center_item_id' })
  CostCenterItemId!: number;

  @Column({ name: 'cost_center_item_name', type: 'text', nullable: true })
  CostCenterItemName!: string | null;

  @Column({ name: 'description', type: 'text', nullable: true })
  Description!: string | null;

  @Column({ name: 'created_on', type: 'timestamp', nullable: false })
  CreatedOn!: string;

  @Column({ name: 'created_by', type: 'integer', nullable: false })
  CreatedBy!: number;

  @Column({ name: 'is_active', type: 'boolean', nullable: false })
  IsActive!: boolean;

  @Column({ name: 'hospital_id', type: 'integer', nullable: true })
  HospitalId!: number | null;

}

@Entity({ name: 'acc_mst_fiscal_years' })
export class FiscalYearModel {
  @PrimaryGeneratedColumn({ name: 'fiscal_year_id' })
  FiscalYearId!: number;

  @Column({ name: 'fiscal_year_name', type: 'text', nullable: true })
  FiscalYearName!: string | null;

  @Column({ name: 'np_fiscal_year_name', type: 'text', nullable: true })
  NpFiscalYearName!: string | null;

  @Column({ name: 'start_date', type: 'timestamp', nullable: false })
  StartDate!: string;

  @Column({ name: 'end_date', type: 'timestamp', nullable: false })
  EndDate!: string;

  @Column({ name: 'description', type: 'text', nullable: true })
  Description!: string | null;

  @Column({ name: 'created_on', type: 'timestamp', nullable: false })
  CreatedOn!: string;

  @Column({ name: 'created_by', type: 'integer', nullable: false })
  CreatedBy!: number;

  @Column({ name: 'is_active', type: 'boolean', nullable: false })
  IsActive!: boolean;

  @Column({ name: 'is_closed', type: 'boolean', nullable: true })
  IsClosed!: boolean | null;

  @Column({ name: 'closed_by', type: 'integer', nullable: true })
  ClosedBy!: number | null;

  @Column({ name: 'closed_on', type: 'timestamp', nullable: true })
  ClosedOn!: string | null;

  @Column({ name: 'ready_to_close', type: 'boolean', nullable: true })
  ReadyToClose!: boolean | null;

  @Column({ name: 'hospital_id', type: 'integer', nullable: true })
  HospitalId!: number | null;

}

@Entity({ name: 'acc_mst_group_mapping' })
export class GroupMappingModel {
  @PrimaryGeneratedColumn({ name: 'group_mapping_id' })
  GroupMappingId!: number;

  @Column({ name: 'description', type: 'text', nullable: true })
  Description!: string | null;

  @Column({ name: 'section', type: 'integer', nullable: false })
  Section!: number;

  @Column({ name: 'details', type: 'text', nullable: true })
  Details!: string | null;

  @Column({ name: 'voucher_id', type: 'integer', nullable: true })
  VoucherId!: number | null;

  @Column({ name: 'remarks', type: 'text', nullable: true })
  Remarks!: string | null;

  @Column({ name: 'custom_voucher_id', type: 'integer', nullable: true })
  CustomVoucherId!: number | null;

}

@Entity({ name: 'acc_mst_hospital' })
export class HospitalModel {
  @PrimaryGeneratedColumn({ name: 'hospital_id' })
  HospitalId!: number;

  @Column({ name: 'hospital_short_name', type: 'text', nullable: true })
  HospitalShortName!: string | null;

  @Column({ name: 'hospital_long_name', type: 'text', nullable: true })
  HospitalLongName!: string | null;

  @Column({ name: 'is_active', type: 'boolean', nullable: false })
  IsActive!: boolean;

}

@Entity({ name: 'acc_mst_hospital_transfer_rules_mapping' })
export class HospitalTransferRuleMappingModel {
  @PrimaryGeneratedColumn({ name: 'hospital_transfer_rules_map_id' })
  HospitalTransferRulesMapId!: number;

  @Column({ name: 'hospital_id', type: 'integer', nullable: false })
  HospitalId!: number;

  @Column({ name: 'transfer_rule_id', type: 'integer', nullable: false })
  TransferRuleId!: number;

  @Column({ name: 'is_active', type: 'boolean', nullable: false })
  IsActive!: boolean;

}

@Entity({ name: 'acc_mst_ledger_group' })
export class LedgerGroupModel {
  @PrimaryGeneratedColumn({ name: 'ledger_group_id' })
  LedgerGroupId!: number;

  @Column({ name: 'primary_group', type: 'text', nullable: true })
  PrimaryGroup!: string | null;

  @Column({ name: 'coa', type: 'text', nullable: true })
  COA!: string | null;

  @Column({ name: 'ledger_group_name', type: 'text', nullable: true })
  LedgerGroupName!: string | null;

  @Column({ name: 'description', type: 'text', nullable: true })
  Description!: string | null;

  @Column({ name: 'created_on', type: 'timestamp', nullable: false })
  CreatedOn!: string;

  @Column({ name: 'created_by', type: 'integer', nullable: false })
  CreatedBy!: number;

  @Column({ name: 'is_active', type: 'boolean', nullable: false })
  IsActive!: boolean;

  @Column({ name: 'modified_by', type: 'integer', nullable: true })
  ModifiedBy!: number | null;

  @Column({ name: 'modified_on', type: 'timestamp', nullable: true })
  ModifiedOn!: string | null;

  @Column({ name: 'name', type: 'text', nullable: true })
  Name!: string | null;

  @Column({ name: 'code', type: 'text', nullable: true })
  Code!: string | null;

  @Column({ name: 'hospital_id', type: 'integer', nullable: false })
  HospitalId!: number;

  @Column({ name: 'coa_id', type: 'integer', nullable: false })
  COAId!: number;

}

@Entity({ name: 'acc_mst_ledger_group_category' })
export class LedgerGroupCategoryModel {
  @PrimaryGeneratedColumn({ name: 'ledger_group_category_id' })
  LedgerGroupCategoryId!: number;

  @Column({ name: 'ledger_group_category_name', type: 'text', nullable: true })
  LedgerGroupCategoryName!: string | null;

  @Column({ name: 'chart_of_account_id', type: 'integer', nullable: false })
  ChartOfAccountId!: number;

  @Column({ name: 'description', type: 'text', nullable: true })
  Description!: string | null;

  @Column({ name: 'created_on', type: 'timestamp', nullable: false })
  CreatedOn!: string;

  @Column({ name: 'is_debit', type: 'boolean', nullable: false })
  IsDebit!: boolean;

  @Column({ name: 'created_by', type: 'integer', nullable: false })
  CreatedBy!: number;

  @Column({ name: 'is_active', type: 'boolean', nullable: false })
  IsActive!: boolean;

}

@Entity({ name: 'acc_mst_mapping_detail' })
export class MappingDetailModel {
  @PrimaryGeneratedColumn({ name: 'accounting_mapping_detail_id' })
  AccountingMappingDetailId!: number;

  @Column({ name: 'group_mapping_id', type: 'integer', nullable: false })
  GroupMappingId!: number;

  @Column({ name: 'ledger_group_id', type: 'integer', nullable: false })
  LedgerGroupId!: number;

  @Column({ name: 'dr_cr', type: 'boolean', nullable: false })
  DrCr!: boolean;

  @Column({ name: 'description', type: 'text', nullable: true })
  Description!: string | null;

}

@Entity({ name: 'acc_mst_primary_group' })
export class PrimaryGroupModel {
  @PrimaryGeneratedColumn({ name: 'primary_group_id' })
  PrimaryGroupId!: number;

  @Column({ name: 'primary_group_code', type: 'text', nullable: true })
  PrimaryGroupCode!: string | null;

  @Column({ name: 'primary_group_name', type: 'text', nullable: true })
  PrimaryGroupName!: string | null;

  @Column({ name: 'is_active', type: 'boolean', nullable: false })
  IsActive!: boolean;

  @Column({ name: 'created_on', type: 'timestamp', nullable: false })
  CreatedOn!: string;

  @Column({ name: 'created_by', type: 'integer', nullable: false })
  CreatedBy!: number;

  @Column({ name: 'modified_on', type: 'timestamp', nullable: true })
  ModifiedOn!: string | null;

  @Column({ name: 'modified_by', type: 'integer', nullable: true })
  ModifiedBy!: number | null;

}

@Entity({ name: 'acc_mst_section_list' })
export class AccSectionModel {
  @PrimaryGeneratedColumn({ name: 'id' })
  Id!: number;

  @Column({ name: 'section_id', type: 'integer', nullable: false })
  SectionId!: number;

  @Column({ name: 'section_name', type: 'text', nullable: true })
  SectionName!: string | null;

  @Column({ name: 'section_code', type: 'text', nullable: true })
  SectionCode!: string | null;

  @Column({ name: 'hospital_id', type: 'integer', nullable: true })
  HospitalId!: number | null;

  @Column({ name: 'is_default', type: 'boolean', nullable: false })
  IsDefault!: boolean;

  @Column({ name: 'is_active', type: 'boolean', nullable: false })
  IsActive!: boolean;

}

@Entity({ name: 'acc_mst_sub_ledger' })
export class SubLedgerModel {
  @PrimaryGeneratedColumn({ name: 'sub_ledger_id' })
  SubLedgerId!: number;

  @Column({ name: 'sub_ledger_name', type: 'text', nullable: true })
  SubLedgerName!: string | null;

  @Column({ name: 'sub_ledger_code', type: 'text', nullable: true })
  SubLedgerCode!: string | null;

  @Column({ name: 'ledger_id', type: 'integer', nullable: false })
  LedgerId!: number;

  @Column({ name: 'description', type: 'text', nullable: true })
  Description!: string | null;

  @Column({ name: 'is_active', type: 'boolean', nullable: false })
  IsActive!: boolean;

  @Column({ name: 'created_by', type: 'integer', nullable: false })
  CreatedBy!: number;

  @Column({ name: 'created_on', type: 'timestamp', nullable: false })
  CreatedOn!: string;

  @Column({ name: 'opening_balance', type: 'numeric', nullable: false, transformer: NUM })
  OpeningBalance!: number;

  @Column({ name: 'dr_cr', type: 'boolean', nullable: false })
  DrCr!: boolean;

  @Column({ name: 'hospital_id', type: 'integer', nullable: false })
  HospitalId!: number;

  @Column({ name: 'is_default', type: 'boolean', nullable: false })
  IsDefault!: boolean;

}

@Entity({ name: 'acc_mst_voucher_head' })
export class VoucherHeadModel {
  @PrimaryGeneratedColumn({ name: 'voucher_head_id' })
  VoucherHeadId!: number;

  @Column({ name: 'voucher_head_name', type: 'text', nullable: true })
  VoucherHeadName!: string | null;

  @Column({ name: 'description', type: 'text', nullable: true })
  Description!: string | null;

  @Column({ name: 'created_on', type: 'timestamp', nullable: true })
  CreatedOn!: string | null;

  @Column({ name: 'created_by', type: 'integer', nullable: false })
  CreatedBy!: number;

  @Column({ name: 'modified_on', type: 'timestamp', nullable: true })
  ModifiedOn!: string | null;

  @Column({ name: 'modified_by', type: 'integer', nullable: true })
  ModifiedBy!: number | null;

  @Column({ name: 'is_active', type: 'boolean', nullable: false })
  IsActive!: boolean;

  @Column({ name: 'is_default', type: 'boolean', nullable: false })
  IsDefault!: boolean;

  @Column({ name: 'hospital_id', type: 'integer', nullable: true })
  HospitalId!: number | null;

}

@Entity({ name: 'acc_mst_vouchers' })
export class VoucherModel {
  @PrimaryGeneratedColumn({ name: 'voucher_id' })
  VoucherId!: number;

  @Column({ name: 'voucher_name', type: 'text', nullable: true })
  VoucherName!: string | null;

  @Column({ name: 'description', type: 'text', nullable: true })
  Description!: string | null;

  @Column({ name: 'created_on', type: 'timestamp', nullable: false })
  CreatedOn!: string;

  @Column({ name: 'created_by', type: 'integer', nullable: false })
  CreatedBy!: number;

  @Column({ name: 'is_active', type: 'boolean', nullable: false })
  IsActive!: boolean;

  @Column({ name: 'voucher_code', type: 'text', nullable: true })
  VoucherCode!: string | null;

  @Column({ name: 'is_copy_description', type: 'boolean', nullable: false })
  ISCopyDescription!: boolean;

  @Column({ name: 'show_payee_name', type: 'boolean', nullable: false })
  ShowPayeeName!: boolean;

  @Column({ name: 'show_cheque_number', type: 'boolean', nullable: false })
  ShowChequeNumber!: boolean;

}

@Entity({ name: 'acc_reverse_transaction' })
export class ReverseTransactionModel {
  @PrimaryGeneratedColumn({ name: 'reverse_transaction_id' })
  ReverseTransactionId!: number;

  @Column({ name: 'transaction_date', type: 'timestamp', nullable: false })
  TransactionDate!: string;

  @Column({ name: 'section', type: 'integer', nullable: false })
  Section!: number;

  @Column({ name: 'tu_id', type: 'integer', nullable: false })
  TUId!: number;

  @Column({ name: 'fiscal_year_id', type: 'integer', nullable: false })
  FiscalYearId!: number;

  @Column({ name: 'reason', type: 'text', nullable: true })
  Reason!: string | null;

  @Column({ name: 'json_data', type: 'text', nullable: true })
  JsonData!: string | null;

  @Column({ name: 'created_on', type: 'timestamp', nullable: false })
  CreatedOn!: string;

  @Column({ name: 'created_by', type: 'integer', nullable: false })
  CreatedBy!: number;

  @Column({ name: 'hospital_id', type: 'integer', nullable: false })
  HospitalId!: number;

}

@Entity({ name: 'acc_sub_ledger_balance_history' })
export class SubLedgerBalanceHistory {
  @PrimaryGeneratedColumn({ name: 'sub_ledger_balance_history_id' })
  SubLedgerBalanceHistoryId!: number;

  @Column({ name: 'fiscal_year_id', type: 'integer', nullable: false })
  FiscalYearId!: number;

  @Column({ name: 'sub_ledger_id', type: 'integer', nullable: false })
  SubLedgerId!: number;

  @Column({ name: 'opening_balance', type: 'numeric', nullable: true, transformer: NUM })
  OpeningBalance!: number | null;

  @Column({ name: 'opening_dr_cr', type: 'boolean', nullable: true })
  OpeningDrCr!: boolean | null;

  @Column({ name: 'closing_balance', type: 'numeric', nullable: true, transformer: NUM })
  ClosingBalance!: number | null;

  @Column({ name: 'closing_dr_cr', type: 'boolean', nullable: true })
  ClosingDrCr!: boolean | null;

  @Column({ name: 'created_by', type: 'integer', nullable: false })
  CreatedBy!: number;

  @Column({ name: 'created_on', type: 'timestamp', nullable: false })
  CreatedOn!: string;

  @Column({ name: 'modified_on', type: 'timestamp', nullable: true })
  ModifiedOn!: string | null;

  @Column({ name: 'modified_by', type: 'integer', nullable: true })
  ModifiedBy!: number | null;

  @Column({ name: 'hospital_id', type: 'integer', nullable: true })
  HospitalId!: number | null;

}

@Entity({ name: 'acc_transaction_history' })
export class AccountingTransactionHistoryModel {
  @PrimaryGeneratedColumn({ name: 'id' })
  Id!: number;

  @Column({ name: 'transaction_date', type: 'timestamp', nullable: true })
  TransactionDate!: string | null;

  @Column({ name: 'synced_on', type: 'timestamp', nullable: true })
  SyncedOn!: string | null;

  @Column({ name: 'synced_by', type: 'integer', nullable: false })
  SyncedBy!: number;

  @Column({ name: 'section_id', type: 'integer', nullable: true })
  SectionId!: number | null;

  @Column({ name: 'transaction_type', type: 'text', nullable: true })
  TransactionType!: string | null;

}

@Entity({ name: 'acc_transaction_cost_center_items' })
export class TransactionCostCenterItemModel {
  @PrimaryGeneratedColumn({ name: 'transaction_cost_center_item_id' })
  TransactionCostCenterItemId!: number;

  @Column({ name: 'transaction_item_id', type: 'integer', nullable: false })
  TransactionItemId!: number;

  @Column({ name: 'cost_center_item_id', type: 'integer', nullable: false })
  CostCenterItemId!: number;

  @Column({ name: 'amount', type: 'double precision', nullable: false })
  Amount!: number;

  @Column({ name: 'created_on', type: 'timestamp', nullable: true })
  CreatedOn!: string | null;

  @Column({ name: 'created_by', type: 'integer', nullable: false })
  CreatedBy!: number;

  @Column({ name: 'is_active', type: 'boolean', nullable: false })
  IsActive!: boolean;

}

@Entity({ name: 'acc_transaction_inventory_items' })
export class TransactionInventoryItemModel {
  @PrimaryGeneratedColumn({ name: 'transaction_inventory_item_id' })
  TransactionInventoryItemId!: number;

  @Column({ name: 'transaction_item_id', type: 'integer', nullable: false })
  TransactionItemId!: number;

  @Column({ name: 'item_id', type: 'integer', nullable: false })
  ItemId!: number;

  @Column({ name: 'amount', type: 'double precision', nullable: false })
  Amount!: number;

  @Column({ name: 'quantity', type: 'integer', nullable: false })
  Quantity!: number;

  @Column({ name: 'remarks', type: 'text', nullable: true })
  Remarks!: string | null;

  @Column({ name: 'created_on', type: 'timestamp', nullable: true })
  CreatedOn!: string | null;

  @Column({ name: 'created_by', type: 'integer', nullable: false })
  CreatedBy!: number;

  @Column({ name: 'is_active', type: 'boolean', nullable: false })
  IsActive!: boolean;

  @Column({ name: 'is_transferred_to_acc', type: 'boolean', nullable: true })
  IsTransferredToACC!: boolean | null;

}

@Entity({ name: 'acc_transaction_item_detail' })
export class TransactionItemDetailModel {
  @PrimaryGeneratedColumn({ name: 'transaction_item_detail_id' })
  TransactionItemDetailId!: number;

  @Column({ name: 'transaction_item_id', type: 'integer', nullable: false })
  TransactionItemId!: number;

  @Column({ name: 'amount', type: 'numeric', nullable: false, transformer: NUM })
  Amount!: number;

  @Column({ name: 'description', type: 'text', nullable: true })
  Description!: string | null;

  @Column({ name: 'reference_id', type: 'integer', nullable: false })
  ReferenceId!: number;

  @Column({ name: 'reference_type', type: 'text', nullable: true })
  ReferenceType!: string | null;

}

@Entity({ name: 'acc_transaction_items' })
export class TransactionItemModel {
  @PrimaryGeneratedColumn({ name: 'transaction_item_id' })
  TransactionItemId!: number;

  @Column({ name: 'transaction_id', type: 'integer', nullable: false })
  TransactionId!: number;

  @Column({ name: 'ledger_id', type: 'integer', nullable: false })
  LedgerId!: number;

  @Column({ name: 'dr_cr', type: 'boolean', nullable: false })
  DrCr!: boolean;

  @Column({ name: 'amount', type: 'numeric', nullable: false, transformer: NUM })
  Amount!: number;

  @Column({ name: 'created_on', type: 'timestamp', nullable: false })
  CreatedOn!: string;

  @Column({ name: 'created_by', type: 'integer', nullable: false })
  CreatedBy!: number;

  @Column({ name: 'is_active', type: 'boolean', nullable: false })
  IsActive!: boolean;

  @Column({ name: 'description', type: 'text', nullable: true })
  Description!: string | null;

  @Column({ name: 'hospital_id', type: 'integer', nullable: false })
  HospitalId!: number;

  @Column({ name: 'cost_center_id', type: 'integer', nullable: false })
  CostCenterId!: number;

  @Column({ name: 'transaction_type', type: 'text', nullable: true })
  TransactionType!: string | null;

}

@Entity({ name: 'acc_transactions' })
export class TransactionModel {
  @PrimaryGeneratedColumn({ name: 'transaction_id' })
  TransactionId!: number;

  @Column({ name: 'voucher_id', type: 'integer', nullable: false })
  VoucherId!: number;

  @Column({ name: 'fiscalyear_id', type: 'integer', nullable: false })
  FiscalyearId!: number;

  @Column({ name: 'remarks', type: 'text', nullable: true })
  Remarks!: string | null;

  @Column({ name: 'transaction_date', type: 'timestamp', nullable: false })
  TransactionDate!: string;

  @Column({ name: 'created_on', type: 'timestamp', nullable: false })
  CreatedOn!: string;

  @Column({ name: 'created_by', type: 'integer', nullable: false })
  CreatedBy!: number;

  @Column({ name: 'is_active', type: 'boolean', nullable: false })
  IsActive!: boolean;

  @Column({ name: 'voucher_number', type: 'text', nullable: true })
  VoucherNumber!: string | null;

  @Column({ name: 'payee_name', type: 'text', nullable: true })
  PayeeName!: string | null;

  @Column({ name: 'cheque_number', type: 'text', nullable: true })
  ChequeNumber!: string | null;

  @Column({ name: 'section_id', type: 'integer', nullable: false })
  SectionId!: number;

  @Column({ name: 'is_back_date_entry', type: 'boolean', nullable: false })
  IsBackDateEntry!: boolean;

  @Column({ name: 'transaction_type', type: 'text', nullable: true })
  TransactionType!: string | null;

  @Column({ name: 'tu_id', type: 'integer', nullable: false })
  TUId!: number;

  @Column({ name: 'day_voucher_number', type: 'integer', nullable: false })
  DayVoucherNumber!: number;

  @Column({ name: 'is_custom_voucher', type: 'boolean', nullable: false })
  IsCustomVoucher!: boolean;

  @Column({ name: 'is_reverse_txn_allow', type: 'boolean', nullable: false })
  IsReverseTxnAllow!: boolean;

  @Column({ name: 'is_editable', type: 'boolean', nullable: false })
  IsEditable!: boolean;

  @Column({ name: 'modified_on', type: 'timestamp', nullable: true })
  ModifiedOn!: string | null;

  @Column({ name: 'modified_by', type: 'integer', nullable: true })
  ModifiedBy!: number | null;

  @Column({ name: 'is_group_txn', type: 'boolean', nullable: false })
  IsGroupTxn!: boolean;

  @Column({ name: 'hospital_id', type: 'integer', nullable: false })
  HospitalId!: number;

  @Column({ name: 'voucher_serial_no', type: 'integer', nullable: false })
  VoucherSerialNo!: number;

  @Column({ name: 'is_allow_reverse_voucher', type: 'boolean', nullable: false })
  IsAllowReverseVoucher!: boolean;

  @Column({ name: 'cheque_date', type: 'timestamp', nullable: true })
  ChequeDate!: string | null;

  @Column({ name: 'status', type: 'text', nullable: true })
  Status!: string | null;

  @Column({ name: 'is_verified', type: 'boolean', nullable: false })
  IsVerified!: boolean;

  @Column({ name: 'verified_by', type: 'integer', nullable: true })
  VerifiedBy!: number | null;

  @Column({ name: 'verified_on', type: 'timestamp', nullable: true })
  VerifiedOn!: string | null;

  @Column({ name: 'verification_remarks', type: 'text', nullable: true })
  VerificationRemarks!: string | null;

  @Column({ name: 'cancelled_by', type: 'integer', nullable: true })
  CancelledBy!: number | null;

  @Column({ name: 'cancelled_on', type: 'timestamp', nullable: true })
  CancelledOn!: string | null;

  @Column({ name: 'cancelled_remarks', type: 'text', nullable: true })
  CancelledRemarks!: string | null;

  @Column({ name: 'is_voucher_reversed', type: 'boolean', nullable: false })
  IsVoucherReversed!: boolean;

}

@Entity({ name: 'acc_txn_bank_reconciliation' })
export class BankReconciliationModel {
  @PrimaryGeneratedColumn({ name: 'id' })
  Id!: number;

  @Column({ name: 'section_id', type: 'integer', nullable: false })
  SectionId!: number;

  @Column({ name: 'voucher_number', type: 'text', nullable: true })
  VoucherNumber!: string | null;

  @Column({ name: 'transaction_date', type: 'timestamp', nullable: false })
  TransactionDate!: string;

  @Column({ name: 'fiscalyear_id', type: 'integer', nullable: false })
  FiscalyearId!: number;

  @Column({ name: 'bank_transaction_date', type: 'timestamp', nullable: false })
  BankTransactionDate!: string;

  @Column({ name: 'category_id', type: 'integer', nullable: true })
  CategoryId!: number | null;

  @Column({ name: 'bank_balance', type: 'numeric', nullable: false, transformer: NUM })
  BankBalance!: number;

  @Column({ name: 'is_verified', type: 'boolean', nullable: true })
  IsVerified!: boolean | null;

  @Column({ name: 'verified_by', type: 'integer', nullable: true })
  VerifiedBy!: number | null;

  @Column({ name: 'verified_on', type: 'timestamp', nullable: true })
  VerifiedOn!: string | null;

  @Column({ name: 'remark', type: 'text', nullable: true })
  Remark!: string | null;

  @Column({ name: 'transaction_id', type: 'integer', nullable: false })
  TransactionId!: number;

  @Column({ name: 'ledger_id', type: 'integer', nullable: false })
  LedgerId!: number;

  @Column({ name: 'hospital_id', type: 'integer', nullable: false })
  HospitalId!: number;

  @Column({ name: 'created_on', type: 'timestamp', nullable: false })
  CreatedOn!: string;

  @Column({ name: 'created_by', type: 'integer', nullable: false })
  CreatedBy!: number;

  @Column({ name: 'dr_cr', type: 'boolean', nullable: true })
  DrCr!: boolean | null;

  @Column({ name: 'bank_ref_number', type: 'text', nullable: true })
  BankRefNumber!: string | null;

  @Column({ name: 'voucher_type_id', type: 'integer', nullable: false })
  VoucherTypeId!: number;

  @Column({ name: 'party_ledger_id', type: 'integer', nullable: false })
  PartyLedgerId!: number;

  @Column({ name: 'party_sub_ledger_id', type: 'integer', nullable: false })
  PartySubLedgerId!: number;

}

@Entity({ name: 'acc_txn_link' })
export class TransactionLinkModel {
  @PrimaryGeneratedColumn({ name: 'accounting_txn_link_id' })
  AccountingTxnLinkId!: number;

  @Column({ name: 'transaction_id', type: 'integer', nullable: false })
  TransactionId!: number;

  @Column({ name: 'reference_id', type: 'text', nullable: true })
  ReferenceId!: string | null;

  @Column({ name: 'reference_id_one', type: 'text', nullable: true })
  ReferenceIdOne!: string | null;

  @Column({ name: 'transaction_item_id', type: 'integer', nullable: false })
  TransactionItemId!: number;

}

@Entity({ name: 'acc_txn_payment' })
export class AccountingPaymentModel {
  @PrimaryGeneratedColumn({ name: 'payment_id' })
  PaymentId!: number;

  @Column({ name: 'transaction_id', type: 'integer', nullable: false })
  TransactionId!: number;

  @Column({ name: 'voucher_number', type: 'text', nullable: true })
  VoucherNumber!: string | null;

  @Column({ name: 'payment_date', type: 'timestamp', nullable: false })
  PaymentDate!: string;

  @Column({ name: 'receiver_ledger_id', type: 'integer', nullable: false })
  ReceiverLedgerId!: number;

  @Column({ name: 'good_receipt_id', type: 'integer', nullable: false })
  GoodReceiptID!: number;

  @Column({ name: 'total_amount', type: 'numeric', nullable: true, transformer: NUM })
  TotalAmount!: number | null;

  @Column({ name: 'paid_amount', type: 'numeric', nullable: false, transformer: NUM })
  PaidAmount!: number;

  @Column({ name: 'voucher_amount', type: 'numeric', nullable: false, transformer: NUM })
  VoucherAmount!: number;

  @Column({ name: 'remaining_amount', type: 'numeric', nullable: true, transformer: NUM })
  RemainingAmount!: number | null;

  @Column({ name: 'payment_mode', type: 'text', nullable: true })
  PaymentMode!: string | null;

  @Column({ name: 'remarks', type: 'text', nullable: true })
  Remarks!: string | null;

  @Column({ name: 'created_by', type: 'integer', nullable: false })
  CreatedBy!: number;

  @Column({ name: 'created_on', type: 'timestamp', nullable: false })
  CreatedOn!: string;

}

@Entity({ name: 'acc_txn_subledger_records' })
export class SubLedgerTransactionModel {
  @PrimaryGeneratedColumn({ name: 'sub_ledger_transaction_id' })
  SubLedgerTransactionId!: number;

  @Column({ name: 'ledger_id', type: 'integer', nullable: false })
  LedgerId!: number;

  @Column({ name: 'transaction_item_id', type: 'integer', nullable: false })
  TransactionItemId!: number;

  @Column({ name: 'sub_ledger_id', type: 'integer', nullable: false })
  SubLedgerId!: number;

  @Column({ name: 'dr_amount', type: 'numeric', nullable: false, transformer: NUM })
  DrAmount!: number;

  @Column({ name: 'cr_amount', type: 'numeric', nullable: false, transformer: NUM })
  CrAmount!: number;

  @Column({ name: 'voucher_no', type: 'text', nullable: true })
  VoucherNo!: string | null;

  @Column({ name: 'voucher_type', type: 'integer', nullable: false })
  VoucherType!: number;

  @Column({ name: 'description', type: 'text', nullable: true })
  Description!: string | null;

  @Column({ name: 'voucher_date', type: 'timestamp', nullable: false })
  VoucherDate!: string;

  @Column({ name: 'created_on', type: 'timestamp', nullable: false })
  CreatedOn!: string;

  @Column({ name: 'created_by', type: 'integer', nullable: false })
  CreatedBy!: number;

  @Column({ name: 'is_active', type: 'boolean', nullable: false })
  IsActive!: boolean;

  @Column({ name: 'fiscal_year_id', type: 'integer', nullable: false })
  FiscalYearId!: number;

  @Column({ name: 'hospital_id', type: 'integer', nullable: false })
  HospitalId!: number;

  @Column({ name: 'cost_center_id', type: 'integer', nullable: false })
  CostCenterId!: number;

  @Column({ name: 'is_verified', type: 'boolean', nullable: false })
  IsVerified!: boolean;

}
