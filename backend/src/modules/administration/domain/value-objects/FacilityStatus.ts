
import { ValueObject } from "../../../../shared-kernel/value-object";
import { DomainError, ok, err, Result } from "../../../../shared-kernel/result";

export enum FacilityStatusEnum {
    // --- Statut administratif (droit d'exercer — ARS) ---
    ADMIN_AUTHORIZED = "ADMIN_AUTHORIZED",
    ADMIN_AUTHORIZATION_EXPIRED = "ADMIN_AUTHORIZATION_EXPIRED",
    ADMIN_SUSPENDED = "ADMIN_SUSPENDED",
    ADMIN_LICENSE_REVOKED = "ADMIN_LICENSE_REVOKED",

    // --- Statut opérationnel (état réel de l'établissement) ---
    OPERATIONAL_OPEN = "OPERATIONAL_OPEN",
    OPERATIONAL_TEMPORARILY_CLOSED = "OPERATIONAL_TEMPORARILY_CLOSED",
    OPERATIONAL_PERMANENTLY_CLOSED = "OPERATIONAL_PERMANENTLY_CLOSED",
    OPERATIONAL_UNDER_CONSTRUCTION = "OPERATIONAL_UNDER_CONSTRUCTION",

    // --- Statut qualité / certification (HAS) ---
    QUALITY_CERTIFIED = "QUALITY_CERTIFIED",
    QUALITY_CERTIFICATION_IN_PROGRESS = "QUALITY_CERTIFICATION_IN_PROGRESS",
    QUALITY_NOT_CERTIFIED = "QUALITY_NOT_CERTIFIED",
}

export class FacilityStatus extends ValueObject<FacilityStatusEnum> {
    private constructor(value: FacilityStatusEnum) {
        super(value);
    }

    static create(raw: string): Result<FacilityStatus> {
        const normalized = raw.trim().toUpperCase();
        const statusValue = (Object.values(FacilityStatusEnum) as string[]).find(
            (val) => val === normalized
        );

        if (!statusValue) {
            // Le message d'erreur lui-même devrait être i18n côté présentation,
            // ici on ne transporte que la clé stable.
            return err(
                new DomainError(
                    'FACILITY_STATUS_INVALID',
                    `Statut d'établissement invalide : ${raw}`,
                    { value: raw }
                )
            );
        }
        return ok(new FacilityStatus(statusValue as FacilityStatusEnum));
    }

    static fromEnum(value: FacilityStatusEnum): FacilityStatus {
        return new FacilityStatus(value);
    }

    getValue(): FacilityStatusEnum {
        return this.value;
    }

    /**
     * Retourne la clé de traduction à utiliser côté présentation.
     * Convention : `facility.status.<CODE>`
     */
    getTranslationKey(): string {
        return `facility.status.${this.value}`;
    }

    equals(other: FacilityStatus): boolean {
        return this.value === other.value;
    }
}