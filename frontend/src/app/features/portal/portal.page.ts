import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { MoneyFormatter, minorDigitsOf } from '../../core/billing/money';
import { toApiError } from '../../core/http/api-error';
import { Translator } from '../../core/i18n/translator';
import { PortalGateway } from '../../core/portal/portal.gateway';
import { PortalAppointment, PortalInvoice, PortalPatient, PortalPrescription, PortalResult } from '../../core/portal/portal.models';
import { DateTimeFormatter } from '../../core/time/date-time-formatter';
import { Temporal } from '../../core/time/temporal';
import { failureMessage } from '../../shared/failure-message';
import { StatusTag, StatusTone } from '../../shared/status-tag';

/** Un chargement de section : en cours, échec (avec son message) ou données. Une section en échec ne masque pas les autres. */
type Section<T> = { readonly state: 'loading' } | { readonly state: 'error'; readonly message: string } | { readonly state: 'ready'; readonly items: readonly T[] };

/**
 * Mon espace : le patient lit ses rendez-vous, ses résultats d'analyses PUBLIÉS, ses ordonnances (et ce que la pharmacie a délivré) et ses factures. Le serveur ne
 * sert que le dossier auquel son compte est relié ; un compte non relié est invité à passer à l'accueil.
 */
@Component({
  selector: 'app-portal-page',
  imports: [StatusTag],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-col gap-8">
      <header class="flex flex-col gap-1">
        <h1 class="text-[28px] leading-9 font-semibold text-foreground">{{ i18n.t('portal.title') }}</h1>
        @if (me(); as p) {
          <p class="text-sm text-muted-foreground" data-test="me"><span class="font-medium text-foreground">{{ p.firstName }} {{ p.lastName }}</span> · <span class="font-mono">{{ p.number }}</span> · {{ p.birthDate }}</p>
        }
      </header>

      @if (notLinked()) {
        <p class="border-l-4 border-status-warning bg-card p-4 text-sm" role="status" data-test="not-linked">{{ i18n.t('portal.notLinked') }}</p>
      } @else {
        @if (meError()) { <p class="border-l-4 border-status-critical bg-card p-3 text-sm text-status-critical" role="alert">{{ meError() }}</p> }

        <section class="flex flex-col gap-3" aria-labelledby="appts-title" data-test="appointments">
          <h2 id="appts-title" class="text-lg leading-[26px] font-semibold text-foreground">{{ i18n.t('portal.appointments.title') }}</h2>
          @switch (appointments().state) {
            @case ('error') { <p class="text-sm text-status-critical" role="alert">{{ errorOf(appointments()) }}</p> }
            @case ('ready') {
              <ul class="flex flex-col divide-y divide-border border border-border bg-card">
                @for (a of itemsOf(appointments()); track a.number) {
                  <li class="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
                    <span><span class="font-mono text-xs">{{ a.number }}</span> · {{ when(a.startsAt) }}</span>
                    <app-status-tag [tone]="appointmentTone(a)" [text]="i18n.t('portal.appointments.statuses.' + a.status)" />
                  </li>
                } @empty { <li class="px-4 py-3 text-sm text-muted-foreground">{{ i18n.t('portal.appointments.none') }}</li> }
              </ul>
            }
            @default { <p class="text-sm text-muted-foreground" role="status">{{ i18n.t('common.loading') }}</p> }
          }
        </section>

        <section class="flex flex-col gap-3" aria-labelledby="results-title" data-test="results">
          <h2 id="results-title" class="text-lg leading-[26px] font-semibold text-foreground">{{ i18n.t('portal.results.title') }}</h2>
          <p class="text-xs text-muted-foreground">{{ i18n.t('portal.results.lead') }}</p>
          @switch (results().state) {
            @case ('error') { <p class="text-sm text-status-critical" role="alert">{{ errorOf(results()) }}</p> }
            @case ('ready') {
              @for (r of itemsOf(results()); track r.number) {
                <div class="flex flex-col gap-2 border border-border bg-card p-4" [attr.data-test]="r.number">
                  <p class="text-sm"><span class="font-mono text-xs">{{ r.number }}</span> · {{ when(r.orderedAt) }}</p>
                  <table class="w-full text-left text-sm leading-6">
                    <caption class="sr-only">{{ i18n.t('portal.results.of', { number: r.number }) }}</caption>
                    <thead class="border-b border-border text-xs text-muted-foreground">
                      <tr>
                        <th scope="col" class="py-1 pr-3 font-medium">{{ i18n.t('portal.results.test') }}</th>
                        <th scope="col" class="py-1 pr-3 font-medium">{{ i18n.t('portal.results.value') }}</th>
                        <th scope="col" class="py-1 pr-3 font-medium">{{ i18n.t('portal.results.reference') }}</th>
                        <th scope="col" class="py-1 font-medium"><span class="sr-only">{{ i18n.t('portal.results.flag') }}</span></th>
                      </tr>
                    </thead>
                    <tbody>
                      @for (i of r.items; track i.testName) {
                        <tr class="border-b border-border last:border-b-0">
                          <td class="py-1 pr-3">{{ i.testName }}@if (i.amended) { <span class="block text-xs text-muted-foreground">{{ i18n.t('portal.results.amended') }}</span> }</td>
                          <td class="py-1 pr-3 font-mono">{{ i.value ?? '—' }} {{ i.unit ?? '' }}</td>
                          <td class="py-1 pr-3 font-mono text-xs text-muted-foreground">{{ range(i.refLow, i.refHigh) }}</td>
                          <td class="py-1">@if (i.flag && i.flag !== 'NORMAL') { <app-status-tag [tone]="i.flag.startsWith('CRITICAL') ? 'critical' : 'warning'" [text]="i18n.t('portal.results.flags.' + i.flag)" /> }</td>
                        </tr>
                      }
                    </tbody>
                  </table>
                </div>
              } @empty { <p class="border border-border bg-card px-4 py-3 text-sm text-muted-foreground">{{ i18n.t('portal.results.none') }}</p> }
            }
            @default { <p class="text-sm text-muted-foreground" role="status">{{ i18n.t('common.loading') }}</p> }
          }
        </section>

        <section class="flex flex-col gap-3" aria-labelledby="rx-title" data-test="prescriptions">
          <h2 id="rx-title" class="text-lg leading-[26px] font-semibold text-foreground">{{ i18n.t('portal.prescriptions.title') }}</h2>
          @switch (prescriptions().state) {
            @case ('error') { <p class="text-sm text-status-critical" role="alert">{{ errorOf(prescriptions()) }}</p> }
            @case ('ready') {
              @for (p of itemsOf(prescriptions()); track p.number) {
                <div class="flex flex-col gap-2 border border-border bg-card p-4" [attr.data-test]="p.number">
                  <p class="flex flex-wrap items-center gap-2 text-sm"><span class="font-mono text-xs">{{ p.number }}</span> · {{ when(p.issuedAt) }}
                    <app-status-tag [tone]="prescriptionTone(p)" [text]="prescriptionLabel(p)" /></p>
                  <ul class="flex flex-col divide-y divide-border text-sm">
                    @for (l of p.lines; track l.drugName) {
                      <li class="py-2"><span class="font-medium">{{ l.drugName }}@if (l.strength) { · {{ l.strength }}}</span>
                        <span class="block text-muted-foreground">{{ l.dose }} · {{ l.frequency }}@if (l.durationDays) { · {{ i18n.t('portal.prescriptions.days', { n: l.durationDays }) }}} · {{ i18n.t('portal.prescriptions.qty', { n: l.quantity, unit: l.unit }) }}</span></li>
                    }
                  </ul>
                </div>
              } @empty { <p class="border border-border bg-card px-4 py-3 text-sm text-muted-foreground">{{ i18n.t('portal.prescriptions.none') }}</p> }
            }
            @default { <p class="text-sm text-muted-foreground" role="status">{{ i18n.t('common.loading') }}</p> }
          }
        </section>

        <section class="flex flex-col gap-3" aria-labelledby="inv-title" data-test="invoices">
          <h2 id="inv-title" class="text-lg leading-[26px] font-semibold text-foreground">{{ i18n.t('portal.invoices.title') }}</h2>
          @switch (invoices().state) {
            @case ('error') { <p class="text-sm text-status-critical" role="alert">{{ errorOf(invoices()) }}</p> }
            @case ('ready') {
              <ul class="flex flex-col divide-y divide-border border border-border bg-card">
                @for (v of itemsOf(invoices()); track v.number) {
                  <li class="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm" [attr.data-test]="v.number">
                    <span class="flex flex-wrap items-center gap-2"><span class="font-mono text-xs">{{ v.number }}</span>
                      <app-status-tag [tone]="invoiceTone(v)" [text]="i18n.t('portal.invoices.statuses.' + v.status)" /></span>
                    <span class="font-mono text-xs">{{ i18n.t('portal.invoices.amounts', { total: money(v.total, v.currency), paid: money(v.paid, v.currency), balance: money(v.balance, v.currency) }) }}</span>
                  </li>
                } @empty { <li class="px-4 py-3 text-sm text-muted-foreground">{{ i18n.t('portal.invoices.none') }}</li> }
              </ul>
            }
            @default { <p class="text-sm text-muted-foreground" role="status">{{ i18n.t('common.loading') }}</p> }
          }
        </section>
      }
    </div>
  `,
})
export class PortalPage implements OnInit {
  protected readonly i18n = inject(Translator);
  private readonly gateway = inject(PortalGateway);
  private readonly dates = inject(DateTimeFormatter);
  private readonly formatter = inject(MoneyFormatter);

  protected readonly me = signal<PortalPatient | null>(null);
  protected readonly meError = signal<string | null>(null);
  protected readonly notLinked = signal(false);
  protected readonly appointments = signal<Section<PortalAppointment>>({ state: 'loading' });
  protected readonly results = signal<Section<PortalResult>>({ state: 'loading' });
  protected readonly prescriptions = signal<Section<PortalPrescription>>({ state: 'loading' });
  protected readonly invoices = signal<Section<PortalInvoice>>({ state: 'loading' });

  async ngOnInit(): Promise<void> {
    try {
      this.me.set(await this.gateway.getMe());
    } catch (error) {
      if (toApiError(error).code === 'PORTAL_NOT_LINKED') return this.notLinked.set(true);
      this.meError.set(failureMessage(error, this.i18n));
    }
    await Promise.all([
      this.load(this.appointments, () => this.gateway.getAppointments()),
      this.load(this.results, () => this.gateway.getResults()),
      this.load(this.prescriptions, () => this.gateway.getPrescriptions()),
      this.load(this.invoices, () => this.gateway.getInvoices()),
    ]);
  }

  private async load<T>(target: { set(value: Section<T>): void }, read: () => Promise<readonly T[]>): Promise<void> {
    try {
      target.set({ state: 'ready', items: await read() });
    } catch (error) {
      target.set({ state: 'error', message: failureMessage(error, this.i18n) ?? '' });
    }
  }

  protected itemsOf<T>(section: Section<T>): readonly T[] {
    return section.state === 'ready' ? section.items : [];
  }

  protected errorOf(section: Section<unknown>): string {
    return section.state === 'error' ? section.message : '';
  }

  protected appointmentTone(a: PortalAppointment): StatusTone {
    return a.status === 'ARRIVED' ? 'success' : a.status === 'SCHEDULED' ? 'warning' : 'critical';
  }

  protected prescriptionTone(p: PortalPrescription): StatusTone {
    return p.status === 'CANCELLED' ? 'critical' : p.dispensing === 'COMPLETE' ? 'success' : p.dispensing === 'PARTIAL' ? 'warning' : 'neutral';
  }

  protected prescriptionLabel(p: PortalPrescription): string {
    return p.status === 'CANCELLED' ? this.i18n.t('portal.prescriptions.cancelled') : this.i18n.t(`portal.prescriptions.states.${p.dispensing}`);
  }

  protected invoiceTone(v: PortalInvoice): StatusTone {
    return v.status === 'PAID' ? 'success' : v.status === 'CANCELLED' ? 'critical' : 'warning';
  }

  protected money(amount: number, currency: string): string {
    return this.formatter.format(amount, currency, minorDigitsOf(currency));
  }

  protected range(low: number | null, high: number | null): string {
    if (low === null && high === null) return '—';
    return `${low ?? ''} – ${high ?? ''}`.replace('.', ',');
  }

  protected when(iso: string): string {
    return this.dates.dateTime(Temporal.Instant.from(iso));
  }
}
