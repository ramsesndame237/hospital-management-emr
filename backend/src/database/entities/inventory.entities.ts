/* GÉNÉRÉ par tools/generate-entities.mjs depuis migration/inventory/entities.json : ne pas modifier à la main. */
import { Column, Entity, PrimaryColumn, PrimaryGeneratedColumn } from 'typeorm';
import { NUM } from '../transformers';

@Entity({ name: 'inv_asset_location_history' })
export class AssetLocationHistoryModel {
  @PrimaryGeneratedColumn({ name: 'assets_location_history_id' })
  AssetsLocationHistoryId!: number;

  @Column({ name: 'fixed_asset_stock_id', type: 'integer', nullable: false })
  FixedAssetStockId!: number;

  @Column({ name: 'old_location', type: 'text', nullable: true })
  OldLocation!: string | null;

  @Column({ name: 'old_asset_holder_id', type: 'integer', nullable: true })
  OldAssetHolderId!: number | null;

  @Column({ name: 'old_store_id', type: 'integer', nullable: false })
  OldStoreId!: number;

  @Column({ name: 'start_date', type: 'timestamp', nullable: true })
  StartDate!: string | null;

  @Column({ name: 'end_date', type: 'timestamp', nullable: true })
  EndDate!: string | null;

  @Column({ name: 'created_by', type: 'integer', nullable: true })
  CreatedBy!: number | null;

  @Column({ name: 'old_sub_store_id', type: 'integer', nullable: true })
  OldSubStoreId!: number | null;

}

@Entity({ name: 'inv_cfg_fiscal_years' })
export class InventoryFiscalYear {
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

  @Column({ name: 'created_by', type: 'integer', nullable: true })
  CreatedBy!: number | null;

  @Column({ name: 'created_on', type: 'timestamp', nullable: false })
  CreatedOn!: string;

  @Column({ name: 'is_active', type: 'boolean', nullable: false })
  IsActive!: boolean;

  @Column({ name: 'is_closed', type: 'boolean', nullable: true })
  IsClosed!: boolean | null;

  @Column({ name: 'closed_by', type: 'integer', nullable: true })
  ClosedBy!: number | null;

  @Column({ name: 'closed_on', type: 'timestamp', nullable: true })
  ClosedOn!: string | null;

}

@Entity({ name: 'inv_fiscal_year_stock' })
export class InventoryFiscalYearStock {
  @PrimaryGeneratedColumn({ name: 'fiscal_year_stock_id' })
  FiscalYearStockId!: number;

  @Column({ name: 'fiscal_year_id', type: 'integer', nullable: false })
  FiscalYearId!: number;

  @Column({ name: 'store_id', type: 'integer', nullable: false })
  StoreId!: number;

  @Column({ name: 'stock_id', type: 'integer', nullable: false })
  StockId!: number;

  @Column({ name: 'gr_item_id', type: 'integer', nullable: false })
  GRItemId!: number;

  @Column({ name: 'item_id', type: 'integer', nullable: false })
  ItemId!: number;

  @Column({ name: 'batch_no', type: 'text', nullable: true })
  BatchNo!: string | null;

  @Column({ name: 'expiry_date', type: 'timestamp', nullable: true })
  ExpiryDate!: string | null;

  @Column({ name: 'mrp', type: 'numeric', nullable: false, transformer: NUM })
  MRP!: number;

  @Column({ name: 'price', type: 'numeric', nullable: false, transformer: NUM })
  Price!: number;

  @Column({ name: 'opening_qty', type: 'double precision', nullable: true })
  OpeningQty!: number | null;

  @Column({ name: 'closing_qty', type: 'double precision', nullable: true })
  ClosingQty!: number | null;

  @Column({ name: 'created_on', type: 'timestamp', nullable: false })
  CreatedOn!: string;

  @Column({ name: 'is_active', type: 'boolean', nullable: false })
  IsActive!: boolean;

}

@Entity({ name: 'inv_map_goods_receipt_other_charges' })
export class MAP_GoodsReceipt_OtherCharges {
  @PrimaryGeneratedColumn({ name: 'id' })
  Id!: number;

  @Column({ name: 'goods_receipt_id', type: 'integer', nullable: false })
  GoodsReceiptID!: number;

  @Column({ name: 'charge_id', type: 'integer', nullable: false })
  ChargeId!: number;

  @Column({ name: 'amount', type: 'numeric', nullable: true, transformer: NUM })
  Amount!: number | null;

  @Column({ name: 'vat_percentage', type: 'numeric', nullable: true, transformer: NUM })
  VATPercentage!: number | null;

  @Column({ name: 'vat_amount', type: 'numeric', nullable: true, transformer: NUM })
  VATAmount!: number | null;

  @Column({ name: 'total_amount', type: 'numeric', nullable: true, transformer: NUM })
  TotalAmount!: number | null;

}

@Entity({ name: 'inv_map_goods_receipt_items_other_charges' })
export class MAP_GoodsReceiptItems_OtherCharges {
  @PrimaryGeneratedColumn({ name: 'id' })
  Id!: number;

  @Column({ name: 'goods_receipt_item_id', type: 'integer', nullable: false })
  GoodsReceiptItemId!: number;

  @Column({ name: 'charge_id', type: 'integer', nullable: false })
  ChargeId!: number;

  @Column({ name: 'vendor_id', type: 'integer', nullable: true })
  VendorId!: number | null;

  @Column({ name: 'amount', type: 'numeric', nullable: true, transformer: NUM })
  Amount!: number | null;

  @Column({ name: 'vat_percentage', type: 'numeric', nullable: true, transformer: NUM })
  VATPercentage!: number | null;

  @Column({ name: 'vat_amount', type: 'numeric', nullable: true, transformer: NUM })
  VATAmount!: number | null;

  @Column({ name: 'total_amount', type: 'numeric', nullable: true, transformer: NUM })
  TotalAmount!: number | null;

  @Column({ name: 'created_by', type: 'integer', nullable: true })
  CreatedBy!: number | null;

  @Column({ name: 'created_on', type: 'timestamp', nullable: true })
  CreatedOn!: string | null;

  @Column({ name: 'modified_by', type: 'integer', nullable: true })
  ModifiedBy!: number | null;

  @Column({ name: 'modified_on', type: 'timestamp', nullable: true })
  ModifiedOn!: string | null;

}

@Entity({ name: 'inv_mst_account_head' })
export class AccountHeadMasterModel {
  @PrimaryGeneratedColumn({ name: 'account_head_id' })
  AccountHeadId!: number;

  @Column({ name: 'account_head_name', type: 'text', nullable: true })
  AccountHeadName!: string | null;

  @Column({ name: 'description', type: 'text', nullable: true })
  Description!: string | null;

  @Column({ name: 'created_by', type: 'integer', nullable: true })
  CreatedBy!: number | null;

  @Column({ name: 'created_on', type: 'timestamp', nullable: true })
  CreatedOn!: string | null;

  @Column({ name: 'is_active', type: 'boolean', nullable: true })
  IsActive!: boolean | null;

}

@Entity({ name: 'inv_mst_charges' })
export class InventoryChargesMasterModel {
  @PrimaryGeneratedColumn({ name: 'charge_id' })
  ChargeId!: number;

  @Column({ name: 'charge_name', type: 'text', nullable: true })
  ChargeName!: string | null;

  @Column({ name: 'is_vat_applicable', type: 'boolean', nullable: false })
  IsVATApplicable!: boolean;

  @Column({ name: 'vat_percentage', type: 'numeric', nullable: false, transformer: NUM })
  VATPercentage!: number;

  @Column({ name: 'is_active', type: 'boolean', nullable: false })
  IsActive!: boolean;

  @Column({ name: 'is_default', type: 'boolean', nullable: false })
  IsDefault!: boolean;

  @Column({ name: 'description', type: 'text', nullable: true })
  Description!: string | null;

  @Column({ name: 'created_by', type: 'integer', nullable: false })
  CreatedBy!: number;

  @Column({ name: 'created_on', type: 'timestamp', nullable: false })
  CreatedOn!: string;

}

@Entity({ name: 'inv_mst_company' })
export class InventoryCompanyModel {
  @PrimaryGeneratedColumn({ name: 'company_id' })
  CompanyId!: number;

  @Column({ name: 'company_name', type: 'text', nullable: true })
  CompanyName!: string | null;

  @Column({ name: 'code', type: 'text', nullable: true })
  Code!: string | null;

  @Column({ name: 'contact_no', type: 'text', nullable: true })
  ContactNo!: string | null;

  @Column({ name: 'description', type: 'text', nullable: true })
  Description!: string | null;

  @Column({ name: 'contact_address', type: 'text', nullable: true })
  ContactAddress!: string | null;

  @Column({ name: 'email', type: 'text', nullable: true })
  Email!: string | null;

  @Column({ name: 'created_by', type: 'integer', nullable: true })
  CreatedBy!: number | null;

  @Column({ name: 'created_on', type: 'timestamp', nullable: true })
  CreatedOn!: string | null;

  @Column({ name: 'is_active', type: 'boolean', nullable: false })
  IsActive!: boolean;

}

@Entity({ name: 'inv_mst_currency' })
export class CurrencyMasterModel {
  @PrimaryGeneratedColumn({ name: 'currency_id' })
  CurrencyID!: number;

  @Column({ name: 'currency_code', type: 'text', nullable: true })
  CurrencyCode!: string | null;

  @Column({ name: 'description', type: 'text', nullable: true })
  Description!: string | null;

  @Column({ name: 'created_by', type: 'integer', nullable: false })
  CreatedBy!: number;

  @Column({ name: 'created_on', type: 'timestamp', nullable: false })
  CreatedOn!: string;

  @Column({ name: 'is_active', type: 'boolean', nullable: false })
  IsActive!: boolean;

}

@Entity({ name: 'inv_mst_donation' })
export class FixedAssetDonationModel {
  @PrimaryGeneratedColumn({ name: 'donation_id' })
  DonationId!: number;

  @Column({ name: 'donation', type: 'text', nullable: true })
  Donation!: string | null;

  @Column({ name: 'donation_person_name', type: 'text', nullable: true })
  DonationPersonName!: string | null;

  @Column({ name: 'donation_details', type: 'text', nullable: true })
  DonationDetails!: string | null;

  @Column({ name: 'phone_number', type: 'text', nullable: true })
  PhoneNumber!: string | null;

  @Column({ name: 'created_by', type: 'integer', nullable: true })
  CreatedBy!: number | null;

  @Column({ name: 'created_on', type: 'timestamp', nullable: true })
  CreatedOn!: string | null;

  @Column({ name: 'modified_by', type: 'integer', nullable: true })
  ModifiedBy!: number | null;

  @Column({ name: 'modified_on', type: 'timestamp', nullable: true })
  ModifiedOn!: string | null;

}

@Entity({ name: 'inv_mst_item' })
export class ItemMasterModel {
  @PrimaryGeneratedColumn({ name: 'item_id' })
  ItemId!: number;

  @Column({ name: 'code', type: 'text', nullable: true })
  Code!: string | null;

  @Column({ name: 'company_id', type: 'integer', nullable: true })
  CompanyId!: number | null;

  @Column({ name: 'item_category_id', type: 'integer', nullable: true })
  ItemCategoryId!: number | null;

  @Column({ name: 'sub_category_id', type: 'integer', nullable: true })
  SubCategoryId!: number | null;

  @Column({ name: 'packaging_type_id', type: 'integer', nullable: true })
  PackagingTypeId!: number | null;

  @Column({ name: 'unit_of_measurement_id', type: 'integer', nullable: true })
  UnitOfMeasurementId!: number | null;

  @Column({ name: 'item_name', type: 'text', nullable: true })
  ItemName!: string | null;

  @Column({ name: 'item_type', type: 'text', nullable: true })
  ItemType!: string | null;

  @Column({ name: 'description', type: 'text', nullable: true })
  Description!: string | null;

  @Column({ name: 're_order_quantity', type: 'double precision', nullable: true })
  ReOrderQuantity!: number | null;

  @Column({ name: 'is_vat_applicable', type: 'boolean', nullable: true })
  IsVATApplicable!: boolean | null;

  @Column({ name: 'vat', type: 'numeric', nullable: true, transformer: NUM })
  VAT!: number | null;

  @Column({ name: 'min_stock_quantity', type: 'double precision', nullable: true })
  MinStockQuantity!: number | null;

  @Column({ name: 'budgeted_quantity', type: 'double precision', nullable: true })
  BudgetedQuantity!: number | null;

  @Column({ name: 'standard_rate', type: 'numeric', nullable: true, transformer: NUM })
  StandardRate!: number | null;

  @Column({ name: 'unit_quantity', type: 'double precision', nullable: true })
  UnitQuantity!: number | null;

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

  @Column({ name: 'mssno', type: 'text', nullable: true })
  MSSNO!: string | null;

  @Column({ name: 'hsncode', type: 'text', nullable: true })
  HSNCODE!: string | null;

  @Column({ name: 'vendor_id', type: 'integer', nullable: true })
  VendorId!: number | null;

  @Column({ name: 'is_cssd_applicable', type: 'boolean', nullable: true })
  IsCssdApplicable!: boolean | null;

  @Column({ name: 'is_cold_storage_applicable', type: 'boolean', nullable: true })
  IsColdStorageApplicable!: boolean | null;

  @Column({ name: 'is_pat_consumption_applicable', type: 'boolean', nullable: true })
  IsPatConsumptionApplicable!: boolean | null;

  @Column({ name: 'maintenance_owner_role_id', type: 'integer', nullable: true })
  MaintenanceOwnerRoleId!: number | null;

  @Column({ name: 'register_page_number', type: 'integer', nullable: true })
  RegisterPageNumber!: number | null;

  @Column({ name: 'store_id', type: 'integer', nullable: true })
  StoreId!: number | null;

  @Column({ name: 'is_fixed_assets', type: 'boolean', nullable: true })
  IsFixedAssets!: boolean | null;

}

@Entity({ name: 'inv_mst_item_category' })
export class ItemCategoryMasterModel {
  @PrimaryGeneratedColumn({ name: 'item_category_id' })
  ItemCategoryId!: number;

  @Column({ name: 'item_category_name', type: 'text', nullable: true })
  ItemCategoryName!: string | null;

  @Column({ name: 'description', type: 'text', nullable: true })
  Description!: string | null;

  @Column({ name: 'created_by', type: 'integer', nullable: true })
  CreatedBy!: number | null;

  @Column({ name: 'created_on', type: 'timestamp', nullable: true })
  CreatedOn!: string | null;

  @Column({ name: 'is_active', type: 'boolean', nullable: false })
  IsActive!: boolean;

  @Column({ name: 'category_code', type: 'text', nullable: true })
  CategoryCode!: string | null;

}

@Entity({ name: 'inv_mst_item_sub_category' })
export class ItemSubCategoryMasterModel {
  @PrimaryGeneratedColumn({ name: 'sub_category_id' })
  SubCategoryId!: number;

  @Column({ name: 'code', type: 'text', nullable: true })
  Code!: string | null;

  @Column({ name: 'sub_category_name', type: 'text', nullable: true })
  SubCategoryName!: string | null;

  @Column({ name: 'description', type: 'text', nullable: true })
  Description!: string | null;

  @Column({ name: 'created_by', type: 'integer', nullable: true })
  CreatedBy!: number | null;

  @Column({ name: 'created_on', type: 'timestamp', nullable: true })
  CreatedOn!: string | null;

  @Column({ name: 'is_active', type: 'boolean', nullable: false })
  IsActive!: boolean;

  @Column({ name: 'is_consumable', type: 'boolean', nullable: false })
  IsConsumable!: boolean;

  @Column({ name: 'ledger_id', type: 'integer', nullable: true })
  LedgerId!: number | null;

}

@Entity({ name: 'inv_mst_packaging_type' })
export class PackagingTypeMasterModel {
  @PrimaryGeneratedColumn({ name: 'packaging_type_id' })
  PackagingTypeId!: number;

  @Column({ name: 'packaging_type_name', type: 'text', nullable: true })
  PackagingTypeName!: string | null;

  @Column({ name: 'description', type: 'text', nullable: true })
  Description!: string | null;

  @Column({ name: 'created_by', type: 'integer', nullable: false })
  CreatedBy!: number;

  @Column({ name: 'created_on', type: 'timestamp', nullable: false })
  CreatedOn!: string;

  @Column({ name: 'is_active', type: 'boolean', nullable: false })
  IsActive!: boolean;

}

@Entity({ name: 'inv_mst_stock' })
export class StockMasterModel {
  @PrimaryGeneratedColumn({ name: 'stock_id' })
  StockId!: number;

  @Column({ name: 'item_id', type: 'integer', nullable: true })
  ItemId!: number | null;

  @Column({ name: 'batch_no', type: 'text', nullable: true })
  BatchNo!: string | null;

  @Column({ name: 'expiry_date', type: 'timestamp', nullable: true })
  ExpiryDate!: string | null;

  @Column({ name: 'cost_price', type: 'numeric', nullable: false, transformer: NUM })
  CostPrice!: number;

  @Column({ name: 'mrp', type: 'numeric', nullable: false, transformer: NUM })
  MRP!: number;

  @Column({ name: 'specification', type: 'text', nullable: true })
  Specification!: string | null;

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

@Entity({ name: 'inv_mst_terms' })
export class InventoryTermsModel {
  @PrimaryGeneratedColumn({ name: 'terms_id' })
  TermsId!: number;

  @Column({ name: 'text', type: 'text', nullable: true })
  Text!: string | null;

  @Column({ name: 'type', type: 'text', nullable: true })
  Type!: string | null;

  @Column({ name: 'short_name', type: 'text', nullable: true })
  ShortName!: string | null;

  @Column({ name: 'order_by', type: 'integer', nullable: false })
  OrderBy!: number;

  @Column({ name: 'is_active', type: 'boolean', nullable: false })
  IsActive!: boolean;

  @Column({ name: 'created_by', type: 'integer', nullable: true })
  CreatedBy!: number | null;

  @Column({ name: 'created_on', type: 'timestamp', nullable: true })
  CreatedOn!: string | null;

  @Column({ name: 'terms_application_enum_id', type: 'integer', nullable: false })
  TermsApplicationEnumId!: number;

}

@Entity({ name: 'inv_mst_unit_of_measurement' })
export class UnitOfMeasurementMasterModel {
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

@Entity({ name: 'inv_mst_vendor' })
export class VendorMasterModel {
  @PrimaryGeneratedColumn({ name: 'vendor_id' })
  VendorId!: number;

  @Column({ name: 'vendor_name', type: 'text', nullable: true })
  VendorName!: string | null;

  @Column({ name: 'vendor_code', type: 'text', nullable: true })
  VendorCode!: string | null;

  @Column({ name: 'contact_person', type: 'text', nullable: true })
  ContactPerson!: string | null;

  @Column({ name: 'contact_address', type: 'text', nullable: true })
  ContactAddress!: string | null;

  @Column({ name: 'contact_no', type: 'text', nullable: true })
  ContactNo!: string | null;

  @Column({ name: 'email', type: 'text', nullable: true })
  Email!: string | null;

  @Column({ name: 'country_id', type: 'integer', nullable: true })
  CountryId!: number | null;

  @Column({ name: 'tds', type: 'double precision', nullable: false })
  Tds!: number;

  @Column({ name: 'credit_period', type: 'double precision', nullable: false })
  CreditPeriod!: number;

  @Column({ name: 'pan_no', type: 'text', nullable: true })
  PanNo!: string | null;

  @Column({ name: 'sarf_no', type: 'text', nullable: true })
  SARFNo!: string | null;

  @Column({ name: 'govt_reg_date', type: 'timestamp', nullable: true })
  GovtRegDate!: string | null;

  @Column({ name: 'created_by', type: 'integer', nullable: false })
  CreatedBy!: number;

  @Column({ name: 'created_on', type: 'timestamp', nullable: false })
  CreatedOn!: string;

  @Column({ name: 'is_active', type: 'boolean', nullable: false })
  IsActive!: boolean;

  @Column({ name: 'receive_donation', type: 'boolean', nullable: false })
  ReceiveDonation!: boolean;

  @Column({ name: 'default_currency_id', type: 'integer', nullable: true })
  DefaultCurrencyId!: number | null;

  @Column({ name: 'default_item_json', type: 'text', nullable: true })
  DefaultItemJSON!: string | null;

  @Column({ name: 'is_tds_applicable', type: 'boolean', nullable: false })
  IsTDSApplicable!: boolean;

  @Column({ name: 'company_position', type: 'text', nullable: true })
  CompanyPosition!: string | null;

  @Column({ name: 'name', type: 'text', nullable: true })
  Name!: string | null;

  @Column({ name: 'phone_number', type: 'text', nullable: true })
  PhoneNumber!: string | null;

  @Column({ name: 'company_position2', type: 'text', nullable: true })
  CompanyPosition2!: string | null;

  @Column({ name: 'name2', type: 'text', nullable: true })
  Name2!: string | null;

  @Column({ name: 'phone_number2', type: 'text', nullable: true })
  PhoneNumber2!: string | null;

  @Column({ name: 'bank_details', type: 'text', nullable: true })
  BankDetails!: string | null;

}

@Entity({ name: 'inv_quotation' })
export class Quotation {
  @PrimaryGeneratedColumn({ name: 'quotation_id' })
  QuotationId!: number;

  @Column({ name: 'req_for_quotation_id', type: 'integer', nullable: true })
  ReqForQuotationId!: number | null;

  @Column({ name: 'vendor_id', type: 'integer', nullable: false })
  VendorId!: number;

  @Column({ name: 'vendor_name', type: 'text', nullable: true })
  VendorName!: string | null;

  @Column({ name: 'created_by', type: 'integer', nullable: true })
  CreatedBy!: number | null;

  @Column({ name: 'created_on', type: 'timestamp', nullable: true })
  CreatedOn!: string | null;

  @Column({ name: 'issued_date', type: 'timestamp', nullable: true })
  IssuedDate!: string | null;

  @Column({ name: 'status', type: 'text', nullable: true })
  Status!: string | null;

  @Column({ name: 'store_id', type: 'integer', nullable: false })
  StoreId!: number;

  @Column({ name: 'rfq_group_id', type: 'integer', nullable: true })
  RFQGroupId!: number | null;

  @Column({ name: 'fiscal_year_id', type: 'integer', nullable: false })
  FiscalYearId!: number;

  @Column({ name: 'quotation_no', type: 'integer', nullable: true })
  QuotationNo!: number | null;

}

@Entity({ name: 'inv_quotation_items' })
export class QuotationItems {
  @PrimaryGeneratedColumn({ name: 'quotation_item_id' })
  QuotationItemId!: number;

  @Column({ name: 'quotation_id', type: 'integer', nullable: true })
  QuotationId!: number | null;

  @Column({ name: 'vendor_id', type: 'integer', nullable: false })
  VendorId!: number;

  @Column({ name: 'item_id', type: 'integer', nullable: false })
  ItemId!: number;

  @Column({ name: 'item_name', type: 'text', nullable: true })
  ItemName!: string | null;

  @Column({ name: 'price', type: 'numeric', nullable: true, transformer: NUM })
  Price!: number | null;

  @Column({ name: 'description', type: 'text', nullable: true })
  Description!: string | null;

  @Column({ name: 'up_loaded_on', type: 'timestamp', nullable: true })
  UpLoadedOn!: string | null;

  @Column({ name: 'up_loaded_by', type: 'integer', nullable: true })
  UpLoadedBy!: number | null;

  @Column({ name: 'modified_by', type: 'integer', nullable: true })
  ModifiedBy!: number | null;

  @Column({ name: 'modified_on', type: 'timestamp', nullable: true })
  ModifiedOn!: string | null;

}

@Entity({ name: 'inv_quotation_uploaded_files' })
export class QuotationUploadedFiles {
  @PrimaryGeneratedColumn({ name: 'quotation_uploaded_file_id' })
  QuotationUploadedFileId!: number;

  @Column({ name: 'request_for_quotation_id', type: 'integer', nullable: true })
  RequestForQuotationId!: number | null;

  @Column({ name: 'vendor_id', type: 'integer', nullable: false })
  VendorId!: number;

  @Column({ name: 'rowguid', type: 'uuid', nullable: true })
  ROWGUID!: string | null;

  @Column({ name: 'file_type', type: 'text', nullable: true })
  FileType!: string | null;

  @Column({ name: 'file_binary_data', type: 'smallint', nullable: false })
  FileBinaryData!: number;

  @Column({ name: 'file_name', type: 'text', nullable: true })
  FileName!: string | null;

  @Column({ name: 'file_no', type: 'integer', nullable: false })
  FileNo!: number;

  @Column({ name: 'file_extention', type: 'text', nullable: true })
  FileExtention!: string | null;

  @Column({ name: 'up_loaded_on', type: 'timestamp', nullable: true })
  UpLoadedOn!: string | null;

  @Column({ name: 'up_loaded_by', type: 'integer', nullable: true })
  UpLoadedBy!: number | null;

  @Column({ name: 'description', type: 'text', nullable: true })
  Description!: string | null;

}

@Entity({ name: 'inv_request_for_quotation' })
export class RequestForQuotation {
  @PrimaryGeneratedColumn({ name: 'req_for_quotation_id' })
  ReqForQuotationId!: number;

  @Column({ name: 'subject', type: 'text', nullable: true })
  Subject!: string | null;

  @Column({ name: 'description', type: 'text', nullable: true })
  Description!: string | null;

  @Column({ name: 'requested_by', type: 'text', nullable: true })
  RequestedBy!: string | null;

  @Column({ name: 'created_on', type: 'timestamp', nullable: true })
  CreatedOn!: string | null;

  @Column({ name: 'approved_by', type: 'integer', nullable: true })
  ApprovedBy!: number | null;

  @Column({ name: 'requested_on', type: 'timestamp', nullable: true })
  RequestedOn!: string | null;

  @Column({ name: 'requested_close_on', type: 'timestamp', nullable: true })
  RequestedCloseOn!: string | null;

  @Column({ name: 'status', type: 'text', nullable: true })
  Status!: string | null;

  @Column({ name: 'store_id', type: 'integer', nullable: false })
  StoreId!: number;

  @Column({ name: 'rfq_group_id', type: 'integer', nullable: true })
  RFQGroupId!: number | null;

  @Column({ name: 'fiscal_year_id', type: 'integer', nullable: false })
  FiscalYearId!: number;

  @Column({ name: 'request_for_quotation_no', type: 'integer', nullable: true })
  RequestForQuotationNo!: number | null;

}

@Entity({ name: 'inv_request_for_quotation_items' })
export class RequestForQuotationItem {
  @PrimaryGeneratedColumn({ name: 'req_for_quotation_item_id' })
  ReqForQuotationItemId!: number;

  @Column({ name: 'item_id', type: 'integer', nullable: false })
  ItemId!: number;

  @Column({ name: 'item_name', type: 'text', nullable: true })
  ItemName!: string | null;

  @Column({ name: 'req_for_quotation_id', type: 'integer', nullable: false })
  ReqForQuotationId!: number;

  @Column({ name: 'quantity', type: 'integer', nullable: false })
  Quantity!: number;

  @Column({ name: 'price', type: 'integer', nullable: false })
  Price!: number;

  @Column({ name: 'description', type: 'text', nullable: true })
  Description!: string | null;

  @Column({ name: 'created_by', type: 'integer', nullable: true })
  CreatedBy!: number | null;

  @Column({ name: 'created_on', type: 'timestamp', nullable: true })
  CreatedOn!: string | null;

}

@Entity({ name: 'inv_request_for_quotation_vendors' })
export class RequestForQuotationVendor {
  @PrimaryGeneratedColumn({ name: 'req_for_quotation_vendor_id' })
  ReqForQuotationVendorId!: number;

  @Column({ name: 'vendor_id', type: 'integer', nullable: false })
  VendorId!: number;

  @Column({ name: 'req_for_quotation_id', type: 'integer', nullable: true })
  ReqForQuotationId!: number | null;

  @Column({ name: 'created_by', type: 'integer', nullable: false })
  CreatedBy!: number;

  @Column({ name: 'created_on', type: 'timestamp', nullable: false })
  CreatedOn!: string;

}

@Entity({ name: 'inv_txn_dispatch' })
export class DispatchModel {
  @PrimaryGeneratedColumn({ name: 'dispatch_id' })
  DispatchId!: number;

  @Column({ name: 'requisition_id', type: 'integer', nullable: false })
  RequisitionId!: number;

  @Column({ name: 'fiscal_year_id', type: 'integer', nullable: false })
  FiscalYearId!: number;

  @Column({ name: 'dispatch_no', type: 'integer', nullable: false })
  DispatchNo!: number;

  @Column({ name: 'source_store_id', type: 'integer', nullable: false })
  SourceStoreId!: number;

  @Column({ name: 'target_store_id', type: 'integer', nullable: false })
  TargetStoreId!: number;

  @Column({ name: 'created_by', type: 'integer', nullable: false })
  CreatedBy!: number;

  @Column({ name: 'created_on', type: 'timestamp', nullable: false })
  CreatedOn!: string;

  @Column({ name: 'remarks', type: 'text', nullable: true })
  Remarks!: string | null;

  @Column({ name: 'req_dis_group_id', type: 'integer', nullable: true })
  ReqDisGroupId!: number | null;

  @Column({ name: 'received_by', type: 'integer', nullable: true })
  ReceivedBy!: number | null;

  @Column({ name: 'received_on', type: 'timestamp', nullable: true })
  ReceivedOn!: string | null;

  @Column({ name: 'received_remarks', type: 'text', nullable: true })
  ReceivedRemarks!: string | null;

}

@Entity({ name: 'inv_txn_dispatch_items' })
export class DispatchItemsModel {
  @PrimaryGeneratedColumn({ name: 'dispatch_items_id' })
  DispatchItemsId!: number;

  @Column({ name: 'department_id', type: 'integer', nullable: true })
  DepartmentId!: number | null;

  @Column({ name: 'requisition_id', type: 'integer', nullable: false })
  RequisitionId!: number;

  @Column({ name: 'requisition_item_id', type: 'integer', nullable: false })
  RequisitionItemId!: number;

  @Column({ name: 'dispatched_quantity', type: 'double precision', nullable: false })
  DispatchedQuantity!: number;

  @Column({ name: 'dispatched_date', type: 'timestamp', nullable: true })
  DispatchedDate!: string | null;

  @Column({ name: 'created_by', type: 'integer', nullable: true })
  CreatedBy!: number | null;

  @Column({ name: 'created_on', type: 'timestamp', nullable: true })
  CreatedOn!: string | null;

  @Column({ name: 'received_by', type: 'text', nullable: true })
  ReceivedBy!: string | null;

  @Column({ name: 'remarks', type: 'text', nullable: true })
  Remarks!: string | null;

  @Column({ name: 'item_remarks', type: 'text', nullable: true })
  ItemRemarks!: string | null;

  @Column({ name: 'item_id', type: 'integer', nullable: false })
  ItemId!: number;

  @Column({ name: 'batch_no', type: 'text', nullable: true })
  BatchNo!: string | null;

  @Column({ name: 'dispatch_id', type: 'integer', nullable: false })
  DispatchId!: number;

  @Column({ name: 'mat_issue_date', type: 'timestamp', nullable: true })
  MatIssueDate!: string | null;

  @Column({ name: 'mat_issue_to', type: 'text', nullable: true })
  MatIssueTo!: string | null;

  @Column({ name: 'source_store_id', type: 'integer', nullable: false })
  SourceStoreId!: number;

  @Column({ name: 'target_store_id', type: 'integer', nullable: false })
  TargetStoreId!: number;

  @Column({ name: 'received_by_id', type: 'integer', nullable: true })
  ReceivedById!: number | null;

  @Column({ name: 'received_on', type: 'timestamp', nullable: true })
  ReceivedOn!: string | null;

  @Column({ name: 'received_remarks', type: 'text', nullable: true })
  ReceivedRemarks!: string | null;

  @Column({ name: 'req_dis_group_id', type: 'integer', nullable: true })
  ReqDisGroupId!: number | null;

  @Column({ name: 'fiscal_year_id', type: 'integer', nullable: false })
  FiscalYearId!: number;

  @Column({ name: 'dispatch_no', type: 'integer', nullable: true })
  DispatchNo!: number | null;

  @Column({ name: 'item_category', type: 'text', nullable: true })
  ItemCategory!: string | null;

  @Column({ name: 'specification', type: 'text', nullable: true })
  Specification!: string | null;

  @Column({ name: 'cost_price', type: 'double precision', nullable: true })
  CostPrice!: number | null;

}

@Entity({ name: 'inv_txn_donation' })
export class DonationModel {
  @PrimaryGeneratedColumn({ name: 'donation_id' })
  DonationId!: number;

  @Column({ name: 'donation_no', type: 'integer', nullable: false })
  DonationNo!: number;

  @Column({ name: 'vendor_id', type: 'integer', nullable: false })
  VendorId!: number;

  @Column({ name: 'store_id', type: 'integer', nullable: false })
  StoreId!: number;

  @Column({ name: 'fiscal_year_id', type: 'integer', nullable: false })
  FiscalYearId!: number;

  @Column({ name: 'donation_reference_no', type: 'text', nullable: true })
  DonationReferenceNo!: string | null;

  @Column({ name: 'donation_reference_date', type: 'timestamp', nullable: false })
  DonationReferenceDate!: string;

  @Column({ name: 'total_amount', type: 'numeric', nullable: false, transformer: NUM })
  TotalAmount!: number;

  @Column({ name: 'remarks', type: 'text', nullable: true })
  Remarks!: string | null;

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

}

@Entity({ name: 'inv_txn_donation_items' })
export class DonationItemModel {
  @PrimaryGeneratedColumn({ name: 'donation_item_id' })
  DonationItemId!: number;

  @Column({ name: 'donation_id', type: 'integer', nullable: false })
  DonationId!: number;

  @Column({ name: 'category_name', type: 'text', nullable: true })
  CategoryName!: string | null;

  @Column({ name: 'item_id', type: 'integer', nullable: false })
  ItemId!: number;

  @Column({ name: 'specification', type: 'text', nullable: true })
  Specification!: string | null;

  @Column({ name: 'model_no', type: 'text', nullable: true })
  ModelNo!: string | null;

  @Column({ name: 'donation_quantity', type: 'double precision', nullable: false })
  DonationQuantity!: number;

  @Column({ name: 'cost_price', type: 'numeric', nullable: false, transformer: NUM })
  CostPrice!: number;

  @Column({ name: 'total_amount', type: 'numeric', nullable: false, transformer: NUM })
  TotalAmount!: number;

  @Column({ name: 'remarks', type: 'text', nullable: true })
  Remarks!: string | null;

  @Column({ name: 'created_on', type: 'timestamp', nullable: false })
  CreatedOn!: string;

  @Column({ name: 'created_by', type: 'integer', nullable: true })
  CreatedBy!: number | null;

  @Column({ name: 'stock_id', type: 'integer', nullable: false })
  StockId!: number;

  @Column({ name: 'is_active', type: 'boolean', nullable: false })
  IsActive!: boolean;

  @Column({ name: 'gr_date', type: 'timestamp', nullable: true })
  GRDate!: string | null;

}

@Entity({ name: 'inv_txn_draft_purchase_order' })
export class PurchaseOrderDraftModel {
  @PrimaryGeneratedColumn({ name: 'draft_purchase_order_id' })
  DraftPurchaseOrderId!: number;

  @Column({ name: 'draft_purchase_order_no', type: 'integer', nullable: false })
  DraftPurchaseOrderNo!: number;

  @Column({ name: 'fiscal_year_id', type: 'integer', nullable: false })
  FiscalYearId!: number;

  @Column({ name: 'vendor_id', type: 'integer', nullable: false })
  VendorId!: number;

  @Column({ name: 'status', type: 'text', nullable: true })
  Status!: string | null;

  @Column({ name: 'sub_total', type: 'numeric', nullable: false, transformer: NUM })
  SubTotal!: number;

  @Column({ name: 'discount_amount', type: 'numeric', nullable: false, transformer: NUM })
  DiscountAmount!: number;

  @Column({ name: 'vat_amount', type: 'numeric', nullable: false, transformer: NUM })
  VATAmount!: number;

  @Column({ name: 'total_amount', type: 'numeric', nullable: false, transformer: NUM })
  TotalAmount!: number;

  @Column({ name: 'created_by', type: 'integer', nullable: false })
  CreatedBy!: number;

  @Column({ name: 'created_on', type: 'timestamp', nullable: false })
  CreatedOn!: string;

  @Column({ name: 'delivery_address', type: 'text', nullable: true })
  DeliveryAddress!: string | null;

  @Column({ name: 'currency_id', type: 'integer', nullable: true })
  CurrencyId!: number | null;

  @Column({ name: 'remarks', type: 'text', nullable: true })
  Remarks!: string | null;

  @Column({ name: 'modified_by', type: 'integer', nullable: true })
  ModifiedBy!: number | null;

  @Column({ name: 'modified_on', type: 'timestamp', nullable: true })
  ModifiedOn!: string | null;

  @Column({ name: 'delivery_date', type: 'timestamp', nullable: true })
  DeliveryDate!: string | null;

  @Column({ name: 'pod_group_id', type: 'integer', nullable: true })
  PODGroupId!: number | null;

  @Column({ name: 'invoicing_address', type: 'text', nullable: true })
  InvoicingAddress!: string | null;

  @Column({ name: 'contact_person_name', type: 'text', nullable: true })
  ContactPersonName!: string | null;

  @Column({ name: 'contact_person_email', type: 'text', nullable: true })
  ContactPersonEmail!: string | null;

  @Column({ name: 'reference_no', type: 'text', nullable: true })
  ReferenceNo!: string | null;

  @Column({ name: 'is_active', type: 'boolean', nullable: false })
  IsActive!: boolean;

  @Column({ name: 'discarded_by', type: 'integer', nullable: true })
  DiscardedBy!: number | null;

  @Column({ name: 'discarded_on', type: 'timestamp', nullable: true })
  DiscardedOn!: string | null;

  @Column({ name: 'discard_remarks', type: 'text', nullable: true })
  DiscardRemarks!: string | null;

}

@Entity({ name: 'inv_txn_draft_purchase_order_item' })
export class PurchaseOrderDraftItemModel {
  @PrimaryGeneratedColumn({ name: 'draft_purchase_order_item_id' })
  DraftPurchaseOrderItemId!: number;

  @Column({ name: 'draft_purchase_order_id', type: 'integer', nullable: false })
  DraftPurchaseOrderId!: number;

  @Column({ name: 'item_category', type: 'text', nullable: true })
  ItemCategory!: string | null;

  @Column({ name: 'item_id', type: 'integer', nullable: false })
  ItemId!: number;

  @Column({ name: 'quantity', type: 'numeric', nullable: false, transformer: NUM })
  Quantity!: number;

  @Column({ name: 'item_rate', type: 'numeric', nullable: false, transformer: NUM })
  ItemRate!: number;

  @Column({ name: 'sub_total', type: 'numeric', nullable: false, transformer: NUM })
  SubTotal!: number;

  @Column({ name: 'vat_percentage', type: 'numeric', nullable: false, transformer: NUM })
  VATPercentage!: number;

  @Column({ name: 'vat_amount', type: 'numeric', nullable: false, transformer: NUM })
  VATAmount!: number;

  @Column({ name: 'remarks', type: 'text', nullable: true })
  Remarks!: string | null;

  @Column({ name: 'item_specification', type: 'text', nullable: true })
  ItemSpecification!: string | null;

  @Column({ name: 'vendor_item_code', type: 'text', nullable: true })
  VendorItemCode!: string | null;

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

  @Column({ name: 'total_amount', type: 'numeric', nullable: false, transformer: NUM })
  TotalAmount!: number;

  @Column({ name: 'is_discarded', type: 'boolean', nullable: false })
  IsDiscarded!: boolean;

}

@Entity({ name: 'inv_txn_goods_receipt' })
export class GoodsReceiptModel {
  @PrimaryGeneratedColumn({ name: 'goods_receipt_id' })
  GoodsReceiptID!: number;

  @Column({ name: 'is_cancel', type: 'boolean', nullable: true })
  IsCancel!: boolean | null;

  @Column({ name: 'goods_arrival_no', type: 'integer', nullable: false })
  GoodsArrivalNo!: number;

  @Column({ name: 'vendor_bill_date', type: 'timestamp', nullable: true })
  VendorBillDate!: string | null;

  @Column({ name: 'goods_arrival_date', type: 'timestamp', nullable: true })
  GoodsArrivalDate!: string | null;

  @Column({ name: 'imir_no', type: 'integer', nullable: true })
  IMIRNo!: number | null;

  @Column({ name: 'imir_date', type: 'timestamp', nullable: true })
  IMIRDate!: string | null;

  @Column({ name: 'goods_receipt_no', type: 'integer', nullable: true })
  GoodsReceiptNo!: number | null;

  @Column({ name: 'goods_receipt_date', type: 'timestamp', nullable: true })
  GoodsReceiptDate!: string | null;

  @Column({ name: 'purchase_order_id', type: 'integer', nullable: true })
  PurchaseOrderId!: number | null;

  @Column({ name: 'remarks', type: 'text', nullable: true })
  Remarks!: string | null;

  @Column({ name: 'total_amount', type: 'numeric', nullable: false, transformer: NUM })
  TotalAmount!: number;

  @Column({ name: 'cancel_remarks', type: 'text', nullable: true })
  CancelRemarks!: string | null;

  @Column({ name: 'created_by', type: 'integer', nullable: true })
  CreatedBy!: number | null;

  @Column({ name: 'created_on', type: 'timestamp', nullable: true })
  CreatedOn!: string | null;

  @Column({ name: 'vendor_id', type: 'integer', nullable: false })
  VendorId!: number;

  @Column({ name: 'bill_no', type: 'text', nullable: true })
  BillNo!: string | null;

  @Column({ name: 'received_date', type: 'timestamp', nullable: true })
  ReceivedDate!: string | null;

  @Column({ name: 'receipt_no', type: 'text', nullable: true })
  ReceiptNo!: string | null;

  @Column({ name: 'order_date', type: 'timestamp', nullable: true })
  OrderDate!: string | null;

  @Column({ name: 'is_transferred_to_acc', type: 'boolean', nullable: true })
  IsTransferredToACC!: boolean | null;

  @Column({ name: 'sub_total', type: 'numeric', nullable: false, transformer: NUM })
  SubTotal!: number;

  @Column({ name: 'vat_total', type: 'numeric', nullable: false, transformer: NUM })
  VATTotal!: number;

  @Column({ name: 'tds_rate', type: 'numeric', nullable: true, transformer: NUM })
  TDSRate!: number | null;

  @Column({ name: 'tds_amount', type: 'numeric', nullable: true, transformer: NUM })
  TDSAmount!: number | null;

  @Column({ name: 'total_with_tds', type: 'numeric', nullable: true, transformer: NUM })
  TotalWithTDS!: number | null;

  @Column({ name: 'cc_charge', type: 'numeric', nullable: false, transformer: NUM })
  CcCharge!: number;

  @Column({ name: 'discount', type: 'double precision', nullable: false })
  Discount!: number;

  @Column({ name: 'discount_amount', type: 'numeric', nullable: false, transformer: NUM })
  DiscountAmount!: number;

  @Column({ name: 'print_count', type: 'integer', nullable: false })
  PrintCount!: number;

  @Column({ name: 'credit_period', type: 'integer', nullable: false })
  CreditPeriod!: number;

  @Column({ name: 'payment_mode', type: 'text', nullable: true })
  PaymentMode!: string | null;

  @Column({ name: 'other_charges', type: 'numeric', nullable: true, transformer: NUM })
  OtherCharges!: number | null;

  @Column({ name: 'insurance_charge', type: 'numeric', nullable: true, transformer: NUM })
  InsuranceCharge!: number | null;

  @Column({ name: 'carriage_freight_charge', type: 'numeric', nullable: true, transformer: NUM })
  CarriageFreightCharge!: number | null;

  @Column({ name: 'packing_charge', type: 'numeric', nullable: true, transformer: NUM })
  PackingCharge!: number | null;

  @Column({ name: 'transport_courier_charge', type: 'numeric', nullable: true, transformer: NUM })
  TransportCourierCharge!: number | null;

  @Column({ name: 'other_charge', type: 'numeric', nullable: true, transformer: NUM })
  OtherCharge!: number | null;

  @Column({ name: 'modified_by', type: 'integer', nullable: true })
  ModifiedBy!: number | null;

  @Column({ name: 'modified_on', type: 'timestamp', nullable: true })
  ModifiedOn!: string | null;

  @Column({ name: 'fiscal_year_id', type: 'integer', nullable: true })
  FiscalYearId!: number | null;

  @Column({ name: 'is_verification_enabled', type: 'boolean', nullable: false })
  IsVerificationEnabled!: boolean;

  @Column({ name: 'verifier_ids', type: 'text', nullable: true })
  VerifierIds!: string | null;

  @Column({ name: 'verification_id', type: 'integer', nullable: true })
  VerificationId!: number | null;

  @Column({ name: 'gr_status', type: 'text', nullable: true })
  GRStatus!: string | null;

  @Column({ name: 'cancelled_by', type: 'integer', nullable: true })
  CancelledBy!: number | null;

  @Column({ name: 'cancelled_on', type: 'timestamp', nullable: true })
  CancelledOn!: string | null;

  @Column({ name: 'is_donation', type: 'boolean', nullable: true })
  IsDonation!: boolean | null;

  @Column({ name: 'donation_id', type: 'integer', nullable: true })
  DonationId!: number | null;

  @Column({ name: 'material_coa_date', type: 'timestamp', nullable: true })
  MaterialCoaDate!: string | null;

  @Column({ name: 'material_coa_no', type: 'text', nullable: true })
  MaterialCoaNo!: string | null;

  @Column({ name: 'is_supplier_approved', type: 'boolean', nullable: true })
  IsSupplierApproved!: boolean | null;

  @Column({ name: 'is_delivery_top_closed', type: 'boolean', nullable: true })
  IsDeliveryTopClosed!: boolean | null;

  @Column({ name: 'is_box_numbered', type: 'boolean', nullable: true })
  IsBoxNumbered!: boolean | null;

  @Column({ name: 'received_by', type: 'integer', nullable: true })
  ReceivedBy!: number | null;

  @Column({ name: 'received_on', type: 'timestamp', nullable: true })
  ReceivedOn!: string | null;

  @Column({ name: 'received_remarks', type: 'text', nullable: true })
  ReceivedRemarks!: string | null;

  @Column({ name: 'store_id', type: 'integer', nullable: false })
  StoreId!: number;

  @Column({ name: 'gr_group_id', type: 'integer', nullable: true })
  GRGroupId!: number | null;

  @Column({ name: 'is_payment_done_from_acc', type: 'boolean', nullable: false })
  IsPaymentDoneFromAcc!: boolean;

}

@Entity({ name: 'inv_txn_goods_receipt_items' })
export class GoodsReceiptItemsModel {
  @PrimaryGeneratedColumn({ name: 'goods_receipt_item_id' })
  GoodsReceiptItemId!: number;

  @Column({ name: 'goods_receipt_id', type: 'integer', nullable: false })
  GoodsReceiptId!: number;

  @Column({ name: 'item_id', type: 'integer', nullable: false })
  ItemId!: number;

  @Column({ name: 'batch_no', type: 'text', nullable: true })
  BatchNO!: string | null;

  @Column({ name: 'expiry_date', type: 'timestamp', nullable: true })
  ExpiryDate!: string | null;

  @Column({ name: 'arrival_quantity', type: 'double precision', nullable: false })
  ArrivalQuantity!: number;

  @Column({ name: 'received_quantity', type: 'double precision', nullable: false })
  ReceivedQuantity!: number;

  @Column({ name: 'free_quantity', type: 'double precision', nullable: false })
  FreeQuantity!: number;

  @Column({ name: 'rejected_quantity', type: 'double precision', nullable: false })
  RejectedQuantity!: number;

  @Column({ name: 'item_rate', type: 'numeric', nullable: false, transformer: NUM })
  ItemRate!: number;

  @Column({ name: 'vat_amount', type: 'numeric', nullable: false, transformer: NUM })
  VATAmount!: number;

  @Column({ name: 'vat', type: 'double precision', nullable: true })
  VAT!: number | null;

  @Column({ name: 'total_amount', type: 'numeric', nullable: false, transformer: NUM })
  TotalAmount!: number;

  @Column({ name: 'created_by', type: 'integer', nullable: true })
  CreatedBy!: number | null;

  @Column({ name: 'created_on', type: 'timestamp', nullable: true })
  CreatedOn!: string | null;

  @Column({ name: 'sub_total', type: 'numeric', nullable: false, transformer: NUM })
  SubTotal!: number;

  @Column({ name: 'mrp', type: 'numeric', nullable: false, transformer: NUM })
  MRP!: number;

  @Column({ name: 'discount_percent', type: 'double precision', nullable: true })
  DiscountPercent!: number | null;

  @Column({ name: 'discount_amount', type: 'numeric', nullable: false, transformer: NUM })
  DiscountAmount!: number;

  @Column({ name: 'cc_charge', type: 'numeric', nullable: true, transformer: NUM })
  CcCharge!: number | null;

  @Column({ name: 'cc_amount', type: 'numeric', nullable: false, transformer: NUM })
  CcAmount!: number;

  @Column({ name: 'counter_id', type: 'integer', nullable: false })
  CounterId!: number;

  @Column({ name: 'other_charge', type: 'numeric', nullable: true, transformer: NUM })
  OtherCharge!: number | null;

  @Column({ name: 'is_transferred_to_acc', type: 'boolean', nullable: true })
  IsTransferredToACC!: boolean | null;

  @Column({ name: 'modified_by', type: 'integer', nullable: true })
  ModifiedBy!: number | null;

  @Column({ name: 'modified_on', type: 'timestamp', nullable: true })
  ModifiedOn!: string | null;

  @Column({ name: 'gr_item_date', type: 'timestamp', nullable: true })
  GRItemDate!: string | null;

  @Column({ name: 'is_active', type: 'boolean', nullable: false })
  IsActive!: boolean;

  @Column({ name: 'cancelled_by', type: 'integer', nullable: true })
  CancelledBy!: number | null;

  @Column({ name: 'cancelled_on', type: 'timestamp', nullable: true })
  CancelledOn!: string | null;

  @Column({ name: 'cost_price', type: 'numeric', nullable: false, transformer: NUM })
  CostPrice!: number;

  @Column({ name: 'manufacture_date', type: 'timestamp', nullable: true })
  ManufactureDate!: string | null;

  @Column({ name: 'sampling_date', type: 'timestamp', nullable: true })
  SamplingDate!: string | null;

  @Column({ name: 'no_of_boxes', type: 'integer', nullable: false })
  NoOfBoxes!: number;

  @Column({ name: 'sampling_quantity', type: 'integer', nullable: false })
  SamplingQuantity!: number;

  @Column({ name: 'identification_label', type: 'text', nullable: true })
  IdentificationLabel!: string | null;

  @Column({ name: 'is_sampling_label', type: 'text', nullable: true })
  IsSamplingLabel!: string | null;

  @Column({ name: 'sampling_boxes', type: 'text', nullable: true })
  SamplingBoxes!: string | null;

  @Column({ name: 'sample_removed', type: 'integer', nullable: false })
  SampleRemoved!: number;

  @Column({ name: 'material_no', type: 'text', nullable: true })
  MaterialNO!: string | null;

  @Column({ name: 'stock_id', type: 'integer', nullable: true })
  StockId!: number | null;

  @Column({ name: 'store_stock_id', type: 'integer', nullable: true })
  StoreStockId!: number | null;

  @Column({ name: 'gr_item_specification', type: 'text', nullable: true })
  GRItemSpecification!: string | null;

  @Column({ name: 'remarks', type: 'text', nullable: true })
  Remarks!: string | null;

  @Column({ name: 'item_category', type: 'text', nullable: true })
  ItemCategory!: string | null;

}

@Entity({ name: 'inv_txn_purchase_order_items' })
export class PurchaseOrderItemsModel {
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

  @Column({ name: 'total_amount', type: 'numeric', nullable: false, transformer: NUM })
  TotalAmount!: number;

  @Column({ name: 'received_quantity', type: 'double precision', nullable: false })
  ReceivedQuantity!: number;

  @Column({ name: 'pending_quantity', type: 'double precision', nullable: false })
  PendingQuantity!: number;

  @Column({ name: 'delivery_days', type: 'integer', nullable: false })
  DeliveryDays!: number;

  @Column({ name: 'authorized_remark', type: 'text', nullable: true })
  AuthorizedRemark!: string | null;

  @Column({ name: 'authorized_by', type: 'integer', nullable: true })
  AuthorizedBy!: number | null;

  @Column({ name: 'authorized_on', type: 'timestamp', nullable: true })
  AuthorizedOn!: string | null;

  @Column({ name: 'created_by', type: 'integer', nullable: true })
  CreatedBy!: number | null;

  @Column({ name: 'created_on', type: 'timestamp', nullable: true })
  CreatedOn!: string | null;

  @Column({ name: 'remark', type: 'text', nullable: true })
  Remark!: string | null;

  @Column({ name: 'po_item_status', type: 'text', nullable: true })
  POItemStatus!: string | null;

  @Column({ name: 'po_item_specification', type: 'text', nullable: true })
  POItemSpecification!: string | null;

  @Column({ name: 'vat_amount', type: 'numeric', nullable: true, transformer: NUM })
  VATAmount!: number | null;

  @Column({ name: 'vat_percentage', type: 'double precision', nullable: false })
  VatPercentage!: number;

  @Column({ name: 'modified_by', type: 'integer', nullable: true })
  ModifiedBy!: number | null;

  @Column({ name: 'modified_on', type: 'timestamp', nullable: true })
  ModifiedOn!: string | null;

  @Column({ name: 'is_active', type: 'boolean', nullable: false })
  IsActive!: boolean;

  @Column({ name: 'cancelled_by', type: 'integer', nullable: true })
  CancelledBy!: number | null;

  @Column({ name: 'cancelled_on', type: 'timestamp', nullable: true })
  CancelledOn!: string | null;

  @Column({ name: 'cancel_remarks', type: 'text', nullable: true })
  CancelRemarks!: string | null;

  @Column({ name: 'item_category', type: 'text', nullable: true })
  ItemCategory!: string | null;

  @Column({ name: 'vendor_item_code', type: 'text', nullable: true })
  VendorItemCode!: string | null;

}

@Entity({ name: 'inv_txn_purchase_request' })
export class PurchaseRequestModel {
  @PrimaryGeneratedColumn({ name: 'purchase_request_id' })
  PurchaseRequestId!: number;

  @Column({ name: 'pr_number', type: 'integer', nullable: true })
  PRNumber!: number | null;

  @Column({ name: 'vendor_id', type: 'integer', nullable: true })
  VendorId!: number | null;

  @Column({ name: 'request_date', type: 'timestamp', nullable: false })
  RequestDate!: string;

  @Column({ name: 'request_status', type: 'text', nullable: true })
  RequestStatus!: string | null;

  @Column({ name: 'verification_id', type: 'integer', nullable: true })
  VerificationId!: number | null;

  @Column({ name: 'remarks', type: 'text', nullable: true })
  Remarks!: string | null;

  @Column({ name: 'cancelled_by', type: 'integer', nullable: true })
  CancelledBy!: number | null;

  @Column({ name: 'cancelled_on', type: 'timestamp', nullable: true })
  CancelledOn!: string | null;

  @Column({ name: 'cancel_remarks', type: 'text', nullable: true })
  CancelRemarks!: string | null;

  @Column({ name: 'is_active', type: 'boolean', nullable: false })
  IsActive!: boolean;

  @Column({ name: 'is_po_created', type: 'boolean', nullable: false })
  IsPOCreated!: boolean;

  @Column({ name: 'created_by', type: 'integer', nullable: false })
  CreatedBy!: number;

  @Column({ name: 'created_on', type: 'timestamp', nullable: false })
  CreatedOn!: string;

  @Column({ name: 'modified_by', type: 'integer', nullable: true })
  ModifiedBy!: number | null;

  @Column({ name: 'modified_on', type: 'timestamp', nullable: true })
  ModifiedOn!: string | null;

  @Column({ name: 'pr_category', type: 'text', nullable: true })
  PRCategory!: string | null;

  @Column({ name: 'store_id', type: 'integer', nullable: false })
  StoreId!: number;

  @Column({ name: 'pr_group_id', type: 'integer', nullable: true })
  PRGroupId!: number | null;

  @Column({ name: 'fiscal_year_id', type: 'integer', nullable: true })
  FiscalYearId!: number | null;

}

@Entity({ name: 'inv_txn_purchase_request_items' })
export class PurchaseRequestItemModel {
  @PrimaryGeneratedColumn({ name: 'purchase_request_item_id' })
  PurchaseRequestItemId!: number;

  @Column({ name: 'purchase_request_id', type: 'integer', nullable: false })
  PurchaseRequestId!: number;

  @Column({ name: 'item_id', type: 'integer', nullable: false })
  ItemId!: number;

  @Column({ name: 'vendor_id', type: 'integer', nullable: true })
  VendorId!: number | null;

  @Column({ name: 'requested_quantity', type: 'double precision', nullable: false })
  RequestedQuantity!: number;

  @Column({ name: 'request_item_status', type: 'text', nullable: true })
  RequestItemStatus!: string | null;

  @Column({ name: 'remarks', type: 'text', nullable: true })
  Remarks!: string | null;

  @Column({ name: 'cancelled_by', type: 'integer', nullable: true })
  CancelledBy!: number | null;

  @Column({ name: 'cancelled_on', type: 'timestamp', nullable: true })
  CancelledOn!: string | null;

  @Column({ name: 'cancel_remarks', type: 'text', nullable: true })
  CancelRemarks!: string | null;

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

  @Column({ name: 'supply_required_before', type: 'text', nullable: true })
  SupplyRequiredBefore!: string | null;

  @Column({ name: 'quantity_verified_on', type: 'timestamp', nullable: true })
  QuantityVerifiedOn!: string | null;

  @Column({ name: 'item_category', type: 'text', nullable: true })
  ItemCategory!: string | null;

  @Column({ name: 'pending_quantity', type: 'double precision', nullable: true })
  PendingQuantity!: number | null;

}

@Entity({ name: 'inv_txn_requisition' })
export class RequisitionModel {
  @PrimaryGeneratedColumn({ name: 'requisition_id' })
  RequisitionId!: number;

  @Column({ name: 'request_from_store_id', type: 'integer', nullable: false })
  RequestFromStoreId!: number;

  @Column({ name: 'request_to_store_id', type: 'integer', nullable: true })
  RequestToStoreId!: number | null;

  @Column({ name: 'department_id', type: 'integer', nullable: true })
  DepartmentId!: number | null;

  @Column({ name: 'requisition_date', type: 'timestamp', nullable: true })
  RequisitionDate!: string | null;

  @Column({ name: 'created_by', type: 'integer', nullable: false })
  CreatedBy!: number;

  @Column({ name: 'requisition_status', type: 'text', nullable: true })
  RequisitionStatus!: string | null;

  @Column({ name: 'created_on', type: 'timestamp', nullable: false })
  CreatedOn!: string;

  @Column({ name: 'modified_by', type: 'integer', nullable: true })
  ModifiedBy!: number | null;

  @Column({ name: 'modified_on', type: 'timestamp', nullable: true })
  ModifiedOn!: string | null;

  @Column({ name: 'is_cancel', type: 'boolean', nullable: true })
  IsCancel!: boolean | null;

  @Column({ name: 'remarks', type: 'text', nullable: true })
  Remarks!: string | null;

  @Column({ name: 'cancel_remarks', type: 'text', nullable: true })
  CancelRemarks!: string | null;

  @Column({ name: 'requisition_no', type: 'integer', nullable: false })
  RequisitionNo!: number;

  @Column({ name: 'issue_no', type: 'integer', nullable: true })
  IssueNo!: number | null;

  @Column({ name: 'verification_id', type: 'integer', nullable: true })
  VerificationId!: number | null;

  @Column({ name: 'req_dis_group_id', type: 'integer', nullable: true })
  ReqDisGroupId!: number | null;

  @Column({ name: 'fiscal_year_id', type: 'integer', nullable: false })
  FiscalYearId!: number;

  @Column({ name: 'enable_receive_feature', type: 'boolean', nullable: false })
  EnableReceiveFeature!: boolean;

  @Column({ name: 'is_direct_dispatched', type: 'boolean', nullable: false })
  IsDirectDispatched!: boolean;

  @Column({ name: 'is_verification_enabled', type: 'boolean', nullable: false })
  IsVerificationEnabled!: boolean;

  @Column({ name: 'verifier_ids', type: 'text', nullable: true })
  VerifierIds!: string | null;

}

@Entity({ name: 'inv_txn_requisition_items' })
export class RequisitionItemsModel {
  @PrimaryGeneratedColumn({ name: 'requisition_item_id' })
  RequisitionItemId!: number;

  @Column({ name: 'item_id', type: 'integer', nullable: false })
  ItemId!: number;

  @Column({ name: 'quantity', type: 'double precision', nullable: false })
  Quantity!: number;

  @Column({ name: 'received_quantity', type: 'double precision', nullable: true })
  ReceivedQuantity!: number | null;

  @Column({ name: 'pending_quantity', type: 'double precision', nullable: true })
  PendingQuantity!: number | null;

  @Column({ name: 'requisition_id', type: 'integer', nullable: true })
  RequisitionId!: number | null;

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

  @Column({ name: 'modified_by', type: 'integer', nullable: true })
  ModifiedBy!: number | null;

  @Column({ name: 'modified_on', type: 'timestamp', nullable: true })
  ModifiedOn!: string | null;

  @Column({ name: 'requisition_no', type: 'integer', nullable: true })
  RequisitionNo!: number | null;

  @Column({ name: 'issue_no', type: 'integer', nullable: true })
  IssueNo!: number | null;

  @Column({ name: 'cancel_quantity', type: 'double precision', nullable: true })
  CancelQuantity!: number | null;

  @Column({ name: 'cancel_on', type: 'timestamp', nullable: true })
  CancelOn!: string | null;

  @Column({ name: 'cancel_by', type: 'integer', nullable: true })
  CancelBy!: number | null;

  @Column({ name: 'cancel_remarks', type: 'text', nullable: true })
  CancelRemarks!: string | null;

  @Column({ name: 'mat_issue_date', type: 'timestamp', nullable: true })
  MatIssueDate!: string | null;

  @Column({ name: 'mat_issue_to', type: 'text', nullable: true })
  MatIssueTo!: string | null;

  @Column({ name: 'mssno', type: 'text', nullable: true })
  MSSNO!: string | null;

  @Column({ name: 'first_week_qty', type: 'text', nullable: true })
  FirstWeekQty!: string | null;

  @Column({ name: 'second_week_qty', type: 'text', nullable: true })
  SecondWeekQty!: string | null;

  @Column({ name: 'third_week_qty', type: 'text', nullable: true })
  ThirdWeekQty!: string | null;

  @Column({ name: 'fourth_week_qty', type: 'text', nullable: true })
  FourthWeekQty!: string | null;

  @Column({ name: 'min_date', type: 'timestamp', nullable: true })
  MINDate!: string | null;

  @Column({ name: 'min_no', type: 'text', nullable: true })
  MINNo!: string | null;

  @Column({ name: 'is_active', type: 'boolean', nullable: false })
  IsActive!: boolean;

  @Column({ name: 'item_category', type: 'text', nullable: true })
  ItemCategory!: string | null;

  @Column({ name: 'specification', type: 'text', nullable: true })
  Specification!: string | null;

  @Column({ name: 'cost_price', type: 'double precision', nullable: true })
  CostPrice!: number | null;

}

@Entity({ name: 'inv_txn_return_to_vendor' })
export class ReturnToVendorModel {
  @PrimaryGeneratedColumn({ name: 'return_to_vendor_id' })
  ReturnToVendorId!: number;

  @Column({ name: 'return_date', type: 'timestamp', nullable: false })
  ReturnDate!: string;

  @Column({ name: 'vendor_id', type: 'integer', nullable: false })
  VendorId!: number;

  @Column({ name: 'sub_total', type: 'numeric', nullable: false, transformer: NUM })
  SubTotal!: number;

  @Column({ name: 'vat_total', type: 'numeric', nullable: false, transformer: NUM })
  VATTotal!: number;

  @Column({ name: 'discount_amount', type: 'numeric', nullable: false, transformer: NUM })
  DiscountAmount!: number;

  @Column({ name: 'total_amount', type: 'numeric', nullable: false, transformer: NUM })
  TotalAmount!: number;

  @Column({ name: 'credit_note_id', type: 'integer', nullable: false })
  CreditNoteId!: number;

  @Column({ name: 'credit_note_print_no', type: 'integer', nullable: true })
  CreditNotePrintNo!: number | null;

  @Column({ name: 'remarks', type: 'text', nullable: true })
  Remarks!: string | null;

  @Column({ name: 'created_by', type: 'integer', nullable: false })
  CreatedBy!: number;

  @Column({ name: 'created_on', type: 'timestamp', nullable: false })
  CreatedOn!: string;

  @Column({ name: 'modified_by', type: 'integer', nullable: true })
  ModifiedBy!: number | null;

  @Column({ name: 'modified_on', type: 'timestamp', nullable: true })
  ModifiedOn!: string | null;

  @Column({ name: 'cc_amount', type: 'numeric', nullable: true, transformer: NUM })
  CCAmount!: number | null;

  @Column({ name: 'store_id', type: 'integer', nullable: false })
  StoreId!: number;

  @Column({ name: 'is_transferred_to_acc', type: 'boolean', nullable: false })
  IsTransferredToAcc!: boolean;

}

@Entity({ name: 'inv_txn_return_to_vendor_items' })
export class ReturnToVendorItemsModel {
  @PrimaryGeneratedColumn({ name: 'return_to_vendor_item_id' })
  ReturnToVendorItemId!: number;

  @Column({ name: 'return_to_vendor_id', type: 'integer', nullable: true })
  ReturnToVendorId!: number | null;

  @Column({ name: 'vendor_id', type: 'integer', nullable: false })
  VendorId!: number;

  @Column({ name: 'item_id', type: 'integer', nullable: false })
  ItemId!: number;

  @Column({ name: 'goods_receipt_item_id', type: 'integer', nullable: false })
  GoodsReceiptItemId!: number;

  @Column({ name: 'goods_receipt_id', type: 'integer', nullable: true })
  GoodsReceiptId!: number | null;

  @Column({ name: 'credit_note_no', type: 'integer', nullable: false })
  CreditNoteNo!: number;

  @Column({ name: 'stock_id', type: 'integer', nullable: false })
  StockId!: number;

  @Column({ name: 'batch_no', type: 'text', nullable: true })
  BatchNo!: string | null;

  @Column({ name: 'quantity', type: 'double precision', nullable: false })
  Quantity!: number;

  @Column({ name: 'item_rate', type: 'numeric', nullable: false, transformer: NUM })
  ItemRate!: number;

  @Column({ name: 'total_amount', type: 'numeric', nullable: false, transformer: NUM })
  TotalAmount!: number;

  @Column({ name: 'vat', type: 'numeric', nullable: false, transformer: NUM })
  VAT!: number;

  @Column({ name: 'remark', type: 'text', nullable: true })
  Remark!: string | null;

  @Column({ name: 'return_type', type: 'text', nullable: true })
  ReturnType!: string | null;

  @Column({ name: 'created_on', type: 'timestamp', nullable: false })
  CreatedOn!: string;

  @Column({ name: 'is_transferred_to_acc', type: 'boolean', nullable: true })
  IsTransferredToACC!: boolean | null;

  @Column({ name: 'created_by', type: 'integer', nullable: false })
  CreatedBy!: number;

  @Column({ name: 'vat_amount', type: 'numeric', nullable: true, transformer: NUM })
  VATAmount!: number | null;

  @Column({ name: 'discount_amount', type: 'numeric', nullable: true, transformer: NUM })
  DiscountAmount!: number | null;

  @Column({ name: 'cc_amount', type: 'numeric', nullable: true, transformer: NUM })
  CCAmount!: number | null;

  @Column({ name: 'sub_total', type: 'numeric', nullable: true, transformer: NUM })
  SubTotal!: number | null;

  @Column({ name: 'return_cost_price', type: 'numeric', nullable: true, transformer: NUM })
  ReturnCostPrice!: number | null;

}

@Entity({ name: 'inv_txn_stock_transaction' })
export class StockTransactionModel {
  @PrimaryGeneratedColumn({ name: 'stock_transaction_id' })
  StockTransactionId!: number;

  @Column({ name: 'transaction_date', type: 'timestamp', nullable: false })
  TransactionDate!: string;

  @Column({ name: 'store_id', type: 'integer', nullable: false })
  StoreId!: number;

  @Column({ name: 'stock_id', type: 'integer', nullable: false })
  StockId!: number;

  @Column({ name: 'store_stock_id', type: 'integer', nullable: true })
  StoreStockId!: number | null;

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

  @Column({ name: 'cost_price', type: 'numeric', nullable: true, transformer: NUM })
  CostPrice!: number | null;

  @Column({ name: 'mrp', type: 'numeric', nullable: true, transformer: NUM })
  MRP!: number | null;

  @Column({ name: 'reference_no', type: 'integer', nullable: true })
  ReferenceNo!: number | null;

  @Column({ name: 'remarks', type: 'text', nullable: true })
  Remarks!: string | null;

  @Column({ name: 'is_active', type: 'boolean', nullable: true })
  IsActive!: boolean | null;

  @Column({ name: 'is_transferred_to_acc', type: 'boolean', nullable: true })
  IsTransferredToACC!: boolean | null;

  @Column({ name: 'created_by', type: 'integer', nullable: false })
  CreatedBy!: number;

  @Column({ name: 'created_on', type: 'timestamp', nullable: true })
  CreatedOn!: string | null;

}

@Entity({ name: 'inv_txn_store_stock' })
export class StoreStockModel {
  @PrimaryGeneratedColumn({ name: 'store_stock_id' })
  StoreStockId!: number;

  @Column({ name: 'store_id', type: 'integer', nullable: false })
  StoreId!: number;

  @Column({ name: 'stock_id', type: 'integer', nullable: false })
  StockId!: number;

  @Column({ name: 'item_id', type: 'integer', nullable: false })
  ItemId!: number;

  @Column({ name: 'selling_price', type: 'numeric', nullable: false, transformer: NUM })
  SellingPrice!: number;

  @Column({ name: 'available_quantity', type: 'double precision', nullable: false })
  AvailableQuantity!: number;

  @Column({ name: 'un_confirmed_qty_in', type: 'double precision', nullable: false })
  UnConfirmedQty_In!: number;

  @Column({ name: 'un_confirmed_qty_out', type: 'double precision', nullable: false })
  UnConfirmedQty_Out!: number;

  @Column({ name: 'is_active', type: 'boolean', nullable: false })
  IsActive!: boolean;

  @Column({ name: 'cost_price', type: 'numeric', nullable: false, transformer: NUM })
  CostPrice!: number;

}

@Entity({ name: 'inv_txn_write_off_items' })
export class WriteOffItemsModel {
  @PrimaryGeneratedColumn({ name: 'write_off_id' })
  WriteOffId!: number;

  @Column({ name: 'stock_id', type: 'integer', nullable: false })
  StockId!: number;

  @Column({ name: 'item_id', type: 'integer', nullable: false })
  ItemId!: number;

  @Column({ name: 'item_rate', type: 'numeric', nullable: true, transformer: NUM })
  ItemRate!: number | null;

  @Column({ name: 'write_off_quantity', type: 'double precision', nullable: true })
  WriteOffQuantity!: number | null;

  @Column({ name: 'total_amount', type: 'numeric', nullable: false, transformer: NUM })
  TotalAmount!: number;

  @Column({ name: 'write_off_date', type: 'timestamp', nullable: true })
  WriteOffDate!: string | null;

  @Column({ name: 'remark', type: 'text', nullable: true })
  Remark!: string | null;

  @Column({ name: 'created_by', type: 'integer', nullable: false })
  CreatedBy!: number;

  @Column({ name: 'created_on', type: 'timestamp', nullable: true })
  CreatedOn!: string | null;

  @Column({ name: 'is_transferred_to_acc', type: 'boolean', nullable: true })
  IsTransferredToACC!: boolean | null;

  @Column({ name: 'batch_no', type: 'text', nullable: true })
  BatchNO!: string | null;

  @Column({ name: 'store_id', type: 'integer', nullable: false })
  StoreId!: number;

}

@Entity({ name: 'ward_txn_return' })
export class ReturnFromSubstore {
  @PrimaryGeneratedColumn({ name: 'return_id' })
  ReturnId!: number;

  @Column({ name: 'return_date', type: 'timestamp', nullable: false })
  ReturnDate!: string;

  @Column({ name: 'source_store_id', type: 'integer', nullable: false })
  SourceStoreId!: number;

  @Column({ name: 'target_store_id', type: 'integer', nullable: false })
  TargetStoreId!: number;

  @Column({ name: 'remarks', type: 'text', nullable: true })
  Remarks!: string | null;

  @Column({ name: 'created_by', type: 'integer', nullable: false })
  CreatedBy!: number;

  @Column({ name: 'created_on', type: 'timestamp', nullable: false })
  CreatedOn!: string;

  @Column({ name: 'modified_by', type: 'integer', nullable: true })
  ModifiedBy!: number | null;

  @Column({ name: 'modified_on', type: 'timestamp', nullable: true })
  ModifiedOn!: string | null;

  @Column({ name: 'received_by', type: 'integer', nullable: true })
  ReceivedBy!: number | null;

  @Column({ name: 'received_on', type: 'timestamp', nullable: true })
  ReceivedOn!: string | null;

  @Column({ name: 'received_remarks', type: 'text', nullable: true })
  ReceivedRemarks!: string | null;

}

@Entity({ name: 'ward_txn_return_items' })
export class ReturnFromSubstoreItems {
  @PrimaryGeneratedColumn({ name: 'return_item_id' })
  ReturnItemId!: number;

  @Column({ name: 'return_id', type: 'integer', nullable: false })
  ReturnId!: number;

  @Column({ name: 'item_id', type: 'integer', nullable: false })
  ItemId!: number;

  @Column({ name: 'batch_no', type: 'text', nullable: true })
  BatchNo!: string | null;

  @Column({ name: 'return_quantity', type: 'double precision', nullable: false })
  ReturnQuantity!: number;

  @Column({ name: 'expiry_date', type: 'timestamp', nullable: false })
  ExpiryDate!: string;

  @Column({ name: 'remark', type: 'text', nullable: true })
  Remark!: string | null;

  @Column({ name: 'created_by', type: 'integer', nullable: false })
  CreatedBy!: number;

  @Column({ name: 'created_on', type: 'timestamp', nullable: false })
  CreatedOn!: string;

}
