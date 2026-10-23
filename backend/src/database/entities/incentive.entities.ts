/* GÉNÉRÉ par tools/generate-entities.mjs depuis migration/inventory/entities.json : ne pas modifier à la main. */
import { Column, Entity, PrimaryColumn, PrimaryGeneratedColumn } from 'typeorm';


@Entity({ name: 'inctv_bill_items_profile_map' })
export class ProfileItemMap {
  @PrimaryGeneratedColumn({ name: 'bill_item_profile_map_id' })
  BillItemProfileMapId!: number;

  @Column({ name: 'bill_item_price_id', type: 'integer', nullable: true })
  BillItemPriceId!: number | null;

  @Column({ name: 'profile_id', type: 'integer', nullable: false })
  ProfileId!: number;

  @Column({ name: 'service_item_id', type: 'integer', nullable: false })
  ServiceItemId!: number;

  @Column({ name: 'performer_percent', type: 'double precision', nullable: false })
  PerformerPercent!: number;

  @Column({ name: 'prescriber_percent', type: 'double precision', nullable: false })
  PrescriberPercent!: number;

  @Column({ name: 'price_category_id', type: 'integer', nullable: false })
  PriceCategoryId!: number;

  @Column({ name: 'billing_types_applicable', type: 'text', nullable: true })
  BillingTypesApplicable!: string | null;

  @Column({ name: 'created_by', type: 'integer', nullable: true })
  CreatedBy!: number | null;

  @Column({ name: 'created_on', type: 'timestamp', nullable: true })
  CreatedOn!: string | null;

  @Column({ name: 'modified_by', type: 'integer', nullable: true })
  ModifiedBy!: number | null;

  @Column({ name: 'modified_on', type: 'timestamp', nullable: true })
  ModifiedOn!: string | null;

  @Column({ name: 'referrer_percent', type: 'double precision', nullable: true })
  ReferrerPercent!: number | null;

  @Column({ name: 'is_active', type: 'boolean', nullable: false })
  IsActive!: boolean;

}

@Entity({ name: 'inctv_cfg_item_group_distribution' })
export class ItemGroupDistribution {
  @PrimaryGeneratedColumn({ name: 'item_group_distribution_id' })
  ItemGroupDistributionId!: number;

  @Column({ name: 'incentive_type', type: 'text', nullable: true })
  IncentiveType!: string | null;

  @Column({ name: 'bill_item_price_id', type: 'integer', nullable: false })
  BillItemPriceId!: number;

  @Column({ name: 'service_item_id', type: 'integer', nullable: true })
  ServiceItemId!: number | null;

  @Column({ name: 'employee_bill_items_map_id', type: 'integer', nullable: false })
  EmployeeBillItemsMapId!: number;

  @Column({ name: 'from_employee_id', type: 'integer', nullable: false })
  FromEmployeeId!: number;

  @Column({ name: 'distribute_to_employee_id', type: 'integer', nullable: false })
  DistributeToEmployeeId!: number;

  @Column({ name: 'distribution_percent', type: 'double precision', nullable: true })
  DistributionPercent!: number | null;

  @Column({ name: 'fixed_distribution_amount', type: 'double precision', nullable: true })
  FixedDistributionAmount!: number | null;

  @Column({ name: 'is_fixed_amount', type: 'boolean', nullable: true })
  IsFixedAmount!: boolean | null;

  @Column({ name: 'display_seq', type: 'integer', nullable: true })
  DisplaySeq!: number | null;

  @Column({ name: 'remarks', type: 'text', nullable: true })
  Remarks!: string | null;

  @Column({ name: 'created_by', type: 'integer', nullable: true })
  CreatedBy!: number | null;

  @Column({ name: 'created_on', type: 'timestamp', nullable: true })
  CreatedOn!: string | null;

  @Column({ name: 'modified_by', type: 'integer', nullable: true })
  ModifiedBy!: number | null;

  @Column({ name: 'modified_on', type: 'timestamp', nullable: true })
  ModifiedOn!: string | null;

  @Column({ name: 'is_active', type: 'boolean', nullable: false })
  IsActive!: boolean;

}

@Entity({ name: 'inctv_employee_incentive_info' })
export class EmployeeIncentiveInfo {
  @PrimaryGeneratedColumn({ name: 'employee_incentive_info_id' })
  EmployeeIncentiveInfoId!: number;

  @Column({ name: 'employee_id', type: 'integer', nullable: false })
  EmployeeId!: number;

  @Column({ name: 'tds_percent', type: 'double precision', nullable: true })
  TDSPercent!: number | null;

  @Column({ name: 'created_by', type: 'integer', nullable: false })
  CreatedBy!: number;

  @Column({ name: 'created_on', type: 'timestamp', nullable: true })
  CreatedOn!: string | null;

  @Column({ name: 'is_active', type: 'boolean', nullable: false })
  IsActive!: boolean;

}

@Entity({ name: 'inctv_map_employee_bill_items_map' })
export class EmployeeBillItemsMap {
  @PrimaryGeneratedColumn({ name: 'employee_bill_items_map_id' })
  EmployeeBillItemsMapId!: number;

  @Column({ name: 'employee_id', type: 'integer', nullable: false })
  EmployeeId!: number;

  @Column({ name: 'service_item_id', type: 'integer', nullable: false })
  ServiceItemId!: number;

  @Column({ name: 'bill_item_price_id', type: 'integer', nullable: true })
  BillItemPriceId!: number | null;

  @Column({ name: 'performer_percent', type: 'double precision', nullable: true })
  PerformerPercent!: number | null;

  @Column({ name: 'prescriber_percent', type: 'double precision', nullable: true })
  PrescriberPercent!: number | null;

  @Column({ name: 'price_category_id', type: 'integer', nullable: false })
  PriceCategoryId!: number;

  @Column({ name: 'has_group_distribution', type: 'boolean', nullable: true })
  HasGroupDistribution!: boolean | null;

  @Column({ name: 'created_by', type: 'integer', nullable: true })
  CreatedBy!: number | null;

  @Column({ name: 'created_on', type: 'timestamp', nullable: true })
  CreatedOn!: string | null;

  @Column({ name: 'modified_by', type: 'integer', nullable: true })
  ModifiedBy!: number | null;

  @Column({ name: 'modified_on', type: 'timestamp', nullable: true })
  ModifiedOn!: string | null;

  @Column({ name: 'is_active', type: 'boolean', nullable: false })
  IsActive!: boolean;

  @Column({ name: 'billing_types_applicable', type: 'text', nullable: true })
  BillingTypesApplicable!: string | null;

  @Column({ name: 'referrer_percent', type: 'double precision', nullable: true })
  ReferrerPercent!: number | null;

}

@Entity({ name: 'inctv_mst_profile' })
export class ProfileModel {
  @PrimaryGeneratedColumn({ name: 'profile_id' })
  ProfileId!: number;

  @Column({ name: 'profile_name', type: 'text', nullable: true })
  ProfileName!: string | null;

  @Column({ name: 'price_category_id', type: 'integer', nullable: false })
  PriceCategoryId!: number;

  @Column({ name: 'is_active', type: 'boolean', nullable: false })
  IsActive!: boolean;

  @Column({ name: 'tds_percentage', type: 'double precision', nullable: true })
  TDSPercentage!: number | null;

  @Column({ name: 'description', type: 'text', nullable: true })
  Description!: string | null;

  @Column({ name: 'created_by', type: 'integer', nullable: true })
  CreatedBy!: number | null;

  @Column({ name: 'created_on', type: 'timestamp', nullable: true })
  CreatedOn!: string | null;

  @Column({ name: 'modified_by', type: 'integer', nullable: true })
  ModifiedBy!: number | null;

  @Column({ name: 'modified_on', type: 'timestamp', nullable: true })
  ModifiedOn!: string | null;

}

@Entity({ name: 'inctv_txn_incentive_fraction_item' })
export class IncentiveFractionItemModel {
  @PrimaryGeneratedColumn({ name: 'inctv_txn_item_id' })
  InctvTxnItemId!: number;

  @Column({ name: 'invoice_no_formatted', type: 'text', nullable: true })
  InvoiceNoFormatted!: string | null;

  @Column({ name: 'transaction_date', type: 'timestamp', nullable: false })
  TransactionDate!: string;

  @Column({ name: 'price_category', type: 'text', nullable: true })
  PriceCategory!: string | null;

  @Column({ name: 'billing_transaction_id', type: 'integer', nullable: true })
  BillingTransactionId!: number | null;

  @Column({ name: 'billing_transaction_item_id', type: 'integer', nullable: false })
  BillingTransactionItemId!: number;

  @Column({ name: 'patient_id', type: 'integer', nullable: false })
  PatientId!: number;

  @Column({ name: 'bill_item_price_id', type: 'integer', nullable: true })
  BillItemPriceId!: number | null;

  @Column({ name: 'item_name', type: 'text', nullable: true })
  ItemName!: string | null;

  @Column({ name: 'total_bill_amount', type: 'double precision', nullable: true })
  TotalBillAmount!: number | null;

  @Column({ name: 'incentive_type', type: 'text', nullable: true })
  IncentiveType!: string | null;

  @Column({ name: 'incentive_receiver_id', type: 'integer', nullable: false })
  IncentiveReceiverId!: number;

  @Column({ name: 'incentive_receiver_name', type: 'text', nullable: true })
  IncentiveReceiverName!: string | null;

  @Column({ name: 'final_incentive_percent', type: 'double precision', nullable: false })
  FinalIncentivePercent!: number;

  @Column({ name: 'incentive_amount', type: 'double precision', nullable: false })
  IncentiveAmount!: number;

  @Column({ name: 'is_payment_processed', type: 'boolean', nullable: true })
  IsPaymentProcessed!: boolean | null;

  @Column({ name: 'payment_info_id', type: 'integer', nullable: true })
  PaymentInfoId!: number | null;

  @Column({ name: 'created_by', type: 'integer', nullable: true })
  CreatedBy!: number | null;

  @Column({ name: 'created_on', type: 'timestamp', nullable: true })
  CreatedOn!: string | null;

  @Column({ name: 'modified_by', type: 'integer', nullable: true })
  ModifiedBy!: number | null;

  @Column({ name: 'modified_on', type: 'timestamp', nullable: true })
  ModifiedOn!: string | null;

  @Column({ name: 'is_active', type: 'boolean', nullable: true })
  IsActive!: boolean | null;

  @Column({ name: 'is_main_doctor', type: 'boolean', nullable: false })
  IsMainDoctor!: boolean;

  @Column({ name: 'tds_percentage', type: 'double precision', nullable: true })
  TDSPercentage!: number | null;

  @Column({ name: 'tds_amount', type: 'double precision', nullable: true })
  TDSAmount!: number | null;

  @Column({ name: 'quantity', type: 'double precision', nullable: true })
  Quantity!: number | null;

  @Column({ name: 'initial_incentive_percent', type: 'double precision', nullable: false })
  InitialIncentivePercent!: number;

  @Column({ name: 'bill_return_item_id', type: 'integer', nullable: true })
  BillReturnItemId!: number | null;

  @Column({ name: 'service_item_id', type: 'integer', nullable: true })
  ServiceItemId!: number | null;

}

@Entity({ name: 'inctv_txn_payment_info' })
export class PaymentInfoModel {
  @PrimaryGeneratedColumn({ name: 'payment_info_id' })
  PaymentInfoId!: number;

  @Column({ name: 'payment_date', type: 'timestamp', nullable: false })
  PaymentDate!: string;

  @Column({ name: 'receiver_id', type: 'integer', nullable: false })
  ReceiverId!: number;

  @Column({ name: 'total_amount', type: 'real', nullable: false })
  TotalAmount!: number;

  @Column({ name: 'tds_amount', type: 'real', nullable: false })
  TDSAmount!: number;

  @Column({ name: 'net_pay_amount', type: 'real', nullable: false })
  NetPayAmount!: number;

  @Column({ name: 'is_posted_to_accounting', type: 'boolean', nullable: false })
  IsPostedToAccounting!: boolean;

  @Column({ name: 'accounting_posted_date', type: 'timestamp', nullable: true })
  AccountingPostedDate!: string | null;

  @Column({ name: 'created_by', type: 'integer', nullable: false })
  CreatedBy!: number;

  @Column({ name: 'created_on', type: 'timestamp', nullable: false })
  CreatedOn!: string;

  @Column({ name: 'is_active', type: 'boolean', nullable: false })
  IsActive!: boolean;

  @Column({ name: 'adjusted_amount', type: 'real', nullable: false })
  AdjustedAmount!: number;

  @Column({ name: 'voucher_number', type: 'text', nullable: true })
  VoucherNumber!: string | null;

  @Column({ name: 'remarks', type: 'text', nullable: true })
  Remarks!: string | null;

}
