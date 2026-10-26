import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { NgTemplateOutlet } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { filter } from 'rxjs';
import { SessionStore } from '../../core/auth/session.store';
import { ESTABLISHMENT } from '../../core/config/establishment.config';
import { Translator } from '../../core/i18n/translator';
import { TranslatedTitleStrategy } from '../../core/i18n/translated-title.strategy';
import { NAVIGATION, NavItem, isRouteActive, visibleNavigation } from '../../core/navigation/navigation';
import { Clock } from '../../core/time/clock';
import { DateTimeFormatter } from '../../core/time/date-time-formatter';
import { BrandEmblem } from '../../shared/brand-emblem';
import { Icon } from '../../shared/icons/icon';
import { Preferences } from '../../shared/preferences';
import { ShellState } from './shell-state';
import { UserMenu } from './user-menu';

/** Rôles par ordre d'importance d'affichage : le premier que possède l'utilisateur donne son libellé à la barre de navigation. */
const ROLE_PRIORITY = ['SYSTEM_ADMIN', 'DPO_AUDITOR', 'DOCTOR', 'NURSE', 'PHARMACIST', 'RADIOLOGIST', 'LAB_TECHNICIAN', 'ACCOUNTANT', 'CASHIER', 'RECEPTIONIST', 'PATIENT'];

/**
 * Layout n° 2 — espace de travail connecté : navigation latérale (développée ou réduite à un rail d'icônes), barre de contexte
 * (fil d'Ariane, recherche, aide, langue, thème, menu utilisateur) et zone principale dans laquelle s'affiche l'écran de la route.
 * Le menu ne montre que ce que le rôle permet ; sur mobile il devient un tiroir ouvert par le bouton de la barre de contexte.
 */
@Component({
  selector: 'app-shell-layout',
  imports: [NgTemplateOutlet, RouterOutlet, RouterLink, RouterLinkActive, BrandEmblem, Icon, Preferences, UserMenu],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './shell-layout.html',
})
export class ShellLayout {
  protected readonly i18n = inject(Translator);
  protected readonly establishment = inject(ESTABLISHMENT);
  private readonly state = inject(ShellState);
  private readonly user = inject(SessionStore).user;
  private readonly router = inject(Router);
  private readonly titles = inject(TranslatedTitleStrategy);
  private readonly formatter = inject(DateTimeFormatter);
  private readonly today = inject(Clock).now();

  protected readonly collapsed = this.state.collapsed;
  protected readonly mobileOpen = signal(false);
  protected readonly openGroups = signal<ReadonlySet<string>>(new Set());

  protected readonly items = computed(() => visibleNavigation(NAVIGATION, this.user()?.roles ?? [], this.user()?.permissions ?? []));
  protected readonly roleLabel = computed(() => {
    const roles = this.user()?.roles ?? [];
    const code = ROLE_PRIORITY.find((r) => roles.includes(r)) ?? roles[0];
    return code ? this.i18n.t(`roles.${code}`) : '';
  });
  protected readonly pageTitle = computed(() => {
    const key = this.titles.currentKey();
    return key ? this.i18n.t(key) : '';
  });
  protected readonly date = computed(() => this.formatter.date(this.today));
  protected readonly appName = computed(() => this.i18n.t('app.name'));

  /** Les classes `md:` ne s'appliquent qu'aux écrans larges : sur mobile le tiroir est toujours développé. */
  protected readonly hideWhenCollapsed = computed(() => (this.collapsed() ? 'md:hidden' : ''));
  protected readonly centerWhenCollapsed = computed(() => (this.collapsed() ? 'md:justify-center' : ''));
  /** Sous-entrée d'un groupe : décalée sous son titre ; en rail d'icônes (écran large), centrée comme les autres. */
  protected readonly nestedClass = computed(() => (this.collapsed() ? 'pl-4 md:justify-center md:pl-0' : 'pl-4'));
  protected readonly navClass = computed(
    () =>
      'fixed inset-y-0 left-0 z-40 flex w-[248px] shrink-0 flex-col gap-5 overflow-y-auto bg-brand-deep p-6 transition-transform md:sticky md:top-0 md:h-dvh md:translate-x-0 ' +
      (this.mobileOpen() ? 'translate-x-0 ' : '-translate-x-full ') +
      (this.collapsed() ? 'md:w-[72px] md:p-4' : ''),
  );

  constructor() {
    // Le titre de l'onglet suit la langue ; le tiroir mobile se referme à chaque navigation.
    effect(() => {
      this.i18n.locale();
      this.titles.render();
    });
    this.router.events.pipe(filter((e) => e instanceof NavigationEnd), takeUntilDestroyed()).subscribe((e) => {
      this.mobileOpen.set(false);
      this.openActiveGroup(e.urlAfterRedirects);
    });
    this.openActiveGroup(this.router.url);
  }

  protected isOpen(group: NavItem): boolean {
    return this.openGroups().has(group.id);
  }

  protected toggleGroup(group: NavItem): void {
    this.openGroups.update((set) => {
      const next = new Set(set);
      if (!next.delete(group.id)) next.add(group.id);
      return next;
    });
  }

  /** Le groupe qui contient l'écran affiché s'ouvre tout seul (arrivée directe sur une adresse, redirection). */
  private openActiveGroup(url: string): void {
    const active = this.items().filter((item) => item.children?.some((child) => isRouteActive(child.route, url)));
    if (active.length > 0) this.openGroups.update((set) => new Set([...set, ...active.map((g) => g.id)]));
  }

  /** Rail d'icônes (écran large) : les sous-entrées restent visibles, sans le titre du groupe. Sinon, visibles seulement si le groupe est ouvert. */
  protected groupListClass(group: NavItem): string {
    if (this.isOpen(group)) return 'block';
    return this.collapsed() ? 'hidden md:block' : 'hidden';
  }

  protected toggleCollapsed(): void {
    this.state.toggle();
  }
}
