/* GÉNÉRÉ par tools/generate-entities.mjs depuis migration/inventory/entities.json : ne pas modifier à la main. */
import { Column, Entity, PrimaryColumn, PrimaryGeneratedColumn } from 'typeorm';


@Entity({ name: 'cssd_txn_item_transaction' })
export class CssdItemTransactionModel {
  @PrimaryGeneratedColumn({ name: 'cssd_txn_id' })
  CssdTxnId!: number;

  @Column({ name: 'fixed_asset_stock_id', type: 'integer', nullable: false })
  FixedAssetStockId!: number;

  @Column({ name: 'item_id', type: 'integer', nullable: false })
  ItemId!: number;

  @Column({ name: 'store_id', type: 'integer', nullable: false })
  StoreId!: number;

  @Column({ name: 'requested_by', type: 'integer', nullable: false })
  RequestedBy!: number;

  @Column({ name: 'requested_on', type: 'timestamp', nullable: false })
  RequestedOn!: string;

  @Column({ name: 'request_remarks', type: 'text', nullable: true })
  RequestRemarks!: string | null;

  @Column({ name: 'disinfectant_name', type: 'text', nullable: true })
  DisinfectantName!: string | null;

  @Column({ name: 'disinfected_by', type: 'integer', nullable: true })
  DisinfectedBy!: number | null;

  @Column({ name: 'disinfected_on', type: 'timestamp', nullable: true })
  DisinfectedOn!: string | null;

  @Column({ name: 'disinfection_remarks', type: 'text', nullable: true })
  DisinfectionRemarks!: string | null;

  @Column({ name: 'dispatched_by', type: 'integer', nullable: true })
  DispatchedBy!: number | null;

  @Column({ name: 'dispatched_on', type: 'timestamp', nullable: true })
  DispatchedOn!: string | null;

  @Column({ name: 'dispatch_remarks', type: 'text', nullable: true })
  DispatchRemarks!: string | null;

  @Column({ name: 'cssd_status', type: 'text', nullable: true })
  CssdStatus!: string | null;

  @Column({ name: 'created_by', type: 'integer', nullable: false })
  CreatedBy!: number;

  @Column({ name: 'created_on', type: 'timestamp', nullable: false })
  CreatedOn!: string;

}
