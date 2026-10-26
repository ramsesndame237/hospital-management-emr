/* GÉNÉRÉ par tools/generate-entities.mjs depuis migration/inventory/entities.json : ne pas modifier à la main. */
import { Column, Entity, PrimaryColumn, PrimaryGeneratedColumn } from 'typeorm';
import { NUM } from '../transformers';

@Entity({ name: 'ins_cfg_insurance_providers' })
export class InsuranceProviderModel {
  @PrimaryGeneratedColumn({ name: 'insurance_provider_id' })
  InsuranceProviderId!: number;

  @Column({ name: 'insurance_provider_name', type: 'text', nullable: true })
  InsuranceProviderName!: string | null;

  @Column({ name: 'description', type: 'text', nullable: true })
  Description!: string | null;

  @Column({ name: 'created_on', type: 'timestamp', nullable: true })
  CreatedOn!: string | null;

  @Column({ name: 'created_by', type: 'integer', nullable: false })
  CreatedBy!: number;

  @Column({ name: 'modified_by', type: 'integer', nullable: true })
  ModifiedBy!: number | null;

  @Column({ name: 'is_active', type: 'boolean', nullable: false })
  IsActive!: boolean;

}

@Entity({ name: 'pat_health_card_info' })
export class HealthCardInfoModel {
  @PrimaryGeneratedColumn({ name: 'pat_health_card_id' })
  PatHealthCardId!: number;

  @Column({ name: 'patient_id', type: 'integer', nullable: false })
  PatientId!: number;

  @Column({ name: 'info_on_card_json', type: 'text', nullable: true })
  InfoOnCardJSON!: string | null;

  @Column({ name: 'billing_date', type: 'timestamp', nullable: true })
  BillingDate!: string | null;

  @Column({ name: 'created_on', type: 'timestamp', nullable: true })
  CreatedOn!: string | null;

  @Column({ name: 'created_by', type: 'integer', nullable: false })
  CreatedBy!: number;

}

@Entity({ name: 'pat_map_patient_schemes' })
export class PatientSchemeMapModel {
  @PrimaryGeneratedColumn({ name: 'patient_scheme_id' })
  PatientSchemeId!: number;

  @Column({ name: 'patient_id', type: 'integer', nullable: false })
  PatientId!: number;

  @Column({ name: 'patient_code', type: 'text', nullable: true })
  PatientCode!: string | null;

  @Column({ name: 'latest_patient_visit_id', type: 'integer', nullable: false })
  LatestPatientVisitId!: number;

  @Column({ name: 'scheme_id', type: 'integer', nullable: false })
  SchemeId!: number;

  @Column({ name: 'policy_no', type: 'text', nullable: true })
  PolicyNo!: string | null;

  @Column({ name: 'op_credit_limit', type: 'numeric', nullable: false, transformer: NUM })
  OpCreditLimit!: number;

  @Column({ name: 'ip_credit_limit', type: 'numeric', nullable: false, transformer: NUM })
  IpCreditLimit!: number;

  @Column({ name: 'general_credit_limit', type: 'numeric', nullable: false, transformer: NUM })
  GeneralCreditLimit!: number;

  @Column({ name: 'policy_holder_employer_name', type: 'text', nullable: true })
  PolicyHolderEmployerName!: string | null;

  @Column({ name: 'registration_case', type: 'text', nullable: true })
  RegistrationCase!: string | null;

  @Column({ name: 'registration_sub_case', type: 'text', nullable: true })
  RegistrationSubCase!: string | null;

  @Column({ name: 'latest_claim_code', type: 'bigint', nullable: true, transformer: NUM })
  LatestClaimCode!: number | null;

  @Column({ name: 'other_info', type: 'text', nullable: true })
  OtherInfo!: string | null;

  @Column({ name: 'created_on', type: 'timestamp', nullable: false })
  CreatedOn!: string;

  @Column({ name: 'created_by', type: 'integer', nullable: false })
  CreatedBy!: number;

  @Column({ name: 'modified_on', type: 'timestamp', nullable: true })
  ModifiedOn!: string | null;

  @Column({ name: 'modified_by', type: 'integer', nullable: true })
  ModifiedBy!: number | null;

  @Column({ name: 'is_active', type: 'boolean', nullable: false })
  IsActive!: boolean;

  @Column({ name: 'policy_holder_employer_id', type: 'text', nullable: true })
  PolicyHolderEmployerID!: string | null;

  @Column({ name: 'policy_holder_uid', type: 'text', nullable: true })
  PolicyHolderUID!: string | null;

  @Column({ name: 'sub_scheme_id', type: 'integer', nullable: true })
  SubSchemeId!: number | null;

  @Column({ name: 'price_category_id', type: 'integer', nullable: false })
  PriceCategoryId!: number;

}

@Entity({ name: 'pat_neighbourhood_card_detail' })
export class NeighbourhoodCardModel {
  @PrimaryGeneratedColumn({ name: 'neighbourhood_card_id' })
  NeighbourhoodCardId!: number;

  @Column({ name: 'patient_id', type: 'integer', nullable: false })
  PatientId!: number;

  @Column({ name: 'patient_code', type: 'text', nullable: true })
  PatientCode!: string | null;

  @Column({ name: 'created_on', type: 'timestamp', nullable: true })
  CreatedOn!: string | null;

  @Column({ name: 'created_by', type: 'integer', nullable: true })
  CreatedBy!: number | null;

  @Column({ name: 'modified_on', type: 'timestamp', nullable: true })
  ModifiedOn!: string | null;

  @Column({ name: 'modified_by', type: 'integer', nullable: true })
  ModifiedBy!: number | null;

}

@Entity({ name: 'pat_patient' })
export class PatientModel {
  @PrimaryGeneratedColumn({ name: 'patient_id' })
  PatientId!: number;

  @Column({ name: 'patient_no', type: 'integer', nullable: false })
  PatientNo!: number;

  @Column({ name: 'empi', type: 'text', nullable: true })
  EMPI!: string | null;

  @Column({ name: 'salutation', type: 'text', nullable: true })
  Salutation!: string | null;

  @Column({ name: 'first_name', type: 'text', nullable: true })
  FirstName!: string | null;

  @Column({ name: 'last_name', type: 'text', nullable: true })
  LastName!: string | null;

  @Column({ name: 'middle_name', type: 'text', nullable: true })
  MiddleName!: string | null;

  @Column({ name: 'father_name', type: 'text', nullable: true })
  FatherName!: string | null;

  @Column({ name: 'mother_name', type: 'text', nullable: true })
  MotherName!: string | null;

  @Column({ name: 'gender', type: 'text', nullable: true })
  Gender!: string | null;

  @Column({ name: 'age', type: 'text', nullable: true })
  Age!: string | null;

  @Column({ name: 'created_on', type: 'timestamp', nullable: false })
  CreatedOn!: string;

  @Column({ name: 'created_by', type: 'integer', nullable: false })
  CreatedBy!: number;

  @Column({ name: 'modified_by', type: 'integer', nullable: true })
  ModifiedBy!: number | null;

  @Column({ name: 'modified_on', type: 'timestamp', nullable: true })
  ModifiedOn!: string | null;

  @Column({ name: 'date_of_birth', type: 'timestamp', nullable: true })
  DateOfBirth!: string | null;

  @Column({ name: 'previous_last_name', type: 'text', nullable: true })
  PreviousLastName!: string | null;

  @Column({ name: 'marital_status', type: 'text', nullable: true })
  MaritalStatus!: string | null;

  @Column({ name: 'race', type: 'text', nullable: true })
  Race!: string | null;

  @Column({ name: 'phone_number', type: 'text', nullable: true })
  PhoneNumber!: string | null;

  @Column({ name: 'land_line_number', type: 'text', nullable: true })
  LandLineNumber!: string | null;

  @Column({ name: 'passport_number', type: 'text', nullable: true })
  PassportNumber!: string | null;

  @Column({ name: 'email', type: 'text', nullable: true })
  Email!: string | null;

  @Column({ name: 'id_card_type', type: 'text', nullable: true })
  IDCardType!: string | null;

  @Column({ name: 'phone_accepts_text', type: 'boolean', nullable: false })
  PhoneAcceptsText!: boolean;

  @Column({ name: 'id_card_number', type: 'text', nullable: true })
  IDCardNumber!: string | null;

  @Column({ name: 'occupation', type: 'text', nullable: true })
  Occupation!: string | null;

  @Column({ name: 'ethnic_group', type: 'text', nullable: true })
  EthnicGroup!: string | null;

  @Column({ name: 'blood_group', type: 'text', nullable: true })
  BloodGroup!: string | null;

  @Column({ name: 'employer_info', type: 'text', nullable: true })
  EmployerInfo!: string | null;

  @Column({ name: 'country_id', type: 'integer', nullable: false })
  CountryId!: number;

  @Column({ name: 'country_sub_division_id', type: 'integer', nullable: true })
  CountrySubDivisionId!: number | null;

  @Column({ name: 'patient_code', type: 'text', nullable: true })
  PatientCode!: string | null;

  @Column({ name: 'is_active', type: 'boolean', nullable: false })
  IsActive!: boolean;

  @Column({ name: 'is_outdoor_pat', type: 'boolean', nullable: false })
  IsOutdoorPat!: boolean;

  @Column({ name: 'dialysis_code', type: 'integer', nullable: true })
  DialysisCode!: number | null;

  @Column({ name: 'municipality_id', type: 'integer', nullable: true })
  MunicipalityId!: number | null;

  @Column({ name: 'ward_number', type: 'smallint', nullable: true })
  WardNumber!: number | null;

  @Column({ name: 'short_name', type: 'text', nullable: true })
  ShortName!: string | null;

  @Column({ name: 'is_dob_verified', type: 'boolean', nullable: false })
  IsDobVerified!: boolean;

  @Column({ name: 'address', type: 'text', nullable: true })
  Address!: string | null;

  @Column({ name: 'pan_number', type: 'text', nullable: true })
  PANNumber!: string | null;

  @Column({ name: 'patient_name_local', type: 'text', nullable: true })
  PatientNameLocal!: string | null;

  @Column({ name: 'ins_has_insurance', type: 'boolean', nullable: false })
  Ins_HasInsurance!: boolean;

  @Column({ name: 'ins_nshi_number', type: 'text', nullable: true })
  Ins_NshiNumber!: string | null;

  @Column({ name: 'ins_insurance_balance', type: 'double precision', nullable: false })
  Ins_InsuranceBalance!: number;

  @Column({ name: 'ins_latest_claim_code', type: 'bigint', nullable: true, transformer: NUM })
  Ins_LatestClaimCode!: number | null;

  @Column({ name: 'is_ssu_patient', type: 'boolean', nullable: false })
  IsSSUPatient!: boolean;

  @Column({ name: 'ssu_is_active', type: 'boolean', nullable: false })
  SSU_IsActive!: boolean;

  @Column({ name: 'is_vaccination_patient', type: 'boolean', nullable: false })
  IsVaccinationPatient!: boolean;

  @Column({ name: 'is_vaccination_active', type: 'boolean', nullable: false })
  IsVaccinationActive!: boolean;

  @Column({ name: 'vaccination_reg_no', type: 'integer', nullable: true })
  VaccinationRegNo!: number | null;

  @Column({ name: 'vaccination_fiscal_year_id', type: 'integer', nullable: true })
  VaccinationFiscalYearId!: number | null;

  @Column({ name: 'telmed_patient_guid', type: 'text', nullable: true })
  Telmed_Patient_GUID!: string | null;

  @Column({ name: 'posting', type: 'text', nullable: true })
  Posting!: string | null;

  @Column({ name: 'rank', type: 'text', nullable: true })
  Rank!: string | null;

  @Column({ name: 'dependent_id', type: 'text', nullable: true })
  DependentId!: string | null;

}

@Entity({ name: 'pat_patient_address' })
export class AddressModel {
  @PrimaryGeneratedColumn({ name: 'patient_address_id' })
  PatientAddressId!: number;

  @Column({ name: 'patient_id', type: 'integer', nullable: false })
  PatientId!: number;

  @Column({ name: 'address_type', type: 'text', nullable: true })
  AddressType!: string | null;

  @Column({ name: 'street1', type: 'text', nullable: true })
  Street1!: string | null;

  @Column({ name: 'street2', type: 'text', nullable: true })
  Street2!: string | null;

  @Column({ name: 'country_id', type: 'integer', nullable: false })
  CountryId!: number;

  @Column({ name: 'country_sub_division_id', type: 'integer', nullable: true })
  CountrySubDivisionId!: number | null;

  @Column({ name: 'city', type: 'text', nullable: true })
  City!: string | null;

  @Column({ name: 'zip_code', type: 'text', nullable: true })
  ZipCode!: string | null;

}

@Entity({ name: 'pat_patient_files' })
export class PatientFilesModel {
  @PrimaryGeneratedColumn({ name: 'patient_file_id', type: 'bigint' })
  PatientFileId!: number;

  @Column({ name: 'patient_id', type: 'integer', nullable: false })
  PatientId!: number;

  @Column({ name: 'rowguid', type: 'uuid', nullable: false })
  ROWGUID!: string;

  @Column({ name: 'file_type', type: 'text', nullable: true })
  FileType!: string | null;

  @Column({ name: 'title', type: 'text', nullable: true })
  Title!: string | null;

  @Column({ name: 'uploaded_on', type: 'timestamp', nullable: false })
  UploadedOn!: string;

  @Column({ name: 'uploaded_by', type: 'integer', nullable: false })
  UploadedBy!: number;

  @Column({ name: 'description', type: 'text', nullable: true })
  Description!: string | null;

  @Column({ name: 'file_no', type: 'integer', nullable: false })
  FileNo!: number;

  @Column({ name: 'file_name', type: 'text', nullable: true })
  FileName!: string | null;

  @Column({ name: 'file_extention', type: 'text', nullable: true })
  FileExtention!: string | null;

  @Column({ name: 'is_active', type: 'boolean', nullable: true })
  IsActive!: boolean | null;

}

@Entity({ name: 'pat_patient_gurantor_info' })
export class GuarantorModel {
  @Column({ name: 'patient_gurantor_info', type: 'integer', nullable: true })
  PatientGurantorInfo!: number | null;

  @PrimaryGeneratedColumn({ name: 'patient_id' })
  PatientId!: number;

  @Column({ name: 'guarantor_self', type: 'boolean', nullable: false })
  GuarantorSelf!: boolean;

  @Column({ name: 'patient_relationship', type: 'text', nullable: true })
  PatientRelationship!: string | null;

  @Column({ name: 'guarantor_name', type: 'text', nullable: true })
  GuarantorName!: string | null;

  @Column({ name: 'guarantor_gender', type: 'text', nullable: true })
  GuarantorGender!: string | null;

  @Column({ name: 'guarantor_country_id', type: 'integer', nullable: true })
  GuarantorCountryId!: number | null;

  @Column({ name: 'guarantor_phone_number', type: 'text', nullable: true })
  GuarantorPhoneNumber!: string | null;

  @Column({ name: 'guarantor_date_of_birth', type: 'timestamp', nullable: true })
  GuarantorDateOfBirth!: string | null;

  @Column({ name: 'guarantor_street1', type: 'text', nullable: true })
  GuarantorStreet1!: string | null;

  @Column({ name: 'guarantor_street2', type: 'text', nullable: true })
  GuarantorStreet2!: string | null;

  @Column({ name: 'guarantor_city', type: 'text', nullable: true })
  GuarantorCity!: string | null;

  @Column({ name: 'guarantor_country_sub_division_id', type: 'integer', nullable: true })
  GuarantorCountrySubDivisionId!: number | null;

  @Column({ name: 'guarantor_zip_code', type: 'text', nullable: true })
  GuarantorZIPCode!: string | null;

}

@Entity({ name: 'pat_patient_insurance_info' })
export class InsuranceModel {
  @PrimaryGeneratedColumn({ name: 'patient_insurance_info_id' })
  PatientInsuranceInfoId!: number;

  @Column({ name: 'patient_id', type: 'integer', nullable: false })
  PatientId!: number;

  @Column({ name: 'insurance_number', type: 'text', nullable: true })
  InsuranceNumber!: string | null;

  @Column({ name: 'insurance_name', type: 'text', nullable: true })
  InsuranceName!: string | null;

  @Column({ name: 'card_number', type: 'text', nullable: true })
  CardNumber!: string | null;

  @Column({ name: 'subscriber_first_name', type: 'text', nullable: true })
  SubscriberFirstName!: string | null;

  @Column({ name: 'subscriber_last_name', type: 'text', nullable: true })
  SubscriberLastName!: string | null;

  @Column({ name: 'subscriber_gender', type: 'text', nullable: true })
  SubscriberGender!: string | null;

  @Column({ name: 'subscriber_dob', type: 'timestamp', nullable: true })
  SubscriberDOB!: string | null;

  @Column({ name: 'subscriber_id_card_number', type: 'text', nullable: true })
  SubscriberIDCardNumber!: string | null;

  @Column({ name: 'subscriber_id_card_type', type: 'text', nullable: true })
  SubscriberIDCardType!: string | null;

  @Column({ name: 'imis_code', type: 'text', nullable: true })
  IMISCode!: string | null;

  @Column({ name: 'initial_balance', type: 'double precision', nullable: false })
  InitialBalance!: number;

  @Column({ name: 'current_balance', type: 'double precision', nullable: false })
  CurrentBalance!: number;

  @Column({ name: 'insurance_provider_id', type: 'integer', nullable: false })
  InsuranceProviderId!: number;

  @Column({ name: 'created_on', type: 'timestamp', nullable: true })
  CreatedOn!: string | null;

  @Column({ name: 'created_by', type: 'integer', nullable: true })
  CreatedBy!: number | null;

  @Column({ name: 'modified_on', type: 'timestamp', nullable: true })
  ModifiedOn!: string | null;

  @Column({ name: 'modified_by', type: 'integer', nullable: true })
  ModifiedBy!: number | null;

  @Column({ name: 'ins_has_insurance', type: 'boolean', nullable: true })
  Ins_HasInsurance!: boolean | null;

  @Column({ name: 'ins_nshi_number', type: 'text', nullable: true })
  Ins_NshiNumber!: string | null;

  @Column({ name: 'ins_insurance_balance', type: 'double precision', nullable: true })
  Ins_InsuranceBalance!: number | null;

  @Column({ name: 'ins_insurance_provider_id', type: 'integer', nullable: true })
  Ins_InsuranceProviderId!: number | null;

  @Column({ name: 'ins_is_family_head', type: 'boolean', nullable: true })
  Ins_IsFamilyHead!: boolean | null;

  @Column({ name: 'ins_family_head_nshi', type: 'text', nullable: true })
  Ins_FamilyHeadNshi!: string | null;

  @Column({ name: 'ins_family_head_name', type: 'text', nullable: true })
  Ins_FamilyHeadName!: string | null;

  @Column({ name: 'ins_is_first_service_point', type: 'boolean', nullable: true })
  Ins_IsFirstServicePoint!: boolean | null;

}
