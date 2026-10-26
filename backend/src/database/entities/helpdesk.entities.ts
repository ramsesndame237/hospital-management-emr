/* GÉNÉRÉ par tools/generate-entities.mjs depuis migration/inventory/entities.json : ne pas modifier à la main. */
import { Column, Entity, PrimaryColumn, PrimaryGeneratedColumn } from 'typeorm';


@Entity({ name: 'bed_information_model' })
export class BedInformationModel {
  @PrimaryGeneratedColumn({ name: 'bed_number' })
  BedNumber!: number;

  @Column({ name: 'bed_price', type: 'double precision', nullable: true })
  BedPrice!: number | null;

  @Column({ name: 'bed_feature_name', type: 'text', nullable: true })
  BedFeatureName!: string | null;

  @Column({ name: 'is_occupied', type: 'boolean', nullable: false })
  IsOccupied!: boolean;

  @Column({ name: 'ward_name', type: 'text', nullable: true })
  WardName!: string | null;

}

@Entity({ name: 'employee_info_model' })
export class EmployeeInfoModel {
  @PrimaryColumn({ name: 'employee_name', type: 'text' })
  EmployeeName!: string;

  @Column({ name: 'designation', type: 'text', nullable: true })
  Designation!: string | null;

  @Column({ name: 'department_name', type: 'text', nullable: true })
  DepartmentName!: string | null;

  @Column({ name: 'contact_number', type: 'text', nullable: true })
  ContactNumber!: string | null;

  @Column({ name: 'extension', type: 'smallint', nullable: true })
  Extension!: number | null;

  @Column({ name: 'speed_dial', type: 'smallint', nullable: true })
  SpeedDial!: number | null;

  @Column({ name: 'office_hour', type: 'text', nullable: true })
  OfficeHour!: string | null;

  @Column({ name: 'room_number', type: 'text', nullable: true })
  RoomNumber!: string | null;

}

@Entity({ name: 'ward_information_model' })
export class WardInformationModel {
  @PrimaryGeneratedColumn({ name: 'ward_id' })
  WardId!: number;

  @Column({ name: 'ward_name', type: 'text', nullable: true })
  WardName!: string | null;

  @Column({ name: 'total', type: 'integer', nullable: false })
  Total!: number;

  @Column({ name: 'vacant', type: 'integer', nullable: false })
  Vacant!: number;

  @Column({ name: 'occupied', type: 'integer', nullable: false })
  Occupied!: number;

  @Column({ name: 'reserved', type: 'integer', nullable: false })
  Reserved!: number;

}
