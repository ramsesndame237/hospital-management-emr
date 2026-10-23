/* GÉNÉRÉ par tools/generate-entities.mjs depuis migration/inventory/entities.json : ne pas modifier à la main. */
import { Column, Entity, PrimaryColumn, PrimaryGeneratedColumn } from 'typeorm';


@Entity({ name: 'rad_cfg_report_templates' })
export class RadiologyReportTemplateModel {
  @PrimaryGeneratedColumn({ name: 'template_id' })
  TemplateId!: number;

  @Column({ name: 'module_name', type: 'text', nullable: true })
  ModuleName!: string | null;

  @Column({ name: 'template_code', type: 'text', nullable: true })
  TemplateCode!: string | null;

  @Column({ name: 'template_name', type: 'text', nullable: true })
  TemplateName!: string | null;

  @Column({ name: 'template_html', type: 'text', nullable: true })
  TemplateHTML!: string | null;

  @Column({ name: 'footer_note', type: 'text', nullable: true })
  FooterNote!: string | null;

  @Column({ name: 'created_by', type: 'integer', nullable: true })
  CreatedBy!: number | null;

  @Column({ name: 'modified_by', type: 'integer', nullable: true })
  ModifiedBy!: number | null;

  @Column({ name: 'is_active', type: 'boolean', nullable: true })
  IsActive!: boolean | null;

  @Column({ name: 'created_on', type: 'timestamp', nullable: true })
  CreatedOn!: string | null;

  @Column({ name: 'modified_on', type: 'timestamp', nullable: true })
  ModifiedOn!: string | null;

}

@Entity({ name: 'rad_mst_film_type' })
export class FilmTypeModel {
  @PrimaryGeneratedColumn({ name: 'film_type_id' })
  FilmTypeId!: number;

  @Column({ name: 'film_type', type: 'text', nullable: true })
  FilmType!: string | null;

  @Column({ name: 'imaging_type_id', type: 'integer', nullable: false })
  ImagingTypeId!: number;

  @Column({ name: 'film_type_display_name', type: 'text', nullable: true })
  FilmTypeDisplayName!: string | null;

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

@Entity({ name: 'rad_patient_imaging_report' })
export class ImagingReportModel {
  @Column({ name: 'imaging_report_id', type: 'integer', nullable: false })
  ImagingReportId!: number;

  @PrimaryGeneratedColumn({ name: 'imaging_requisition_id' })
  ImagingRequisitionId!: number;

  @Column({ name: 'patient_visit_id', type: 'integer', nullable: true })
  PatientVisitId!: number | null;

  @Column({ name: 'patient_id', type: 'integer', nullable: false })
  PatientId!: number;

  @Column({ name: 'prescriber_name', type: 'text', nullable: true })
  PrescriberName!: string | null;

  @Column({ name: 'imaging_type_id', type: 'integer', nullable: true })
  ImagingTypeId!: number | null;

  @Column({ name: 'imaging_type_name', type: 'text', nullable: true })
  ImagingTypeName!: string | null;

  @Column({ name: 'imaging_item_id', type: 'integer', nullable: true })
  ImagingItemId!: number | null;

  @Column({ name: 'imaging_item_name', type: 'text', nullable: true })
  ImagingItemName!: string | null;

  @Column({ name: 'image_full_path', type: 'text', nullable: true })
  ImageFullPath!: string | null;

  @Column({ name: 'image_name', type: 'text', nullable: true })
  ImageName!: string | null;

  @Column({ name: 'report_text', type: 'text', nullable: true })
  ReportText!: string | null;

  @Column({ name: 'created_on', type: 'timestamp', nullable: true })
  CreatedOn!: string | null;

  @Column({ name: 'signatories', type: 'text', nullable: true })
  Signatories!: string | null;

  @Column({ name: 'order_status', type: 'text', nullable: true })
  OrderStatus!: string | null;

  @Column({ name: 'prescriber_id', type: 'integer', nullable: true })
  PrescriberId!: number | null;

  @Column({ name: 'created_by', type: 'integer', nullable: true })
  CreatedBy!: number | null;

  @Column({ name: 'modified_by', type: 'integer', nullable: true })
  ModifiedBy!: number | null;

  @Column({ name: 'modified_on', type: 'timestamp', nullable: true })
  ModifiedOn!: string | null;

  @Column({ name: 'report_template_id', type: 'integer', nullable: true })
  ReportTemplateId!: number | null;

  @Column({ name: 'patient_study_id', type: 'text', nullable: true })
  PatientStudyId!: string | null;

  @Column({ name: 'indication', type: 'text', nullable: true })
  Indication!: string | null;

  @Column({ name: 'radiology_no', type: 'text', nullable: true })
  RadiologyNo!: string | null;

  @Column({ name: 'performer_id', type: 'integer', nullable: true })
  PerformerId!: number | null;

  @Column({ name: 'performer_name', type: 'text', nullable: true })
  PerformerName!: string | null;

}

@Entity({ name: 'rad_patient_imaging_requisition' })
export class ImagingRequisitionModel {
  @PrimaryGeneratedColumn({ name: 'imaging_requisition_id' })
  ImagingRequisitionId!: number;

  @Column({ name: 'patient_visit_id', type: 'integer', nullable: true })
  PatientVisitId!: number | null;

  @Column({ name: 'patient_id', type: 'integer', nullable: false })
  PatientId!: number;

  @Column({ name: 'prescriber_name', type: 'text', nullable: true })
  PrescriberName!: string | null;

  @Column({ name: 'imaging_type_id', type: 'integer', nullable: true })
  ImagingTypeId!: number | null;

  @Column({ name: 'imaging_type_name', type: 'text', nullable: true })
  ImagingTypeName!: string | null;

  @Column({ name: 'imaging_item_id', type: 'integer', nullable: true })
  ImagingItemId!: number | null;

  @Column({ name: 'imaging_item_name', type: 'text', nullable: true })
  ImagingItemName!: string | null;

  @Column({ name: 'procedure_code', type: 'text', nullable: true })
  ProcedureCode!: string | null;

  @Column({ name: 'imaging_date', type: 'timestamp', nullable: true })
  ImagingDate!: string | null;

  @Column({ name: 'requisition_remarks', type: 'text', nullable: true })
  RequisitionRemarks!: string | null;

  @Column({ name: 'order_status', type: 'text', nullable: true })
  OrderStatus!: string | null;

  @Column({ name: 'prescriber_id', type: 'integer', nullable: true })
  PrescriberId!: number | null;

  @Column({ name: 'billing_status', type: 'text', nullable: true })
  BillingStatus!: string | null;

  @Column({ name: 'urgency', type: 'text', nullable: true })
  Urgency!: string | null;

  @Column({ name: 'created_by', type: 'integer', nullable: true })
  CreatedBy!: number | null;

  @Column({ name: 'created_on', type: 'timestamp', nullable: true })
  CreatedOn!: string | null;

  @Column({ name: 'modified_by', type: 'integer', nullable: true })
  ModifiedBy!: number | null;

  @Column({ name: 'modified_on', type: 'timestamp', nullable: true })
  ModifiedOn!: string | null;

  @Column({ name: 'diagnosis_id', type: 'integer', nullable: true })
  DiagnosisId!: number | null;

  @Column({ name: 'ward_name', type: 'text', nullable: true })
  WardName!: string | null;

  @Column({ name: 'is_active', type: 'boolean', nullable: false })
  IsActive!: boolean;

  @Column({ name: 'bill_cancelled_by', type: 'integer', nullable: true })
  BillCancelledBy!: number | null;

  @Column({ name: 'bill_cancelled_on', type: 'timestamp', nullable: true })
  BillCancelledOn!: string | null;

  @Column({ name: 'is_report_saved', type: 'boolean', nullable: false })
  IsReportSaved!: boolean;

  @Column({ name: 'has_insurance', type: 'boolean', nullable: true })
  HasInsurance!: boolean | null;

  @Column({ name: 'is_scanned', type: 'boolean', nullable: true })
  IsScanned!: boolean | null;

  @Column({ name: 'scanned_by', type: 'integer', nullable: true })
  ScannedBy!: number | null;

  @Column({ name: 'scanned_on', type: 'timestamp', nullable: true })
  ScannedOn!: string | null;

  @Column({ name: 'scan_remarks', type: 'text', nullable: true })
  ScanRemarks!: string | null;

  @Column({ name: 'film_type_id', type: 'integer', nullable: true })
  FilmTypeId!: number | null;

  @Column({ name: 'film_quantity', type: 'integer', nullable: true })
  FilmQuantity!: number | null;

  @Column({ name: 'billing_transaction_item_id', type: 'integer', nullable: false })
  BillingTransactionItemId!: number;

  @Column({ name: 'service_item_id', type: 'integer', nullable: false })
  ServiceItemId!: number;

}
