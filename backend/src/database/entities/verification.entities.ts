/* GÉNÉRÉ par tools/generate-entities.mjs depuis migration/inventory/entities.json : ne pas modifier à la main. */
import { Column, Entity, PrimaryColumn, PrimaryGeneratedColumn } from 'typeorm';


@Entity({ name: 'phrm_txn_verification' })
export class PharmacyVerificationModel {
  @PrimaryGeneratedColumn({ name: 'verification_id' })
  VerificationId!: number;

  @Column({ name: 'verified_by', type: 'integer', nullable: false })
  VerifiedBy!: number;

  @Column({ name: 'verified_on', type: 'timestamp', nullable: false })
  VerifiedOn!: string;

  @Column({ name: 'parent_verification_id', type: 'integer', nullable: true })
  ParentVerificationId!: number | null;

  @Column({ name: 'current_verification_level', type: 'integer', nullable: false })
  CurrentVerificationLevel!: number;

  @Column({ name: 'current_verification_level_count', type: 'integer', nullable: false })
  CurrentVerificationLevelCount!: number;

  @Column({ name: 'max_verification_level', type: 'integer', nullable: false })
  MaxVerificationLevel!: number;

  @Column({ name: 'verification_status', type: 'text', nullable: true })
  VerificationStatus!: string | null;

  @Column({ name: 'verification_remarks', type: 'text', nullable: true })
  VerificationRemarks!: string | null;

  @Column({ name: 'transaction_type', type: 'text', nullable: true })
  TransactionType!: string | null;

}

@Entity({ name: 'txn_verification' })
export class VerificationModel {
  @PrimaryGeneratedColumn({ name: 'verification_id' })
  VerificationId!: number;

  @Column({ name: 'verified_by', type: 'integer', nullable: false })
  VerifiedBy!: number;

  @Column({ name: 'verified_on', type: 'timestamp', nullable: false })
  VerifiedOn!: string;

  @Column({ name: 'parent_verification_id', type: 'integer', nullable: true })
  ParentVerificationId!: number | null;

  @Column({ name: 'current_verification_level', type: 'integer', nullable: false })
  CurrentVerificationLevel!: number;

  @Column({ name: 'current_verification_level_count', type: 'integer', nullable: false })
  CurrentVerificationLevelCount!: number;

  @Column({ name: 'max_verification_level', type: 'integer', nullable: false })
  MaxVerificationLevel!: number;

  @Column({ name: 'verification_status', type: 'text', nullable: true })
  VerificationStatus!: string | null;

  @Column({ name: 'verification_remarks', type: 'text', nullable: true })
  VerificationRemarks!: string | null;

}
