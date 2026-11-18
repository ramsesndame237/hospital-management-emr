import { DashboardGateway, DashboardSnapshot } from '../dashboard.gateway';

/** Double de test : un instantané fixe, quelles que soient les permissions. */
export class FakeDashboardGateway extends DashboardGateway {
  snapshotValue: DashboardSnapshot = {
    tiles: [
      { id: 'appointments', labelKey: 'dashboard.tile.appointments', route: '/appointments', value: 3 },
      { id: 'waiting', labelKey: 'dashboard.tile.waiting', route: '/clinical/queue', value: 2 },
    ],
    visits: [
      { id: 'a-1', time: '09:30', patient: 'Ndom Évelyne', statusKey: 'dashboard.status.ARRIVED' },
      { id: 'a-2', time: '10:00', patient: 'Mvondo Berthe', statusKey: 'dashboard.status.SCHEDULED' },
    ],
  };

  override snapshot(): Promise<DashboardSnapshot> {
    return Promise.resolve(this.snapshotValue);
  }
}
