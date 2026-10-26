/* GÉNÉRÉ par tools/generate-entities.mjs depuis migration/inventory/entities.json : ne pas modifier à la main. */
import { Column, Entity, PrimaryColumn, PrimaryGeneratedColumn } from 'typeorm';
import { NUM } from '../transformers';

@Entity({ name: 'cfg_payment_mode_settings' })
export class CfgPaymentModesSettings {
  @PrimaryGeneratedColumn({ name: 'payment_mode_settings_id' })
  PaymentModeSettingsId!: number;

  @Column({ name: 'payment_page_id', type: 'integer', nullable: false })
  PaymentPageId!: number;

  @Column({ name: 'payment_mode_sub_category_name', type: 'text', nullable: true })
  PaymentModeSubCategoryName!: string | null;

  @Column({ name: 'payment_mode_sub_category_id', type: 'integer', nullable: false })
  PaymentModeSubCategoryId!: number;

  @Column({ name: 'is_active', type: 'boolean', nullable: false })
  IsActive!: boolean;

  @Column({ name: 'display_sequence', type: 'integer', nullable: true })
  DisplaySequence!: number | null;

  @Column({ name: 'show_payment_details', type: 'boolean', nullable: false })
  ShowPaymentDetails!: boolean;

  @Column({ name: 'is_remarks_mandatory', type: 'boolean', nullable: false })
  IsRemarksMandatory!: boolean;

  @Column({ name: 'modified_on', type: 'timestamp', nullable: true })
  ModifiedOn!: string | null;

  @Column({ name: 'modified_by', type: 'integer', nullable: true })
  ModifiedBy!: number | null;

}

@Entity({ name: 'cfg_print_export_settings' })
export class PrintExportConfigModel {
  @PrimaryGeneratedColumn({ name: 'print_export_settings_id' })
  PrintExportSettingsId!: number;

  @Column({ name: 'setting_name', type: 'text', nullable: true })
  SettingName!: string | null;

  @Column({ name: 'page_header_text', type: 'text', nullable: true })
  PageHeaderText!: string | null;

  @Column({ name: 'report_description', type: 'text', nullable: true })
  ReportDescription!: string | null;

  @Column({ name: 'module_name', type: 'text', nullable: true })
  ModuleName!: string | null;

  @Column({ name: 'show_header', type: 'boolean', nullable: false })
  ShowHeader!: boolean;

  @Column({ name: 'show_footer', type: 'boolean', nullable: false })
  ShowFooter!: boolean;

  @Column({ name: 'show_user_name', type: 'boolean', nullable: false })
  ShowUserName!: boolean;

  @Column({ name: 'show_print_export_date_time', type: 'boolean', nullable: false })
  ShowPrintExportDateTime!: boolean;

  @Column({ name: 'show_np_date', type: 'boolean', nullable: false })
  ShowNpDate!: boolean;

  @Column({ name: 'show_en_date', type: 'boolean', nullable: false })
  ShowEnDate!: boolean;

  @Column({ name: 'show_filter_date_range', type: 'boolean', nullable: false })
  ShowFilterDateRange!: boolean;

  @Column({ name: 'show_other_filter_variables', type: 'boolean', nullable: false })
  ShowOtherFilterVariables!: boolean;

  @Column({ name: 'created_on', type: 'timestamp', nullable: true })
  CreatedOn!: string | null;

  @Column({ name: 'created_by', type: 'integer', nullable: true })
  CreatedBy!: number | null;

  @Column({ name: 'modified_on', type: 'timestamp', nullable: true })
  ModifiedOn!: string | null;

  @Column({ name: 'modified_by', type: 'integer', nullable: true })
  ModifiedBy!: number | null;

  @Column({ name: 'is_active', type: 'boolean', nullable: false })
  IsActive!: boolean;

}

@Entity({ name: 'danphe_cookie_auth_info' })
export class CookieAuthInfoModel {
  @PrimaryGeneratedColumn({ name: 'auth_id' })
  AuthId!: number;

  @Column({ name: 'selector', type: 'bigint', nullable: false, transformer: NUM })
  Selector!: number;

  @Column({ name: 'hashed_token', type: 'text', nullable: true })
  HashedToken!: string | null;

  @Column({ name: 'user_id', type: 'integer', nullable: false })
  UserId!: number;

  @Column({ name: 'expires', type: 'timestamp', nullable: false })
  Expires!: string;

}

@Entity({ name: 'danphe_log_in_information' })
export class LoginInformationModel {
  @PrimaryGeneratedColumn({ name: 'information_id' })
  InformationId!: number;

  @Column({ name: 'employee_id', type: 'integer', nullable: true })
  EmployeeId!: number | null;

  @Column({ name: 'user_name', type: 'text', nullable: true })
  UserName!: string | null;

  @Column({ name: 'action_name', type: 'text', nullable: true })
  ActionName!: string | null;

  @Column({ name: 'created_on', type: 'timestamp', nullable: false })
  CreatedOn!: string;

}

@Entity({ name: 'department_model' })
export class DepartmentModel {
  @PrimaryGeneratedColumn({ name: 'department_id' })
  DepartmentId!: number;

  @Column({ name: 'department_code', type: 'text', nullable: true })
  DepartmentCode!: string | null;

  @Column({ name: 'department_name', type: 'text', nullable: true })
  DepartmentName!: string | null;

  @Column({ name: 'description', type: 'text', nullable: true })
  Description!: string | null;

  @Column({ name: 'department_head', type: 'integer', nullable: true })
  DepartmentHead!: number | null;

  @Column({ name: 'notice_text', type: 'text', nullable: true })
  NoticeText!: string | null;

  @Column({ name: 'is_active', type: 'boolean', nullable: false })
  IsActive!: boolean;

  @Column({ name: 'is_appointment_applicable', type: 'boolean', nullable: false })
  IsAppointmentApplicable!: boolean;

  @Column({ name: 'created_by', type: 'integer', nullable: true })
  CreatedBy!: number | null;

  @Column({ name: 'created_on', type: 'timestamp', nullable: true })
  CreatedOn!: string | null;

  @Column({ name: 'modified_by', type: 'integer', nullable: true })
  ModifiedBy!: number | null;

  @Column({ name: 'modified_on', type: 'timestamp', nullable: true })
  ModifiedOn!: string | null;

  @Column({ name: 'parent_department_id', type: 'integer', nullable: true })
  ParentDepartmentId!: number | null;

  @Column({ name: 'room_number', type: 'text', nullable: true })
  RoomNumber!: string | null;

  @Column({ name: 'opd_new_patient_service_item_id', type: 'integer', nullable: true })
  OpdNewPatientServiceItemId!: number | null;

  @Column({ name: 'opd_old_patient_service_item_id', type: 'integer', nullable: true })
  OpdOldPatientServiceItemId!: number | null;

  @Column({ name: 'followup_service_item_id', type: 'integer', nullable: true })
  FollowupServiceItemId!: number | null;

}

@Entity({ name: 'icd_disease_group' })
export class ICD10DiseaseGroupModel {
  @PrimaryGeneratedColumn({ name: 'disease_group_id' })
  DiseaseGroupId!: number;

  @Column({ name: 'serial_number', type: 'integer', nullable: false })
  SerialNumber!: number;

  @Column({ name: 'reporting_group_id', type: 'integer', nullable: false })
  ReportingGroupId!: number;

  @Column({ name: 'icd_code', type: 'text', nullable: true })
  ICDCode!: string | null;

  @Column({ name: 'disease_group_name', type: 'text', nullable: true })
  DiseaseGroupName!: string | null;

  @Column({ name: 'created_by', type: 'integer', nullable: false })
  CreatedBy!: number;

  @Column({ name: 'created_on', type: 'timestamp', nullable: false })
  CreatedOn!: string;

  @Column({ name: 'is_active', type: 'boolean', nullable: false })
  IsActive!: boolean;

}

@Entity({ name: 'icd_emergency_disease_group' })
export class ICDEmergencyDiseaseGroupModel {
  @PrimaryGeneratedColumn({ name: 'emer_disease_group_id' })
  EMER_DiseaseGroupId!: number;

  @Column({ name: 'serial_number', type: 'integer', nullable: false })
  SerialNumber!: number;

  @Column({ name: 'emer_reporting_group_id', type: 'integer', nullable: false })
  EMER_ReportingGroupId!: number;

  @Column({ name: 'icd_code', type: 'text', nullable: true })
  ICDCode!: string | null;

  @Column({ name: 'emer_disease_group_name', type: 'text', nullable: true })
  EMER_DiseaseGroupName!: string | null;

  @Column({ name: 'created_by', type: 'integer', nullable: false })
  CreatedBy!: number;

  @Column({ name: 'created_on', type: 'timestamp', nullable: false })
  CreatedOn!: string;

  @Column({ name: 'is_active', type: 'boolean', nullable: false })
  IsActive!: boolean;

  @Column({ name: 'icd_version', type: 'text', nullable: true })
  IcdVersion!: string | null;

}

@Entity({ name: 'icd_emergency_reporting_group' })
export class ICDEmergencyReportingGroupModel {
  @PrimaryGeneratedColumn({ name: 'emer_reporting_group_id' })
  EMER_ReportingGroupId!: number;

  @Column({ name: 'serial_number', type: 'integer', nullable: false })
  SerialNumber!: number;

  @Column({ name: 'emer_reporting_group_name', type: 'text', nullable: true })
  EMER_ReportingGroupName!: string | null;

  @Column({ name: 'created_by', type: 'integer', nullable: false })
  CreatedBy!: number;

  @Column({ name: 'created_on', type: 'timestamp', nullable: false })
  CreatedOn!: string;

  @Column({ name: 'is_active', type: 'boolean', nullable: false })
  IsActive!: boolean;

  @Column({ name: 'group_code', type: 'text', nullable: true })
  GroupCode!: string | null;

  @Column({ name: 'icd_version', type: 'text', nullable: true })
  IcdVersion!: string | null;

}

@Entity({ name: 'icd_reporting_group' })
export class ICD10ReportingGroupModel {
  @PrimaryGeneratedColumn({ name: 'reporting_group_id' })
  ReportingGroupId!: number;

  @Column({ name: 'serial_number', type: 'integer', nullable: false })
  SerialNumber!: number;

  @Column({ name: 'group_code', type: 'text', nullable: true })
  GroupCode!: string | null;

  @Column({ name: 'reporting_group_name', type: 'text', nullable: true })
  ReportingGroupName!: string | null;

  @Column({ name: 'created_by', type: 'integer', nullable: false })
  CreatedBy!: number;

  @Column({ name: 'created_on', type: 'timestamp', nullable: false })
  CreatedOn!: string;

  @Column({ name: 'is_active', type: 'boolean', nullable: false })
  IsActive!: boolean;

}

@Entity({ name: 'mst_country' })
export class CountryModel {
  @PrimaryGeneratedColumn({ name: 'country_id' })
  CountryId!: number;

  @Column({ name: 'country_short_name', type: 'text', nullable: true })
  CountryShortName!: string | null;

  @Column({ name: 'country_name', type: 'text', nullable: true })
  CountryName!: string | null;

  @Column({ name: 'isd_code', type: 'text', nullable: true })
  ISDCode!: string | null;

  @Column({ name: 'country_sub_division_type', type: 'text', nullable: true })
  CountrySubDivisionType!: string | null;

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

@Entity({ name: 'mst_country_sub_division' })
export class CountrySubDivisionModel {
  @PrimaryGeneratedColumn({ name: 'country_sub_division_id' })
  CountrySubDivisionId!: number;

  @Column({ name: 'country_id', type: 'integer', nullable: false })
  CountryId!: number;

  @Column({ name: 'country_sub_division_name', type: 'text', nullable: true })
  CountrySubDivisionName!: string | null;

  @Column({ name: 'country_sub_division_code', type: 'text', nullable: true })
  CountrySubDivisionCode!: string | null;

  @Column({ name: 'map_area_code', type: 'text', nullable: true })
  MapAreaCode!: string | null;

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

  @Column({ name: 'imu_country_sub_divison_id', type: 'integer', nullable: true })
  IMU_CountrySubDivisonId!: number | null;

  @Column({ name: 'imu_province_id', type: 'integer', nullable: true })
  IMU_ProvinceId!: number | null;

}

@Entity({ name: 'mst_department' })
export class DepartmentModel_mst_department {
  @PrimaryGeneratedColumn({ name: 'department_id' })
  DepartmentId!: number;

  @Column({ name: 'department_code', type: 'text', nullable: true })
  DepartmentCode!: string | null;

  @Column({ name: 'department_name', type: 'text', nullable: true })
  DepartmentName!: string | null;

  @Column({ name: 'description', type: 'text', nullable: true })
  Description!: string | null;

  @Column({ name: 'department_head', type: 'integer', nullable: true })
  DepartmentHead!: number | null;

  @Column({ name: 'notice_text', type: 'text', nullable: true })
  NoticeText!: string | null;

  @Column({ name: 'is_active', type: 'boolean', nullable: false })
  IsActive!: boolean;

  @Column({ name: 'is_appointment_applicable', type: 'boolean', nullable: false })
  IsAppointmentApplicable!: boolean;

  @Column({ name: 'created_by', type: 'integer', nullable: true })
  CreatedBy!: number | null;

  @Column({ name: 'created_on', type: 'timestamp', nullable: true })
  CreatedOn!: string | null;

  @Column({ name: 'modified_by', type: 'integer', nullable: true })
  ModifiedBy!: number | null;

  @Column({ name: 'modified_on', type: 'timestamp', nullable: true })
  ModifiedOn!: string | null;

  @Column({ name: 'parent_department_id', type: 'integer', nullable: true })
  ParentDepartmentId!: number | null;

  @Column({ name: 'room_number', type: 'text', nullable: true })
  RoomNumber!: string | null;

  @Column({ name: 'opd_new_patient_service_item_id', type: 'integer', nullable: true })
  OpdNewPatientServiceItemId!: number | null;

  @Column({ name: 'opd_old_patient_service_item_id', type: 'integer', nullable: true })
  OpdOldPatientServiceItemId!: number | null;

  @Column({ name: 'followup_service_item_id', type: 'integer', nullable: true })
  FollowupServiceItemId!: number | null;

}

@Entity({ name: 'mst_icd10' })
export class ICD10CodeModel {
  @PrimaryGeneratedColumn({ name: 'icd10_id' })
  ICD10ID!: number;

  @Column({ name: 'icd_short_code', type: 'text', nullable: true })
  ICDShortCode!: string | null;

  @Column({ name: 'icd10_code', type: 'text', nullable: true })
  ICD10Code!: string | null;

  @Column({ name: 'icd10_description', type: 'text', nullable: true })
  ICD10Description!: string | null;

  @Column({ name: 'valid_for_coding', type: 'boolean', nullable: false })
  ValidForCoding!: boolean;

  @Column({ name: 'active', type: 'boolean', nullable: false })
  Active!: boolean;

}

@Entity({ name: 'mst_map_store_verification' })
export class StoreVerificationMapModel {
  @PrimaryGeneratedColumn({ name: 'store_verification_map_id' })
  StoreVerificationMapId!: number;

  @Column({ name: 'store_id', type: 'integer', nullable: false })
  StoreId!: number;

  @Column({ name: 'max_verification_level', type: 'integer', nullable: false })
  MaxVerificationLevel!: number;

  @Column({ name: 'verification_level', type: 'integer', nullable: false })
  VerificationLevel!: number;

  @Column({ name: 'permission_id', type: 'integer', nullable: false })
  PermissionId!: number;

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

@Entity({ name: 'mst_municipality' })
export class MunicipalityModel {
  @PrimaryGeneratedColumn({ name: 'municipality_id' })
  MunicipalityId!: number;

  @Column({ name: 'municipality_name', type: 'text', nullable: true })
  MunicipalityName!: string | null;

  @Column({ name: 'type', type: 'text', nullable: true })
  Type!: string | null;

  @Column({ name: 'country_id', type: 'integer', nullable: false })
  CountryId!: number;

  @Column({ name: 'country_sub_division_id', type: 'integer', nullable: false })
  CountrySubDivisionId!: number;

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

  @Column({ name: 'imu_country_sub_division_id', type: 'integer', nullable: true })
  IMU_CountrySubDivisionId!: number | null;

  @Column({ name: 'imu_muncipality_id', type: 'integer', nullable: true })
  IMU_MuncipalityId!: number | null;

}

@Entity({ name: 'mst_payment_modes' })
export class PaymentModes {
  @PrimaryGeneratedColumn({ name: 'payment_sub_category_id' })
  PaymentSubCategoryId!: number;

  @Column({ name: 'payment_sub_category_name', type: 'text', nullable: true })
  PaymentSubCategoryName!: string | null;

  @Column({ name: 'payment_mode', type: 'text', nullable: true })
  PaymentMode!: string | null;

  @Column({ name: 'show_in_multiple_payment_mode', type: 'boolean', nullable: false })
  ShowInMultiplePaymentMode!: boolean;

}

@Entity({ name: 'mst_payment_pages' })
export class PaymentPages {
  @PrimaryGeneratedColumn({ name: 'payment_page_id' })
  PaymentPageId!: number;

  @Column({ name: 'module_name', type: 'text', nullable: true })
  ModuleName!: string | null;

  @Column({ name: 'page_name', type: 'text', nullable: true })
  PageName!: string | null;

  @Column({ name: 'description', type: 'text', nullable: true })
  Description!: string | null;

}

@Entity({ name: 'mst_reactions' })
export class ReactionModel {
  @PrimaryGeneratedColumn({ name: 'reaction_id' })
  ReactionId!: number;

  @Column({ name: 'reaction_code', type: 'text', nullable: true })
  ReactionCode!: string | null;

  @Column({ name: 'reaction_name', type: 'text', nullable: true })
  ReactionName!: string | null;

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

}

@Entity({ name: 'mst_tax' })
export class TaxModel {
  @PrimaryGeneratedColumn({ name: 'tax_id' })
  TaxId!: number;

  @Column({ name: 'tax_name', type: 'text', nullable: true })
  TaxName!: string | null;

  @Column({ name: 'tax_percentage', type: 'double precision', nullable: false })
  TaxPercentage!: number;

  @Column({ name: 'tax_label', type: 'text', nullable: true })
  TaxLabel!: string | null;

  @Column({ name: 'description', type: 'text', nullable: true })
  Description!: string | null;

  @Column({ name: 'created_by', type: 'integer', nullable: false })
  CreatedBy!: number;

  @Column({ name: 'created_on', type: 'timestamp', nullable: false })
  CreatedOn!: string;

}

@Entity({ name: 'mst_email_send_detail' })
export class EmailSendDetailModel {
  @PrimaryGeneratedColumn({ name: 'send_id' })
  SendId!: number;

  @Column({ name: 'send_by', type: 'integer', nullable: false })
  SendBy!: number;

  @Column({ name: 'send_to_email', type: 'text', nullable: true })
  SendToEmail!: string | null;

  @Column({ name: 'email_subject', type: 'text', nullable: true })
  EmailSubject!: string | null;

  @Column({ name: 'send_on', type: 'timestamp', nullable: false })
  SendOn!: string;

}

@Entity({ name: 'nur_map_ward_sub_stores_map' })
export class WardSubStoresMapModel {
  @PrimaryGeneratedColumn({ name: 'ward_sub_stores_map_id' })
  WardSubStoresMapId!: number;

  @Column({ name: 'ward_id', type: 'integer', nullable: false })
  WardId!: number;

  @Column({ name: 'store_id', type: 'integer', nullable: false })
  StoreId!: number;

  @Column({ name: 'is_default', type: 'boolean', nullable: false })
  IsDefault!: boolean;

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

@Entity({ name: 'rad_mst_imaging_item' })
export class RadiologyImagingItemModel {
  @PrimaryGeneratedColumn({ name: 'imaging_item_id' })
  ImagingItemId!: number;

  @Column({ name: 'imaging_type_id', type: 'integer', nullable: false })
  ImagingTypeId!: number;

  @Column({ name: 'imaging_item_name', type: 'text', nullable: true })
  ImagingItemName!: string | null;

  @Column({ name: 'procedure_code', type: 'text', nullable: true })
  ProcedureCode!: string | null;

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

  @Column({ name: 'is_valid_for_reporting', type: 'boolean', nullable: false })
  IsValidForReporting!: boolean;

  @Column({ name: 'template_id', type: 'integer', nullable: true })
  TemplateId!: number | null;

}

@Entity({ name: 'rad_mst_imaging_type' })
export class RadiologyImagingTypeModel {
  @PrimaryGeneratedColumn({ name: 'imaging_type_id' })
  ImagingTypeId!: number;

  @Column({ name: 'imaging_type_name', type: 'text', nullable: true })
  ImagingTypeName!: string | null;

  @Column({ name: 'procedure_coding', type: 'text', nullable: true })
  ProcedureCoding!: string | null;

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

@Entity({ name: 'service_department_mst_integration_name' })
export class IntegrationModel {
  @PrimaryColumn({ name: 'integration_name', type: 'text' })
  IntegrationName!: string;

  @Column({ name: 'integration_name_id', type: 'integer', nullable: false })
  IntegrationNameID!: number;

}
