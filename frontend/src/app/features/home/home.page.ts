import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { HlmBadgeImports } from '@spartan-ng/helm/badge';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmCardImports } from '@spartan-ng/helm/card';
import { hasPermission } from '../../core/auth/permissions';
import { SessionService } from '../../core/auth/session.service';
import { SessionStore } from '../../core/auth/session.store';
import { Translator } from '../../core/i18n/translator';
import { BrandMark } from '../../shared/brand-mark';
import { Preferences } from '../../shared/preferences';

/**
 * Espace connecté (premier écran après la connexion). Affiche le profil et les autorisations renvoyés par l'API : les
 * prochains modules (patients, rendez-vous, facturation…) s'y brancheront, chacun gardé par `permissionGuard`.
 */
@Component({
  selector: 'app-home-page',
  imports: [HlmButtonImports, HlmCardImports, HlmBadgeImports, BrandMark, Preferences],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './home.page.html',
})
export class HomePage {
  protected readonly i18n = inject(Translator);
  private readonly store = inject(SessionStore);
  private readonly session = inject(SessionService);

  protected readonly user = this.store.user;
  protected readonly canReadApiDocs = computed(() => hasPermission(this.user()?.permissions ?? [], 'api.docs:read'));
  /** Permissions groupées par ressource (`files`, `iam.users`…) pour une lecture plus simple qu'une liste à plat. */
  protected readonly groupedPermissions = computed(() => {
    const groups = new Map<string, string[]>();
    for (const p of this.user()?.permissions ?? []) {
      const [resource, action, scope] = p.split(':');
      groups.set(resource, [...(groups.get(resource) ?? []), scope && scope !== 'all' ? `${action} (${scope})` : action]);
    }
    return [...groups].map(([resource, actions]) => ({ resource, actions })).sort((a, b) => a.resource.localeCompare(b.resource));
  });

  protected signOut(): void {
    void this.session.logout();
  }
}
