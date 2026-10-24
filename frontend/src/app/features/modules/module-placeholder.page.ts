import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { map } from 'rxjs';
import { Translator } from '../../core/i18n/translator';
import { findNavItem } from '../../core/navigation/navigation';
import { PanelCard } from '../../shared/panel-card';

/** Écran provisoire d'un module du menu pas encore migré : il garde le menu entièrement navigable et dit la vérité sur son état. */
@Component({
  selector: 'app-module-placeholder-page',
  imports: [PanelCard],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-col gap-6">
      <h1 class="text-[28px] leading-9 font-semibold text-foreground">{{ title() }}</h1>
      <app-panel-card>
        <p class="text-sm leading-6 text-muted-foreground">{{ i18n.t('modules.soon') }}</p>
      </app-panel-card>
    </div>
  `,
})
export class ModulePlaceholderPage {
  protected readonly i18n = inject(Translator);
  private readonly module = toSignal(inject(ActivatedRoute).paramMap.pipe(map((p) => p.get('module') ?? '')), { initialValue: '' });
  protected readonly title = computed(() => this.i18n.t(findNavItem(this.module())?.labelKey ?? `nav.${this.module()}`));
}
