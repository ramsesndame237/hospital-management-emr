/* GÉNÉRÉ par tools/generate-entities.mjs depuis migration/inventory/entities.json : ne pas modifier à la main. */
import { Column, Entity, PrimaryColumn, PrimaryGeneratedColumn } from 'typeorm';
import { NUM } from '../transformers';

@Entity({ name: 'ins_insurance_balance_amount_history' })
export class InsuranceBalanceHistoryModel {
  @PrimaryGeneratedColumn({ name: 'history_id' })
  HistoryId!: number;

  @Column({ name: 'patient_id', type: 'integer', nullable: true })
  PatientId!: number | null;

  @Column({ name: 'previous_amount', type: 'numeric', nullable: true, transformer: NUM })
  PreviousAmount!: number | null;

  @Column({ name: 'updated_amount', type: 'numeric', nullable: true, transformer: NUM })
  UpdatedAmount!: number | null;

  @Column({ name: 'remark', type: 'text', nullable: true })
  Remark!: string | null;

  @Column({ name: 'created_by', type: 'integer', nullable: true })
  CreatedBy!: number | null;

  @Column({ name: 'created_on', type: 'timestamp', nullable: true })
  CreatedOn!: string | null;

}
