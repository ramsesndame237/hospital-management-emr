export interface PortalPatient {
  readonly id: string;
  readonly number: string;
  readonly lastName: string;
  readonly firstName: string;
  readonly sex: string;
  readonly birthDate: string;
}

export interface PortalAppointment {
  readonly number: string;
  readonly status: 'SCHEDULED' | 'ARRIVED' | 'CANCELLED' | 'NO_SHOW';
  readonly startsAt: string;
  readonly endsAt: string;
}

export interface PortalResultItem {
  readonly testName: string;
  readonly value: string | null;
  readonly unit: string | null;
  /** `LOW`, `HIGH`, `CRITICAL_LOW`, `CRITICAL_HIGH` : hors des valeurs de référence ; `NORMAL` ou absent : dans la norme. */
  readonly flag: string | null;
  readonly refLow: number | null;
  readonly refHigh: number | null;
  readonly amended: boolean;
}

/** Un rapport d'analyses PUBLIÉ : jamais une valeur que le laboratoire n'a pas validée. */
export interface PortalResult {
  readonly number: string;
  readonly orderedAt: string;
  readonly items: readonly PortalResultItem[];
}

export interface PortalPrescriptionLine {
  readonly drugName: string;
  readonly strength: string | null;
  readonly dose: string;
  readonly frequency: string;
  readonly durationDays: number | null;
  readonly quantity: number;
  readonly unit: string;
}

export interface PortalPrescription {
  readonly number: string;
  readonly issuedAt: string;
  readonly status: 'ISSUED' | 'CANCELLED';
  readonly dispensing: 'NONE' | 'PARTIAL' | 'COMPLETE';
  readonly lines: readonly PortalPrescriptionLine[];
}

export interface PortalInvoice {
  readonly number: string;
  readonly status: string;
  readonly currency: string;
  readonly total: number;
  readonly paid: number;
  readonly balance: number;
  readonly issuedAt: string | null;
}

/** Le compte du portail relié à un dossier. */
export interface PortalAccount {
  readonly username: string | null;
  readonly linkedAt: string;
}
