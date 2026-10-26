/* GÉNÉRÉ par tools/generate-entities.mjs depuis migration/inventory/entities.json : ne pas modifier à la main. */
import { Column, Entity, PrimaryColumn, PrimaryGeneratedColumn } from 'typeorm';
import { NUM } from '../transformers';

@Entity({ name: 'mkt_cfg_referring_party' })
export class ReferringPartyModel {
  @PrimaryGeneratedColumn({ name: 'referring_party_id' })
  ReferringPartyId!: number;

  @Column({ name: 'referring_party_name', type: 'text', nullable: true })
  ReferringPartyName!: string | null;

  @Column({ name: 'referring_party_group_id', type: 'integer', nullable: false })
  ReferringPartyGroupId!: number;

  @Column({ name: 'referring_org_id', type: 'integer', nullable: false })
  ReferringOrgId!: number;

  @Column({ name: 'address', type: 'text', nullable: true })
  Address!: string | null;

  @Column({ name: 'vehicle_number', type: 'text', nullable: true })
  VehicleNumber!: string | null;

  @Column({ name: 'contact_number', type: 'text', nullable: true })
  ContactNumber!: string | null;

  @Column({ name: 'area_code', type: 'text', nullable: true })
  AreaCode!: string | null;

  @Column({ name: 'pan_number', type: 'text', nullable: true })
  PANNumber!: string | null;

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

@Entity({ name: 'mkt_mst_referral_scheme' })
export class ReferralSchemeModel {
  @PrimaryGeneratedColumn({ name: 'referral_scheme_id' })
  ReferralSchemeId!: number;

  @Column({ name: 'referral_scheme_name', type: 'text', nullable: true })
  ReferralSchemeName!: string | null;

  @Column({ name: 'description', type: 'text', nullable: true })
  Description!: string | null;

  @Column({ name: 'referral_percentage', type: 'numeric', nullable: false, transformer: NUM })
  ReferralPercentage!: number;

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

@Entity({ name: 'mkt_mst_referring_organization' })
export class ReferringOrganizationModel {
  @PrimaryGeneratedColumn({ name: 'referring_organization_id' })
  ReferringOrganizationId!: number;

  @Column({ name: 'referring_organization_name', type: 'text', nullable: true })
  ReferringOrganizationName!: string | null;

  @Column({ name: 'address', type: 'text', nullable: true })
  Address!: string | null;

  @Column({ name: 'contact_no', type: 'text', nullable: true })
  ContactNo!: string | null;

  @Column({ name: 'contact_persons', type: 'text', nullable: true })
  ContactPersons!: string | null;

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

@Entity({ name: 'mkt_mst_referring_party_group' })
export class ReferringPartyGroupModel {
  @PrimaryGeneratedColumn({ name: 'referring_party_group_id' })
  ReferringPartyGroupId!: number;

  @Column({ name: 'group_name', type: 'text', nullable: true })
  GroupName!: string | null;

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

  @Column({ name: 'is_active', type: 'boolean', nullable: false })
  IsActive!: boolean;

}

@Entity({ name: 'mkt_txn_referral_commission' })
export class ReferralComissionModel {
  @PrimaryGeneratedColumn({ name: 'referral_commission_id' })
  ReferralCommissionId!: number;

  @Column({ name: 'fiscal_year_id', type: 'integer', nullable: false })
  FiscalYearId!: number;

  @Column({ name: 'billing_transaction_id', type: 'integer', nullable: false })
  BillingTransactionId!: number;

  @Column({ name: 'invoice_no_formatted', type: 'text', nullable: true })
  InvoiceNoFormatted!: string | null;

  @Column({ name: 'invoice_date', type: 'timestamp', nullable: false })
  InvoiceDate!: string;

  @Column({ name: 'patient_id', type: 'integer', nullable: false })
  PatientId!: number;

  @Column({ name: 'patient_visit_id', type: 'integer', nullable: false })
  PatientVisitId!: number;

  @Column({ name: 'referring_party_id', type: 'integer', nullable: false })
  ReferringPartyId!: number;

  @Column({ name: 'referral_scheme_id', type: 'integer', nullable: false })
  ReferralSchemeId!: number;

  @Column({ name: 'invoice_total_amount', type: 'numeric', nullable: false, transformer: NUM })
  InvoiceTotalAmount!: number;

  @Column({ name: 'return_amount', type: 'numeric', nullable: false, transformer: NUM })
  ReturnAmount!: number;

  @Column({ name: 'invoice_net_amount', type: 'numeric', nullable: false, transformer: NUM })
  InvoiceNetAmount!: number;

  @Column({ name: 'percentage', type: 'numeric', nullable: false, transformer: NUM })
  Percentage!: number;

  @Column({ name: 'referral_amount', type: 'numeric', nullable: false, transformer: NUM })
  ReferralAmount!: number;

  @Column({ name: 'remarks', type: 'text', nullable: true })
  Remarks!: string | null;

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
