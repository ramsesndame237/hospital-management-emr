/* GÉNÉRÉ par tools/generate-entities.mjs depuis migration/inventory/entities.json : ne pas modifier à la main. */
import { Column, Entity, PrimaryColumn, PrimaryGeneratedColumn } from 'typeorm';


@Entity({ name: 'ot_txn_booking_details' })
export class OtBookingListModel {
  @PrimaryGeneratedColumn({ name: 'ot_booking_id' })
  OTBookingId!: number;

  @Column({ name: 'patient_id', type: 'integer', nullable: false })
  PatientId!: number;

  @Column({ name: 'patient_visit_id', type: 'integer', nullable: true })
  PatientVisitId!: number | null;

  @Column({ name: 'booked_for_date', type: 'timestamp', nullable: true })
  BookedForDate!: string | null;

  @Column({ name: 'created_on', type: 'timestamp', nullable: true })
  CreatedOn!: string | null;

  @Column({ name: 'created_by', type: 'integer', nullable: false })
  CreatedBy!: number;

  @Column({ name: 'surgery_type', type: 'text', nullable: true })
  SurgeryType!: string | null;

  @Column({ name: 'diagnosis', type: 'text', nullable: true })
  Diagnosis!: string | null;

  @Column({ name: 'procedure_type', type: 'text', nullable: true })
  ProcedureType!: string | null;

  @Column({ name: 'anesthesia_type', type: 'text', nullable: true })
  AnesthesiaType!: string | null;

  @Column({ name: 'remarks', type: 'text', nullable: true })
  Remarks!: string | null;

  @Column({ name: 'cancelled_by', type: 'integer', nullable: true })
  CancelledBy!: number | null;

  @Column({ name: 'cancelled_on', type: 'timestamp', nullable: true })
  CancelledOn!: string | null;

  @Column({ name: 'cancellation_remarks', type: 'text', nullable: true })
  CancellationRemarks!: string | null;

  @Column({ name: 'consent_form_path', type: 'text', nullable: true })
  ConsentFormPath!: string | null;

  @Column({ name: 'pac_form_path', type: 'text', nullable: true })
  PACFormPath!: string | null;

  @Column({ name: 'is_active', type: 'boolean', nullable: false })
  IsActive!: boolean;

}

@Entity({ name: 'ot_txn_check_list_info' })
export class OtCheckListInfoModel {
  @PrimaryGeneratedColumn({ name: 'check_list_id' })
  CheckListId!: number;

  @Column({ name: 'ot_booking_id', type: 'integer', nullable: false })
  OTBookingId!: number;

  @Column({ name: 'check_list_item_name', type: 'integer', nullable: false })
  CheckListItemName!: number;

  @Column({ name: 'item_value', type: 'boolean', nullable: false })
  ItemValue!: boolean;

  @Column({ name: 'item_details', type: 'text', nullable: true })
  ItemDetails!: string | null;

}

@Entity({ name: 'ot_txn_ot_teams_info' })
export class OTTeamsModel {
  @PrimaryGeneratedColumn({ name: 'ot_team_id' })
  OTTeamId!: number;

  @Column({ name: 'employee_id', type: 'integer', nullable: false })
  EmployeeId!: number;

  @Column({ name: 'ot_booking_id', type: 'integer', nullable: false })
  OTBookingId!: number;

  @Column({ name: 'patient_id', type: 'integer', nullable: false })
  PatientId!: number;

  @Column({ name: 'patient_visit_id', type: 'integer', nullable: true })
  PatientVisitId!: number | null;

  @Column({ name: 'role_type', type: 'text', nullable: true })
  RoleType!: string | null;

}

@Entity({ name: 'ot_txn_summary' })
export class OTSummaryModel {
  @PrimaryGeneratedColumn({ name: 'ot_summary_id' })
  OTSummaryId!: number;

  @Column({ name: 'ot_team_id', type: 'integer', nullable: false })
  OTTeamId!: number;

  @Column({ name: 'ot_booking_id', type: 'integer', nullable: false })
  OTBookingId!: number;

  @Column({ name: 'pre_operation_diagnosis', type: 'text', nullable: true })
  PreOperationDiagnosis!: string | null;

  @Column({ name: 'post_operation_diagnosis', type: 'text', nullable: true })
  PostOperationDiagnosis!: string | null;

  @Column({ name: 'anesthesia', type: 'text', nullable: true })
  Anesthesia!: string | null;

  @Column({ name: 'ot_charge', type: 'real', nullable: false })
  OTCharge!: number;

  @Column({ name: 'ot_description', type: 'text', nullable: true })
  OTDescription!: string | null;

  @Column({ name: 'category', type: 'text', nullable: true })
  Category!: string | null;

  @Column({ name: 'signature_of_nurse', type: 'text', nullable: true })
  SignatureOfNurse!: string | null;

}
