/* GÉNÉRÉ par tools/generate-entities.mjs depuis migration/inventory/entities.json : ne pas modifier à la main. */
import { Column, Entity, PrimaryColumn, PrimaryGeneratedColumn } from 'typeorm';


@Entity({ name: 'lab_lis_component_map' })
export class LISComponentMapModel {
  @PrimaryGeneratedColumn({ name: 'lis_component_map_id' })
  LISComponentMapId!: number;

  @Column({ name: 'lis_component_id', type: 'integer', nullable: false })
  LISComponentId!: number;

  @Column({ name: 'component_id', type: 'integer', nullable: false })
  ComponentId!: number;

  @Column({ name: 'machine_id', type: 'integer', nullable: false })
  MachineId!: number;

  @Column({ name: 'is_active', type: 'boolean', nullable: false })
  IsActive!: boolean;

  @Column({ name: 'conversion_factor', type: 'integer', nullable: false })
  ConversionFactor!: number;

  @Column({ name: 'created_by', type: 'integer', nullable: false })
  CreatedBy!: number;

  @Column({ name: 'modified_by', type: 'integer', nullable: true })
  ModifiedBy!: number | null;

  @Column({ name: 'created_on', type: 'timestamp', nullable: false })
  CreatedOn!: string;

  @Column({ name: 'modified_on', type: 'timestamp', nullable: true })
  ModifiedOn!: string | null;

}
