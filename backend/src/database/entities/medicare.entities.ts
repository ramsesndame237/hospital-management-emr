/* GÉNÉRÉ par tools/generate-entities.mjs depuis migration/inventory/entities.json : ne pas modifier à la main. */
import { Column, Entity, PrimaryColumn, PrimaryGeneratedColumn } from 'typeorm';
import { NUM } from '../transformers';

@Entity({ name: 'ins_medicare_member' })
export class MedicareMember {
  @PrimaryGeneratedColumn({ name: 'medicare_member_id' })
  MedicareMemberId!: number;

  @Column({ name: 'medicare_type_id', type: 'integer', nullable: false })
  MedicareTypeId!: number;

  @Column({ name: 'full_name', type: 'text', nullable: true })
  FullName!: string | null;

  @Column({ name: 'medicare_institute_code', type: 'text', nullable: true })
  MedicareInstituteCode!: string | null;

  @Column({ name: 'member_no', type: 'text', nullable: true })
  MemberNo!: string | null;

  @Column({ name: 'hospital_no', type: 'text', nullable: true })
  HospitalNo!: string | null;

  @Column({ name: 'patient_id', type: 'integer', nullable: false })
  PatientId!: number;

  @Column({ name: 'is_dependent', type: 'boolean', nullable: false })
  IsDependent!: boolean;

  @Column({ name: 'parent_medicare_member_id', type: 'integer', nullable: true })
  ParentMedicareMemberId!: number | null;

  @Column({ name: 'relation', type: 'text', nullable: true })
  Relation!: string | null;

  @Column({ name: 'medicare_start_date', type: 'timestamp', nullable: false })
  MedicareStartDate!: string;

  @Column({ name: 'insurance_provider_id', type: 'integer', nullable: false })
  InsuranceProviderId!: number;

  @Column({ name: 'insurance_policy_no', type: 'text', nullable: true })
  InsurancePolicyNo!: string | null;

  @Column({ name: 'designation_id', type: 'integer', nullable: false })
  DesignationId!: number;

  @Column({ name: 'department_id', type: 'integer', nullable: false })
  DepartmentId!: number;

  @Column({ name: 'date_of_birth', type: 'timestamp', nullable: false })
  DateOfBirth!: string;

  @Column({ name: 'in_active_date', type: 'timestamp', nullable: true })
  InActiveDate!: string | null;

  @Column({ name: 'is_op_limit_exceeded', type: 'boolean', nullable: false })
  IsOpLimitExceeded!: boolean;

  @Column({ name: 'is_ip_limit_exceeded', type: 'boolean', nullable: false })
  IsIpLimitExceeded!: boolean;

  @Column({ name: 'is_active', type: 'boolean', nullable: false })
  IsActive!: boolean;

  @Column({ name: 'created_on', type: 'timestamp', nullable: false })
  CreatedOn!: string;

  @Column({ name: 'created_by', type: 'integer', nullable: false })
  CreatedBy!: number;

  @Column({ name: 'modified_on', type: 'timestamp', nullable: true })
  ModifiedOn!: string | null;

  @Column({ name: 'modified_by', type: 'integer', nullable: true })
  ModifiedBy!: number | null;

  @Column({ name: 'remarks', type: 'text', nullable: true })
  Remarks!: string | null;

}

@Entity({ name: 'ins_medicare_member_balance' })
export class MedicareMemberBalance {
  @PrimaryGeneratedColumn({ name: 'medicare_member_balance_id' })
  MedicareMemberBalanceId!: number;

  @Column({ name: 'medicare_member_id', type: 'integer', nullable: false })
  MedicareMemberId!: number;

  @Column({ name: 'op_balance', type: 'numeric', nullable: false, transformer: NUM })
  OpBalance!: number;

  @Column({ name: 'ip_balance', type: 'numeric', nullable: false, transformer: NUM })
  IpBalance!: number;

  @Column({ name: 'op_used_amount', type: 'numeric', nullable: false, transformer: NUM })
  OpUsedAmount!: number;

  @Column({ name: 'ip_used_amount', type: 'numeric', nullable: false, transformer: NUM })
  IpUsedAmount!: number;

  @Column({ name: 'hospital_no', type: 'text', nullable: true })
  HospitalNo!: string | null;

  @Column({ name: 'patient_id', type: 'integer', nullable: false })
  PatientId!: number;

  @Column({ name: 'created_on', type: 'timestamp', nullable: false })
  CreatedOn!: string;

  @Column({ name: 'created_by', type: 'integer', nullable: false })
  CreatedBy!: number;

  @Column({ name: 'modified_on', type: 'timestamp', nullable: true })
  ModifiedOn!: string | null;

  @Column({ name: 'modified_by', type: 'integer', nullable: true })
  ModifiedBy!: number | null;

}

@Entity({ name: 'ins_mst_medicare_institute' })
export class MedicareInstitutes {
  @PrimaryGeneratedColumn({ name: 'medicare_institute_id' })
  MedicareInstituteId!: number;

  @Column({ name: 'medicare_institute_code', type: 'text', nullable: true })
  MedicareInstituteCode!: string | null;

  @Column({ name: 'institute_name', type: 'text', nullable: true })
  InstituteName!: string | null;

  @Column({ name: 'is_active', type: 'boolean', nullable: false })
  IsActive!: boolean;

  @Column({ name: 'created_on', type: 'timestamp', nullable: false })
  CreatedOn!: string;

  @Column({ name: 'created_by', type: 'integer', nullable: false })
  CreatedBy!: number;

  @Column({ name: 'modified_on', type: 'timestamp', nullable: true })
  ModifiedOn!: string | null;

  @Column({ name: 'modified_by', type: 'integer', nullable: true })
  ModifiedBy!: number | null;

}

@Entity({ name: 'ins_mst_medicare_type' })
export class MedicareTypes {
  @PrimaryGeneratedColumn({ name: 'medicare_type_id' })
  MedicareTypeId!: number;

  @Column({ name: 'ledger_id', type: 'integer', nullable: true })
  LedgerId!: number | null;

  @Column({ name: 'medicare_type_name', type: 'text', nullable: true })
  MedicareTypeName!: string | null;

  @Column({ name: 'op_credit_amount', type: 'numeric', nullable: false, transformer: NUM })
  OpCreditAmount!: number;

  @Column({ name: 'ip_credit_amount', type: 'numeric', nullable: false, transformer: NUM })
  IpCreditAmount!: number;

  @Column({ name: 'is_active', type: 'boolean', nullable: false })
  IsActive!: boolean;

  @Column({ name: 'created_on', type: 'timestamp', nullable: false })
  CreatedOn!: string;

  @Column({ name: 'created_by', type: 'integer', nullable: false })
  CreatedBy!: number;

  @Column({ name: 'modified_on', type: 'timestamp', nullable: true })
  ModifiedOn!: string | null;

  @Column({ name: 'modified_by', type: 'integer', nullable: true })
  ModifiedBy!: number | null;

}
