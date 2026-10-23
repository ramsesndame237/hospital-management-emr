/* GÉNÉRÉ par tools/generate-entities.mjs depuis migration/inventory/entities.json : ne pas modifier à la main. */
import { Column, Entity, PrimaryColumn, PrimaryGeneratedColumn } from 'typeorm';


@Entity({ name: 'ird_sync_invoices_common' })
export class IRD_Common_InvoiceModel {
  @PrimaryGeneratedColumn({ name: 'ird_invoice_id', type: 'bigint' })
  IrdInvoiceId!: number;

  @Column({ name: 'table_data_id', type: 'integer', nullable: false })
  table_data_id!: number;

  @Column({ name: 'module_name', type: 'text', nullable: true })
  module_name!: string | null;

  @Column({ name: 'invoice_type', type: 'text', nullable: true })
  invoice_type!: string | null;

  @Column({ name: 'seller_pan', type: 'text', nullable: true })
  seller_pan!: string | null;

  @Column({ name: 'buyer_pan', type: 'text', nullable: true })
  buyer_pan!: string | null;

  @Column({ name: 'buyer_name', type: 'text', nullable: true })
  buyer_name!: string | null;

  @Column({ name: 'fiscal_year', type: 'text', nullable: true })
  fiscal_year!: string | null;

  @Column({ name: 'invoice_number', type: 'text', nullable: true })
  invoice_number!: string | null;

  @Column({ name: 'invoice_date', type: 'text', nullable: true })
  invoice_date!: string | null;

  @Column({ name: 'invoice_date_eng', type: 'text', nullable: true })
  invoice_date_eng!: string | null;

  @Column({ name: 'total_sales', type: 'double precision', nullable: false })
  total_sales!: number;

  @Column({ name: 'discount_amount', type: 'double precision', nullable: true })
  discount_amount!: number | null;

  @Column({ name: 'taxable_sales_vat', type: 'double precision', nullable: true })
  taxable_sales_vat!: number | null;

  @Column({ name: 'vat', type: 'double precision', nullable: true })
  vat!: number | null;

  @Column({ name: 'excisable_amount', type: 'double precision', nullable: true })
  excisable_amount!: number | null;

  @Column({ name: 'excise', type: 'double precision', nullable: true })
  excise!: number | null;

  @Column({ name: 'taxable_sales_hst', type: 'double precision', nullable: true })
  taxable_sales_hst!: number | null;

  @Column({ name: 'hst', type: 'double precision', nullable: true })
  hst!: number | null;

  @Column({ name: 'amount_for_esf', type: 'double precision', nullable: true })
  amount_for_esf!: number | null;

  @Column({ name: 'esf', type: 'double precision', nullable: true })
  esf!: number | null;

  @Column({ name: 'export_sales', type: 'double precision', nullable: true })
  export_sales!: number | null;

  @Column({ name: 'tax_exempted_sales', type: 'double precision', nullable: true })
  tax_exempted_sales!: number | null;

  @Column({ name: 'entered_by', type: 'text', nullable: true })
  entered_by!: string | null;

  @Column({ name: 'is_printed', type: 'boolean', nullable: true })
  is_printed!: boolean | null;

  @Column({ name: 'printed_by', type: 'text', nullable: true })
  printed_by!: string | null;

  @Column({ name: 'print_count', type: 'integer', nullable: false })
  print_count!: number;

  @Column({ name: 'credit_note_number', type: 'text', nullable: true })
  credit_note_number!: string | null;

  @Column({ name: 'credit_note_date', type: 'text', nullable: true })
  credit_note_date!: string | null;

  @Column({ name: 'return_date_eng', type: 'text', nullable: true })
  return_date_eng!: string | null;

  @Column({ name: 'remarks', type: 'text', nullable: true })
  remarks!: string | null;

  @Column({ name: 'is_remote_synced', type: 'boolean', nullable: true })
  is_remote_synced!: boolean | null;

  @Column({ name: 'synced_on', type: 'timestamp', nullable: true })
  synced_on!: string | null;

  @Column({ name: 'sync_attempt_count', type: 'integer', nullable: false })
  sync_attempt_count!: number;

  @Column({ name: 'sync_response_msg', type: 'text', nullable: true })
  sync_response_msg!: string | null;

}
