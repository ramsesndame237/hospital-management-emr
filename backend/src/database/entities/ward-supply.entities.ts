/* GÉNÉRÉ par tools/generate-entities.mjs depuis migration/inventory/entities.json : ne pas modifier à la main. */
import { Column, Entity, PrimaryColumn, PrimaryGeneratedColumn } from 'typeorm';
import { NUM } from '../transformers';

@Entity({ name: '_ward_inv_consumption_receipt_' })
export class InvPatientConsumptionReceiptModel {
  @PrimaryGeneratedColumn({ name: 'consumption_receipt_id' })
  ConsumptionReceiptId!: number;

  @Column({ name: 'consumption_receipt_no', type: 'integer', nullable: false })
  ConsumptionReceiptNo!: number;

  @Column({ name: 'consumption_date', type: 'timestamp', nullable: false })
  ConsumptionDate!: string;

  @Column({ name: 'patient_id', type: 'integer', nullable: false })
  PatientId!: number;

  @Column({ name: 'store_id', type: 'integer', nullable: false })
  StoreId!: number;

  @Column({ name: 'remarks', type: 'text', nullable: true })
  Remarks!: string | null;

  @Column({ name: 'is_cancel', type: 'boolean', nullable: true })
  IsCancel!: boolean | null;

  @Column({ name: 'created_by', type: 'integer', nullable: false })
  CreatedBy!: number;

  @Column({ name: 'created_on', type: 'timestamp', nullable: false })
  CreatedOn!: string;

  @Column({ name: 'modified_by', type: 'integer', nullable: true })
  ModifiedBy!: number | null;

  @Column({ name: 'modified_on', type: 'timestamp', nullable: true })
  ModifiedOn!: string | null;

}

@Entity({ name: 'inv_txn_fixed_asset_requisition' })
export class WARDSupplyAssetRequisitionModel {
  @PrimaryGeneratedColumn({ name: 'requisition_id' })
  RequisitionId!: number;

  @Column({ name: 'requisition_date', type: 'timestamp', nullable: false })
  RequisitionDate!: string;

  @Column({ name: 'created_by', type: 'integer', nullable: true })
  CreatedBy!: number | null;

  @Column({ name: 'created_on', type: 'timestamp', nullable: true })
  CreatedOn!: string | null;

  @Column({ name: 'requisition_status', type: 'text', nullable: true })
  RequisitionStatus!: string | null;

  @Column({ name: 'issue_no', type: 'integer', nullable: true })
  IssueNo!: number | null;

  @Column({ name: 'store_id', type: 'integer', nullable: true })
  StoreId!: number | null;

  @Column({ name: 'sub_store_id', type: 'integer', nullable: true })
  SubStoreId!: number | null;

  @Column({ name: 'modified_on', type: 'timestamp', nullable: true })
  ModifiedOn!: string | null;

  @Column({ name: 'modified_by', type: 'integer', nullable: false })
  ModifiedBy!: number;

  @Column({ name: 'is_cancel', type: 'boolean', nullable: true })
  IsCancel!: boolean | null;

  @Column({ name: 'cancel_remarks', type: 'text', nullable: true })
  CancelRemarks!: string | null;

  @Column({ name: 'requisition_no', type: 'integer', nullable: true })
  RequisitionNo!: number | null;

  @Column({ name: 'remarks', type: 'text', nullable: true })
  Remarks!: string | null;

  @Column({ name: 'is_direct_dispatch', type: 'boolean', nullable: true })
  IsDirectDispatch!: boolean | null;

}

@Entity({ name: 'inv_txn_fixed_asset_requisition_items' })
export class WARDSupplyAssetRequisitionItemsModel {
  @PrimaryGeneratedColumn({ name: 'requisition_item_id' })
  RequisitionItemId!: number;

  @Column({ name: 'item_id', type: 'integer', nullable: true })
  ItemId!: number | null;

  @Column({ name: 'quantity', type: 'integer', nullable: true })
  Quantity!: number | null;

  @Column({ name: 'requisition_id', type: 'integer', nullable: false })
  RequisitionId!: number;

  @Column({ name: 'created_by', type: 'integer', nullable: true })
  CreatedBy!: number | null;

  @Column({ name: 'created_on', type: 'timestamp', nullable: true })
  CreatedOn!: string | null;

  @Column({ name: 'received_quantity', type: 'double precision', nullable: true })
  ReceivedQuantity!: number | null;

  @Column({ name: 'pending_quantity', type: 'double precision', nullable: true })
  PendingQuantity!: number | null;

  @Column({ name: 'requisition_item_status', type: 'text', nullable: true })
  RequisitionItemStatus!: string | null;

  @Column({ name: 'remark', type: 'text', nullable: true })
  Remark!: string | null;

  @Column({ name: 'issue_no', type: 'integer', nullable: true })
  IssueNo!: number | null;

  @Column({ name: 'cancel_quantity', type: 'double precision', nullable: true })
  CancelQuantity!: number | null;

  @Column({ name: 'cancel_by', type: 'integer', nullable: true })
  CancelBy!: number | null;

  @Column({ name: 'cancel_on', type: 'timestamp', nullable: true })
  CancelOn!: string | null;

  @Column({ name: 'is_active', type: 'boolean', nullable: false })
  IsActive!: boolean;

  @Column({ name: 'modified_on', type: 'timestamp', nullable: true })
  ModifiedOn!: string | null;

  @Column({ name: 'modified_by', type: 'integer', nullable: true })
  ModifiedBy!: number | null;

  @Column({ name: 'cancel_remarks', type: 'text', nullable: true })
  CancelRemarks!: string | null;

}

@Entity({ name: 'inv_txn_fixed_asset_return' })
export class WARDSupplyAssetReturnModel {
  @PrimaryGeneratedColumn({ name: 'return_id' })
  ReturnId!: number;

  @Column({ name: 'store_id', type: 'integer', nullable: false })
  StoreId!: number;

  @Column({ name: 'sub_store_id', type: 'integer', nullable: false })
  SubStoreId!: number;

  @Column({ name: 'return_date', type: 'timestamp', nullable: true })
  ReturnDate!: string | null;

  @Column({ name: 'remarks', type: 'text', nullable: true })
  Remarks!: string | null;

  @Column({ name: 'created_by', type: 'integer', nullable: false })
  CreatedBy!: number;

  @Column({ name: 'created_on', type: 'timestamp', nullable: true })
  CreatedOn!: string | null;

  @Column({ name: 'modified_on', type: 'timestamp', nullable: true })
  ModifiedOn!: string | null;

  @Column({ name: 'modified_by', type: 'integer', nullable: true })
  ModifiedBy!: number | null;

}

@Entity({ name: 'inv_txn_fixed_asset_return_items' })
export class WARDSupplyAssetReturnItemsModel {
  @PrimaryGeneratedColumn({ name: 'return_item_id' })
  ReturnItemId!: number;

  @Column({ name: 'item_id', type: 'integer', nullable: false })
  ItemId!: number;

  @Column({ name: 'return_id', type: 'integer', nullable: false })
  ReturnId!: number;

  @Column({ name: 'fixed_asset_stock_id', type: 'integer', nullable: false })
  FixedAssetStockId!: number;

  @Column({ name: 'serial_no', type: 'integer', nullable: true })
  SerialNo!: number | null;

  @Column({ name: 'created_by', type: 'integer', nullable: false })
  CreatedBy!: number;

  @Column({ name: 'created_on', type: 'timestamp', nullable: true })
  CreatedOn!: string | null;

  @Column({ name: 'remark', type: 'text', nullable: true })
  Remark!: string | null;

}

@Entity({ name: 'ward_consumption' })
export class WARDConsumptionModel {
  @PrimaryGeneratedColumn({ name: 'consumption_id' })
  ConsumptionId!: number;

  @Column({ name: 'ward_id', type: 'integer', nullable: false })
  WardId!: number;

  @Column({ name: 'store_id', type: 'integer', nullable: false })
  StoreId!: number;

  @Column({ name: 'invoice_id', type: 'integer', nullable: true })
  InvoiceId!: number | null;

  @Column({ name: 'invoice_item_id', type: 'integer', nullable: false })
  InvoiceItemId!: number;

  @Column({ name: 'patient_id', type: 'integer', nullable: false })
  PatientId!: number;

  @Column({ name: 'item_id', type: 'integer', nullable: false })
  ItemId!: number;

  @Column({ name: 'visit_id', type: 'integer', nullable: true })
  VisitId!: number | null;

  @Column({ name: 'item_name', type: 'text', nullable: true })
  ItemName!: string | null;

  @Column({ name: 'batch_no', type: 'text', nullable: true })
  BatchNo!: string | null;

  @Column({ name: 'expiry_date', type: 'timestamp', nullable: false })
  ExpiryDate!: string;

  @Column({ name: 'quantity', type: 'integer', nullable: false })
  Quantity!: number;

  @Column({ name: 'sale_price', type: 'numeric', nullable: false, transformer: NUM })
  SalePrice!: number;

  @Column({ name: 'sub_total', type: 'numeric', nullable: false, transformer: NUM })
  SubTotal!: number;

  @Column({ name: 'remark', type: 'text', nullable: true })
  Remark!: string | null;

  @Column({ name: 'created_by', type: 'integer', nullable: false })
  CreatedBy!: number;

  @Column({ name: 'created_on', type: 'timestamp', nullable: true })
  CreatedOn!: string | null;

  @Column({ name: 'modified_on', type: 'timestamp', nullable: true })
  ModifiedOn!: string | null;

  @Column({ name: 'modified_by', type: 'integer', nullable: true })
  ModifiedBy!: number | null;

}

@Entity({ name: 'ward_dispatch' })
export class WARDDispatchModel {
  @PrimaryGeneratedColumn({ name: 'dispatch_id' })
  DispatchId!: number;

  @Column({ name: 'requisition_id', type: 'integer', nullable: true })
  RequisitionId!: number | null;

  @Column({ name: 'store_id', type: 'integer', nullable: false })
  StoreId!: number;

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

@Entity({ name: 'ward_dispatch_items' })
export class WARDDispatchItemsModel {
  @PrimaryGeneratedColumn({ name: 'dispatch_item_id' })
  DispatchItemId!: number;

  @Column({ name: 'dispatch_id', type: 'integer', nullable: false })
  DispatchId!: number;

  @Column({ name: 'requisition_item_id', type: 'integer', nullable: true })
  RequisitionItemId!: number | null;

  @Column({ name: 'item_id', type: 'integer', nullable: false })
  ItemId!: number;

  @Column({ name: 'item_name', type: 'text', nullable: true })
  ItemName!: string | null;

  @Column({ name: 'batch_no', type: 'text', nullable: true })
  BatchNo!: string | null;

  @Column({ name: 'expiry_date', type: 'timestamp', nullable: false })
  ExpiryDate!: string;

  @Column({ name: 'quantity', type: 'integer', nullable: false })
  Quantity!: number;

  @Column({ name: 'sale_price', type: 'numeric', nullable: true, transformer: NUM })
  SalePrice!: number | null;

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

}

@Entity({ name: 'ward_internal_consumption' })
export class WARDInternalConsumptionModel {
  @PrimaryGeneratedColumn({ name: 'consumption_id' })
  ConsumptionId!: number;

  @Column({ name: 'ward_id', type: 'integer', nullable: false })
  WardId!: number;

  @Column({ name: 'sub_store_id', type: 'integer', nullable: false })
  SubStoreId!: number;

  @Column({ name: 'department_id', type: 'integer', nullable: false })
  DepartmentId!: number;

  @Column({ name: 'total_amount', type: 'double precision', nullable: false })
  TotalAmount!: number;

  @Column({ name: 'remark', type: 'text', nullable: true })
  Remark!: string | null;

  @Column({ name: 'created_by', type: 'integer', nullable: false })
  CreatedBy!: number;

  @Column({ name: 'created_on', type: 'timestamp', nullable: false })
  CreatedOn!: string;

  @Column({ name: 'modified_on', type: 'timestamp', nullable: true })
  ModifiedOn!: string | null;

  @Column({ name: 'modified_by', type: 'integer', nullable: true })
  ModifiedBy!: number | null;

  @Column({ name: 'consumed_by', type: 'text', nullable: true })
  ConsumedBy!: string | null;

}

@Entity({ name: 'ward_internal_consumption_items' })
export class WARDInternalConsumptionItemsModel {
  @PrimaryGeneratedColumn({ name: 'consumption_item_id' })
  ConsumptionItemId!: number;

  @Column({ name: 'consumption_id', type: 'integer', nullable: false })
  ConsumptionId!: number;

  @Column({ name: 'item_id', type: 'integer', nullable: false })
  ItemId!: number;

  @Column({ name: 'ward_id', type: 'integer', nullable: false })
  WardId!: number;

  @Column({ name: 'sub_store_id', type: 'integer', nullable: false })
  SubStoreId!: number;

  @Column({ name: 'department_id', type: 'integer', nullable: false })
  DepartmentId!: number;

  @Column({ name: 'item_name', type: 'text', nullable: true })
  ItemName!: string | null;

  @Column({ name: 'batch_no', type: 'text', nullable: true })
  BatchNo!: string | null;

  @Column({ name: 'expiry_date', type: 'timestamp', nullable: false })
  ExpiryDate!: string;

  @Column({ name: 'sale_price', type: 'double precision', nullable: false })
  SalePrice!: number;

  @Column({ name: 'price', type: 'numeric', nullable: true, transformer: NUM })
  Price!: number | null;

  @Column({ name: 'quantity', type: 'integer', nullable: false })
  Quantity!: number;

  @Column({ name: 'subtotal', type: 'double precision', nullable: false })
  Subtotal!: number;

  @Column({ name: 'remark', type: 'text', nullable: true })
  Remark!: string | null;

  @Column({ name: 'created_by', type: 'integer', nullable: false })
  CreatedBy!: number;

  @Column({ name: 'created_on', type: 'timestamp', nullable: false })
  CreatedOn!: string;

  @Column({ name: 'modified_on', type: 'timestamp', nullable: true })
  ModifiedOn!: string | null;

  @Column({ name: 'modified_by', type: 'integer', nullable: true })
  ModifiedBy!: number | null;

}

@Entity({ name: 'ward_inv_consumption' })
export class WARDInventoryConsumptionModel {
  @PrimaryGeneratedColumn({ name: 'consumption_id' })
  ConsumptionId!: number;

  @Column({ name: 'store_id', type: 'integer', nullable: false })
  StoreId!: number;

  @Column({ name: 'department_id', type: 'integer', nullable: false })
  DepartmentId!: number;

  @Column({ name: 'department_name', type: 'text', nullable: true })
  DepartmentName!: string | null;

  @Column({ name: 'item_id', type: 'integer', nullable: false })
  ItemId!: number;

  @Column({ name: 'item_name', type: 'text', nullable: true })
  ItemName!: string | null;

  @Column({ name: 'quantity', type: 'double precision', nullable: false })
  Quantity!: number;

  @Column({ name: 'remark', type: 'text', nullable: true })
  Remark!: string | null;

  @Column({ name: 'used_by', type: 'text', nullable: true })
  UsedBy!: string | null;

  @Column({ name: 'created_by', type: 'integer', nullable: false })
  CreatedBy!: number;

  @Column({ name: 'created_on', type: 'timestamp', nullable: true })
  CreatedOn!: string | null;

  @Column({ name: 'consumption_date', type: 'timestamp', nullable: true })
  ConsumptionDate!: string | null;

  @Column({ name: 'consumption_receipt_id', type: 'integer', nullable: true })
  ConsumptionReceiptId!: number | null;

  @Column({ name: 'stock_id', type: 'integer', nullable: false })
  StockId!: number;

}

@Entity({ name: 'ward_requisition' })
export class WARDRequisitionModel {
  @PrimaryGeneratedColumn({ name: 'requisition_id' })
  RequisitionId!: number;

  @Column({ name: 'ward_id', type: 'integer', nullable: false })
  WardId!: number;

  @Column({ name: 'store_id', type: 'integer', nullable: false })
  StoreId!: number;

  @Column({ name: 'status', type: 'text', nullable: true })
  Status!: string | null;

  @Column({ name: 'reference_id', type: 'text', nullable: true })
  ReferenceId!: string | null;

  @Column({ name: 'created_by', type: 'integer', nullable: false })
  CreatedBy!: number;

  @Column({ name: 'created_on', type: 'timestamp', nullable: true })
  CreatedOn!: string | null;

}

@Entity({ name: 'ward_requisition_items' })
export class WARDRequisitionItemsModel {
  @PrimaryGeneratedColumn({ name: 'requisition_item_id' })
  RequisitionItemId!: number;

  @Column({ name: 'requisition_id', type: 'integer', nullable: false })
  RequisitionId!: number;

  @Column({ name: 'item_id', type: 'integer', nullable: false })
  ItemId!: number;

  @Column({ name: 'quantity', type: 'integer', nullable: false })
  Quantity!: number;

  @Column({ name: 'dispatched_qty', type: 'integer', nullable: false })
  DispatchedQty!: number;

}

@Entity({ name: 'ward_stock' })
export class WARDStockModel {
  @PrimaryGeneratedColumn({ name: 'stock_id' })
  StockId!: number;

  @Column({ name: 'ward_id', type: 'integer', nullable: true })
  WardId!: number | null;

  @Column({ name: 'store_id', type: 'integer', nullable: false })
  StoreId!: number;

  @Column({ name: 'item_id', type: 'integer', nullable: false })
  ItemId!: number;

  @Column({ name: 'available_quantity', type: 'integer', nullable: false })
  AvailableQuantity!: number;

  @Column({ name: 'sale_price', type: 'double precision', nullable: false })
  SalePrice!: number;

  @Column({ name: 'batch_no', type: 'text', nullable: true })
  BatchNo!: string | null;

  @Column({ name: 'expiry_date', type: 'timestamp', nullable: true })
  ExpiryDate!: string | null;

  @Column({ name: 'department_id', type: 'integer', nullable: true })
  DepartmentId!: number | null;

  @Column({ name: 'stock_type', type: 'text', nullable: true })
  StockType!: string | null;

  @Column({ name: 'price', type: 'numeric', nullable: true, transformer: NUM })
  Price!: number | null;

}

@Entity({ name: 'ward_transaction' })
export class WARDTransactionModel {
  @PrimaryGeneratedColumn({ name: 'transaction_id' })
  TransactionId!: number;

  @Column({ name: 'ward_id', type: 'integer', nullable: true })
  WardId!: number | null;

  @Column({ name: 'store_id', type: 'integer', nullable: true })
  StoreId!: number | null;

  @Column({ name: 'item_id', type: 'integer', nullable: false })
  ItemId!: number;

  @Column({ name: 'quantity', type: 'integer', nullable: false })
  Quantity!: number;

  @Column({ name: 'stock_id', type: 'integer', nullable: false })
  StockId!: number;

  @Column({ name: 'transaction_type', type: 'text', nullable: true })
  TransactionType!: string | null;

  @Column({ name: 'price', type: 'numeric', nullable: true, transformer: NUM })
  Price!: number | null;

  @Column({ name: 'created_by', type: 'text', nullable: true })
  CreatedBy!: string | null;

  @Column({ name: 'created_on', type: 'timestamp', nullable: false })
  CreatedOn!: string;

  @Column({ name: 'remarks', type: 'text', nullable: true })
  Remarks!: string | null;

  @Column({ name: 'is_ward', type: 'boolean', nullable: false })
  IsWard!: boolean;

  @Column({ name: 'new_ward_id', type: 'integer', nullable: false })
  newWardId!: number;

  @Column({ name: 'received_by', type: 'text', nullable: true })
  ReceivedBy!: string | null;

  @Column({ name: 'in_out', type: 'text', nullable: true })
  InOut!: string | null;

}

@Entity({ name: 'ward_sub_stores_map_model' })
export class WardSubStoresMAPModel {
  @PrimaryGeneratedColumn({ name: 'ward_sub_stores_map_id' })
  WardSubStoresMapId!: number;

  @Column({ name: 'ward_id', type: 'integer', nullable: false })
  WardId!: number;

  @Column({ name: 'store_id', type: 'integer', nullable: false })
  StoreId!: number;

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
