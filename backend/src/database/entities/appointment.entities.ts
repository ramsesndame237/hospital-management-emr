/* GÉNÉRÉ par tools/generate-entities.mjs depuis migration/inventory/entities.json : ne pas modifier à la main. */
import { Column, Entity, PrimaryColumn, PrimaryGeneratedColumn } from 'typeorm';
import { NUM } from '../transformers';

@Entity({ name: 'pat_apf_rank' })
export class Rank {
  @PrimaryGeneratedColumn({ name: 'rank_id' })
  RankId!: number;

  @Column({ name: 'rank_name', type: 'text', nullable: true })
  RankName!: string | null;

  @Column({ name: 'is_active', type: 'boolean', nullable: false })
  IsActive!: boolean;

}

@Entity({ name: 'pat_appointment' })
export class AppointmentModel {
  @PrimaryGeneratedColumn({ name: 'appointment_id' })
  AppointmentId!: number;

  @Column({ name: 'patient_id', type: 'integer', nullable: true })
  PatientId!: number | null;

  @Column({ name: 'first_name', type: 'text', nullable: true })
  FirstName!: string | null;

  @Column({ name: 'middle_name', type: 'text', nullable: true })
  MiddleName!: string | null;

  @Column({ name: 'last_name', type: 'text', nullable: true })
  LastName!: string | null;

  @Column({ name: 'gender', type: 'text', nullable: true })
  Gender!: string | null;

  @Column({ name: 'age', type: 'text', nullable: true })
  Age!: string | null;

  @Column({ name: 'contact_number', type: 'text', nullable: true })
  ContactNumber!: string | null;

  @Column({ name: 'appointment_date', type: 'timestamp', nullable: false })
  AppointmentDate!: string;

  @Column({ name: 'appointment_time', type: 'interval', nullable: false })
  AppointmentTime!: string;

  @Column({ name: 'performer_id', type: 'integer', nullable: true })
  PerformerId!: number | null;

  @Column({ name: 'performer_name', type: 'text', nullable: true })
  PerformerName!: string | null;

  @Column({ name: 'appointment_type', type: 'text', nullable: true })
  AppointmentType!: string | null;

  @Column({ name: 'appointment_status', type: 'text', nullable: true })
  AppointmentStatus!: string | null;

  @Column({ name: 'created_on', type: 'timestamp', nullable: true })
  CreatedOn!: string | null;

  @Column({ name: 'created_by', type: 'integer', nullable: true })
  CreatedBy!: number | null;

  @Column({ name: 'modified_on', type: 'timestamp', nullable: true })
  ModifiedOn!: string | null;

  @Column({ name: 'modified_by', type: 'integer', nullable: true })
  ModifiedBy!: number | null;

  @Column({ name: 'reason', type: 'text', nullable: true })
  Reason!: string | null;

  @Column({ name: 'cancelled_on', type: 'timestamp', nullable: true })
  CancelledOn!: string | null;

  @Column({ name: 'cancelled_by', type: 'integer', nullable: true })
  CancelledBy!: number | null;

  @Column({ name: 'cancelled_remarks', type: 'text', nullable: true })
  CancelledRemarks!: string | null;

  @Column({ name: 'department_id', type: 'integer', nullable: true })
  DepartmentId!: number | null;

}

@Entity({ name: 'pat_patient_visits' })
export class VisitModel {
  @PrimaryGeneratedColumn({ name: 'patient_visit_id' })
  PatientVisitId!: number;

  @Column({ name: 'visit_code', type: 'text', nullable: true })
  VisitCode!: string | null;

  @Column({ name: 'patient_id', type: 'integer', nullable: false })
  PatientId!: number;

  @Column({ name: 'visit_date', type: 'timestamp', nullable: false })
  VisitDate!: string;

  @Column({ name: 'queue_status', type: 'text', nullable: true })
  QueueStatus!: string | null;

  @Column({ name: 'performer_id', type: 'integer', nullable: true })
  PerformerId!: number | null;

  @Column({ name: 'performer_name', type: 'text', nullable: true })
  PerformerName!: string | null;

  @Column({ name: 'comments', type: 'text', nullable: true })
  Comments!: string | null;

  @Column({ name: 'referred_by', type: 'text', nullable: true })
  ReferredBy!: string | null;

  @Column({ name: 'visit_type', type: 'text', nullable: true })
  VisitType!: string | null;

  @Column({ name: 'visit_status', type: 'text', nullable: true })
  VisitStatus!: string | null;

  @Column({ name: 'visit_time', type: 'interval', nullable: true })
  VisitTime!: string | null;

  @Column({ name: 'visit_duration', type: 'integer', nullable: true })
  VisitDuration!: number | null;

  @Column({ name: 'appointment_id', type: 'integer', nullable: true })
  AppointmentId!: number | null;

  @Column({ name: 'billing_status', type: 'text', nullable: true })
  BillingStatus!: string | null;

  @Column({ name: 'referred_by_id', type: 'integer', nullable: true })
  ReferredById!: number | null;

  @Column({ name: 'appointment_type', type: 'text', nullable: true })
  AppointmentType!: string | null;

  @Column({ name: 'parent_visit_id', type: 'integer', nullable: true })
  ParentVisitId!: number | null;

  @Column({ name: 'is_visit_continued', type: 'boolean', nullable: false })
  IsVisitContinued!: boolean;

  @Column({ name: 'created_on', type: 'timestamp', nullable: false })
  CreatedOn!: string;

  @Column({ name: 'created_by', type: 'integer', nullable: false })
  CreatedBy!: number;

  @Column({ name: 'is_active', type: 'boolean', nullable: false })
  IsActive!: boolean;

  @Column({ name: 'is_triaged', type: 'boolean', nullable: false })
  IsTriaged!: boolean;

  @Column({ name: 'modified_on', type: 'timestamp', nullable: true })
  ModifiedOn!: string | null;

  @Column({ name: 'modified_by', type: 'integer', nullable: true })
  ModifiedBy!: number | null;

  @Column({ name: 'remarks', type: 'text', nullable: true })
  Remarks!: string | null;

  @Column({ name: 'claim_code', type: 'bigint', nullable: true, transformer: NUM })
  ClaimCode!: number | null;

  @Column({ name: 'is_signed_visit_summary', type: 'boolean', nullable: false })
  IsSignedVisitSummary!: boolean;

  @Column({ name: 'prescriber_id', type: 'integer', nullable: true })
  PrescriberId!: number | null;

  @Column({ name: 'conclude_date', type: 'timestamp', nullable: true })
  ConcludeDate!: string | null;

  @Column({ name: 'department_id', type: 'integer', nullable: false })
  DepartmentId!: number;

  @Column({ name: 'queue_no', type: 'integer', nullable: true })
  QueueNo!: number | null;

  @Column({ name: 'ins_has_insurance', type: 'boolean', nullable: false })
  Ins_HasInsurance!: boolean;

  @Column({ name: 'price_category_id', type: 'integer', nullable: false })
  PriceCategoryId!: number;

  @Column({ name: 'scheme_id', type: 'integer', nullable: false })
  SchemeId!: number;

  @Column({ name: 'ticket_charge', type: 'numeric', nullable: false, transformer: NUM })
  TicketCharge!: number;

  @Column({ name: 'sub_scheme_id', type: 'integer', nullable: true })
  SubSchemeId!: number | null;

  @Column({ name: 'is_free_visit', type: 'boolean', nullable: false })
  IsFreeVisit!: boolean;

}
