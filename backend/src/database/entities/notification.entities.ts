/* GÉNÉRÉ par tools/generate-entities.mjs depuis migration/inventory/entities.json : ne pas modifier à la main. */
import { Column, Entity, PrimaryColumn, PrimaryGeneratedColumn } from 'typeorm';


@Entity({ name: 'core_notification' })
export class NotificationViewModel {
  @PrimaryGeneratedColumn({ name: 'notification_id' })
  NotificationId!: number;

  @Column({ name: 'notification_module_name', type: 'text', nullable: true })
  Notification_ModuleName!: string | null;

  @Column({ name: 'notification_title', type: 'text', nullable: true })
  Notification_Title!: string | null;

  @Column({ name: 'notification_details', type: 'text', nullable: true })
  Notification_Details!: string | null;

  @Column({ name: 'recipient_id', type: 'integer', nullable: true })
  RecipientId!: number | null;

  @Column({ name: 'parent_table_name', type: 'text', nullable: true })
  ParentTableName!: string | null;

  @Column({ name: 'notification_parent_id', type: 'integer', nullable: false })
  NotificationParentId!: number;

  @Column({ name: 'is_read', type: 'boolean', nullable: false })
  IsRead!: boolean;

  @Column({ name: 'read_by', type: 'integer', nullable: true })
  ReadBy!: number | null;

  @Column({ name: 'created_on', type: 'timestamp', nullable: false })
  CreatedOn!: string;

  @Column({ name: 'is_archived', type: 'boolean', nullable: true })
  IsArchived!: boolean | null;

  @Column({ name: 'recipient_type', type: 'text', nullable: true })
  RecipientType!: string | null;

  @Column({ name: 'sub_module_name', type: 'text', nullable: true })
  Sub_ModuleName!: string | null;

}
