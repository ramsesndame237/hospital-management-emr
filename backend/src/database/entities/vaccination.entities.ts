/* GÉNÉRÉ par tools/generate-entities.mjs depuis migration/inventory/entities.json : ne pas modifier à la main. */
import { Column, Entity, PrimaryColumn, PrimaryGeneratedColumn } from 'typeorm';


@Entity({ name: 'mst_ethnic_group' })
export class EthnicGroupModel {
  @PrimaryGeneratedColumn({ name: 'ethnic_group_id' })
  EthnicGroupId!: number;

  @Column({ name: 'ethnic_group', type: 'text', nullable: true })
  EthnicGroup!: string | null;

  @Column({ name: 'cast_key_words', type: 'text', nullable: true })
  CastKeyWords!: string | null;

  @Column({ name: 'created_by', type: 'integer', nullable: false })
  CreatedBy!: number;

  @Column({ name: 'created_on', type: 'timestamp', nullable: false })
  CreatedOn!: string;

  @Column({ name: 'is_active', type: 'boolean', nullable: false })
  IsActive!: boolean;

}

@Entity({ name: 'vacc_patient_vaccine_detail' })
export class PatientVaccineDetailModel {
  @PrimaryGeneratedColumn({ name: 'patient_vaccine_id' })
  PatientVaccineId!: number;

  @Column({ name: 'vaccine_id', type: 'integer', nullable: false })
  VaccineId!: number;

  @Column({ name: 'patient_id', type: 'integer', nullable: false })
  PatientId!: number;

  @Column({ name: 'dose_number', type: 'integer', nullable: false })
  DoseNumber!: number;

  @Column({ name: 'created_by', type: 'integer', nullable: false })
  CreatedBy!: number;

  @Column({ name: 'created_on', type: 'timestamp', nullable: false })
  CreatedOn!: string;

  @Column({ name: 'modified_by', type: 'integer', nullable: true })
  ModifiedBy!: number | null;

  @Column({ name: 'modified_on', type: 'timestamp', nullable: true })
  ModifiedOn!: string | null;

  @Column({ name: 'vaccine_date', type: 'timestamp', nullable: false })
  VaccineDate!: string;

  @Column({ name: 'remarks', type: 'text', nullable: true })
  Remarks!: string | null;

}

@Entity({ name: 'vacc_vaccines' })
export class VaccineMasterModel {
  @PrimaryGeneratedColumn({ name: 'vaccine_id' })
  VaccineId!: number;

  @Column({ name: 'vaccine_name', type: 'text', nullable: true })
  VaccineName!: string | null;

  @Column({ name: 'number_of_doses', type: 'integer', nullable: false })
  NumberOfDoses!: number;

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
