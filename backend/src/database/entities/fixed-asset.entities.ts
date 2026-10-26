/* GÉNÉRÉ par tools/generate-entities.mjs depuis migration/inventory/entities.json : ne pas modifier à la main. */
import { Column, Entity, PrimaryColumn, PrimaryGeneratedColumn } from 'typeorm';
import { NUM } from '../transformers';

@Entity({ name: 'inv_asset_condition_check_list' })
export class FixedAssetConditionCheckListModel {
  @PrimaryGeneratedColumn({ name: 'asset_condition_check_list_id' })
  AssetConditionCheckListId!: number;

  @Column({ name: 'asset_condition_id', type: 'integer', nullable: false })
  AssetConditionId!: number;

  @Column({ name: 'fixed_asset_stock_id', type: 'integer', nullable: false })
  FixedAssetStockId!: number;

  @Column({ name: 'condition', type: 'boolean', nullable: true })
  Condition!: boolean | null;

  @Column({ name: 'created_on', type: 'timestamp', nullable: true })
  CreatedOn!: string | null;

  @Column({ name: 'created_by', type: 'integer', nullable: true })
  CreatedBy!: number | null;

  @Column({ name: 'modified_on', type: 'timestamp', nullable: true })
  ModifiedOn!: string | null;

  @Column({ name: 'modified_by', type: 'integer', nullable: true })
  ModifiedBy!: number | null;

  @Column({ name: 'is_active', type: 'boolean', nullable: true })
  IsActive!: boolean | null;

}

@Entity({ name: 'inv_asset_contract_file_info' })
export class FixedAssetContractModel {
  @PrimaryGeneratedColumn({ name: 'asset_contract_id' })
  AssetContractId!: number;

  @Column({ name: 'fixed_asset_stock_id', type: 'integer', nullable: false })
  FixedAssetStockId!: number;

  @Column({ name: 'contract_file_name', type: 'text', nullable: true })
  ContractFileName!: string | null;

  @Column({ name: 'file_extention', type: 'text', nullable: true })
  FileExtention!: string | null;

  @Column({ name: 'created_on', type: 'timestamp', nullable: true })
  CreatedOn!: string | null;

  @Column({ name: 'created_by', type: 'integer', nullable: true })
  CreatedBy!: number | null;

  @Column({ name: 'modified_on', type: 'timestamp', nullable: true })
  ModifiedOn!: string | null;

  @Column({ name: 'modified_by', type: 'integer', nullable: true })
  ModifiedBy!: number | null;

}

@Entity({ name: 'inv_asset_fault_history' })
export class FixedAssetFaultHistoryModel {
  @PrimaryGeneratedColumn({ name: 'fault_history_id' })
  FaultHistoryId!: number;

  @Column({ name: 'fixed_asset_stock_id', type: 'integer', nullable: false })
  FixedAssetStockId!: number;

  @Column({ name: 'fault_date', type: 'timestamp', nullable: true })
  FaultDate!: string | null;

  @Column({ name: 'fault_description', type: 'text', nullable: true })
  FaultDescription!: string | null;

  @Column({ name: 'fault_resolved_date', type: 'timestamp', nullable: true })
  FaultResolvedDate!: string | null;

  @Column({ name: 'fault_resolved_remarks', type: 'text', nullable: true })
  FaultResolvedRemarks!: string | null;

  @Column({ name: 'created_on', type: 'timestamp', nullable: true })
  CreatedOn!: string | null;

  @Column({ name: 'created_by', type: 'integer', nullable: true })
  CreatedBy!: number | null;

  @Column({ name: 'modified_on', type: 'timestamp', nullable: true })
  ModifiedOn!: string | null;

  @Column({ name: 'modified_by', type: 'integer', nullable: true })
  ModifiedBy!: number | null;

  @Column({ name: 'is_fault_resolved', type: 'boolean', nullable: false })
  IsFaultResolved!: boolean;

}

@Entity({ name: 'inv_asset_insurance' })
export class FixedAssetInsuranceModel {
  @PrimaryGeneratedColumn({ name: 'asset_insurannce_id' })
  AssetInsurannceId!: number;

  @Column({ name: 'fixed_asset_stock_id', type: 'integer', nullable: false })
  FixedAssetStockId!: number;

  @Column({ name: 'policy_number', type: 'text', nullable: true })
  PolicyNumber!: string | null;

  @Column({ name: 'insurer', type: 'text', nullable: true })
  Insurer!: string | null;

  @Column({ name: 'insured_value', type: 'text', nullable: true })
  InsuredValue!: string | null;

  @Column({ name: 'insurance_start_date', type: 'timestamp', nullable: true })
  InsuranceStartDate!: string | null;

  @Column({ name: 'insurance_end_date', type: 'timestamp', nullable: true })
  InsuranceEndDate!: string | null;

  @Column({ name: 'comprehensive_insurance', type: 'text', nullable: true })
  ComprehensiveInsurance!: string | null;

  @Column({ name: 'created_on', type: 'timestamp', nullable: true })
  CreatedOn!: string | null;

  @Column({ name: 'created_by', type: 'integer', nullable: true })
  CreatedBy!: number | null;

  @Column({ name: 'modified_on', type: 'timestamp', nullable: true })
  ModifiedOn!: string | null;

  @Column({ name: 'modified_by', type: 'integer', nullable: true })
  ModifiedBy!: number | null;

}

@Entity({ name: 'inv_asset_service_history' })
export class FixedAssetServiceModel {
  @PrimaryGeneratedColumn({ name: 'asset_service_id' })
  AssetServiceId!: number;

  @Column({ name: 'fixed_asset_stock_id', type: 'integer', nullable: false })
  FixedAssetStockId!: number;

  @Column({ name: 'service_date', type: 'timestamp', nullable: true })
  ServiceDate!: string | null;

  @Column({ name: 'service_remarks', type: 'text', nullable: true })
  ServiceRemarks!: string | null;

  @Column({ name: 'service_complete_date', type: 'timestamp', nullable: true })
  ServiceCompleteDate!: string | null;

  @Column({ name: 'service_complete_remarks', type: 'text', nullable: true })
  ServiceCompleteRemarks!: string | null;

  @Column({ name: 'created_on', type: 'timestamp', nullable: true })
  CreatedOn!: string | null;

  @Column({ name: 'created_by', type: 'integer', nullable: true })
  CreatedBy!: number | null;

  @Column({ name: 'modified_on', type: 'timestamp', nullable: true })
  ModifiedOn!: string | null;

  @Column({ name: 'modified_by', type: 'integer', nullable: true })
  ModifiedBy!: number | null;

}

@Entity({ name: 'inv_mst_asset_category' })
export class FixedAssetCategoryModel {
  @PrimaryGeneratedColumn({ name: 'asset_category_id' })
  AssetCategoryId!: number;

  @Column({ name: 'sub_category_id', type: 'integer', nullable: false })
  SubCategoryId!: number;

  @Column({ name: 'parent_id', type: 'integer', nullable: true })
  ParentId!: number | null;

  @Column({ name: 'description', type: 'text', nullable: true })
  Description!: string | null;

  @Column({ name: 'created_on', type: 'timestamp', nullable: true })
  CreatedOn!: string | null;

  @Column({ name: 'created_by', type: 'integer', nullable: true })
  CreatedBy!: number | null;

  @Column({ name: 'modified_on', type: 'timestamp', nullable: true })
  ModifiedOn!: string | null;

  @Column({ name: 'modified_by', type: 'integer', nullable: true })
  ModifiedBy!: number | null;

}

@Entity({ name: 'inv_mst_asset_depreciation_method' })
export class FixedAssetDepreciationMethodModel {
  @PrimaryGeneratedColumn({ name: 'asset_deprn_method_id' })
  AssetDeprnMethodId!: number;

  @Column({ name: 'method', type: 'text', nullable: true })
  Method!: string | null;

  @Column({ name: 'description', type: 'text', nullable: true })
  Description!: string | null;

  @Column({ name: 'created_on', type: 'timestamp', nullable: true })
  CreatedOn!: string | null;

  @Column({ name: 'created_by', type: 'integer', nullable: true })
  CreatedBy!: number | null;

  @Column({ name: 'is_active', type: 'boolean', nullable: false })
  IsActive!: boolean;

}

@Entity({ name: 'inv_mst_asset_location' })
export class FixedAssetLocationsModel {
  @PrimaryGeneratedColumn({ name: 'location_id' })
  LocationId!: number;

  @Column({ name: 'location_name', type: 'text', nullable: true })
  LocationName!: string | null;

  @Column({ name: 'location_details', type: 'text', nullable: true })
  LocationDetails!: string | null;

  @Column({ name: 'created_on', type: 'timestamp', nullable: true })
  CreatedOn!: string | null;

  @Column({ name: 'created_by', type: 'integer', nullable: true })
  CreatedBy!: number | null;

  @Column({ name: 'modified_on', type: 'timestamp', nullable: true })
  ModifiedOn!: string | null;

  @Column({ name: 'modified_by', type: 'integer', nullable: true })
  ModifiedBy!: number | null;

}

@Entity({ name: 'inv_txn_asset_depreciation' })
export class FixedAssetDepreciationModel {
  @PrimaryGeneratedColumn({ name: 'asset_depreciation_id' })
  AssetDepreciationId!: number;

  @Column({ name: 'fixed_asset_stock_id', type: 'integer', nullable: false })
  FixedAssetStockId!: number;

  @Column({ name: 'asset_deprn_method_id', type: 'integer', nullable: false })
  AssetDeprnMethodId!: number;

  @Column({ name: 'rate', type: 'integer', nullable: true })
  Rate!: number | null;

  @Column({ name: 'depreciation_amount', type: 'numeric', nullable: false, transformer: NUM })
  DepreciationAmount!: number;

  @Column({ name: 'fiscal_year_id', type: 'integer', nullable: false })
  FiscalYearId!: number;

  @Column({ name: 'start_date', type: 'timestamp', nullable: true })
  StartDate!: string | null;

  @Column({ name: 'end_date', type: 'timestamp', nullable: true })
  EndDate!: string | null;

  @Column({ name: 'created_on', type: 'timestamp', nullable: true })
  CreatedOn!: string | null;

  @Column({ name: 'created_by', type: 'integer', nullable: true })
  CreatedBy!: number | null;

  @Column({ name: 'modified_on', type: 'timestamp', nullable: true })
  ModifiedOn!: string | null;

  @Column({ name: 'modified_by', type: 'integer', nullable: true })
  ModifiedBy!: number | null;

}

@Entity({ name: 'inv_txn_fixed_asset_dispatch' })
export class FixedAssetDispatchModel {
  @PrimaryGeneratedColumn({ name: 'dispatch_id' })
  DispatchId!: number;

  @Column({ name: 'requisition_id', type: 'integer', nullable: true })
  RequisitionId!: number | null;

  @Column({ name: 'store_id', type: 'integer', nullable: false })
  StoreId!: number;

  @Column({ name: 'sub_store_id', type: 'integer', nullable: false })
  SubStoreId!: number;

  @Column({ name: 'sub_total', type: 'numeric', nullable: false, transformer: NUM })
  SubTotal!: number;

  @Column({ name: 'remark', type: 'text', nullable: true })
  Remark!: string | null;

  @Column({ name: 'created_by', type: 'integer', nullable: false })
  CreatedBy!: number;

  @Column({ name: 'created_on', type: 'timestamp', nullable: true })
  CreatedOn!: string | null;

  @Column({ name: 'received_by', type: 'text', nullable: true })
  ReceivedBy!: string | null;

}

@Entity({ name: 'inv_txn_fixed_asset_dispatch_items' })
export class FixedAssetDispatchItemsModel {
  @PrimaryGeneratedColumn({ name: 'dispatch_item_id' })
  DispatchItemId!: number;

  @Column({ name: 'dispatch_id', type: 'integer', nullable: true })
  DispatchId!: number | null;

  @Column({ name: 'requisition_id', type: 'integer', nullable: true })
  RequisitionId!: number | null;

  @Column({ name: 'requisition_item_id', type: 'integer', nullable: true })
  RequisitionItemId!: number | null;

  @Column({ name: 'item_id', type: 'integer', nullable: false })
  ItemId!: number;

  @Column({ name: 'item_name', type: 'text', nullable: true })
  ItemName!: string | null;

  @Column({ name: 'batch_no', type: 'text', nullable: true })
  BatchNo!: string | null;

  @Column({ name: 'expiry_date', type: 'timestamp', nullable: true })
  ExpiryDate!: string | null;

  @Column({ name: 'bar_code_number', type: 'text', nullable: true })
  BarCodeNumber!: string | null;

  @Column({ name: 'mrp', type: 'numeric', nullable: true, transformer: NUM })
  MRP!: number | null;

  @Column({ name: 'price', type: 'numeric', nullable: true, transformer: NUM })
  Price!: number | null;

  @Column({ name: 'sub_total', type: 'numeric', nullable: false, transformer: NUM })
  SubTotal!: number;

  @Column({ name: 'remark', type: 'text', nullable: true })
  Remark!: string | null;

  @Column({ name: 'created_by', type: 'integer', nullable: false })
  CreatedBy!: number;

  @Column({ name: 'created_on', type: 'timestamp', nullable: true })
  CreatedOn!: string | null;

  @Column({ name: 'fixed_asset_stock_id', type: 'integer', nullable: true })
  FixedAssetStockId!: number | null;

}

@Entity({ name: 'inv_txn_fixed_asset_stock' })
export class FixedAssetStockModel {
  @PrimaryGeneratedColumn({ name: 'fixed_asset_stock_id' })
  FixedAssetStockId!: number;

  @Column({ name: 'goods_receipt_item_id', type: 'integer', nullable: true })
  GoodsReceiptItemId!: number | null;

  @Column({ name: 'item_id', type: 'integer', nullable: false })
  ItemId!: number;

  @Column({ name: 'asset_code', type: 'text', nullable: true })
  AssetCode!: string | null;

  @Column({ name: 'bar_code_number', type: 'text', nullable: true })
  BarCodeNumber!: string | null;

  @Column({ name: 'assets_location', type: 'text', nullable: true })
  AssetsLocation!: string | null;

  @Column({ name: 'batch_no', type: 'text', nullable: true })
  BatchNo!: string | null;

  @Column({ name: 'warranty_expiry_date', type: 'timestamp', nullable: true })
  WarrantyExpiryDate!: string | null;

  @Column({ name: 'item_rate', type: 'numeric', nullable: false, transformer: NUM })
  ItemRate!: number;

  @Column({ name: 'mrp', type: 'numeric', nullable: true, transformer: NUM })
  MRP!: number | null;

  @Column({ name: 'discount_percent', type: 'double precision', nullable: true })
  DiscountPercent!: number | null;

  @Column({ name: 'discount_amount', type: 'numeric', nullable: true, transformer: NUM })
  DiscountAmount!: number | null;

  @Column({ name: 'vat_amount', type: 'numeric', nullable: true, transformer: NUM })
  VATAmount!: number | null;

  @Column({ name: 'vat', type: 'double precision', nullable: true })
  VAT!: number | null;

  @Column({ name: 'cc_charge', type: 'numeric', nullable: true, transformer: NUM })
  CcCharge!: number | null;

  @Column({ name: 'cc_amount', type: 'numeric', nullable: true, transformer: NUM })
  CcAmount!: number | null;

  @Column({ name: 'other_charge', type: 'numeric', nullable: true, transformer: NUM })
  OtherCharge!: number | null;

  @Column({ name: 'created_by', type: 'integer', nullable: true })
  CreatedBy!: number | null;

  @Column({ name: 'created_on', type: 'timestamp', nullable: true })
  CreatedOn!: string | null;

  @Column({ name: 'modified_by', type: 'integer', nullable: true })
  ModifiedBy!: number | null;

  @Column({ name: 'modified_on', type: 'timestamp', nullable: true })
  ModifiedOn!: string | null;

  @Column({ name: 'cancelled_by', type: 'integer', nullable: true })
  CancelledBy!: number | null;

  @Column({ name: 'cancelled_on', type: 'timestamp', nullable: true })
  CancelledOn!: string | null;

  @Column({ name: 'counter_id', type: 'integer', nullable: true })
  CounterId!: number | null;

  @Column({ name: 'is_bar_code_generated', type: 'boolean', nullable: true })
  IsBarCodeGenerated!: boolean | null;

  @Column({ name: 'is_active', type: 'boolean', nullable: true })
  IsActive!: boolean | null;

  @Column({ name: 'is_asset_damaged', type: 'boolean', nullable: true })
  IsAssetDamaged!: boolean | null;

  @Column({ name: 'damaged_remarks', type: 'text', nullable: true })
  DamagedRemarks!: string | null;

  @Column({ name: 'undamaged_remarks', type: 'text', nullable: true })
  UndamagedRemarks!: string | null;

  @Column({ name: 'performance', type: 'text', nullable: true })
  Performance!: string | null;

  @Column({ name: 'total_life', type: 'integer', nullable: true })
  TotalLife!: number | null;

  @Column({ name: 'year_of_use', type: 'double precision', nullable: true })
  YearOfUse!: number | null;

  @Column({ name: 'manufacture_date', type: 'timestamp', nullable: true })
  ManufactureDate!: string | null;

  @Column({ name: 'is_under_maintenance', type: 'boolean', nullable: false })
  IsUnderMaintenance!: boolean;

  @Column({ name: 'serial_no', type: 'text', nullable: true })
  SerialNo!: string | null;

  @Column({ name: 'model_no', type: 'text', nullable: true })
  ModelNo!: string | null;

  @Column({ name: 'building_block_number', type: 'text', nullable: true })
  BuildingBlockNumber!: string | null;

  @Column({ name: 'floors', type: 'text', nullable: true })
  Floors!: string | null;

  @Column({ name: 'room_number', type: 'text', nullable: true })
  RoomNumber!: string | null;

  @Column({ name: 'room_position', type: 'text', nullable: true })
  RoomPosition!: string | null;

  @Column({ name: 'donation_id', type: 'integer', nullable: true })
  DonationId!: number | null;

  @Column({ name: 'asset_holder_id', type: 'integer', nullable: true })
  AssetHolderId!: number | null;

  @Column({ name: 'store_id', type: 'integer', nullable: false })
  StoreId!: number;

  @Column({ name: 'sub_store_id', type: 'integer', nullable: true })
  SubStoreId!: number | null;

  @Column({ name: 'is_maintenance_required', type: 'boolean', nullable: false })
  IsMaintenanceRequired!: boolean;

  @Column({ name: 'expected_value_after_useful_life', type: 'integer', nullable: true })
  ExpectedValueAfterUsefulLife!: number | null;

  @Column({ name: 'is_asset_damage_confirmed', type: 'boolean', nullable: false })
  IsAssetDamageConfirmed!: boolean;

  @Column({ name: 'is_asset_scraped', type: 'boolean', nullable: false })
  IsAssetScraped!: boolean;

  @Column({ name: 'scrap_amount', type: 'numeric', nullable: true, transformer: NUM })
  ScrapAmount!: number | null;

  @Column({ name: 'scrap_remarks', type: 'text', nullable: true })
  ScrapRemarks!: string | null;

  @Column({ name: 'scrap_cancel_remarks', type: 'text', nullable: true })
  ScrapCancelRemarks!: string | null;

  @Column({ name: 'periodic_service_days', type: 'integer', nullable: true })
  PeriodicServiceDays!: number | null;

  @Column({ name: 'installation_date', type: 'timestamp', nullable: true })
  InstallationDate!: string | null;

  @Column({ name: 'cssd_status', type: 'text', nullable: true })
  CssdStatus!: string | null;

  @Column({ name: 'stock_specification', type: 'text', nullable: true })
  StockSpecification!: string | null;

}
