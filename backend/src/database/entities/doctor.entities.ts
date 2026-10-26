/* GÉNÉRÉ par tools/generate-entities.mjs depuis migration/inventory/entities.json : ne pas modifier à la main. */
import { Column, Entity, PrimaryColumn, PrimaryGeneratedColumn } from 'typeorm';


@Entity({ name: 'doc_txn_visit_summary' })
export class VisitSummaryModel {
  @PrimaryGeneratedColumn({ name: 'visit_summary_id' })
  VisitSummaryId!: number;

  @Column({ name: 'patient_id', type: 'integer', nullable: false })
  PatientId!: number;

  @Column({ name: 'visit_id', type: 'integer', nullable: false })
  VisitId!: number;

  @Column({ name: 'qnair_id', type: 'integer', nullable: false })
  QnairId!: number;

  @Column({ name: 'question_id', type: 'integer', nullable: false })
  QuestionId!: number;

  @Column({ name: 'answer', type: 'text', nullable: true })
  Answer!: string | null;

  @Column({ name: 'created_on', type: 'timestamp', nullable: true })
  CreatedOn!: string | null;

  @Column({ name: 'created_by', type: 'integer', nullable: true })
  CreatedBy!: number | null;

  @Column({ name: 'modified_on', type: 'timestamp', nullable: true })
  ModifiedOn!: string | null;

  @Column({ name: 'modified_by', type: 'integer', nullable: true })
  ModifiedBy!: number | null;

  @Column({ name: 'is_active', type: 'boolean', nullable: true })
  IsActive!: boolean | null;

}
