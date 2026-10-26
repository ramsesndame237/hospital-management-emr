/* GÉNÉRÉ par tools/generate-entities.mjs depuis migration/inventory/entities.json : ne pas modifier à la main. */
import { Column, Entity, PrimaryColumn, PrimaryGeneratedColumn } from 'typeorm';


@Entity({ name: 'pat_ssu_information' })
export class SSU_InformationModel {
  @PrimaryGeneratedColumn({ name: 'ssu_info_id' })
  SSU_InfoId!: number;

  @Column({ name: 'patient_id', type: 'integer', nullable: false })
  PatientId!: number;

  @Column({ name: 'target_group_id', type: 'integer', nullable: false })
  TargetGroupId!: number;

  @Column({ name: 'target_group', type: 'text', nullable: true })
  TargetGroup!: string | null;

  @Column({ name: 'tg_certificate_type', type: 'text', nullable: true })
  TG_CertificateType!: string | null;

  @Column({ name: 'tg_certificate_no', type: 'text', nullable: true })
  TG_CertificateNo!: string | null;

  @Column({ name: 'income_source', type: 'text', nullable: true })
  IncomeSource!: string | null;

  @Column({ name: 'pat_family_financial_status', type: 'text', nullable: true })
  PatFamilyFinancialStatus!: string | null;

  @Column({ name: 'created_by', type: 'integer', nullable: true })
  CreatedBy!: number | null;

  @Column({ name: 'modified_by', type: 'integer', nullable: true })
  ModifiedBy!: number | null;

  @Column({ name: 'created_on', type: 'timestamp', nullable: true })
  CreatedOn!: string | null;

  @Column({ name: 'modified_on', type: 'timestamp', nullable: true })
  ModifiedOn!: string | null;

}
