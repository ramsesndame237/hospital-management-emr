import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { DomSanitizer, SafeUrl } from '@angular/platform-browser';
import { Translator } from '../../../core/i18n/translator';
import { DisplayRenderer } from '../field-context';
import { QrField } from '../form-schema';

/** Encre sombre sur fond blanc : le contraste maximal rend le code lisible par tous les téléphones, y compris en thème sombre. */
const QR_COLORS = { dark: '#06324a', light: '#ffffff' } as const;

/**
 * QR code d'enrôlement et ses consignes (design AUTH-08). Le code est calculé DANS le navigateur : le secret ne quitte jamais
 * l'appareil et aucun service de QR code tiers n'est appelé. La bibliothèque n'est chargée que sur cet écran.
 */
@Component({
  selector: 'app-qr-field',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex flex-col items-start gap-5 sm:flex-row sm:items-center' },
  template: `
    <div class="grid size-[136px] shrink-0 place-items-center bg-white" [attr.aria-busy]="!src()">
      @if (src(); as url) {
        <img [src]="url" class="size-full" [alt]="i18n.t('form.qr.alt')" width="136" height="136" />
      }
    </div>
    <div class="flex min-w-0 flex-1 flex-col gap-2">
      <p class="text-sm leading-[22px] font-semibold text-foreground">{{ title() }}</p>
      <p class="text-xs leading-[18px] text-muted-foreground">{{ text() }}</p>
      @if (caption(); as line) {
        <p class="text-xs leading-[18px] text-muted-foreground">{{ line }}</p>
      }
    </div>
  `,
})
export class QrFieldComponent extends DisplayRenderer<QrField> {
  protected readonly i18n = inject(Translator);
  private readonly sanitizer = inject(DomSanitizer);

  protected readonly src = signal<SafeUrl | null>(null);
  protected readonly title = computed(() => this.i18n.t(this.field().title, this.field().params));
  protected readonly text = computed(() => this.i18n.t(this.field().text, this.field().params));
  protected readonly caption = computed(() => (this.field().caption ? this.i18n.t(this.field().caption!, this.field().params) : null));

  constructor() {
    super();
    effect((onCleanup) => {
      const value = this.field().value;
      let current = true;
      onCleanup(() => (current = false));
      void import('qrcode').then(async (module) => {
        const toString = (module.default ?? module).toString;
        const svg = await toString(value, { type: 'svg', margin: 0, errorCorrectionLevel: 'M', color: QR_COLORS });
        // Le SVG est produit ici, à partir d'une valeur que nous maîtrisons : on peut le déclarer sûr pour l'attribut `src` d'une image
        // (une image SVG ne peut pas exécuter de script).
        if (current) this.src.set(this.sanitizer.bypassSecurityTrustUrl(`data:image/svg+xml;base64,${btoa(svg)}`));
      });
    });
  }
}
