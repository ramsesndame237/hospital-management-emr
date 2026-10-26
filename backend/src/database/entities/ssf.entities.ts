/* GÉNÉRÉ par tools/generate-entities.mjs depuis migration/inventory/entities.json : ne pas modifier à la main. */
import { Column, Entity, PrimaryColumn, PrimaryGeneratedColumn } from 'typeorm';
import { NUM } from '../transformers';

@Entity({ name: 'pat_ssf_claim_booking' })
export class SSFClaimBookingModel {
  @PrimaryGeneratedColumn({ name: 'claim_booking_id' })
  ClaimBookingId!: number;

  @Column({ name: 'patient_id', type: 'integer', nullable: false })
  PatientId!: number;

  @Column({ name: 'hospital_no', type: 'text', nullable: true })
  HospitalNo!: string | null;

  @Column({ name: 'policy_no', type: 'text', nullable: true })
  PolicyNo!: string | null;

  @Column({ name: 'latest_claim_code', type: 'bigint', nullable: false, transformer: NUM })
  LatestClaimCode!: number;

  @Column({ name: 'response_data', type: 'text', nullable: true })
  ResponseData!: string | null;

  @Column({ name: 'billing_invoice_no', type: 'text', nullable: true })
  BillingInvoiceNo!: string | null;

  @Column({ name: 'pharmacy_invoice_no', type: 'text', nullable: true })
  PharmacyInvoiceNo!: string | null;

  @Column({ name: 'booking_request_date', type: 'timestamp', nullable: false })
  BookingRequestDate!: string;

  @Column({ name: 'booking_response_date', type: 'timestamp', nullable: true })
  BookingResponseDate!: string | null;

  @Column({ name: 'booked_by', type: 'integer', nullable: false })
  BookedBy!: number;

  @Column({ name: 're_booked_by', type: 'integer', nullable: true })
  ReBookedBy!: number | null;

  @Column({ name: 're_booking_date', type: 'timestamp', nullable: true })
  ReBookingDate!: string | null;

  @Column({ name: 'booking_status', type: 'boolean', nullable: false })
  BookingStatus!: boolean;

  @Column({ name: 'is_claimed', type: 'boolean', nullable: false })
  IsClaimed!: boolean;

  @Column({ name: 'is_active', type: 'boolean', nullable: false })
  IsActive!: boolean;

}

@Entity({ name: 'pat_ssf_claim_response_details' })
export class SSFClaimResponseDetails {
  @PrimaryGeneratedColumn({ name: 'id' })
  Id!: number;

  @Column({ name: 'claim_code', type: 'bigint', nullable: false, transformer: NUM })
  ClaimCode!: number;

  @Column({ name: 'claim_reference_no', type: 'text', nullable: true })
  ClaimReferenceNo!: string | null;

  @Column({ name: 'patient_id', type: 'integer', nullable: false })
  PatientId!: number;

  @Column({ name: 'patient_code', type: 'text', nullable: true })
  PatientCode!: string | null;

  @Column({ name: 'claimed_date', type: 'timestamp', nullable: false })
  ClaimedDate!: string;

  @Column({ name: 'response_data', type: 'text', nullable: true })
  ResponseData!: string | null;

  @Column({ name: 'invoice_no_csv', type: 'text', nullable: true })
  InvoiceNoCSV!: string | null;

  @Column({ name: 'claim_request_date', type: 'timestamp', nullable: false })
  ClaimRequestDate!: string;

  @Column({ name: 'claim_status', type: 'text', nullable: true })
  ClaimStatus!: string | null;

  @Column({ name: 'response_date', type: 'timestamp', nullable: false })
  ResponseDate!: string;

  @Column({ name: 'response_status', type: 'boolean', nullable: false })
  ResponseStatus!: boolean;

  @Column({ name: 'claim_count', type: 'integer', nullable: false })
  ClaimCount!: number;

}
