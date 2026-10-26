/* GÉNÉRÉ par tools/generate-entities.mjs depuis migration/inventory/entities.json : ne pas modifier à la main. */
import { Column, Entity, PrimaryColumn, PrimaryGeneratedColumn } from 'typeorm';
import { NUM } from '../transformers';

@Entity({ name: 'ins_txn_claim_payment' })
export class InsuranceClaimPayment {
  @PrimaryGeneratedColumn({ name: 'claim_payment_id' })
  ClaimPaymentId!: number;

  @Column({ name: 'claim_submission_id', type: 'integer', nullable: false })
  ClaimSubmissionId!: number;

  @Column({ name: 'claim_code', type: 'bigint', nullable: false, transformer: NUM })
  ClaimCode!: number;

  @Column({ name: 'credit_organization_id', type: 'integer', nullable: false })
  CreditOrganizationId!: number;

  @Column({ name: 'received_amount', type: 'numeric', nullable: false, transformer: NUM })
  ReceivedAmount!: number;

  @Column({ name: 'service_commission', type: 'numeric', nullable: false, transformer: NUM })
  ServiceCommission!: number;

  @Column({ name: 'received_by', type: 'integer', nullable: false })
  ReceivedBy!: number;

  @Column({ name: 'received_on', type: 'timestamp', nullable: false })
  ReceivedOn!: string;

  @Column({ name: 'cheque_number', type: 'text', nullable: true })
  ChequeNumber!: string | null;

  @Column({ name: 'payment_details', type: 'text', nullable: true })
  PaymentDetails!: string | null;

  @Column({ name: 'bank_name', type: 'text', nullable: true })
  BankName!: string | null;

  @Column({ name: 'remarks', type: 'text', nullable: true })
  Remarks!: string | null;

}

@Entity({ name: 'ins_txn_insurance_claim' })
export class InsuranceClaim {
  @PrimaryGeneratedColumn({ name: 'claim_submission_id' })
  ClaimSubmissionId!: number;

  @Column({ name: 'claim_code', type: 'bigint', nullable: true, transformer: NUM })
  ClaimCode!: number | null;

  @Column({ name: 'claim_reference_no', type: 'text', nullable: true })
  ClaimReferenceNo!: string | null;

  @Column({ name: 'credit_organization_id', type: 'integer', nullable: false })
  CreditOrganizationId!: number;

  @Column({ name: 'patient_id', type: 'integer', nullable: false })
  PatientId!: number;

  @Column({ name: 'scheme_id', type: 'integer', nullable: false })
  SchemeId!: number;

  @Column({ name: 'patient_code', type: 'text', nullable: true })
  PatientCode!: string | null;

  @Column({ name: 'member_number', type: 'text', nullable: true })
  MemberNumber!: string | null;

  @Column({ name: 'claim_submitted_on', type: 'timestamp', nullable: false })
  ClaimSubmittedOn!: string;

  @Column({ name: 'claim_submitted_by', type: 'integer', nullable: false })
  ClaimSubmittedBy!: number;

  @Column({ name: 'claim_status', type: 'text', nullable: true })
  ClaimStatus!: string | null;

  @Column({ name: 'total_bill_amount', type: 'numeric', nullable: false, transformer: NUM })
  TotalBillAmount!: number;

  @Column({ name: 'claimable_amount', type: 'numeric', nullable: false, transformer: NUM })
  ClaimableAmount!: number;

  @Column({ name: 'non_claimable_amount', type: 'numeric', nullable: false, transformer: NUM })
  NonClaimableAmount!: number;

  @Column({ name: 'claimed_amount', type: 'numeric', nullable: false, transformer: NUM })
  ClaimedAmount!: number;

  @Column({ name: 'claim_remarks', type: 'text', nullable: true })
  ClaimRemarks!: string | null;

  @Column({ name: 'modified_by', type: 'integer', nullable: true })
  ModifiedBy!: number | null;

  @Column({ name: 'modified_on', type: 'timestamp', nullable: true })
  ModifiedOn!: string | null;

  @Column({ name: 'approved_amount', type: 'numeric', nullable: false, transformer: NUM })
  ApprovedAmount!: number;

  @Column({ name: 'rejected_amount', type: 'numeric', nullable: false, transformer: NUM })
  RejectedAmount!: number;

}

@Entity({ name: 'txn_uploaded_file' })
export class TXNUploadedFile {
  @PrimaryGeneratedColumn({ name: 'file_id' })
  FileId!: number;

  @Column({ name: 'system_feature_name', type: 'text', nullable: true })
  SystemFeatureName!: string | null;

  @Column({ name: 'patient_id', type: 'integer', nullable: false })
  PatientId!: number;

  @Column({ name: 'patient_visit_id', type: 'integer', nullable: true })
  PatientVisitId!: number | null;

  @Column({ name: 'claim_code', type: 'bigint', nullable: true, transformer: NUM })
  ClaimCode!: number | null;

  @Column({ name: 'reference_number', type: 'integer', nullable: false })
  ReferenceNumber!: number;

  @Column({ name: 'reference_entity_type', type: 'text', nullable: true })
  ReferenceEntityType!: string | null;

  @Column({ name: 'file_display_name', type: 'text', nullable: true })
  FileDisplayName!: string | null;

  @Column({ name: 'file_name', type: 'text', nullable: true })
  FileName!: string | null;

  @Column({ name: 'file_extension', type: 'text', nullable: true })
  FileExtension!: string | null;

  @Column({ name: 'file_location_full_path', type: 'text', nullable: true })
  FileLocationFullPath!: string | null;

  @Column({ name: 'file_description', type: 'text', nullable: true })
  FileDescription!: string | null;

  @Column({ name: 'uploaded_by', type: 'integer', nullable: false })
  UploadedBy!: number;

  @Column({ name: 'uploaded_on', type: 'timestamp', nullable: false })
  UploadedOn!: string;

  @Column({ name: 'is_active', type: 'boolean', nullable: false })
  IsActive!: boolean;

  @Column({ name: 'size', type: 'bigint', nullable: false, transformer: NUM })
  Size!: number;

}
