/* GÉNÉRÉ par tools/generate-entities.mjs depuis migration/inventory/entities.json : ne pas modifier à la main. */
import { Column, Entity, PrimaryColumn, PrimaryGeneratedColumn } from 'typeorm';
import { NUM } from '../transformers';

@Entity({ name: 'proll_attendance_daily_time_record' })
export class AttendanceDailyTimeRecord {
  @PrimaryGeneratedColumn({ name: 'id' })
  ID!: number;

  @Column({ name: 'employee_id', type: 'integer', nullable: false })
  EmployeeId!: number;

  @Column({ name: 'employee_name', type: 'text', nullable: true })
  EmployeeName!: string | null;

  @Column({ name: 'record_date_time', type: 'text', nullable: true })
  RecordDateTime!: string | null;

}

@Entity({ name: 'proll_daily_muster' })
export class DailyMuster {
  @PrimaryGeneratedColumn({ name: 'daily_muster_id', type: 'bigint' })
  DailyMusterId!: number;

  @Column({ name: 'employee_id', type: 'bigint', nullable: false, transformer: NUM })
  EmployeeId!: number;

  @Column({ name: 'present', type: 'boolean', nullable: false })
  Present!: boolean;

  @Column({ name: 'att_status', type: 'text', nullable: true })
  AttStatus!: string | null;

  @Column({ name: 'color_code', type: 'text', nullable: true })
  ColorCode!: string | null;

  @Column({ name: 'time_in', type: 'interval', nullable: true })
  TimeIn!: string | null;

  @Column({ name: 'time_out', type: 'interval', nullable: true })
  TimeOut!: string | null;

  @Column({ name: 'day', type: 'integer', nullable: false })
  Day!: number;

  @Column({ name: 'month', type: 'integer', nullable: false })
  Month!: number;

  @Column({ name: 'year', type: 'bigint', nullable: false, transformer: NUM })
  Year!: number;

  @Column({ name: 'hours_in_day', type: 'numeric', nullable: true, transformer: NUM })
  HoursInDay!: number | null;

}

@Entity({ name: 'proll_emp_leave' })
export class EmployeeLeaveModel {
  @PrimaryGeneratedColumn({ name: 'emp_leave_id' })
  EmpLeaveId!: number;

  @Column({ name: 'leave_rule_id', type: 'integer', nullable: false })
  LeaveRuleId!: number;

  @Column({ name: 'employee_id', type: 'integer', nullable: false })
  EmployeeId!: number;

  @Column({ name: 'date', type: 'timestamp', nullable: false })
  Date!: string;

  @Column({ name: 'created_on', type: 'timestamp', nullable: false })
  CreatedOn!: string;

  @Column({ name: 'created_by', type: 'integer', nullable: false })
  CreatedBy!: number;

  @Column({ name: 'requested_to', type: 'integer', nullable: false })
  RequestedTo!: number;

  @Column({ name: 'approved_by', type: 'integer', nullable: true })
  ApprovedBy!: number | null;

  @Column({ name: 'approved_on', type: 'timestamp', nullable: true })
  ApprovedOn!: string | null;

  @Column({ name: 'cancelled_on', type: 'timestamp', nullable: true })
  CancelledOn!: string | null;

  @Column({ name: 'cancelled_by', type: 'integer', nullable: true })
  CancelledBy!: number | null;

  @Column({ name: 'leave_status', type: 'text', nullable: true })
  LeaveStatus!: string | null;

}

@Entity({ name: 'proll_mst_holidays' })
export class HolidayModel {
  @PrimaryGeneratedColumn({ name: 'holiday_id' })
  HolidayId!: number;

  @Column({ name: 'fiscal_year_id', type: 'integer', nullable: false })
  FiscalYearId!: number;

  @Column({ name: 'title', type: 'text', nullable: true })
  Title!: string | null;

  @Column({ name: 'description', type: 'text', nullable: true })
  Description!: string | null;

  @Column({ name: 'created_by', type: 'integer', nullable: false })
  CreatedBy!: number;

  @Column({ name: 'created_on', type: 'timestamp', nullable: true })
  CreatedOn!: string | null;

  @Column({ name: 'is_active', type: 'boolean', nullable: false })
  IsActive!: boolean;

  @Column({ name: 'approved_by', type: 'integer', nullable: false })
  ApprovedBy!: number;

  @Column({ name: 'date', type: 'timestamp', nullable: true })
  Date!: string | null;

  @Column({ name: 'modified_by', type: 'integer', nullable: false })
  ModifiedBy!: number;

  @Column({ name: 'modified_on', type: 'timestamp', nullable: true })
  ModifiedOn!: string | null;

}

@Entity({ name: 'proll_mst_leave_category' })
export class LeaveCategory {
  @PrimaryGeneratedColumn({ name: 'leave_category_id' })
  LeaveCategoryId!: number;

  @Column({ name: 'leave_category_name', type: 'text', nullable: true })
  LeaveCategoryName!: string | null;

  @Column({ name: 'description', type: 'text', nullable: true })
  Description!: string | null;

  @Column({ name: 'created_by', type: 'integer', nullable: false })
  CreatedBy!: number;

  @Column({ name: 'created_on', type: 'timestamp', nullable: false })
  CreatedOn!: string;

  @Column({ name: 'is_active', type: 'boolean', nullable: false })
  IsActive!: boolean;

  @Column({ name: 'category_code', type: 'text', nullable: true })
  CategoryCode!: string | null;

}

@Entity({ name: 'proll_mst_leave_rules' })
export class LeaveRuleModel {
  @PrimaryGeneratedColumn({ name: 'leave_rule_id' })
  LeaveRuleId!: number;

  @Column({ name: 'leave_category_id', type: 'integer', nullable: true })
  LeaveCategoryId!: number | null;

  @Column({ name: 'year', type: 'integer', nullable: false })
  Year!: number;

  @Column({ name: 'created_by', type: 'integer', nullable: false })
  CreatedBy!: number;

  @Column({ name: 'created_on', type: 'timestamp', nullable: false })
  CreatedOn!: string;

  @Column({ name: 'is_active', type: 'boolean', nullable: false })
  IsActive!: boolean;

  @Column({ name: 'is_approved', type: 'boolean', nullable: false })
  IsApproved!: boolean;

  @Column({ name: 'approved_by', type: 'integer', nullable: true })
  ApprovedBy!: number | null;

  @Column({ name: 'modified_by', type: 'integer', nullable: true })
  ModifiedBy!: number | null;

  @Column({ name: 'modified_on', type: 'timestamp', nullable: true })
  ModifiedOn!: string | null;

  @Column({ name: 'pay_percent', type: 'double precision', nullable: true })
  PayPercent!: number | null;

  @Column({ name: 'days', type: 'integer', nullable: false })
  Days!: number;

}

@Entity({ name: 'proll_mst_weekend_holidays' })
export class WeekendHolidays {
  @PrimaryGeneratedColumn({ name: 'weekend_holiday_id' })
  WeekendHolidayId!: number;

  @Column({ name: 'year', type: 'integer', nullable: false })
  Year!: number;

  @Column({ name: 'day_name', type: 'text', nullable: true })
  DayName!: string | null;

  @Column({ name: 'value', type: 'text', nullable: true })
  Value!: string | null;

  @Column({ name: 'created_by', type: 'integer', nullable: false })
  CreatedBy!: number;

  @Column({ name: 'created_on', type: 'timestamp', nullable: false })
  CreatedOn!: string;

  @Column({ name: 'approved_by', type: 'integer', nullable: false })
  ApprovedBy!: number;

  @Column({ name: 'is_active', type: 'boolean', nullable: true })
  IsActive!: boolean | null;

  @Column({ name: 'modified_by', type: 'integer', nullable: true })
  ModifiedBy!: number | null;

  @Column({ name: 'modified_on', type: 'timestamp', nullable: true })
  ModifiedOn!: string | null;

  @Column({ name: 'description', type: 'text', nullable: true })
  Description!: string | null;

  @Column({ name: 'is_approved', type: 'boolean', nullable: false })
  IsApproved!: boolean;

}
