/* GÉNÉRÉ par tools/generate-entities.mjs depuis migration/inventory/entities.json : ne pas modifier à la main. */
import { Column, Entity, PrimaryColumn, PrimaryGeneratedColumn } from 'typeorm';


@Entity({ name: 'cfg_printer_settings' })
export class PrinterSettingsModel {
  @PrimaryGeneratedColumn({ name: 'printer_setting_id' })
  PrinterSettingId!: number;

  @Column({ name: 'printing_type', type: 'text', nullable: true })
  PrintingType!: string | null;

  @Column({ name: 'group_name', type: 'text', nullable: true })
  GroupName!: string | null;

  @Column({ name: 'printer_display_name', type: 'text', nullable: true })
  PrinterDisplayName!: string | null;

  @Column({ name: 'printer_name', type: 'text', nullable: true })
  PrinterName!: string | null;

  @Column({ name: 'model_name', type: 'text', nullable: true })
  ModelName!: string | null;

  @Column({ name: 'width_lines', type: 'integer', nullable: true })
  Width_Lines!: number | null;

  @Column({ name: 'height_lines', type: 'integer', nullable: true })
  Height_Lines!: number | null;

  @Column({ name: 'header_gap_lines', type: 'integer', nullable: true })
  HeaderGap_Lines!: number | null;

  @Column({ name: 'footer_gap_lines', type: 'integer', nullable: true })
  FooterGap_Lines!: number | null;

  @Column({ name: 'mh', type: 'integer', nullable: true })
  mh!: number | null;

  @Column({ name: 'ml', type: 'integer', nullable: true })
  ml!: number | null;

  @Column({ name: 'server_folder_path', type: 'text', nullable: true })
  ServerFolderPath!: string | null;

  @Column({ name: 'remarks', type: 'text', nullable: true })
  Remarks!: string | null;

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

@Entity({ name: 'mst_invoice_headers' })
export class InvoiceHeaderModel {
  @PrimaryGeneratedColumn({ name: 'invoice_header_id' })
  InvoiceHeaderId!: number;

  @Column({ name: 'module', type: 'text', nullable: true })
  Module!: string | null;

  @Column({ name: 'header_description', type: 'text', nullable: true })
  HeaderDescription!: string | null;

  @Column({ name: 'hospital_name', type: 'text', nullable: true })
  HospitalName!: string | null;

  @Column({ name: 'address', type: 'text', nullable: true })
  Address!: string | null;

  @Column({ name: 'email', type: 'text', nullable: true })
  Email!: string | null;

  @Column({ name: 'pan', type: 'text', nullable: true })
  PAN!: string | null;

  @Column({ name: 'telephone', type: 'text', nullable: true })
  Telephone!: string | null;

  @Column({ name: 'dda', type: 'text', nullable: true })
  DDA!: string | null;

  @Column({ name: 'logo_file_name', type: 'text', nullable: true })
  LogoFileName!: string | null;

  @Column({ name: 'logo_file_extention', type: 'text', nullable: true })
  LogoFileExtention!: string | null;

  @Column({ name: 'created_on', type: 'timestamp', nullable: true })
  CreatedOn!: string | null;

  @Column({ name: 'created_by', type: 'integer', nullable: true })
  CreatedBy!: number | null;

  @Column({ name: 'is_active', type: 'boolean', nullable: true })
  IsActive!: boolean | null;

  @Column({ name: 'modified_on', type: 'timestamp', nullable: true })
  ModifiedOn!: string | null;

  @Column({ name: 'modified_by', type: 'integer', nullable: true })
  ModifiedBy!: number | null;

}

@Entity({ name: 'txn_emp_cash_transaction' })
export class EmpCashTransactionModel {
  @PrimaryGeneratedColumn({ name: 'cash_txn_id' })
  CashTxnId!: number;

  @Column({ name: 'transaction_type', type: 'text', nullable: true })
  TransactionType!: string | null;

  @Column({ name: 'reference_no', type: 'integer', nullable: true })
  ReferenceNo!: number | null;

  @Column({ name: 'employee_id', type: 'integer', nullable: false })
  EmployeeId!: number;

  @Column({ name: 'in_amount', type: 'double precision', nullable: true })
  InAmount!: number | null;

  @Column({ name: 'out_amount', type: 'double precision', nullable: true })
  OutAmount!: number | null;

  @Column({ name: 'description', type: 'text', nullable: true })
  Description!: string | null;

  @Column({ name: 'transaction_date', type: 'timestamp', nullable: false })
  TransactionDate!: string;

  @Column({ name: 'is_active', type: 'boolean', nullable: false })
  IsActive!: boolean;

  @Column({ name: 'counter_id', type: 'integer', nullable: true })
  CounterID!: number | null;

  @Column({ name: 'payment_mode_sub_category_id', type: 'integer', nullable: false })
  PaymentModeSubCategoryId!: number;

  @Column({ name: 'patient_id', type: 'integer', nullable: true })
  PatientId!: number | null;

  @Column({ name: 'module_name', type: 'text', nullable: true })
  ModuleName!: string | null;

  @Column({ name: 'remarks', type: 'text', nullable: true })
  Remarks!: string | null;

  @Column({ name: 'is_transferred_to_acc', type: 'boolean', nullable: false })
  IsTransferredToAcc!: boolean;

}

@Entity({ name: 'txn_emp_due_amount' })
export class EmpDueAmountModel {
  @PrimaryGeneratedColumn({ name: 'employee_due_id' })
  EmployeeDueId!: number;

  @Column({ name: 'employee_id', type: 'integer', nullable: false })
  EmployeeId!: number;

  @Column({ name: 'latest_due_amount', type: 'double precision', nullable: true })
  LatestDueAmount!: number | null;

  @Column({ name: 'latest_transaction_date', type: 'timestamp', nullable: false })
  LatestTransactionDate!: string;

}
