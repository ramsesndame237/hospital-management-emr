/* GÉNÉRÉ par tools/generate-entities.mjs depuis migration/inventory/entities.json : ne pas modifier à la main. */
import { Column, Entity, PrimaryColumn, PrimaryGeneratedColumn } from 'typeorm';
import { NUM } from '../transformers';

@Entity({ name: 'frc_designation' })
export class DesignationModel {
  @PrimaryGeneratedColumn({ name: 'designation_id' })
  DesignationId!: number;

  @Column({ name: 'designation_name', type: 'text', nullable: true })
  DesignationName!: string | null;

  @Column({ name: 'created_by', type: 'integer', nullable: true })
  CreatedBy!: number | null;

  @Column({ name: 'created_on', type: 'timestamp', nullable: true })
  CreatedOn!: string | null;

  @Column({ name: 'description', type: 'text', nullable: true })
  Description!: string | null;

}

@Entity({ name: 'frc_fraction_calculation' })
export class FractionCalculationModel {
  @PrimaryGeneratedColumn({ name: 'fraction_calculation_id' })
  FractionCalculationId!: number;

  @Column({ name: 'percent_setting_id', type: 'integer', nullable: false })
  PercentSettingId!: number;

  @Column({ name: 'bill_txn_item_id', type: 'integer', nullable: false })
  BillTxnItemId!: number;

  @Column({ name: 'doctor_id', type: 'integer', nullable: false })
  DoctorId!: number;

  @Column({ name: 'is_parent_id', type: 'integer', nullable: false })
  IsParentId!: number;

  @Column({ name: 'designation_id', type: 'integer', nullable: false })
  DesignationId!: number;

  @Column({ name: 'initial_percent', type: 'numeric', nullable: true, transformer: NUM })
  InitialPercent!: number | null;

  @Column({ name: 'final_percent', type: 'numeric', nullable: true, transformer: NUM })
  FinalPercent!: number | null;

  @Column({ name: 'created_by', type: 'integer', nullable: false })
  CreatedBy!: number;

  @Column({ name: 'final_amount', type: 'numeric', nullable: true, transformer: NUM })
  FinalAmount!: number | null;

  @Column({ name: 'created_on', type: 'timestamp', nullable: true })
  CreatedOn!: string | null;

  @Column({ name: 'is_active', type: 'integer', nullable: false })
  IsActive!: number;

  @Column({ name: 'hierarchy', type: 'integer', nullable: false })
  Hierarchy!: number;

}

@Entity({ name: 'frc_percent_setting' })
export class FractionPercentModel {
  @PrimaryGeneratedColumn({ name: 'percent_setting_id' })
  PercentSettingId!: number;

  @Column({ name: 'bill_item_price_id', type: 'integer', nullable: false })
  BillItemPriceId!: number;

  @Column({ name: 'hospital_percent', type: 'numeric', nullable: false, transformer: NUM })
  HospitalPercent!: number;

  @Column({ name: 'doctor_percent', type: 'numeric', nullable: false, transformer: NUM })
  DoctorPercent!: number;

  @Column({ name: 'description', type: 'text', nullable: true })
  Description!: string | null;

  @Column({ name: 'created_on', type: 'timestamp', nullable: true })
  CreatedOn!: string | null;

  @Column({ name: 'created_by', type: 'integer', nullable: false })
  CreatedBy!: number;

}
