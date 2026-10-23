/* GÉNÉRÉ par tools/generate-entities.mjs depuis migration/inventory/entities.json : ne pas modifier à la main. */
import { Column, Entity, PrimaryColumn, PrimaryGeneratedColumn } from 'typeorm';


@Entity({ name: 'core_lookup_detail' })
export class CoreLookupDetail {
  @PrimaryGeneratedColumn({ name: 'id' })
  Id!: number;

  @Column({ name: 'name', type: 'text', nullable: true })
  Name!: string | null;

  @Column({ name: 'description', type: 'text', nullable: true })
  Description!: string | null;

  @Column({ name: 'display_name', type: 'text', nullable: true })
  DisplayName!: string | null;

  @Column({ name: 'display_sequence', type: 'integer', nullable: true })
  DisplaySequence!: number | null;

  @Column({ name: 'parent_id', type: 'integer', nullable: true })
  ParentId!: number | null;

  @Column({ name: 'is_active', type: 'boolean', nullable: false })
  IsActive!: boolean;

}

@Entity({ name: 'er_discharge_summary' })
export class EmergencyDischargeSummaryModel {
  @PrimaryGeneratedColumn({ name: 'er_discharge_summary_id' })
  ERDischargeSummaryId!: number;

  @Column({ name: 'patient_id', type: 'integer', nullable: false })
  PatientId!: number;

  @Column({ name: 'patient_visit_id', type: 'integer', nullable: false })
  PatientVisitId!: number;

  @Column({ name: 'discharge_type', type: 'text', nullable: true })
  DischargeType!: string | null;

  @Column({ name: 'chief_complaints', type: 'text', nullable: true })
  ChiefComplaints!: string | null;

  @Column({ name: 'treatment_in_er', type: 'text', nullable: true })
  TreatmentInER!: string | null;

  @Column({ name: 'investigations', type: 'text', nullable: true })
  Investigations!: string | null;

  @Column({ name: 'advice_on_discharge', type: 'text', nullable: true })
  AdviceOnDischarge!: string | null;

  @Column({ name: 'on_examination', type: 'text', nullable: true })
  OnExamination!: string | null;

  @Column({ name: 'provisional_diagnosis', type: 'text', nullable: true })
  ProvisionalDiagnosis!: string | null;

  @Column({ name: 'doctor_name', type: 'text', nullable: true })
  DoctorName!: string | null;

  @Column({ name: 'medical_officer', type: 'text', nullable: true })
  MedicalOfficer!: string | null;

  @Column({ name: 'created_by', type: 'integer', nullable: true })
  CreatedBy!: number | null;

  @Column({ name: 'created_on', type: 'timestamp', nullable: true })
  CreatedOn!: string | null;

  @Column({ name: 'modified_by', type: 'integer', nullable: true })
  ModifiedBy!: number | null;

  @Column({ name: 'modified_on', type: 'timestamp', nullable: true })
  ModifiedOn!: string | null;

}

@Entity({ name: 'er_file_uploads' })
export class UploadConsentForm {
  @PrimaryGeneratedColumn({ name: 'file_id' })
  FileId!: number;

  @Column({ name: 'er_patient_id', type: 'integer', nullable: false })
  ERPatientId!: number;

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

  @Column({ name: 'created_by', type: 'integer', nullable: true })
  CreatedBy!: number | null;

  @Column({ name: 'modified_by', type: 'integer', nullable: true })
  ModifiedBy!: number | null;

  @Column({ name: 'modified_on', type: 'timestamp', nullable: true })
  ModifiedOn!: string | null;

  @Column({ name: 'is_active', type: 'boolean', nullable: true })
  IsActive!: boolean | null;

}

@Entity({ name: 'er_mode_of_arrival' })
export class ModeOfArrival {
  @PrimaryGeneratedColumn({ name: 'mode_of_arrival_id' })
  ModeOfArrivalId!: number;

  @Column({ name: 'mode_of_arrival_name', type: 'text', nullable: true })
  ModeOfArrivalName!: string | null;

  @Column({ name: 'is_active', type: 'boolean', nullable: false })
  IsActive!: boolean;

  @Column({ name: 'created_by', type: 'integer', nullable: true })
  CreatedBy!: number | null;

  @Column({ name: 'created_on', type: 'timestamp', nullable: true })
  CreatedOn!: string | null;

  @Column({ name: 'modified_by', type: 'integer', nullable: true })
  ModifiedBy!: number | null;

  @Column({ name: 'modified_on', type: 'timestamp', nullable: true })
  ModifiedOn!: string | null;

}

@Entity({ name: 'er_patient' })
export class EmergencyPatientModel {
  @PrimaryGeneratedColumn({ name: 'er_patient_id' })
  ERPatientId!: number;

  @Column({ name: 'er_patient_number', type: 'integer', nullable: false })
  ERPatientNumber!: number;

  @Column({ name: 'patient_id', type: 'integer', nullable: true })
  PatientId!: number | null;

  @Column({ name: 'patient_visit_id', type: 'integer', nullable: true })
  PatientVisitId!: number | null;

  @Column({ name: 'er_discharge_summary_id', type: 'integer', nullable: true })
  ERDischargeSummaryId!: number | null;

  @Column({ name: 'visit_date_time', type: 'timestamp', nullable: true })
  VisitDateTime!: string | null;

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

  @Column({ name: 'date_of_birth', type: 'timestamp', nullable: true })
  DateOfBirth!: string | null;

  @Column({ name: 'contact_no', type: 'text', nullable: true })
  ContactNo!: string | null;

  @Column({ name: 'care_of_person_contact_number', type: 'text', nullable: true })
  CareOfPersonContactNumber!: string | null;

  @Column({ name: 'address', type: 'text', nullable: true })
  Address!: string | null;

  @Column({ name: 'referred_by', type: 'text', nullable: true })
  ReferredBy!: string | null;

  @Column({ name: 'referred_to', type: 'text', nullable: true })
  ReferredTo!: string | null;

  @Column({ name: 'case', type: 'text', nullable: true })
  Case!: string | null;

  @Column({ name: 'condition_on_arrival', type: 'text', nullable: true })
  ConditionOnArrival!: string | null;

  @Column({ name: 'brought_by', type: 'text', nullable: true })
  BroughtBy!: string | null;

  @Column({ name: 'relation_with_patient', type: 'text', nullable: true })
  RelationWithPatient!: string | null;

  @Column({ name: 'mode_of_arrival', type: 'integer', nullable: true })
  ModeOfArrival!: number | null;

  @Column({ name: 'care_of_person', type: 'text', nullable: true })
  CareOfPerson!: string | null;

  @Column({ name: 'er_status', type: 'text', nullable: true })
  ERStatus!: string | null;

  @Column({ name: 'triage_code', type: 'text', nullable: true })
  TriageCode!: string | null;

  @Column({ name: 'triaged_by', type: 'integer', nullable: true })
  TriagedBy!: number | null;

  @Column({ name: 'triaged_on', type: 'timestamp', nullable: true })
  TriagedOn!: string | null;

  @Column({ name: 'created_by', type: 'integer', nullable: true })
  CreatedBy!: number | null;

  @Column({ name: 'created_on', type: 'timestamp', nullable: true })
  CreatedOn!: string | null;

  @Column({ name: 'modified_by', type: 'integer', nullable: true })
  ModifiedBy!: number | null;

  @Column({ name: 'modified_on', type: 'timestamp', nullable: true })
  ModifiedOn!: string | null;

  @Column({ name: 'is_active', type: 'boolean', nullable: false })
  IsActive!: boolean;

  @Column({ name: 'is_existing_patient', type: 'boolean', nullable: false })
  IsExistingPatient!: boolean;

  @Column({ name: 'old_patient_id', type: 'text', nullable: true })
  OldPatientId!: string | null;

  @Column({ name: 'ward_no', type: 'integer', nullable: true })
  WardNo!: number | null;

  @Column({ name: 'finalized_status', type: 'text', nullable: true })
  FinalizedStatus!: string | null;

  @Column({ name: 'finalized_remarks', type: 'text', nullable: true })
  FinalizedRemarks!: string | null;

  @Column({ name: 'finalized_by', type: 'integer', nullable: true })
  FinalizedBy!: number | null;

  @Column({ name: 'finalized_on', type: 'timestamp', nullable: true })
  FinalizedOn!: string | null;

  @Column({ name: 'performer_id', type: 'integer', nullable: true })
  PerformerId!: number | null;

  @Column({ name: 'performer_name', type: 'text', nullable: true })
  PerformerName!: string | null;

  @Column({ name: 'is_police_case', type: 'boolean', nullable: true })
  IsPoliceCase!: boolean | null;

}

@Entity({ name: 'er_patient_cases' })
export class EmergencyPatientCases {
  @PrimaryGeneratedColumn({ name: 'patient_case_id' })
  PatientCaseId!: number;

  @Column({ name: 'er_patient_id', type: 'integer', nullable: true })
  ERPatientId!: number | null;

  @Column({ name: 'main_case', type: 'integer', nullable: true })
  MainCase!: number | null;

  @Column({ name: 'sub_case', type: 'integer', nullable: true })
  SubCase!: number | null;

  @Column({ name: 'other_case_details', type: 'text', nullable: true })
  OtherCaseDetails!: string | null;

  @Column({ name: 'biting_site', type: 'integer', nullable: true })
  BitingSite!: number | null;

  @Column({ name: 'date_time_of_bite', type: 'timestamp', nullable: true })
  DateTimeOfBite!: string | null;

  @Column({ name: 'biting_animal', type: 'integer', nullable: true })
  BitingAnimal!: number | null;

  @Column({ name: 'first_aid', type: 'integer', nullable: true })
  FirstAid!: number | null;

  @Column({ name: 'first_aid_others', type: 'text', nullable: true })
  FirstAidOthers!: string | null;

  @Column({ name: 'biting_animal_others', type: 'text', nullable: true })
  BitingAnimalOthers!: string | null;

  @Column({ name: 'biting_site_others', type: 'text', nullable: true })
  BitingSiteOthers!: string | null;

  @Column({ name: 'biting_country', type: 'integer', nullable: false })
  BitingCountry!: number;

  @Column({ name: 'biting_municipality', type: 'integer', nullable: false })
  BitingMunicipality!: number;

  @Column({ name: 'biting_address', type: 'text', nullable: true })
  BitingAddress!: string | null;

  @Column({ name: 'is_active', type: 'boolean', nullable: true })
  IsActive!: boolean | null;

  @Column({ name: 'created_by', type: 'integer', nullable: true })
  CreatedBy!: number | null;

  @Column({ name: 'created_on', type: 'timestamp', nullable: true })
  CreatedOn!: string | null;

  @Column({ name: 'modified_by', type: 'integer', nullable: true })
  ModifiedBy!: number | null;

  @Column({ name: 'modified_on', type: 'timestamp', nullable: true })
  ModifiedOn!: string | null;

  @Column({ name: 'biting_animal_name', type: 'text', nullable: true })
  BitingAnimalName!: string | null;

}
