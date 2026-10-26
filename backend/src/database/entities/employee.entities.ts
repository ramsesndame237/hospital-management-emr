/* GÉNÉRÉ par tools/generate-entities.mjs depuis migration/inventory/entities.json : ne pas modifier à la main. */
import { Column, Entity, PrimaryColumn, PrimaryGeneratedColumn } from 'typeorm';


@Entity({ name: 'emp_employee' })
export class EmployeeModel {
  @PrimaryGeneratedColumn({ name: 'employee_id' })
  EmployeeId!: number;

  @Column({ name: 'first_name', type: 'text', nullable: true })
  FirstName!: string | null;

  @Column({ name: 'middle_name', type: 'text', nullable: true })
  MiddleName!: string | null;

  @Column({ name: 'last_name', type: 'text', nullable: true })
  LastName!: string | null;

  @Column({ name: 'image_full_path', type: 'text', nullable: true })
  ImageFullPath!: string | null;

  @Column({ name: 'image_name', type: 'text', nullable: true })
  ImageName!: string | null;

  @Column({ name: 'date_of_birth', type: 'timestamp', nullable: true })
  DateOfBirth!: string | null;

  @Column({ name: 'date_of_joining', type: 'timestamp', nullable: true })
  DateOfJoining!: string | null;

  @Column({ name: 'contact_number', type: 'text', nullable: true })
  ContactNumber!: string | null;

  @Column({ name: 'email', type: 'text', nullable: true })
  Email!: string | null;

  @Column({ name: 'contact_address', type: 'text', nullable: true })
  ContactAddress!: string | null;

  @Column({ name: 'is_active', type: 'boolean', nullable: false })
  IsActive!: boolean;

  @Column({ name: 'salutation', type: 'text', nullable: true })
  Salutation!: string | null;

  @Column({ name: 'department_id', type: 'integer', nullable: true })
  DepartmentId!: number | null;

  @Column({ name: 'employee_role_id', type: 'integer', nullable: true })
  EmployeeRoleId!: number | null;

  @Column({ name: 'employee_type_id', type: 'integer', nullable: true })
  EmployeeTypeId!: number | null;

  @Column({ name: 'created_by', type: 'integer', nullable: true })
  CreatedBy!: number | null;

  @Column({ name: 'created_on', type: 'timestamp', nullable: true })
  CreatedOn!: string | null;

  @Column({ name: 'modified_by', type: 'integer', nullable: true })
  ModifiedBy!: number | null;

  @Column({ name: 'modified_on', type: 'timestamp', nullable: true })
  ModifiedOn!: string | null;

  @Column({ name: 'gender', type: 'text', nullable: true })
  Gender!: string | null;

  @Column({ name: 'full_name', type: 'text', nullable: true })
  FullName!: string | null;

  @Column({ name: 'extension', type: 'smallint', nullable: true })
  Extension!: number | null;

  @Column({ name: 'speed_dial', type: 'smallint', nullable: true })
  SpeedDial!: number | null;

  @Column({ name: 'office_hour', type: 'text', nullable: true })
  OfficeHour!: string | null;

  @Column({ name: 'room_no', type: 'text', nullable: true })
  RoomNo!: string | null;

  @Column({ name: 'med_certification_no', type: 'text', nullable: true })
  MedCertificationNo!: string | null;

  @Column({ name: 'signature', type: 'text', nullable: true })
  Signature!: string | null;

  @Column({ name: 'long_signature', type: 'text', nullable: true })
  LongSignature!: string | null;

  @Column({ name: 'is_appointment_applicable', type: 'boolean', nullable: true })
  IsAppointmentApplicable!: boolean | null;

  @Column({ name: 'lab_signature', type: 'text', nullable: true })
  LabSignature!: string | null;

  @Column({ name: 'radiology_signature', type: 'text', nullable: true })
  RadiologySignature!: string | null;

  @Column({ name: 'blood_group', type: 'text', nullable: true })
  BloodGroup!: string | null;

  @Column({ name: 'driver_license_no', type: 'text', nullable: true })
  DriverLicenseNo!: string | null;

  @Column({ name: 'nursing_certification_no', type: 'text', nullable: true })
  NursingCertificationNo!: string | null;

  @Column({ name: 'health_professional_certification_no', type: 'text', nullable: true })
  HealthProfessionalCertificationNo!: string | null;

  @Column({ name: 'display_sequence', type: 'integer', nullable: true })
  DisplaySequence!: number | null;

  @Column({ name: 'signatory_image_name', type: 'text', nullable: true })
  SignatoryImageName!: string | null;

  @Column({ name: 'is_external', type: 'boolean', nullable: false })
  IsExternal!: boolean;

  @Column({ name: 'tds_percent', type: 'double precision', nullable: true })
  TDSPercent!: number | null;

  @Column({ name: 'is_incentive_applicable', type: 'boolean', nullable: true })
  IsIncentiveApplicable!: boolean | null;

  @Column({ name: 'pan_number', type: 'text', nullable: true })
  PANNumber!: string | null;

  @Column({ name: 'opd_new_patient_service_item_id', type: 'integer', nullable: true })
  OpdNewPatientServiceItemId!: number | null;

  @Column({ name: 'opd_old_patient_service_item_id', type: 'integer', nullable: true })
  OpdOldPatientServiceItemId!: number | null;

  @Column({ name: 'followup_service_item_id', type: 'integer', nullable: true })
  FollowupServiceItemId!: number | null;

  @Column({ name: 'internal_referral_service_item_id', type: 'integer', nullable: true })
  InternalReferralServiceItemId!: number | null;

}

@Entity({ name: 'emp_employee_preferences' })
export class EmployeePreferences {
  @PrimaryGeneratedColumn({ name: 'preference_id' })
  PreferenceId!: number;

  @Column({ name: 'preference_name', type: 'text', nullable: true })
  PreferenceName!: string | null;

  @Column({ name: 'preference_value', type: 'text', nullable: true })
  PreferenceValue!: string | null;

  @Column({ name: 'employee_id', type: 'integer', nullable: false })
  EmployeeId!: number;

  @Column({ name: 'created_by', type: 'integer', nullable: false })
  CreatedBy!: number;

  @Column({ name: 'created_on', type: 'timestamp', nullable: true })
  CreatedOn!: string | null;

  @Column({ name: 'modified_by', type: 'integer', nullable: true })
  ModifiedBy!: number | null;

  @Column({ name: 'modified_on', type: 'timestamp', nullable: true })
  ModifiedOn!: string | null;

  @Column({ name: 'is_active', type: 'boolean', nullable: false })
  IsActive!: boolean;

}

@Entity({ name: 'emp_employee_role' })
export class EmployeeRoleModel {
  @PrimaryGeneratedColumn({ name: 'employee_role_id' })
  EmployeeRoleId!: number;

  @Column({ name: 'employee_role_name', type: 'text', nullable: true })
  EmployeeRoleName!: string | null;

  @Column({ name: 'description', type: 'text', nullable: true })
  Description!: string | null;

  @Column({ name: 'created_by', type: 'integer', nullable: false })
  CreatedBy!: number;

  @Column({ name: 'created_on', type: 'timestamp', nullable: false })
  CreatedOn!: string;

  @Column({ name: 'modified_by', type: 'integer', nullable: true })
  ModifiedBy!: number | null;

  @Column({ name: 'modified_on', type: 'timestamp', nullable: true })
  ModifiedOn!: string | null;

  @Column({ name: 'is_active', type: 'boolean', nullable: true })
  IsActive!: boolean | null;

}

@Entity({ name: 'emp_employee_type' })
export class EmployeeTypeModel {
  @PrimaryGeneratedColumn({ name: 'employee_type_id' })
  EmployeeTypeId!: number;

  @Column({ name: 'employee_type_name', type: 'text', nullable: true })
  EmployeeTypeName!: string | null;

  @Column({ name: 'description', type: 'text', nullable: true })
  Description!: string | null;

  @Column({ name: 'created_by', type: 'integer', nullable: false })
  CreatedBy!: number;

  @Column({ name: 'created_on', type: 'timestamp', nullable: false })
  CreatedOn!: string;

  @Column({ name: 'modified_by', type: 'integer', nullable: true })
  ModifiedBy!: number | null;

  @Column({ name: 'modified_on', type: 'timestamp', nullable: true })
  ModifiedOn!: string | null;

  @Column({ name: 'is_active', type: 'boolean', nullable: true })
  IsActive!: boolean | null;

}
