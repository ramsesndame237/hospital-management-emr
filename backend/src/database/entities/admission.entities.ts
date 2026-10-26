/* GÉNÉRÉ par tools/generate-entities.mjs depuis migration/inventory/entities.json : ne pas modifier à la main. */
import { Column, Entity, PrimaryColumn, PrimaryGeneratedColumn } from 'typeorm';
import { NUM } from '../transformers';

@Entity({ name: 'adt_baby_birth_details' })
export class BabyBirthDetailsModel {
  @PrimaryGeneratedColumn({ name: 'baby_birth_details_id' })
  BabyBirthDetailsId!: number;

  @Column({ name: 'certificate_number', type: 'integer', nullable: true })
  CertificateNumber!: number | null;

  @Column({ name: 'sex', type: 'text', nullable: true })
  Sex!: string | null;

  @Column({ name: 'fathers_name', type: 'text', nullable: true })
  FathersName!: string | null;

  @Column({ name: 'weight_of_baby', type: 'double precision', nullable: false })
  WeightOfBaby!: number;

  @Column({ name: 'birth_date', type: 'timestamp', nullable: false })
  BirthDate!: string;

  @Column({ name: 'birth_time', type: 'interval', nullable: false })
  BirthTime!: string;

  @Column({ name: 'discharge_summary_id', type: 'integer', nullable: true })
  DischargeSummaryId!: number | null;

  @Column({ name: 'patient_id', type: 'integer', nullable: false })
  PatientId!: number;

  @Column({ name: 'patient_visit_id', type: 'integer', nullable: false })
  PatientVisitId!: number;

  @Column({ name: 'medical_record_id', type: 'integer', nullable: true })
  MedicalRecordId!: number | null;

  @Column({ name: 'issued_by', type: 'integer', nullable: true })
  IssuedBy!: number | null;

  @Column({ name: 'certified_by', type: 'integer', nullable: true })
  CertifiedBy!: number | null;

  @Column({ name: 'fiscal_year_id', type: 'integer', nullable: false })
  FiscalYearId!: number;

  @Column({ name: 'birth_type', type: 'text', nullable: true })
  BirthType!: string | null;

  @Column({ name: 'birth_number_type', type: 'text', nullable: true })
  BirthNumberType!: string | null;

  @Column({ name: 'printed_by', type: 'integer', nullable: true })
  PrintedBy!: number | null;

  @Column({ name: 'print_count', type: 'integer', nullable: false })
  PrintCount!: number;

  @Column({ name: 'printed_on', type: 'timestamp', nullable: true })
  PrintedOn!: string | null;

  @Column({ name: 'created_by', type: 'integer', nullable: true })
  CreatedBy!: number | null;

  @Column({ name: 'modified_by', type: 'integer', nullable: true })
  ModifiedBy!: number | null;

  @Column({ name: 'created_on', type: 'timestamp', nullable: true })
  CreatedOn!: string | null;

  @Column({ name: 'modified_on', type: 'timestamp', nullable: true })
  ModifiedOn!: string | null;

  @Column({ name: 'is_active', type: 'boolean', nullable: false })
  IsActive!: boolean;

  @Column({ name: 'birth_condition_id', type: 'integer', nullable: false })
  BirthConditionId!: number;

}

@Entity({ name: 'adt_bed' })
export class BedModel {
  @PrimaryGeneratedColumn({ name: 'bed_id' })
  BedId!: number;

  @Column({ name: 'bed_code', type: 'text', nullable: true })
  BedCode!: string | null;

  @Column({ name: 'bed_number', type: 'text', nullable: true })
  BedNumber!: string | null;

  @Column({ name: 'ward_id', type: 'integer', nullable: false })
  WardId!: number;

  @Column({ name: 'is_occupied', type: 'boolean', nullable: false })
  IsOccupied!: boolean;

  @Column({ name: 'created_by', type: 'integer', nullable: false })
  CreatedBy!: number;

  @Column({ name: 'created_on', type: 'timestamp', nullable: false })
  CreatedOn!: string;

  @Column({ name: 'modified_by', type: 'integer', nullable: true })
  ModifiedBy!: number | null;

  @Column({ name: 'modified_on', type: 'timestamp', nullable: true })
  ModifiedOn!: string | null;

  @Column({ name: 'holded_on', type: 'timestamp', nullable: true })
  HoldedOn!: string | null;

  @Column({ name: 'is_active', type: 'boolean', nullable: false })
  IsActive!: boolean;

  @Column({ name: 'is_reserved', type: 'boolean', nullable: false })
  IsReserved!: boolean;

  @Column({ name: 'on_hold', type: 'boolean', nullable: false })
  OnHold!: boolean;

}

@Entity({ name: 'adt_bed_reservation' })
export class ADTBedReservation {
  @PrimaryGeneratedColumn({ name: 'reserved_bed_info_id' })
  ReservedBedInfoId!: number;

  @Column({ name: 'patient_id', type: 'integer', nullable: false })
  PatientId!: number;

  @Column({ name: 'patient_visit_id', type: 'integer', nullable: true })
  PatientVisitId!: number | null;

  @Column({ name: 'requesting_department_id', type: 'integer', nullable: false })
  RequestingDepartmentId!: number;

  @Column({ name: 'admitting_doctor_id', type: 'integer', nullable: false })
  AdmittingDoctorId!: number;

  @Column({ name: 'ward_id', type: 'integer', nullable: false })
  WardId!: number;

  @Column({ name: 'bed_feature_id', type: 'integer', nullable: false })
  BedFeatureId!: number;

  @Column({ name: 'bed_id', type: 'integer', nullable: false })
  BedId!: number;

  @Column({ name: 'admission_starts_on', type: 'timestamp', nullable: false })
  AdmissionStartsOn!: string;

  @Column({ name: 'admission_notes', type: 'text', nullable: true })
  AdmissionNotes!: string | null;

  @Column({ name: 'reserved_on', type: 'timestamp', nullable: true })
  ReservedOn!: string | null;

  @Column({ name: 'reserved_by', type: 'integer', nullable: true })
  ReservedBy!: number | null;

  @Column({ name: 'created_by', type: 'integer', nullable: true })
  CreatedBy!: number | null;

  @Column({ name: 'created_on', type: 'timestamp', nullable: true })
  CreatedOn!: string | null;

  @Column({ name: 'modified_by', type: 'integer', nullable: true })
  ModifiedBy!: number | null;

  @Column({ name: 'modified_on', type: 'timestamp', nullable: true })
  ModifiedOn!: string | null;

  @Column({ name: 'cancelled_by', type: 'integer', nullable: true })
  CancelledBy!: number | null;

  @Column({ name: 'cancelled_on', type: 'timestamp', nullable: true })
  CancelledOn!: string | null;

  @Column({ name: 'is_active', type: 'boolean', nullable: false })
  IsActive!: boolean;

  @Column({ name: 'is_auto_cancelled', type: 'boolean', nullable: true })
  IsAutoCancelled!: boolean | null;

  @Column({ name: 'auto_cancelled_on', type: 'timestamp', nullable: true })
  AutoCancelledOn!: string | null;

}

@Entity({ name: 'adt_cfg_auto_billing_item' })
export class AdtAutoBillingItemModel {
  @PrimaryGeneratedColumn({ name: 'adt_auto_billing_item_id' })
  AdtAutoBillingItemId!: number;

  @Column({ name: 'bed_feature_id', type: 'integer', nullable: false })
  BedFeatureId!: number;

  @Column({ name: 'scheme_id', type: 'integer', nullable: false })
  SchemeId!: number;

  @Column({ name: 'service_item_id', type: 'integer', nullable: false })
  ServiceItemId!: number;

  @Column({ name: 'minimum_charge_amount', type: 'numeric', nullable: false, transformer: NUM })
  MinimumChargeAmount!: number;

  @Column({ name: 'percentage_of_bed_charges', type: 'numeric', nullable: false, transformer: NUM })
  PercentageOfBedCharges!: number;

  @Column({ name: 'use_percentage_of_bed_charges', type: 'boolean', nullable: false })
  UsePercentageOfBedCharges!: boolean;

  @Column({ name: 'is_repeatable', type: 'boolean', nullable: false })
  IsRepeatable!: boolean;

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

@Entity({ name: 'adt_cfg_deposit_settings' })
export class AdtDepositSettingsModel {
  @PrimaryGeneratedColumn({ name: 'adt_deposit_setting_id' })
  AdtDepositSettingId!: number;

  @Column({ name: 'bed_feature_id', type: 'integer', nullable: false })
  BedFeatureId!: number;

  @Column({ name: 'scheme_id', type: 'integer', nullable: false })
  SchemeId!: number;

  @Column({ name: 'deposit_head_id', type: 'integer', nullable: false })
  DepositHeadId!: number;

  @Column({ name: 'minimum_deposit_amount', type: 'numeric', nullable: false, transformer: NUM })
  MinimumDepositAmount!: number;

  @Column({ name: 'is_only_minimum_deposit', type: 'boolean', nullable: false })
  IsOnlyMinimumDeposit!: boolean;

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

@Entity({ name: 'adt_death_deatils' })
export class DeathDetailsModel {
  @PrimaryGeneratedColumn({ name: 'death_id' })
  DeathId!: number;

  @Column({ name: 'death_date', type: 'timestamp', nullable: false })
  DeathDate!: string;

  @Column({ name: 'death_time', type: 'interval', nullable: false })
  DeathTime!: string;

  @Column({ name: 'certificate_number', type: 'integer', nullable: true })
  CertificateNumber!: number | null;

  @Column({ name: 'patient_id', type: 'integer', nullable: false })
  PatientId!: number;

  @Column({ name: 'patient_visit_id', type: 'integer', nullable: false })
  PatientVisitId!: number;

  @Column({ name: 'medical_record_id', type: 'integer', nullable: true })
  MedicalRecordId!: number | null;

  @Column({ name: 'created_by', type: 'integer', nullable: true })
  CreatedBy!: number | null;

  @Column({ name: 'modified_by', type: 'integer', nullable: true })
  ModifiedBy!: number | null;

  @Column({ name: 'certified_by', type: 'integer', nullable: true })
  CertifiedBy!: number | null;

  @Column({ name: 'created_on', type: 'timestamp', nullable: true })
  CreatedOn!: string | null;

  @Column({ name: 'modified_on', type: 'timestamp', nullable: true })
  ModifiedOn!: string | null;

  @Column({ name: 'is_active', type: 'boolean', nullable: false })
  IsActive!: boolean;

  @Column({ name: 'father_name', type: 'text', nullable: true })
  FatherName!: string | null;

  @Column({ name: 'mother_name', type: 'text', nullable: true })
  MotherName!: string | null;

  @Column({ name: 'spouse_of', type: 'text', nullable: true })
  SpouseOf!: string | null;

  @Column({ name: 'visit_code', type: 'text', nullable: true })
  VisitCode!: string | null;

  @Column({ name: 'cause_of_death', type: 'text', nullable: true })
  CauseOfDeath!: string | null;

  @Column({ name: 'age', type: 'text', nullable: true })
  Age!: string | null;

  @Column({ name: 'fiscal_year_id', type: 'integer', nullable: false })
  FiscalYearId!: number;

  @Column({ name: 'print_count', type: 'integer', nullable: false })
  PrintCount!: number;

  @Column({ name: 'printed_by', type: 'integer', nullable: true })
  PrintedBy!: number | null;

  @Column({ name: 'printed_on', type: 'timestamp', nullable: true })
  PrintedOn!: string | null;

}

@Entity({ name: 'adt_discharge_cancel' })
export class DischargeCancelModel {
  @PrimaryGeneratedColumn({ name: 'discharge_cancel_id' })
  DischargeCancelId!: number;

  @Column({ name: 'patient_visit_id', type: 'integer', nullable: true })
  PatientVisitId!: number | null;

  @Column({ name: 'patient_admission_id', type: 'integer', nullable: true })
  PatientAdmissionId!: number | null;

  @Column({ name: 'discharged_date', type: 'timestamp', nullable: false })
  DischargedDate!: string;

  @Column({ name: 'created_on', type: 'timestamp', nullable: true })
  CreatedOn!: string | null;

  @Column({ name: 'discharged_by', type: 'integer', nullable: true })
  DischargedBy!: number | null;

  @Column({ name: 'discharge_cancelled_by', type: 'integer', nullable: true })
  DischargeCancelledBy!: number | null;

  @Column({ name: 'billing_transaction_id', type: 'integer', nullable: true })
  BillingTransactionId!: number | null;

  @Column({ name: 'discharge_cancel_note', type: 'text', nullable: true })
  DischargeCancelNote!: string | null;

}

@Entity({ name: 'adt_discharge_summary' })
export class DischargeSummaryModel {
  @Column({ name: 'discharge_summary_id', type: 'integer', nullable: false })
  DischargeSummaryId!: number;

  @PrimaryGeneratedColumn({ name: 'patient_visit_id' })
  PatientVisitId!: number;

  @Column({ name: 'discharge_type_id', type: 'integer', nullable: false })
  DischargeTypeId!: number;

  @Column({ name: 'doctor_incharge_id', type: 'integer', nullable: true })
  DoctorInchargeId!: number | null;

  @Column({ name: 'operative_procedure', type: 'text', nullable: true })
  OperativeProcedure!: string | null;

  @Column({ name: 'operative_findings', type: 'text', nullable: true })
  OperativeFindings!: string | null;

  @Column({ name: 'anaesthetists_id', type: 'integer', nullable: true })
  AnaesthetistsId!: number | null;

  @Column({ name: 'diagnosis', type: 'text', nullable: true })
  Diagnosis!: string | null;

  @Column({ name: 'case_summary', type: 'text', nullable: true })
  CaseSummary!: string | null;

  @Column({ name: 'condition', type: 'text', nullable: true })
  Condition!: string | null;

  @Column({ name: 'treatment', type: 'text', nullable: true })
  Treatment!: string | null;

  @Column({ name: 'histology_report', type: 'text', nullable: true })
  HistologyReport!: string | null;

  @Column({ name: 'speicial_notes', type: 'text', nullable: true })
  SpeicialNotes!: string | null;

  @Column({ name: 'medications', type: 'text', nullable: true })
  Medications!: string | null;

  @Column({ name: 'allergies', type: 'text', nullable: true })
  Allergies!: string | null;

  @Column({ name: 'activities', type: 'text', nullable: true })
  Activities!: string | null;

  @Column({ name: 'diet', type: 'text', nullable: true })
  Diet!: string | null;

  @Column({ name: 'rest_days', type: 'text', nullable: true })
  RestDays!: string | null;

  @Column({ name: 'follow_up', type: 'text', nullable: true })
  FollowUp!: string | null;

  @Column({ name: 'others', type: 'text', nullable: true })
  Others!: string | null;

  @Column({ name: 'residence_dr_id', type: 'integer', nullable: true })
  ResidenceDrId!: number | null;

  @Column({ name: 'created_by', type: 'integer', nullable: false })
  CreatedBy!: number;

  @Column({ name: 'created_on', type: 'timestamp', nullable: false })
  CreatedOn!: string;

  @Column({ name: 'modified_by', type: 'integer', nullable: true })
  ModifiedBy!: number | null;

  @Column({ name: 'modified_on', type: 'timestamp', nullable: true })
  ModifiedOn!: string | null;

  @Column({ name: 'is_submitted', type: 'boolean', nullable: true })
  IsSubmitted!: boolean | null;

  @Column({ name: 'is_discharge_cancel', type: 'boolean', nullable: true })
  IsDischargeCancel!: boolean | null;

  @Column({ name: 'lab_tests', type: 'text', nullable: true })
  LabTests!: string | null;

  @Column({ name: 'discharge_condition_id', type: 'integer', nullable: true })
  DischargeConditionId!: number | null;

  @Column({ name: 'delivery_type_id', type: 'integer', nullable: true })
  DeliveryTypeId!: number | null;

  @Column({ name: 'baby_birth_condition_id', type: 'integer', nullable: true })
  BabyBirthConditionId!: number | null;

  @Column({ name: 'death_type_id', type: 'integer', nullable: true })
  DeathTypeId!: number | null;

  @Column({ name: 'death_period', type: 'text', nullable: true })
  DeathPeriod!: string | null;

  @Column({ name: 'notes_id', type: 'integer', nullable: true })
  NotesId!: number | null;

  @Column({ name: 'chief_complaint', type: 'text', nullable: true })
  ChiefComplaint!: string | null;

  @Column({ name: 'pending_reports', type: 'text', nullable: true })
  PendingReports!: string | null;

  @Column({ name: 'hospital_course', type: 'text', nullable: true })
  HospitalCourse!: string | null;

  @Column({ name: 'presenting_illness', type: 'text', nullable: true })
  PresentingIllness!: string | null;

  @Column({ name: 'procedure_nts', type: 'text', nullable: true })
  ProcedureNts!: string | null;

  @Column({ name: 'selected_imaging_items', type: 'text', nullable: true })
  SelectedImagingItems!: string | null;

  @Column({ name: 'diagnosis_free_text', type: 'text', nullable: true })
  DiagnosisFreeText!: string | null;

  @Column({ name: 'provisional_diagnosis', type: 'text', nullable: true })
  ProvisionalDiagnosis!: string | null;

  @Column({ name: 'baby_weight', type: 'text', nullable: true })
  BabyWeight!: string | null;

  @Column({ name: 'checked_by', type: 'integer', nullable: true })
  CheckedBy!: number | null;

  @Column({ name: 'clinical_findings', type: 'text', nullable: true })
  ClinicalFindings!: string | null;

  @Column({ name: 'past_history', type: 'text', nullable: true })
  PastHistory!: string | null;

  @Column({ name: 'discharge_summary_template_id', type: 'integer', nullable: true })
  DischargeSummaryTemplateId!: number | null;

}

@Entity({ name: 'adt_discharge_summary_consultant' })
export class ADTDischargeSummaryConsultantModel {
  @PrimaryGeneratedColumn({ name: 'id' })
  id!: number;

  @Column({ name: 'discharge_summary_id', type: 'integer', nullable: false })
  DischargeSummaryId!: number;

  @Column({ name: 'patient_visit_id', type: 'integer', nullable: false })
  PatientVisitId!: number;

  @Column({ name: 'patient_id', type: 'integer', nullable: false })
  PatientId!: number;

  @Column({ name: 'consultant_id', type: 'integer', nullable: false })
  ConsultantId!: number;

}

@Entity({ name: 'adt_discharge_summary_medication' })
export class DischargeSummaryMedication {
  @PrimaryGeneratedColumn({ name: 'discharge_summary_medication_id' })
  DischargeSummaryMedicationId!: number;

  @Column({ name: 'discharge_summary_id', type: 'integer', nullable: false })
  DischargeSummaryId!: number;

  @Column({ name: 'old_new_medicine_type', type: 'integer', nullable: false })
  OldNewMedicineType!: number;

  @Column({ name: 'medicine', type: 'text', nullable: true })
  Medicine!: string | null;

  @Column({ name: 'frequency_id', type: 'integer', nullable: false })
  FrequencyId!: number;

  @Column({ name: 'notes', type: 'text', nullable: true })
  Notes!: string | null;

  @Column({ name: 'is_active', type: 'boolean', nullable: true })
  IsActive!: boolean | null;

}

@Entity({ name: 'adt_discharge_type' })
export class DischargeTypeModel {
  @PrimaryGeneratedColumn({ name: 'discharge_type_id' })
  DischargeTypeId!: number;

  @Column({ name: 'discharge_type_name', type: 'text', nullable: true })
  DischargeTypeName!: string | null;

  @Column({ name: 'description', type: 'text', nullable: true })
  Description!: string | null;

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

@Entity({ name: 'adt_map_bed_feature_scheme_price_category' })
export class AdtBedFeatureSchemePriceCategoryMapModel {
  @PrimaryGeneratedColumn({ name: 'bed_feature_scheme_price_category_map_id' })
  BedFeatureSchemePriceCategoryMapId!: number;

  @Column({ name: 'bed_feature_id', type: 'integer', nullable: false })
  BedFeatureId!: number;

  @Column({ name: 'scheme_id', type: 'integer', nullable: false })
  SchemeId!: number;

  @Column({ name: 'price_category_id', type: 'integer', nullable: false })
  PriceCategoryId!: number;

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

@Entity({ name: 'adt_map_bed_features_map' })
export class BedFeaturesMap {
  @PrimaryGeneratedColumn({ name: 'bed_feature_cfg_id' })
  BedFeatureCFGId!: number;

  @Column({ name: 'bed_id', type: 'integer', nullable: false })
  BedId!: number;

  @Column({ name: 'ward_id', type: 'integer', nullable: false })
  WardId!: number;

  @Column({ name: 'bed_feature_id', type: 'integer', nullable: false })
  BedFeatureId!: number;

  @Column({ name: 'created_by', type: 'integer', nullable: false })
  CreatedBy!: number;

  @Column({ name: 'created_on', type: 'timestamp', nullable: true })
  CreatedOn!: string | null;

  @Column({ name: 'modified_by', type: 'integer', nullable: true })
  ModifiedBy!: number | null;

  @Column({ name: 'modified_on', type: 'timestamp', nullable: true })
  ModifiedOn!: string | null;

  @Column({ name: 'is_active', type: 'boolean', nullable: false })
  IsActive!: boolean;

}

@Entity({ name: 'adt_map_ward_bed_type' })
export class BedModel_adt_map_ward_bed_type {
  @PrimaryGeneratedColumn({ name: 'bed_id' })
  BedId!: number;

  @Column({ name: 'bed_code', type: 'text', nullable: true })
  BedCode!: string | null;

  @Column({ name: 'bed_number', type: 'text', nullable: true })
  BedNumber!: string | null;

  @Column({ name: 'ward_id', type: 'integer', nullable: false })
  WardId!: number;

  @Column({ name: 'is_occupied', type: 'boolean', nullable: false })
  IsOccupied!: boolean;

  @Column({ name: 'created_by', type: 'integer', nullable: false })
  CreatedBy!: number;

  @Column({ name: 'created_on', type: 'timestamp', nullable: false })
  CreatedOn!: string;

  @Column({ name: 'modified_by', type: 'integer', nullable: true })
  ModifiedBy!: number | null;

  @Column({ name: 'modified_on', type: 'timestamp', nullable: true })
  ModifiedOn!: string | null;

  @Column({ name: 'holded_on', type: 'timestamp', nullable: true })
  HoldedOn!: string | null;

  @Column({ name: 'is_active', type: 'boolean', nullable: false })
  IsActive!: boolean;

  @Column({ name: 'is_reserved', type: 'boolean', nullable: false })
  IsReserved!: boolean;

  @Column({ name: 'on_hold', type: 'boolean', nullable: false })
  OnHold!: boolean;

}

@Entity({ name: 'adt_mst_baby_birth_condition' })
export class BabyBirthConditionModel {
  @PrimaryGeneratedColumn({ name: 'baby_birth_condition_id' })
  BabyBirthConditionId!: number;

  @Column({ name: 'birth_condition_type', type: 'text', nullable: true })
  BirthConditionType!: string | null;

  @Column({ name: 'discharge_condition_id', type: 'integer', nullable: false })
  DischargeConditionId!: number;

}

@Entity({ name: 'adt_mst_bed_feature' })
export class BedFeature {
  @PrimaryGeneratedColumn({ name: 'bed_feature_id' })
  BedFeatureId!: number;

  @Column({ name: 'bed_feature_code', type: 'text', nullable: true })
  BedFeatureCode!: string | null;

  @Column({ name: 'bed_feature_name', type: 'text', nullable: true })
  BedFeatureName!: string | null;

  @Column({ name: 'bed_feature_full_name', type: 'text', nullable: true })
  BedFeatureFullName!: string | null;

  @Column({ name: 'bed_price', type: 'double precision', nullable: true })
  BedPrice!: number | null;

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

@Entity({ name: 'adt_mst_death_type' })
export class DeathTypeModel {
  @PrimaryGeneratedColumn({ name: 'death_type_id' })
  DeathTypeId!: number;

  @Column({ name: 'death_type', type: 'text', nullable: true })
  DeathType!: string | null;

  @Column({ name: 'discharge_type_id', type: 'integer', nullable: true })
  DischargeTypeId!: number | null;

}

@Entity({ name: 'adt_mst_delivery_type' })
export class DeliveryTypeModel {
  @PrimaryGeneratedColumn({ name: 'delivery_type_id' })
  DeliveryTypeId!: number;

  @Column({ name: 'discharge_condition_id', type: 'integer', nullable: false })
  DischargeConditionId!: number;

  @Column({ name: 'delivery_type_name', type: 'text', nullable: true })
  DeliveryTypeName!: string | null;

}

@Entity({ name: 'adt_mst_discharge_condition_type' })
export class DischargeConditionTypeModel {
  @PrimaryGeneratedColumn({ name: 'discharge_condition_id' })
  DischargeConditionId!: number;

  @Column({ name: 'discharge_type_id', type: 'integer', nullable: false })
  DischargeTypeId!: number;

  @Column({ name: 'condition', type: 'text', nullable: true })
  Condition!: string | null;

}

@Entity({ name: 'adt_mst_gravita' })
export class GravitaModel {
  @PrimaryGeneratedColumn({ name: 'gravita_id' })
  GravitaId!: number;

  @Column({ name: 'gravita_name', type: 'text', nullable: true })
  GravitaName!: string | null;

}

@Entity({ name: 'adt_mst_ward' })
export class WardModel {
  @PrimaryGeneratedColumn({ name: 'ward_id' })
  WardId!: number;

  @Column({ name: 'store_id', type: 'integer', nullable: false })
  StoreId!: number;

  @Column({ name: 'ward_code', type: 'text', nullable: true })
  WardCode!: string | null;

  @Column({ name: 'ward_name', type: 'text', nullable: true })
  WardName!: string | null;

  @Column({ name: 'ward_location', type: 'text', nullable: true })
  WardLocation!: string | null;

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

@Entity({ name: 'adt_patient_admission' })
export class AdmissionModel {
  @Column({ name: 'patient_admission_id', type: 'integer', nullable: false })
  PatientAdmissionId!: number;

  @PrimaryGeneratedColumn({ name: 'patient_visit_id' })
  PatientVisitId!: number;

  @Column({ name: 'patient_id', type: 'integer', nullable: false })
  PatientId!: number;

  @Column({ name: 'admitting_doctor_id', type: 'integer', nullable: true })
  AdmittingDoctorId!: number | null;

  @Column({ name: 'admission_date', type: 'timestamp', nullable: false })
  AdmissionDate!: string;

  @Column({ name: 'discharge_date', type: 'timestamp', nullable: true })
  DischargeDate!: string | null;

  @Column({ name: 'admission_notes', type: 'text', nullable: true })
  AdmissionNotes!: string | null;

  @Column({ name: 'admission_orders', type: 'text', nullable: true })
  AdmissionOrders!: string | null;

  @Column({ name: 'admission_status', type: 'text', nullable: true })
  AdmissionStatus!: string | null;

  @Column({ name: 'created_by', type: 'integer', nullable: false })
  CreatedBy!: number;

  @Column({ name: 'created_on', type: 'timestamp', nullable: false })
  CreatedOn!: string;

  @Column({ name: 'bill_status_on_discharge', type: 'text', nullable: true })
  BillStatusOnDischarge!: string | null;

  @Column({ name: 'discharge_remarks', type: 'text', nullable: true })
  DischargeRemarks!: string | null;

  @Column({ name: 'discharged_by', type: 'integer', nullable: true })
  DischargedBy!: number | null;

  @Column({ name: 'modified_by', type: 'integer', nullable: true })
  ModifiedBy!: number | null;

  @Column({ name: 'modified_on', type: 'timestamp', nullable: true })
  ModifiedOn!: string | null;

  @Column({ name: 'care_of_person_name', type: 'text', nullable: true })
  CareOfPersonName!: string | null;

  @Column({ name: 'care_of_person_phone_no', type: 'text', nullable: true })
  CareOfPersonPhoneNo!: string | null;

  @Column({ name: 'care_of_person_relation', type: 'text', nullable: true })
  CareOfPersonRelation!: string | null;

  @Column({ name: 'cancelled_on', type: 'timestamp', nullable: true })
  CancelledOn!: string | null;

  @Column({ name: 'cancelled_by', type: 'integer', nullable: true })
  CancelledBy!: number | null;

  @Column({ name: 'cancelled_remark', type: 'text', nullable: true })
  CancelledRemark!: string | null;

  @Column({ name: 'procedure_type', type: 'text', nullable: true })
  ProcedureType!: string | null;

  @Column({ name: 'is_police_case', type: 'boolean', nullable: false })
  IsPoliceCase!: boolean;

  @Column({ name: 'is_insurance_patient', type: 'boolean', nullable: false })
  IsInsurancePatient!: boolean;

  @Column({ name: 'discount_scheme_id', type: 'integer', nullable: true })
  DiscountSchemeId!: number | null;

  @Column({ name: 'admission_case', type: 'text', nullable: true })
  AdmissionCase!: string | null;

  @Column({ name: 'provisional_disc_percent', type: 'double precision', nullable: false })
  ProvisionalDiscPercent!: number;

  @Column({ name: 'is_item_discount_enabled', type: 'boolean', nullable: false })
  IsItemDiscountEnabled!: boolean;

  @Column({ name: 'is_provisional_discharge', type: 'boolean', nullable: false })
  IsProvisionalDischarge!: boolean;

  @Column({ name: 'is_provisional_discharge_cleared', type: 'boolean', nullable: false })
  IsProvisionalDischargeCleared!: boolean;

}

@Entity({ name: 'adt_patient_certificate' })
export class PatientCertificateModel {
  @PrimaryGeneratedColumn({ name: 'certificate_id' })
  CertificateId!: number;

  @Column({ name: 'fiscal_year_name', type: 'text', nullable: true })
  FiscalYearName!: string | null;

  @Column({ name: 'created_on', type: 'timestamp', nullable: false })
  CreatedOn!: string;

  @Column({ name: 'created_by', type: 'integer', nullable: false })
  CreatedBy!: number;

  @Column({ name: 'certificate_number', type: 'integer', nullable: true })
  CertificateNumber!: number | null;

  @Column({ name: 'discharge_summary_id', type: 'integer', nullable: true })
  DischargeSummaryId!: number | null;

  @Column({ name: 'certificate_type', type: 'text', nullable: true })
  CertificateType!: string | null;

  @Column({ name: 'issued_by_signatories', type: 'text', nullable: true })
  IssuedBySignatories!: string | null;

  @Column({ name: 'certified_by_signatories', type: 'text', nullable: true })
  CertifiedBySignatories!: string | null;

  @Column({ name: 'birth_type', type: 'text', nullable: true })
  BirthType!: string | null;

  @Column({ name: 'death_date', type: 'timestamp', nullable: true })
  DeathDate!: string | null;

  @Column({ name: 'death_time', type: 'interval', nullable: true })
  DeathTime!: string | null;

  @Column({ name: 'death_cause', type: 'text', nullable: true })
  DeathCause!: string | null;

  @Column({ name: 'father_name', type: 'text', nullable: true })
  FatherName!: string | null;

  @Column({ name: 'mother_name', type: 'text', nullable: true })
  MotherName!: string | null;

  @Column({ name: 'spouse', type: 'text', nullable: true })
  Spouse!: string | null;

}

@Entity({ name: 'adt_txn_patient_bed_info' })
export class PatientBedInfo {
  @PrimaryGeneratedColumn({ name: 'patient_bed_info_id' })
  PatientBedInfoId!: number;

  @Column({ name: 'patient_visit_id', type: 'integer', nullable: false })
  PatientVisitId!: number;

  @Column({ name: 'patient_id', type: 'integer', nullable: false })
  PatientId!: number;

  @Column({ name: 'ward_id', type: 'integer', nullable: false })
  WardId!: number;

  @Column({ name: 'bed_id', type: 'integer', nullable: false })
  BedId!: number;

  @Column({ name: 'bed_feature_id', type: 'integer', nullable: false })
  BedFeatureId!: number;

  @Column({ name: 'bed_price', type: 'numeric', nullable: false, transformer: NUM })
  BedPrice!: number;

  @Column({ name: 'action', type: 'text', nullable: true })
  Action!: string | null;

  @Column({ name: 'out_action', type: 'text', nullable: true })
  OutAction!: string | null;

  @Column({ name: 'remarks', type: 'text', nullable: true })
  Remarks!: string | null;

  @Column({ name: 'started_on', type: 'timestamp', nullable: false })
  StartedOn!: string;

  @Column({ name: 'ended_on', type: 'timestamp', nullable: true })
  EndedOn!: string | null;

  @Column({ name: 'created_by', type: 'integer', nullable: false })
  CreatedBy!: number;

  @Column({ name: 'modified_by', type: 'integer', nullable: true })
  ModifiedBy!: number | null;

  @Column({ name: 'cancelled_by', type: 'integer', nullable: true })
  CancelledBy!: number | null;

  @Column({ name: 'cancelled_on', type: 'timestamp', nullable: true })
  CancelledOn!: string | null;

  @Column({ name: 'cancel_remarks', type: 'text', nullable: true })
  CancelRemarks!: string | null;

  @Column({ name: 'created_on', type: 'timestamp', nullable: false })
  CreatedOn!: string;

  @Column({ name: 'modified_on', type: 'timestamp', nullable: true })
  ModifiedOn!: string | null;

  @Column({ name: 'is_active', type: 'boolean', nullable: false })
  IsActive!: boolean;

  @Column({ name: 'bed_on_hold_enabled', type: 'boolean', nullable: false })
  BedOnHoldEnabled!: boolean;

  @Column({ name: 'requesting_dept_id', type: 'integer', nullable: true })
  RequestingDeptId!: number | null;

  @Column({ name: 'bed_quantity', type: 'integer', nullable: false })
  BedQuantity!: number;

  @Column({ name: 'secondary_doctor_id', type: 'integer', nullable: true })
  SecondaryDoctorId!: number | null;

  @Column({ name: 'received_by', type: 'integer', nullable: true })
  ReceivedBy!: number | null;

  @Column({ name: 'received_on', type: 'timestamp', nullable: true })
  ReceivedOn!: string | null;

}

@Entity({ name: 'neph_hemodialysis_record' })
export class HemodialysisModel {
  @PrimaryGeneratedColumn({ name: 'hemodialysis_record_id' })
  HemodialysisRecordId!: number;

  @Column({ name: 'patient_id', type: 'integer', nullable: false })
  PatientId!: number;

  @Column({ name: 'patient_visit_id', type: 'integer', nullable: false })
  PatientVisitId!: number;

  @Column({ name: 'diagnosis', type: 'text', nullable: true })
  Diagnosis!: string | null;

  @Column({ name: 'schedule', type: 'text', nullable: true })
  Schedule!: string | null;

  @Column({ name: 'next_hd', type: 'timestamp', nullable: false })
  NextHD!: string;

  @Column({ name: 'current_hd_date', type: 'timestamp', nullable: false })
  CurrentHdDate!: string;

  @Column({ name: 'id_no', type: 'text', nullable: true })
  IdNo!: string | null;

  @Column({ name: 'hd_no', type: 'text', nullable: true })
  HdNo!: string | null;

  @Column({ name: 'treatment_order_dry_weight', type: 'text', nullable: true })
  TreatmentOrder_DryWeight!: string | null;

  @Column({ name: 'treatment_order_dialysis_flow', type: 'text', nullable: true })
  TreatmentOrder_DialysisFlow!: string | null;

  @Column({ name: 'treatment_order_blood', type: 'text', nullable: true })
  TreatmentOrder_Blood!: string | null;

  @Column({ name: 'treatment_order_time_in_min', type: 'text', nullable: true })
  TreatmentOrder_TimeInMin!: string | null;

  @Column({ name: 'treatment_order_used_no', type: 'text', nullable: true })
  TreatmentOrder_UsedNo!: string | null;

  @Column({ name: 'treatment_order_blood_transfusion', type: 'text', nullable: true })
  TreatmentOrder_BloodTransfusion!: string | null;

  @Column({ name: 'treatment_order_heparine_saline_circulation', type: 'text', nullable: true })
  TreatmentOrder_HeparineSaline_Circulation!: string | null;

  @Column({ name: 'treatment_order_heparine_saline_bolus', type: 'text', nullable: true })
  TreatmentOrder_HeparineSaline_Bolus!: string | null;

  @Column({ name: 'treatment_order_heparine_saline_continuous', type: 'text', nullable: true })
  TreatmentOrder_HeparineSaline_Continuous!: string | null;

  @Column({ name: 'vascular_access_avf', type: 'boolean', nullable: false })
  VascularAccess_AVF!: boolean;

  @Column({ name: 'vascular_access_subclavian', type: 'boolean', nullable: false })
  VascularAccess_Subclavian!: boolean;

  @Column({ name: 'vascular_access_jugular', type: 'boolean', nullable: false })
  VascularAccess_Jugular!: boolean;

  @Column({ name: 'vascular_access_femoral_catheter', type: 'boolean', nullable: false })
  VascularAccess_FemoralCatheter!: boolean;

  @Column({ name: 'vascular_access_perm_cath', type: 'boolean', nullable: false })
  VascularAccess_PermCath!: boolean;

  @Column({ name: 'blood_trans_blood_group', type: 'text', nullable: true })
  BloodTrans_BloodGroup!: string | null;

  @Column({ name: 'blood_trans_today', type: 'text', nullable: true })
  BloodTrans_Today!: string | null;

  @Column({ name: 'blood_trans_bag_no', type: 'text', nullable: true })
  BloodTrans_BagNo!: string | null;

  @Column({ name: 'blood_trans_next_bt', type: 'boolean', nullable: false })
  BloodTrans_NextBT!: boolean;

  @Column({ name: 'blood_trans_collection_date', type: 'timestamp', nullable: false })
  BloodTrans_CollectionDate!: string;

  @Column({ name: 'blood_trans_exp_date', type: 'timestamp', nullable: false })
  BloodTrans_ExpDate!: string;

  @Column({ name: 'treatment_data_pre_weight', type: 'text', nullable: true })
  TreatmentData_PreWeight!: string | null;

  @Column({ name: 'treatment_data_post_weight', type: 'text', nullable: true })
  TreatmentData_PostWeight!: string | null;

  @Column({ name: 'treatment_data_pre_temperature', type: 'text', nullable: true })
  TreatmentData_PreTemperature!: string | null;

  @Column({ name: 'treatment_data_post_temperature', type: 'text', nullable: true })
  TreatmentData_PostTemperature!: string | null;

  @Column({ name: 'treatment_data_pre_pulse', type: 'text', nullable: true })
  TreatmentData_PrePulse!: string | null;

  @Column({ name: 'treatment_data_post_pulse', type: 'text', nullable: true })
  TreatmentData_PostPulse!: string | null;

  @Column({ name: 'treatment_data_pre_stand_bp', type: 'text', nullable: true })
  TreatmentData_PreStandBp!: string | null;

  @Column({ name: 'treatment_data_post_stand_bp', type: 'text', nullable: true })
  TreatmentData_PostStandBp!: string | null;

  @Column({ name: 'treatment_data_pre_sit_bp', type: 'text', nullable: true })
  TreatmentData_PreSitBp!: string | null;

  @Column({ name: 'treatment_data_post_sit_bp', type: 'text', nullable: true })
  TreatmentData_PostSitBp!: string | null;

  @Column({ name: 'treatment_data_uf_goal', type: 'text', nullable: true })
  TreatmentData_UfGoal!: string | null;

  @Column({ name: 'treatment_data_machine_no', type: 'text', nullable: true })
  TreatmentData_MachineNo!: string | null;

  @Column({ name: 'treatment_data_machine_conductivity', type: 'text', nullable: true })
  TreatmentData_Machine_Conductivity!: string | null;

  @Column({ name: 'treatment_data_machine_temperature', type: 'text', nullable: true })
  TreatmentData_Machine_Temperature!: string | null;

  @Column({ name: 'treatment_data_machine_machine_check', type: 'text', nullable: true })
  TreatmentData_Machine_MachineCheck!: string | null;

  @Column({ name: 'treatment_data_initials', type: 'text', nullable: true })
  TreatmentData_Initials!: string | null;

  @Column({ name: 'treatment_data_pre_lab', type: 'text', nullable: true })
  TreatmentData_PreLab!: string | null;

  @Column({ name: 'treatment_data_post_lab', type: 'text', nullable: true })
  TreatmentData_PostLab!: string | null;

  @Column({ name: 'treatment_data_hb_pc_v', type: 'text', nullable: true })
  TreatmentData_Hb_PcV!: string | null;

  @Column({ name: 'treatment_data_blood_sugar', type: 'text', nullable: true })
  TreatmentData_BloodSugar!: string | null;

  @Column({ name: 'treatment_data_time_on', type: 'text', nullable: true })
  TreatmentData_TimeOn!: string | null;

  @Column({ name: 'treatment_data_time_on_by', type: 'text', nullable: true })
  TreatmentData_TimeOn_By!: string | null;

  @Column({ name: 'treatment_data_time_off', type: 'text', nullable: true })
  TreatmentData_TimeOff!: string | null;

  @Column({ name: 'treatment_data_time_off_by', type: 'text', nullable: true })
  TreatmentData_TimeOff_By!: string | null;

  @Column({ name: 'on_examination_pallor', type: 'text', nullable: true })
  OnExamination_Pallor!: string | null;

  @Column({ name: 'on_examination_ictercus', type: 'text', nullable: true })
  OnExamination_Ictercus!: string | null;

  @Column({ name: 'on_examination_jvp', type: 'text', nullable: true })
  OnExamination_JVP!: string | null;

  @Column({ name: 'on_examination_rash', type: 'text', nullable: true })
  OnExamination_Rash!: string | null;

  @Column({ name: 'on_examination_lymphnode', type: 'text', nullable: true })
  OnExamination_Lymphnode!: string | null;

  @Column({ name: 'on_examination_chest', type: 'text', nullable: true })
  OnExamination_Chest!: string | null;

  @Column({ name: 'on_examination_cvs', type: 'text', nullable: true })
  OnExamination_CVS!: string | null;

  @Column({ name: 'on_examination_pa', type: 'text', nullable: true })
  OnExamination_PA!: string | null;

  @Column({ name: 'on_examination_s_po2', type: 'text', nullable: true })
  OnExamination_SPo2!: string | null;

  @Column({ name: 'on_examination_others', type: 'text', nullable: true })
  OnExamination_Others!: string | null;

  @Column({ name: 'chief_complaint', type: 'text', nullable: true })
  ChiefComplaint!: string | null;

  @Column({ name: 'comments_drugs', type: 'text', nullable: true })
  Comments_Drugs!: string | null;

  @Column({ name: 'post_dialysis_assesment', type: 'text', nullable: true })
  PostDialysisAssesment!: string | null;

  @Column({ name: 'total_blood_volume', type: 'text', nullable: true })
  TotalBloodVolume!: string | null;

  @Column({ name: 'total_heparin_saline', type: 'text', nullable: true })
  TotalHeparin_Saline!: string | null;

  @Column({ name: 'total_fluid_removed', type: 'text', nullable: true })
  TotalFluidRemoved!: string | null;

  @Column({ name: 'weight_difference', type: 'text', nullable: true })
  WeightDifference!: string | null;

  @Column({ name: 'pt_sent_to_hospital', type: 'text', nullable: true })
  PtSentToHospital!: string | null;

  @Column({ name: 'pt_sent_to_home', type: 'text', nullable: true })
  PtSentToHome!: string | null;

  @Column({ name: 'is_dialyzer_discard', type: 'boolean', nullable: false })
  IsDialyzerDiscard!: boolean;

  @Column({ name: 'is_submitted', type: 'boolean', nullable: false })
  IsSubmitted!: boolean;

  @Column({ name: 'is_submitted_on', type: 'timestamp', nullable: false })
  IsSubmittedOn!: string;

  @Column({ name: 'checked_by_name', type: 'text', nullable: true })
  CheckedByName!: string | null;

  @Column({ name: 'verified_by_name', type: 'text', nullable: true })
  VerifiedByName!: string | null;

  @Column({ name: 'signatory_name_1', type: 'text', nullable: true })
  SignatoryName_1!: string | null;

  @Column({ name: 'signatory_name_2', type: 'text', nullable: true })
  SignatoryName_2!: string | null;

  @Column({ name: 'created_on', type: 'timestamp', nullable: false })
  CreatedOn!: string;

  @Column({ name: 'created_by', type: 'integer', nullable: false })
  CreatedBy!: number;

  @Column({ name: 'modified_on', type: 'timestamp', nullable: false })
  ModifiedOn!: string;

  @Column({ name: 'modified_by', type: 'integer', nullable: false })
  ModifiedBy!: number;

  @Column({ name: 'is_active', type: 'boolean', nullable: false })
  IsActive!: boolean;

}

@Entity({ name: 'txn_sms' })
export class SmsModel {
  @PrimaryGeneratedColumn({ name: 'sms_id' })
  SmsId!: number;

  @Column({ name: 'sms_counter', type: 'integer', nullable: false })
  SmsCounter!: number;

  @Column({ name: 'patient_id', type: 'integer', nullable: false })
  PatientId!: number;

  @Column({ name: 'doctor_id', type: 'integer', nullable: true })
  DoctorId!: number | null;

  @Column({ name: 'sms_information', type: 'text', nullable: true })
  SmsInformation!: string | null;

  @Column({ name: 'created_on', type: 'timestamp', nullable: true })
  CreatedOn!: string | null;

  @Column({ name: 'created_by', type: 'integer', nullable: true })
  CreatedBy!: number | null;

}
