import { ChangeDetectionStrategy, Component, ElementRef, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SessionService } from '../../core/auth/session.service';
import { SessionStore } from '../../core/auth/session.store';
import { Translator } from '../../core/i18n/translator';
import { Icon } from '../../shared/icons/icon';

/** « marie.curie » → « MC » ; « amina » → « AM ». Les initiales ne sont qu'un repère visuel. */
export function initialsOf(username: string): string {
  const parts = username.split(/[._\-\s@]+/).filter(Boolean);
  const letters = parts.length > 1 ? parts[0][0] + parts[1][0] : (parts[0] ?? '?').slice(0, 2);
  return letters.toUpperCase();
}

/** Menu de l'utilisateur connecté : repère (initiales), profil, déconnexion. Se ferme à Échap ou d'un clic à l'extérieur. */
@Component({
  selector: 'app-user-menu',
  imports: [RouterLink, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'relative', '(document:click)': 'closeOutside($event)', '(keydown.escape)': 'close()' },
  template: `
    <button
      type="button"
      class="flex items-center gap-1.5 rounded-[2px] px-1 py-1 text-sm text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      aria-haspopup="menu"
      [attr.aria-expanded]="open()"
      [attr.aria-label]="i18n.t('shell.userMenu')"
      (click)="open.set(!open())"
    >
      <span class="grid size-7 place-items-center bg-brand-deep text-xs font-semibold text-white">{{ initials() }}</span>
      <app-icon name="chevronDown" class="text-xs" />
    </button>

    @if (open()) {
      <div role="menu" class="absolute right-0 z-30 mt-2 w-64 border border-border bg-popover text-popover-foreground">
        <div class="border-b border-border px-4 py-3">
          <p class="truncate text-sm font-semibold">{{ user()?.username }}</p>
          <p class="truncate text-xs text-muted-foreground">{{ user()?.email }}</p>
        </div>
        <a role="menuitem" routerLink="/profile" class="block px-4 py-2.5 text-sm hover:bg-muted focus-visible:bg-muted focus-visible:outline-none" (click)="close()">{{ i18n.t('shell.profileLink') }}</a>
        <button type="button" role="menuitem" class="block w-full px-4 py-2.5 text-left text-sm hover:bg-muted focus-visible:bg-muted focus-visible:outline-none" (click)="signOut()">{{ i18n.t('common.signOut') }}</button>
      </div>
    }
  `,
})
export class UserMenu {
  protected readonly i18n = inject(Translator);
  private readonly session = inject(SessionService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  protected readonly user = inject(SessionStore).user;
  protected readonly open = signal(false);
  protected readonly initials = computed(() => initialsOf(this.user()?.username ?? '?'));

  protected close(): void {
    this.open.set(false);
  }

  protected closeOutside(event: Event): void {
    if (this.open() && !this.host.nativeElement.contains(event.target as Node)) this.close();
  }

  protected signOut(): void {
    this.close();
    void this.session.logout();
  }
}
