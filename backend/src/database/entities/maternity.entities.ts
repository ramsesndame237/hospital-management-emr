/* GÉNÉRÉ par tools/generate-entities.mjs depuis migration/inventory/entities.json : ne pas modifier à la main. */
import { Column, Entity, PrimaryColumn, PrimaryGeneratedColumn } from 'typeorm';


@Entity({ name: 'mat_file_uploads' })
export class MaternityFileUploads {
  @PrimaryGeneratedColumn({ name: 'file_id' })
  FileId!: number;

  @Column({ name: 'maternity_patient_id', type: 'integer', nullable: false })
  MaternityPatientId!: number;

  @Column({ name: 'patient_id', type: 'integer', nullable: false })
  PatientId!: number;

  @Column({ name: 'file_name', type: 'text', nullable: true })
  FileName!: string | null;

  @Column({ name: 'file_type', type: 'text', nullable: true })
  FileType!: string | null;

  @Column({ name: 'display_name', type: 'text', nullable: true })
  DisplayName!: string | null;

  @Column({ name: 'created_on', type: 'timestamp', nullable: false })
  CreatedOn!: string;

  @Column({ name: 'created_by', type: 'integer', nullable: false })
  CreatedBy!: number;

  @Column({ name: 'modified_by', type: 'integer', nullable: true })
  ModifiedBy!: number | null;

  @Column({ name: 'modified_on', type: 'timestamp', nullable: true })
  ModifiedOn!: string | null;

  @Column({ name: 'is_active', type: 'boolean', nullable: false })
  IsActive!: boolean;

}

@Entity({ name: 'mat_maternity_anc' })
export class MaternityANC {
  @PrimaryGeneratedColumn({ name: 'maternity_anc_id' })
  MaternityANCId!: number;

  @Column({ name: 'maternity_patient_id', type: 'integer', nullable: false })
  MaternityPatientId!: number;

  @Column({ name: 'patient_id', type: 'integer', nullable: false })
  PatientId!: number;

  @Column({ name: 'anc_date_time', type: 'timestamp', nullable: false })
  ANCDateTime!: string;

  @Column({ name: 'visit_number', type: 'text', nullable: true })
  VisitNumber!: string | null;

  @Column({ name: 'anc_place', type: 'text', nullable: true })
  ANCPlace!: string | null;

  @Column({ name: 'pregnancy_period_in_weeks', type: 'integer', nullable: false })
  PregnancyPeriodInWeeks!: number;

  @Column({ name: 'condition_of_anc', type: 'text', nullable: true })
  ConditionOfANC!: string | null;

  @Column({ name: 'created_on', type: 'timestamp', nullable: false })
  CreatedOn!: string;

  @Column({ name: 'created_by', type: 'integer', nullable: false })
  CreatedBy!: number;

  @Column({ name: 'modified_by', type: 'integer', nullable: true })
  ModifiedBy!: number | null;

  @Column({ name: 'modified_on', type: 'timestamp', nullable: true })
  ModifiedOn!: string | null;

  @Column({ name: 'is_active', type: 'boolean', nullable: false })
  IsActive!: boolean;

  @Column({ name: 'weight', type: 'double precision', nullable: false })
  Weight!: number;

}

@Entity({ name: 'mat_patient' })
export class MaternityPatient {
  @PrimaryGeneratedColumn({ name: 'maternity_patient_id' })
  MaternityPatientId!: number;

  @Column({ name: 'patient_id', type: 'integer', nullable: false })
  PatientId!: number;

  @Column({ name: 'husband_name', type: 'text', nullable: true })
  HusbandName!: string | null;

  @Column({ name: 'height', type: 'double precision', nullable: false })
  Height!: number;

  @Column({ name: 'weight', type: 'double precision', nullable: false })
  Weight!: number;

  @Column({ name: 'last_menstrual_period', type: 'timestamp', nullable: true })
  LastMenstrualPeriod!: string | null;

  @Column({ name: 'expected_delivery_date', type: 'timestamp', nullable: true })
  ExpectedDeliveryDate!: string | null;

  @Column({ name: 'place_of_delivery', type: 'text', nullable: true })
  PlaceOfDelivery!: string | null;

  @Column({ name: 'presentation', type: 'text', nullable: true })
  Presentation!: string | null;

  @Column({ name: 'complications', type: 'text', nullable: true })
  Complications!: string | null;

  @Column({ name: 'delivery_date', type: 'timestamp', nullable: true })
  DeliveryDate!: string | null;

  @Column({ name: 'type_of_delivery', type: 'integer', nullable: false })
  TypeOfDelivery!: number;

  @Column({ name: 'obs_history', type: 'text', nullable: true })
  OBSHistory!: string | null;

  @Column({ name: 'created_on', type: 'timestamp', nullable: false })
  CreatedOn!: string;

  @Column({ name: 'created_by', type: 'integer', nullable: false })
  CreatedBy!: number;

  @Column({ name: 'modified_on', type: 'timestamp', nullable: true })
  ModifiedOn!: string | null;

  @Column({ name: 'modified_by', type: 'integer', nullable: true })
  ModifiedBy!: number | null;

  @Column({ name: 'concluded_on', type: 'timestamp', nullable: true })
  ConcludedOn!: string | null;

  @Column({ name: 'concluded_by', type: 'integer', nullable: true })
  ConcludedBy!: number | null;

  @Column({ name: 'is_active', type: 'boolean', nullable: false })
  IsActive!: boolean;

  @Column({ name: 'is_concluded', type: 'boolean', nullable: false })
  IsConcluded!: boolean;

}

@Entity({ name: 'mat_register' })
export class MaternityRegister {
  @PrimaryGeneratedColumn({ name: 'maternity_register_id' })
  MaternityRegisterId!: number;

  @Column({ name: 'maternity_patient_id', type: 'integer', nullable: false })
  MaternityPatientId!: number;

  @Column({ name: 'patient_id', type: 'integer', nullable: false })
  PatientId!: number;

  @Column({ name: 'gender', type: 'text', nullable: true })
  Gender!: string | null;

  @Column({ name: 'outcome_of_baby', type: 'text', nullable: true })
  OutcomeOfBaby!: string | null;

  @Column({ name: 'outcome_of_mother', type: 'text', nullable: true })
  OutcomeOfMother!: string | null;

  @Column({ name: 'weight_in_gram', type: 'integer', nullable: false })
  WeightInGram!: number;

  @Column({ name: 'created_on', type: 'timestamp', nullable: false })
  CreatedOn!: string;

  @Column({ name: 'created_by', type: 'integer', nullable: false })
  CreatedBy!: number;

  @Column({ name: 'modified_by', type: 'integer', nullable: true })
  ModifiedBy!: number | null;

  @Column({ name: 'modified_on', type: 'timestamp', nullable: true })
  ModifiedOn!: string | null;

  @Column({ name: 'is_active', type: 'boolean', nullable: false })
  IsActive!: boolean;

}

@Entity({ name: 'mat_txn_patient_payments' })
export class MaternityPayment {
  @PrimaryGeneratedColumn({ name: 'patient_payment_id' })
  PatientPaymentId!: number;

  @Column({ name: 'fiscal_year_id', type: 'integer', nullable: false })
  FiscalYearId!: number;

  @Column({ name: 'receipt_no', type: 'integer', nullable: false })
  ReceiptNo!: number;

  @Column({ name: 'transaction_type', type: 'text', nullable: true })
  TransactionType!: string | null;

  @Column({ name: 'patient_id', type: 'integer', nullable: false })
  PatientId!: number;

  @Column({ name: 'in_amount', type: 'double precision', nullable: false })
  InAmount!: number;

  @Column({ name: 'out_amount', type: 'double precision', nullable: false })
  OutAmount!: number;

  @Column({ name: 'remarks', type: 'text', nullable: true })
  Remarks!: string | null;

  @Column({ name: 'created_by', type: 'integer', nullable: false })
  CreatedBy!: number;

  @Column({ name: 'created_on', type: 'timestamp', nullable: true })
  CreatedOn!: string | null;

  @Column({ name: 'is_active', type: 'boolean', nullable: false })
  IsActive!: boolean;

  @Column({ name: 'payment_mode', type: 'text', nullable: true })
  PaymentMode!: string | null;

}
