export type StaffStatus = 'ACTIVE' | 'DEPARTED';

export interface StaffMember {
  readonly id: string;
  readonly staffNumber: string;
  readonly firstName: string;
  readonly lastName: string;
  readonly professionCode: string;
  readonly specialtyCode: string | null;
  readonly email: string | null;
  readonly phone: string | null;
  readonly hiredOn: string | null;
  readonly departedOn: string | null;
  readonly status: StaffStatus;
  /** Compte de connexion relié : sans lui, un soignant ne voit aucun patient. */
  readonly userId: string | null;
}

export interface StaffPage {
  readonly items: readonly StaffMember[];
  readonly total: number;
  readonly offset: number;
  readonly limit: number;
}

export interface StaffQuery {
  readonly search?: string;
  readonly status?: StaffStatus;
  readonly offset: number;
  readonly limit: number;
}

export interface RegisterStaffInput {
  readonly staffNumber: string;
  readonly firstName: string;
  readonly lastName: string;
  readonly professionCode: string;
  readonly specialtyCode?: string;
  readonly email?: string;
  readonly phone?: string;
  readonly hiredOn?: string;
}

/** `null` retire la valeur ; une clé absente ne change rien. */
export interface StaffChanges {
  readonly firstName?: string;
  readonly lastName?: string;
  readonly professionCode?: string;
  readonly specialtyCode?: string | null;
  readonly email?: string | null;
  readonly phone?: string | null;
  readonly hiredOn?: string | null;
}

export interface Assignment {
  readonly id: string;
  readonly staffId: string;
  readonly nodeId: string;
  readonly facilityId: string;
  readonly startDate: string;
  readonly endDate: string | null;
  readonly primary: boolean;
  readonly current: boolean;
}

export interface AssignInput {
  readonly nodeId: string;
  readonly startDate?: string;
  readonly primary?: boolean;
}

export interface ReferenceChoice {
  readonly code: string;
  readonly label: string;
}
