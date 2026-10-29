import { ChangeDetectionStrategy, Component, computed, inject, signal, viewChild } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { BillingGateway } from '../../../core/billing/billing.gateway';
import { Translator } from '../../../core/i18n/translator';
import { PatientSearchGateway, PatientSummary } from '../../../core/patients/patient-search.gateway';
import { failureMessage } from '../../../shared/failure-message';
import { FormBuilderComponent } from '../../../shared/form-builder/form-builder';
import { patientSearchFields } from '../billing.forms';

const LINK = 'rounded-[2px] font-medium text-primary underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-50';

/**
 * Nouvelle facture : on retrouve d'abord le patient (numéro de dossier ou nom), puis un brouillon est créé et ouvert pour y
 * ajouter les actes. La caisse ne voit du patient que son identité.
 */
@Component({
  selector: 'app-new-invoice-page',
  imports: [RouterLink, FormBuilderComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex max-w-3xl flex-col gap-6">
      <header class="flex flex-col">
        <h1 class="text-[28px] leading-9 font-semibold text-foreground">{{ i18n.t('billing.new.title') }}</h1>
        <p class="text-sm leading-6 text-muted-foreground">{{ i18n.t('billing.new.lead') }}</p>
      </header>

      <div class="flex flex-col gap-4 border border-border bg-card p-6">
        <app-form-builder #form [fields]="fields()" [busy]="searching()" formId="patient-search" (submitted)="search($event)" />
      </div>

      @if (createError()) {
        <p class="border-l-4 border-status-critical bg-card p-3 text-sm text-status-critical" role="alert">{{ createError() }}</p>
      }

      @if (results(); as page) {
        <div class="overflow-x-auto border border-border bg-card">
          <table class="w-full text-left text-sm leading-6">
            <caption class="sr-only">{{ i18n.t('billing.new.results') }}</caption>
            <thead class="border-b border-border bg-muted text-xs leading-[18px] text-muted-foreground">
              <tr>
                <th scope="col" class="px-4 py-2 font-medium">{{ i18n.t('billing.new.patient') }}</th>
                <th scope="col" class="px-4 py-2 font-medium">{{ i18n.t('billing.new.birth') }}</th>
                <th scope="col" class="px-4 py-2 font-medium"><span class="sr-only">{{ i18n.t('billing.actions') }}</span></th>
              </tr>
            </thead>
            <tbody>
              @for (patient of page.items; track patient.id) {
                <tr class="border-b border-border last:border-b-0">
                  <td class="px-4 py-3">
                    <span class="font-medium">{{ patient.lastName }} {{ patient.firstName }}</span>
                    <span class="block font-mono text-xs text-muted-foreground">{{ patient.number }}</span>
                  </td>
                  <td class="px-4 py-3">{{ i18n.t('billing.new.age', { age: patient.ageYears }) }} · {{ patient.birthDate }}@if (patient.city) { · {{ patient.city }}}</td>
                  <td class="px-4 py-3 text-right">
                    @if (patient.status === 'DECEASED') {
                      <span class="text-xs text-muted-foreground">{{ i18n.t('billing.new.deceased') }}</span>
                    }
                    <button type="button" [class]="link" [disabled]="creating()" [attr.aria-label]="i18n.t('billing.new.chooseOf', { name: patient.lastName + ' ' + patient.firstName })" (click)="choose(patient)">{{ i18n.t('billing.new.choose') }}</button>
                  </td>
                </tr>
              } @empty {
                <tr>
                  <td colspan="3" class="px-4 py-8 text-center text-muted-foreground">{{ i18n.t('billing.new.none') }}</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
        @if (page.total > page.items.length) {
          <p class="text-xs text-muted-foreground">{{ i18n.t('billing.new.refine', { shown: page.items.length, total: page.total }) }}</p>
        }
      }

      <a routerLink="/billing/invoices" [class]="link" class="w-fit text-sm">{{ i18n.t('billing.new.back') }}</a>
    </div>
  `,
})
export class NewInvoicePage {
  protected readonly i18n = inject(Translator);
  private readonly patients = inject(PatientSearchGateway);
  private readonly billing = inject(BillingGateway);
  private readonly router = inject(Router);
  private readonly form = viewChild<FormBuilderComponent>('form');

  protected readonly link = LINK;
  protected readonly searching = signal(false);
  protected readonly creating = signal(false);
  protected readonly results = signal<{ items: readonly PatientSummary[]; total: number } | null>(null);
  protected readonly createError = signal<string | null>(null);
  private readonly notice = signal<string | null>(null);

  protected readonly fields = computed(() => patientSearchFields({ notice: this.notice() }));

  protected async search(value: Record<string, unknown>): Promise<void> {
    this.notice.set(null);
    this.createError.set(null);
    this.searching.set(true);
    try {
      this.results.set(await this.patients.search(String(value['q']), 10));
    } catch (error) {
      this.results.set(null);
      this.notice.set(failureMessage(error, this.i18n, this.form()));
    } finally {
      this.searching.set(false);
    }
  }

  protected async choose(patient: PatientSummary): Promise<void> {
    this.createError.set(null);
    this.creating.set(true);
    try {
      const invoice = await this.billing.createInvoice(patient.id);
      await this.router.navigate(['/billing/invoices', invoice.id]);
    } catch (error) {
      this.createError.set(failureMessage(error, this.i18n));
    } finally {
      this.creating.set(false);
    }
  }
}
