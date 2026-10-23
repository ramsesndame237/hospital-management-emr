/* GÉNÉRÉ par tools/generate-entities.mjs depuis migration/inventory/entities.json : ne pas modifier à la main. */
import { Column, Entity, PrimaryColumn, PrimaryGeneratedColumn } from 'typeorm';


@Entity({ name: 'dcm_dicom_files' })
export class DicomFileInfoModel {
  @PrimaryGeneratedColumn({ name: 'dicom_file_id', type: 'bigint' })
  DicomFileId!: number;

  @Column({ name: 'sop_instance_uid', type: 'text', nullable: true })
  SOPInstanceUID!: string | null;

  @Column({ name: 'rowguid', type: 'uuid', nullable: false })
  ROWGUID!: string;

  @Column({ name: 'series_id', type: 'integer', nullable: false })
  SeriesId!: number;

  @Column({ name: 'file_name', type: 'text', nullable: true })
  FileName!: string | null;

  @Column({ name: 'file_path', type: 'text', nullable: true })
  FilePath!: string | null;

  @Column({ name: 'file_binary_data', type: 'smallint', nullable: false })
  FileBinaryData!: number;

  @Column({ name: 'created_on', type: 'timestamp', nullable: true })
  CreatedOn!: string | null;

  @Column({ name: 'file_tool_data', type: 'text', nullable: true })
  FileToolData!: string | null;

  @Column({ name: 'modified_on', type: 'timestamp', nullable: true })
  ModifiedOn!: string | null;

  @Column({ name: 'modified_by', type: 'integer', nullable: true })
  ModifiedBy!: number | null;

}

@Entity({ name: 'dcm_patient_study' })
export class PatientStudyModel {
  @PrimaryGeneratedColumn({ name: 'patient_study_id' })
  PatientStudyId!: number;

  @Column({ name: 'patient_id', type: 'text', nullable: true })
  PatientId!: string | null;

  @Column({ name: 'patient_name', type: 'text', nullable: true })
  PatientName!: string | null;

  @Column({ name: 'study_instance_uid', type: 'text', nullable: true })
  StudyInstanceUID!: string | null;

  @Column({ name: 'sop_class_uid', type: 'text', nullable: true })
  SOPClassUID!: string | null;

  @Column({ name: 'study_date', type: 'timestamp', nullable: true })
  StudyDate!: string | null;

  @Column({ name: 'modality', type: 'text', nullable: true })
  Modality!: string | null;

  @Column({ name: 'study_description', type: 'text', nullable: true })
  StudyDescription!: string | null;

  @Column({ name: 'created_on', type: 'timestamp', nullable: true })
  CreatedOn!: string | null;

  @Column({ name: 'is_mapped', type: 'boolean', nullable: true })
  IsMapped!: boolean | null;

}

@Entity({ name: 'dcm_series' })
export class SeriesInfoModel {
  @PrimaryGeneratedColumn({ name: 'series_id' })
  SeriesId!: number;

  @Column({ name: 'patient_study_id', type: 'integer', nullable: false })
  PatientStudyId!: number;

  @Column({ name: 'series_instance_uid', type: 'text', nullable: true })
  SeriesInstanceUID!: string | null;

  @Column({ name: 'series_description', type: 'text', nullable: true })
  SeriesDescription!: string | null;

  @Column({ name: 'created_on', type: 'timestamp', nullable: true })
  CreatedOn!: string | null;

}
