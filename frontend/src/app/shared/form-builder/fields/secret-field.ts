import { Clipboard } from '@angular/cdk/clipboard';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { Translator } from '../../../core/i18n/translator';
import { ToastService } from '../../toast/toast.service';
import { DisplayRenderer } from '../field-context';
import { SecretField } from '../form-schema';

/** Valeur à recopier à la main (clé d'enrôlement), affichée par groupes de 4 caractères, avec « Copier ». */
@Component({
  selector: 'app-secret-field',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex flex-col gap-1.5' },
  template: `
    <p class="text-xs leading-[18px] text-muted-foreground">{{ label() }}</p>
    <div class="flex items-start justify-between gap-3 border border-border p-3">
      <p class="font-mono text-sm leading-[22px] break-all text-foreground select-all">{{ shown() }}</p>
      <button type="button" class="shrink-0 rounded-[2px] text-xs font-semibold text-primary hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none" (click)="copy()">
        {{ i18n.t(field().copyLabel) }}
      </button>
    </div>
  `,
})
export class SecretFieldComponent extends DisplayRenderer<SecretField> {
  protected readonly i18n = inject(Translator);
  private readonly clipboard = inject(Clipboard);
  private readonly toast = inject(ToastService);

  protected readonly label = computed(() => this.i18n.t(this.field().label));
  protected readonly shown = computed(() => (this.field().grouped === false ? this.field().value : (this.field().value.match(/.{1,4}/g) ?? []).join(' ')));

  protected copy(): void {
    // On copie la valeur brute (sans espaces) : c'est ce que les applications d'authentification attendent.
    if (this.clipboard.copy(this.field().value)) this.toast.show(this.i18n.t(this.field().copiedLabel));
  }
}
