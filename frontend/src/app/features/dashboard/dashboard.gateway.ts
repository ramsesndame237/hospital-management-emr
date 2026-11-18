import { Injectable, inject } from '@angular/core';
import { hasPermission } from '../../core/auth/permissions';
import { BillingGateway } from '../../core/billing/billing.gateway';
import { ClinicalGateway } from '../../core/clinical/clinical.gateway';
import { ImagingGateway } from '../../core/imaging/imaging.gateway';
import { LabGateway } from '../../core/lab/lab.gateway';
import { PharmacyGateway } from '../../core/pharmacy/pharmacy.gateway';
import { ReceptionGateway } from '../../core/reception/reception.gateway';
import { Clock } from '../../core/time/clock';
import { Temporal } from '../../core/time/temporal';
import { dayRange, localDate, localTime } from '../reception/agenda/agenda-time';

/** Un chiffre du jour, avec l'écran où le traiter. */
export interface DashboardTile {
  readonly id: string;
  /** Clé de catalogue du libellé (« dashboard.tile.waiting »). */
  readonly labelKey: string;
  readonly value: number;
  readonly route: string;
}

export interface ScheduledVisit {
  readonly id: string;
  readonly time: string;
  readonly patient: string;
  /** Clé de catalogue de l'état (« dashboard.status.arrived »). */
  readonly statusKey: string;
}

/** Ce que l'écran « Mon espace de travail » affiche : uniquement des chiffres réels, et seulement ceux que le rôle peut traiter. */
export interface DashboardSnapshot {
  readonly tiles: readonly DashboardTile[];
  /** Rendez-vous du jour, dans l'ordre ; vide si le rôle n'a pas accès à l'agenda. */
  readonly visits: readonly ScheduledVisit[];
}

/**
 * Port des données du tableau de bord. Les droits de l'utilisateur décident de ce qui est interrogé : un chiffre dont le rôle ne
 * peut rien faire n'est ni demandé ni affiché.
 */
export abstract class DashboardGateway {
  abstract snapshot(permissions: readonly string[]): Promise<DashboardSnapshot>;
}

const VISITS_SHOWN = 8;

/**
 * Adaptateur réel : compose les API existantes (agenda, file d'attente, laboratoire, imagerie, pharmacie, caisse). Chaque chiffre est
 * indépendant : si l'un échoue, il manque, sans emporter les autres ni afficher une valeur inventée.
 */
@Injectable()
export class HttpDashboardGateway extends DashboardGateway {
  private readonly reception = inject(ReceptionGateway);
  private readonly clinical = inject(ClinicalGateway);
  private readonly lab = inject(LabGateway);
  private readonly imaging = inject(ImagingGateway);
  private readonly pharmacy = inject(PharmacyGateway);
  private readonly billing = inject(BillingGateway);
  private readonly clock = inject(Clock);

  override async snapshot(permissions: readonly string[]): Promise<DashboardSnapshot> {
    const can = (permission: string) => hasPermission(permissions, permission);
    const tiles: Array<{ readonly order: number; readonly load: () => Promise<DashboardTile> }> = [];
    const add = (order: number, id: string, labelKey: string, route: string, count: () => Promise<number>) =>
      tiles.push({ order, load: async () => ({ id, labelKey, route, value: await count() }) });
    const one = { total: (page: { readonly total: number }) => page.total };

    if (can('clinical.encounters:read:department')) {
      add(2, 'waiting', 'dashboard.tile.waiting', '/clinical/queue', async () => (await this.clinical.getQueue()).filter((q) => !q.encounter).length);
    }
    if (can('lab.specimens:collect')) {
      add(3, 'toCollect', 'dashboard.tile.toCollect', '/lab/worklist', async () => one.total(await this.lab.listRequisitions({ status: 'ORDERED' }, 0, 1)));
    }
    if (can('lab.results:verify')) {
      add(4, 'toVerify', 'dashboard.tile.toVerify', '/lab/worklist', async () => one.total(await this.lab.listRequisitions({ status: 'RESULTED' }, 0, 1)));
    }
    if (can('lab.requisitions:order') && !can('lab.results:enter')) {
      add(5, 'released', 'dashboard.tile.released', '/results', async () => one.total(await this.lab.listRequisitions({ status: 'RELEASED' }, 0, 1)));
    }
    if (can('imaging.exams:perform')) {
      add(6, 'toPerform', 'dashboard.tile.toPerform', '/imaging/worklist', async () => {
        const [ordered, scheduled] = await Promise.all([this.imaging.listOrders({ status: 'ORDERED' }, 0, 1), this.imaging.listOrders({ status: 'SCHEDULED' }, 0, 1)]);
        return ordered.total + scheduled.total;
      });
    }
    if (can('imaging.reports:sign')) {
      add(7, 'toSign', 'dashboard.tile.toSign', '/imaging/worklist', async () => one.total(await this.imaging.listOrders({ status: 'PERFORMED' }, 0, 1)));
    }
    if (can('pharmacy.dispensing:dispense')) {
      add(8, 'toDispense', 'dashboard.tile.toDispense', '/pharmacy/prescriptions', async () => (await this.pharmacy.getDispensingQueue()).length);
    }
    if (can('pharmacy.stock:read')) {
      add(9, 'stockAlerts', 'dashboard.tile.stockAlerts', '/pharmacy/stock', async () => {
        const summary = await this.pharmacy.getSummary();
        return summary.out + summary.low;
      });
    }
    if (can('billing.invoices:write')) {
      add(10, 'toPay', 'dashboard.tile.toPay', '/billing/invoices', async () => {
        const [issued, partial] = await Promise.all([this.billing.listInvoices({ status: 'ISSUED' }, 0, 1), this.billing.listInvoices({ status: 'PARTIALLY_PAID' }, 0, 1)]);
        return issued.total + partial.total;
      });
    }

    let visits: readonly ScheduledVisit[] = [];
    if (can('appointments:read:department')) {
      const range = dayRange(localDate(this.clock.now()));
      if (range) {
        tiles.push({
          order: 1,
          load: async () => {
            const page = await this.reception.listAppointments({ from: range.from, to: range.to }, 0, 100);
            const active = page.items.filter((a) => a.status !== 'CANCELLED').sort((a, b) => a.startsAt.localeCompare(b.startsAt));
            visits = active.slice(0, VISITS_SHOWN).map((a) => ({
              id: a.id,
              time: localTime(Temporal.Instant.from(a.startsAt)),
              patient: a.patient ? `${a.patient.lastName} ${a.patient.firstName}` : a.number,
              statusKey: `dashboard.status.${a.status}`,
            }));
            return { id: 'appointments', labelKey: 'dashboard.tile.appointments', route: '/appointments', value: active.length };
          },
        });
      }
    }

    const settled = await Promise.allSettled(tiles.map((t) => t.load()));
    const loaded = tiles
      .map((t, i) => ({ order: t.order, result: settled[i] }))
      .flatMap((x) => (x.result.status === 'fulfilled' ? [{ order: x.order, tile: x.result.value }] : []))
      .sort((a, b) => a.order - b.order)
      .map((x) => x.tile);
    return { tiles: loaded, visits };
  }
}
