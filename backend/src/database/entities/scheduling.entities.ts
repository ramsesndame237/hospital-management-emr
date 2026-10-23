/* GÉNÉRÉ par tools/generate-entities.mjs depuis migration/inventory/entities.json : ne pas modifier à la main. */
import { Column, Entity, PrimaryColumn, PrimaryGeneratedColumn } from 'typeorm';


@Entity({ name: 'sch_emp_day_wise_availability' })
export class EmpDayWiseAvailability {
  @PrimaryGeneratedColumn({ name: 'employee_id' })
  EmployeeId!: number;

  @Column({ name: 'day_id', type: 'integer', nullable: false })
  DayId!: number;

  @Column({ name: 'day_name', type: 'text', nullable: true })
  DayName!: string | null;

  @Column({ name: 'is_working', type: 'boolean', nullable: true })
  IsWorking!: boolean | null;

}

@Entity({ name: 'sch_employee_schedules' })
export class EmpSchedules {
  @PrimaryGeneratedColumn({ name: 'employee_sch_id' })
  EmployeeSCHId!: number;

  @Column({ name: 'employee_id', type: 'integer', nullable: false })
  EmployeeId!: number;

  @Column({ name: 'date', type: 'timestamp', nullable: true })
  Date!: string | null;

  @Column({ name: 'day_name', type: 'text', nullable: true })
  DayName!: string | null;

  @Column({ name: 'is_working_day', type: 'boolean', nullable: true })
  IsWorkingDay!: boolean | null;

  @Column({ name: 'is_present', type: 'boolean', nullable: true })
  IsPresent!: boolean | null;

}

@Entity({ name: 'sch_employee_shifts' })
export class EmployeeShifts {
  @PrimaryGeneratedColumn({ name: 'emp_shift_id' })
  EmpShiftId!: number;

  @Column({ name: 'employee_id', type: 'integer', nullable: false })
  EmployeeId!: number;

  @Column({ name: 'shift_name', type: 'text', nullable: true })
  ShiftName!: string | null;

  @Column({ name: 'start_time', type: 'interval', nullable: false })
  StartTime!: string;

  @Column({ name: 'end_time', type: 'interval', nullable: false })
  EndTime!: string;

}

@Entity({ name: 'sch_map_employee_shift' })
export class EmployeeShiftMap {
  @PrimaryGeneratedColumn({ name: 'employee_shift_map_id' })
  EmployeeShiftMapId!: number;

  @Column({ name: 'employee_id', type: 'integer', nullable: false })
  EmployeeId!: number;

  @Column({ name: 'shift_id', type: 'integer', nullable: false })
  ShiftId!: number;

  @Column({ name: 'created_by', type: 'integer', nullable: true })
  CreatedBy!: number | null;

  @Column({ name: 'created_on', type: 'timestamp', nullable: true })
  CreatedOn!: string | null;

  @Column({ name: 'modified_by', type: 'integer', nullable: true })
  ModifiedBy!: number | null;

  @Column({ name: 'modified_on', type: 'timestamp', nullable: true })
  ModifiedOn!: string | null;

  @Column({ name: 'is_active', type: 'boolean', nullable: false })
  IsActive!: boolean;

}

@Entity({ name: 'sch_mst_shifts' })
export class ShiftsMasterModel {
  @PrimaryGeneratedColumn({ name: 'shift_id' })
  ShiftId!: number;

  @Column({ name: 'shift_name', type: 'text', nullable: true })
  ShiftName!: string | null;

  @Column({ name: 'start_time', type: 'interval', nullable: false })
  StartTime!: string;

  @Column({ name: 'end_time', type: 'interval', nullable: false })
  EndTime!: string;

  @Column({ name: 'created_by', type: 'integer', nullable: true })
  CreatedBy!: number | null;

  @Column({ name: 'created_on', type: 'timestamp', nullable: true })
  CreatedOn!: string | null;

  @Column({ name: 'modified_by', type: 'integer', nullable: true })
  ModifiedBy!: number | null;

  @Column({ name: 'modified_on', type: 'timestamp', nullable: true })
  ModifiedOn!: string | null;

  @Column({ name: 'total_hrs', type: 'double precision', nullable: true })
  TotalHrs!: number | null;

  @Column({ name: 'is_default', type: 'boolean', nullable: false })
  IsDefault!: boolean;

}
