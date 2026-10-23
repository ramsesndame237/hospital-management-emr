/* GÉNÉRÉ par tools/generate-entities.mjs depuis migration/inventory/entities.json : ne pas modifier à la main. */
import { Column, Entity, PrimaryColumn, PrimaryGeneratedColumn } from 'typeorm';
import { NUM } from '../transformers';

@Entity({ name: 'bil_bill_item_requisition' })
export class BillItemRequisition {
  @PrimaryGeneratedColumn({ name: 'bill_item_requisition_id', type: 'bigint' })
  BillItemRequisitionId!: number;

  @Column({ name: 'requisition_id', type: 'bigint', nullable: true, transformer: NUM })
  RequisitionId!: number | null;

  @Column({ name: 'patient_id', type: 'integer', nullable: false })
  PatientId!: number;

  @Column({ name: 'patient_visit_id', type: 'integer', nullable: false })
  PatientVisitId!: number;

  @Column({ name: 'service_department_id', type: 'integer', nullable: false })
  ServiceDepartmentId!: number;

  @Column({ name: 'item_id', type: 'integer', nullable: false })
  ItemId!: number;

  @Column({ name: 'provider_id', type: 'integer', nullable: false })
  ProviderId!: number;

  @Column({ name: 'item_name', type: 'text', nullable: true })
  ItemName!: string | null;

  @Column({ name: 'quantity', type: 'double precision', nullable: false })
  Quantity!: number;

  @Column({ name: 'procedure_code', type: 'text', nullable: true })
  ProcedureCode!: string | null;

  @Column({ name: 'bill_status', type: 'text', nullable: true })
  BillStatus!: string | null;

  @Column({ name: 'department_name', type: 'text', nullable: true })
  DepartmentName!: string | null;

  @Column({ name: 'price', type: 'double precision', nullable: true })
  Price!: number | null;

  @Column({ name: 'created_by', type: 'integer', nullable: true })
  CreatedBy!: number | null;

  @Column({ name: 'created_on', type: 'timestamp', nullable: true })
  CreatedOn!: string | null;

  @Column({ name: 'assigned_to', type: 'integer', nullable: true })
  AssignedTo!: number | null;

}

@Entity({ name: 'bil_cfg_additional_service_item' })
export class BillingAdditionalServiceItemModel {
  @PrimaryGeneratedColumn({ name: 'additional_service_item_id' })
  AdditionalServiceItemId!: number;

  @Column({ name: 'group_name', type: 'text', nullable: true })
  GroupName!: string | null;

  @Column({ name: 'service_item_id', type: 'integer', nullable: false })
  ServiceItemId!: number;

  @Column({ name: 'price_category_id', type: 'integer', nullable: false })
  PriceCategoryId!: number;

  @Column({ name: 'item_name', type: 'text', nullable: true })
  ItemName!: string | null;

  @Column({ name: 'use_item_self_price', type: 'boolean', nullable: false })
  UseItemSelfPrice!: boolean;

  @Column({ name: 'percentage_of_parent_item_for_same_dept', type: 'numeric', nullable: false, transformer: NUM })
  PercentageOfParentItemForSameDept!: number;

  @Column({ name: 'percentage_of_parent_item_for_diff_dept', type: 'numeric', nullable: false, transformer: NUM })
  PercentageOfParentItemForDiffDept!: number;

  @Column({ name: 'minimum_charge_amount', type: 'numeric', nullable: false, transformer: NUM })
  MinimumChargeAmount!: number;

  @Column({ name: 'is_pre_anaesthesia', type: 'boolean', nullable: false })
  IsPreAnaesthesia!: boolean;

  @Column({ name: 'with_pre_anaesthesia', type: 'boolean', nullable: false })
  WithPreAnaesthesia!: boolean;

  @Column({ name: 'is_op_service_item', type: 'boolean', nullable: false })
  IsOpServiceItem!: boolean;

  @Column({ name: 'is_ip_service_item', type: 'boolean', nullable: false })
  IsIpServiceItem!: boolean;

  @Column({ name: 'has_child_service_items', type: 'boolean', nullable: false })
  HasChildServiceItems!: boolean;

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

  @Column({ name: 'remarks', type: 'text', nullable: true })
  Remarks!: string | null;

}

@Entity({ name: 'bil_cfg_bill_item_price_history' })
export class BillItemPriceHistory {
  @PrimaryGeneratedColumn({ name: 'bill_item_price_history_id' })
  BillItemPriceHistoryId!: number;

  @Column({ name: 'bill_item_price_id', type: 'integer', nullable: true })
  BillItemPriceId!: number | null;

  @Column({ name: 'service_department_id', type: 'integer', nullable: true })
  ServiceDepartmentId!: number | null;

  @Column({ name: 'item_id', type: 'integer', nullable: true })
  ItemId!: number | null;

  @Column({ name: 'price', type: 'double precision', nullable: true })
  Price!: number | null;

  @Column({ name: 'created_by', type: 'integer', nullable: true })
  CreatedBy!: number | null;

  @Column({ name: 'start_date', type: 'timestamp', nullable: true })
  StartDate!: string | null;

  @Column({ name: 'end_date', type: 'timestamp', nullable: true })
  EndDate!: string | null;

}

@Entity({ name: 'bil_cfg_counter' })
export class BillingCounter {
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

  @Column({ name: 'branch_id', type: 'integer', nullable: true })
  BranchId!: number | null;

  @Column({ name: 'created_by', type: 'integer', nullable: true })
  CreatedBy!: number | null;

  @Column({ name: 'created_on', type: 'timestamp', nullable: true })
  CreatedOn!: string | null;

}

@Entity({ name: 'bil_cfg_fiscal_years' })
export class BillingFiscalYear {
  @PrimaryGeneratedColumn({ name: 'fiscal_year_id' })
  FiscalYearId!: number;

  @Column({ name: 'fiscal_year_name', type: 'text', nullable: true })
  FiscalYearName!: string | null;

  @Column({ name: 'fiscal_year_formatted', type: 'text', nullable: true })
  FiscalYearFormatted!: string | null;

  @Column({ name: 'start_year', type: 'timestamp', nullable: false })
  StartYear!: string;

  @Column({ name: 'end_year', type: 'timestamp', nullable: false })
  EndYear!: string;

  @Column({ name: 'description', type: 'text', nullable: true })
  Description!: string | null;

  @Column({ name: 'created_on', type: 'timestamp', nullable: false })
  CreatedOn!: string;

  @Column({ name: 'created_by', type: 'integer', nullable: true })
  CreatedBy!: number | null;

  @Column({ name: 'is_active', type: 'boolean', nullable: false })
  IsActive!: boolean;

}

@Entity({ name: 'bil_cfg_packages' })
export class BillingPackageModel {
  @PrimaryGeneratedColumn({ name: 'billing_package_id' })
  BillingPackageId!: number;

  @Column({ name: 'billing_package_name', type: 'text', nullable: true })
  BillingPackageName!: string | null;

  @Column({ name: 'description', type: 'text', nullable: true })
  Description!: string | null;

  @Column({ name: 'total_price', type: 'numeric', nullable: false, transformer: NUM })
  TotalPrice!: number;

  @Column({ name: 'discount_percent', type: 'numeric', nullable: false, transformer: NUM })
  DiscountPercent!: number;

  @Column({ name: 'billing_items_xml', type: 'text', nullable: true })
  BillingItemsXML!: string | null;

  @Column({ name: 'package_code', type: 'text', nullable: true })
  PackageCode!: string | null;

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

  @Column({ name: 'insurance_applicable', type: 'boolean', nullable: false })
  InsuranceApplicable!: boolean;

  @Column({ name: 'lab_type_name', type: 'text', nullable: true })
  LabTypeName!: string | null;

  @Column({ name: 'scheme_id', type: 'integer', nullable: false })
  SchemeId!: number;

  @Column({ name: 'price_category_id', type: 'integer', nullable: false })
  PriceCategoryId!: number;

  @Column({ name: 'is_editable', type: 'boolean', nullable: false })
  IsEditable!: boolean;

}

@Entity({ name: 'bil_cfg_package_service_items' })
export class BillingPackageServiceItemModel {
  @PrimaryGeneratedColumn({ name: 'package_service_item_id' })
  PackageServiceItemId!: number;

  @Column({ name: 'billing_package_id', type: 'integer', nullable: false })
  BillingPackageId!: number;

  @Column({ name: 'service_item_id', type: 'integer', nullable: false })
  ServiceItemId!: number;

  @Column({ name: 'discount_percent', type: 'numeric', nullable: false, transformer: NUM })
  DiscountPercent!: number;

  @Column({ name: 'quantity', type: 'double precision', nullable: false })
  Quantity!: number;

  @Column({ name: 'performer_id', type: 'integer', nullable: true })
  PerformerId!: number | null;

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

@Entity({ name: 'bil_cfg_price_category' })
export class PriceCategoryModel {
  @PrimaryGeneratedColumn({ name: 'price_category_id' })
  PriceCategoryId!: number;

  @Column({ name: 'price_category_name', type: 'text', nullable: true })
  PriceCategoryName!: string | null;

  @Column({ name: 'description', type: 'text', nullable: true })
  Description!: string | null;

  @Column({ name: 'is_default', type: 'boolean', nullable: false })
  IsDefault!: boolean;

  @Column({ name: 'created_on', type: 'timestamp', nullable: false })
  CreatedOn!: string;

  @Column({ name: 'created_by', type: 'integer', nullable: false })
  CreatedBy!: number;

  @Column({ name: 'is_active', type: 'boolean', nullable: false })
  IsActive!: boolean;

  @Column({ name: 'is_pharmacy_rate_different', type: 'boolean', nullable: true })
  IsPharmacyRateDifferent!: boolean | null;

  @Column({ name: 'price_category_code', type: 'text', nullable: true })
  PriceCategoryCode!: string | null;

  @Column({ name: 'show_in_registration', type: 'boolean', nullable: false })
  ShowInRegistration!: boolean;

  @Column({ name: 'show_in_admission', type: 'boolean', nullable: false })
  ShowInAdmission!: boolean;

  @Column({ name: 'display_sequence', type: 'integer', nullable: true })
  DisplaySequence!: number | null;

  @Column({ name: 'modified_by', type: 'integer', nullable: true })
  ModifiedBy!: number | null;

  @Column({ name: 'modified_on', type: 'timestamp', nullable: true })
  ModifiedOn!: string | null;

}

@Entity({ name: 'bil_cfg_scheme' })
export class BillingSchemeModel {
  @PrimaryGeneratedColumn({ name: 'scheme_id' })
  SchemeId!: number;

  @Column({ name: 'scheme_code', type: 'text', nullable: true })
  SchemeCode!: string | null;

  @Column({ name: 'scheme_name', type: 'text', nullable: true })
  SchemeName!: string | null;

  @Column({ name: 'description', type: 'text', nullable: true })
  Description!: string | null;

  @Column({ name: 'community_name', type: 'text', nullable: true })
  CommunityName!: string | null;

  @Column({ name: 'valid_from_date', type: 'timestamp', nullable: true })
  ValidFromDate!: string | null;

  @Column({ name: 'valid_to_date', type: 'timestamp', nullable: true })
  ValidToDate!: string | null;

  @Column({ name: 'is_membership_applicable', type: 'boolean', nullable: false })
  IsMembershipApplicable!: boolean;

  @Column({ name: 'is_member_number_compulsory', type: 'boolean', nullable: false })
  IsMemberNumberCompulsory!: boolean;

  @Column({ name: 'default_payment_mode', type: 'text', nullable: true })
  DefaultPaymentMode!: string | null;

  @Column({ name: 'is_credit_applicable', type: 'boolean', nullable: false })
  IsCreditApplicable!: boolean;

  @Column({ name: 'is_credit_only_scheme', type: 'boolean', nullable: false })
  IsCreditOnlyScheme!: boolean;

  @Column({ name: 'is_op_credit_limited', type: 'boolean', nullable: false })
  IsOpCreditLimited!: boolean;

  @Column({ name: 'is_ip_credit_limited', type: 'boolean', nullable: false })
  IsIpCreditLimited!: boolean;

  @Column({ name: 'is_general_credit_limited', type: 'boolean', nullable: false })
  IsGeneralCreditLimited!: boolean;

  @Column({ name: 'general_credit_limit', type: 'numeric', nullable: false, transformer: NUM })
  GeneralCreditLimit!: number;

  @Column({ name: 'op_credit_limit', type: 'numeric', nullable: false, transformer: NUM })
  OpCreditLimit!: number;

  @Column({ name: 'ip_credit_limit', type: 'numeric', nullable: false, transformer: NUM })
  IpCreditLimit!: number;

  @Column({ name: 'is_registration_credit_applicable', type: 'boolean', nullable: false })
  IsRegistrationCreditApplicable!: boolean;

  @Column({ name: 'is_op_bill_credit_applicable', type: 'boolean', nullable: false })
  IsOpBillCreditApplicable!: boolean;

  @Column({ name: 'is_ip_bill_credit_applicable', type: 'boolean', nullable: false })
  IsIpBillCreditApplicable!: boolean;

  @Column({ name: 'is_admission_credit_applicable', type: 'boolean', nullable: false })
  IsAdmissionCreditApplicable!: boolean;

  @Column({ name: 'is_op_phrm_credit_applicable', type: 'boolean', nullable: false })
  IsOpPhrmCreditApplicable!: boolean;

  @Column({ name: 'is_ip_phrm_credit_applicable', type: 'boolean', nullable: false })
  IsIpPhrmCreditApplicable!: boolean;

  @Column({ name: 'is_visit_compulsory_in_billing', type: 'boolean', nullable: false })
  IsVisitCompulsoryInBilling!: boolean;

  @Column({ name: 'is_visit_compulsory_in_pharmacy', type: 'boolean', nullable: false })
  IsVisitCompulsoryInPharmacy!: boolean;

  @Column({ name: 'is_billing_co_payment', type: 'boolean', nullable: false })
  IsBillingCoPayment!: boolean;

  @Column({ name: 'is_pharmacy_co_payment', type: 'boolean', nullable: false })
  IsPharmacyCoPayment!: boolean;

  @Column({ name: 'bill_co_pay_cash_percent', type: 'numeric', nullable: false, transformer: NUM })
  BillCoPayCashPercent!: number;

  @Column({ name: 'bill_co_pay_credit_percent', type: 'numeric', nullable: false, transformer: NUM })
  BillCoPayCreditPercent!: number;

  @Column({ name: 'pharmacy_co_pay_cash_percent', type: 'numeric', nullable: false, transformer: NUM })
  PharmacyCoPayCashPercent!: number;

  @Column({ name: 'pharmacy_co_pay_credit_percent', type: 'numeric', nullable: false, transformer: NUM })
  PharmacyCoPayCreditPercent!: number;

  @Column({ name: 'is_discount_applicable', type: 'boolean', nullable: false })
  IsDiscountApplicable!: boolean;

  @Column({ name: 'discount_percent', type: 'numeric', nullable: false, transformer: NUM })
  DiscountPercent!: number;

  @Column({ name: 'is_discount_editable', type: 'boolean', nullable: false })
  IsDiscountEditable!: boolean;

  @Column({ name: 'is_reg_discount_applicable', type: 'boolean', nullable: false })
  IsRegDiscountApplicable!: boolean;

  @Column({ name: 'reg_discount_percent', type: 'numeric', nullable: false, transformer: NUM })
  RegDiscountPercent!: number;

  @Column({ name: 'is_reg_discount_editable', type: 'boolean', nullable: false })
  IsRegDiscountEditable!: boolean;

  @Column({ name: 'is_op_bill_discount_applicable', type: 'boolean', nullable: false })
  IsOpBillDiscountApplicable!: boolean;

  @Column({ name: 'op_bill_discount_percent', type: 'numeric', nullable: false, transformer: NUM })
  OpBillDiscountPercent!: number;

  @Column({ name: 'is_op_bill_discount_editable', type: 'boolean', nullable: false })
  IsOpBillDiscountEditable!: boolean;

  @Column({ name: 'is_ip_bill_discount_applicable', type: 'boolean', nullable: false })
  IsIpBillDiscountApplicable!: boolean;

  @Column({ name: 'ip_bill_discount_percent', type: 'numeric', nullable: false, transformer: NUM })
  IpBillDiscountPercent!: number;

  @Column({ name: 'is_ip_bill_discount_editable', type: 'boolean', nullable: false })
  IsIpBillDiscountEditable!: boolean;

  @Column({ name: 'is_admission_discount_applicable', type: 'boolean', nullable: false })
  IsAdmissionDiscountApplicable!: boolean;

  @Column({ name: 'admission_discount_percent', type: 'numeric', nullable: false, transformer: NUM })
  AdmissionDiscountPercent!: number;

  @Column({ name: 'is_admission_discount_editable', type: 'boolean', nullable: false })
  IsAdmissionDiscountEditable!: boolean;

  @Column({ name: 'is_op_phrm_discount_applicable', type: 'boolean', nullable: false })
  IsOpPhrmDiscountApplicable!: boolean;

  @Column({ name: 'op_phrm_discount_percent', type: 'numeric', nullable: false, transformer: NUM })
  OpPhrmDiscountPercent!: number;

  @Column({ name: 'is_op_phrm_discount_editable', type: 'boolean', nullable: false })
  IsOpPhrmDiscountEditable!: boolean;

  @Column({ name: 'is_ip_phrm_discount_applicable', type: 'boolean', nullable: false })
  IsIpPhrmDiscountApplicable!: boolean;

  @Column({ name: 'ip_phrm_discount_percent', type: 'numeric', nullable: false, transformer: NUM })
  IpPhrmDiscountPercent!: number;

  @Column({ name: 'is_ip_phrm_discount_editable', type: 'boolean', nullable: false })
  IsIpPhrmDiscountEditable!: boolean;

  @Column({ name: 'default_credit_organization_id', type: 'integer', nullable: true })
  DefaultCreditOrganizationId!: number | null;

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

  @Column({ name: 'default_price_category_id', type: 'integer', nullable: false })
  DefaultPriceCategoryId!: number;

  @Column({ name: 'api_integration_name', type: 'text', nullable: true })
  ApiIntegrationName!: string | null;

  @Column({ name: 'field_setting_param_name', type: 'text', nullable: true })
  FieldSettingParamName!: string | null;

  @Column({ name: 'is_system_default', type: 'boolean', nullable: false })
  IsSystemDefault!: boolean;

  @Column({ name: 'reg_sticker_group_code', type: 'text', nullable: true })
  RegStickerGroupCode!: string | null;

  @Column({ name: 'has_sub_scheme', type: 'boolean', nullable: false })
  HasSubScheme!: boolean;

  @Column({ name: 'allow_provisional_billing', type: 'boolean', nullable: false })
  AllowProvisionalBilling!: boolean;

}

@Entity({ name: 'bil_cfg_sub_scheme' })
export class BillingSubSchemeModel {
  @PrimaryGeneratedColumn({ name: 'sub_scheme_id' })
  SubSchemeId!: number;

  @Column({ name: 'sub_scheme_name', type: 'text', nullable: true })
  SubSchemeName!: string | null;

  @Column({ name: 'scheme_id', type: 'integer', nullable: false })
  SchemeId!: number;

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

@Entity({ name: 'bil_map_price_category_service_item' })
export class BillMapPriceCategoryServiceItemModel {
  @PrimaryGeneratedColumn({ name: 'price_category_service_item_map_id' })
  PriceCategoryServiceItemMapId!: number;

  @Column({ name: 'price_category_id', type: 'integer', nullable: false })
  PriceCategoryId!: number;

  @Column({ name: 'service_item_id', type: 'integer', nullable: false })
  ServiceItemId!: number;

  @Column({ name: 'service_department_id', type: 'integer', nullable: false })
  ServiceDepartmentId!: number;

  @Column({ name: 'integration_item_id', type: 'integer', nullable: false })
  IntegrationItemId!: number;

  @Column({ name: 'price', type: 'numeric', nullable: false, transformer: NUM })
  Price!: number;

  @Column({ name: 'is_discount_applicable', type: 'boolean', nullable: false })
  IsDiscountApplicable!: boolean;

  @Column({ name: 'item_legal_code', type: 'text', nullable: true })
  ItemLegalCode!: string | null;

  @Column({ name: 'item_legal_name', type: 'text', nullable: true })
  ItemLegalName!: string | null;

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

  @Column({ name: 'is_price_change_allowed', type: 'boolean', nullable: false })
  IsPriceChangeAllowed!: boolean;

  @Column({ name: 'is_zero_price_allowed', type: 'boolean', nullable: false })
  IsZeroPriceAllowed!: boolean;

  @Column({ name: 'has_additional_billing_items', type: 'boolean', nullable: false })
  HasAdditionalBillingItems!: boolean;

}

@Entity({ name: 'bil_map_price_category_vs_scheme' })
export class BillMapPriceCategorySchemeModel {
  @PrimaryGeneratedColumn({ name: 'price_category_scheme_map_id' })
  PriceCategorySchemeMapId!: number;

  @Column({ name: 'scheme_id', type: 'integer', nullable: false })
  SchemeId!: number;

  @Column({ name: 'price_category_id', type: 'integer', nullable: false })
  PriceCategoryId!: number;

  @Column({ name: 'is_default', type: 'boolean', nullable: false })
  IsDefault!: boolean;

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

@Entity({ name: 'bil_map_reporting_item_billing_items' })
export class ReportingItemBillingItemMapping {
  @PrimaryGeneratedColumn({ name: 'rpt_item_bill_item_mapping_id' })
  RptItem_BillItemMappingId!: number;

  @Column({ name: 'reporting_items_id', type: 'integer', nullable: false })
  ReportingItemsId!: number;

  @Column({ name: 'service_item_id', type: 'integer', nullable: true })
  ServiceItemId!: number | null;

  @Column({ name: 'is_active', type: 'boolean', nullable: true })
  IsActive!: boolean | null;

}

@Entity({ name: 'bil_map_service_item_scheme_setting' })
export class BillServiceItemSchemeSettingModel {
  @PrimaryGeneratedColumn({ name: 'service_item_scheme_setting_id' })
  ServiceItemSchemeSettingId!: number;

  @Column({ name: 'scheme_id', type: 'integer', nullable: false })
  SchemeId!: number;

  @Column({ name: 'service_item_id', type: 'integer', nullable: false })
  ServiceItemId!: number;

  @Column({ name: 'reg_discount_percent', type: 'numeric', nullable: false, transformer: NUM })
  RegDiscountPercent!: number;

  @Column({ name: 'op_bill_discount_percent', type: 'numeric', nullable: false, transformer: NUM })
  OpBillDiscountPercent!: number;

  @Column({ name: 'ip_bill_discount_percent', type: 'numeric', nullable: false, transformer: NUM })
  IpBillDiscountPercent!: number;

  @Column({ name: 'admission_discount_percent', type: 'numeric', nullable: false, transformer: NUM })
  AdmissionDiscountPercent!: number;

  @Column({ name: 'is_co_payment', type: 'boolean', nullable: false })
  IsCoPayment!: boolean;

  @Column({ name: 'co_payment_cash_percent', type: 'numeric', nullable: false, transformer: NUM })
  CoPaymentCashPercent!: number;

  @Column({ name: 'co_payment_credit_percent', type: 'numeric', nullable: false, transformer: NUM })
  CoPaymentCreditPercent!: number;

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

@Entity({ name: 'bil_mst_credit_organization' })
export class CreditOrganizationModel {
  @PrimaryGeneratedColumn({ name: 'organization_id' })
  OrganizationId!: number;

  @Column({ name: 'organization_name', type: 'text', nullable: true })
  OrganizationName!: string | null;

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

  @Column({ name: 'is_default', type: 'boolean', nullable: false })
  IsDefault!: boolean;

  @Column({ name: 'is_claim_management_applicable', type: 'boolean', nullable: false })
  IsClaimManagementApplicable!: boolean;

  @Column({ name: 'is_claim_code_compulsory', type: 'boolean', nullable: false })
  IsClaimCodeCompulsory!: boolean;

  @Column({ name: 'is_claim_code_auto_generate', type: 'boolean', nullable: false })
  IsClaimCodeAutoGenerate!: boolean;

  @Column({ name: 'display_name', type: 'text', nullable: true })
  DisplayName!: string | null;

  @Column({ name: 'credit_organization_code', type: 'text', nullable: true })
  CreditOrganizationCode!: string | null;

}

@Entity({ name: 'bil_mst_deposit_head' })
export class DepositHeadModel {
  @PrimaryGeneratedColumn({ name: 'deposit_head_id' })
  DepositHeadId!: number;

  @Column({ name: 'deposit_head_code', type: 'text', nullable: true })
  DepositHeadCode!: string | null;

  @Column({ name: 'deposit_head_name', type: 'text', nullable: true })
  DepositHeadName!: string | null;

  @Column({ name: 'is_default', type: 'boolean', nullable: false })
  IsDefault!: boolean;

  @Column({ name: 'description', type: 'text', nullable: true })
  Description!: string | null;

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

@Entity({ name: 'bil_mst_service_category' })
export class BillServiceCategoryModel {
  @PrimaryGeneratedColumn({ name: 'service_category_id' })
  ServiceCategoryId!: number;

  @Column({ name: 'service_category_code', type: 'text', nullable: true })
  ServiceCategoryCode!: string | null;

  @Column({ name: 'service_category_name', type: 'text', nullable: true })
  ServiceCategoryName!: string | null;

  @Column({ name: 'description', type: 'text', nullable: true })
  Description!: string | null;

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

@Entity({ name: 'bil_mst_service_department' })
export class ServiceDepartmentModel {
  @PrimaryGeneratedColumn({ name: 'service_department_id' })
  ServiceDepartmentId!: number;

  @Column({ name: 'service_department_name', type: 'text', nullable: true })
  ServiceDepartmentName!: string | null;

  @Column({ name: 'service_department_short_name', type: 'text', nullable: true })
  ServiceDepartmentShortName!: string | null;

  @Column({ name: 'department_id', type: 'integer', nullable: false })
  DepartmentId!: number;

  @Column({ name: 'created_by', type: 'integer', nullable: true })
  CreatedBy!: number | null;

  @Column({ name: 'created_on', type: 'timestamp', nullable: true })
  CreatedOn!: string | null;

  @Column({ name: 'modified_by', type: 'integer', nullable: true })
  ModifiedBy!: number | null;

  @Column({ name: 'modified_on', type: 'timestamp', nullable: true })
  ModifiedOn!: string | null;

  @Column({ name: 'integration_name', type: 'text', nullable: true })
  IntegrationName!: string | null;

  @Column({ name: 'is_active', type: 'boolean', nullable: true })
  IsActive!: boolean | null;

  @Column({ name: 'parent_service_department_id', type: 'integer', nullable: true })
  ParentServiceDepartmentId!: number | null;

}

@Entity({ name: 'bil_mst_service_item' })
export class BillServiceItemModel {
  @PrimaryGeneratedColumn({ name: 'service_item_id' })
  ServiceItemId!: number;

  @Column({ name: 'service_department_id', type: 'integer', nullable: false })
  ServiceDepartmentId!: number;

  @Column({ name: 'integration_item_id', type: 'integer', nullable: false })
  IntegrationItemId!: number;

  @Column({ name: 'integration_name', type: 'text', nullable: true })
  IntegrationName!: string | null;

  @Column({ name: 'item_code', type: 'text', nullable: true })
  ItemCode!: string | null;

  @Column({ name: 'item_name', type: 'text', nullable: true })
  ItemName!: string | null;

  @Column({ name: 'is_tax_applicable', type: 'boolean', nullable: false })
  IsTaxApplicable!: boolean;

  @Column({ name: 'description', type: 'text', nullable: true })
  Description!: string | null;

  @Column({ name: 'display_seq', type: 'integer', nullable: true })
  DisplaySeq!: number | null;

  @Column({ name: 'is_doctor_mandatory', type: 'boolean', nullable: false })
  IsDoctorMandatory!: boolean;

  @Column({ name: 'is_ot', type: 'boolean', nullable: false })
  IsOT!: boolean;

  @Column({ name: 'is_proc', type: 'boolean', nullable: false })
  IsProc!: boolean;

  @Column({ name: 'service_category_id', type: 'integer', nullable: true })
  ServiceCategoryId!: number | null;

  @Column({ name: 'allow_multiple_qty', type: 'boolean', nullable: false })
  AllowMultipleQty!: boolean;

  @Column({ name: 'default_doctor_list', type: 'text', nullable: true })
  DefaultDoctorList!: string | null;

  @Column({ name: 'is_valid_for_reporting', type: 'boolean', nullable: false })
  IsValidForReporting!: boolean;

  @Column({ name: 'is_er_lab_applicable', type: 'boolean', nullable: false })
  IsErLabApplicable!: boolean;

  @Column({ name: 'created_by', type: 'integer', nullable: false })
  CreatedBy!: number;

  @Column({ name: 'created_on', type: 'timestamp', nullable: false })
  CreatedOn!: string;

  @Column({ name: 'modified_on', type: 'timestamp', nullable: true })
  ModifiedOn!: string | null;

  @Column({ name: 'modified_by', type: 'integer', nullable: true })
  ModifiedBy!: number | null;

  @Column({ name: 'is_active', type: 'boolean', nullable: false })
  IsActive!: boolean;

  @Column({ name: 'is_incentive_applicable', type: 'boolean', nullable: false })
  IsIncentiveApplicable!: boolean;

}

@Entity({ name: 'bil_sync_billing_accounting' })
export class SyncBillingAccountingModel {
  @PrimaryGeneratedColumn({ name: 'billing_accounting_sync_id' })
  BillingAccountingSyncId!: number;

  @Column({ name: 'reference_id', type: 'integer', nullable: false })
  ReferenceId!: number;

  @Column({ name: 'reference_model_name', type: 'text', nullable: true })
  ReferenceModelName!: string | null;

  @Column({ name: 'service_department_id', type: 'integer', nullable: true })
  ServiceDepartmentId!: number | null;

  @Column({ name: 'item_id', type: 'integer', nullable: false })
  ItemId!: number;

  @Column({ name: 'income_ledger_name', type: 'text', nullable: true })
  IncomeLedgerName!: string | null;

  @Column({ name: 'patient_id', type: 'integer', nullable: false })
  PatientId!: number;

  @Column({ name: 'transaction_type', type: 'text', nullable: true })
  TransactionType!: string | null;

  @Column({ name: 'payment_mode', type: 'text', nullable: true })
  PaymentMode!: string | null;

  @Column({ name: 'sub_total', type: 'numeric', nullable: false, transformer: NUM })
  SubTotal!: number;

  @Column({ name: 'tax_amount', type: 'numeric', nullable: false, transformer: NUM })
  TaxAmount!: number;

  @Column({ name: 'discount_amount', type: 'numeric', nullable: false, transformer: NUM })
  DiscountAmount!: number;

  @Column({ name: 'total_amount', type: 'numeric', nullable: false, transformer: NUM })
  TotalAmount!: number;

  @Column({ name: 'transaction_date', type: 'timestamp', nullable: false })
  TransactionDate!: string;

  @Column({ name: 'created_on', type: 'timestamp', nullable: false })
  CreatedOn!: string;

  @Column({ name: 'created_by', type: 'integer', nullable: false })
  CreatedBy!: number;

  @Column({ name: 'is_transfered_to_acc', type: 'boolean', nullable: true })
  IsTransferedToAcc!: boolean | null;

  @Column({ name: 'settlement_discount_amount', type: 'numeric', nullable: false, transformer: NUM })
  SettlementDiscountAmount!: number;

}

@Entity({ name: 'bil_txn_billing_transaction' })
export class BillingTransactionModel {
  @PrimaryGeneratedColumn({ name: 'billing_transaction_id' })
  BillingTransactionId!: number;

  @Column({ name: 'patient_id', type: 'integer', nullable: false })
  PatientId!: number;

  @Column({ name: 'patient_visit_id', type: 'integer', nullable: true })
  PatientVisitId!: number | null;

  @Column({ name: 'counter_id', type: 'integer', nullable: false })
  CounterId!: number;

  @Column({ name: 'paid_date', type: 'timestamp', nullable: true })
  PaidDate!: string | null;

  @Column({ name: 'transaction_type', type: 'text', nullable: true })
  TransactionType!: string | null;

  @Column({ name: 'total_quantity', type: 'double precision', nullable: false })
  TotalQuantity!: number;

  @Column({ name: 'sub_total', type: 'double precision', nullable: false })
  SubTotal!: number;

  @Column({ name: 'discount_percent', type: 'double precision', nullable: false })
  DiscountPercent!: number;

  @Column({ name: 'discount_amount', type: 'double precision', nullable: false })
  DiscountAmount!: number;

  @Column({ name: 'tax_total', type: 'double precision', nullable: false })
  TaxTotal!: number;

  @Column({ name: 'total_amount', type: 'double precision', nullable: false })
  TotalAmount!: number;

  @Column({ name: 'paid_amount', type: 'double precision', nullable: false })
  PaidAmount!: number;

  @Column({ name: 'deposit_amount', type: 'double precision', nullable: false })
  DepositAmount!: number;

  @Column({ name: 'deposit_available', type: 'double precision', nullable: false })
  DepositAvailable!: number;

  @Column({ name: 'deposit_used', type: 'double precision', nullable: false })
  DepositUsed!: number;

  @Column({ name: 'deposit_return_amount', type: 'double precision', nullable: false })
  DepositReturnAmount!: number;

  @Column({ name: 'deposit_balance', type: 'double precision', nullable: false })
  DepositBalance!: number;

  @Column({ name: 'remarks', type: 'text', nullable: true })
  Remarks!: string | null;

  @Column({ name: 'tender', type: 'double precision', nullable: false })
  Tender!: number;

  @Column({ name: 'change', type: 'double precision', nullable: false })
  Change!: number;

  @Column({ name: 'created_by', type: 'integer', nullable: false })
  CreatedBy!: number;

  @Column({ name: 'created_on', type: 'timestamp', nullable: false })
  CreatedOn!: string;

  @Column({ name: 'print_count', type: 'integer', nullable: false })
  PrintCount!: number;

  @Column({ name: 'payment_mode', type: 'text', nullable: true })
  PaymentMode!: string | null;

  @Column({ name: 'payment_details', type: 'text', nullable: true })
  PaymentDetails!: string | null;

  @Column({ name: 'bill_status', type: 'text', nullable: true })
  BillStatus!: string | null;

  @Column({ name: 'fiscal_year_id', type: 'integer', nullable: false })
  FiscalYearId!: number;

  @Column({ name: 'invoice_no', type: 'integer', nullable: false })
  InvoiceNo!: number;

  @Column({ name: 'return_status', type: 'boolean', nullable: true })
  ReturnStatus!: boolean | null;

  @Column({ name: 'tax_id', type: 'integer', nullable: true })
  TaxId!: number | null;

  @Column({ name: 'invoice_code', type: 'text', nullable: true })
  InvoiceCode!: string | null;

  @Column({ name: 'taxable_amount', type: 'double precision', nullable: false })
  TaxableAmount!: number;

  @Column({ name: 'is_remote_synced', type: 'boolean', nullable: false })
  IsRemoteSynced!: boolean;

  @Column({ name: 'is_realtime', type: 'boolean', nullable: false })
  IsRealtime!: boolean;

  @Column({ name: 'settlement_id', type: 'integer', nullable: true })
  SettlementId!: number | null;

  @Column({ name: 'non_taxable_amount', type: 'double precision', nullable: false })
  NonTaxableAmount!: number;

  @Column({ name: 'payment_received_by', type: 'integer', nullable: true })
  PaymentReceivedBy!: number | null;

  @Column({ name: 'paid_counter_id', type: 'integer', nullable: true })
  PaidCounterId!: number | null;

  @Column({ name: 'package_id', type: 'integer', nullable: true })
  PackageId!: number | null;

  @Column({ name: 'package_name', type: 'text', nullable: true })
  PackageName!: string | null;

  @Column({ name: 'is_insurance_billing', type: 'boolean', nullable: false })
  IsInsuranceBilling!: boolean;

  @Column({ name: 'is_insurance_claimed', type: 'boolean', nullable: false })
  IsInsuranceClaimed!: boolean;

  @Column({ name: 'insurance_claimed_date', type: 'timestamp', nullable: true })
  InsuranceClaimedDate!: string | null;

  @Column({ name: 'insurance_provider_id', type: 'integer', nullable: true })
  InsuranceProviderId!: number | null;

  @Column({ name: 'exchange_rate', type: 'double precision', nullable: true })
  ExchangeRate!: number | null;

  @Column({ name: 'organization_id', type: 'integer', nullable: true })
  OrganizationId!: number | null;

  @Column({ name: 'ins_transaction_date', type: 'timestamp', nullable: true })
  InsTransactionDate!: string | null;

  @Column({ name: 'printed_on', type: 'timestamp', nullable: true })
  PrintedOn!: string | null;

  @Column({ name: 'printed_by', type: 'integer', nullable: true })
  PrintedBy!: number | null;

  @Column({ name: 'partial_return_txn_id', type: 'integer', nullable: true })
  PartialReturnTxnId!: number | null;

  @Column({ name: 'adjustment_total_amount', type: 'numeric', nullable: true, transformer: NUM })
  AdjustmentTotalAmount!: number | null;

  @Column({ name: 'invoice_type', type: 'text', nullable: true })
  InvoiceType!: string | null;

  @Column({ name: 'lab_type_name', type: 'text', nullable: true })
  LabTypeName!: string | null;

  @Column({ name: 'claim_code', type: 'bigint', nullable: true, transformer: NUM })
  ClaimCode!: number | null;

  @Column({ name: 'received_amount', type: 'numeric', nullable: false, transformer: NUM })
  ReceivedAmount!: number;

  @Column({ name: 'scheme_id', type: 'integer', nullable: false })
  SchemeId!: number;

  @Column({ name: 'other_currency_detail', type: 'text', nullable: true })
  OtherCurrencyDetail!: string | null;

}

@Entity({ name: 'bil_txn_billing_transaction_items' })
export class BillingTransactionItemModel {
  @PrimaryGeneratedColumn({ name: 'billing_transaction_item_id' })
  BillingTransactionItemId!: number;

  @Column({ name: 'billing_transaction_id', type: 'integer', nullable: true })
  BillingTransactionId!: number | null;

  @Column({ name: 'patient_id', type: 'integer', nullable: false })
  PatientId!: number;

  @Column({ name: 'performer_id', type: 'integer', nullable: true })
  PerformerId!: number | null;

  @Column({ name: 'performer_name', type: 'text', nullable: true })
  PerformerName!: string | null;

  @Column({ name: 'service_department_id', type: 'integer', nullable: false })
  ServiceDepartmentId!: number;

  @Column({ name: 'service_department_name', type: 'text', nullable: true })
  ServiceDepartmentName!: string | null;

  @Column({ name: 'service_item_id', type: 'integer', nullable: false })
  ServiceItemId!: number;

  @Column({ name: 'price_category_id', type: 'integer', nullable: false })
  PriceCategoryId!: number;

  @Column({ name: 'item_code', type: 'text', nullable: true })
  ItemCode!: string | null;

  @Column({ name: 'integration_item_id', type: 'integer', nullable: true })
  IntegrationItemId!: number | null;

  @Column({ name: 'procedure_code', type: 'text', nullable: true })
  ProcedureCode!: string | null;

  @Column({ name: 'item_id', type: 'integer', nullable: false })
  ItemId!: number;

  @Column({ name: 'item_name', type: 'text', nullable: true })
  ItemName!: string | null;

  @Column({ name: 'price', type: 'double precision', nullable: false })
  Price!: number;

  @Column({ name: 'quantity', type: 'double precision', nullable: false })
  Quantity!: number;

  @Column({ name: 'sub_total', type: 'double precision', nullable: false })
  SubTotal!: number;

  @Column({ name: 'discount_percent', type: 'double precision', nullable: false })
  DiscountPercent!: number;

  @Column({ name: 'discount_percent_agg', type: 'double precision', nullable: false })
  DiscountPercentAgg!: number;

  @Column({ name: 'discount_amount', type: 'double precision', nullable: false })
  DiscountAmount!: number;

  @Column({ name: 'tax', type: 'double precision', nullable: false })
  Tax!: number;

  @Column({ name: 'total_amount', type: 'double precision', nullable: false })
  TotalAmount!: number;

  @Column({ name: 'bill_status', type: 'text', nullable: true })
  BillStatus!: string | null;

  @Column({ name: 'requisition_id', type: 'bigint', nullable: true, transformer: NUM })
  RequisitionId!: number | null;

  @Column({ name: 'requisition_date', type: 'timestamp', nullable: true })
  RequisitionDate!: string | null;

  @Column({ name: 'counter_day', type: 'timestamp', nullable: true })
  CounterDay!: string | null;

  @Column({ name: 'counter_id', type: 'integer', nullable: false })
  CounterId!: number;

  @Column({ name: 'paid_date', type: 'timestamp', nullable: true })
  PaidDate!: string | null;

  @Column({ name: 'return_status', type: 'boolean', nullable: true })
  ReturnStatus!: boolean | null;

  @Column({ name: 'return_quantity', type: 'double precision', nullable: true })
  ReturnQuantity!: number | null;

  @Column({ name: 'created_by', type: 'integer', nullable: false })
  CreatedBy!: number;

  @Column({ name: 'created_on', type: 'timestamp', nullable: false })
  CreatedOn!: string;

  @Column({ name: 'remarks', type: 'text', nullable: true })
  Remarks!: string | null;

  @Column({ name: 'cancel_remarks', type: 'text', nullable: true })
  CancelRemarks!: string | null;

  @Column({ name: 'tax_percent', type: 'numeric', nullable: false, transformer: NUM })
  TaxPercent!: number;

  @Column({ name: 'cancelled_on', type: 'timestamp', nullable: true })
  CancelledOn!: string | null;

  @Column({ name: 'cancelled_by', type: 'integer', nullable: true })
  CancelledBy!: number | null;

  @Column({ name: 'prescriber_id', type: 'integer', nullable: true })
  PrescriberId!: number | null;

  @Column({ name: 'patient_visit_id', type: 'integer', nullable: true })
  PatientVisitId!: number | null;

  @Column({ name: 'billing_package_id', type: 'integer', nullable: true })
  BillingPackageId!: number | null;

  @Column({ name: 'taxable_amount', type: 'double precision', nullable: false })
  TaxableAmount!: number;

  @Column({ name: 'non_taxable_amount', type: 'numeric', nullable: false, transformer: NUM })
  NonTaxableAmount!: number;

  @Column({ name: 'payment_received_by', type: 'integer', nullable: true })
  PaymentReceivedBy!: number | null;

  @Column({ name: 'paid_counter_id', type: 'integer', nullable: true })
  PaidCounterId!: number | null;

  @Column({ name: 'billing_type', type: 'text', nullable: true })
  BillingType!: string | null;

  @Column({ name: 'requesting_dept_id', type: 'integer', nullable: true })
  RequestingDeptId!: number | null;

  @Column({ name: 'modified_by', type: 'integer', nullable: true })
  ModifiedBy!: number | null;

  @Column({ name: 'modified_on', type: 'timestamp', nullable: true })
  ModifiedOn!: string | null;

  @Column({ name: 'is_co_payment', type: 'boolean', nullable: false })
  IsCoPayment!: boolean;

  @Column({ name: 'co_payment_cash_amount', type: 'numeric', nullable: false, transformer: NUM })
  CoPaymentCashAmount!: number;

  @Column({ name: 'co_payment_credit_amount', type: 'numeric', nullable: false, transformer: NUM })
  CoPaymentCreditAmount!: number;

  @Column({ name: 'is_auto_billing_item', type: 'boolean', nullable: true })
  IsAutoBillingItem!: boolean | null;

  @Column({ name: 'is_auto_calculation_stop', type: 'boolean', nullable: true })
  IsAutoCalculationStop!: boolean | null;

  @Column({ name: 'patient_insurance_package_id', type: 'integer', nullable: true })
  PatientInsurancePackageId!: number | null;

  @Column({ name: 'visit_type', type: 'text', nullable: true })
  VisitType!: string | null;

  @Column({ name: 'price_category', type: 'text', nullable: true })
  PriceCategory!: string | null;

  @Column({ name: 'provisional_receipt_no', type: 'integer', nullable: true })
  ProvisionalReceiptNo!: number | null;

  @Column({ name: 'provisional_fiscal_year_id', type: 'integer', nullable: true })
  ProvisionalFiscalYearId!: number | null;

  @Column({ name: 'is_insurance', type: 'boolean', nullable: false })
  IsInsurance!: boolean;

  @Column({ name: 'discount_scheme_id', type: 'integer', nullable: false })
  DiscountSchemeId!: number;

  @Column({ name: 'order_status', type: 'text', nullable: true })
  OrderStatus!: string | null;

  @Column({ name: 'lab_type_name', type: 'text', nullable: true })
  LabTypeName!: string | null;

  @Column({ name: 'referred_by_id', type: 'integer', nullable: true })
  ReferredById!: number | null;

  @Column({ name: 'discharge_statement_id', type: 'integer', nullable: true })
  DischargeStatementId!: number | null;

  @Column({ name: 'is_provisional_discharge', type: 'boolean', nullable: false })
  IsProvisionalDischarge!: boolean;

}

@Entity({ name: 'bil_txn_cash_handover' })
export class BillingHandoverTransactionModel {
  @PrimaryGeneratedColumn({ name: 'handover_txn_id' })
  HandoverTxnId!: number;

  @Column({ name: 'handover_by_emp_id', type: 'integer', nullable: true })
  HandoverByEmpId!: number | null;

  @Column({ name: 'handover_to_emp_id', type: 'integer', nullable: true })
  HandoverToEmpId!: number | null;

  @Column({ name: 'counter_id', type: 'integer', nullable: true })
  CounterId!: number | null;

  @Column({ name: 'handover_type', type: 'text', nullable: true })
  HandoverType!: string | null;

  @Column({ name: 'bank_name', type: 'text', nullable: true })
  BankName!: string | null;

  @Column({ name: 'voucher_number', type: 'text', nullable: true })
  VoucherNumber!: string | null;

  @Column({ name: 'voucher_date', type: 'timestamp', nullable: true })
  VoucherDate!: string | null;

  @Column({ name: 'handover_amount', type: 'double precision', nullable: true })
  HandoverAmount!: number | null;

  @Column({ name: 'due_amount', type: 'double precision', nullable: true })
  DueAmount!: number | null;

  @Column({ name: 'handover_remarks', type: 'text', nullable: true })
  HandoverRemarks!: string | null;

  @Column({ name: 'received_by_id', type: 'integer', nullable: true })
  ReceivedById!: number | null;

  @Column({ name: 'received_on', type: 'timestamp', nullable: true })
  ReceivedOn!: string | null;

  @Column({ name: 'receive_remarks', type: 'text', nullable: true })
  ReceiveRemarks!: string | null;

  @Column({ name: 'created_by', type: 'integer', nullable: true })
  CreatedBy!: number | null;

  @Column({ name: 'created_on', type: 'timestamp', nullable: true })
  CreatedOn!: string | null;

  @Column({ name: 'is_active', type: 'boolean', nullable: false })
  IsActive!: boolean;

  @Column({ name: 'handover_status', type: 'text', nullable: true })
  HandoverStatus!: string | null;

}

@Entity({ name: 'bil_txn_credit_bill_item_status' })
export class BillingTransactionCreditBillItemStatusModel {
  @PrimaryGeneratedColumn({ name: 'billing_credit_bill_item_status_id' })
  BillingCreditBillItemStatusId!: number;

  @Column({ name: 'billing_credit_bill_status_id', type: 'integer', nullable: false })
  BillingCreditBillStatusId!: number;

  @Column({ name: 'billing_transaction_id', type: 'integer', nullable: false })
  BillingTransactionId!: number;

  @Column({ name: 'billing_transaction_item_id', type: 'integer', nullable: false })
  BillingTransactionItemId!: number;

  @Column({ name: 'service_department_id', type: 'integer', nullable: false })
  ServiceDepartmentId!: number;

  @Column({ name: 'service_item_id', type: 'integer', nullable: false })
  ServiceItemId!: number;

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

@Entity({ name: 'bil_txn_credit_bill_status' })
export class BillingTransactionCreditBillStatusModel {
  @PrimaryGeneratedColumn({ name: 'billing_credit_bill_status_id' })
  BillingCreditBillStatusId!: number;

  @Column({ name: 'fiscal_year_id', type: 'integer', nullable: false })
  FiscalYearId!: number;

  @Column({ name: 'billing_transaction_id', type: 'integer', nullable: false })
  BillingTransactionId!: number;

  @Column({ name: 'invoice_no_formatted', type: 'text', nullable: true })
  InvoiceNoFormatted!: string | null;

  @Column({ name: 'invoice_date', type: 'timestamp', nullable: false })
  InvoiceDate!: string;

  @Column({ name: 'patient_visit_id', type: 'integer', nullable: false })
  PatientVisitId!: number;

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

  @Column({ name: 'created_on', type: 'timestamp', nullable: false })
  CreatedOn!: string;

  @Column({ name: 'created_by', type: 'integer', nullable: false })
  CreatedBy!: number;

  @Column({ name: 'modified_on', type: 'timestamp', nullable: true })
  ModifiedOn!: string | null;

  @Column({ name: 'modified_by', type: 'integer', nullable: true })
  ModifiedBy!: number | null;

}

@Entity({ name: 'bil_txn_deposit' })
export class BillingDepositModel {
  @PrimaryGeneratedColumn({ name: 'deposit_id' })
  DepositId!: number;

  @Column({ name: 'patient_visit_id', type: 'integer', nullable: true })
  PatientVisitId!: number | null;

  @Column({ name: 'patient_id', type: 'integer', nullable: true })
  PatientId!: number | null;

  @Column({ name: 'billing_transaction_id', type: 'integer', nullable: true })
  BillingTransactionId!: number | null;

  @Column({ name: 'transaction_type', type: 'text', nullable: true })
  TransactionType!: string | null;

  @Column({ name: 'in_amount', type: 'numeric', nullable: false, transformer: NUM })
  InAmount!: number;

  @Column({ name: 'out_amount', type: 'numeric', nullable: false, transformer: NUM })
  OutAmount!: number;

  @Column({ name: 'remarks', type: 'text', nullable: true })
  Remarks!: string | null;

  @Column({ name: 'deposit_head_id', type: 'integer', nullable: false })
  DepositHeadId!: number;

  @Column({ name: 'credit_organization_id', type: 'integer', nullable: true })
  CreditOrganizationId!: number | null;

  @Column({ name: 'module_name', type: 'text', nullable: true })
  ModuleName!: string | null;

  @Column({ name: 'organization_or_patient', type: 'text', nullable: true })
  OrganizationOrPatient!: string | null;

  @Column({ name: 'created_by', type: 'integer', nullable: false })
  CreatedBy!: number;

  @Column({ name: 'created_on', type: 'timestamp', nullable: false })
  CreatedOn!: string;

  @Column({ name: 'fiscal_year_id', type: 'integer', nullable: true })
  FiscalYearId!: number | null;

  @Column({ name: 'receipt_no', type: 'integer', nullable: true })
  ReceiptNo!: number | null;

  @Column({ name: 'counter_id', type: 'integer', nullable: false })
  CounterId!: number;

  @Column({ name: 'print_count', type: 'integer', nullable: true })
  PrintCount!: number | null;

  @Column({ name: 'payment_mode', type: 'text', nullable: true })
  PaymentMode!: string | null;

  @Column({ name: 'payment_details', type: 'text', nullable: true })
  PaymentDetails!: string | null;

  @Column({ name: 'visit_type', type: 'text', nullable: true })
  VisitType!: string | null;

  @Column({ name: 'settlement_id', type: 'integer', nullable: true })
  SettlementId!: number | null;

  @Column({ name: 'deposit_balance', type: 'numeric', nullable: false, transformer: NUM })
  DepositBalance!: number;

  @Column({ name: 'is_active', type: 'boolean', nullable: false })
  IsActive!: boolean;

  @Column({ name: 'is_transfer_transaction', type: 'boolean', nullable: true })
  IsTransferTransaction!: boolean | null;

  @Column({ name: 'modified_remarks', type: 'text', nullable: true })
  ModifiedRemarks!: string | null;

  @Column({ name: 'modified_on', type: 'timestamp', nullable: true })
  ModifiedOn!: string | null;

  @Column({ name: 'modified_by', type: 'integer', nullable: true })
  ModifiedBy!: number | null;

  @Column({ name: 'care_of', type: 'text', nullable: true })
  CareOf!: string | null;

  @Column({ name: 'printed_on', type: 'timestamp', nullable: true })
  PrintedOn!: string | null;

  @Column({ name: 'printed_by', type: 'integer', nullable: true })
  PrintedBy!: number | null;

  @Column({ name: 'is_deposit_refunded_using_deposit_receipt_no', type: 'boolean', nullable: false })
  IsDepositRefundedUsingDepositReceiptNo!: boolean;

}

@Entity({ name: 'bil_txn_discharge_statement' })
export class DischargeStatementModel {
  @PrimaryGeneratedColumn({ name: 'discharge_statement_id' })
  DischargeStatementId!: number;

  @Column({ name: 'fiscal_year_id', type: 'integer', nullable: false })
  FiscalYearId!: number;

  @Column({ name: 'statement_date', type: 'timestamp', nullable: false })
  StatementDate!: string;

  @Column({ name: 'statement_time', type: 'interval', nullable: false })
  StatementTime!: string;

  @Column({ name: 'statement_no', type: 'integer', nullable: false })
  StatementNo!: number;

  @Column({ name: 'patient_id', type: 'integer', nullable: false })
  PatientId!: number;

  @Column({ name: 'patient_visit_id', type: 'integer', nullable: false })
  PatientVisitId!: number;

  @Column({ name: 'print_count', type: 'integer', nullable: false })
  PrintCount!: number;

  @Column({ name: 'printed_by', type: 'integer', nullable: false })
  PrintedBy!: number;

  @Column({ name: 'printed_on', type: 'timestamp', nullable: false })
  PrintedOn!: string;

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

  @Column({ name: 'is_discharge_cancel', type: 'boolean', nullable: false })
  IsDischargeCancel!: boolean;

}

@Entity({ name: 'bil_txn_invoice_return' })
export class BillInvoiceReturnModel {
  @PrimaryGeneratedColumn({ name: 'bill_return_id' })
  BillReturnId!: number;

  @Column({ name: 'credit_note_number', type: 'integer', nullable: false })
  CreditNoteNumber!: number;

  @Column({ name: 'ref_invoice_num', type: 'integer', nullable: false })
  RefInvoiceNum!: number;

  @Column({ name: 'patient_id', type: 'integer', nullable: false })
  PatientId!: number;

  @Column({ name: 'fiscal_year', type: 'text', nullable: true })
  FiscalYear!: string | null;

  @Column({ name: 'fiscal_year_id', type: 'integer', nullable: false })
  FiscalYearId!: number;

  @Column({ name: 'billing_transaction_id', type: 'integer', nullable: false })
  BillingTransactionId!: number;

  @Column({ name: 'sub_total', type: 'double precision', nullable: false })
  SubTotal!: number;

  @Column({ name: 'discount_amount', type: 'double precision', nullable: false })
  DiscountAmount!: number;

  @Column({ name: 'taxable_amount', type: 'double precision', nullable: false })
  TaxableAmount!: number;

  @Column({ name: 'tax_total', type: 'double precision', nullable: false })
  TaxTotal!: number;

  @Column({ name: 'total_amount', type: 'double precision', nullable: false })
  TotalAmount!: number;

  @Column({ name: 'remarks', type: 'text', nullable: true })
  Remarks!: string | null;

  @Column({ name: 'counter_id', type: 'integer', nullable: false })
  CounterId!: number;

  @Column({ name: 'created_by', type: 'integer', nullable: false })
  CreatedBy!: number;

  @Column({ name: 'created_on', type: 'timestamp', nullable: false })
  CreatedOn!: string;

  @Column({ name: 'is_active', type: 'boolean', nullable: false })
  IsActive!: boolean;

  @Column({ name: 'tax_id', type: 'integer', nullable: true })
  TaxId!: number | null;

  @Column({ name: 'invoice_code', type: 'text', nullable: true })
  InvoiceCode!: string | null;

  @Column({ name: 'is_remote_synced', type: 'boolean', nullable: false })
  IsRemoteSynced!: boolean;

  @Column({ name: 'is_realtime', type: 'boolean', nullable: false })
  IsRealtime!: boolean;

  @Column({ name: 'payment_mode', type: 'text', nullable: true })
  PaymentMode!: string | null;

  @Column({ name: 'is_insurance_billing', type: 'boolean', nullable: false })
  IsInsuranceBilling!: boolean;

  @Column({ name: 'insurance_provider_id', type: 'integer', nullable: true })
  InsuranceProviderId!: number | null;

  @Column({ name: 'bill_status', type: 'text', nullable: true })
  BillStatus!: string | null;

  @Column({ name: 'settlement_id', type: 'integer', nullable: true })
  SettlementId!: number | null;

  @Column({ name: 'return_cash_amount', type: 'numeric', nullable: false, transformer: NUM })
  ReturnCashAmount!: number;

  @Column({ name: 'return_credit_amount', type: 'numeric', nullable: false, transformer: NUM })
  ReturnCreditAmount!: number;

  @Column({ name: 'scheme_id', type: 'integer', nullable: false })
  SchemeId!: number;

  @Column({ name: 'organization_id', type: 'integer', nullable: true })
  OrganizationId!: number | null;

  @Column({ name: 'claim_code', type: 'bigint', nullable: true, transformer: NUM })
  ClaimCode!: number | null;

}

@Entity({ name: 'bil_txn_invoice_return_items' })
export class BillInvoiceReturnItemsModel {
  @PrimaryGeneratedColumn({ name: 'bill_return_item_id' })
  BillReturnItemId!: number;

  @Column({ name: 'bill_return_id', type: 'integer', nullable: false })
  BillReturnId!: number;

  @Column({ name: 'billing_transaction_item_id', type: 'integer', nullable: false })
  BillingTransactionItemId!: number;

  @Column({ name: 'billing_transaction_id', type: 'integer', nullable: false })
  BillingTransactionId!: number;

  @Column({ name: 'patient_id', type: 'integer', nullable: false })
  PatientId!: number;

  @Column({ name: 'service_department_id', type: 'integer', nullable: false })
  ServiceDepartmentId!: number;

  @Column({ name: 'service_item_id', type: 'integer', nullable: false })
  ServiceItemId!: number;

  @Column({ name: 'item_name', type: 'text', nullable: true })
  ItemName!: string | null;

  @Column({ name: 'price', type: 'double precision', nullable: false })
  Price!: number;

  @Column({ name: 'ret_quantity', type: 'double precision', nullable: false })
  RetQuantity!: number;

  @Column({ name: 'ret_sub_total', type: 'double precision', nullable: false })
  RetSubTotal!: number;

  @Column({ name: 'ret_discount_amount', type: 'double precision', nullable: false })
  RetDiscountAmount!: number;

  @Column({ name: 'ret_tax_amount', type: 'double precision', nullable: false })
  RetTaxAmount!: number;

  @Column({ name: 'ret_total_amount', type: 'double precision', nullable: false })
  RetTotalAmount!: number;

  @Column({ name: 'ret_discount_percent', type: 'double precision', nullable: false })
  RetDiscountPercent!: number;

  @Column({ name: 'performer_id', type: 'integer', nullable: true })
  PerformerId!: number | null;

  @Column({ name: 'bill_status', type: 'text', nullable: true })
  BillStatus!: string | null;

  @Column({ name: 'requisition_id', type: 'bigint', nullable: true, transformer: NUM })
  RequisitionId!: number | null;

  @Column({ name: 'requisition_date', type: 'timestamp', nullable: true })
  RequisitionDate!: string | null;

  @Column({ name: 'ret_counter_id', type: 'integer', nullable: false })
  RetCounterId!: number;

  @Column({ name: 'ret_remarks', type: 'text', nullable: true })
  RetRemarks!: string | null;

  @Column({ name: 'prescriber_id', type: 'integer', nullable: true })
  PrescriberId!: number | null;

  @Column({ name: 'patient_visit_id', type: 'integer', nullable: true })
  PatientVisitId!: number | null;

  @Column({ name: 'billing_package_id', type: 'integer', nullable: true })
  BillingPackageId!: number | null;

  @Column({ name: 'created_by', type: 'integer', nullable: false })
  CreatedBy!: number;

  @Column({ name: 'created_on', type: 'timestamp', nullable: false })
  CreatedOn!: string;

  @Column({ name: 'billing_type', type: 'text', nullable: true })
  BillingType!: string | null;

  @Column({ name: 'requesting_dept_id', type: 'integer', nullable: true })
  RequestingDeptId!: number | null;

  @Column({ name: 'visit_type', type: 'text', nullable: true })
  VisitType!: string | null;

  @Column({ name: 'price_category', type: 'text', nullable: true })
  PriceCategory!: string | null;

  @Column({ name: 'price_category_id', type: 'integer', nullable: false })
  PriceCategoryId!: number;

  @Column({ name: 'patient_insurance_package_id', type: 'integer', nullable: true })
  PatientInsurancePackageId!: number | null;

  @Column({ name: 'is_insurance', type: 'boolean', nullable: false })
  IsInsurance!: boolean;

  @Column({ name: 'discount_scheme_id', type: 'integer', nullable: true })
  DiscountSchemeId!: number | null;

  @Column({ name: 'is_cash_bill_sync_to_acc', type: 'boolean', nullable: false })
  IsCashBillSyncToAcc!: boolean;

  @Column({ name: 'is_credit_bill_sync_to_acc', type: 'boolean', nullable: false })
  IsCreditBillSyncToAcc!: boolean;

  @Column({ name: 'lab_type_name', type: 'text', nullable: true })
  LabTypeName!: string | null;

}

@Entity({ name: 'bil_txn_provisional_item_return' })
export class BillingCancellationModel {
  @PrimaryGeneratedColumn({ name: 'provisional_item_return_id' })
  ProvisionalItemReturnId!: number;

  @Column({ name: 'billing_transaction_item_id', type: 'integer', nullable: false })
  BillingTransactionItemId!: number;

  @Column({ name: 'reference_provisional_receipt_no', type: 'integer', nullable: false })
  ReferenceProvisionalReceiptNo!: number;

  @Column({ name: 'cancellation_receipt_no', type: 'integer', nullable: false })
  CancellationReceiptNo!: number;

  @Column({ name: 'cancellation_fiscal_year_id', type: 'integer', nullable: false })
  CancellationFiscalYearId!: number;

  @Column({ name: 'patient_id', type: 'integer', nullable: false })
  PatientId!: number;

  @Column({ name: 'patient_visit_id', type: 'integer', nullable: false })
  PatientVisitId!: number;

  @Column({ name: 'billing_type', type: 'text', nullable: true })
  BillingType!: string | null;

  @Column({ name: 'visit_type', type: 'text', nullable: true })
  VisitType!: string | null;

  @Column({ name: 'service_item_id', type: 'integer', nullable: false })
  ServiceItemId!: number;

  @Column({ name: 'service_department_id', type: 'integer', nullable: false })
  ServiceDepartmentId!: number;

  @Column({ name: 'item_name', type: 'text', nullable: true })
  ItemName!: string | null;

  @Column({ name: 'item_code', type: 'text', nullable: true })
  ItemCode!: string | null;

  @Column({ name: 'integration_item_id', type: 'integer', nullable: false })
  IntegrationItemId!: number;

  @Column({ name: 'price', type: 'numeric', nullable: false, transformer: NUM })
  Price!: number;

  @Column({ name: 'cancelled_qty', type: 'integer', nullable: false })
  CancelledQty!: number;

  @Column({ name: 'cancelled_subtotal', type: 'numeric', nullable: false, transformer: NUM })
  CancelledSubtotal!: number;

  @Column({ name: 'cancelled_discount_percent', type: 'numeric', nullable: false, transformer: NUM })
  CancelledDiscountPercent!: number;

  @Column({ name: 'cancelled_discount_amount', type: 'numeric', nullable: false, transformer: NUM })
  CancelledDiscountAmount!: number;

  @Column({ name: 'cancelled_total_amount', type: 'numeric', nullable: false, transformer: NUM })
  CancelledTotalAmount!: number;

  @Column({ name: 'performer_id', type: 'integer', nullable: true })
  PerformerId!: number | null;

  @Column({ name: 'prescriber_id', type: 'integer', nullable: true })
  PrescriberId!: number | null;

  @Column({ name: 'cancelled_counter_id', type: 'integer', nullable: false })
  CancelledCounterId!: number;

  @Column({ name: 'cancellation_remarks', type: 'text', nullable: true })
  CancellationRemarks!: string | null;

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

}

@Entity({ name: 'bil_txn_settlements' })
export class BillSettlementModel {
  @PrimaryGeneratedColumn({ name: 'settlement_id' })
  SettlementId!: number;

  @Column({ name: 'fiscal_year_id', type: 'integer', nullable: false })
  FiscalYearId!: number;

  @Column({ name: 'settlement_receipt_no', type: 'integer', nullable: false })
  SettlementReceiptNo!: number;

  @Column({ name: 'settlement_date', type: 'timestamp', nullable: false })
  SettlementDate!: string;

  @Column({ name: 'settlement_type', type: 'text', nullable: true })
  SettlementType!: string | null;

  @Column({ name: 'patient_id', type: 'integer', nullable: false })
  PatientId!: number;

  @Column({ name: 'payable_amount', type: 'double precision', nullable: false })
  PayableAmount!: number;

  @Column({ name: 'refundable_amount', type: 'double precision', nullable: false })
  RefundableAmount!: number;

  @Column({ name: 'paid_amount', type: 'double precision', nullable: false })
  PaidAmount!: number;

  @Column({ name: 'returned_amount', type: 'double precision', nullable: false })
  ReturnedAmount!: number;

  @Column({ name: 'deposit_deducted', type: 'double precision', nullable: false })
  DepositDeducted!: number;

  @Column({ name: 'due_amount', type: 'double precision', nullable: false })
  DueAmount!: number;

  @Column({ name: 'discount_amount', type: 'double precision', nullable: false })
  DiscountAmount!: number;

  @Column({ name: 'payment_mode', type: 'text', nullable: true })
  PaymentMode!: string | null;

  @Column({ name: 'payment_details', type: 'text', nullable: true })
  PaymentDetails!: string | null;

  @Column({ name: 'counter_id', type: 'integer', nullable: false })
  CounterId!: number;

  @Column({ name: 'created_by', type: 'integer', nullable: false })
  CreatedBy!: number;

  @Column({ name: 'created_on', type: 'timestamp', nullable: false })
  CreatedOn!: string;

  @Column({ name: 'remarks', type: 'text', nullable: true })
  Remarks!: string | null;

  @Column({ name: 'print_count', type: 'integer', nullable: true })
  PrintCount!: number | null;

  @Column({ name: 'printed_on', type: 'timestamp', nullable: true })
  PrintedOn!: string | null;

  @Column({ name: 'printed_by', type: 'integer', nullable: true })
  PrintedBy!: number | null;

  @Column({ name: 'is_active', type: 'boolean', nullable: false })
  IsActive!: boolean;

  @Column({ name: 'collection_from_receivable', type: 'double precision', nullable: false })
  CollectionFromReceivable!: number;

  @Column({ name: 'discount_return_amount', type: 'double precision', nullable: false })
  DiscountReturnAmount!: number;

  @Column({ name: 'organization_id', type: 'integer', nullable: true })
  OrganizationId!: number | null;

  @Column({ name: 'store_id', type: 'integer', nullable: true })
  StoreId!: number | null;

  @Column({ name: 'module_name', type: 'text', nullable: true })
  ModuleName!: string | null;

}

@Entity({ name: 'history_billing_transaction_item' })
export class History_BillingTransactionItem {
  @PrimaryGeneratedColumn({ name: 'bill_txn_item_history_id' })
  BillTxnItemHistoryId!: number;

  @Column({ name: 'history_type', type: 'text', nullable: true })
  HistoryType!: string | null;

  @Column({ name: 'billing_transaction_item_id', type: 'integer', nullable: false })
  BillingTransactionItemId!: number;

  @Column({ name: 'billing_transaction_id', type: 'integer', nullable: true })
  BillingTransactionId!: number | null;

  @Column({ name: 'patient_id', type: 'integer', nullable: false })
  PatientId!: number;

  @Column({ name: 'patient_visit_id', type: 'integer', nullable: true })
  PatientVisitId!: number | null;

  @Column({ name: 'created_by', type: 'integer', nullable: true })
  CreatedBy!: number | null;

  @Column({ name: 'created_on', type: 'timestamp', nullable: true })
  CreatedOn!: string | null;

  @Column({ name: 'counter_id', type: 'integer', nullable: true })
  CounterId!: number | null;

  @Column({ name: 'remarks', type: 'text', nullable: true })
  Remarks!: string | null;

  @Column({ name: 'service_department_id', type: 'integer', nullable: false })
  ServiceDepartmentId!: number;

  @Column({ name: 'service_department_name', type: 'text', nullable: true })
  ServiceDepartmentName!: string | null;

  @Column({ name: 'item_id', type: 'integer', nullable: false })
  ItemId!: number;

  @Column({ name: 'item_name', type: 'text', nullable: true })
  ItemName!: string | null;

  @Column({ name: 'price', type: 'double precision', nullable: false })
  Price!: number;

  @Column({ name: 'quantity', type: 'double precision', nullable: true })
  Quantity!: number | null;

  @Column({ name: 'sub_total', type: 'double precision', nullable: true })
  SubTotal!: number | null;

  @Column({ name: 'discount_amount', type: 'double precision', nullable: true })
  DiscountAmount!: number | null;

  @Column({ name: 'taxable_amount', type: 'double precision', nullable: true })
  TaxableAmount!: number | null;

  @Column({ name: 'tax', type: 'double precision', nullable: true })
  Tax!: number | null;

  @Column({ name: 'total_amount', type: 'double precision', nullable: true })
  TotalAmount!: number | null;

  @Column({ name: 'discount_percent', type: 'double precision', nullable: true })
  DiscountPercent!: number | null;

  @Column({ name: 'discount_percent_agg', type: 'double precision', nullable: true })
  DiscountPercentAgg!: number | null;

  @Column({ name: 'provider_id', type: 'integer', nullable: true })
  ProviderId!: number | null;

  @Column({ name: 'provider_name', type: 'text', nullable: true })
  ProviderName!: string | null;

  @Column({ name: 'requisition_id', type: 'bigint', nullable: true, transformer: NUM })
  RequisitionId!: number | null;

  @Column({ name: 'counter_day', type: 'timestamp', nullable: true })
  CounterDay!: string | null;

  @Column({ name: 'tax_percent', type: 'numeric', nullable: false, transformer: NUM })
  TaxPercent!: number;

  @Column({ name: 'non_taxable_amount', type: 'numeric', nullable: false, transformer: NUM })
  NonTaxableAmount!: number;

  @Column({ name: 'patient_type', type: 'text', nullable: true })
  PatientType!: string | null;

  @Column({ name: 'requesting_dept_id', type: 'integer', nullable: true })
  RequestingDeptId!: number | null;

  @Column({ name: 'is_transferred_to_acc', type: 'boolean', nullable: true })
  IsTransferredToACC!: boolean | null;

}

@Entity({ name: 'ins_txn_patient_insurance_packages' })
export class PatientInsurancePackageTransactionModel {
  @PrimaryGeneratedColumn({ name: 'patient_insurance_package_id' })
  PatientInsurancePackageId!: number;

  @Column({ name: 'package_id', type: 'integer', nullable: false })
  PackageId!: number;

  @Column({ name: 'patient_id', type: 'integer', nullable: false })
  PatientId!: number;

  @Column({ name: 'start_date', type: 'timestamp', nullable: false })
  StartDate!: string;

  @Column({ name: 'end_date', type: 'timestamp', nullable: true })
  EndDate!: string | null;

  @Column({ name: 'is_completed', type: 'boolean', nullable: false })
  IsCompleted!: boolean;

  @Column({ name: 'created_on', type: 'timestamp', nullable: true })
  CreatedOn!: string | null;

  @Column({ name: 'modified_on', type: 'timestamp', nullable: true })
  ModifiedOn!: string | null;

  @Column({ name: 'created_by', type: 'integer', nullable: true })
  CreatedBy!: number | null;

  @Column({ name: 'modified_by', type: 'integer', nullable: true })
  ModifiedBy!: number | null;

  @Column({ name: 'is_active', type: 'boolean', nullable: false })
  IsActive!: boolean;

}

@Entity({ name: 'ird_log' })
export class IRDLogModel {
  @PrimaryGeneratedColumn({ name: 'log_id' })
  LogId!: number;

  @Column({ name: 'json_data', type: 'text', nullable: true })
  JsonData!: string | null;

  @Column({ name: 'status', type: 'text', nullable: true })
  Status!: string | null;

  @Column({ name: 'response_message', type: 'text', nullable: true })
  ResponseMessage!: string | null;

  @Column({ name: 'bill_type', type: 'text', nullable: true })
  BillType!: string | null;

  @Column({ name: 'url_info', type: 'text', nullable: true })
  UrlInfo!: string | null;

  @Column({ name: 'error_message', type: 'text', nullable: true })
  ErrorMessage!: string | null;

  @Column({ name: 'created_on', type: 'timestamp', nullable: true })
  CreatedOn!: string | null;

}

@Entity({ name: 'mst_bank' })
export class BanksModel {
  @PrimaryGeneratedColumn({ name: 'bank_id' })
  BankId!: number;

  @Column({ name: 'bank_short_name', type: 'text', nullable: true })
  BankShortName!: string | null;

  @Column({ name: 'bank_name', type: 'text', nullable: true })
  BankName!: string | null;

  @Column({ name: 'description', type: 'text', nullable: true })
  Description!: string | null;

  @Column({ name: 'is_active', type: 'boolean', nullable: true })
  IsActive!: boolean | null;

  @Column({ name: 'created_on', type: 'timestamp', nullable: true })
  CreatedOn!: string | null;

  @Column({ name: 'created_by', type: 'integer', nullable: true })
  CreatedBy!: number | null;

  @Column({ name: 'modified_on', type: 'timestamp', nullable: true })
  ModifiedOn!: string | null;

  @Column({ name: 'modified_by', type: 'integer', nullable: true })
  ModifiedBy!: number | null;

}

@Entity({ name: 'mst_currency' })
export class CurrencyModel {
  @PrimaryGeneratedColumn({ name: 'currency_id' })
  CurrencyId!: number;

  @Column({ name: 'currency_code', type: 'text', nullable: true })
  CurrencyCode!: string | null;

  @Column({ name: 'currency_name', type: 'text', nullable: true })
  CurrencyName!: string | null;

  @Column({ name: 'exchange_rate_dividend', type: 'numeric', nullable: false, transformer: NUM })
  ExchangeRateDividend!: number;

  @Column({ name: 'is_base_currency', type: 'boolean', nullable: false })
  ISBaseCurrency!: boolean;

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

@Entity({ name: 'mst_rpt_dynamic_reporting_items' })
export class ReportingItemsModel {
  @PrimaryGeneratedColumn({ name: 'reporting_items_id' })
  ReportingItemsId!: number;

  @Column({ name: 'reporting_item_name', type: 'text', nullable: true })
  ReportingItemName!: string | null;

  @Column({ name: 'dynamic_report_id', type: 'integer', nullable: true })
  DynamicReportId!: number | null;

  @Column({ name: 'rpt_count_unit', type: 'text', nullable: true })
  RptCountUnit!: string | null;

  @Column({ name: 'is_active', type: 'boolean', nullable: true })
  IsActive!: boolean | null;

  @Column({ name: 'created_by', type: 'integer', nullable: true })
  CreatedBy!: number | null;

  @Column({ name: 'created_on', type: 'timestamp', nullable: true })
  CreatedOn!: string | null;

  @Column({ name: 'modified_by', type: 'integer', nullable: true })
  ModifiedBy!: number | null;

  @Column({ name: 'modified_on', type: 'timestamp', nullable: true })
  ModifiedOn!: string | null;

}

@Entity({ name: 'mst_rpt_dynamic_report_name' })
export class DynamicReportNameModel {
  @PrimaryGeneratedColumn({ name: 'dynamic_report_id' })
  DynamicReportId!: number;

  @Column({ name: 'report_name', type: 'text', nullable: true })
  ReportName!: string | null;

  @Column({ name: 'report_code', type: 'text', nullable: true })
  ReportCode!: string | null;

  @Column({ name: 'report_description', type: 'text', nullable: true })
  ReportDescription!: string | null;

  @Column({ name: 'module', type: 'text', nullable: true })
  Module!: string | null;

  @Column({ name: 'used_in_sp_name', type: 'text', nullable: true })
  UsedIn_SPName!: string | null;

  @Column({ name: 'is_active', type: 'boolean', nullable: true })
  IsActive!: boolean | null;

  @Column({ name: 'created_by', type: 'integer', nullable: true })
  CreatedBy!: number | null;

  @Column({ name: 'created_on', type: 'timestamp', nullable: true })
  CreatedOn!: string | null;

}
