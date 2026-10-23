/* GÉNÉRÉ par tools/generate-entities.mjs depuis migration/inventory/entities.json : ne pas modifier à la main. */
import { Column, Entity, PrimaryColumn, PrimaryGeneratedColumn } from 'typeorm';
import { NUM } from '../transformers';

@Entity({ name: 'bil_txn_scheme_refund' })
export class SchemeRefundModel {
  @PrimaryGeneratedColumn({ name: 'scheme_refund_id' })
  SchemeRefundId!: number;

  @Column({ name: 'fiscal_year_id', type: 'integer', nullable: false })
  FiscalYearId!: number;

  @Column({ name: 'receipt_no', type: 'integer', nullable: false })
  ReceiptNo!: number;

  @Column({ name: 'scheme_id', type: 'integer', nullable: false })
  SchemeId!: number;

  @Column({ name: 'patient_id', type: 'integer', nullable: false })
  PatientId!: number;

  @Column({ name: 'inpatient_number', type: 'text', nullable: true })
  InpatientNumber!: string | null;

  @Column({ name: 'refund_amount', type: 'numeric', nullable: false, transformer: NUM })
  RefundAmount!: number;

  @Column({ name: 'remarks', type: 'text', nullable: true })
  Remarks!: string | null;

  @Column({ name: 'created_by', type: 'integer', nullable: false })
  CreatedBy!: number;

  @Column({ name: 'counter_id', type: 'integer', nullable: false })
  CounterId!: number;

  @Column({ name: 'created_on', type: 'timestamp', nullable: false })
  CreatedOn!: string;

  @Column({ name: 'modifed_by', type: 'integer', nullable: true })
  ModifedBy!: number | null;

  @Column({ name: 'modified_on', type: 'timestamp', nullable: true })
  ModifiedOn!: string | null;

  @Column({ name: 'is_active', type: 'boolean', nullable: false })
  IsActive!: boolean;

  @Column({ name: 'is_transferred_to_acc', type: 'boolean', nullable: false })
  IsTransferredToAcc!: boolean;

}

@Entity({ name: 'utl_cfg_process_confirmation_authority' })
export class ProcessConfirmationAuthorityModel {
  @PrimaryGeneratedColumn({ name: 'process_confirmation_authority_id' })
  ProcessConfirmationAuthorityId!: number;

  @Column({ name: 'process_to_confirm', type: 'text', nullable: true })
  ProcessToConfirm!: string | null;

  @Column({ name: 'permission_id', type: 'integer', nullable: false })
  PermissionId!: number;

  @Column({ name: 'role_id', type: 'integer', nullable: false })
  RoleId!: number;

}

@Entity({ name: 'vis_log_visit_scheme_change_history' })
export class VisitSchemeChangeHistoryModel {
  @PrimaryGeneratedColumn({ name: 'visit_scheme_change_history_id' })
  VisitSchemeChangeHistoryId!: number;

  @Column({ name: 'change_action', type: 'text', nullable: true })
  ChangeAction!: string | null;

  @Column({ name: 'patient_id', type: 'integer', nullable: false })
  PatientId!: number;

  @Column({ name: 'patient_visit_id', type: 'integer', nullable: false })
  PatientVisitId!: number;

  @Column({ name: 'old_scheme_id', type: 'integer', nullable: false })
  OldSchemeId!: number;

  @Column({ name: 'old_price_category_id', type: 'integer', nullable: false })
  OldPriceCategoryId!: number;

  @Column({ name: 'new_scheme_id', type: 'integer', nullable: false })
  NewSchemeId!: number;

  @Column({ name: 'new_price_category_id', type: 'integer', nullable: false })
  NewPriceCategoryId!: number;

  @Column({ name: 'remarks', type: 'text', nullable: true })
  Remarks!: string | null;

  @Column({ name: 'created_by', type: 'integer', nullable: false })
  CreatedBy!: number;

  @Column({ name: 'created_on', type: 'timestamp', nullable: false })
  CreatedOn!: string;

}
