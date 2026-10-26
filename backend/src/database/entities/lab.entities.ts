/* GÉNÉRÉ par tools/generate-entities.mjs depuis migration/inventory/entities.json : ne pas modifier à la main. */
import { Column, Entity, PrimaryColumn, PrimaryGeneratedColumn } from 'typeorm';
import { NUM } from '../transformers';

@Entity({ name: 'lab_bar_code' })
export class LabBarCodeModel {
  @PrimaryGeneratedColumn({ name: 'bar_code_number', type: 'bigint' })
  BarCodeNumber!: number;

  @Column({ name: 'bar_code_id', type: 'integer', nullable: false })
  BarCodeId!: number;

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

@Entity({ name: 'lab_gov_report_mapping' })
export class LabGovReportMappingModel {
  @PrimaryGeneratedColumn({ name: 'report_map_id' })
  ReportMapId!: number;

  @Column({ name: 'report_item_id', type: 'integer', nullable: false })
  ReportItemId!: number;

  @Column({ name: 'lab_item_id', type: 'bigint', nullable: false, transformer: NUM })
  LabItemId!: number;

  @Column({ name: 'is_active', type: 'boolean', nullable: false })
  IsActive!: boolean;

  @Column({ name: 'is_component_based', type: 'boolean', nullable: false })
  IsComponentBased!: boolean;

  @Column({ name: 'component_id', type: 'integer', nullable: true })
  ComponentId!: number | null;

  @Column({ name: 'is_result_count', type: 'boolean', nullable: false })
  IsResultCount!: boolean;

  @Column({ name: 'positive_indicator', type: 'text', nullable: true })
  PositiveIndicator!: string | null;

}

@Entity({ name: 'lab_lab_tests' })
export class LabTestModel {
  @PrimaryGeneratedColumn({ name: 'lab_test_id', type: 'bigint' })
  LabTestId!: number;

  @Column({ name: 'lab_test_code', type: 'text', nullable: true })
  LabTestCode!: string | null;

  @Column({ name: 'lab_sequence', type: 'integer', nullable: false })
  LabSequence!: number;

  @Column({ name: 'procedure_code', type: 'text', nullable: true })
  ProcedureCode!: string | null;

  @Column({ name: 'lab_test_name', type: 'text', nullable: true })
  LabTestName!: string | null;

  @Column({ name: 'lab_test_synonym', type: 'text', nullable: true })
  LabTestSynonym!: string | null;

  @Column({ name: 'lab_test_specimen', type: 'text', nullable: true })
  LabTestSpecimen!: string | null;

  @Column({ name: 'lab_test_specimen_source', type: 'text', nullable: true })
  LabTestSpecimenSource!: string | null;

  @Column({ name: 'loinc', type: 'text', nullable: true })
  LOINC!: string | null;

  @Column({ name: 'report_template_id', type: 'integer', nullable: false })
  ReportTemplateId!: number;

  @Column({ name: 'is_valid_for_reporting', type: 'boolean', nullable: false })
  IsValidForReporting!: boolean;

  @Column({ name: 'description', type: 'text', nullable: true })
  Description!: string | null;

  @Column({ name: 'display_sequence', type: 'integer', nullable: true })
  DisplaySequence!: number | null;

  @Column({ name: 'run_number_type', type: 'text', nullable: true })
  RunNumberType!: string | null;

  @Column({ name: 'created_on', type: 'timestamp', nullable: false })
  CreatedOn!: string;

  @Column({ name: 'created_by', type: 'integer', nullable: false })
  CreatedBy!: number;

  @Column({ name: 'is_active', type: 'boolean', nullable: false })
  IsActive!: boolean;

  @Column({ name: 'has_negative_results', type: 'boolean', nullable: false })
  HasNegativeResults!: boolean;

  @Column({ name: 'negative_result_text', type: 'text', nullable: true })
  NegativeResultText!: string | null;

  @Column({ name: 'lab_test_category_id', type: 'integer', nullable: false })
  LabTestCategoryId!: number;

  @Column({ name: 'sms_applicable', type: 'boolean', nullable: false })
  SmsApplicable!: boolean;

  @Column({ name: 'reporting_name', type: 'text', nullable: true })
  ReportingName!: string | null;

  @Column({ name: 'interpretation', type: 'text', nullable: true })
  Interpretation!: string | null;

  @Column({ name: 'modified_by', type: 'integer', nullable: true })
  ModifiedBy!: number | null;

  @Column({ name: 'modified_on', type: 'timestamp', nullable: true })
  ModifiedOn!: string | null;

  @Column({ name: 'is_outsource_test', type: 'boolean', nullable: true })
  IsOutsourceTest!: boolean | null;

  @Column({ name: 'default_outsource_vendor_id', type: 'integer', nullable: true })
  DefaultOutsourceVendorId!: number | null;

  @Column({ name: 'is_lis_applicable', type: 'boolean', nullable: false })
  IsLISApplicable!: boolean;

}

@Entity({ name: 'lab_lis_synced_component_detail' })
export class LISSyncedComponentDetail {
  @PrimaryGeneratedColumn({ name: 'lis_component_result_id' })
  LISComponentResultId!: number;

  @Column({ name: 'sync_status', type: 'boolean', nullable: false })
  SyncStatus!: boolean;

  @Column({ name: 'created_by', type: 'integer', nullable: false })
  CreatedBy!: number;

  @Column({ name: 'created_on', type: 'timestamp', nullable: false })
  CreatedOn!: string;

}

@Entity({ name: 'lab_map_test_components' })
export class LabTestComponentMapModel {
  @PrimaryGeneratedColumn({ name: 'component_map_id' })
  ComponentMapId!: number;

  @Column({ name: 'lab_test_id', type: 'bigint', nullable: false, transformer: NUM })
  LabTestId!: number;

  @Column({ name: 'component_id', type: 'integer', nullable: false })
  ComponentId!: number;

  @Column({ name: 'display_sequence', type: 'integer', nullable: false })
  DisplaySequence!: number;

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

  @Column({ name: 'group_name', type: 'text', nullable: true })
  GroupName!: string | null;

  @Column({ name: 'indentation_count', type: 'integer', nullable: false })
  IndentationCount!: number;

  @Column({ name: 'show_in_sheet', type: 'boolean', nullable: false })
  ShowInSheet!: boolean;

  @Column({ name: 'is_auto_calculate', type: 'boolean', nullable: false })
  IsAutoCalculate!: boolean;

  @Column({ name: 'calculation_formula', type: 'text', nullable: true })
  CalculationFormula!: string | null;

  @Column({ name: 'formula_description', type: 'text', nullable: true })
  FormulaDescription!: string | null;

}

@Entity({ name: 'lab_mst_components' })
export class LabTestJSONComponentModel {
  @PrimaryGeneratedColumn({ name: 'component_id' })
  ComponentId!: number;

  @Column({ name: 'component_name', type: 'text', nullable: true })
  ComponentName!: string | null;

  @Column({ name: 'unit', type: 'text', nullable: true })
  Unit!: string | null;

  @Column({ name: 'value_type', type: 'text', nullable: true })
  ValueType!: string | null;

  @Column({ name: 'control_type', type: 'text', nullable: true })
  ControlType!: string | null;

  @Column({ name: 'range', type: 'text', nullable: true })
  Range!: string | null;

  @Column({ name: 'male_range', type: 'text', nullable: true })
  MaleRange!: string | null;

  @Column({ name: 'female_range', type: 'text', nullable: true })
  FemaleRange!: string | null;

  @Column({ name: 'child_range', type: 'text', nullable: true })
  ChildRange!: string | null;

  @Column({ name: 'range_description', type: 'text', nullable: true })
  RangeDescription!: string | null;

  @Column({ name: 'method', type: 'text', nullable: true })
  Method!: string | null;

  @Column({ name: 'value_lookup', type: 'text', nullable: true })
  ValueLookup!: string | null;

  @Column({ name: 'min_value', type: 'double precision', nullable: true })
  MinValue!: number | null;

  @Column({ name: 'max_value', type: 'double precision', nullable: true })
  MaxValue!: number | null;

  @Column({ name: 'display_name', type: 'text', nullable: true })
  DisplayName!: string | null;

  @Column({ name: 'created_by', type: 'integer', nullable: false })
  CreatedBy!: number;

  @Column({ name: 'created_on', type: 'timestamp', nullable: false })
  CreatedOn!: string;

  @Column({ name: 'modified_by', type: 'integer', nullable: true })
  ModifiedBy!: number | null;

  @Column({ name: 'modified_on', type: 'timestamp', nullable: true })
  ModifiedOn!: string | null;

}

@Entity({ name: 'lab_mst_gov_report_items' })
export class LabGovReportItemModel {
  @PrimaryGeneratedColumn({ name: 'report_item_id' })
  ReportItemId!: number;

  @Column({ name: 'serial_number', type: 'integer', nullable: false })
  SerialNumber!: number;

  @Column({ name: 'test_name', type: 'text', nullable: true })
  TestName!: string | null;

  @Column({ name: 'group_name', type: 'text', nullable: true })
  GroupName!: string | null;

  @Column({ name: 'display_name', type: 'text', nullable: true })
  DisplayName!: string | null;

  @Column({ name: 'has_inner_items', type: 'boolean', nullable: false })
  HasInnerItems!: boolean;

  @Column({ name: 'inner_test_group_name', type: 'text', nullable: true })
  InnerTestGroupName!: string | null;

  @Column({ name: 'is_active', type: 'boolean', nullable: false })
  IsActive!: boolean;

}

@Entity({ name: 'lab_mst_lab_vendors' })
export class LabVendorsModel {
  @PrimaryGeneratedColumn({ name: 'lab_vendor_id' })
  LabVendorId!: number;

  @Column({ name: 'vendor_code', type: 'text', nullable: true })
  VendorCode!: string | null;

  @Column({ name: 'vendor_name', type: 'text', nullable: true })
  VendorName!: string | null;

  @Column({ name: 'is_external', type: 'boolean', nullable: false })
  IsExternal!: boolean;

  @Column({ name: 'contact_address', type: 'text', nullable: true })
  ContactAddress!: string | null;

  @Column({ name: 'contact_no', type: 'text', nullable: true })
  ContactNo!: string | null;

  @Column({ name: 'email', type: 'text', nullable: true })
  Email!: string | null;

  @Column({ name: 'remarks', type: 'text', nullable: true })
  Remarks!: string | null;

  @Column({ name: 'created_by', type: 'integer', nullable: false })
  CreatedBy!: number;

  @Column({ name: 'created_on', type: 'timestamp', nullable: false })
  CreatedOn!: string;

  @Column({ name: 'is_active', type: 'boolean', nullable: false })
  IsActive!: boolean;

  @Column({ name: 'is_default', type: 'boolean', nullable: false })
  IsDefault!: boolean;

}

@Entity({ name: 'lab_mst_run_number_settings' })
export class LabRunNumberSettingsModel {
  @PrimaryGeneratedColumn({ name: 'run_number_format_id' })
  RunNumberFormatId!: number;

  @Column({ name: 'run_number_format_name', type: 'text', nullable: true })
  RunNumberFormatName!: string | null;

  @Column({ name: 'run_number_grouping_index', type: 'integer', nullable: false })
  RunNumberGroupingIndex!: number;

  @Column({ name: 'visit_type', type: 'text', nullable: true })
  VisitType!: string | null;

  @Column({ name: 'run_number_type', type: 'text', nullable: true })
  RunNumberType!: string | null;

  @Column({ name: 'reset_daily', type: 'boolean', nullable: false })
  ResetDaily!: boolean;

  @Column({ name: 'reset_monthly', type: 'boolean', nullable: false })
  ResetMonthly!: boolean;

  @Column({ name: 'reset_yearly', type: 'boolean', nullable: false })
  ResetYearly!: boolean;

  @Column({ name: 'starting_letter', type: 'text', nullable: true })
  StartingLetter!: string | null;

  @Column({ name: 'format_initial_part', type: 'text', nullable: true })
  FormatInitialPart!: string | null;

  @Column({ name: 'format_separator', type: 'text', nullable: true })
  FormatSeparator!: string | null;

  @Column({ name: 'format_last_part', type: 'text', nullable: true })
  FormatLastPart!: string | null;

  @Column({ name: 'under_insurance', type: 'boolean', nullable: false })
  UnderInsurance!: boolean;

  @Column({ name: 'modified_by', type: 'integer', nullable: true })
  ModifiedBy!: number | null;

  @Column({ name: 'modified_on', type: 'timestamp', nullable: true })
  ModifiedOn!: string | null;

  @Column({ name: 'lab_type_id', type: 'integer', nullable: false })
  LabTypeId!: number;

  @Column({ name: 'lab_type_name', type: 'text', nullable: true })
  LabTypeName!: string | null;

}

@Entity({ name: 'lab_mst_test_specimen' })
export class LabTestMasterSpecimen {
  @PrimaryGeneratedColumn({ name: 'specimen_id' })
  SpecimenId!: number;

  @Column({ name: 'specimen_name', type: 'text', nullable: true })
  SpecimenName!: string | null;

}

@Entity({ name: 'lab_report_template' })
export class LabReportTemplateModel {
  @PrimaryGeneratedColumn({ name: 'report_template_id' })
  ReportTemplateID!: number;

  @Column({ name: 'report_template_short_name', type: 'text', nullable: true })
  ReportTemplateShortName!: string | null;

  @Column({ name: 'report_template_name', type: 'text', nullable: true })
  ReportTemplateName!: string | null;

  @Column({ name: 'template_file_name', type: 'text', nullable: true })
  TemplateFileName!: string | null;

  @Column({ name: 'negative_template_file_name', type: 'text', nullable: true })
  NegativeTemplateFileName!: string | null;

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

  @Column({ name: 'header_text', type: 'text', nullable: true })
  HeaderText!: string | null;

  @Column({ name: 'col_settings_json', type: 'text', nullable: true })
  ColSettingsJSON!: string | null;

  @Column({ name: 'template_type', type: 'text', nullable: true })
  TemplateType!: string | null;

  @Column({ name: 'template_html', type: 'text', nullable: true })
  TemplateHTML!: string | null;

  @Column({ name: 'footer_text', type: 'text', nullable: true })
  FooterText!: string | null;

  @Column({ name: 'description', type: 'text', nullable: true })
  Description!: string | null;

  @Column({ name: 'display_sequence', type: 'integer', nullable: false })
  DisplaySequence!: number;

}

@Entity({ name: 'lab_sms' })
export class LabSMSModel {
  @PrimaryGeneratedColumn({ name: 'sms_id' })
  SmsId!: number;

  @Column({ name: 'requisition_id', type: 'bigint', nullable: false, transformer: NUM })
  RequisitionId!: number;

  @Column({ name: 'message', type: 'text', nullable: true })
  Message!: string | null;

  @Column({ name: 'created_by', type: 'integer', nullable: false })
  CreatedBy!: number;

  @Column({ name: 'created_on', type: 'timestamp', nullable: false })
  CreatedOn!: string;

}

@Entity({ name: 'lab_test_category' })
export class LabTestCategoryModel {
  @PrimaryGeneratedColumn({ name: 'test_category_id' })
  TestCategoryId!: number;

  @Column({ name: 'test_category_name', type: 'text', nullable: true })
  TestCategoryName!: string | null;

  @Column({ name: 'created_by', type: 'integer', nullable: false })
  CreatedBy!: number;

  @Column({ name: 'created_on', type: 'timestamp', nullable: false })
  CreatedOn!: string;

  @Column({ name: 'modified_by', type: 'integer', nullable: true })
  ModifiedBy!: number | null;

  @Column({ name: 'modified_on', type: 'timestamp', nullable: true })
  ModifiedOn!: string | null;

  @Column({ name: 'is_default', type: 'boolean', nullable: false })
  IsDefault!: boolean;

  @Column({ name: 'permission_id', type: 'integer', nullable: false })
  PermissionId!: number;

  @Column({ name: 'is_active', type: 'boolean', nullable: false })
  IsActive!: boolean;

}

@Entity({ name: 'lab_test_requisition' })
export class LabRequisitionModel {
  @PrimaryGeneratedColumn({ name: 'requisition_id', type: 'bigint' })
  RequisitionId!: number;

  @Column({ name: 'patient_visit_id', type: 'integer', nullable: true })
  PatientVisitId!: number | null;

  @Column({ name: 'patient_id', type: 'integer', nullable: false })
  PatientId!: number;

  @Column({ name: 'prescriber_id', type: 'integer', nullable: true })
  PrescriberId!: number | null;

  @Column({ name: 'lab_test_id', type: 'bigint', nullable: false, transformer: NUM })
  LabTestId!: number;

  @Column({ name: 'procedure_code', type: 'text', nullable: true })
  ProcedureCode!: string | null;

  @Column({ name: 'loinc', type: 'text', nullable: true })
  LOINC!: string | null;

  @Column({ name: 'lab_test_name', type: 'text', nullable: true })
  LabTestName!: string | null;

  @Column({ name: 'lab_test_specimen', type: 'text', nullable: true })
  LabTestSpecimen!: string | null;

  @Column({ name: 'lab_test_specimen_source', type: 'text', nullable: true })
  LabTestSpecimenSource!: string | null;

  @Column({ name: 'patient_name', type: 'text', nullable: true })
  PatientName!: string | null;

  @Column({ name: 'diagnosis', type: 'text', nullable: true })
  Diagnosis!: string | null;

  @Column({ name: 'urgency', type: 'text', nullable: true })
  Urgency!: string | null;

  @Column({ name: 'order_date_time', type: 'timestamp', nullable: false })
  OrderDateTime!: string;

  @Column({ name: 'prescriber_name', type: 'text', nullable: true })
  PrescriberName!: string | null;

  @Column({ name: 'billing_status', type: 'text', nullable: true })
  BillingStatus!: string | null;

  @Column({ name: 'order_status', type: 'text', nullable: true })
  OrderStatus!: string | null;

  @Column({ name: 'sample_code', type: 'integer', nullable: true })
  SampleCode!: number | null;

  @Column({ name: 'requisition_remarks', type: 'text', nullable: true })
  RequisitionRemarks!: string | null;

  @Column({ name: 'sample_created_on', type: 'timestamp', nullable: true })
  SampleCreatedOn!: string | null;

  @Column({ name: 'sample_collected_on_date_time', type: 'timestamp', nullable: true })
  SampleCollectedOnDateTime!: string | null;

  @Column({ name: 'sample_created_by', type: 'integer', nullable: true })
  SampleCreatedBy!: number | null;

  @Column({ name: 'comments', type: 'text', nullable: true })
  Comments!: string | null;

  @Column({ name: 'run_number_type', type: 'text', nullable: true })
  RunNumberType!: string | null;

  @Column({ name: 'external_lab_sample_status', type: 'text', nullable: true })
  ExternalLabSampleStatus!: string | null;

  @Column({ name: 'is_sms_send', type: 'boolean', nullable: false })
  IsSmsSend!: boolean;

  @Column({ name: 'report_template_id', type: 'integer', nullable: false })
  ReportTemplateId!: number;

  @Column({ name: 'diagnosis_id', type: 'integer', nullable: true })
  DiagnosisId!: number | null;

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

  @Column({ name: 'visit_type', type: 'text', nullable: true })
  VisitType!: string | null;

  @Column({ name: 'lab_report_id', type: 'integer', nullable: true })
  LabReportId!: number | null;

  @Column({ name: 'bar_code_number', type: 'bigint', nullable: true, transformer: NUM })
  BarCodeNumber!: number | null;

  @Column({ name: 'ward_name', type: 'text', nullable: true })
  WardName!: string | null;

  @Column({ name: 'is_verified', type: 'boolean', nullable: true })
  IsVerified!: boolean | null;

  @Column({ name: 'verified_on', type: 'timestamp', nullable: true })
  VerifiedOn!: string | null;

  @Column({ name: 'verified_by', type: 'integer', nullable: true })
  VerifiedBy!: number | null;

  @Column({ name: 'resulting_vendor_id', type: 'integer', nullable: false })
  ResultingVendorId!: number;

  @Column({ name: 'has_insurance', type: 'boolean', nullable: false })
  HasInsurance!: boolean;

  @Column({ name: 'result_added_by', type: 'integer', nullable: true })
  ResultAddedBy!: number | null;

  @Column({ name: 'result_added_on', type: 'timestamp', nullable: true })
  ResultAddedOn!: string | null;

  @Column({ name: 'printed_by', type: 'integer', nullable: true })
  PrintedBy!: number | null;

  @Column({ name: 'print_count', type: 'integer', nullable: true })
  PrintCount!: number | null;

  @Column({ name: 'sample_code_formatted', type: 'text', nullable: true })
  SampleCodeFormatted!: string | null;

  @Column({ name: 'bill_cancelled_by', type: 'integer', nullable: true })
  BillCancelledBy!: number | null;

  @Column({ name: 'bill_cancelled_on', type: 'timestamp', nullable: true })
  BillCancelledOn!: string | null;

  @Column({ name: 'lab_type_name', type: 'text', nullable: true })
  LabTypeName!: string | null;

  @Column({ name: 'google_file_id_for_covid', type: 'text', nullable: true })
  GoogleFileIdForCovid!: string | null;

  @Column({ name: 'covid_file_name', type: 'text', nullable: true })
  CovidFileName!: string | null;

  @Column({ name: 'is_file_uploaded', type: 'boolean', nullable: true })
  IsFileUploaded!: boolean | null;

  @Column({ name: 'uploaded_by', type: 'integer', nullable: true })
  UploadedBy!: number | null;

  @Column({ name: 'uploaded_on', type: 'timestamp', nullable: true })
  UploadedOn!: string | null;

  @Column({ name: 'is_file_uploaded_to_tele_medicine', type: 'boolean', nullable: true })
  IsFileUploadedToTeleMedicine!: boolean | null;

  @Column({ name: 'uploaded_by_to_tele_medicine', type: 'integer', nullable: true })
  UploadedByToTeleMedicine!: number | null;

  @Column({ name: 'uploaded_on_to_tele_medicine', type: 'timestamp', nullable: true })
  UploadedOnToTeleMedicine!: string | null;

  @Column({ name: 'is_uploaded_to_imu', type: 'boolean', nullable: true })
  IsUploadedToIMU!: boolean | null;

  @Column({ name: 'imu_uploaded_on', type: 'timestamp', nullable: true })
  IMUUploadedOn!: string | null;

  @Column({ name: 'imu_uploaded_by', type: 'integer', nullable: true })
  IMUUploadedBy!: number | null;

  @Column({ name: 'billing_transaction_item_id', type: 'integer', nullable: false })
  BillingTransactionItemId!: number;

  @Column({ name: 'service_item_id', type: 'integer', nullable: false })
  ServiceItemId!: number;

}

@Entity({ name: 'lab_txn_lab_reports' })
export class LabReportModel {
  @PrimaryGeneratedColumn({ name: 'lab_report_id' })
  LabReportId!: number;

  @Column({ name: 'patient_id', type: 'integer', nullable: false })
  PatientId!: number;

  @Column({ name: 'template_id', type: 'integer', nullable: true })
  TemplateId!: number | null;

  @Column({ name: 'receiving_date', type: 'timestamp', nullable: false })
  ReceivingDate!: string;

  @Column({ name: 'reporting_date', type: 'timestamp', nullable: false })
  ReportingDate!: string;

  @Column({ name: 'is_printed', type: 'boolean', nullable: false })
  IsPrinted!: boolean;

  @Column({ name: 'signatories', type: 'text', nullable: true })
  Signatories!: string | null;

  @Column({ name: 'created_on', type: 'timestamp', nullable: false })
  CreatedOn!: string;

  @Column({ name: 'created_by', type: 'integer', nullable: false })
  CreatedBy!: number;

  @Column({ name: 'is_active', type: 'boolean', nullable: false })
  IsActive!: boolean;

  @Column({ name: 'modified_by', type: 'integer', nullable: true })
  ModifiedBy!: number | null;

  @Column({ name: 'modified_on', type: 'timestamp', nullable: true })
  ModifiedOn!: string | null;

  @Column({ name: 'printed_on', type: 'timestamp', nullable: true })
  PrintedOn!: string | null;

  @Column({ name: 'printed_by', type: 'integer', nullable: true })
  PrintedBy!: number | null;

  @Column({ name: 'print_count', type: 'integer', nullable: true })
  PrintCount!: number | null;

  @Column({ name: 'prescriber_name', type: 'text', nullable: true })
  PrescriberName!: string | null;

  @Column({ name: 'comments', type: 'text', nullable: true })
  Comments!: string | null;

}

@Entity({ name: 'lab_txn_test_component_result' })
export class LabTestComponentResult {
  @PrimaryGeneratedColumn({ name: 'test_component_result_id', type: 'bigint' })
  TestComponentResultId!: number;

  @Column({ name: 'requisition_id', type: 'bigint', nullable: false, transformer: NUM })
  RequisitionId!: number;

  @Column({ name: 'lab_test_id', type: 'bigint', nullable: false, transformer: NUM })
  LabTestId!: number;

  @Column({ name: 'value', type: 'text', nullable: true })
  Value!: string | null;

  @Column({ name: 'unit', type: 'text', nullable: true })
  Unit!: string | null;

  @Column({ name: 'range', type: 'text', nullable: true })
  Range!: string | null;

  @Column({ name: 'component_name', type: 'text', nullable: true })
  ComponentName!: string | null;

  @Column({ name: 'component_id', type: 'integer', nullable: false })
  ComponentId!: number;

  @Column({ name: 'method', type: 'text', nullable: true })
  Method!: string | null;

  @Column({ name: 'created_by', type: 'integer', nullable: false })
  CreatedBy!: number;

  @Column({ name: 'created_on', type: 'timestamp', nullable: false })
  CreatedOn!: string;

  @Column({ name: 'modified_by', type: 'integer', nullable: true })
  ModifiedBy!: number | null;

  @Column({ name: 'modified_on', type: 'timestamp', nullable: true })
  ModifiedOn!: string | null;

  @Column({ name: 'remarks', type: 'text', nullable: true })
  Remarks!: string | null;

  @Column({ name: 'template_id', type: 'integer', nullable: false })
  TemplateId!: number;

  @Column({ name: 'range_description', type: 'text', nullable: true })
  RangeDescription!: string | null;

  @Column({ name: 'is_negative_result', type: 'boolean', nullable: false })
  IsNegativeResult!: boolean;

  @Column({ name: 'negative_result_text', type: 'text', nullable: true })
  NegativeResultText!: string | null;

  @Column({ name: 'is_abnormal', type: 'boolean', nullable: false })
  IsAbnormal!: boolean;

  @Column({ name: 'lab_report_id', type: 'integer', nullable: true })
  LabReportId!: number | null;

  @Column({ name: 'is_active', type: 'boolean', nullable: false })
  IsActive!: boolean;

  @Column({ name: 'abnormal_type', type: 'text', nullable: true })
  AbnormalType!: string | null;

  @Column({ name: 'result_group', type: 'integer', nullable: true })
  ResultGroup!: number | null;

}

@Entity({ name: 'mst_lab_types' })
export class LabTypesModel {
  @PrimaryGeneratedColumn({ name: 'lab_type_id' })
  LabTypeId!: number;

  @Column({ name: 'lab_type_name', type: 'text', nullable: true })
  LabTypeName!: string | null;

  @Column({ name: 'display_name', type: 'text', nullable: true })
  DisplayName!: string | null;

  @Column({ name: 'created_by', type: 'integer', nullable: false })
  CreatedBy!: number;

  @Column({ name: 'created_on', type: 'timestamp', nullable: false })
  CreatedOn!: string;

  @Column({ name: 'modified_by', type: 'integer', nullable: true })
  ModifiedBy!: number | null;

  @Column({ name: 'modified_on', type: 'integer', nullable: true })
  ModifiedOn!: number | null;

  @Column({ name: 'is_active', type: 'boolean', nullable: false })
  IsActive!: boolean;

  @Column({ name: 'is_default', type: 'boolean', nullable: false })
  IsDefault!: boolean;

}
