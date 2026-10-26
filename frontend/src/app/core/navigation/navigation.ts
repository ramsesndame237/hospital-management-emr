import { IconName } from '../../shared/icons/icon';
import { hasPermission } from '../auth/permissions';

/**
 * Entrée du menu principal. `labelKey` est une clé de catalogue ; `route` pointe vers l'écran (ou vers l'écran provisoire
 * `/modules/<id>` tant que le module n'existe pas). Une entrée sans `roles` ni `permission` est visible de tous ; sinon il
 * suffit de posséder l'un des rôles listés ET la permission demandée. Le menu ne fait que refléter les droits : l'API tranche.
 */
export interface NavItem {
  readonly id: string;
  readonly labelKey: string;
  readonly icon: IconName;
  readonly route: string;
  readonly roles?: readonly string[];
  readonly permission?: string;
}

const DOCTOR = ['DOCTOR'] as const;
const SYSTEM_ADMIN = ['SYSTEM_ADMIN'] as const;

/** Menus du médecin (design SHELL-01) et de l'administrateur système (« Organisation »). Les autres profils s'ajouteront ici, une entrée à la fois. */
export const NAVIGATION: readonly NavItem[] = [
  { id: 'dashboard', labelKey: 'nav.dashboard', icon: 'dashboard', route: '/' },
  { id: 'admin-organization', labelKey: 'nav.adminOrganization', icon: 'organization', route: '/admin/organization', roles: SYSTEM_ADMIN, permission: 'administration.organization:read' },
  { id: 'admin-sites', labelKey: 'nav.adminSites', icon: 'site', route: '/admin/sites', roles: SYSTEM_ADMIN, permission: 'administration.facilities:read' },
  { id: 'admin-structure', labelKey: 'nav.adminStructure', icon: 'ward', route: '/admin/structure', roles: SYSTEM_ADMIN, permission: 'administration.structure:read' },
  { id: 'agenda', labelKey: 'nav.agenda', icon: 'agenda', route: '/modules/agenda', roles: DOCTOR },
  { id: 'consultations', labelKey: 'nav.consultations', icon: 'consultations', route: '/modules/consultations', roles: DOCTOR },
  { id: 'rounds', labelKey: 'nav.rounds', icon: 'ward', route: '/modules/rounds', roles: DOCTOR },
  { id: 'emergency', labelKey: 'nav.emergency', icon: 'emergency', route: '/modules/emergency', roles: DOCTOR },
  { id: 'results', labelKey: 'nav.results', icon: 'dashboard', route: '/modules/results', roles: DOCTOR },
  { id: 'tasks', labelKey: 'nav.tasks', icon: 'agenda', route: '/modules/tasks', roles: DOCTOR },
  { id: 'patients', labelKey: 'nav.patients', icon: 'consultations', route: '/modules/patients', roles: DOCTOR },
  { id: 'surgery', labelKey: 'nav.surgery', icon: 'ward', route: '/modules/surgery', roles: DOCTOR },
  { id: 'maternity', labelKey: 'nav.maternity', icon: 'emergency', route: '/modules/maternity', roles: DOCTOR },
  { id: 'documents', labelKey: 'nav.documents', icon: 'dashboard', route: '/modules/documents', roles: DOCTOR },
  { id: 'planning', labelKey: 'nav.planning', icon: 'agenda', route: '/modules/planning', roles: DOCTOR },
  { id: 'reports', labelKey: 'nav.reports', icon: 'consultations', route: '/modules/reports', roles: DOCTOR },
];

/** Entrées auxquelles l'utilisateur a droit, dans l'ordre du menu. */
export function visibleNavigation(items: readonly NavItem[], roles: readonly string[], permissions: readonly string[]): NavItem[] {
  return items.filter((item) => {
    const roleOk = !item.roles || item.roles.some((role) => roles.includes(role));
    const permissionOk = !item.permission || hasPermission(permissions, item.permission);
    return roleOk && permissionOk;
  });
}

/** Libellé d'un module à afficher sur l'écran provisoire. */
export function findNavItem(id: string): NavItem | undefined {
  return NAVIGATION.find((item) => item.id === id);
}
