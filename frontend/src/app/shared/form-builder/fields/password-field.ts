import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { Translator } from '../../../core/i18n/translator';
import { FieldContext, InputRenderer } from '../field-context';
import { TONE_TEXT, fieldControlClass } from '../field-styles';
import { PasswordField, Tone } from '../form-schema';
import { PolicyRule, activeRules, evaluateRule, identityValuesOf, policyMinLength, strengthOf, unmetRules } from '../password-policy';
import { useFieldAttributes } from './field-attributes';
import { FieldShell } from './field-shell';

const STRENGTH_TONE: Readonly<Record<number, Tone>> = { 1: 'critical', 2: 'warning', 3: 'info', 4: 'success' };
const SEGMENT_COLOR: Readonly<Record<Tone, string>> = { critical: 'bg-status-critical', warning: 'bg-status-warning', info: 'bg-status-info', success: 'bg-status-success' };

/**
 * Mot de passe : bouton « Afficher / Masquer » dans le cadre et, quand le champ porte une règle `passwordPolicy`, jauge de
 * force et liste des règles qui se cochent pendant la frappe (comme dans le design de création de mot de passe).
 */
@Component({
  selector: 'app-password-field',
  imports: [ReactiveFormsModule, FieldShell],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex flex-col gap-[6px]' },
  template: `
    <app-field-shell [field]="field()" [control]="control()" [inputId]="attrs.id()">
      <input
        [id]="attrs.id()"
        [formControl]="control()"
        [type]="visible() ? 'text' : 'password'"
        [class]="inputClass()"
        [attr.placeholder]="attrs.placeholder()"
        [attr.autocomplete]="field().autocomplete ?? null"
        [attr.maxlength]="attrs.maxLength()"
        [attr.aria-required]="attrs.required() || null"
        [attr.aria-invalid]="attrs.invalid() || null"
        [attr.aria-describedby]="attrs.describedBy()"
        autocapitalize="none"
        spellcheck="false"
      />
      @if (field().revealable !== false) {
        <button
          type="button"
          class="shrink-0 rounded-[2px] text-xs leading-[18px] text-primary hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          [attr.aria-pressed]="visible()"
          [attr.aria-controls]="attrs.id()"
          (click)="visible.set(!visible())"
        >
          {{ visible() ? i18n.t('form.password.hide') : i18n.t('form.password.show') }}
        </button>
      }
    </app-field-shell>

    @if (policy(); as p) {
      <div class="flex flex-col gap-[6px]">
        <div class="flex gap-1" aria-hidden="true">
          @for (segment of segments; track segment) {
            <div class="h-1 min-w-px flex-1" [class]="segmentClass(segment)"></div>
          }
        </div>
        @if (p.strength > 0) {
          <p class="text-xs leading-[18px]" [class]="toneClass()" role="status">{{ i18n.t('form.password.strength.' + p.strength) }}</p>
        }
        <ul class="flex flex-col gap-[6px]">
          @for (rule of p.rules; track rule.id) {
            <li class="text-xs leading-[18px]" [class]="rule.met ? 'text-status-success' : p.touched ? 'text-status-critical' : 'text-muted-foreground'">
              <span aria-hidden="true" class="font-mono">{{ rule.met ? '✓' : '○' }}</span>
              {{ rule.label }}
              <span class="sr-only">{{ rule.met ? i18n.t('form.password.ruleMet') : i18n.t('form.password.ruleUnmet') }}</span>
            </li>
          }
        </ul>
      </div>
    }
  `,
})
export class PasswordFieldComponent extends InputRenderer<PasswordField> {
  protected readonly i18n = inject(Translator);
  private readonly ctx = inject(FieldContext);

  protected readonly attrs = useFieldAttributes(this.field, this.control);
  protected readonly visible = signal(false);
  protected readonly segments = [1, 2, 3, 4];
  protected readonly inputClass = computed(() => fieldControlClass(this.field().appearance ?? 'default', this.field().inputClass));

  /** Règle `passwordPolicy` du champ, s'il y en a une et que l'affichage n'est pas désactivé. */
  private readonly spec = computed(() => (this.field().showPolicy === false ? undefined : this.field().validators?.find((v) => v.type === 'passwordPolicy')));

  protected readonly policy = computed(() => {
    const spec = this.spec();
    if (!spec) return null;
    this.ctx.version();
    const password = String(this.control().value ?? '');
    const identityValues = identityValuesOf(spec, (name) => String(this.ctx.values()[name] ?? ''));
    const unmet = unmetRules(password, spec, { identityValues });
    const rules = activeRules(spec).map((id: PolicyRule) => ({
      id,
      met: password !== '' && evaluateRule(id, password, spec, { identityValues }),
      label: this.i18n.t(`form.password.rules.${id}`, { min: policyMinLength(spec) }),
    }));
    return { rules, strength: strengthOf(password, unmet), touched: this.ctx.showError(this.control()) || password !== '' };
  });

  protected readonly toneClass = computed(() => TONE_TEXT[STRENGTH_TONE[this.policy()?.strength ?? 1] ?? 'critical']);

  protected segmentClass(segment: number): string {
    const strength = this.policy()?.strength ?? 0;
    return segment <= strength ? SEGMENT_COLOR[STRENGTH_TONE[strength]] : 'bg-border';
  }
}
