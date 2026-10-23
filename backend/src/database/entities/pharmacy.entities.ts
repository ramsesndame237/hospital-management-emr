/* GÉNÉRÉ par tools/generate-entities.mjs depuis migration/inventory/entities.json : ne pas modifier à la main. */
import { Column, Entity, PrimaryColumn, PrimaryGeneratedColumn } from 'typeorm';
import { NUM } from '../transformers';

@Entity({ name: 'phrm_bil_transaction' })
export class PHRMBillTransactionModel {
  @PrimaryGeneratedColumn({ name: 'bil_transaction_id' })
  BilTransactionId!: number;

  @Column({ name: 'patient_id', type: 'integer', nullable: false })
  PatientId!: number;

  @Column({ name: 'counter_id', type: 'integer', nullable: false })
  CounterId!: number;

  @Column({ name: 'paid_date', type: 'timestamp', nullable: false })
  PaidDate!: string;

  @Column({ name: 'transaction_type', type: 'text', nullable: true })
  TransactionType!: string | null;

  @Column({ name: 'total_quantity', type: 'double precision', nullable: false })
  TotalQuantity!: number;

  @Column({ name: 'sub_total', type: 'numeric', nullable: false, transformer: NUM })
  SubTotal!: number;

  @Column({ name: 'discount_percentage', type: 'real', nullable: false })
  DiscountPercentage!: number;

  @Column({ name: 'discount_amount', type: 'numeric', nullable: false, transformer: NUM })
  DiscountAmount!: number;

  @Column({ name: 'vat_percentage', type: 'real', nullable: false })
  VATPercentage!: number;

  @Column({ name: 'vat_amount', type: 'numeric', nullable: false, transformer: NUM })
  VATAmount!: number;

  @Column({ name: 'total_amount', type: 'numeric', nullable: false, transformer: NUM })
  TotalAmount!: number;

  @Column({ name: 'paid_amount', type: 'numeric', nullable: false, transformer: NUM })
  PaidAmount!: number;

  @Column({ name: 'amount_from_deposit', type: 'numeric', nullable: false, transformer: NUM })
  AmountFromDeposit!: number;

  @Column({ name: 'credit_amount', type: 'numeric', nullable: false, transformer: NUM })
  CreditAmount!: number;

  @Column({ name: 'bil_status', type: 'text', nullable: true })
  BilStatus!: string | null;

  @Column({ name: 'print_count', type: 'integer', nullable: false })
  PrintCount!: number;

  @Column({ name: 'created_by', type: 'integer', nullable: false })
  CreatedBy!: number;

  @Column({ name: 'created_on', type: 'timestamp', nullable: true })
  CreatedOn!: string | null;

}

@Entity({ name: 'phrm_bil_transaction_item' })
export class PHRMBillTransactionItem {
  @PrimaryGeneratedColumn({ name: 'bil_transaction_item_id' })
  BilTransactionItemId!: number;

  @Column({ name: 'bil_transaction_id', type: 'integer', nullable: true })
  BilTransactionId!: number | null;

  @Column({ name: 'item_id', type: 'integer', nullable: true })
  ItemId!: number | null;

  @Column({ name: 'item_name', type: 'text', nullable: true })
  ItemName!: string | null;

  @Column({ name: 'batch_no', type: 'text', nullable: true })
  BatchNo!: string | null;

  @Column({ name: 'patient_id', type: 'integer', nullable: false })
  PatientId!: number;

  @Column({ name: 'counter_id', type: 'integer', nullable: false })
  CounterId!: number;

  @Column({ name: 'item_price', type: 'numeric', nullable: false, transformer: NUM })
  ItemPrice!: number;

  @Column({ name: 'selling_price', type: 'numeric', nullable: false, transformer: NUM })
  SellingPrice!: number;

  @Column({ name: 'quantity', type: 'double precision', nullable: false })
  Quantity!: number;

  @Column({ name: 'free_quantity', type: 'double precision', nullable: false })
  FreeQuantity!: number;

  @Column({ name: 'sub_total', type: 'numeric', nullable: false, transformer: NUM })
  SubTotal!: number;

  @Column({ name: 'discount_percentage', type: 'double precision', nullable: false })
  DiscountPercentage!: number;

  @Column({ name: 'discount_amount', type: 'numeric', nullable: false, transformer: NUM })
  DiscountAmount!: number;

  @Column({ name: 'vat_percentage', type: 'double precision', nullable: false })
  VATPercentage!: number;

  @Column({ name: 'vat_amount', type: 'numeric', nullable: false, transformer: NUM })
  VATAmount!: number;

  @Column({ name: 'total_amount', type: 'numeric', nullable: false, transformer: NUM })
  TotalAmount!: number;

  @Column({ name: 'paid_amount', type: 'numeric', nullable: false, transformer: NUM })
  PaidAmount!: number;

  @Column({ name: 'paid_date', type: 'timestamp', nullable: true })
  PaidDate!: string | null;

  @Column({ name: 'transaction_type', type: 'text', nullable: true })
  TransactionType!: string | null;

  @Column({ name: 'reference_id', type: 'integer', nullable: true })
  ReferenceId!: number | null;

  @Column({ name: 'bill_status', type: 'text', nullable: true })
  BillStatus!: string | null;

  @Column({ name: 'remarks', type: 'text', nullable: true })
  Remarks!: string | null;

  @Column({ name: 'created_by', type: 'integer', nullable: false })
  CreatedBy!: number;

  @Column({ name: 'created_on', type: 'timestamp', nullable: true })
  CreatedOn!: string | null;

}

@Entity({ name: 'phrm_cfg_fiscal_years' })
export class PharmacyFiscalYear {
  @PrimaryGeneratedColumn({ name: 'fiscal_year_id' })
  FiscalYearId!: number;

  @Column({ name: 'fiscal_year_name', type: 'text', nullable: true })
  FiscalYearName!: string | null;

  @Column({ name: 'start_date', type: 'timestamp', nullable: true })
  StartDate!: string | null;

  @Column({ name: 'end_date', type: 'timestamp', nullable: true })
  EndDate!: string | null;

  @Column({ name: 'created_by', type: 'integer', nullable: true })
  CreatedBy!: number | null;

  @Column({ name: 'created_on', type: 'timestamp', nullable: true })
  CreatedOn!: string | null;

  @Column({ name: 'is_active', type: 'boolean', nullable: true })
  IsActive!: boolean | null;

  @Column({ name: 'np_fiscal_year_name', type: 'text', nullable: true })
  NpFiscalYearName!: string | null;

  @Column({ name: 'is_closed', type: 'boolean', nullable: true })
  IsClosed!: boolean | null;

  @Column({ name: 'closed_on', type: 'timestamp', nullable: true })
  ClosedOn!: string | null;

  @Column({ name: 'closed_by', type: 'integer', nullable: true })
  ClosedBy!: number | null;

}

@Entity({ name: 'phrm_deposit' })
export class PHRMDepositModel {
  @PrimaryGeneratedColumn({ name: 'deposit_id' })
  DepositId!: number;

  @Column({ name: 'store_id', type: 'integer', nullable: false })
  StoreId!: number;

  @Column({ name: 'fiscal_year_id', type: 'integer', nullable: true })
  FiscalYearId!: number | null;

  @Column({ name: 'receipt_no', type: 'integer', nullable: true })
  ReceiptNo!: number | null;

  @Column({ name: 'patient_visit_id', type: 'integer', nullable: true })
  PatientVisitId!: number | null;

  @Column({ name: 'patient_id', type: 'integer', nullable: true })
  PatientId!: number | null;

  @Column({ name: 'deposit_type', type: 'text', nullable: true })
  DepositType!: string | null;

  @Column({ name: 'deposit_amount', type: 'double precision', nullable: true })
  DepositAmount!: number | null;

  @Column({ name: 'remark', type: 'text', nullable: true })
  Remark!: string | null;

  @Column({ name: 'counter_id', type: 'integer', nullable: true })
  CounterId!: number | null;

  @Column({ name: 'print_count', type: 'integer', nullable: true })
  PrintCount!: number | null;

  @Column({ name: 'payment_mode', type: 'text', nullable: true })
  PaymentMode!: string | null;

  @Column({ name: 'payment_details', type: 'text', nullable: true })
  PaymentDetails!: string | null;

  @Column({ name: 'transaction_id', type: 'integer', nullable: true })
  TransactionId!: number | null;

  @Column({ name: 'settlement_id', type: 'integer', nullable: true })
  SettlementId!: number | null;

  @Column({ name: 'created_by', type: 'integer', nullable: true })
  CreatedBy!: number | null;

  @Column({ name: 'created_on', type: 'timestamp', nullable: true })
  CreatedOn!: string | null;

  @Column({ name: 'deposit_balance', type: 'double precision', nullable: true })
  DepositBalance!: number | null;

}

@Entity({ name: 'phrm_employee_cash_transaction' })
export class PHRMEmployeeCashTransaction {
  @PrimaryGeneratedColumn({ name: 'cash_txn_id' })
  CashTxnId!: number;

  @Column({ name: 'transaction_type', type: 'text', nullable: true })
  TransactionType!: string | null;

  @Column({ name: 'reference_no', type: 'integer', nullable: true })
  ReferenceNo!: number | null;

  @Column({ name: 'employee_id', type: 'integer', nullable: false })
  EmployeeId!: number;

  @Column({ name: 'in_amount', type: 'numeric', nullable: false, transformer: NUM })
  InAmount!: number;

  @Column({ name: 'out_amount', type: 'numeric', nullable: false, transformer: NUM })
  OutAmount!: number;

  @Column({ name: 'description', type: 'text', nullable: true })
  Description!: string | null;

  @Column({ name: 'transaction_date', type: 'timestamp', nullable: true })
  TransactionDate!: string | null;

  @Column({ name: 'is_active', type: 'boolean', nullable: false })
  IsActive!: boolean;

  @Column({ name: 'counter_id', type: 'integer', nullable: false })
  CounterID!: number;

  @Column({ name: 'module_name', type: 'text', nullable: true })
  ModuleName!: string | null;

  @Column({ name: 'patient_id', type: 'integer', nullable: false })
  PatientId!: number;

  @Column({ name: 'payment_mode_sub_category_id', type: 'integer', nullable: false })
  PaymentModeSubCategoryId!: number;

  @Column({ name: 'remarks', type: 'text', nullable: true })
  Remarks!: string | null;

  @Column({ name: 'fiscal_year_id', type: 'integer', nullable: false })
  FiscalYearId!: number;

  @Column({ name: 'is_transferred_to_acc', type: 'boolean', nullable: false })
  IsTransferredToAcc!: boolean;

}

@Entity({ name: 'phrm_goods_receipt' })
export class PHRMGoodsReceiptModel {
  @PrimaryGeneratedColumn({ name: 'good_receipt_id' })
  GoodReceiptId!: number;

  @Column({ name: 'good_receipt_print_id', type: 'integer', nullable: true })
  GoodReceiptPrintId!: number | null;

  @Column({ name: 'purchase_order_id', type: 'integer', nullable: true })
  PurchaseOrderId!: number | null;

  @Column({ name: 'invoice_no', type: 'text', nullable: true })
  InvoiceNo!: string | null;

  @Column({ name: 'supplier_id', type: 'integer', nullable: false })
  SupplierId!: number;

  @Column({ name: 'good_receipt_date', type: 'timestamp', nullable: false })
  GoodReceiptDate!: string;

  @Column({ name: 'supplier_bill_date', type: 'timestamp', nullable: false })
  SupplierBillDate!: string;

  @Column({ name: 'sub_total', type: 'numeric', nullable: false, transformer: NUM })
  SubTotal!: number;

  @Column({ name: 'discount_amount', type: 'numeric', nullable: false, transformer: NUM })
  DiscountAmount!: number;

  @Column({ name: 'discount_percentage', type: 'double precision', nullable: false })
  DiscountPercentage!: number;

  @Column({ name: 'total_amount', type: 'numeric', nullable: false, transformer: NUM })
  TotalAmount!: number;

  @Column({ name: 'remarks', type: 'text', nullable: true })
  Remarks!: string | null;

  @Column({ name: 'adjustment', type: 'numeric', nullable: true, transformer: NUM })
  Adjustment!: number | null;

  @Column({ name: 'created_by', type: 'integer', nullable: false })
  CreatedBy!: number;

  @Column({ name: 'created_on', type: 'timestamp', nullable: false })
  CreatedOn!: string;

  @Column({ name: 'modified_by', type: 'integer', nullable: true })
  ModifiedBy!: number | null;

  @Column({ name: 'modified_on', type: 'timestamp', nullable: true })
  ModifiedOn!: string | null;

  @Column({ name: 'vat_amount', type: 'numeric', nullable: false, transformer: NUM })
  VATAmount!: number;

  @Column({ name: 'vat_percentage', type: 'numeric', nullable: false, transformer: NUM })
  VATPercentage!: number;

  @Column({ name: 'is_cancel', type: 'boolean', nullable: false })
  IsCancel!: boolean;

  @Column({ name: 'cancel_remarks', type: 'text', nullable: true })
  CancelRemarks!: string | null;

  @Column({ name: 'cancel_by', type: 'integer', nullable: true })
  CancelBy!: number | null;

  @Column({ name: 'cancel_on', type: 'timestamp', nullable: true })
  CancelOn!: string | null;

  @Column({ name: 'is_transferred_to_acc', type: 'boolean', nullable: false })
  IsTransferredToACC!: boolean;

  @Column({ name: 'store_id', type: 'integer', nullable: false })
  StoreId!: number;

  @Column({ name: 'transaction_type', type: 'text', nullable: true })
  TransactionType!: string | null;

  @Column({ name: 'fiscal_year_id', type: 'integer', nullable: false })
  FiscalYearId!: number;

  @Column({ name: 'is_packing', type: 'boolean', nullable: true })
  IsPacking!: boolean | null;

  @Column({ name: 'payment_status', type: 'text', nullable: true })
  PaymentStatus!: string | null;

  @Column({ name: 'is_item_discount_applicable', type: 'boolean', nullable: true })
  IsItemDiscountApplicable!: boolean | null;

  @Column({ name: 'credit_period', type: 'integer', nullable: true })
  CreditPeriod!: number | null;

  @Column({ name: 'is_payment_done_from_acc', type: 'boolean', nullable: false })
  IsPaymentDoneFromAcc!: boolean;

  @Column({ name: 'cc_amount', type: 'numeric', nullable: true, transformer: NUM })
  CCAmount!: number | null;

}

@Entity({ name: 'phrm_goods_receipt_items' })
export class PHRMGoodsReceiptItemsModel {
  @PrimaryGeneratedColumn({ name: 'good_receipt_item_id' })
  GoodReceiptItemId!: number;

  @Column({ name: 'good_receipt_id', type: 'integer', nullable: false })
  GoodReceiptId!: number;

  @Column({ name: 'stock_id', type: 'integer', nullable: false })
  StockId!: number;

  @Column({ name: 'store_stock_id', type: 'integer', nullable: false })
  StoreStockId!: number;

  @Column({ name: 'item_id', type: 'integer', nullable: false })
  ItemId!: number;

  @Column({ name: 'item_name', type: 'text', nullable: true })
  ItemName!: string | null;

  @Column({ name: 'batch_no', type: 'text', nullable: true })
  BatchNo!: string | null;

  @Column({ name: 'expiry_date', type: 'timestamp', nullable: false })
  ExpiryDate!: string;

  @Column({ name: 'received_quantity', type: 'double precision', nullable: false })
  ReceivedQuantity!: number;

  @Column({ name: 'free_quantity', type: 'double precision', nullable: false })
  FreeQuantity!: number;

  @Column({ name: 'rejected_quantity', type: 'double precision', nullable: false })
  RejectedQuantity!: number;

  @Column({ name: 'selling_price', type: 'numeric', nullable: false, transformer: NUM })
  SellingPrice!: number;

  @Column({ name: 'gr_item_price', type: 'numeric', nullable: false, transformer: NUM })
  GRItemPrice!: number;

  @Column({ name: 'sub_total', type: 'numeric', nullable: false, transformer: NUM })
  SubTotal!: number;

  @Column({ name: 'vat_percentage', type: 'double precision', nullable: false })
  VATPercentage!: number;

  @Column({ name: 'cc_charge', type: 'double precision', nullable: false })
  CCCharge!: number;

  @Column({ name: 'discount_percentage', type: 'numeric', nullable: false, transformer: NUM })
  DiscountPercentage!: number;

  @Column({ name: 'total_amount', type: 'numeric', nullable: false, transformer: NUM })
  TotalAmount!: number;

  @Column({ name: 'created_by', type: 'integer', nullable: false })
  CreatedBy!: number;

  @Column({ name: 'created_on', type: 'timestamp', nullable: false })
  CreatedOn!: string;

  @Column({ name: 'sale_price', type: 'numeric', nullable: false, transformer: NUM })
  SalePrice!: number;

  @Column({ name: 'counter_id', type: 'integer', nullable: false })
  CounterId!: number;

  @Column({ name: 'available_quantity', type: 'double precision', nullable: false })
  AvailableQuantity!: number;

  @Column({ name: 'gr_per_item_dis_amt', type: 'numeric', nullable: false, transformer: NUM })
  GrPerItemDisAmt!: number;

  @Column({ name: 'gr_total_dis_amt', type: 'numeric', nullable: false, transformer: NUM })
  GrTotalDisAmt!: number;

  @Column({ name: 'gr_per_item_vat_amt', type: 'numeric', nullable: false, transformer: NUM })
  GrPerItemVATAmt!: number;

  @Column({ name: 'is_transferred_to_acc', type: 'boolean', nullable: false })
  IsTransferredToACC!: boolean;

  @Column({ name: 'strip_rate', type: 'numeric', nullable: true, transformer: NUM })
  StripRate!: number | null;

  @Column({ name: 'is_packing', type: 'boolean', nullable: true })
  IsPacking!: boolean | null;

  @Column({ name: 'is_item_discount_applicable', type: 'boolean', nullable: true })
  IsItemDiscountApplicable!: boolean | null;

  @Column({ name: 'packing_qty', type: 'double precision', nullable: true })
  PackingQty!: number | null;

  @Column({ name: 'strip_mrp', type: 'numeric', nullable: true, transformer: NUM })
  StripMRP!: number | null;

  @Column({ name: 'packing_type_id', type: 'integer', nullable: true })
  PackingTypeId!: number | null;

  @Column({ name: 'is_cancel', type: 'boolean', nullable: false })
  IsCancel!: boolean;

  @Column({ name: 'generic_id', type: 'integer', nullable: true })
  GenericId!: number | null;

  @Column({ name: 'cc_amount', type: 'numeric', nullable: false, transformer: NUM })
  CCAmount!: number;

  @Column({ name: 'cost_price', type: 'numeric', nullable: false, transformer: NUM })
  CostPrice!: number;

  @Column({ name: 'mrp', type: 'numeric', nullable: false, transformer: NUM })
  MRP!: number;

}

@Entity({ name: 'phrm_history_stock_batch_expiry' })
export class PHRMExpiryDateBatchNoHistoryModel {
  @PrimaryGeneratedColumn({ name: 'phrm_stock_batch_expiry_history_id' })
  PHRMStockBatchExpiryHistoryId!: number;

  @Column({ name: 'stock_id', type: 'integer', nullable: false })
  StockId!: number;

  @Column({ name: 'batch_no', type: 'text', nullable: true })
  BatchNo!: string | null;

  @Column({ name: 'expiry_date', type: 'timestamp', nullable: true })
  ExpiryDate!: string | null;

  @Column({ name: 'start_date', type: 'timestamp', nullable: true })
  StartDate!: string | null;

  @Column({ name: 'end_date', type: 'timestamp', nullable: true })
  EndDate!: string | null;

  @Column({ name: 'created_by', type: 'integer', nullable: false })
  CreatedBy!: number;

}

@Entity({ name: 'phrm_history_stock_mrp' })
export class PHRMMRPHistoryModel {
  @PrimaryGeneratedColumn({ name: 'phrm_stock_mrp_history_id' })
  PHRMStockMRPHistoryId!: number;

  @Column({ name: 'sale_price', type: 'numeric', nullable: true, transformer: NUM })
  SalePrice!: number | null;

  @Column({ name: 'created_by', type: 'integer', nullable: false })
  CreatedBy!: number;

  @Column({ name: 'start_date', type: 'timestamp', nullable: true })
  StartDate!: string | null;

  @Column({ name: 'end_date', type: 'timestamp', nullable: true })
  EndDate!: string | null;

  @Column({ name: 'stock_id', type: 'integer', nullable: false })
  StockId!: number;

}

@Entity({ name: 'phrm_map_generic_dosase_n_freq' })
export class PHRMGenericDosageNFreqMap {
  @PrimaryGeneratedColumn({ name: 'generic_dosage_map_id' })
  GenericDosageMapId!: number;

  @Column({ name: 'generic_id', type: 'integer', nullable: true })
  GenericId!: number | null;

  @Column({ name: 'generic_name', type: 'text', nullable: true })
  GenericName!: string | null;

  @Column({ name: 'dosage', type: 'text', nullable: true })
  Dosage!: string | null;

  @Column({ name: 'route', type: 'text', nullable: true })
  Route!: string | null;

  @Column({ name: 'frequency', type: 'double precision', nullable: true })
  Frequency!: number | null;

  @Column({ name: 'freq_in_words', type: 'text', nullable: true })
  FreqInWords!: string | null;

}

@Entity({ name: 'phrm_map_item_to_rack' })
export class PHRM_MAP_ItemToRack {
  @PrimaryGeneratedColumn({ name: 'mapping_id' })
  MappingId!: number;

  @Column({ name: 'store_id', type: 'integer', nullable: false })
  StoreId!: number;

  @Column({ name: 'rack_id', type: 'integer', nullable: true })
  RackId!: number | null;

  @Column({ name: 'item_id', type: 'integer', nullable: false })
  ItemId!: number;

  @Column({ name: 'is_active', type: 'boolean', nullable: false })
  IsActive!: boolean;

  @Column({ name: 'created_by', type: 'integer', nullable: true })
  CreatedBy!: number | null;

  @Column({ name: 'created_on', type: 'timestamp', nullable: true })
  CreatedOn!: string | null;

  @Column({ name: 'modified_by', type: 'integer', nullable: true })
  ModifiedBy!: number | null;

  @Column({ name: 'modified_on', type: 'timestamp', nullable: true })
  ModifiedOn!: string | null;

}

@Entity({ name: 'phrm_map_mst_item_price_category' })
export class PHRM_MAP_MstItemsPriceCategory {
  @PrimaryGeneratedColumn({ name: 'price_category_map_id' })
  PriceCategoryMapId!: number;

  @Column({ name: 'price_category_id', type: 'integer', nullable: false })
  PriceCategoryId!: number;

  @Column({ name: 'item_id', type: 'integer', nullable: false })
  ItemId!: number;

  @Column({ name: 'price', type: 'numeric', nullable: true, transformer: NUM })
  Price!: number | null;

  @Column({ name: 'discount_applicable', type: 'boolean', nullable: false })
  DiscountApplicable!: boolean;

  @Column({ name: 'item_legal_code', type: 'text', nullable: true })
  ItemLegalCode!: string | null;

  @Column({ name: 'item_legal_name', type: 'text', nullable: true })
  ItemLegalName!: string | null;

  @Column({ name: 'discount', type: 'numeric', nullable: true, transformer: NUM })
  Discount!: number | null;

  @Column({ name: 'created_on', type: 'timestamp', nullable: true })
  CreatedOn!: string | null;

  @Column({ name: 'created_by', type: 'integer', nullable: true })
  CreatedBy!: number | null;

  @Column({ name: 'modified_on', type: 'timestamp', nullable: true })
  ModifiedOn!: string | null;

  @Column({ name: 'modified_by', type: 'integer', nullable: true })
  ModifiedBy!: number | null;

  @Column({ name: 'is_active', type: 'boolean', nullable: false })
  IsActive!: boolean;

  @Column({ name: 'generic_id', type: 'integer', nullable: true })
  GenericId!: number | null;

}

@Entity({ name: 'phrm_mst_category' })
export class PHRMCategoryModel {
  @PrimaryGeneratedColumn({ name: 'category_id' })
  CategoryId!: number;

  @Column({ name: 'category_name', type: 'text', nullable: true })
  CategoryName!: string | null;

  @Column({ name: 'description', type: 'text', nullable: true })
  Description!: string | null;

  @Column({ name: 'created_by', type: 'integer', nullable: false })
  CreatedBy!: number;

  @Column({ name: 'created_on', type: 'timestamp', nullable: false })
  CreatedOn!: string;

  @Column({ name: 'is_active', type: 'boolean', nullable: false })
  IsActive!: boolean;

}

@Entity({ name: 'phrm_mst_company' })
export class PHRMCompanyModel {
  @PrimaryGeneratedColumn({ name: 'company_id' })
  CompanyId!: number;

  @Column({ name: 'company_name', type: 'text', nullable: true })
  CompanyName!: string | null;

  @Column({ name: 'contact_no', type: 'text', nullable: true })
  ContactNo!: string | null;

  @Column({ name: 'description', type: 'text', nullable: true })
  Description!: string | null;

  @Column({ name: 'contact_address', type: 'text', nullable: true })
  ContactAddress!: string | null;

  @Column({ name: 'email', type: 'text', nullable: true })
  Email!: string | null;

  @Column({ name: 'created_by', type: 'integer', nullable: false })
  CreatedBy!: number;

  @Column({ name: 'created_on', type: 'timestamp', nullable: false })
  CreatedOn!: string;

  @Column({ name: 'is_active', type: 'boolean', nullable: false })
  IsActive!: boolean;

}

@Entity({ name: 'phrm_mst_counter' })
export class PHRMCounter {
  @PrimaryGeneratedColumn({ name: 'counter_id' })
  CounterId!: number;

  @Column({ name: 'counter_name', type: 'text', nullable: true })
  CounterName!: string | null;

  @Column({ name: 'counter_type', type: 'text', nullable: true })
  CounterType!: string | null;

  @Column({ name: 'beginning_date', type: 'timestamp', nullable: true })
  BeginningDate!: string | null;

  @Column({ name: 'closing_date', type: 'timestamp', nullable: true })
  ClosingDate!: string | null;

  @Column({ name: 'created_by', type: 'integer', nullable: false })
  CreatedBy!: number;

  @Column({ name: 'created_on', type: 'timestamp', nullable: false })
  CreatedOn!: string;

}

@Entity({ name: 'phrm_mst_credit_organization' })
export class PHRMCreditOrganizationsModel {
  @PrimaryGeneratedColumn({ name: 'organization_id' })
  OrganizationId!: number;

  @Column({ name: 'organization_name', type: 'text', nullable: true })
  OrganizationName!: string | null;

  @Column({ name: 'is_active', type: 'boolean', nullable: true })
  IsActive!: boolean | null;

  @Column({ name: 'created_on', type: 'timestamp', nullable: false })
  CreatedOn!: string;

  @Column({ name: 'created_by', type: 'integer', nullable: false })
  CreatedBy!: number;

  @Column({ name: 'modified_on', type: 'timestamp', nullable: true })
  ModifiedOn!: string | null;

  @Column({ name: 'modified_by', type: 'integer', nullable: true })
  ModifiedBy!: number | null;

  @Column({ name: 'is_default', type: 'boolean', nullable: false })
  IsDefault!: boolean;

}

@Entity({ name: 'phrm_mst_generic' })
export class PHRMGenericModel {
  @PrimaryGeneratedColumn({ name: 'generic_id' })
  GenericId!: number;

  @Column({ name: 'generic_name', type: 'text', nullable: true })
  GenericName!: string | null;

  @Column({ name: 'category_id', type: 'integer', nullable: true })
  CategoryId!: number | null;

  @Column({ name: 'general_category', type: 'text', nullable: true })
  GeneralCategory!: string | null;

  @Column({ name: 'therapeutic_category', type: 'text', nullable: true })
  TherapeuticCategory!: string | null;

  @Column({ name: 'counseling', type: 'text', nullable: true })
  Counseling!: string | null;

  @Column({ name: 'created_by', type: 'integer', nullable: false })
  CreatedBy!: number;

  @Column({ name: 'created_on', type: 'timestamp', nullable: false })
  CreatedOn!: string;

  @Column({ name: 'modified_by', type: 'integer', nullable: true })
  ModifiedBy!: number | null;

  @Column({ name: 'modified_on', type: 'timestamp', nullable: true })
  ModifiedOn!: string | null;

  @Column({ name: 'is_active', type: 'boolean', nullable: false })
  IsActive!: boolean;

  @Column({ name: 'is_allergen', type: 'boolean', nullable: false })
  IsAllergen!: boolean;

}

@Entity({ name: 'phrm_mst_item' })
export class PHRMItemMasterModel {
  @PrimaryGeneratedColumn({ name: 'item_id' })
  ItemId!: number;

  @Column({ name: 'item_name', type: 'text', nullable: true })
  ItemName!: string | null;

  @Column({ name: 'item_code', type: 'text', nullable: true })
  ItemCode!: string | null;

  @Column({ name: 'company_id', type: 'integer', nullable: false })
  CompanyId!: number;

  @Column({ name: 'item_type_id', type: 'integer', nullable: false })
  ItemTypeId!: number;

  @Column({ name: 'uom_id', type: 'integer', nullable: false })
  UOMId!: number;

  @Column({ name: 're_order_quantity', type: 'double precision', nullable: false })
  ReOrderQuantity!: number;

  @Column({ name: 'min_stock_quantity', type: 'double precision', nullable: false })
  MinStockQuantity!: number;

  @Column({ name: 'budgeted_quantity', type: 'double precision', nullable: false })
  BudgetedQuantity!: number;

  @Column({ name: 'purchase_vat_percentage', type: 'double precision', nullable: false })
  PurchaseVATPercentage!: number;

  @Column({ name: 'sales_vat_percentage', type: 'double precision', nullable: false })
  SalesVATPercentage!: number;

  @Column({ name: 'is_vat_applicable', type: 'boolean', nullable: false })
  IsVATApplicable!: boolean;

  @Column({ name: 'packing_type_id', type: 'integer', nullable: true })
  PackingTypeId!: number | null;

  @Column({ name: 'is_international_brand', type: 'boolean', nullable: false })
  IsInternationalBrand!: boolean;

  @Column({ name: 'created_by', type: 'integer', nullable: false })
  CreatedBy!: number;

  @Column({ name: 'created_on', type: 'timestamp', nullable: false })
  CreatedOn!: string;

  @Column({ name: 'modified_by', type: 'integer', nullable: true })
  ModifiedBy!: number | null;

  @Column({ name: 'modified_on', type: 'timestamp', nullable: true })
  ModifiedOn!: string | null;

  @Column({ name: 'is_active', type: 'boolean', nullable: false })
  IsActive!: boolean;

  @Column({ name: 'dosage', type: 'text', nullable: true })
  Dosage!: string | null;

  @Column({ name: 'frequency', type: 'text', nullable: true })
  Frequency!: string | null;

  @Column({ name: 'duration', type: 'text', nullable: true })
  Duration!: string | null;

  @Column({ name: 'generic_id', type: 'integer', nullable: false })
  GenericId!: number;

  @Column({ name: 'abc_category', type: 'text', nullable: true })
  ABCCategory!: string | null;

  @Column({ name: 'rack', type: 'integer', nullable: true })
  Rack!: number | null;

  @Column({ name: 'store_rack_id', type: 'integer', nullable: true })
  StoreRackId!: number | null;

  @Column({ name: 'sales_category_id', type: 'integer', nullable: true })
  SalesCategoryId!: number | null;

  @Column({ name: 'ved', type: 'text', nullable: true })
  VED!: string | null;

  @Column({ name: 'cc_charge', type: 'double precision', nullable: false })
  CCCharge!: number;

  @Column({ name: 'is_narcotic', type: 'boolean', nullable: false })
  IsNarcotic!: boolean;

  @Column({ name: 'is_insurance_applicable', type: 'boolean', nullable: false })
  IsInsuranceApplicable!: boolean;

  @Column({ name: 'govt_insurance_price', type: 'numeric', nullable: false, transformer: NUM })
  GovtInsurancePrice!: number;

  @Column({ name: 'purchase_rate', type: 'numeric', nullable: false, transformer: NUM })
  PurchaseRate!: number;

  @Column({ name: 'sales_rate', type: 'numeric', nullable: false, transformer: NUM })
  SalesRate!: number;

  @Column({ name: 'purchase_discount', type: 'numeric', nullable: false, transformer: NUM })
  PurchaseDiscount!: number;

}

@Entity({ name: 'phrm_mst_item_type' })
export class PHRMItemTypeModel {
  @PrimaryGeneratedColumn({ name: 'item_type_id' })
  ItemTypeId!: number;

  @Column({ name: 'category_id', type: 'integer', nullable: false })
  CategoryId!: number;

  @Column({ name: 'item_type_name', type: 'text', nullable: true })
  ItemTypeName!: string | null;

  @Column({ name: 'description', type: 'text', nullable: true })
  Description!: string | null;

  @Column({ name: 'created_by', type: 'integer', nullable: false })
  CreatedBy!: number;

  @Column({ name: 'created_on', type: 'timestamp', nullable: false })
  CreatedOn!: string;

  @Column({ name: 'is_active', type: 'boolean', nullable: false })
  IsActive!: boolean;

}

@Entity({ name: 'phrm_mst_packing_type' })
export class PHRMPackingTypeModel {
  @PrimaryGeneratedColumn({ name: 'packing_type_id' })
  PackingTypeId!: number;

  @Column({ name: 'packing_name', type: 'text', nullable: true })
  PackingName!: string | null;

  @Column({ name: 'packing_quantity', type: 'double precision', nullable: false })
  PackingQuantity!: number;

  @Column({ name: 'created_by', type: 'integer', nullable: false })
  CreatedBy!: number;

  @Column({ name: 'created_on', type: 'timestamp', nullable: false })
  CreatedOn!: string;

  @Column({ name: 'modified_by', type: 'integer', nullable: true })
  ModifiedBy!: number | null;

  @Column({ name: 'modified_on', type: 'timestamp', nullable: true })
  ModifiedOn!: string | null;

  @Column({ name: 'is_active', type: 'boolean', nullable: false })
  IsActive!: boolean;

}

@Entity({ name: 'phrm_mst_rack' })
export class PHRMRackModel {
  @PrimaryGeneratedColumn({ name: 'rack_id' })
  RackId!: number;

  @Column({ name: 'parent_id', type: 'integer', nullable: true })
  ParentId!: number | null;

  @Column({ name: 'store_id', type: 'integer', nullable: false })
  StoreId!: number;

  @Column({ name: 'rack_no', type: 'text', nullable: true })
  RackNo!: string | null;

  @Column({ name: 'description', type: 'text', nullable: true })
  Description!: string | null;

  @Column({ name: 'created_by', type: 'integer', nullable: false })
  CreatedBy!: number;

  @Column({ name: 'created_on', type: 'timestamp', nullable: false })
  CreatedOn!: string;

}

@Entity({ name: 'phrm_mst_sales_category' })
export class PHRMStoreSalesCategoryModel {
  @PrimaryGeneratedColumn({ name: 'sales_category_id' })
  SalesCategoryId!: number;

  @Column({ name: 'name', type: 'text', nullable: true })
  Name!: string | null;

  @Column({ name: 'description', type: 'text', nullable: true })
  Description!: string | null;

  @Column({ name: 'created_on', type: 'timestamp', nullable: false })
  CreatedOn!: string;

  @Column({ name: 'created_by', type: 'integer', nullable: false })
  CreatedBy!: number;

  @Column({ name: 'is_batch_applicable', type: 'boolean', nullable: false })
  IsBatchApplicable!: boolean;

  @Column({ name: 'is_expiry_applicable', type: 'boolean', nullable: false })
  IsExpiryApplicable!: boolean;

  @Column({ name: 'is_active', type: 'boolean', nullable: false })
  IsActive!: boolean;

}

@Entity({ name: 'phrm_mst_store' })
export class PHRMStoreModel {
  @PrimaryGeneratedColumn({ name: 'store_id' })
  StoreId!: number;

  @Column({ name: 'category', type: 'text', nullable: true })
  Category!: string | null;

  @Column({ name: 'sub_category', type: 'text', nullable: true })
  SubCategory!: string | null;

  @Column({ name: 'parent_store_id', type: 'integer', nullable: true })
  ParentStoreId!: number | null;

  @Column({ name: 'name', type: 'text', nullable: true })
  Name!: string | null;

  @Column({ name: 'store_description', type: 'text', nullable: true })
  StoreDescription!: string | null;

  @Column({ name: 'permission_id', type: 'integer', nullable: false })
  PermissionId!: number;

  @Column({ name: 'max_verification_level', type: 'integer', nullable: false })
  MaxVerificationLevel!: number;

  @Column({ name: 'created_on', type: 'timestamp', nullable: false })
  CreatedOn!: string;

  @Column({ name: 'created_by', type: 'integer', nullable: false })
  CreatedBy!: number;

  @Column({ name: 'modified_on', type: 'timestamp', nullable: true })
  ModifiedOn!: string | null;

  @Column({ name: 'modified_by', type: 'integer', nullable: true })
  ModifiedBy!: number | null;

  @Column({ name: 'is_active', type: 'boolean', nullable: false })
  IsActive!: boolean;

  @Column({ name: 'store_label', type: 'text', nullable: true })
  StoreLabel!: string | null;

  @Column({ name: 'pan_no', type: 'text', nullable: true })
  PanNo!: string | null;

  @Column({ name: 'code', type: 'text', nullable: true })
  Code!: string | null;

  @Column({ name: 'address', type: 'text', nullable: true })
  Address!: string | null;

  @Column({ name: 'contact_no', type: 'text', nullable: true })
  ContactNo!: string | null;

  @Column({ name: 'email', type: 'text', nullable: true })
  Email!: string | null;

  @Column({ name: 'use_separate_invoice_header', type: 'boolean', nullable: false })
  UseSeparateInvoiceHeader!: boolean;

  @Column({ name: 'print_invoice_header_in_dot_matrix', type: 'boolean', nullable: false })
  PrintInvoiceHeaderInDotMatrix!: boolean;

  @Column({ name: 'default_payment_mode', type: 'text', nullable: true })
  DefaultPaymentMode!: string | null;

  @Column({ name: 'inv_po_group_id', type: 'integer', nullable: true })
  INV_POGroupId!: number | null;

  @Column({ name: 'inv_pr_group_id', type: 'integer', nullable: true })
  INV_PRGroupId!: number | null;

  @Column({ name: 'inv_req_dis_group_id', type: 'integer', nullable: true })
  INV_ReqDisGroupId!: number | null;

  @Column({ name: 'inv_rfq_group_id', type: 'integer', nullable: true })
  INV_RFQGroupId!: number | null;

  @Column({ name: 'inv_receipt_display_name', type: 'text', nullable: true })
  INV_ReceiptDisplayName!: string | null;

  @Column({ name: 'inv_receipt_no_code', type: 'text', nullable: true })
  INV_ReceiptNoCode!: string | null;

}

@Entity({ name: 'phrm_mst_supplier' })
export class PHRMSupplierModel {
  @PrimaryGeneratedColumn({ name: 'supplier_id' })
  SupplierId!: number;

  @Column({ name: 'supplier_name', type: 'text', nullable: true })
  SupplierName!: string | null;

  @Column({ name: 'contact_no', type: 'text', nullable: true })
  ContactNo!: string | null;

  @Column({ name: 'description', type: 'text', nullable: true })
  Description!: string | null;

  @Column({ name: 'city', type: 'text', nullable: true })
  City!: string | null;

  @Column({ name: 'pan_number', type: 'text', nullable: true })
  PANNumber!: string | null;

  @Column({ name: 'dda', type: 'text', nullable: true })
  DDA!: string | null;

  @Column({ name: 'contact_address', type: 'text', nullable: true })
  ContactAddress!: string | null;

  @Column({ name: 'additional_contact_information', type: 'text', nullable: true })
  AdditionalContactInformation!: string | null;

  @Column({ name: 'email', type: 'text', nullable: true })
  Email!: string | null;

  @Column({ name: 'created_by', type: 'integer', nullable: false })
  CreatedBy!: number;

  @Column({ name: 'created_on', type: 'timestamp', nullable: false })
  CreatedOn!: string;

  @Column({ name: 'is_active', type: 'boolean', nullable: false })
  IsActive!: boolean;

  @Column({ name: 'credit_period', type: 'integer', nullable: false })
  CreditPeriod!: number;

  @Column({ name: 'is_ledger_required', type: 'boolean', nullable: false })
  IsLedgerRequired!: boolean;

}

@Entity({ name: 'phrm_mst_tax' })
export class PHRMTAXModel {
  @PrimaryGeneratedColumn({ name: 'tax_id' })
  TAXId!: number;

  @Column({ name: 'tax_name', type: 'text', nullable: true })
  TAXName!: string | null;

  @Column({ name: 'tax_percentage', type: 'double precision', nullable: false })
  TAXPercentage!: number;

  @Column({ name: 'description', type: 'text', nullable: true })
  Description!: string | null;

  @Column({ name: 'created_by', type: 'integer', nullable: false })
  CreatedBy!: number;

  @Column({ name: 'created_on', type: 'timestamp', nullable: false })
  CreatedOn!: string;

}

@Entity({ name: 'phrm_mst_unit_of_measurement' })
export class PHRMUnitOfMeasurementModel {
  @PrimaryGeneratedColumn({ name: 'uom_id' })
  UOMId!: number;

  @Column({ name: 'uom_name', type: 'text', nullable: true })
  UOMName!: string | null;

  @Column({ name: 'description', type: 'text', nullable: true })
  Description!: string | null;

  @Column({ name: 'created_by', type: 'integer', nullable: false })
  CreatedBy!: number;

  @Column({ name: 'created_on', type: 'timestamp', nullable: false })
  CreatedOn!: string;

  @Column({ name: 'is_active', type: 'boolean', nullable: false })
  IsActive!: boolean;

}

@Entity({ name: 'phrm_narcotic_sale_record' })
export class PHRMNarcoticRecord {
  @PrimaryGeneratedColumn({ name: 'narcotic_record_id' })
  NarcoticRecordId!: number;

  @Column({ name: 'buyer_name', type: 'text', nullable: true })
  BuyerName!: string | null;

  @Column({ name: 'employe_id', type: 'integer', nullable: true })
  EmployeId!: number | null;

  @Column({ name: 'item_id', type: 'integer', nullable: true })
  ItemId!: number | null;

  @Column({ name: 'quantity', type: 'integer', nullable: true })
  Quantity!: number | null;

  @Column({ name: 'doctor_name', type: 'text', nullable: true })
  DoctorName!: string | null;

  @Column({ name: 'nmc_number', type: 'text', nullable: true })
  NMCNumber!: string | null;

  @Column({ name: 'invoice_id', type: 'integer', nullable: true })
  InvoiceId!: number | null;

  @Column({ name: 'invoice_item_id', type: 'integer', nullable: true })
  InvoiceItemId!: number | null;

  @Column({ name: 'batch', type: 'text', nullable: true })
  Batch!: string | null;

  @Column({ name: 'refill', type: 'text', nullable: true })
  Refill!: string | null;

  @Column({ name: 'img_url', type: 'text', nullable: true })
  ImgUrl!: string | null;

  @Column({ name: 'created_by', type: 'integer', nullable: false })
  CreatedBy!: number;

  @Column({ name: 'created_on', type: 'timestamp', nullable: false })
  CreatedOn!: string;

}

@Entity({ name: 'phrm_prescription' })
export class PHRMPrescriptionModel {
  @PrimaryGeneratedColumn({ name: 'prescription_id' })
  PrescriptionId!: number;

  @Column({ name: 'patient_id', type: 'integer', nullable: false })
  PatientId!: number;

  @Column({ name: 'prescriber_id', type: 'integer', nullable: true })
  PrescriberId!: number | null;

  @Column({ name: 'notes', type: 'text', nullable: true })
  Notes!: string | null;

  @Column({ name: 'created_by', type: 'integer', nullable: true })
  CreatedBy!: number | null;

  @Column({ name: 'created_on', type: 'timestamp', nullable: true })
  CreatedOn!: string | null;

  @Column({ name: 'prescriber_name', type: 'text', nullable: true })
  PrescriberName!: string | null;

  @Column({ name: 'is_in_patient', type: 'boolean', nullable: true })
  IsInPatient!: boolean | null;

  @Column({ name: 'prescription_status', type: 'text', nullable: true })
  PrescriptionStatus!: string | null;

}

@Entity({ name: 'phrm_prescription_items' })
export class PHRMPrescriptionItemModel {
  @PrimaryGeneratedColumn({ name: 'prescription_item_id' })
  PrescriptionItemId!: number;

  @Column({ name: 'prescription_id', type: 'integer', nullable: false })
  PrescriptionId!: number;

  @Column({ name: 'patient_id', type: 'integer', nullable: false })
  PatientId!: number;

  @Column({ name: 'prescriber_id', type: 'integer', nullable: true })
  PrescriberId!: number | null;

  @Column({ name: 'item_id', type: 'integer', nullable: true })
  ItemId!: number | null;

  @Column({ name: 'quantity', type: 'double precision', nullable: true })
  Quantity!: number | null;

  @Column({ name: 'frequency', type: 'integer', nullable: true })
  Frequency!: number | null;

  @Column({ name: 'starting_date', type: 'timestamp', nullable: true })
  StartingDate!: string | null;

  @Column({ name: 'how_many_days', type: 'integer', nullable: true })
  HowManyDays!: number | null;

  @Column({ name: 'notes', type: 'text', nullable: true })
  Notes!: string | null;

  @Column({ name: 'created_by', type: 'integer', nullable: true })
  CreatedBy!: number | null;

  @Column({ name: 'created_on', type: 'timestamp', nullable: true })
  CreatedOn!: string | null;

  @Column({ name: 'order_status', type: 'text', nullable: true })
  OrderStatus!: string | null;

  @Column({ name: 'dosage', type: 'text', nullable: true })
  Dosage!: string | null;

  @Column({ name: 'generic_id', type: 'integer', nullable: true })
  GenericId!: number | null;

  @Column({ name: 'modified_by', type: 'integer', nullable: true })
  ModifiedBy!: number | null;

  @Column({ name: 'modified_on', type: 'timestamp', nullable: true })
  ModifiedOn!: string | null;

  @Column({ name: 'diagnosis_id', type: 'integer', nullable: true })
  DiagnosisId!: number | null;

}

@Entity({ name: 'phrm_purchase_order' })
export class PHRMPurchaseOrderModel {
  @PrimaryGeneratedColumn({ name: 'purchase_order_id' })
  PurchaseOrderId!: number;

  @Column({ name: 'supplier_id', type: 'integer', nullable: false })
  SupplierId!: number;

  @Column({ name: 'fiscal_year_id', type: 'integer', nullable: false })
  FiscalYearId!: number;

  @Column({ name: 'purchase_order_no', type: 'integer', nullable: true })
  PurchaseOrderNo!: number | null;

  @Column({ name: 'reference_no', type: 'text', nullable: true })
  ReferenceNo!: string | null;

  @Column({ name: 'po_date', type: 'timestamp', nullable: true })
  PODate!: string | null;

  @Column({ name: 'po_status', type: 'text', nullable: true })
  POStatus!: string | null;

  @Column({ name: 'sub_total', type: 'numeric', nullable: false, transformer: NUM })
  SubTotal!: number;

  @Column({ name: 'cc_charge_amount', type: 'numeric', nullable: false, transformer: NUM })
  CCChargeAmount!: number;

  @Column({ name: 'discount_amount', type: 'numeric', nullable: false, transformer: NUM })
  DiscountAmount!: number;

  @Column({ name: 'vat_amount', type: 'numeric', nullable: false, transformer: NUM })
  VATAmount!: number;

  @Column({ name: 'total_amount', type: 'numeric', nullable: false, transformer: NUM })
  TotalAmount!: number;

  @Column({ name: 'delivery_address', type: 'text', nullable: true })
  DeliveryAddress!: string | null;

  @Column({ name: 'invoicing_address', type: 'text', nullable: true })
  InvoicingAddress!: string | null;

  @Column({ name: 'contact', type: 'text', nullable: true })
  Contact!: string | null;

  @Column({ name: 'delivery_days', type: 'integer', nullable: false })
  DeliveryDays!: number;

  @Column({ name: 'delivery_date', type: 'timestamp', nullable: true })
  DeliveryDate!: string | null;

  @Column({ name: 'remarks', type: 'text', nullable: true })
  Remarks!: string | null;

  @Column({ name: 'created_by', type: 'integer', nullable: true })
  CreatedBy!: number | null;

  @Column({ name: 'created_on', type: 'timestamp', nullable: true })
  CreatedOn!: string | null;

  @Column({ name: 'modified_on', type: 'timestamp', nullable: true })
  ModifiedOn!: string | null;

  @Column({ name: 'modified_by', type: 'integer', nullable: true })
  ModifiedBy!: number | null;

  @Column({ name: 'terms_id', type: 'integer', nullable: true })
  TermsId!: number | null;

  @Column({ name: 'terms_conditions', type: 'text', nullable: true })
  TermsConditions!: string | null;

  @Column({ name: 'discount_percentage', type: 'numeric', nullable: true, transformer: NUM })
  DiscountPercentage!: number | null;

  @Column({ name: 'taxable_amount', type: 'numeric', nullable: true, transformer: NUM })
  TaxableAmount!: number | null;

  @Column({ name: 'non_taxable_amount', type: 'numeric', nullable: true, transformer: NUM })
  NonTaxableAmount!: number | null;

  @Column({ name: 'adjustment', type: 'numeric', nullable: true, transformer: NUM })
  Adjustment!: number | null;

  @Column({ name: 'verification_id', type: 'integer', nullable: true })
  VerificationId!: number | null;

  @Column({ name: 'verifier_ids', type: 'text', nullable: true })
  VerifierIds!: string | null;

  @Column({ name: 'is_verification_enabled', type: 'boolean', nullable: false })
  IsVerificationEnabled!: boolean;

  @Column({ name: 'cancelled_by', type: 'integer', nullable: true })
  CancelledBy!: number | null;

  @Column({ name: 'cancelled_on', type: 'timestamp', nullable: true })
  CancelledOn!: string | null;

  @Column({ name: 'cancel_remarks', type: 'text', nullable: true })
  CancelRemarks!: string | null;

}

@Entity({ name: 'phrm_purchase_order_items' })
export class PHRMPurchaseOrderItemsModel {
  @PrimaryGeneratedColumn({ name: 'purchase_order_item_id' })
  PurchaseOrderItemId!: number;

  @Column({ name: 'item_id', type: 'integer', nullable: false })
  ItemId!: number;

  @Column({ name: 'purchase_order_id', type: 'integer', nullable: false })
  PurchaseOrderId!: number;

  @Column({ name: 'quantity', type: 'double precision', nullable: false })
  Quantity!: number;

  @Column({ name: 'standard_rate', type: 'numeric', nullable: false, transformer: NUM })
  StandardRate!: number;

  @Column({ name: 'received_quantity', type: 'double precision', nullable: false })
  ReceivedQuantity!: number;

  @Column({ name: 'pending_quantity', type: 'double precision', nullable: false })
  PendingQuantity!: number;

  @Column({ name: 'sub_total', type: 'numeric', nullable: false, transformer: NUM })
  SubTotal!: number;

  @Column({ name: 'discount_percentage', type: 'numeric', nullable: false, transformer: NUM })
  DiscountPercentage!: number;

  @Column({ name: 'discount_amount', type: 'numeric', nullable: false, transformer: NUM })
  DiscountAmount!: number;

  @Column({ name: 'vat_percentage', type: 'numeric', nullable: false, transformer: NUM })
  VATPercentage!: number;

  @Column({ name: 'vat_amount', type: 'numeric', nullable: false, transformer: NUM })
  VATAmount!: number;

  @Column({ name: 'cc_charge_percentage', type: 'numeric', nullable: false, transformer: NUM })
  CCChargePercentage!: number;

  @Column({ name: 'cc_charge_amount', type: 'numeric', nullable: false, transformer: NUM })
  CCChargeAmount!: number;

  @Column({ name: 'total_amount', type: 'numeric', nullable: false, transformer: NUM })
  TotalAmount!: number;

  @Column({ name: 'authorized_remark', type: 'text', nullable: true })
  AuthorizedRemark!: string | null;

  @Column({ name: 'remarks', type: 'text', nullable: true })
  Remarks!: string | null;

  @Column({ name: 'po_item_status', type: 'text', nullable: true })
  POItemStatus!: string | null;

  @Column({ name: 'authorized_by', type: 'integer', nullable: true })
  AuthorizedBy!: number | null;

  @Column({ name: 'authorized_on', type: 'timestamp', nullable: true })
  AuthorizedOn!: string | null;

  @Column({ name: 'created_by', type: 'integer', nullable: true })
  CreatedBy!: number | null;

  @Column({ name: 'created_on', type: 'timestamp', nullable: true })
  CreatedOn!: string | null;

  @Column({ name: 'is_cancel', type: 'boolean', nullable: true })
  IsCancel!: boolean | null;

  @Column({ name: 'modified_by', type: 'integer', nullable: true })
  ModifiedBy!: number | null;

  @Column({ name: 'modified_on', type: 'timestamp', nullable: true })
  ModifiedOn!: string | null;

  @Column({ name: 'generic_id', type: 'integer', nullable: false })
  GenericId!: number;

  @Column({ name: 'free_quantity', type: 'numeric', nullable: false, transformer: NUM })
  FreeQuantity!: number;

  @Column({ name: 'pending_free_quantity', type: 'numeric', nullable: false, transformer: NUM })
  PendingFreeQuantity!: number;

  @Column({ name: 'cancelled_by', type: 'integer', nullable: true })
  CancelledBy!: number | null;

  @Column({ name: 'cancelled_on', type: 'timestamp', nullable: true })
  CancelledOn!: string | null;

  @Column({ name: 'cancel_remarks', type: 'text', nullable: true })
  CancelRemarks!: string | null;

}

@Entity({ name: 'phrm_requisition' })
export class PHRMDrugsRequistionModel {
  @PrimaryGeneratedColumn({ name: 'requisition_id' })
  RequisitionId!: number;

  @Column({ name: 'visit_id', type: 'integer', nullable: false })
  VisitId!: number;

  @Column({ name: 'patient_id', type: 'integer', nullable: false })
  PatientId!: number;

  @Column({ name: 'status', type: 'text', nullable: true })
  Status!: string | null;

  @Column({ name: 'reference_id', type: 'text', nullable: true })
  ReferenceId!: string | null;

  @Column({ name: 'created_by', type: 'integer', nullable: false })
  CreatedBy!: number;

  @Column({ name: 'created_on', type: 'timestamp', nullable: false })
  CreatedOn!: string;

}

@Entity({ name: 'phrm_requisition_items' })
export class PHRMDrugsRequistionItemsModel {
  @PrimaryGeneratedColumn({ name: 'requisition_item_id' })
  RequisitionItemId!: number;

  @Column({ name: 'requisition_id', type: 'integer', nullable: false })
  RequisitionId!: number;

  @Column({ name: 'item_id', type: 'integer', nullable: false })
  ItemId!: number;

  @Column({ name: 'quantity', type: 'integer', nullable: false })
  Quantity!: number;

}

@Entity({ name: 'phrm_return_to_supplier' })
export class PHRMReturnToSupplierModel {
  @PrimaryGeneratedColumn({ name: 'return_to_supplier_id' })
  ReturnToSupplierId!: number;

  @Column({ name: 'credit_note_id', type: 'text', nullable: true })
  CreditNoteId!: string | null;

  @Column({ name: 'credit_note_print_id', type: 'integer', nullable: true })
  CreditNotePrintId!: number | null;

  @Column({ name: 'supplier_id', type: 'integer', nullable: true })
  SupplierId!: number | null;

  @Column({ name: 'good_receipt_id', type: 'integer', nullable: true })
  GoodReceiptId!: number | null;

  @Column({ name: 'return_status', type: 'integer', nullable: true })
  ReturnStatus!: number | null;

  @Column({ name: 'return_date', type: 'timestamp', nullable: false })
  ReturnDate!: string;

  @Column({ name: 'sub_total', type: 'numeric', nullable: false, transformer: NUM })
  SubTotal!: number;

  @Column({ name: 'vat_amount', type: 'numeric', nullable: false, transformer: NUM })
  VATAmount!: number;

  @Column({ name: 'discount_amount', type: 'numeric', nullable: false, transformer: NUM })
  DiscountAmount!: number;

  @Column({ name: 'total_amount', type: 'numeric', nullable: false, transformer: NUM })
  TotalAmount!: number;

  @Column({ name: 'created_by', type: 'integer', nullable: false })
  CreatedBy!: number;

  @Column({ name: 'created_on', type: 'timestamp', nullable: true })
  CreatedOn!: string | null;

  @Column({ name: 'remarks', type: 'text', nullable: true })
  Remarks!: string | null;

  @Column({ name: 'is_transferred_to_acc', type: 'boolean', nullable: true })
  IsTransferredToACC!: boolean | null;

  @Column({ name: 'cc_amount', type: 'numeric', nullable: false, transformer: NUM })
  CCAmount!: number;

}

@Entity({ name: 'phrm_return_to_supplier_items' })
export class PHRMReturnToSupplierItemsModel {
  @PrimaryGeneratedColumn({ name: 'return_to_supplier_item_id' })
  ReturnToSupplierItemId!: number;

  @Column({ name: 'return_to_supplier_id', type: 'integer', nullable: false })
  ReturnToSupplierId!: number;

  @Column({ name: 'item_id', type: 'integer', nullable: false })
  ItemId!: number;

  @Column({ name: 'good_receipt_item_id', type: 'integer', nullable: false })
  GoodReceiptItemId!: number;

  @Column({ name: 'batch_no', type: 'text', nullable: true })
  BatchNo!: string | null;

  @Column({ name: 'free_quantity', type: 'double precision', nullable: true })
  FreeQuantity!: number | null;

  @Column({ name: 'free_amount', type: 'numeric', nullable: true, transformer: NUM })
  FreeAmount!: number | null;

  @Column({ name: 'free_rate', type: 'numeric', nullable: true, transformer: NUM })
  FreeRate!: number | null;

  @Column({ name: 'quantity', type: 'double precision', nullable: false })
  Quantity!: number;

  @Column({ name: 'old_item_price', type: 'numeric', nullable: false, transformer: NUM })
  OldItemPrice!: number;

  @Column({ name: 'item_price', type: 'numeric', nullable: false, transformer: NUM })
  ItemPrice!: number;

  @Column({ name: 'sub_total', type: 'numeric', nullable: false, transformer: NUM })
  SubTotal!: number;

  @Column({ name: 'discount_percentage', type: 'double precision', nullable: false })
  DiscountPercentage!: number;

  @Column({ name: 'discounted_amount', type: 'numeric', nullable: false, transformer: NUM })
  DiscountedAmount!: number;

  @Column({ name: 'vat_amount', type: 'numeric', nullable: false, transformer: NUM })
  VATAmount!: number;

  @Column({ name: 'cc_amount', type: 'numeric', nullable: false, transformer: NUM })
  CCAmount!: number;

  @Column({ name: 'return_rate', type: 'numeric', nullable: false, transformer: NUM })
  ReturnRate!: number;

  @Column({ name: 'return_cost_price', type: 'numeric', nullable: false, transformer: NUM })
  ReturnCostPrice!: number;

  @Column({ name: 'vat_percentage', type: 'double precision', nullable: false })
  VATPercentage!: number;

  @Column({ name: 'total_amount', type: 'numeric', nullable: false, transformer: NUM })
  TotalAmount!: number;

  @Column({ name: 'expiry_date', type: 'timestamp', nullable: false })
  ExpiryDate!: string;

  @Column({ name: 'return_remarks', type: 'text', nullable: true })
  ReturnRemarks!: string | null;

  @Column({ name: 'sale_price', type: 'numeric', nullable: false, transformer: NUM })
  SalePrice!: number;

  @Column({ name: 'created_by', type: 'integer', nullable: false })
  CreatedBy!: number;

  @Column({ name: 'created_on', type: 'timestamp', nullable: true })
  CreatedOn!: string | null;

}

@Entity({ name: 'phrm_store_dispatch_items' })
export class PHRMDispatchItemsModel {
  @PrimaryGeneratedColumn({ name: 'dispatch_items_id' })
  DispatchItemsId!: number;

  @Column({ name: 'dispatch_id', type: 'integer', nullable: true })
  DispatchId!: number | null;

  @Column({ name: 'source_store_id', type: 'integer', nullable: false })
  SourceStoreId!: number;

  @Column({ name: 'target_store_id', type: 'integer', nullable: false })
  TargetStoreId!: number;

  @Column({ name: 'item_id', type: 'integer', nullable: false })
  ItemId!: number;

  @Column({ name: 'requisition_id', type: 'integer', nullable: true })
  RequisitionId!: number | null;

  @Column({ name: 'requisition_item_id', type: 'integer', nullable: true })
  RequisitionItemId!: number | null;

  @Column({ name: 'batch_no', type: 'text', nullable: true })
  BatchNo!: string | null;

  @Column({ name: 'expiry_date', type: 'timestamp', nullable: true })
  ExpiryDate!: string | null;

  @Column({ name: 'cost_price', type: 'numeric', nullable: false, transformer: NUM })
  CostPrice!: number;

  @Column({ name: 'sale_price', type: 'numeric', nullable: false, transformer: NUM })
  SalePrice!: number;

  @Column({ name: 'dispatched_quantity', type: 'double precision', nullable: false })
  DispatchedQuantity!: number;

  @Column({ name: 'dispatched_date', type: 'timestamp', nullable: true })
  DispatchedDate!: string | null;

  @Column({ name: 'received_by', type: 'text', nullable: true })
  ReceivedBy!: string | null;

  @Column({ name: 'item_remarks', type: 'text', nullable: true })
  ItemRemarks!: string | null;

  @Column({ name: 'remarks', type: 'text', nullable: true })
  Remarks!: string | null;

  @Column({ name: 'received_remarks', type: 'text', nullable: true })
  ReceivedRemarks!: string | null;

  @Column({ name: 'created_by', type: 'integer', nullable: true })
  CreatedBy!: number | null;

  @Column({ name: 'created_on', type: 'timestamp', nullable: true })
  CreatedOn!: string | null;

  @Column({ name: 'received_by_id', type: 'integer', nullable: true })
  ReceivedById!: number | null;

  @Column({ name: 'received_on', type: 'timestamp', nullable: true })
  ReceivedOn!: string | null;

  @Column({ name: 'generic_id', type: 'integer', nullable: false })
  GenericId!: number;

  @Column({ name: 'pending_quantity', type: 'numeric', nullable: false, transformer: NUM })
  PendingQuantity!: number;

}

@Entity({ name: 'phrm_store_requisition' })
export class PHRMStoreRequisitionModel {
  @PrimaryGeneratedColumn({ name: 'requisition_id' })
  RequisitionId!: number;

  @Column({ name: 'fiscal_year_id', type: 'integer', nullable: false })
  FiscalYearId!: number;

  @Column({ name: 'requisition_no', type: 'integer', nullable: false })
  RequisitionNo!: number;

  @Column({ name: 'store_id', type: 'integer', nullable: false })
  StoreId!: number;

  @Column({ name: 'requisition_date', type: 'timestamp', nullable: false })
  RequisitionDate!: string;

  @Column({ name: 'requisition_status', type: 'text', nullable: true })
  RequisitionStatus!: string | null;

  @Column({ name: 'created_by', type: 'integer', nullable: false })
  CreatedBy!: number;

  @Column({ name: 'created_on', type: 'timestamp', nullable: false })
  CreatedOn!: string;

  @Column({ name: 'approved_by', type: 'integer', nullable: true })
  ApprovedBy!: number | null;

  @Column({ name: 'approved_on', type: 'timestamp', nullable: true })
  ApprovedOn!: string | null;

  @Column({ name: 'is_verification_enabled', type: 'boolean', nullable: false })
  IsVerificationEnabled!: boolean;

  @Column({ name: 'verifier_ids', type: 'text', nullable: true })
  VerifierIds!: string | null;

  @Column({ name: 'verification_id', type: 'integer', nullable: true })
  VerificationId!: number | null;

  @Column({ name: 'cancelled_by', type: 'integer', nullable: true })
  CancelledBy!: number | null;

  @Column({ name: 'cancelled_on', type: 'timestamp', nullable: true })
  CancelledOn!: string | null;

  @Column({ name: 'cancel_remarks', type: 'text', nullable: true })
  CancelRemarks!: string | null;

}

@Entity({ name: 'phrm_store_requisition_items' })
export class PHRMStoreRequisitionItemsModel {
  @PrimaryGeneratedColumn({ name: 'requisition_item_id' })
  RequisitionItemId!: number;

  @Column({ name: 'item_id', type: 'integer', nullable: false })
  ItemId!: number;

  @Column({ name: 'quantity', type: 'double precision', nullable: false })
  Quantity!: number;

  @Column({ name: 'received_quantity', type: 'double precision', nullable: false })
  ReceivedQuantity!: number;

  @Column({ name: 'pending_quantity', type: 'double precision', nullable: false })
  PendingQuantity!: number;

  @Column({ name: 'requisition_id', type: 'integer', nullable: false })
  RequisitionId!: number;

  @Column({ name: 'requisition_item_status', type: 'text', nullable: true })
  RequisitionItemStatus!: string | null;

  @Column({ name: 'remark', type: 'text', nullable: true })
  Remark!: string | null;

  @Column({ name: 'authorized_by', type: 'integer', nullable: true })
  AuthorizedBy!: number | null;

  @Column({ name: 'authorized_on', type: 'timestamp', nullable: true })
  AuthorizedOn!: string | null;

  @Column({ name: 'authorized_remark', type: 'text', nullable: true })
  AuthorizedRemark!: string | null;

  @Column({ name: 'created_by', type: 'integer', nullable: false })
  CreatedBy!: number;

  @Column({ name: 'created_on', type: 'timestamp', nullable: false })
  CreatedOn!: string;

  @Column({ name: 'cancel_quantity', type: 'double precision', nullable: false })
  CancelQuantity!: number;

  @Column({ name: 'cancelled_by', type: 'integer', nullable: true })
  CancelledBy!: number | null;

  @Column({ name: 'cancelled_on', type: 'timestamp', nullable: true })
  CancelledOn!: string | null;

  @Column({ name: 'cancel_remarks', type: 'text', nullable: true })
  CancelRemarks!: string | null;

}

@Entity({ name: 'phrm_txn_credit_bill_item_status' })
export class PHRMTransactionCreditBillItemStatusModel {
  @PrimaryGeneratedColumn({ name: 'phrm_credit_bill_item_status_id' })
  PhrmCreditBillItemStatusId!: number;

  @Column({ name: 'phrm_credit_bill_status_id', type: 'integer', nullable: false })
  PhrmCreditBillStatusId!: number;

  @Column({ name: 'invoice_id', type: 'integer', nullable: false })
  InvoiceId!: number;

  @Column({ name: 'invoice_item_id', type: 'integer', nullable: false })
  InvoiceItemId!: number;

  @Column({ name: 'item_id', type: 'integer', nullable: false })
  ItemId!: number;

  @Column({ name: 'net_total_amount', type: 'numeric', nullable: false, transformer: NUM })
  NetTotalAmount!: number;

  @Column({ name: 'is_claimable', type: 'boolean', nullable: false })
  IsClaimable!: boolean;

  @Column({ name: 'created_by', type: 'integer', nullable: false })
  CreatedBy!: number;

  @Column({ name: 'created_on', type: 'timestamp', nullable: false })
  CreatedOn!: string;

  @Column({ name: 'modified_by', type: 'integer', nullable: true })
  ModifiedBy!: number | null;

  @Column({ name: 'modified_on', type: 'timestamp', nullable: true })
  ModifiedOn!: string | null;

  @Column({ name: 'is_active', type: 'boolean', nullable: false })
  IsActive!: boolean;

}

@Entity({ name: 'phrm_txn_credit_bill_status' })
export class PHRMTransactionCreditBillStatus {
  @PrimaryGeneratedColumn({ name: 'phrm_credit_bill_status_id' })
  PhrmCreditBillStatusId!: number;

  @Column({ name: 'fiscal_year_id', type: 'integer', nullable: false })
  FiscalYearId!: number;

  @Column({ name: 'invoice_id', type: 'integer', nullable: false })
  InvoiceId!: number;

  @Column({ name: 'invoice_no_formatted', type: 'text', nullable: true })
  InvoiceNoFormatted!: string | null;

  @Column({ name: 'invoice_date', type: 'timestamp', nullable: false })
  InvoiceDate!: string;

  @Column({ name: 'patient_visit_id', type: 'integer', nullable: true })
  PatientVisitId!: number | null;

  @Column({ name: 'scheme_id', type: 'integer', nullable: false })
  SchemeId!: number;

  @Column({ name: 'liable_party', type: 'text', nullable: true })
  LiableParty!: string | null;

  @Column({ name: 'patient_id', type: 'integer', nullable: false })
  PatientId!: number;

  @Column({ name: 'credit_organization_id', type: 'integer', nullable: false })
  CreditOrganizationId!: number;

  @Column({ name: 'member_no', type: 'text', nullable: true })
  MemberNo!: string | null;

  @Column({ name: 'sales_total_bill_amount', type: 'numeric', nullable: false, transformer: NUM })
  SalesTotalBillAmount!: number;

  @Column({ name: 'return_total_bill_amount', type: 'numeric', nullable: false, transformer: NUM })
  ReturnTotalBillAmount!: number;

  @Column({ name: 'co_pay_received_amount', type: 'numeric', nullable: false, transformer: NUM })
  CoPayReceivedAmount!: number;

  @Column({ name: 'co_pay_return_amount', type: 'numeric', nullable: false, transformer: NUM })
  CoPayReturnAmount!: number;

  @Column({ name: 'net_receivable_amount', type: 'numeric', nullable: false, transformer: NUM })
  NetReceivableAmount!: number;

  @Column({ name: 'non_claimable_amount', type: 'numeric', nullable: false, transformer: NUM })
  NonClaimableAmount!: number;

  @Column({ name: 'is_claimable', type: 'boolean', nullable: false })
  IsClaimable!: boolean;

  @Column({ name: 'claim_submission_id', type: 'integer', nullable: true })
  ClaimSubmissionId!: number | null;

  @Column({ name: 'claim_code', type: 'bigint', nullable: true, transformer: NUM })
  ClaimCode!: number | null;

  @Column({ name: 'settlement_id', type: 'integer', nullable: true })
  SettlementId!: number | null;

  @Column({ name: 'settlement_status', type: 'text', nullable: true })
  SettlementStatus!: string | null;

  @Column({ name: 'is_active', type: 'boolean', nullable: false })
  IsActive!: boolean;

  @Column({ name: 'created_on', type: 'timestamp', nullable: true })
  CreatedOn!: string | null;

  @Column({ name: 'created_by', type: 'integer', nullable: false })
  CreatedBy!: number;

  @Column({ name: 'modified_on', type: 'timestamp', nullable: true })
  ModifiedOn!: string | null;

  @Column({ name: 'modified_by', type: 'integer', nullable: true })
  ModifiedBy!: number | null;

}

@Entity({ name: 'phrm_txn_invoice' })
export class PHRMInvoiceTransactionModel {
  @PrimaryGeneratedColumn({ name: 'invoice_id' })
  InvoiceId!: number;

  @Column({ name: 'store_id', type: 'integer', nullable: false })
  StoreId!: number;

  @Column({ name: 'invoice_print_id', type: 'integer', nullable: false })
  InvoicePrintId!: number;

  @Column({ name: 'patient_id', type: 'integer', nullable: false })
  PatientId!: number;

  @Column({ name: 'is_outdoor_pat', type: 'boolean', nullable: false })
  IsOutdoorPat!: boolean;

  @Column({ name: 'counter_id', type: 'integer', nullable: false })
  CounterId!: number;

  @Column({ name: 'total_quantity', type: 'double precision', nullable: true })
  TotalQuantity!: number | null;

  @Column({ name: 'sub_total', type: 'numeric', nullable: false, transformer: NUM })
  SubTotal!: number;

  @Column({ name: 'discount_amount', type: 'numeric', nullable: false, transformer: NUM })
  DiscountAmount!: number;

  @Column({ name: 'discount_per', type: 'numeric', nullable: false, transformer: NUM })
  DiscountPer!: number;

  @Column({ name: 'vat_amount', type: 'numeric', nullable: false, transformer: NUM })
  VATAmount!: number;

  @Column({ name: 'total_amount', type: 'numeric', nullable: false, transformer: NUM })
  TotalAmount!: number;

  @Column({ name: 'paid_amount', type: 'numeric', nullable: false, transformer: NUM })
  PaidAmount!: number;

  @Column({ name: 'bil_status', type: 'text', nullable: true })
  BilStatus!: string | null;

  @Column({ name: 'credit_amount', type: 'numeric', nullable: false, transformer: NUM })
  CreditAmount!: number;

  @Column({ name: 'tender', type: 'numeric', nullable: false, transformer: NUM })
  Tender!: number;

  @Column({ name: 'change', type: 'numeric', nullable: false, transformer: NUM })
  Change!: number;

  @Column({ name: 'print_count', type: 'integer', nullable: false })
  PrintCount!: number;

  @Column({ name: 'adjustment', type: 'numeric', nullable: false, transformer: NUM })
  Adjustment!: number;

  @Column({ name: 'remark', type: 'text', nullable: true })
  Remark!: string | null;

  @Column({ name: 'created_by', type: 'integer', nullable: false })
  CreatedBy!: number;

  @Column({ name: 'create_on', type: 'timestamp', nullable: false })
  CreateOn!: string;

  @Column({ name: 'is_return', type: 'boolean', nullable: false })
  IsReturn!: boolean;

  @Column({ name: 'is_realtime', type: 'boolean', nullable: false })
  IsRealtime!: boolean;

  @Column({ name: 'is_remote_synced', type: 'boolean', nullable: false })
  IsRemoteSynced!: boolean;

  @Column({ name: 'is_transferred_to_acc', type: 'boolean', nullable: false })
  IsTransferredToACC!: boolean;

  @Column({ name: 'visit_type', type: 'text', nullable: true })
  VisitType!: string | null;

  @Column({ name: 'prescriber_id', type: 'integer', nullable: true })
  PrescriberId!: number | null;

  @Column({ name: 'deposit_deduct_amount', type: 'numeric', nullable: false, transformer: NUM })
  DepositDeductAmount!: number;

  @Column({ name: 'payment_mode', type: 'text', nullable: true })
  PaymentMode!: string | null;

  @Column({ name: 'fiscal_year_id', type: 'integer', nullable: false })
  FiscalYearId!: number;

  @Column({ name: 'settlement_id', type: 'integer', nullable: true })
  SettlementId!: number | null;

  @Column({ name: 'paid_date', type: 'timestamp', nullable: true })
  PaidDate!: string | null;

  @Column({ name: 'creditdate', type: 'timestamp', nullable: true })
  Creditdate!: string | null;

  @Column({ name: 'organization_id', type: 'integer', nullable: true })
  OrganizationId!: number | null;

  @Column({ name: 'claim_code', type: 'bigint', nullable: true, transformer: NUM })
  ClaimCode!: number | null;

  @Column({ name: 'received_amount', type: 'numeric', nullable: false, transformer: NUM })
  ReceivedAmount!: number;

  @Column({ name: 'is_copayment', type: 'boolean', nullable: false })
  IsCopayment!: boolean;

  @Column({ name: 'patient_visit_id', type: 'integer', nullable: true })
  PatientVisitId!: number | null;

  @Column({ name: 'scheme_id', type: 'integer', nullable: false })
  SchemeId!: number;

}

@Entity({ name: 'phrm_txn_invoice_items' })
export class PHRMInvoiceTransactionItemsModel {
  @PrimaryGeneratedColumn({ name: 'invoice_item_id' })
  InvoiceItemId!: number;

  @Column({ name: 'invoice_id', type: 'integer', nullable: true })
  InvoiceId!: number | null;

  @Column({ name: 'store_id', type: 'integer', nullable: false })
  StoreId!: number;

  @Column({ name: 'company_id', type: 'integer', nullable: true })
  CompanyId!: number | null;

  @Column({ name: 'patient_id', type: 'integer', nullable: false })
  PatientId!: number;

  @Column({ name: 'item_id', type: 'integer', nullable: false })
  ItemId!: number;

  @Column({ name: 'item_name', type: 'text', nullable: true })
  ItemName!: string | null;

  @Column({ name: 'batch_no', type: 'text', nullable: true })
  BatchNo!: string | null;

  @Column({ name: 'quantity', type: 'double precision', nullable: false })
  Quantity!: number;

  @Column({ name: 'price', type: 'numeric', nullable: false, transformer: NUM })
  Price!: number;

  @Column({ name: 'sale_price', type: 'numeric', nullable: false, transformer: NUM })
  SalePrice!: number;

  @Column({ name: 'gr_item_price', type: 'numeric', nullable: false, transformer: NUM })
  GrItemPrice!: number;

  @Column({ name: 'free_quantity', type: 'double precision', nullable: false })
  FreeQuantity!: number;

  @Column({ name: 'sub_total', type: 'numeric', nullable: false, transformer: NUM })
  SubTotal!: number;

  @Column({ name: 'vat_percentage', type: 'numeric', nullable: false, transformer: NUM })
  VATPercentage!: number;

  @Column({ name: 'vat_amount', type: 'numeric', nullable: false, transformer: NUM })
  VATAmount!: number;

  @Column({ name: 'discount_percentage', type: 'numeric', nullable: false, transformer: NUM })
  DiscountPercentage!: number;

  @Column({ name: 'total_amount', type: 'numeric', nullable: false, transformer: NUM })
  TotalAmount!: number;

  @Column({ name: 'bil_item_status', type: 'text', nullable: true })
  BilItemStatus!: string | null;

  @Column({ name: 'remark', type: 'text', nullable: true })
  Remark!: string | null;

  @Column({ name: 'created_by', type: 'integer', nullable: false })
  CreatedBy!: number;

  @Column({ name: 'created_on', type: 'timestamp', nullable: false })
  CreatedOn!: string;

  @Column({ name: 'prescription_item_id', type: 'integer', nullable: true })
  PrescriptionItemId!: number | null;

  @Column({ name: 'counter_id', type: 'integer', nullable: false })
  CounterId!: number;

  @Column({ name: 'gr_item_id', type: 'integer', nullable: true })
  GrItemId!: number | null;

  @Column({ name: 'visit_type', type: 'text', nullable: true })
  VisitType!: string | null;

  @Column({ name: 'total_dis_amt', type: 'numeric', nullable: false, transformer: NUM })
  TotalDisAmt!: number;

  @Column({ name: 'per_item_dis_amt', type: 'numeric', nullable: false, transformer: NUM })
  PerItemDisAmt!: number;

  @Column({ name: 'expiry_date', type: 'timestamp', nullable: true })
  ExpiryDate!: string | null;

  @Column({ name: 'prescriber_id', type: 'integer', nullable: true })
  PrescriberId!: number | null;

  @Column({ name: 'price_category_id', type: 'integer', nullable: true })
  PriceCategoryId!: number | null;

  @Column({ name: 'discharge_statement_id', type: 'integer', nullable: true })
  DischargeStatementId!: number | null;

  @Column({ name: 'patient_visit_id', type: 'integer', nullable: true })
  PatientVisitId!: number | null;

  @Column({ name: 'is_co_payment', type: 'boolean', nullable: false })
  IsCoPayment!: boolean;

  @Column({ name: 'co_payment_cash_amount', type: 'numeric', nullable: false, transformer: NUM })
  CoPaymentCashAmount!: number;

  @Column({ name: 'co_payment_credit_amount', type: 'numeric', nullable: false, transformer: NUM })
  CoPaymentCreditAmount!: number;

  @Column({ name: 'scheme_id', type: 'integer', nullable: false })
  SchemeId!: number;

  @Column({ name: 'receipt_no', type: 'integer', nullable: true })
  ReceiptNo!: number | null;

  @Column({ name: 'fiscal_year_id', type: 'integer', nullable: false })
  FiscalYearId!: number;

}

@Entity({ name: 'phrm_txn_invoice_return' })
export class PHRMInvoiceReturnModel {
  @PrimaryGeneratedColumn({ name: 'invoice_return_id' })
  InvoiceReturnId!: number;

  @Column({ name: 'invoice_id', type: 'integer', nullable: true })
  InvoiceId!: number | null;

  @Column({ name: 'store_id', type: 'integer', nullable: false })
  StoreId!: number;

  @Column({ name: 'patient_id', type: 'integer', nullable: false })
  PatientId!: number;

  @Column({ name: 'counter_id', type: 'integer', nullable: false })
  CounterId!: number;

  @Column({ name: 'credit_note_id', type: 'integer', nullable: false })
  CreditNoteId!: number;

  @Column({ name: 'sub_total', type: 'numeric', nullable: false, transformer: NUM })
  SubTotal!: number;

  @Column({ name: 'discount_amount', type: 'numeric', nullable: false, transformer: NUM })
  DiscountAmount!: number;

  @Column({ name: 'vat_amount', type: 'numeric', nullable: false, transformer: NUM })
  VATAmount!: number;

  @Column({ name: 'total_amount', type: 'numeric', nullable: false, transformer: NUM })
  TotalAmount!: number;

  @Column({ name: 'paid_amount', type: 'numeric', nullable: false, transformer: NUM })
  PaidAmount!: number;

  @Column({ name: 'tender', type: 'numeric', nullable: false, transformer: NUM })
  Tender!: number;

  @Column({ name: 'change', type: 'numeric', nullable: false, transformer: NUM })
  Change!: number;

  @Column({ name: 'print_count', type: 'integer', nullable: false })
  PrintCount!: number;

  @Column({ name: 'adjustment', type: 'numeric', nullable: false, transformer: NUM })
  Adjustment!: number;

  @Column({ name: 'created_by', type: 'integer', nullable: false })
  CreatedBy!: number;

  @Column({ name: 'created_on', type: 'timestamp', nullable: false })
  CreatedOn!: string;

  @Column({ name: 'is_realtime', type: 'boolean', nullable: false })
  IsRealtime!: boolean;

  @Column({ name: 'is_remote_synced', type: 'boolean', nullable: false })
  IsRemoteSynced!: boolean;

  @Column({ name: 'is_transferred_to_acc', type: 'boolean', nullable: false })
  IsTransferredToACC!: boolean;

  @Column({ name: 'payment_mode', type: 'text', nullable: true })
  PaymentMode!: string | null;

  @Column({ name: 'fiscal_year_id', type: 'integer', nullable: false })
  FiscalYearId!: number;

  @Column({ name: 'remarks', type: 'text', nullable: true })
  Remarks!: string | null;

  @Column({ name: 'claim_code', type: 'bigint', nullable: true, transformer: NUM })
  ClaimCode!: number | null;

  @Column({ name: 'is_manual_return', type: 'boolean', nullable: false })
  IsManualReturn!: boolean;

  @Column({ name: 'reference_invoice_no', type: 'text', nullable: true })
  ReferenceInvoiceNo!: string | null;

  @Column({ name: 'reference_invoice_date', type: 'timestamp', nullable: true })
  ReferenceInvoiceDate!: string | null;

  @Column({ name: 'settlement_id', type: 'integer', nullable: true })
  SettlementId!: number | null;

  @Column({ name: 'organization_id', type: 'integer', nullable: true })
  OrganizationId!: number | null;

  @Column({ name: 'return_cash_amount', type: 'numeric', nullable: false, transformer: NUM })
  ReturnCashAmount!: number;

  @Column({ name: 'return_credit_amount', type: 'numeric', nullable: false, transformer: NUM })
  ReturnCreditAmount!: number;

  @Column({ name: 'is_co_payment', type: 'boolean', nullable: false })
  IsCoPayment!: boolean;

  @Column({ name: 'visit_type', type: 'text', nullable: true })
  VisitType!: string | null;

}

@Entity({ name: 'phrm_txn_invoice_return_items' })
export class PHRMInvoiceReturnItemsModel {
  @PrimaryGeneratedColumn({ name: 'invoice_return_item_id' })
  InvoiceReturnItemId!: number;

  @Column({ name: 'invoice_return_id', type: 'integer', nullable: false })
  InvoiceReturnId!: number;

  @Column({ name: 'invoice_item_id', type: 'integer', nullable: true })
  InvoiceItemId!: number | null;

  @Column({ name: 'invoice_id', type: 'integer', nullable: true })
  InvoiceId!: number | null;

  @Column({ name: 'store_id', type: 'integer', nullable: false })
  StoreId!: number;

  @Column({ name: 'batch_no', type: 'text', nullable: true })
  BatchNo!: string | null;

  @Column({ name: 'quantity', type: 'numeric', nullable: false, transformer: NUM })
  Quantity!: number;

  @Column({ name: 'sale_price', type: 'numeric', nullable: false, transformer: NUM })
  SalePrice!: number;

  @Column({ name: 'price', type: 'numeric', nullable: false, transformer: NUM })
  Price!: number;

  @Column({ name: 'sub_total', type: 'numeric', nullable: false, transformer: NUM })
  SubTotal!: number;

  @Column({ name: 'vat_percentage', type: 'numeric', nullable: false, transformer: NUM })
  VATPercentage!: number;

  @Column({ name: 'discount_percentage', type: 'numeric', nullable: false, transformer: NUM })
  DiscountPercentage!: number;

  @Column({ name: 'total_dis_amt', type: 'numeric', nullable: false, transformer: NUM })
  TotalDisAmt!: number;

  @Column({ name: 'per_item_dis_amt', type: 'numeric', nullable: false, transformer: NUM })
  PerItemDisAmt!: number;

  @Column({ name: 'discount_amount', type: 'numeric', nullable: false, transformer: NUM })
  DiscountAmount!: number;

  @Column({ name: 'total_amount', type: 'numeric', nullable: false, transformer: NUM })
  TotalAmount!: number;

  @Column({ name: 'remark', type: 'text', nullable: true })
  Remark!: string | null;

  @Column({ name: 'created_by', type: 'integer', nullable: false })
  CreatedBy!: number;

  @Column({ name: 'counter_id', type: 'integer', nullable: false })
  CounterId!: number;

  @Column({ name: 'created_on', type: 'timestamp', nullable: false })
  CreatedOn!: string;

  @Column({ name: 'is_transferred_to_acc', type: 'boolean', nullable: false })
  IsTransferredToACC!: boolean;

  @Column({ name: 'item_id', type: 'integer', nullable: false })
  ItemId!: number;

  @Column({ name: 'credit_note_number', type: 'integer', nullable: false })
  CreditNoteNumber!: number;

  @Column({ name: 'fiscal_year_id', type: 'integer', nullable: false })
  FiscalYearId!: number;

  @Column({ name: 'returned_qty', type: 'numeric', nullable: false, transformer: NUM })
  ReturnedQty!: number;

  @Column({ name: 'expiry_date', type: 'timestamp', nullable: true })
  ExpiryDate!: string | null;

}

@Entity({ name: 'phrm_txn_patient_consumption' })
export class PatientConsumptionModel {
  @PrimaryGeneratedColumn({ name: 'patient_consumption_id' })
  PatientConsumptionId!: number;

  @Column({ name: 'fiscal_year_id', type: 'integer', nullable: false })
  FiscalYearId!: number;

  @Column({ name: 'consumption_receipt_no', type: 'integer', nullable: true })
  ConsumptionReceiptNo!: number | null;

  @Column({ name: 'patient_id', type: 'integer', nullable: false })
  PatientId!: number;

  @Column({ name: 'patient_visit_id', type: 'integer', nullable: false })
  PatientVisitId!: number;

  @Column({ name: 'sub_total', type: 'numeric', nullable: false, transformer: NUM })
  SubTotal!: number;

  @Column({ name: 'discount_amount', type: 'numeric', nullable: false, transformer: NUM })
  DiscountAmount!: number;

  @Column({ name: 'total_amount', type: 'numeric', nullable: false, transformer: NUM })
  TotalAmount!: number;

  @Column({ name: 'billing_status', type: 'text', nullable: true })
  BillingStatus!: string | null;

  @Column({ name: 'scheme_id', type: 'integer', nullable: true })
  SchemeId!: number | null;

  @Column({ name: 'store_id', type: 'integer', nullable: false })
  StoreId!: number;

  @Column({ name: 'created_by', type: 'integer', nullable: false })
  CreatedBy!: number;

  @Column({ name: 'created_on', type: 'timestamp', nullable: false })
  CreatedOn!: string;

  @Column({ name: 'modified_by', type: 'integer', nullable: true })
  ModifiedBy!: number | null;

  @Column({ name: 'modified_on', type: 'timestamp', nullable: true })
  ModifiedOn!: string | null;

  @Column({ name: 'is_active', type: 'boolean', nullable: false })
  IsActive!: boolean;

  @Column({ name: 'prescriber_id', type: 'integer', nullable: true })
  PrescriberId!: number | null;

}

@Entity({ name: 'phrm_txn_patient_consumption_item' })
export class PatientConsumptionItemModel {
  @PrimaryGeneratedColumn({ name: 'patient_consumption_item_id' })
  PatientConsumptionItemId!: number;

  @Column({ name: 'patient_consumption_id', type: 'integer', nullable: false })
  PatientConsumptionId!: number;

  @Column({ name: 'patient_id', type: 'integer', nullable: false })
  PatientId!: number;

  @Column({ name: 'patient_visit_id', type: 'integer', nullable: false })
  PatientVisitId!: number;

  @Column({ name: 'visit_type', type: 'text', nullable: true })
  VisitType!: string | null;

  @Column({ name: 'item_id', type: 'integer', nullable: false })
  ItemId!: number;

  @Column({ name: 'item_name', type: 'text', nullable: true })
  ItemName!: string | null;

  @Column({ name: 'generic_id', type: 'integer', nullable: false })
  GenericId!: number;

  @Column({ name: 'generic_name', type: 'text', nullable: true })
  GenericName!: string | null;

  @Column({ name: 'batch_no', type: 'text', nullable: true })
  BatchNo!: string | null;

  @Column({ name: 'expiry_date', type: 'timestamp', nullable: false })
  ExpiryDate!: string;

  @Column({ name: 'quantity', type: 'numeric', nullable: false, transformer: NUM })
  Quantity!: number;

  @Column({ name: 'sale_price', type: 'numeric', nullable: false, transformer: NUM })
  SalePrice!: number;

  @Column({ name: 'free_quantity', type: 'numeric', nullable: false, transformer: NUM })
  FreeQuantity!: number;

  @Column({ name: 'sub_total', type: 'numeric', nullable: false, transformer: NUM })
  SubTotal!: number;

  @Column({ name: 'total_amount', type: 'numeric', nullable: false, transformer: NUM })
  TotalAmount!: number;

  @Column({ name: 'discount_percentage', type: 'numeric', nullable: false, transformer: NUM })
  DiscountPercentage!: number;

  @Column({ name: 'discount_amount', type: 'numeric', nullable: false, transformer: NUM })
  DiscountAmount!: number;

  @Column({ name: 'vat_percentage', type: 'numeric', nullable: false, transformer: NUM })
  VatPercentage!: number;

  @Column({ name: 'vat_amount', type: 'numeric', nullable: false, transformer: NUM })
  VatAmount!: number;

  @Column({ name: 'remarks', type: 'text', nullable: true })
  Remarks!: string | null;

  @Column({ name: 'counter_id', type: 'integer', nullable: true })
  CounterId!: number | null;

  @Column({ name: 'store_id', type: 'integer', nullable: true })
  StoreId!: number | null;

  @Column({ name: 'prescriber_id', type: 'integer', nullable: true })
  PrescriberId!: number | null;

  @Column({ name: 'price_category_id', type: 'integer', nullable: true })
  PriceCategoryId!: number | null;

  @Column({ name: 'scheme_id', type: 'integer', nullable: false })
  SchemeId!: number;

  @Column({ name: 'created_by', type: 'integer', nullable: false })
  CreatedBy!: number;

  @Column({ name: 'created_on', type: 'timestamp', nullable: false })
  CreatedOn!: string;

  @Column({ name: 'is_active', type: 'boolean', nullable: false })
  IsActive!: boolean;

  @Column({ name: 'is_finalize', type: 'boolean', nullable: false })
  IsFinalize!: boolean;

}

@Entity({ name: 'phrm_txn_patient_consumption_return_item' })
export class PatientConsumptionReturnItemModel {
  @PrimaryGeneratedColumn({ name: 'patient_consumption_return_item_id' })
  PatientConsumptionReturnItemId!: number;

  @Column({ name: 'patient_consumption_item_id', type: 'integer', nullable: false })
  PatientConsumptionItemId!: number;

  @Column({ name: 'patient_consumption_id', type: 'integer', nullable: false })
  PatientConsumptionId!: number;

  @Column({ name: 'patient_id', type: 'integer', nullable: false })
  PatientId!: number;

  @Column({ name: 'patient_visit_id', type: 'integer', nullable: true })
  PatientVisitId!: number | null;

  @Column({ name: 'visit_type', type: 'text', nullable: true })
  VisitType!: string | null;

  @Column({ name: 'item_id', type: 'integer', nullable: false })
  ItemId!: number;

  @Column({ name: 'item_name', type: 'text', nullable: true })
  ItemName!: string | null;

  @Column({ name: 'generic_id', type: 'integer', nullable: true })
  GenericId!: number | null;

  @Column({ name: 'generic_name', type: 'text', nullable: true })
  GenericName!: string | null;

  @Column({ name: 'batch_no', type: 'text', nullable: true })
  BatchNo!: string | null;

  @Column({ name: 'expiry_date', type: 'timestamp', nullable: true })
  ExpiryDate!: string | null;

  @Column({ name: 'quantity', type: 'numeric', nullable: false, transformer: NUM })
  Quantity!: number;

  @Column({ name: 'sale_price', type: 'numeric', nullable: true, transformer: NUM })
  SalePrice!: number | null;

  @Column({ name: 'free_quantity', type: 'numeric', nullable: true, transformer: NUM })
  FreeQuantity!: number | null;

  @Column({ name: 'sub_total', type: 'numeric', nullable: false, transformer: NUM })
  SubTotal!: number;

  @Column({ name: 'total_amount', type: 'numeric', nullable: false, transformer: NUM })
  TotalAmount!: number;

  @Column({ name: 'discount_percentage', type: 'numeric', nullable: false, transformer: NUM })
  DiscountPercentage!: number;

  @Column({ name: 'discount_amount', type: 'numeric', nullable: false, transformer: NUM })
  DiscountAmount!: number;

  @Column({ name: 'vat_percentage', type: 'numeric', nullable: false, transformer: NUM })
  VatPercentage!: number;

  @Column({ name: 'vat_amount', type: 'numeric', nullable: false, transformer: NUM })
  VatAmount!: number;

  @Column({ name: 'remarks', type: 'text', nullable: true })
  Remarks!: string | null;

  @Column({ name: 'counter_id', type: 'integer', nullable: true })
  CounterId!: number | null;

  @Column({ name: 'store_id', type: 'integer', nullable: true })
  StoreId!: number | null;

  @Column({ name: 'prescriber_id', type: 'integer', nullable: true })
  PrescriberId!: number | null;

  @Column({ name: 'price_category_id', type: 'integer', nullable: true })
  PriceCategoryId!: number | null;

  @Column({ name: 'scheme_id', type: 'integer', nullable: true })
  SchemeId!: number | null;

  @Column({ name: 'created_by', type: 'integer', nullable: false })
  CreatedBy!: number;

  @Column({ name: 'created_on', type: 'timestamp', nullable: false })
  CreatedOn!: string;

  @Column({ name: 'is_active', type: 'boolean', nullable: false })
  IsActive!: boolean;

  @Column({ name: 'consumption_return_receipt_no', type: 'integer', nullable: true })
  ConsumptionReturnReceiptNo!: number | null;

}

@Entity({ name: 'phrm_txn_provisional_return_items' })
export class PHRMTransactionProvisionalReturnItemsModel {
  @PrimaryGeneratedColumn({ name: 'provisional_return_item_id' })
  ProvisionalReturnItemId!: number;

  @Column({ name: 'invoice_item_id', type: 'integer', nullable: false })
  InvoiceItemId!: number;

  @Column({ name: 'reference_provisional_receipt_no', type: 'integer', nullable: false })
  ReferenceProvisionalReceiptNo!: number;

  @Column({ name: 'cancellation_receipt_no', type: 'integer', nullable: false })
  CancellationReceiptNo!: number;

  @Column({ name: 'fiscal_year_id', type: 'integer', nullable: false })
  FiscalYearId!: number;

  @Column({ name: 'patient_id', type: 'integer', nullable: false })
  PatientId!: number;

  @Column({ name: 'patient_visit_id', type: 'integer', nullable: true })
  PatientVisitId!: number | null;

  @Column({ name: 'visit_type', type: 'text', nullable: true })
  VisitType!: string | null;

  @Column({ name: 'item_id', type: 'integer', nullable: false })
  ItemId!: number;

  @Column({ name: 'item_name', type: 'text', nullable: true })
  ItemName!: string | null;

  @Column({ name: 'batch_no', type: 'text', nullable: true })
  BatchNo!: string | null;

  @Column({ name: 'expiry_date', type: 'timestamp', nullable: true })
  ExpiryDate!: string | null;

  @Column({ name: 'sale_price', type: 'numeric', nullable: false, transformer: NUM })
  SalePrice!: number;

  @Column({ name: 'quantity', type: 'numeric', nullable: false, transformer: NUM })
  Quantity!: number;

  @Column({ name: 'sub_total', type: 'numeric', nullable: false, transformer: NUM })
  SubTotal!: number;

  @Column({ name: 'discount_percentage', type: 'numeric', nullable: false, transformer: NUM })
  DiscountPercentage!: number;

  @Column({ name: 'discount_amount', type: 'numeric', nullable: false, transformer: NUM })
  DiscountAmount!: number;

  @Column({ name: 'vat_percentage', type: 'numeric', nullable: false, transformer: NUM })
  VATPercentage!: number;

  @Column({ name: 'vat_amount', type: 'numeric', nullable: false, transformer: NUM })
  VATAmount!: number;

  @Column({ name: 'total_amount', type: 'numeric', nullable: false, transformer: NUM })
  TotalAmount!: number;

  @Column({ name: 'prescriber_id', type: 'integer', nullable: true })
  PrescriberId!: number | null;

  @Column({ name: 'counter_id', type: 'integer', nullable: false })
  CounterId!: number;

  @Column({ name: 'remarks', type: 'text', nullable: true })
  Remarks!: string | null;

  @Column({ name: 'scheme_id', type: 'integer', nullable: false })
  SchemeId!: number;

  @Column({ name: 'price_category_id', type: 'integer', nullable: false })
  PriceCategoryId!: number;

  @Column({ name: 'created_by', type: 'integer', nullable: false })
  CreatedBy!: number;

  @Column({ name: 'created_on', type: 'timestamp', nullable: false })
  CreatedOn!: string;

  @Column({ name: 'is_active', type: 'boolean', nullable: false })
  IsActive!: boolean;

  @Column({ name: 'modified_by', type: 'integer', nullable: true })
  ModifiedBy!: number | null;

  @Column({ name: 'modified_on', type: 'timestamp', nullable: true })
  ModifiedOn!: string | null;

  @Column({ name: 'store_id', type: 'integer', nullable: false })
  StoreId!: number;

  @Column({ name: 'co_payment_cash_amount', type: 'numeric', nullable: false, transformer: NUM })
  CoPaymentCashAmount!: number;

  @Column({ name: 'co_payment_credit_amount', type: 'numeric', nullable: false, transformer: NUM })
  CoPaymentCreditAmount!: number;

}

@Entity({ name: 'phrm_txn_settlement' })
export class PHRMSettlementModel {
  @PrimaryGeneratedColumn({ name: 'settlement_id' })
  SettlementId!: number;

  @Column({ name: 'fiscal_year_id', type: 'integer', nullable: true })
  FiscalYearId!: number | null;

  @Column({ name: 'settlement_receipt_no', type: 'integer', nullable: true })
  SettlementReceiptNo!: number | null;

  @Column({ name: 'settlement_date', type: 'timestamp', nullable: true })
  SettlementDate!: string | null;

  @Column({ name: 'settlement_type', type: 'text', nullable: true })
  SettlementType!: string | null;

  @Column({ name: 'patient_id', type: 'integer', nullable: false })
  PatientId!: number;

  @Column({ name: 'payable_amount', type: 'double precision', nullable: true })
  PayableAmount!: number | null;

  @Column({ name: 'refundable_amount', type: 'double precision', nullable: true })
  RefundableAmount!: number | null;

  @Column({ name: 'paid_amount', type: 'double precision', nullable: true })
  PaidAmount!: number | null;

  @Column({ name: 'returned_amount', type: 'double precision', nullable: true })
  ReturnedAmount!: number | null;

  @Column({ name: 'deposit_deducted', type: 'double precision', nullable: true })
  DepositDeducted!: number | null;

  @Column({ name: 'due_amount', type: 'double precision', nullable: true })
  DueAmount!: number | null;

  @Column({ name: 'discount_amount', type: 'double precision', nullable: true })
  DiscountAmount!: number | null;

  @Column({ name: 'payment_mode', type: 'text', nullable: true })
  PaymentMode!: string | null;

  @Column({ name: 'payment_details', type: 'text', nullable: true })
  PaymentDetails!: string | null;

  @Column({ name: 'counter_id', type: 'integer', nullable: true })
  CounterId!: number | null;

  @Column({ name: 'created_by', type: 'integer', nullable: true })
  CreatedBy!: number | null;

  @Column({ name: 'created_on', type: 'timestamp', nullable: true })
  CreatedOn!: string | null;

  @Column({ name: 'remarks', type: 'text', nullable: true })
  Remarks!: string | null;

  @Column({ name: 'print_count', type: 'integer', nullable: true })
  PrintCount!: number | null;

  @Column({ name: 'printed_on', type: 'timestamp', nullable: true })
  PrintedOn!: string | null;

  @Column({ name: 'printed_by', type: 'integer', nullable: true })
  PrintedBy!: number | null;

  @Column({ name: 'is_active', type: 'boolean', nullable: true })
  IsActive!: boolean | null;

  @Column({ name: 'collection_from_receivable', type: 'numeric', nullable: false, transformer: NUM })
  CollectionFromReceivable!: number;

  @Column({ name: 'discount_return_amount', type: 'numeric', nullable: false, transformer: NUM })
  DiscountReturnAmount!: number;

  @Column({ name: 'store_id', type: 'integer', nullable: false })
  StoreId!: number;

  @Column({ name: 'organization_id', type: 'integer', nullable: true })
  OrganizationId!: number | null;

}

@Entity({ name: 'phrm_txn_stock_transaction' })
export class PHRMStockTransactionModel {
  @PrimaryGeneratedColumn({ name: 'stock_transaction_id' })
  StockTransactionId!: number;

  @Column({ name: 'transaction_date', type: 'timestamp', nullable: false })
  TransactionDate!: string;

  @Column({ name: 'store_id', type: 'integer', nullable: false })
  StoreId!: number;

  @Column({ name: 'stock_id', type: 'integer', nullable: false })
  StockId!: number;

  @Column({ name: 'store_stock_id', type: 'integer', nullable: false })
  StoreStockId!: number;

  @Column({ name: 'fiscal_year_id', type: 'integer', nullable: false })
  FiscalYearId!: number;

  @Column({ name: 'item_id', type: 'integer', nullable: false })
  ItemId!: number;

  @Column({ name: 'batch_no', type: 'text', nullable: true })
  BatchNo!: string | null;

  @Column({ name: 'expiry_date', type: 'timestamp', nullable: true })
  ExpiryDate!: string | null;

  @Column({ name: 'transaction_type', type: 'text', nullable: true })
  TransactionType!: string | null;

  @Column({ name: 'in_qty', type: 'double precision', nullable: false })
  InQty!: number;

  @Column({ name: 'out_qty', type: 'double precision', nullable: false })
  OutQty!: number;

  @Column({ name: 'cost_price', type: 'numeric', nullable: false, transformer: NUM })
  CostPrice!: number;

  @Column({ name: 'sale_price', type: 'numeric', nullable: false, transformer: NUM })
  SalePrice!: number;

  @Column({ name: 'reference_no', type: 'integer', nullable: false })
  ReferenceNo!: number;

  @Column({ name: 'remarks', type: 'text', nullable: true })
  Remarks!: string | null;

  @Column({ name: 'is_active', type: 'boolean', nullable: false })
  IsActive!: boolean;

  @Column({ name: 'is_transfered_to_acc', type: 'boolean', nullable: false })
  IsTransferedToAcc!: boolean;

  @Column({ name: 'created_by', type: 'integer', nullable: false })
  CreatedBy!: number;

  @Column({ name: 'created_on', type: 'timestamp', nullable: false })
  CreatedOn!: string;

}

@Entity({ name: 'phrm_txn_store_stock' })
export class PHRMStoreStockModel {
  @PrimaryGeneratedColumn({ name: 'store_stock_id' })
  StoreStockId!: number;

  @Column({ name: 'store_id', type: 'integer', nullable: false })
  StoreId!: number;

  @Column({ name: 'stock_id', type: 'integer', nullable: false })
  StockId!: number;

  @Column({ name: 'item_id', type: 'integer', nullable: false })
  ItemId!: number;

  @Column({ name: 'available_quantity', type: 'double precision', nullable: false })
  AvailableQuantity!: number;

  @Column({ name: 'un_confirmed_qty_in', type: 'double precision', nullable: false })
  UnConfirmedQty_In!: number;

  @Column({ name: 'un_confirmed_qty_out', type: 'double precision', nullable: false })
  UnConfirmedQty_Out!: number;

  @Column({ name: 'cost_price', type: 'numeric', nullable: false, transformer: NUM })
  CostPrice!: number;

  @Column({ name: 'sale_price', type: 'numeric', nullable: false, transformer: NUM })
  SalePrice!: number;

  @Column({ name: 'is_active', type: 'boolean', nullable: false })
  IsActive!: boolean;

}

@Entity({ name: 'phrm_txn_supplier_ledger' })
export class PHRMSupplierLedgerModel {
  @PrimaryGeneratedColumn({ name: 'ledger_id' })
  LedgerId!: number;

  @Column({ name: 'supplier_id', type: 'integer', nullable: false })
  SupplierId!: number;

  @Column({ name: 'credit_amount', type: 'numeric', nullable: true, transformer: NUM })
  CreditAmount!: number | null;

  @Column({ name: 'debit_amount', type: 'numeric', nullable: true, transformer: NUM })
  DebitAmount!: number | null;

  @Column({ name: 'balance_amount', type: 'numeric', nullable: true, transformer: NUM })
  BalanceAmount!: number | null;

  @Column({ name: 'is_active', type: 'boolean', nullable: false })
  IsActive!: boolean;

  @Column({ name: 'created_by', type: 'integer', nullable: false })
  CreatedBy!: number;

  @Column({ name: 'created_on', type: 'timestamp', nullable: false })
  CreatedOn!: string;

  @Column({ name: 'modified_by', type: 'integer', nullable: true })
  ModifiedBy!: number | null;

  @Column({ name: 'modified_on', type: 'timestamp', nullable: true })
  ModifiedOn!: string | null;

}

@Entity({ name: 'phrm_txn_supplier_ledger_transaction' })
export class PHRMSupplierLedgerTransactionModel {
  @PrimaryGeneratedColumn({ name: 'ledger_transaction_id' })
  LedgerTransactionId!: number;

  @Column({ name: 'fiscal_year_id', type: 'integer', nullable: false })
  FiscalYearId!: number;

  @Column({ name: 'ledger_id', type: 'integer', nullable: false })
  LedgerId!: number;

  @Column({ name: 'supplier_id', type: 'integer', nullable: false })
  SupplierId!: number;

  @Column({ name: 'debit_amount', type: 'numeric', nullable: true, transformer: NUM })
  DebitAmount!: number | null;

  @Column({ name: 'credit_amount', type: 'numeric', nullable: true, transformer: NUM })
  CreditAmount!: number | null;

  @Column({ name: 'remarks', type: 'text', nullable: true })
  Remarks!: string | null;

  @Column({ name: 'reference_no', type: 'integer', nullable: true })
  ReferenceNo!: number | null;

  @Column({ name: 'transaction_type', type: 'text', nullable: true })
  TransactionType!: string | null;

  @Column({ name: 'created_by', type: 'integer', nullable: false })
  CreatedBy!: number;

  @Column({ name: 'created_on', type: 'timestamp', nullable: true })
  CreatedOn!: string | null;

  @Column({ name: 'is_active', type: 'boolean', nullable: true })
  IsActive!: boolean | null;

}

@Entity({ name: 'phrm_write_off' })
export class PHRMWriteOffModel {
  @PrimaryGeneratedColumn({ name: 'write_off_id' })
  WriteOffId!: number;

  @Column({ name: 'write_off_no', type: 'integer', nullable: true })
  WriteOffNo!: number | null;

  @Column({ name: 'write_off_date', type: 'timestamp', nullable: false })
  WriteOffDate!: string;

  @Column({ name: 'store_id', type: 'integer', nullable: true })
  StoreId!: number | null;

  @Column({ name: 'sub_total', type: 'numeric', nullable: false, transformer: NUM })
  SubTotal!: number;

  @Column({ name: 'vat_amount', type: 'numeric', nullable: false, transformer: NUM })
  VATAmount!: number;

  @Column({ name: 'discount_amount', type: 'numeric', nullable: false, transformer: NUM })
  DiscountAmount!: number;

  @Column({ name: 'total_amount', type: 'numeric', nullable: false, transformer: NUM })
  TotalAmount!: number;

  @Column({ name: 'write_off_remark', type: 'text', nullable: true })
  WriteOffRemark!: string | null;

  @Column({ name: 'created_by', type: 'integer', nullable: true })
  CreatedBy!: number | null;

  @Column({ name: 'created_on', type: 'timestamp', nullable: true })
  CreatedOn!: string | null;

  @Column({ name: 'is_transferred_to_acc', type: 'boolean', nullable: true })
  IsTransferredToACC!: boolean | null;

}

@Entity({ name: 'phrm_write_off_items' })
export class PHRMWriteOffItemsModel {
  @PrimaryGeneratedColumn({ name: 'write_off_item_id' })
  WriteOffItemId!: number;

  @Column({ name: 'write_off_id', type: 'integer', nullable: false })
  WriteOffId!: number;

  @Column({ name: 'item_id', type: 'integer', nullable: false })
  ItemId!: number;

  @Column({ name: 'batch_no', type: 'text', nullable: true })
  BatchNo!: string | null;

  @Column({ name: 'item_price', type: 'numeric', nullable: false, transformer: NUM })
  ItemPrice!: number;

  @Column({ name: 'write_off_quantity', type: 'double precision', nullable: false })
  WriteOffQuantity!: number;

  @Column({ name: 'sub_total', type: 'numeric', nullable: false, transformer: NUM })
  SubTotal!: number;

  @Column({ name: 'discount_percentage', type: 'numeric', nullable: false, transformer: NUM })
  DiscountPercentage!: number;

  @Column({ name: 'vat_percentage', type: 'numeric', nullable: false, transformer: NUM })
  VATPercentage!: number;

  @Column({ name: 'total_amount', type: 'numeric', nullable: false, transformer: NUM })
  TotalAmount!: number;

  @Column({ name: 'write_off_item_remark', type: 'text', nullable: true })
  WriteOffItemRemark!: string | null;

  @Column({ name: 'created_by', type: 'integer', nullable: false })
  CreatedBy!: number;

  @Column({ name: 'created_on', type: 'timestamp', nullable: true })
  CreatedOn!: string | null;

}

@Entity({ name: 'phrm_patient' })
export class PHRMPatient {
  @PrimaryGeneratedColumn({ name: 'patient_id' })
  PatientId!: number;

  @Column({ name: 'first_name', type: 'text', nullable: true })
  FirstName!: string | null;

  @Column({ name: 'middle_name', type: 'text', nullable: true })
  MiddleName!: string | null;

  @Column({ name: 'last_name', type: 'text', nullable: true })
  LastName!: string | null;

  @Column({ name: 'age', type: 'text', nullable: true })
  Age!: string | null;

  @Column({ name: 'membership_type_id', type: 'integer', nullable: true })
  MembershipTypeId!: number | null;

  @Column({ name: 'address', type: 'text', nullable: true })
  Address!: string | null;

  @Column({ name: 'phone_number', type: 'text', nullable: true })
  PhoneNumber!: string | null;

  @Column({ name: 'patient_no', type: 'integer', nullable: true })
  PatientNo!: number | null;

  @Column({ name: 'date_of_birth', type: 'timestamp', nullable: true })
  DateOfBirth!: string | null;

  @Column({ name: 'gender', type: 'text', nullable: true })
  Gender!: string | null;

  @Column({ name: 'phone_accepts_text', type: 'boolean', nullable: true })
  PhoneAcceptsText!: boolean | null;

  @Column({ name: 'is_dob_verified', type: 'boolean', nullable: true })
  IsDobVerified!: boolean | null;

  @Column({ name: 'created_on', type: 'timestamp', nullable: true })
  CreatedOn!: string | null;

  @Column({ name: 'created_by', type: 'integer', nullable: true })
  CreatedBy!: number | null;

  @Column({ name: 'patient_code', type: 'text', nullable: true })
  PatientCode!: string | null;

  @Column({ name: 'is_active', type: 'boolean', nullable: true })
  IsActive!: boolean | null;

  @Column({ name: 'is_outdoor_pat', type: 'boolean', nullable: true })
  IsOutdoorPat!: boolean | null;

  @Column({ name: 'pan_number', type: 'text', nullable: true })
  PANNumber!: string | null;

  @Column({ name: 'country_sub_division_id', type: 'integer', nullable: true })
  CountrySubDivisionId!: number | null;

  @Column({ name: 'country_id', type: 'integer', nullable: true })
  CountryId!: number | null;

  @Column({ name: 'ins_has_insurance', type: 'boolean', nullable: true })
  Ins_HasInsurance!: boolean | null;

  @Column({ name: 'ins_nshi_number', type: 'text', nullable: true })
  Ins_NshiNumber!: string | null;

  @Column({ name: 'ins_insurance_balance', type: 'double precision', nullable: true })
  Ins_InsuranceBalance!: number | null;

  @Column({ name: 'ins_latest_claim_code', type: 'bigint', nullable: true, transformer: NUM })
  Ins_LatestClaimCode!: number | null;

  @Column({ name: 'short_name', type: 'text', nullable: true })
  ShortName!: string | null;

  @Column({ name: 'posting', type: 'text', nullable: true })
  Posting!: string | null;

  @Column({ name: 'rank', type: 'text', nullable: true })
  Rank!: string | null;

  @Column({ name: 'is_ssu_patient', type: 'boolean', nullable: false })
  IsSSUPatient!: boolean;

  @Column({ name: 'is_vaccination_patient', type: 'boolean', nullable: false })
  IsVaccinationPatient!: boolean;

  @Column({ name: 'is_vaccination_active', type: 'boolean', nullable: false })
  IsVaccinationActive!: boolean;

  @Column({ name: 'ssu_is_active', type: 'boolean', nullable: false })
  SSU_IsActive!: boolean;

}
