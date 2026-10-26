import { Injectable } from '@angular/core';

export interface OpenPatientContext {
  readonly name: string;
  readonly record: string;
}

export interface ScheduledVisit {
  readonly time: string;
  readonly patient: string;
  /** Clé de catalogue du type de visite (« dashboard.visit.followUp »). */
  readonly kindKey: string;
  /** Clé de catalogue de l'état (« dashboard.status.confirmed »). */
  readonly statusKey: string;
}

/** Ce que l'écran « Mon espace de travail » affiche du jour. */
export interface DashboardSnapshot {
  readonly consultationsToday: number;
  readonly resultsToReview: number;
  readonly documentsToSign: number;
  readonly visits: readonly ScheduledVisit[];
  /** Dossier patient actuellement ouvert, s'il y en a un. */
  readonly openPatient: OpenPatientContext | null;
}

/**
 * Port des données du tableau de bord. Les modules cliniques (agenda, consultations, résultats) le fourniront ; l'écran,
 * lui, ne change pas : seul l'adaptateur déclaré dans `app.config.ts` est remplacé.
 */
export abstract class DashboardGateway {
  abstract snapshot(): Promise<DashboardSnapshot>;
}

/**
 * Adaptateur PROVISOIRE : données d'exemple du design, tant qu'aucun module clinique n'existe côté API. À remplacer par un
 * adaptateur HTTP dès que `agenda` et `consultations` seront migrés.
 */
@Injectable()
export class SampleDashboardGateway extends DashboardGateway {
  override snapshot(): Promise<DashboardSnapshot> {
    return Promise.resolve({
      consultationsToday: 14,
      resultsToReview: 6,
      documentsToSign: 3,
      openPatient: { name: 'Évelyne Ndom', record: 'CM-2026-004218' },
      visits: [
        { time: '09:30', patient: 'Évelyne Ndom', kindKey: 'dashboard.visit.followUp', statusKey: 'dashboard.status.confirmed' },
        { time: '10:00', patient: 'Berthe Mvondo', kindKey: 'dashboard.visit.consultation', statusKey: 'dashboard.status.arrived' },
        { time: '10:30', patient: 'Alain Tchoumi', kindKey: 'dashboard.visit.consultation', statusKey: 'dashboard.status.waiting' },
      ],
    });
  }
}
