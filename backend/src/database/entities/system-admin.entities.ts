/* GÉNÉRÉ par tools/generate-entities.mjs depuis migration/inventory/entities.json : ne pas modifier à la main. */
import { Column, Entity, PrimaryColumn, PrimaryGeneratedColumn } from 'typeorm';


@Entity({ name: 'sys_admin_db_log' })
export class DatabaseLogModel {
  @PrimaryGeneratedColumn({ name: 'db_log_id' })
  DBLogId!: number;

  @Column({ name: 'file_name', type: 'text', nullable: true })
  FileName!: string | null;

  @Column({ name: 'folder_path', type: 'text', nullable: true })
  FolderPath!: string | null;

  @Column({ name: 'database_name', type: 'text', nullable: true })
  DatabaseName!: string | null;

  @Column({ name: 'database_version', type: 'text', nullable: true })
  DatabaseVersion!: string | null;

  @Column({ name: 'is_db_restorable', type: 'boolean', nullable: true })
  IsDBRestorable!: boolean | null;

  @Column({ name: 'action', type: 'text', nullable: true })
  Action!: string | null;

  @Column({ name: 'action_type', type: 'text', nullable: true })
  ActionType!: string | null;

  @Column({ name: 'status', type: 'text', nullable: true })
  Status!: string | null;

  @Column({ name: 'message_detail', type: 'text', nullable: true })
  MessageDetail!: string | null;

  @Column({ name: 'remarks', type: 'text', nullable: true })
  Remarks!: string | null;

  @Column({ name: 'created_by', type: 'integer', nullable: true })
  CreatedBy!: number | null;

  @Column({ name: 'created_on', type: 'timestamp', nullable: true })
  CreatedOn!: string | null;

  @Column({ name: 'delete_on', type: 'timestamp', nullable: true })
  DeleteOn!: string | null;

  @Column({ name: 'is_active', type: 'boolean', nullable: true })
  IsActive!: boolean | null;

}

@Entity({ name: 'sys_admin_parameters' })
export class AdminParametersModel {
  @PrimaryGeneratedColumn({ name: 'parameter_id' })
  ParameterId!: number;

  @Column({ name: 'parameter_group_name', type: 'text', nullable: true })
  ParameterGroupName!: string | null;

  @Column({ name: 'parameter_name', type: 'text', nullable: true })
  ParameterName!: string | null;

  @Column({ name: 'parameter_value', type: 'text', nullable: true })
  ParameterValue!: string | null;

  @Column({ name: 'value_data_type', type: 'text', nullable: true })
  ValueDataType!: string | null;

  @Column({ name: 'description', type: 'text', nullable: true })
  Description!: string | null;

  @Column({ name: 'parameter_type', type: 'text', nullable: true })
  ParameterType!: string | null;

  @Column({ name: 'value_look_up_list', type: 'text', nullable: true })
  ValueLookUpList!: string | null;

}

@Entity({ name: 'tbl_audit_table_display_name' })
export class AuditTableDisplayName {
  @PrimaryGeneratedColumn({ name: 'audit_table_display_name_id' })
  AuditTableDisplayNameId!: number;

  @Column({ name: 'display_name', type: 'text', nullable: true })
  DisplayName!: string | null;

  @Column({ name: 'table_name', type: 'text', nullable: true })
  TableName!: string | null;

  @Column({ name: 'is_active', type: 'boolean', nullable: false })
  IsActive!: boolean;

}
