import { ChangeDetectionStrategy, Component, OnInit, computed, inject, input, signal, viewChild } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { fromMinorUnits, MoneyFormatter, minorDigitsOf, toMinorUnits } from '../../../core/billing/money';
import { Translator } from '../../../core/i18n/translator';
import { PharmacyGateway } from '../../../core/pharmacy/pharmacy.gateway';
import { DrugSummary, OrderLineInput, Suggestion, Supplier } from '../../../core/pharmacy/pharmacy.models';
import { failureMessage } from '../../../shared/failure-message';
import { FormBuilderComponent } from '../../../shared/form-builder/form-builder';
import { ToastService } from '../../../shared/toast/toast.service';
import { drugSearchFields, orderHeaderFields } from '../pharmacy.forms';

const LINK = 'rounded-[2px] font-medium text-primary underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-50';
const CELL = 'h-9 w-full min-w-24 border border-input bg-background px-2 font-mono text-sm rounded-[2px] focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none';

/** Une ligne en cours de saisie : tout est du texte tant que le bon n'est pas enregistré. */
interface Line {
  readonly drug: DrugSummary;
  quantity: string;
  unitCost: string;
}

/**
 * Préparation d'un bon de commande (nouveau, ou brouillon à corriger) : fournisseur actif, date attendue, puis les médicaments — ajoutés d'après
 * les suggestions de réapprovisionnement ou par recherche. Un coût laissé vide prend celui du dernier lot reçu. Le bon reste un brouillon :
 * rien n'est commandé tant qu'il n'est pas soumis, puis approuvé par un autre pharmacien.
 */
@Component({
  selector: 'app-order-form-page',
  imports: [RouterLink, FormBuilderComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-col gap-6">
      <header class="flex flex-col">
        <h1 class="text-[28px] leading-9 font-semibold text-foreground">{{ i18n.t(editing() ? 'pharmacy.orders.editTitle' : 'pharmacy.orders.newTitle') }}</h1>
        <p class="text-sm leading-6 text-muted-foreground">{{ i18n.t('pharmacy.orders.formLead') }}</p>
      </header>

      @if (loadError()) {
        <p class="border-l-4 border-status-critical bg-card p-3 text-sm text-status-critical" role="alert">{{ loadError() }}</p>
      }

      @if (suggestions().length > 0) {
        <section class="flex flex-col gap-3 border border-border bg-card p-4" aria-labelledby="order-suggestions-title">
          <h2 id="order-suggestions-title" class="text-sm leading-6 font-semibold text-foreground">{{ i18n.t('pharmacy.orders.suggestionsTitle') }}</h2>
          <p class="text-xs text-muted-foreground">{{ i18n.t('pharmacy.orders.suggestionsLead') }}</p>
          <ul class="flex flex-col divide-y divide-border border border-border">
            @for (s of suggestions(); track s.drug.id) {
              <li class="flex flex-wrap items-center justify-between gap-3 px-3 py-2 text-sm" [attr.data-test]="'suggestion-' + s.drug.code">
                <span>
                  <span class="font-medium">{{ s.drug.name }}</span>
                  <span class="block text-xs text-muted-foreground">{{ i18n.t('pharmacy.orders.suggestionDetail', { level: i18n.t('pharmacy.level.' + s.level), stock: s.dispensable, onOrder: s.onOrder, suggested: s.suggested, unit: s.drug.unit }) }}</span>
                </span>
                <button type="button" [class]="link" [disabled]="has(s.drug.id)" [attr.aria-label]="i18n.t('pharmacy.orders.addSuggestionOf', { name: s.drug.name })" (click)="addSuggestion(s)">{{ i18n.t('pharmacy.receipt.add') }}</button>
              </li>
            }
          </ul>
        </section>
      }

      <section class="flex flex-col gap-3 border border-border bg-card p-4" aria-labelledby="order-search-title">
        <h2 id="order-search-title" class="text-sm leading-6 font-semibold text-foreground">{{ i18n.t('pharmacy.orders.searchTitle') }}</h2>
        <app-form-builder [fields]="searchFields" [busy]="searching()" formId="order-search" (submitted)="search($event)" />
        @if (searched()) {
          <ul class="flex flex-col divide-y divide-border border border-border" [attr.aria-label]="i18n.t('pharmacy.receipt.results')">
            @for (d of results(); track d.id) {
              <li class="flex items-center justify-between gap-4 px-3 py-2 text-sm" [attr.data-test]="d.code">
                <span><span class="font-medium">{{ d.name }}</span> <span class="text-muted-foreground">{{ d.genericName }}@if (d.strength) { · {{ d.strength }}} · {{ d.code }}</span></span>
                <button type="button" [class]="link" [disabled]="has(d.id)" [attr.aria-label]="i18n.t('pharmacy.orders.addOf', { name: d.name })" (click)="add(d)">{{ i18n.t('pharmacy.receipt.add') }}</button>
              </li>
            } @empty {
              <li class="px-3 py-3 text-sm text-muted-foreground">{{ i18n.t('pharmacy.receipt.noResult') }}</li>
            }
          </ul>
        }
      </section>

      <section class="flex flex-col gap-3" aria-labelledby="order-lines-title">
        <h2 id="order-lines-title" class="text-lg leading-[26px] font-semibold text-foreground">{{ i18n.t('pharmacy.orders.linesTitle') }}</h2>
        @if (lines().length === 0) {
          <p class="text-sm text-muted-foreground">{{ i18n.t('pharmacy.orders.noLines') }}</p>
        } @else {
          <div class="overflow-x-auto border border-border bg-card">
            <table class="w-full text-left text-sm leading-6">
              <caption class="sr-only">{{ i18n.t('pharmacy.orders.linesTitle') }}</caption>
              <thead class="border-b border-border bg-muted text-xs leading-[18px] text-muted-foreground">
                <tr>
                  <th scope="col" class="px-4 py-2 font-medium">{{ i18n.t('pharmacy.stock.drug') }}</th>
                  <th scope="col" class="px-4 py-2 font-medium">{{ i18n.t('pharmacy.orders.ordered') }}</th>
                  <th scope="col" class="px-4 py-2 font-medium">{{ i18n.t('pharmacy.receipt.unitCostIn', { currency: currency() }) }}</th>
                  <th scope="col" class="px-4 py-2 font-medium"><span class="sr-only">{{ i18n.t('pharmacy.actions') }}</span></th>
                </tr>
              </thead>
              <tbody>
                @for (line of lines(); track line.drug.id; let i = $index) {
                  <tr class="border-b border-border align-top last:border-b-0">
                    <td class="px-4 py-3"><span class="font-medium">{{ line.drug.name }}</span><span class="block text-xs text-muted-foreground">{{ line.drug.genericName }} · {{ line.drug.unit }}</span></td>
                    <td class="px-4 py-3"><input [class]="cell" [id]="'order-line-' + i + '-quantity'" type="text" inputmode="numeric" [attr.aria-label]="i18n.t('pharmacy.receipt.quantityOf', { n: i + 1 })" [value]="line.quantity" (input)="set(i, 'quantity', $any($event.target).value)" /></td>
                    <td class="px-4 py-3"><input [class]="cell" [id]="'order-line-' + i + '-unitCost'" type="text" inputmode="decimal" [attr.aria-label]="i18n.t('pharmacy.receipt.costOf', { n: i + 1 })" [value]="line.unitCost" (input)="set(i, 'unitCost', $any($event.target).value)" /></td>
                    <td class="px-4 py-3 text-right"><button type="button" [class]="link" [attr.aria-label]="i18n.t('pharmacy.receipt.removeOf', { n: i + 1 })" (click)="remove(i)">{{ i18n.t('pharmacy.receipt.remove') }}</button></td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
          <p class="text-xs text-muted-foreground">{{ i18n.t('pharmacy.orders.costHint') }}</p>
        }
        @if (lineError()) {
          <p class="border-l-4 border-status-critical bg-card p-3 text-sm text-status-critical" role="alert">{{ lineError() }}</p>
        }
      </section>

      @if (ready()) {
        <section class="flex max-w-3xl flex-col gap-3 border border-border bg-card p-6" aria-labelledby="order-header-title">
          <h2 id="order-header-title" class="text-lg leading-[26px] font-semibold text-foreground">{{ i18n.t('pharmacy.orders.headerTitle') }}</h2>
          <app-form-builder #header [fields]="headerFields()" [busy]="busy()" formId="order-header" (submitted)="submit($event)" />
          <a routerLink="/pharmacy/orders" [class]="link" class="w-fit text-sm">{{ i18n.t('pharmacy.orders.back') }}</a>
        </section>
      }
    </div>
  `,
})
export class OrderFormPage implements OnInit {
  /** Absent : nouveau bon. Présent : brouillon à corriger. */
  readonly id = input<string | undefined>(undefined);

  protected readonly i18n = inject(Translator);
  private readonly gateway = inject(PharmacyGateway);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  private readonly formatter = inject(MoneyFormatter);
  private readonly header = viewChild<FormBuilderComponent>('header');

  protected readonly link = LINK;
  protected readonly cell = CELL;
  protected readonly searchFields = drugSearchFields();
  protected readonly ready = signal(false);
  protected readonly loadError = signal<string | null>(null);
  protected readonly suppliers = signal<readonly Supplier[]>([]);
  protected readonly suggestions = signal<readonly Suggestion[]>([]);
  protected readonly searching = signal(false);
  protected readonly searched = signal(false);
  protected readonly results = signal<readonly DrugSummary[]>([]);
  protected readonly lines = signal<readonly Line[]>([]);
  protected readonly lineError = signal<string | null>(null);
  protected readonly busy = signal(false);
  protected readonly currency = signal('XAF');
  private readonly notice = signal<string | null>(null);
  private readonly initial = signal({ supplierId: '', expectedOn: '', notes: '' });

  protected readonly editing = computed(() => !!this.id());
  protected readonly headerFields = computed(() => {
    const i = this.initial();
    return orderHeaderFields({
      suppliers: this.suppliers(), supplierId: i.supplierId, expectedOn: i.expectedOn, notes: i.notes, notice: this.notice(), submitLabel: this.editing() ? 'pharmacy.orders.saveDraft' : 'pharmacy.orders.createDraft',
    });
  });

  ngOnInit(): void {
    void this.load();
  }

  private async load(): Promise<void> {
    try {
      const [suppliers, suggestions] = await Promise.all([this.gateway.listSuppliers({}, 0, 200), this.gateway.getSuggestions()]);
      this.suppliers.set(suppliers.items);
      this.suggestions.set(suggestions.items);
      this.currency.set(suggestions.currency);
      const id = this.id();
      if (id) {
        const order = await this.gateway.getOrder(id);
        this.currency.set(order.currency);
        const digits = minorDigitsOf(order.currency);
        this.initial.set({ supplierId: order.supplier?.id ?? '', expectedOn: order.expectedOn ?? '', notes: order.notes ?? '' });
        this.lines.set(order.lines.filter((l) => l.drug).map((l) => ({ drug: l.drug!, quantity: String(l.quantity), unitCost: fromMinorUnits(l.unitCost, digits) })));
      }
      this.ready.set(true);
    } catch (error) {
      this.loadError.set(failureMessage(error, this.i18n));
    }
  }

  protected has(drugId: string): boolean {
    return this.lines().some((l) => l.drug.id === drugId);
  }

  protected async search(value: Record<string, unknown>): Promise<void> {
    this.searching.set(true);
    try {
      const page = await this.gateway.listDrugs({ search: String(value['q'] ?? '').trim() || undefined }, 0, 10);
      this.results.set(page.items.map((d) => ({ id: d.id, code: d.code, name: d.name, genericName: d.genericName, strength: d.strength, unit: d.unit })));
      this.currency.set(page.currency);
      this.searched.set(true);
    } catch (error) {
      this.lineError.set(failureMessage(error, this.i18n));
    } finally {
      this.searching.set(false);
    }
  }

  protected add(drug: DrugSummary): void {
    if (this.has(drug.id)) return;
    this.lineError.set(null);
    this.lines.update((lines) => [...lines, { drug, quantity: '', unitCost: '' }]);
  }

  /** Une suggestion apporte sa quantité proposée et le coût du dernier lot reçu. */
  protected addSuggestion(s: Suggestion): void {
    if (this.has(s.drug.id)) return;
    this.lineError.set(null);
    const cost = s.lastUnitCost === null ? '' : fromMinorUnits(s.lastUnitCost, minorDigitsOf(this.currency()));
    this.lines.update((lines) => [...lines, { drug: s.drug, quantity: String(s.suggested), unitCost: cost }]);
  }

  protected remove(index: number): void {
    this.lines.update((lines) => lines.filter((_, i) => i !== index));
  }

  protected set(index: number, field: 'quantity' | 'unitCost', value: string): void {
    this.lines.update((lines) => lines.map((l, i) => (i === index ? { ...l, [field]: value } : l)));
  }

  /** Contrôle des lignes avant l'envoi : le premier défaut est dit avec le numéro de ligne ; l'API refait les mêmes contrôles. */
  private parse(): OrderLineInput[] | null {
    const digits = minorDigitsOf(this.currency());
    if (this.lines().length === 0) {
      this.lineError.set(this.i18n.t('pharmacy.orders.noLines'));
      return null;
    }
    const out: OrderLineInput[] = [];
    for (const [i, l] of this.lines().entries()) {
      const quantity = Number(l.quantity.trim());
      if (!/^\d+$/.test(l.quantity.trim()) || quantity < 1 || quantity > 1_000_000) {
        this.lineError.set(this.i18n.t('pharmacy.receipt.quantityInvalid', { n: i + 1 }));
        return null;
      }
      const cost = l.unitCost.trim() === '' ? undefined : toMinorUnits(l.unitCost, digits);
      if (cost === null) {
        this.lineError.set(this.i18n.t('pharmacy.receipt.costInvalid', { n: i + 1 }));
        return null;
      }
      out.push({ drugId: l.drug.id, quantity, ...(cost === undefined ? {} : { unitCost: cost }) });
    }
    this.lineError.set(null);
    return out;
  }

  protected async submit(value: Record<string, unknown>): Promise<void> {
    const lines = this.parse();
    if (!lines) return;
    this.notice.set(null);
    this.busy.set(true);
    try {
      const expectedOn = String(value['expectedOn'] ?? '').trim();
      const notes = String(value['notes'] ?? '').trim();
      const input = { supplierId: String(value['supplierId']), expectedOn: expectedOn || null, notes: notes || null, lines };
      const id = this.id();
      const saved = id ? await this.gateway.updateOrder(id, input) : await this.gateway.createOrder(input);
      this.toast.show(this.i18n.t(id ? 'pharmacy.orders.draftUpdated' : 'pharmacy.orders.draftCreated', { number: saved.number, total: this.formatter.format(saved.value, saved.currency, minorDigitsOf(saved.currency)) }));
      await this.router.navigate(['/pharmacy/orders', saved.id]);
    } catch (error) {
      this.notice.set(failureMessage(error, this.i18n, this.header()));
    } finally {
      this.busy.set(false);
    }
  }
}
