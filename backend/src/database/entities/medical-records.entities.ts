/* GÉNÉRÉ par tools/generate-entities.mjs depuis migration/inventory/entities.json : ne pas modifier à la main. */
import { Column, Entity, PrimaryColumn, PrimaryGeneratedColumn } from 'typeorm';


@Entity({ name: 'mr_mst_operation_type' })
export class OperationTypeModel {
  @PrimaryGeneratedColumn({ name: 'operation_id' })
  OperationId!: number;

  @Column({ name: 'operation_name', type: 'text', nullable: true })
  OperationName!: string | null;

}

@Entity({ name: 'mr_record_summary' })
export class MedicalRecordModel {
  @PrimaryGeneratedColumn({ name: 'medical_record_id' })
  MedicalRecordId!: number;

  @Column({ name: 'patient_visit_id', type: 'integer', nullable: false })
  PatientVisitId!: number;

  @Column({ name: 'patient_id', type: 'integer', nullable: false })
  PatientId!: number;

  @Column({ name: 'discharge_type_id', type: 'integer', nullable: false })
  DischargeTypeId!: number;

  @Column({ name: 'discharge_condition_id', type: 'integer', nullable: true })
  DischargeConditionId!: number | null;

  @Column({ name: 'delivery_type_id', type: 'integer', nullable: true })
  DeliveryTypeId!: number | null;

  @Column({ name: 'death_period_type_id', type: 'integer', nullable: true })
  DeathPeriodTypeId!: number | null;

  @Column({ name: 'operation_type_id', type: 'integer', nullable: true })
  OperationTypeId!: number | null;

  @Column({ name: 'operated_by_doctor', type: 'integer', nullable: true })
  OperatedByDoctor!: number | null;

  @Column({ name: 'file_number', type: 'text', nullable: true })
  FileNumber!: string | null;

  @Column({ name: 'operation_diagnosis', type: 'text', nullable: true })
  OperationDiagnosis!: string | null;

  @Column({ name: 'operation_date', type: 'timestamp', nullable: true })
  OperationDate!: string | null;

  @Column({ name: 'is_operation_conducted', type: 'boolean', nullable: true })
  IsOperationConducted!: boolean | null;

  @Column({ name: 'remarks', type: 'text', nullable: true })
  Remarks!: string | null;

  @Column({ name: 'all_tests', type: 'text', nullable: true })
  AllTests!: string | null;

  @Column({ name: 'icd_code', type: 'text', nullable: true })
  ICDCode!: string | null;

  @Column({ name: 'case_main', type: 'text', nullable: true })
  CaseMain!: string | null;

  @Column({ name: 'case_sub', type: 'text', nullable: true })
  CaseSub!: string | null;

  @Column({ name: 'gravita_id', type: 'integer', nullable: true })
  GravitaId!: number | null;

  @Column({ name: 'gestational_week', type: 'integer', nullable: true })
  GestationalWeek!: number | null;

  @Column({ name: 'gestational_day', type: 'integer', nullable: true })
  GestationalDay!: number | null;

  @Column({ name: 'created_by', type: 'integer', nullable: true })
  CreatedBy!: number | null;

  @Column({ name: 'modified_by', type: 'integer', nullable: true })
  ModifiedBy!: number | null;

  @Column({ name: 'created_on', type: 'timestamp', nullable: true })
  CreatedOn!: string | null;

  @Column({ name: 'modified_on', type: 'timestamp', nullable: true })
  ModifiedOn!: string | null;

  @Column({ name: 'referred_date', type: 'timestamp', nullable: true })
  ReferredDate!: string | null;

  @Column({ name: 'referred_time', type: 'interval', nullable: true })
  ReferredTime!: string | null;

  @Column({ name: 'number_of_babies', type: 'integer', nullable: true })
  NumberOfBabies!: number | null;

  @Column({ name: 'blood_lost', type: 'integer', nullable: true })
  BloodLost!: number | null;

  @Column({ name: 'blood_lost_unit', type: 'text', nullable: true })
  BloodLostUnit!: string | null;

  @Column({ name: 'gestational_unit', type: 'text', nullable: true })
  GestationalUnit!: string | null;

}

@Entity({ name: 'mr_txn_emergency_final_diagnosis' })
export class EmergencyFinalDiagnosisModel {
  @PrimaryGeneratedColumn({ name: 'final_diagnosis_id' })
  FinalDiagnosisId!: number;

  @Column({ name: 'patient_visit_id', type: 'integer', nullable: false })
  PatientVisitId!: number;

  @Column({ name: 'patient_id', type: 'integer', nullable: false })
  PatientId!: number;

  @Column({ name: 'emer_disease_group_id', type: 'integer', nullable: false })
  EMER_DiseaseGroupId!: number;

  @Column({ name: 'created_by', type: 'integer', nullable: false })
  CreatedBy!: number;

  @Column({ name: 'created_on', type: 'timestamp', nullable: false })
  CreatedOn!: string;

  @Column({ name: 'modified_by', type: 'integer', nullable: true })
  ModifiedBy!: number | null;

  @Column({ name: 'modified_on', type: 'timestamp', nullable: true })
  ModifiedOn!: string | null;

  @Column({ name: 'is_active', type: 'boolean', nullable: false })
  IsActive!: boolean;

  @Column({ name: 'is_patient_referred', type: 'boolean', nullable: false })
  IsPatientReferred!: boolean;

  @Column({ name: 'referred_by', type: 'text', nullable: true })
  ReferredBy!: string | null;

  @Column({ name: 'referred_to', type: 'text', nullable: true })
  ReferredTo!: string | null;

}

@Entity({ name: 'mr_txn_inpatient_diagnosis' })
export class InpatientDiagnosisModel {
  @PrimaryGeneratedColumn({ name: 'diagnosis_id' })
  DiagnosisId!: number;

  @Column({ name: 'patient_id', type: 'integer', nullable: false })
  PatientId!: number;

  @Column({ name: 'patient_visit_id', type: 'integer', nullable: false })
  PatientVisitId!: number;

  @Column({ name: 'medical_record_id', type: 'integer', nullable: false })
  MedicalRecordId!: number;

  @Column({ name: 'icd10_id', type: 'integer', nullable: false })
  ICD10ID!: number;

  @Column({ name: 'icd10_code', type: 'text', nullable: true })
  ICD10Code!: string | null;

  @Column({ name: 'icd10_name', type: 'text', nullable: true })
  ICD10Name!: string | null;

  @Column({ name: 'created_by', type: 'integer', nullable: false })
  CreatedBy!: number;

  @Column({ name: 'created_on', type: 'timestamp', nullable: false })
  CreatedOn!: string;

  @Column({ name: 'modified_by', type: 'integer', nullable: true })
  ModifiedBy!: number | null;

  @Column({ name: 'modified_on', type: 'timestamp', nullable: true })
  ModifiedOn!: string | null;

  @Column({ name: 'is_active', type: 'boolean', nullable: false })
  IsActive!: boolean;

}

@Entity({ name: 'mr_txn_outpatient_final_diagnosis' })
export class FinalDiagnosisModel {
  @PrimaryGeneratedColumn({ name: 'final_diagnosis_id' })
  FinalDiagnosisId!: number;

  @Column({ name: 'patient_visit_id', type: 'integer', nullable: false })
  PatientVisitId!: number;

  @Column({ name: 'patient_id', type: 'integer', nullable: false })
  PatientId!: number;

  @Column({ name: 'icd10_id', type: 'integer', nullable: false })
  ICD10ID!: number;

  @Column({ name: 'created_by', type: 'integer', nullable: false })
  CreatedBy!: number;

  @Column({ name: 'created_on', type: 'timestamp', nullable: false })
  CreatedOn!: string;

  @Column({ name: 'modified_by', type: 'integer', nullable: true })
  ModifiedBy!: number | null;

  @Column({ name: 'modified_on', type: 'timestamp', nullable: true })
  ModifiedOn!: string | null;

  @Column({ name: 'is_active', type: 'boolean', nullable: false })
  IsActive!: boolean;

  @Column({ name: 'is_patient_referred', type: 'boolean', nullable: false })
  IsPatientReferred!: boolean;

  @Column({ name: 'referred_by', type: 'text', nullable: true })
  ReferredBy!: string | null;

  @Column({ name: 'referred_to', type: 'text', nullable: true })
  ReferredTo!: string | null;

}
