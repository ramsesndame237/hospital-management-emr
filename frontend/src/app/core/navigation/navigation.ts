import { IconName } from '../../shared/icons/icon';
import { hasPermission } from '../auth/permissions';

/**
 * Entrée du menu principal. `labelKey` est une clé de catalogue ; `route` pointe vers l'écran (ou vers l'écran provisoire
 * `/modules/<id>` tant que le module n'existe pas). Une entrée sans `roles` ni `permission` est visible de tous ; sinon il
 * suffit de posséder l'un des rôles listés ET la permission demandée. Le menu ne fait que refléter les droits : l'API tranche.
 *
 * Un GROUPE (« Administration ») n'a pas d'écran : il porte des `children` (un seul niveau) et se déplie. Il n'apparaît que
 * si au moins une de ses entrées est permise à l'utilisateur.
 */
export interface NavItem {
  readonly id: string;
  readonly labelKey: string;
  readonly icon: IconName;
  /** Écran de l'entrée ; absent pour un groupe. */
  readonly route?: string;
  readonly children?: readonly NavItem[];
  readonly roles?: readonly string[];
  readonly permission?: string;
}

const DOCTOR = ['DOCTOR'] as const;
const SYSTEM_ADMIN = ['SYSTEM_ADMIN'] as const;

/** Menus du médecin (design SHELL-01) et de l'administrateur système (groupe « Administration »). Les autres profils s'ajouteront ici. */
export const NAVIGATION: readonly NavItem[] = [
  { id: 'dashboard', labelKey: 'nav.dashboard', icon: 'dashboard', route: '/' },
  {
    id: 'administration',
    labelKey: 'nav.administration',
    icon: 'organization',
    roles: SYSTEM_ADMIN,
    children: [
      { id: 'admin-organization', labelKey: 'nav.adminOrganization', icon: 'organization', route: '/admin/organization', permission: 'administration.organization:read' },
      { id: 'admin-sites', labelKey: 'nav.adminSites', icon: 'site', route: '/admin/sites', permission: 'administration.facilities:read' },
      { id: 'admin-structure', labelKey: 'nav.adminStructure', icon: 'ward', route: '/admin/structure', permission: 'administration.structure:read' },
      { id: 'admin-users', labelKey: 'nav.adminUsers', icon: 'user', route: '/admin/users', permission: 'iam.users:read' },
      { id: 'admin-roles', labelKey: 'nav.adminRoles', icon: 'shield', route: '/admin/roles', permission: 'iam.roles:read' },
    ],
  },
  {
    id: 'billing',
    labelKey: 'nav.billing',
    icon: 'invoice',
    children: [
      { id: 'billing-invoices', labelKey: 'nav.billingInvoices', icon: 'invoice', route: '/billing/invoices', permission: 'billing.invoices:read' },
      { id: 'billing-new', labelKey: 'nav.billingNew', icon: 'add', route: '/billing/invoices/new', permission: 'billing.invoices:write' },
      { id: 'billing-session', labelKey: 'nav.billingSession', icon: 'consultations', route: '/billing/session', permission: 'billing.sessions:operate' },
      { id: 'billing-sessions', labelKey: 'nav.billingSessions', icon: 'agenda', route: '/billing/sessions', permission: 'billing.sessions:read:own' },
      { id: 'billing-approvals', labelKey: 'nav.billingApprovals', icon: 'shield', route: '/billing/approvals', permission: 'billing.approvals:read:own' },
      { id: 'billing-catalog', labelKey: 'nav.billingCatalog', icon: 'consultations', route: '/billing/catalog', permission: 'billing.catalog:read' },
    ],
  },
  {
    id: 'lab',
    labelKey: 'nav.lab',
    icon: 'ward',
    children: [
      { id: 'lab-worklist', labelKey: 'nav.labWorklist', icon: 'agenda', route: '/lab/worklist', permission: 'lab.requisitions:read:own' },
      { id: 'lab-new', labelKey: 'nav.labNew', icon: 'add', route: '/lab/requisitions/new', permission: 'lab.requisitions:order' },
      { id: 'lab-catalog', labelKey: 'nav.labCatalog', icon: 'consultations', route: '/lab/catalog', permission: 'lab.catalog:read' },
    ],
  },
  {
    id: 'pharmacy',
    labelKey: 'nav.pharmacy',
    icon: 'ward',
    children: [
      { id: 'pharmacy-stock', labelKey: 'nav.pharmacyStock', icon: 'dashboard', route: '/pharmacy/stock', permission: 'pharmacy.stock:read' },
      { id: 'pharmacy-expiry', labelKey: 'nav.pharmacyExpiry', icon: 'agenda', route: '/pharmacy/expiry', permission: 'pharmacy.stock:read' },
      { id: 'pharmacy-receipts', labelKey: 'nav.pharmacyReceipts', icon: 'invoice', route: '/pharmacy/receipts', permission: 'pharmacy.stock:read' },
      { id: 'pharmacy-new-receipt', labelKey: 'nav.pharmacyNewReceipt', icon: 'add', route: '/pharmacy/receipts/new', permission: 'pharmacy.stock:receive' },
      { id: 'pharmacy-adjustments', labelKey: 'nav.pharmacyAdjustments', icon: 'shield', route: '/pharmacy/adjustments', permission: 'pharmacy.stock:read' },
      { id: 'pharmacy-catalog', labelKey: 'nav.pharmacyCatalog', icon: 'consultations', route: '/pharmacy/catalog', permission: 'pharmacy.catalog:read' },
    ],
  },
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
  return items.flatMap((item) => {
    const roleOk = !item.roles || item.roles.some((role) => roles.includes(role));
    const permissionOk = !item.permission || hasPermission(permissions, item.permission);
    if (!roleOk || !permissionOk) return [];
    if (!item.children) return [item];
    const children = visibleNavigation(item.children, roles, permissions);
    return children.length > 0 ? [{ ...item, children }] : [];
  });
}

/** Libellé d'un module à afficher sur l'écran provisoire. */
export function findNavItem(id: string): NavItem | undefined {
  return NAVIGATION.flatMap((item) => [item, ...(item.children ?? [])]).find((item) => item.id === id);
}

/** Vrai si l'adresse courante est celle de l'entrée ou l'un de ses sous-écrans (`/admin/structure/<site>`). */
export function isRouteActive(route: string | undefined, url: string): boolean {
  if (!route) return false;
  const path = url.split(/[?#]/)[0];
  return route === '/' ? path === '/' : path === route || path.startsWith(`${route}/`);
}
