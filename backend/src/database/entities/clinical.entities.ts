/* GÉNÉRÉ par tools/generate-entities.mjs depuis migration/inventory/entities.json : ne pas modifier à la main. */
import { Column, Entity, PrimaryColumn, PrimaryGeneratedColumn } from 'typeorm';
import { NUM } from '../transformers';

@Entity({ name: 'cln_active_medicals' })
export class ActiveMedicalProblem {
  @Column({ name: 'patient_id', type: 'integer', nullable: false })
  PatientId!: number;

  @Column({ name: 'icd10_code', type: 'text', nullable: true })
  ICD10Code!: string | null;

  @Column({ name: 'icd10_description', type: 'text', nullable: true })
  ICD10Description!: string | null;

  @Column({ name: 'created_by', type: 'integer', nullable: true })
  CreatedBy!: number | null;

  @Column({ name: 'modified_by', type: 'integer', nullable: true })
  ModifiedBy!: number | null;

  @Column({ name: 'created_on', type: 'timestamp', nullable: true })
  CreatedOn!: string | null;

  @Column({ name: 'modified_on', type: 'timestamp', nullable: true })
  ModifiedOn!: string | null;

  @PrimaryGeneratedColumn({ name: 'patient_problem_id' })
  PatientProblemId!: number;

  @Column({ name: 'current_status', type: 'text', nullable: true })
  CurrentStatus!: string | null;

  @Column({ name: 'note', type: 'text', nullable: true })
  Note!: string | null;

  @Column({ name: 'on_set_date', type: 'timestamp', nullable: true })
  OnSetDate!: string | null;

  @Column({ name: 'resolved_date', type: 'timestamp', nullable: true })
  ResolvedDate!: string | null;

  @Column({ name: 'is_resolved', type: 'boolean', nullable: false })
  IsResolved!: boolean;

  @Column({ name: 'principle_problem', type: 'boolean', nullable: true })
  PrincipleProblem!: boolean | null;

}

@Entity({ name: 'cln_allergies' })
export class AllergyModel {
  @PrimaryGeneratedColumn({ name: 'patient_allergy_id' })
  PatientAllergyId!: number;

  @Column({ name: 'patient_id', type: 'integer', nullable: false })
  PatientId!: number;

  @Column({ name: 'allergen_adv_rec_id', type: 'integer', nullable: true })
  AllergenAdvRecId!: number | null;

  @Column({ name: 'allergen_adv_rec_name', type: 'text', nullable: true })
  AllergenAdvRecName!: string | null;

  @Column({ name: 'allergy_type', type: 'text', nullable: true })
  AllergyType!: string | null;

  @Column({ name: 'severity', type: 'text', nullable: true })
  Severity!: string | null;

  @Column({ name: 'verified', type: 'boolean', nullable: false })
  Verified!: boolean;

  @Column({ name: 'reaction', type: 'text', nullable: true })
  Reaction!: string | null;

  @Column({ name: 'comments', type: 'text', nullable: true })
  Comments!: string | null;

  @Column({ name: 'created_by', type: 'integer', nullable: true })
  CreatedBy!: number | null;

  @Column({ name: 'modified_by', type: 'integer', nullable: true })
  ModifiedBy!: number | null;

  @Column({ name: 'created_on', type: 'timestamp', nullable: true })
  CreatedOn!: string | null;

  @Column({ name: 'modified_on', type: 'timestamp', nullable: true })
  ModifiedOn!: string | null;

}

@Entity({ name: 'cln_blood_sugar_monitoring' })
export class BloodSugarModel {
  @PrimaryGeneratedColumn({ name: 'blood_sugar_monitoring_id' })
  BloodSugarMonitoringId!: number;

  @Column({ name: 'patient_id', type: 'integer', nullable: false })
  PatientId!: number;

  @Column({ name: 'patient_visit_id', type: 'integer', nullable: false })
  PatientVisitId!: number;

  @Column({ name: 'entry_date_time', type: 'timestamp', nullable: false })
  EntryDateTime!: string;

  @Column({ name: 'rbs_value', type: 'numeric', nullable: false, transformer: NUM })
  RbsValue!: number;

  @Column({ name: 'insulin', type: 'numeric', nullable: false, transformer: NUM })
  Insulin!: number;

  @Column({ name: 'remarks', type: 'text', nullable: true })
  Remarks!: string | null;

  @Column({ name: 'created_on', type: 'timestamp', nullable: false })
  CreatedOn!: string;

  @Column({ name: 'created_by', type: 'integer', nullable: false })
  CreatedBy!: number;

  @Column({ name: 'modified_on', type: 'timestamp', nullable: true })
  ModifiedOn!: string | null;

  @Column({ name: 'modified_by', type: 'integer', nullable: true })
  ModifiedBy!: number | null;

  @Column({ name: 'is_active', type: 'boolean', nullable: false })
  IsActive!: boolean;

}

@Entity({ name: 'cln_consultation_request' })
export class ConsultationRequestModel {
  @PrimaryGeneratedColumn({ name: 'consultation_request_id' })
  ConsultationRequestId!: number;

  @Column({ name: 'patient_id', type: 'integer', nullable: false })
  PatientId!: number;

  @Column({ name: 'patient_visit_id', type: 'integer', nullable: false })
  PatientVisitId!: number;

  @Column({ name: 'ward_id', type: 'integer', nullable: true })
  WardId!: number | null;

  @Column({ name: 'bed_id', type: 'integer', nullable: true })
  BedId!: number | null;

  @Column({ name: 'requested_on', type: 'timestamp', nullable: false })
  RequestedOn!: string;

  @Column({ name: 'requesting_consultant_id', type: 'integer', nullable: false })
  RequestingConsultantId!: number;

  @Column({ name: 'requesting_department_id', type: 'integer', nullable: false })
  RequestingDepartmentId!: number;

  @Column({ name: 'purpose_of_consultation', type: 'text', nullable: true })
  PurposeOfConsultation!: string | null;

  @Column({ name: 'consulting_doctor_id', type: 'integer', nullable: false })
  ConsultingDoctorId!: number;

  @Column({ name: 'consulting_department_id', type: 'integer', nullable: false })
  ConsultingDepartmentId!: number;

  @Column({ name: 'consultant_response', type: 'text', nullable: true })
  ConsultantResponse!: string | null;

  @Column({ name: 'consulted_on', type: 'timestamp', nullable: true })
  ConsultedOn!: string | null;

  @Column({ name: 'status', type: 'text', nullable: true })
  Status!: string | null;

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

@Entity({ name: 'cln_diagnosis' })
export class ClinicalDiagnosisModel {
  @PrimaryGeneratedColumn({ name: 'diagnosis_id' })
  DiagnosisId!: number;

  @Column({ name: 'notes_id', type: 'integer', nullable: false })
  NotesId!: number;

  @Column({ name: 'patient_id', type: 'integer', nullable: false })
  PatientId!: number;

  @Column({ name: 'patient_visit_id', type: 'integer', nullable: false })
  PatientVisitId!: number;

  @Column({ name: 'icd10_id', type: 'integer', nullable: false })
  ICD10ID!: number;

  @Column({ name: 'icd10_description', type: 'text', nullable: true })
  ICD10Description!: string | null;

  @Column({ name: 'icd10_code', type: 'text', nullable: true })
  ICD10Code!: string | null;

  @Column({ name: 'created_by', type: 'integer', nullable: true })
  CreatedBy!: number | null;

  @Column({ name: 'modified_by', type: 'integer', nullable: true })
  ModifiedBy!: number | null;

  @Column({ name: 'created_on', type: 'timestamp', nullable: true })
  CreatedOn!: string | null;

  @Column({ name: 'modified_on', type: 'timestamp', nullable: true })
  ModifiedOn!: string | null;

  @Column({ name: 'is_active', type: 'boolean', nullable: true })
  IsActive!: boolean | null;

}

@Entity({ name: 'cln_eye_ablation_profile' })
export class AblationProfileModel {
  @PrimaryGeneratedColumn({ name: 'id' })
  Id!: number;

  @Column({ name: 'master_id', type: 'integer', nullable: false })
  MasterId!: number;

  @Column({ name: 'profile', type: 'text', nullable: true })
  Profile!: string | null;

  @Column({ name: 'dzp_factor', type: 'text', nullable: true })
  DZPFactor!: string | null;

  @Column({ name: 'is_sx_done', type: 'boolean', nullable: false })
  isSXDone!: boolean;

  @Column({ name: 'is_ptk_performed', type: 'boolean', nullable: false })
  isPTKPerformed!: boolean;

  @Column({ name: 'created_by', type: 'integer', nullable: false })
  CreatedBy!: number;

  @Column({ name: 'created_on', type: 'timestamp', nullable: false })
  CreatedOn!: string;

  @Column({ name: 'is_od', type: 'boolean', nullable: false })
  IsOD!: boolean;

  @Column({ name: 'notes', type: 'text', nullable: true })
  Notes!: string | null;

}

@Entity({ name: 'cln_eye_laser_data_entry' })
export class LaserDataEntryModel {
  @PrimaryGeneratedColumn({ name: 'id' })
  Id!: number;

  @Column({ name: 'master_id', type: 'integer', nullable: false })
  MasterId!: number;

  @Column({ name: 'profile', type: 'text', nullable: true })
  Profile!: string | null;

  @Column({ name: 'sph', type: 'double precision', nullable: true })
  Sph!: number | null;

  @Column({ name: 'cyf', type: 'double precision', nullable: true })
  Cyf!: number | null;

  @Column({ name: 'axis', type: 'integer', nullable: true })
  Axis!: number | null;

  @Column({ name: 'zone', type: 'text', nullable: true })
  Zone!: string | null;

  @Column({ name: 'transmission', type: 'text', nullable: true })
  Transmission!: string | null;

  @Column({ name: 'created_by', type: 'integer', nullable: false })
  CreatedBy!: number;

  @Column({ name: 'created_on', type: 'timestamp', nullable: false })
  CreatedOn!: string;

  @Column({ name: 'is_od', type: 'boolean', nullable: false })
  IsOD!: boolean;

}

@Entity({ name: 'cln_eye_lasik_rst' })
export class LASIKRSTModel {
  @PrimaryGeneratedColumn({ name: 'id' })
  Id!: number;

  @Column({ name: 'master_id', type: 'integer', nullable: false })
  MasterId!: number;

  @Column({ name: 'pachymetry_microns', type: 'text', nullable: true })
  PachymetryMicrons!: string | null;

  @Column({ name: 'pachymetry_notes', type: 'text', nullable: true })
  PachymetryNotes!: string | null;

  @Column({ name: 'flap_depth_microns', type: 'text', nullable: true })
  FlapDepthMicrons!: string | null;

  @Column({ name: 'flap_depth_notes', type: 'text', nullable: true })
  FlapDepthNotes!: string | null;

  @Column({ name: 'ablation_depth_microns', type: 'text', nullable: true })
  AblationDepthMicrons!: string | null;

  @Column({ name: 'ablation_depth_notes', type: 'text', nullable: true })
  AblationDepthNotes!: string | null;

  @Column({ name: 'predicted_rst_microns', type: 'text', nullable: true })
  PredictedRSTMicrons!: string | null;

  @Column({ name: 'predicted_rst_notes', type: 'text', nullable: true })
  PredictedRSTNotes!: string | null;

  @Column({ name: 'created_by', type: 'integer', nullable: false })
  CreatedBy!: number;

  @Column({ name: 'created_on', type: 'timestamp', nullable: false })
  CreatedOn!: string;

  @Column({ name: 'is_od', type: 'boolean', nullable: false })
  IsOD!: boolean;

}

@Entity({ name: 'cln_eye_operation_notes' })
export class OperationNotesModel {
  @PrimaryGeneratedColumn({ name: 'id' })
  Id!: number;

  @Column({ name: 'master_id', type: 'integer', nullable: false })
  MasterId!: number;

  @Column({ name: 'notes', type: 'text', nullable: true })
  Notes!: string | null;

  @Column({ name: 'created_by', type: 'integer', nullable: false })
  CreatedBy!: number;

  @Column({ name: 'created_on', type: 'timestamp', nullable: false })
  CreatedOn!: string;

  @Column({ name: 'is_od', type: 'boolean', nullable: false })
  IsOD!: boolean;

}

@Entity({ name: 'cln_eye_ora' })
export class ORAModel {
  @PrimaryGeneratedColumn({ name: 'id' })
  Id!: number;

  @Column({ name: 'master_id', type: 'integer', nullable: false })
  MasterId!: number;

  @Column({ name: 'date', type: 'timestamp', nullable: true })
  Date!: string | null;

  @Column({ name: 'timepoint', type: 'text', nullable: true })
  Timepoint!: string | null;

  @Column({ name: 'io_pcc', type: 'text', nullable: true })
  IOPcc!: string | null;

  @Column({ name: 'crf', type: 'text', nullable: true })
  CRF!: string | null;

  @Column({ name: 'ch', type: 'text', nullable: true })
  CH!: string | null;

  @Column({ name: 'created_by', type: 'integer', nullable: false })
  CreatedBy!: number;

  @Column({ name: 'created_on', type: 'timestamp', nullable: false })
  CreatedOn!: string;

  @Column({ name: 'is_od', type: 'boolean', nullable: false })
  IsOD!: boolean;

}

@Entity({ name: 'cln_eye_pachymetry' })
export class PachymetryModel {
  @PrimaryGeneratedColumn({ name: 'id' })
  Id!: number;

  @Column({ name: 'master_id', type: 'integer', nullable: false })
  MasterId!: number;

  @Column({ name: 'date', type: 'timestamp', nullable: true })
  Date!: string | null;

  @Column({ name: 'time_point_pre', type: 'text', nullable: true })
  TimePointPre!: string | null;

  @Column({ name: 'us_min', type: 'text', nullable: true })
  USMin!: string | null;

  @Column({ name: 'visante_rst', type: 'text', nullable: true })
  VisanteRST!: string | null;

  @Column({ name: 'created_by', type: 'integer', nullable: false })
  CreatedBy!: number;

  @Column({ name: 'created_on', type: 'timestamp', nullable: false })
  CreatedOn!: string;

  @Column({ name: 'is_od', type: 'boolean', nullable: false })
  IsOD!: boolean;

}

@Entity({ name: 'cln_eye_pre_op_pachymetry' })
export class PreOPPachymetryModel {
  @PrimaryGeneratedColumn({ name: 'id' })
  Id!: number;

  @Column({ name: 'master_id', type: 'integer', nullable: false })
  MasterId!: number;

  @Column({ name: 'profile', type: 'text', nullable: true })
  Profile!: string | null;

  @Column({ name: 'pent_min', type: 'integer', nullable: false })
  PentMin!: number;

  @Column({ name: 'pent_central', type: 'integer', nullable: false })
  PentCentral!: number;

  @Column({ name: 'us_min', type: 'integer', nullable: false })
  USMin!: number;

  @Column({ name: 'visante_min', type: 'integer', nullable: false })
  VisanteMin!: number;

  @Column({ name: 'created_by', type: 'integer', nullable: false })
  CreatedBy!: number;

  @Column({ name: 'created_on', type: 'timestamp', nullable: false })
  CreatedOn!: string;

  @Column({ name: 'is_od', type: 'boolean', nullable: false })
  IsOD!: boolean;

}

@Entity({ name: 'cln_eye_refraction' })
export class RefractionModel {
  @PrimaryGeneratedColumn({ name: 'id' })
  Id!: number;

  @Column({ name: 'master_id', type: 'integer', nullable: false })
  MasterId!: number;

  @Column({ name: 'date', type: 'timestamp', nullable: true })
  Date!: string | null;

  @Column({ name: 'time_point', type: 'text', nullable: true })
  TimePoint!: string | null;

  @Column({ name: 'ucva', type: 'integer', nullable: true })
  UCVA!: number | null;

  @Column({ name: 'u_lett', type: 'text', nullable: true })
  ULett!: string | null;

  @Column({ name: 'nuc', type: 'text', nullable: true })
  NUC!: string | null;

  @Column({ name: 'sph', type: 'double precision', nullable: true })
  Sph!: number | null;

  @Column({ name: 'cyf', type: 'double precision', nullable: true })
  Cyf!: number | null;

  @Column({ name: 'axis', type: 'integer', nullable: true })
  Axis!: number | null;

  @Column({ name: 'bscva', type: 'integer', nullable: true })
  BSCVA!: number | null;

  @Column({ name: 'b_lett', type: 'text', nullable: true })
  BLett!: string | null;

  @Column({ name: 'dcnv', type: 'text', nullable: true })
  DCNV!: string | null;

  @Column({ name: 'created_by', type: 'integer', nullable: false })
  CreatedBy!: number;

  @Column({ name: 'created_on', type: 'timestamp', nullable: false })
  CreatedOn!: string;

  @Column({ name: 'is_od', type: 'boolean', nullable: false })
  IsOD!: boolean;

}

@Entity({ name: 'cln_eye_smile_incisions' })
export class SmileIncisionsModel {
  @PrimaryGeneratedColumn({ name: 'id' })
  Id!: number;

  @Column({ name: 'master_id', type: 'integer', nullable: false })
  MasterId!: number;

  @Column({ name: 'position', type: 'integer', nullable: true })
  Position!: number | null;

  @Column({ name: 'width', type: 'integer', nullable: true })
  Width!: number | null;

  @Column({ name: 'created_by', type: 'integer', nullable: false })
  CreatedBy!: number;

  @Column({ name: 'created_on', type: 'timestamp', nullable: false })
  CreatedOn!: string;

  @Column({ name: 'is_od', type: 'boolean', nullable: false })
  IsOD!: boolean;

}

@Entity({ name: 'cln_eye_smile_setting' })
export class SMILESSettingsModel {
  @PrimaryGeneratedColumn({ name: 'id' })
  Id!: number;

  @Column({ name: 'master_id', type: 'integer', nullable: false })
  MasterId!: number;

  @Column({ name: 'spot_distance_lent', type: 'text', nullable: true })
  SpotDistanceLent!: string | null;

  @Column({ name: 'spot_distance_lent_side', type: 'text', nullable: true })
  SpotDistanceLentSide!: string | null;

  @Column({ name: 'spot_distance_cap', type: 'text', nullable: true })
  SpotDistanceCap!: string | null;

  @Column({ name: 'spot_distance_cap_side', type: 'text', nullable: true })
  SpotDistanceCapSide!: string | null;

  @Column({ name: 'track_distance_lent', type: 'text', nullable: true })
  TrackDistanceLent!: string | null;

  @Column({ name: 'track_distance_lent_side', type: 'text', nullable: true })
  TrackDistanceLentSide!: string | null;

  @Column({ name: 'track_distance_cap', type: 'text', nullable: true })
  TrackDistanceCap!: string | null;

  @Column({ name: 'track_distance_cap_side', type: 'text', nullable: true })
  TrackDistanceCapSide!: string | null;

  @Column({ name: 'energy_offset_lent', type: 'text', nullable: true })
  EnergyOffsetLent!: string | null;

  @Column({ name: 'energy_offset_lent_side', type: 'text', nullable: true })
  EnergyOffsetLentSide!: string | null;

  @Column({ name: 'energy_offset_cap', type: 'text', nullable: true })
  EnergyOffsetCap!: string | null;

  @Column({ name: 'energy_offset_cap_side', type: 'text', nullable: true })
  EnergyOffsetCapSide!: string | null;

  @Column({ name: 'scan_direction_lent', type: 'text', nullable: true })
  ScanDirectionLent!: string | null;

  @Column({ name: 'scan_direction_lent_side', type: 'text', nullable: true })
  ScanDirectionLentSide!: string | null;

  @Column({ name: 'scan_direction_cap', type: 'text', nullable: true })
  ScanDirectionCap!: string | null;

  @Column({ name: 'scan_direction_cap_side', type: 'text', nullable: true })
  ScanDirectionCapSide!: string | null;

  @Column({ name: 'scan_mode_lent', type: 'text', nullable: true })
  ScanModeLent!: string | null;

  @Column({ name: 'scan_mode_lent_side', type: 'text', nullable: true })
  ScanModeLentSide!: string | null;

  @Column({ name: 'scan_mode_cap', type: 'text', nullable: true })
  ScanModeCap!: string | null;

  @Column({ name: 'scan_mode_cap_side', type: 'text', nullable: true })
  ScanModeCapSide!: string | null;

  @Column({ name: 'min_thickness_lent', type: 'text', nullable: true })
  MinThicknessLent!: string | null;

  @Column({ name: 'min_thickness_lent_side', type: 'text', nullable: true })
  MinThicknessLentSide!: string | null;

  @Column({ name: 'min_thickness_cap', type: 'text', nullable: true })
  MinThicknessCap!: string | null;

  @Column({ name: 'min_thickness_cap_side', type: 'text', nullable: true })
  MinThicknessCapSide!: string | null;

  @Column({ name: 'sidecut_lent', type: 'text', nullable: true })
  SidecutLent!: string | null;

  @Column({ name: 'sidecut_lent_side', type: 'text', nullable: true })
  SidecutLentSide!: string | null;

  @Column({ name: 'sidecut_cap', type: 'text', nullable: true })
  SidecutCap!: string | null;

  @Column({ name: 'sidecut_cap_side', type: 'text', nullable: true })
  SidecutCapSide!: string | null;

  @Column({ name: 'created_by', type: 'integer', nullable: false })
  CreatedBy!: number;

  @Column({ name: 'created_on', type: 'timestamp', nullable: false })
  CreatedOn!: string;

  @Column({ name: 'is_od', type: 'boolean', nullable: false })
  IsOD!: boolean;

}

@Entity({ name: 'cln_eye_visu_max' })
export class EyeVisuMaxsModel {
  @PrimaryGeneratedColumn({ name: 'id' })
  Id!: number;

  @Column({ name: 'master_id', type: 'integer', nullable: false })
  MasterId!: number;

  @Column({ name: 'thickness', type: 'integer', nullable: true })
  Thickness!: number | null;

  @Column({ name: 'diameter', type: 'integer', nullable: true })
  Diameter!: number | null;

  @Column({ name: 'hinge', type: 'text', nullable: true })
  Hinge!: string | null;

  @Column({ name: 'glass', type: 'text', nullable: true })
  Glass!: string | null;

  @Column({ name: 'sidecut', type: 'text', nullable: true })
  Sidecut!: string | null;

  @Column({ name: 'created_by', type: 'integer', nullable: false })
  CreatedBy!: number;

  @Column({ name: 'created_on', type: 'timestamp', nullable: false })
  CreatedOn!: string;

  @Column({ name: 'is_od', type: 'boolean', nullable: false })
  IsOD!: boolean;

}

@Entity({ name: 'cln_eye_wavefront' })
export class WavefrontModel {
  @PrimaryGeneratedColumn({ name: 'id' })
  Id!: number;

  @Column({ name: 'master_id', type: 'integer', nullable: false })
  MasterId!: number;

  @Column({ name: 'date', type: 'timestamp', nullable: true })
  Date!: string | null;

  @Column({ name: 'timepoint', type: 'text', nullable: true })
  Timepoint!: string | null;

  @Column({ name: 'coma', type: 'text', nullable: true })
  Coma!: string | null;

  @Column({ name: 'sph_ab', type: 'text', nullable: true })
  SphAb!: string | null;

  @Column({ name: 'ho_rms', type: 'text', nullable: true })
  HoRMS!: string | null;

  @Column({ name: 'created_by', type: 'integer', nullable: false })
  CreatedBy!: number;

  @Column({ name: 'created_on', type: 'timestamp', nullable: false })
  CreatedOn!: string;

  @Column({ name: 'is_od', type: 'boolean', nullable: false })
  IsOD!: boolean;

}

@Entity({ name: 'cln_eye_scan_images' })
export class EyeScanModel {
  @PrimaryGeneratedColumn({ name: 'patient_file_id', type: 'bigint' })
  PatientFileId!: number;

  @Column({ name: 'patient_id', type: 'integer', nullable: false })
  PatientId!: number;

  @Column({ name: 'rowguid', type: 'uuid', nullable: false })
  ROWGUID!: string;

  @Column({ name: 'file_type', type: 'text', nullable: true })
  FileType!: string | null;

  @Column({ name: 'title', type: 'text', nullable: true })
  Title!: string | null;

  @Column({ name: 'uploaded_on', type: 'timestamp', nullable: false })
  UploadedOn!: string;

  @Column({ name: 'uploaded_by', type: 'integer', nullable: false })
  UploadedBy!: number;

  @Column({ name: 'description', type: 'text', nullable: true })
  Description!: string | null;

  @Column({ name: 'file_binary_data', type: 'smallint', nullable: false })
  FileBinaryData!: number;

  @Column({ name: 'file_no', type: 'integer', nullable: false })
  FileNo!: number;

  @Column({ name: 'file_name', type: 'text', nullable: true })
  FileName!: string | null;

  @Column({ name: 'file_extention', type: 'text', nullable: true })
  FileExtention!: string | null;

  @Column({ name: 'is_active', type: 'boolean', nullable: true })
  IsActive!: boolean | null;

}

@Entity({ name: 'cln_family_history' })
export class FamilyHistory {
  @Column({ name: 'patient_id', type: 'integer', nullable: false })
  PatientId!: number;

  @Column({ name: 'icd10_code', type: 'text', nullable: true })
  ICD10Code!: string | null;

  @Column({ name: 'icd10_description', type: 'text', nullable: true })
  ICD10Description!: string | null;

  @Column({ name: 'created_by', type: 'integer', nullable: true })
  CreatedBy!: number | null;

  @Column({ name: 'modified_by', type: 'integer', nullable: true })
  ModifiedBy!: number | null;

  @Column({ name: 'created_on', type: 'timestamp', nullable: true })
  CreatedOn!: string | null;

  @Column({ name: 'modified_on', type: 'timestamp', nullable: true })
  ModifiedOn!: string | null;

  @PrimaryGeneratedColumn({ name: 'family_problem_id' })
  FamilyProblemId!: number;

  @Column({ name: 'relationship', type: 'text', nullable: true })
  Relationship!: string | null;

  @Column({ name: 'note', type: 'text', nullable: true })
  Note!: string | null;

}

@Entity({ name: 'cln_home_medications' })
export class HomeMedicationModel {
  @PrimaryGeneratedColumn({ name: 'home_medication_id' })
  HomeMedicationId!: number;

  @Column({ name: 'patient_id', type: 'integer', nullable: false })
  PatientId!: number;

  @Column({ name: 'medication_id', type: 'integer', nullable: true })
  MedicationId!: number | null;

  @Column({ name: 'dose', type: 'text', nullable: true })
  Dose!: string | null;

  @Column({ name: 'route', type: 'text', nullable: true })
  Route!: string | null;

  @Column({ name: 'frequency', type: 'integer', nullable: false })
  Frequency!: number;

  @Column({ name: 'last_taken', type: 'timestamp', nullable: false })
  LastTaken!: string;

  @Column({ name: 'comments', type: 'text', nullable: true })
  Comments!: string | null;

  @Column({ name: 'medication_type', type: 'text', nullable: true })
  MedicationType!: string | null;

  @Column({ name: 'created_by', type: 'integer', nullable: true })
  CreatedBy!: number | null;

  @Column({ name: 'modified_by', type: 'integer', nullable: true })
  ModifiedBy!: number | null;

  @Column({ name: 'created_on', type: 'timestamp', nullable: true })
  CreatedOn!: string | null;

  @Column({ name: 'modified_on', type: 'timestamp', nullable: true })
  ModifiedOn!: string | null;

}

@Entity({ name: 'cln_input_output' })
export class InputOutputModel {
  @PrimaryGeneratedColumn({ name: 'input_output_id' })
  InputOutputId!: number;

  @Column({ name: 'patient_visit_id', type: 'integer', nullable: false })
  PatientVisitId!: number;

  @Column({ name: 'input_output_parameter_main_id', type: 'integer', nullable: false })
  InputOutputParameterMainId!: number;

  @Column({ name: 'input_output_parameter_child_id', type: 'integer', nullable: true })
  InputOutputParameterChildId!: number | null;

  @Column({ name: 'intake_output_value', type: 'double precision', nullable: false })
  IntakeOutputValue!: number;

  @Column({ name: 'unit', type: 'text', nullable: true })
  Unit!: string | null;

  @Column({ name: 'intake_output_type', type: 'text', nullable: true })
  IntakeOutputType!: string | null;

  @Column({ name: 'created_by', type: 'integer', nullable: true })
  CreatedBy!: number | null;

  @Column({ name: 'modified_by', type: 'integer', nullable: true })
  ModifiedBy!: number | null;

  @Column({ name: 'created_on', type: 'timestamp', nullable: true })
  CreatedOn!: string | null;

  @Column({ name: 'modified_on', type: 'timestamp', nullable: true })
  ModifiedOn!: string | null;

  @Column({ name: 'contents', type: 'text', nullable: true })
  Contents!: string | null;

  @Column({ name: 'remarks', type: 'text', nullable: true })
  Remarks!: string | null;

}

@Entity({ name: 'cln_kv_patient_clinical_info' })
export class PatientClinicalInfoModel {
  @PrimaryGeneratedColumn({ name: 'info_id' })
  InfoId!: number;

  @Column({ name: 'patient_id', type: 'integer', nullable: false })
  PatientId!: number;

  @Column({ name: 'patient_visit_id', type: 'integer', nullable: false })
  PatientVisitId!: number;

  @Column({ name: 'key_name', type: 'text', nullable: true })
  KeyName!: string | null;

  @Column({ name: 'value', type: 'text', nullable: true })
  Value!: string | null;

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

@Entity({ name: 'cln_medication_prescription' })
export class MedicationPrescriptionModel {
  @PrimaryGeneratedColumn({ name: 'medication_prescription_id' })
  MedicationPrescriptionId!: number;

  @Column({ name: 'patient_id', type: 'integer', nullable: false })
  PatientId!: number;

  @Column({ name: 'medication_id', type: 'integer', nullable: false })
  MedicationId!: number;

  @Column({ name: 'performer_id', type: 'integer', nullable: false })
  PerformerId!: number;

  @Column({ name: 'route', type: 'text', nullable: true })
  Route!: string | null;

  @Column({ name: 'duration', type: 'integer', nullable: false })
  Duration!: number;

  @Column({ name: 'duration_type', type: 'text', nullable: true })
  DurationType!: string | null;

  @Column({ name: 'dose', type: 'text', nullable: true })
  Dose!: string | null;

  @Column({ name: 'frequency', type: 'text', nullable: true })
  Frequency!: string | null;

  @Column({ name: 'refill', type: 'integer', nullable: true })
  Refill!: number | null;

  @Column({ name: 'typeof_medication', type: 'text', nullable: true })
  TypeofMedication!: string | null;

  @Column({ name: 'created_by', type: 'integer', nullable: true })
  CreatedBy!: number | null;

  @Column({ name: 'modified_by', type: 'integer', nullable: true })
  ModifiedBy!: number | null;

  @Column({ name: 'created_on', type: 'timestamp', nullable: true })
  CreatedOn!: string | null;

  @Column({ name: 'modified_on', type: 'timestamp', nullable: true })
  ModifiedOn!: string | null;

}

@Entity({ name: 'cln_mst_diet_type' })
export class DietTypeModel {
  @PrimaryGeneratedColumn({ name: 'diet_type_id' })
  DietTypeId!: number;

  @Column({ name: 'diet_type_code', type: 'text', nullable: true })
  DietTypeCode!: string | null;

  @Column({ name: 'diet_type_name', type: 'text', nullable: true })
  DietTypeName!: string | null;

  @Column({ name: 'display_order', type: 'integer', nullable: false })
  DisplayOrder!: number;

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

@Entity({ name: 'cln_mst_eye' })
export class EyeModel {
  @PrimaryGeneratedColumn({ name: 'id' })
  Id!: number;

  @Column({ name: 'visit_id', type: 'integer', nullable: false })
  VisitId!: number;

  @Column({ name: 'performer_id', type: 'integer', nullable: false })
  PerformerId!: number;

  @Column({ name: 'patient_id', type: 'integer', nullable: false })
  PatientId!: number;

  @Column({ name: 'visit_date', type: 'timestamp', nullable: false })
  VisitDate!: string;

  @Column({ name: 'modified_on', type: 'timestamp', nullable: false })
  ModifiedOn!: string;

  @Column({ name: 'modified_by', type: 'integer', nullable: false })
  ModifiedBy!: number;

  @Column({ name: 'created_by', type: 'integer', nullable: false })
  CreatedBy!: number;

  @Column({ name: 'created_on', type: 'timestamp', nullable: false })
  CreatedOn!: string;

}

@Entity({ name: 'cln_mst_frequency' })
export class MedicationFrequency {
  @PrimaryGeneratedColumn({ name: 'frequency_id' })
  FrequencyId!: number;

  @Column({ name: 'type', type: 'text', nullable: true })
  Type!: string | null;

}

@Entity({ name: 'cln_mst_intake_out_take_parameter' })
export class ClinicalIntakeOutputParameterModel {
  @PrimaryGeneratedColumn({ name: 'intake_output_id' })
  IntakeOutputId!: number;

  @Column({ name: 'parameter_type', type: 'text', nullable: true })
  ParameterType!: string | null;

  @Column({ name: 'parameter_value', type: 'text', nullable: true })
  ParameterValue!: string | null;

  @Column({ name: 'parameter_main_id', type: 'integer', nullable: false })
  ParameterMainId!: number;

  @Column({ name: 'is_active', type: 'boolean', nullable: false })
  IsActive!: boolean;

  @Column({ name: 'created_by', type: 'integer', nullable: false })
  CreatedBy!: number;

  @Column({ name: 'modified_by', type: 'integer', nullable: true })
  ModifiedBy!: number | null;

  @Column({ name: 'created_on', type: 'timestamp', nullable: false })
  CreatedOn!: string;

  @Column({ name: 'modified_on', type: 'timestamp', nullable: true })
  ModifiedOn!: string | null;

}

@Entity({ name: 'cln_mst_note_type' })
export class NoteTypeModel {
  @PrimaryGeneratedColumn({ name: 'note_type_id' })
  NoteTypeId!: number;

  @Column({ name: 'note_type', type: 'text', nullable: true })
  NoteType!: string | null;

  @Column({ name: 'created_by', type: 'integer', nullable: true })
  CreatedBy!: number | null;

  @Column({ name: 'created_on', type: 'timestamp', nullable: true })
  CreatedOn!: string | null;

  @Column({ name: 'is_active', type: 'boolean', nullable: true })
  IsActive!: boolean | null;

}

@Entity({ name: 'cln_mst_prescription_slip' })
export class PrescriptionSlipModel {
  @PrimaryGeneratedColumn({ name: 'id' })
  Id!: number;

  @Column({ name: 'visit_id', type: 'integer', nullable: false })
  VisitId!: number;

  @Column({ name: 'performer_id', type: 'integer', nullable: false })
  PerformerId!: number;

  @Column({ name: 'patient_id', type: 'integer', nullable: false })
  PatientId!: number;

  @Column({ name: 'visit_date', type: 'timestamp', nullable: false })
  VisitDate!: string;

  @Column({ name: 'modified_on', type: 'timestamp', nullable: false })
  ModifiedOn!: string;

  @Column({ name: 'modified_by', type: 'integer', nullable: false })
  ModifiedBy!: number;

  @Column({ name: 'created_by', type: 'integer', nullable: false })
  CreatedBy!: number;

  @Column({ name: 'created_on', type: 'timestamp', nullable: false })
  CreatedOn!: string;

}

@Entity({ name: 'cln_notes' })
export class NotesModel {
  @PrimaryGeneratedColumn({ name: 'notes_id' })
  NotesId!: number;

  @Column({ name: 'patient_visit_id', type: 'integer', nullable: false })
  PatientVisitId!: number;

  @Column({ name: 'patient_id', type: 'integer', nullable: false })
  PatientId!: number;

  @Column({ name: 'performer_id', type: 'integer', nullable: false })
  PerformerId!: number;

  @Column({ name: 'template_id', type: 'integer', nullable: false })
  TemplateId!: number;

  @Column({ name: 'secondary_doctor_id', type: 'integer', nullable: true })
  SecondaryDoctorId!: number | null;

  @Column({ name: 'note_type_id', type: 'integer', nullable: true })
  NoteTypeId!: number | null;

  @Column({ name: 'template_name', type: 'text', nullable: true })
  TemplateName!: string | null;

  @Column({ name: 'follow_up', type: 'integer', nullable: true })
  FollowUp!: number | null;

  @Column({ name: 'follow_up_unit', type: 'text', nullable: true })
  FollowUpUnit!: string | null;

  @Column({ name: 'remarks', type: 'text', nullable: true })
  Remarks!: string | null;

  @Column({ name: 'is_pending', type: 'boolean', nullable: true })
  IsPending!: boolean | null;

  @Column({ name: 'created_by', type: 'integer', nullable: true })
  CreatedBy!: number | null;

  @Column({ name: 'modified_by', type: 'integer', nullable: true })
  ModifiedBy!: number | null;

  @Column({ name: 'created_on', type: 'timestamp', nullable: true })
  CreatedOn!: string | null;

  @Column({ name: 'modified_on', type: 'timestamp', nullable: true })
  ModifiedOn!: string | null;

}

@Entity({ name: 'cln_notes_emergency' })
export class EmergencyNoteModel {
  @PrimaryGeneratedColumn({ name: 'emergency_note_id' })
  EmergencyNoteId!: number;

  @Column({ name: 'notes_id', type: 'integer', nullable: false })
  NotesId!: number;

  @Column({ name: 'patient_id', type: 'integer', nullable: false })
  PatientId!: number;

  @Column({ name: 'patient_visit_id', type: 'integer', nullable: false })
  PatientVisitId!: number;

  @Column({ name: 'brought_in', type: 'text', nullable: true })
  BroughtIn!: string | null;

  @Column({ name: 'brought_by', type: 'text', nullable: true })
  BroughtBy!: string | null;

  @Column({ name: 'relationship', type: 'text', nullable: true })
  Relationship!: string | null;

  @Column({ name: 'phone_number', type: 'text', nullable: true })
  PhoneNumber!: string | null;

  @Column({ name: 'mode_of_arrival', type: 'text', nullable: true })
  ModeOfArrival!: string | null;

  @Column({ name: 'referral_doctor_or_hospital', type: 'text', nullable: true })
  ReferralDoctorOrHospital!: string | null;

  @Column({ name: 'triage_time', type: 'interval', nullable: true })
  TriageTime!: string | null;

  @Column({ name: 'triaged_by', type: 'text', nullable: true })
  TriagedBy!: string | null;

  @Column({ name: 'trauma', type: 'boolean', nullable: false })
  Trauma!: boolean;

  @Column({ name: 'disposition', type: 'text', nullable: true })
  Disposition!: string | null;

  @Column({ name: 'disposition_department_id', type: 'integer', nullable: true })
  DispositionDepartmentId!: number | null;

  @Column({ name: 'er_course_description', type: 'text', nullable: true })
  ErCourseDescription!: string | null;

  @Column({ name: 'created_by', type: 'integer', nullable: true })
  CreatedBy!: number | null;

  @Column({ name: 'created_on', type: 'timestamp', nullable: true })
  CreatedOn!: string | null;

  @Column({ name: 'modified_by', type: 'integer', nullable: true })
  ModifiedBy!: number | null;

  @Column({ name: 'modified_on', type: 'timestamp', nullable: true })
  ModifiedOn!: string | null;

  @Column({ name: 'is_active', type: 'boolean', nullable: true })
  IsActive!: boolean | null;

}

@Entity({ name: 'cln_notes_free_text' })
export class FreeTextNoteModel {
  @PrimaryGeneratedColumn({ name: 'free_text_id' })
  FreeTextId!: number;

  @Column({ name: 'notes_id', type: 'integer', nullable: false })
  NotesId!: number;

  @Column({ name: 'patient_id', type: 'integer', nullable: true })
  PatientId!: number | null;

  @Column({ name: 'patient_visit_id', type: 'integer', nullable: true })
  PatientVisitId!: number | null;

  @Column({ name: 'free_text', type: 'text', nullable: true })
  FreeText!: string | null;

  @Column({ name: 'created_by', type: 'integer', nullable: true })
  CreatedBy!: number | null;

  @Column({ name: 'modified_by', type: 'integer', nullable: true })
  ModifiedBy!: number | null;

  @Column({ name: 'created_on', type: 'timestamp', nullable: true })
  CreatedOn!: string | null;

  @Column({ name: 'modified_on', type: 'timestamp', nullable: true })
  ModifiedOn!: string | null;

  @Column({ name: 'is_active', type: 'boolean', nullable: true })
  IsActive!: boolean | null;

}

@Entity({ name: 'cln_notes_objective' })
export class ObjectiveNoteModel {
  @PrimaryGeneratedColumn({ name: 'objective_notes_id' })
  ObjectiveNotesId!: number;

  @Column({ name: 'notes_id', type: 'integer', nullable: false })
  NotesId!: number;

  @Column({ name: 'patient_id', type: 'integer', nullable: false })
  PatientId!: number;

  @Column({ name: 'patient_visit_id', type: 'integer', nullable: false })
  PatientVisitId!: number;

  @Column({ name: 'heent', type: 'text', nullable: true })
  HEENT!: string | null;

  @Column({ name: 'chest', type: 'text', nullable: true })
  Chest!: string | null;

  @Column({ name: 'cvs', type: 'text', nullable: true })
  CVS!: string | null;

  @Column({ name: 'abdomen', type: 'text', nullable: true })
  Abdomen!: string | null;

  @Column({ name: 'extremity', type: 'text', nullable: true })
  Extremity!: string | null;

  @Column({ name: 'skin', type: 'text', nullable: true })
  Skin!: string | null;

  @Column({ name: 'neurological', type: 'text', nullable: true })
  Neurological!: string | null;

  @Column({ name: 'created_by', type: 'integer', nullable: true })
  CreatedBy!: number | null;

  @Column({ name: 'created_on', type: 'timestamp', nullable: true })
  CreatedOn!: string | null;

  @Column({ name: 'modified_by', type: 'integer', nullable: true })
  ModifiedBy!: number | null;

  @Column({ name: 'modified_on', type: 'timestamp', nullable: true })
  ModifiedOn!: string | null;

  @Column({ name: 'is_active', type: 'boolean', nullable: true })
  IsActive!: boolean | null;

}

@Entity({ name: 'cln_notes_prescription_note' })
export class PrescriptionNotesModel {
  @PrimaryGeneratedColumn({ name: 'prescription_note_id' })
  PrescriptionNoteId!: number;

  @Column({ name: 'notes_id', type: 'integer', nullable: false })
  NotesId!: number;

  @Column({ name: 'patient_id', type: 'integer', nullable: false })
  PatientId!: number;

  @Column({ name: 'patient_visit_id', type: 'integer', nullable: false })
  PatientVisitId!: number;

  @Column({ name: 'prescription_note_text', type: 'text', nullable: true })
  PrescriptionNoteText!: string | null;

  @Column({ name: 'old_medication_stopped', type: 'text', nullable: true })
  OldMedicationStopped!: string | null;

  @Column({ name: 'new_medication_started', type: 'text', nullable: true })
  NewMedicationStarted!: string | null;

  @Column({ name: 'icd_remarks', type: 'text', nullable: true })
  ICDRemarks!: string | null;

  @Column({ name: 'icd_selected', type: 'text', nullable: true })
  ICDSelected!: string | null;

  @Column({ name: 'orders_selected', type: 'text', nullable: true })
  OrdersSelected!: string | null;

  @Column({ name: 'created_by', type: 'integer', nullable: true })
  CreatedBy!: number | null;

  @Column({ name: 'created_on', type: 'timestamp', nullable: true })
  CreatedOn!: string | null;

  @Column({ name: 'modified_by', type: 'integer', nullable: true })
  ModifiedBy!: number | null;

  @Column({ name: 'modified_on', type: 'timestamp', nullable: true })
  ModifiedOn!: string | null;

  @Column({ name: 'is_active', type: 'boolean', nullable: true })
  IsActive!: boolean | null;

}

@Entity({ name: 'cln_notes_procedure' })
export class ProcedureNoteModel {
  @PrimaryGeneratedColumn({ name: 'procedure_note_id' })
  ProcedureNoteId!: number;

  @Column({ name: 'notes_id', type: 'integer', nullable: true })
  NotesId!: number | null;

  @Column({ name: 'patient_id', type: 'integer', nullable: true })
  PatientId!: number | null;

  @Column({ name: 'patient_visit_id', type: 'integer', nullable: true })
  PatientVisitId!: number | null;

  @Column({ name: 'date', type: 'timestamp', nullable: false })
  Date!: string;

  @Column({ name: 'lines_prose', type: 'text', nullable: true })
  LinesProse!: string | null;

  @Column({ name: 'site', type: 'text', nullable: true })
  Site!: string | null;

  @Column({ name: 'remarks', type: 'text', nullable: true })
  Remarks!: string | null;

  @Column({ name: 'free_text', type: 'text', nullable: true })
  FreeText!: string | null;

  @Column({ name: 'created_by', type: 'integer', nullable: true })
  CreatedBy!: number | null;

  @Column({ name: 'modified_by', type: 'integer', nullable: true })
  ModifiedBy!: number | null;

  @Column({ name: 'created_on', type: 'timestamp', nullable: true })
  CreatedOn!: string | null;

  @Column({ name: 'modified_on', type: 'timestamp', nullable: true })
  ModifiedOn!: string | null;

  @Column({ name: 'is_active', type: 'boolean', nullable: true })
  IsActive!: boolean | null;

}

@Entity({ name: 'cln_notes_progress' })
export class ProgressNoteModel {
  @PrimaryGeneratedColumn({ name: 'progress_note_id' })
  ProgressNoteId!: number;

  @Column({ name: 'notes_id', type: 'integer', nullable: true })
  NotesId!: number | null;

  @Column({ name: 'patient_id', type: 'integer', nullable: true })
  PatientId!: number | null;

  @Column({ name: 'patient_visit_id', type: 'integer', nullable: true })
  PatientVisitId!: number | null;

  @Column({ name: 'subjective_notes', type: 'text', nullable: true })
  SubjectiveNotes!: string | null;

  @Column({ name: 'objective_notes', type: 'text', nullable: true })
  ObjectiveNotes!: string | null;

  @Column({ name: 'assessment_plan', type: 'text', nullable: true })
  AssessmentPlan!: string | null;

  @Column({ name: 'instructions', type: 'text', nullable: true })
  Instructions!: string | null;

  @Column({ name: 'created_by', type: 'integer', nullable: true })
  CreatedBy!: number | null;

  @Column({ name: 'modified_by', type: 'integer', nullable: true })
  ModifiedBy!: number | null;

  @Column({ name: 'date', type: 'timestamp', nullable: true })
  Date!: string | null;

  @Column({ name: 'created_on', type: 'timestamp', nullable: true })
  CreatedOn!: string | null;

  @Column({ name: 'modified_on', type: 'timestamp', nullable: true })
  ModifiedOn!: string | null;

  @Column({ name: 'is_active', type: 'boolean', nullable: true })
  IsActive!: boolean | null;

}

@Entity({ name: 'cln_notes_subjective' })
export class SubjectiveNoteModel {
  @PrimaryGeneratedColumn({ name: 'subjective_note_id' })
  SubjectiveNoteId!: number;

  @Column({ name: 'notes_id', type: 'integer', nullable: false })
  NotesId!: number;

  @Column({ name: 'patient_id', type: 'integer', nullable: false })
  PatientId!: number;

  @Column({ name: 'patient_visit_id', type: 'integer', nullable: false })
  PatientVisitId!: number;

  @Column({ name: 'chief_complaint', type: 'text', nullable: true })
  ChiefComplaint!: string | null;

  @Column({ name: 'history_of_presenting_illness', type: 'text', nullable: true })
  HistoryOfPresentingIllness!: string | null;

  @Column({ name: 'review_of_systems', type: 'text', nullable: true })
  ReviewOfSystems!: string | null;

  @Column({ name: 'created_by', type: 'integer', nullable: true })
  CreatedBy!: number | null;

  @Column({ name: 'modified_by', type: 'integer', nullable: true })
  ModifiedBy!: number | null;

  @Column({ name: 'created_on', type: 'timestamp', nullable: true })
  CreatedOn!: string | null;

  @Column({ name: 'modified_on', type: 'timestamp', nullable: true })
  ModifiedOn!: string | null;

  @Column({ name: 'is_active', type: 'boolean', nullable: true })
  IsActive!: boolean | null;

}

@Entity({ name: 'cln_past_medicals' })
export class PastMedicalProblem {
  @Column({ name: 'patient_id', type: 'integer', nullable: false })
  PatientId!: number;

  @Column({ name: 'icd10_code', type: 'text', nullable: true })
  ICD10Code!: string | null;

  @Column({ name: 'icd10_description', type: 'text', nullable: true })
  ICD10Description!: string | null;

  @Column({ name: 'created_by', type: 'integer', nullable: true })
  CreatedBy!: number | null;

  @Column({ name: 'modified_by', type: 'integer', nullable: true })
  ModifiedBy!: number | null;

  @Column({ name: 'created_on', type: 'timestamp', nullable: true })
  CreatedOn!: string | null;

  @Column({ name: 'modified_on', type: 'timestamp', nullable: true })
  ModifiedOn!: string | null;

  @PrimaryGeneratedColumn({ name: 'patient_problem_id' })
  PatientProblemId!: number;

  @Column({ name: 'current_status', type: 'text', nullable: true })
  CurrentStatus!: string | null;

  @Column({ name: 'note', type: 'text', nullable: true })
  Note!: string | null;

  @Column({ name: 'on_set_date', type: 'timestamp', nullable: true })
  OnSetDate!: string | null;

  @Column({ name: 'resolved_date', type: 'timestamp', nullable: true })
  ResolvedDate!: string | null;

  @Column({ name: 'principle_problem', type: 'boolean', nullable: true })
  PrincipleProblem!: boolean | null;

}

@Entity({ name: 'cln_pat_images' })
export class PatientImagesModel {
  @PrimaryGeneratedColumn({ name: 'pat_image_id', type: 'bigint' })
  PatImageId!: number;

  @Column({ name: 'patient_id', type: 'integer', nullable: false })
  PatientId!: number;

  @Column({ name: 'patient_visit_id', type: 'integer', nullable: false })
  PatientVisitId!: number;

  @Column({ name: 'department_id', type: 'integer', nullable: true })
  DepartmentId!: number | null;

  @Column({ name: 'rowguid', type: 'uuid', nullable: false })
  ROWGUID!: string;

  @Column({ name: 'file_type', type: 'text', nullable: true })
  FileType!: string | null;

  @Column({ name: 'comment', type: 'text', nullable: true })
  Comment!: string | null;

  @Column({ name: 'file_name', type: 'text', nullable: true })
  FileName!: string | null;

  @Column({ name: 'title', type: 'text', nullable: true })
  Title!: string | null;

  @Column({ name: 'file_extention', type: 'text', nullable: true })
  FileExtention!: string | null;

  @Column({ name: 'uploaded_on', type: 'timestamp', nullable: false })
  UploadedOn!: string;

  @Column({ name: 'uploaded_by', type: 'integer', nullable: false })
  UploadedBy!: number;

  @Column({ name: 'is_active', type: 'boolean', nullable: true })
  IsActive!: boolean | null;

}

@Entity({ name: 'cln_patient_vitals' })
export class VitalsModel {
  @PrimaryGeneratedColumn({ name: 'patient_vital_id' })
  PatientVitalId!: number;

  @Column({ name: 'patient_visit_id', type: 'integer', nullable: false })
  PatientVisitId!: number;

  @Column({ name: 'height', type: 'double precision', nullable: true })
  Height!: number | null;

  @Column({ name: 'height_unit', type: 'text', nullable: true })
  HeightUnit!: string | null;

  @Column({ name: 'weight', type: 'double precision', nullable: true })
  Weight!: number | null;

  @Column({ name: 'weight_unit', type: 'text', nullable: true })
  WeightUnit!: string | null;

  @Column({ name: 'bmi', type: 'double precision', nullable: true })
  BMI!: number | null;

  @Column({ name: 'temperature', type: 'double precision', nullable: true })
  Temperature!: number | null;

  @Column({ name: 'temperature_unit', type: 'text', nullable: true })
  TemperatureUnit!: string | null;

  @Column({ name: 'pulse', type: 'integer', nullable: true })
  Pulse!: number | null;

  @Column({ name: 'bp_systolic', type: 'integer', nullable: true })
  BPSystolic!: number | null;

  @Column({ name: 'bp_diastolic', type: 'integer', nullable: true })
  BPDiastolic!: number | null;

  @Column({ name: 'respiratory_rate_per_min', type: 'text', nullable: true })
  RespiratoryRatePerMin!: string | null;

  @Column({ name: 'sp_o2', type: 'double precision', nullable: true })
  SpO2!: number | null;

  @Column({ name: 'oxygen_delivery_method', type: 'text', nullable: true })
  OxygenDeliveryMethod!: string | null;

  @Column({ name: 'pain_scale', type: 'integer', nullable: true })
  PainScale!: number | null;

  @Column({ name: 'body_part', type: 'text', nullable: true })
  BodyPart!: string | null;

  @Column({ name: 'advice', type: 'text', nullable: true })
  Advice!: string | null;

  @Column({ name: 'free_notes', type: 'text', nullable: true })
  FreeNotes!: string | null;

  @Column({ name: 'diagnosis_type', type: 'text', nullable: true })
  DiagnosisType!: string | null;

  @Column({ name: 'diagnosis', type: 'text', nullable: true })
  Diagnosis!: string | null;

  @Column({ name: 'created_by', type: 'integer', nullable: true })
  CreatedBy!: number | null;

  @Column({ name: 'modified_by', type: 'integer', nullable: true })
  ModifiedBy!: number | null;

  @Column({ name: 'created_on', type: 'timestamp', nullable: true })
  CreatedOn!: string | null;

  @Column({ name: 'vitals_taken_on', type: 'timestamp', nullable: false })
  VitalsTakenOn!: string;

  @Column({ name: 'modified_on', type: 'timestamp', nullable: true })
  ModifiedOn!: string | null;

}

@Entity({ name: 'cln_prescription_slip_acceptance' })
export class AcceptanceModel {
  @PrimaryGeneratedColumn({ name: 'id' })
  Id!: number;

  @Column({ name: 'master_id', type: 'integer', nullable: false })
  MasterId!: number;

  @Column({ name: 'sph_od', type: 'text', nullable: true })
  SphOD!: string | null;

  @Column({ name: 'sph_os', type: 'text', nullable: true })
  SphOS!: string | null;

  @Column({ name: 'cyl_od', type: 'text', nullable: true })
  CylOD!: string | null;

  @Column({ name: 'cyl_os', type: 'text', nullable: true })
  CylOS!: string | null;

  @Column({ name: 'axis_od', type: 'text', nullable: true })
  AxisOD!: string | null;

  @Column({ name: 'axis_os', type: 'text', nullable: true })
  AxisOS!: string | null;

  @Column({ name: 'va_od', type: 'text', nullable: true })
  VaOD!: string | null;

  @Column({ name: 'va_os', type: 'text', nullable: true })
  VaOS!: string | null;

  @Column({ name: 'created_by', type: 'integer', nullable: false })
  CreatedBy!: number;

  @Column({ name: 'created_on', type: 'timestamp', nullable: false })
  CreatedOn!: string;

}

@Entity({ name: 'cln_prescription_slip_advice_diagnosis' })
export class AdviceDiagnosisModel {
  @PrimaryGeneratedColumn({ name: 'id' })
  Id!: number;

  @Column({ name: 'master_id', type: 'integer', nullable: false })
  MasterId!: number;

  @Column({ name: 'advice_diagnosis', type: 'text', nullable: true })
  AdviceDiagnosis!: string | null;

  @Column({ name: 'created_by', type: 'integer', nullable: false })
  CreatedBy!: number;

  @Column({ name: 'created_on', type: 'timestamp', nullable: false })
  CreatedOn!: string;

}

@Entity({ name: 'cln_prescription_slip_dilate' })
export class DilateModel {
  @PrimaryGeneratedColumn({ name: 'id' })
  Id!: number;

  @Column({ name: 'master_id', type: 'integer', nullable: false })
  MasterId!: number;

  @Column({ name: 'tplus', type: 'boolean', nullable: false })
  Tplus!: boolean;

  @Column({ name: 'atropine', type: 'boolean', nullable: false })
  Atropine!: boolean;

  @Column({ name: 'cp', type: 'boolean', nullable: false })
  CP!: boolean;

  @Column({ name: 'ctc', type: 'boolean', nullable: false })
  CTC!: boolean;

  @Column({ name: 'created_by', type: 'integer', nullable: false })
  CreatedBy!: number;

  @Column({ name: 'created_on', type: 'timestamp', nullable: false })
  CreatedOn!: string;

}

@Entity({ name: 'cln_prescription_slip_final_class' })
export class FinalClassModel {
  @PrimaryGeneratedColumn({ name: 'id' })
  Id!: number;

  @Column({ name: 'master_id', type: 'integer', nullable: false })
  MasterId!: number;

  @Column({ name: 'sph_od', type: 'text', nullable: true })
  SphOD!: string | null;

  @Column({ name: 'sph_os', type: 'text', nullable: true })
  SphOS!: string | null;

  @Column({ name: 'cyl_od', type: 'text', nullable: true })
  CylOD!: string | null;

  @Column({ name: 'cyl_os', type: 'text', nullable: true })
  CylOS!: string | null;

  @Column({ name: 'axis_od', type: 'text', nullable: true })
  AxisOD!: string | null;

  @Column({ name: 'axis_os', type: 'text', nullable: true })
  AxisOS!: string | null;

  @Column({ name: 'va_od', type: 'text', nullable: true })
  VaOD!: string | null;

  @Column({ name: 'va_os', type: 'text', nullable: true })
  VaOS!: string | null;

  @Column({ name: 'created_by', type: 'integer', nullable: false })
  CreatedBy!: number;

  @Column({ name: 'created_on', type: 'timestamp', nullable: false })
  CreatedOn!: string;

}

@Entity({ name: 'cln_prescription_slip_history' })
export class HistoryModel {
  @PrimaryGeneratedColumn({ name: 'id' })
  Id!: number;

  @Column({ name: 'master_id', type: 'integer', nullable: false })
  MasterId!: number;

  @Column({ name: 'history', type: 'text', nullable: true })
  History!: string | null;

  @Column({ name: 'created_by', type: 'integer', nullable: false })
  CreatedBy!: number;

  @Column({ name: 'created_on', type: 'timestamp', nullable: false })
  CreatedOn!: string;

}

@Entity({ name: 'cln_prescription_slip_iop' })
export class IOPModel {
  @PrimaryGeneratedColumn({ name: 'id' })
  Id!: number;

  @Column({ name: 'master_id', type: 'integer', nullable: false })
  MasterId!: number;

  @Column({ name: 'od', type: 'text', nullable: true })
  OD!: string | null;

  @Column({ name: 'os', type: 'text', nullable: true })
  OS!: string | null;

  @Column({ name: 'created_by', type: 'integer', nullable: false })
  CreatedBy!: number;

  @Column({ name: 'created_on', type: 'timestamp', nullable: false })
  CreatedOn!: string;

}

@Entity({ name: 'cln_prescription_slip_plup' })
export class PlupModel {
  @PrimaryGeneratedColumn({ name: 'id' })
  Id!: number;

  @Column({ name: 'master_id', type: 'integer', nullable: false })
  MasterId!: number;

  @Column({ name: 'sph_od', type: 'text', nullable: true })
  SphOD!: string | null;

  @Column({ name: 'sph_os', type: 'text', nullable: true })
  SphOS!: string | null;

  @Column({ name: 'cyl_od', type: 'text', nullable: true })
  CylOD!: string | null;

  @Column({ name: 'cyl_os', type: 'text', nullable: true })
  CylOS!: string | null;

  @Column({ name: 'axis_od', type: 'text', nullable: true })
  AxisOD!: string | null;

  @Column({ name: 'axis_os', type: 'text', nullable: true })
  AxisOS!: string | null;

  @Column({ name: 'va_od', type: 'text', nullable: true })
  VaOD!: string | null;

  @Column({ name: 'va_os', type: 'text', nullable: true })
  VaOS!: string | null;

  @Column({ name: 'created_by', type: 'integer', nullable: false })
  CreatedBy!: number;

  @Column({ name: 'created_on', type: 'timestamp', nullable: false })
  CreatedOn!: string;

}

@Entity({ name: 'cln_prescription_slip_retinoscopy' })
export class RetinoscopyModel {
  @PrimaryGeneratedColumn({ name: 'id' })
  Id!: number;

  @Column({ name: 'master_id', type: 'integer', nullable: false })
  MasterId!: number;

  @Column({ name: 'sph_od', type: 'text', nullable: true })
  SphOD!: string | null;

  @Column({ name: 'sph_os', type: 'text', nullable: true })
  SphOS!: string | null;

  @Column({ name: 'cyl_od', type: 'text', nullable: true })
  CylOD!: string | null;

  @Column({ name: 'cyl_os', type: 'text', nullable: true })
  CylOS!: string | null;

  @Column({ name: 'axis_od', type: 'text', nullable: true })
  AxisOD!: string | null;

  @Column({ name: 'axis_os', type: 'text', nullable: true })
  AxisOS!: string | null;

  @Column({ name: 'va_od', type: 'text', nullable: true })
  VaOD!: string | null;

  @Column({ name: 'va_os', type: 'text', nullable: true })
  VaOS!: string | null;

  @Column({ name: 'created_by', type: 'integer', nullable: false })
  CreatedBy!: number;

  @Column({ name: 'created_on', type: 'timestamp', nullable: false })
  CreatedOn!: string;

}

@Entity({ name: 'cln_prescription_slip_schrime' })
export class SchrimeModel {
  @PrimaryGeneratedColumn({ name: 'id' })
  Id!: number;

  @Column({ name: 'master_id', type: 'integer', nullable: false })
  MasterId!: number;

  @Column({ name: 'od', type: 'text', nullable: true })
  OD!: string | null;

  @Column({ name: 'os', type: 'text', nullable: true })
  OS!: string | null;

  @Column({ name: 'created_by', type: 'integer', nullable: false })
  CreatedBy!: number;

  @Column({ name: 'created_on', type: 'timestamp', nullable: false })
  CreatedOn!: string;

}

@Entity({ name: 'cln_prescription_slip_tbut' })
export class TBUTModel {
  @PrimaryGeneratedColumn({ name: 'id' })
  Id!: number;

  @Column({ name: 'master_id', type: 'integer', nullable: false })
  MasterId!: number;

  @Column({ name: 'od', type: 'text', nullable: true })
  OD!: string | null;

  @Column({ name: 'os', type: 'text', nullable: true })
  OS!: string | null;

  @Column({ name: 'created_by', type: 'integer', nullable: false })
  CreatedBy!: number;

  @Column({ name: 'created_on', type: 'timestamp', nullable: false })
  CreatedOn!: string;

}

@Entity({ name: 'cln_prescription_slip_va_unaided' })
export class VaUnaidedModel {
  @PrimaryGeneratedColumn({ name: 'id' })
  Id!: number;

  @Column({ name: 'master_id', type: 'integer', nullable: false })
  MasterId!: number;

  @Column({ name: 'od', type: 'text', nullable: true })
  OD!: string | null;

  @Column({ name: 'os', type: 'text', nullable: true })
  OS!: string | null;

  @Column({ name: 'created_by', type: 'integer', nullable: false })
  CreatedBy!: number;

  @Column({ name: 'created_on', type: 'timestamp', nullable: false })
  CreatedOn!: string;

}

@Entity({ name: 'cln_referral_source' })
export class ReferralSource {
  @PrimaryGeneratedColumn({ name: 'referral_source_id' })
  ReferralSourceId!: number;

  @Column({ name: 'patient_id', type: 'integer', nullable: false })
  PatientId!: number;

  @Column({ name: 'newspaper', type: 'boolean', nullable: false })
  Newspaper!: boolean;

  @Column({ name: 'unknown', type: 'boolean', nullable: false })
  Unknown!: boolean;

  @Column({ name: 'doctor', type: 'boolean', nullable: false })
  Doctor!: boolean;

  @Column({ name: 'radio', type: 'boolean', nullable: false })
  Radio!: boolean;

  @Column({ name: 'web_page', type: 'boolean', nullable: false })
  WebPage!: boolean;

  @Column({ name: 'friend_and_family', type: 'boolean', nullable: false })
  FriendAndFamily!: boolean;

  @Column({ name: 'staff', type: 'boolean', nullable: false })
  Staff!: boolean;

  @Column({ name: 'tv', type: 'boolean', nullable: false })
  TV!: boolean;

  @Column({ name: 'others', type: 'text', nullable: true })
  Others!: string | null;

  @Column({ name: 'magazine', type: 'boolean', nullable: false })
  Magazine!: boolean;

  @Column({ name: 'note', type: 'text', nullable: true })
  Note!: string | null;

  @Column({ name: 'created_by', type: 'integer', nullable: true })
  CreatedBy!: number | null;

  @Column({ name: 'modified_by', type: 'integer', nullable: true })
  ModifiedBy!: number | null;

  @Column({ name: 'created_on', type: 'timestamp', nullable: true })
  CreatedOn!: string | null;

  @Column({ name: 'modified_on', type: 'timestamp', nullable: true })
  ModifiedOn!: string | null;

}

@Entity({ name: 'cln_social_history' })
export class SocialHistory {
  @PrimaryGeneratedColumn({ name: 'social_history_id' })
  SocialHistoryId!: number;

  @Column({ name: 'patient_id', type: 'integer', nullable: false })
  PatientId!: number;

  @Column({ name: 'smoking_history', type: 'text', nullable: true })
  SmokingHistory!: string | null;

  @Column({ name: 'alcohol_history', type: 'text', nullable: true })
  AlcoholHistory!: string | null;

  @Column({ name: 'drug_history', type: 'text', nullable: true })
  DrugHistory!: string | null;

  @Column({ name: 'occupation', type: 'text', nullable: true })
  Occupation!: string | null;

  @Column({ name: 'family_support', type: 'text', nullable: true })
  FamilySupport!: string | null;

  @Column({ name: 'note', type: 'text', nullable: true })
  Note!: string | null;

  @Column({ name: 'created_by', type: 'integer', nullable: true })
  CreatedBy!: number | null;

  @Column({ name: 'modified_by', type: 'integer', nullable: true })
  ModifiedBy!: number | null;

  @Column({ name: 'created_on', type: 'timestamp', nullable: true })
  CreatedOn!: string | null;

  @Column({ name: 'modified_on', type: 'timestamp', nullable: true })
  ModifiedOn!: string | null;

}

@Entity({ name: 'cln_surgical_history' })
export class SurgicalHistory {
  @Column({ name: 'patient_id', type: 'integer', nullable: false })
  PatientId!: number;

  @Column({ name: 'icd10_code', type: 'text', nullable: true })
  ICD10Code!: string | null;

  @Column({ name: 'icd10_description', type: 'text', nullable: true })
  ICD10Description!: string | null;

  @Column({ name: 'created_by', type: 'integer', nullable: true })
  CreatedBy!: number | null;

  @Column({ name: 'modified_by', type: 'integer', nullable: true })
  ModifiedBy!: number | null;

  @Column({ name: 'created_on', type: 'timestamp', nullable: true })
  CreatedOn!: string | null;

  @Column({ name: 'modified_on', type: 'timestamp', nullable: true })
  ModifiedOn!: string | null;

  @PrimaryGeneratedColumn({ name: 'surgical_history_id' })
  SurgicalHistoryId!: number;

  @Column({ name: 'surgery_type', type: 'text', nullable: true })
  SurgeryType!: string | null;

  @Column({ name: 'note', type: 'text', nullable: true })
  Note!: string | null;

  @Column({ name: 'surgery_date', type: 'timestamp', nullable: true })
  SurgeryDate!: string | null;

}

@Entity({ name: 'cln_template' })
export class TemplateNoteModel {
  @PrimaryGeneratedColumn({ name: 'template_id' })
  TemplateId!: number;

  @Column({ name: 'template_name', type: 'text', nullable: true })
  TemplateName!: string | null;

  @Column({ name: 'created_by', type: 'integer', nullable: true })
  CreatedBy!: number | null;

  @Column({ name: 'created_on', type: 'timestamp', nullable: true })
  CreatedOn!: string | null;

  @Column({ name: 'is_active', type: 'boolean', nullable: true })
  IsActive!: boolean | null;

}

@Entity({ name: 'cln_txn_patient_diet' })
export class PatientDietModel {
  @PrimaryGeneratedColumn({ name: 'patient_diet_id' })
  PatientDietId!: number;

  @Column({ name: 'patient_id', type: 'integer', nullable: false })
  PatientId!: number;

  @Column({ name: 'patient_visit_id', type: 'integer', nullable: false })
  PatientVisitId!: number;

  @Column({ name: 'diet_type_id', type: 'integer', nullable: false })
  DietTypeId!: number;

  @Column({ name: 'extra_diet', type: 'text', nullable: true })
  ExtraDiet!: string | null;

  @Column({ name: 'ward_id', type: 'integer', nullable: false })
  WardId!: number;

  @Column({ name: 'recorded_on', type: 'timestamp', nullable: false })
  RecordedOn!: string;

  @Column({ name: 'remarks', type: 'text', nullable: true })
  Remarks!: string | null;

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
