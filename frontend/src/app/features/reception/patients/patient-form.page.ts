import { ChangeDetectionStrategy, Component, OnInit, computed, inject, input, signal, viewChild } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { toApiError } from '../../../core/http/api-error';
import { Translator } from '../../../core/i18n/translator';
import { ReceptionGateway } from '../../../core/reception/reception.gateway';
import { DuplicateCandidate, Patient } from '../../../core/reception/reception.models';
import { failureMessage } from '../../../shared/failure-message';
import { FormBuilderComponent } from '../../../shared/form-builder/form-builder';
import { FormAction } from '../../../shared/form-builder/form-schema';
import { ToastService } from '../../../shared/toast/toast.service';
import { personName } from '../reception-status';
import { patientFields, toPatientInput } from '../reception.forms';

const LINK = 'rounded-[2px] font-medium text-primary underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-50';
const SECONDARY = 'inline-flex min-h-11 items-center rounded-[2px] border border-border bg-background px-4 text-sm font-semibold text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-50';

/**
 * Ouverture ou correction d'un dossier patient. À l'ouverture, le serveur cherche les dossiers qui ressemblent (même pièce d'identité, même
 * nom et naissance, même téléphone et naissance) : s'il y en a, il refuse et les liste ; l'accueil ouvre alors le dossier existant, ou confirme
 * que la personne est bien différente. Une correction exige un motif, archivé avec la nouvelle version du dossier.
 */
@Component({
  selector: 'app-patient-form-page',
  imports: [RouterLink, FormBuilderComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-col gap-6">
      <a [routerLink]="editing() ? ['/patients', id()] : ['/patients']" [class]="link" class="w-fit text-sm">← {{ i18n.t(editing() ? 'reception.patient.backToRecord' : 'reception.patient.backToSearch') }}</a>
      <header class="flex flex-col">
        <h1 class="text-[28px] leading-9 font-semibold text-foreground">{{ i18n.t(editing() ? 'reception.patient.editTitle' : 'reception.patient.newTitle') }}</h1>
        <p class="text-sm leading-6 text-muted-foreground">{{ i18n.t(editing() ? 'reception.patient.editLead' : 'reception.patient.newLead') }}</p>
      </header>

      @if (duplicates().length > 0) {
        <section class="flex flex-col gap-3 border border-status-warning bg-card p-4" role="alert" aria-labelledby="dup-title" data-test="duplicates">
          <h2 id="dup-title" class="text-lg leading-[26px] font-semibold text-foreground">{{ i18n.t('reception.duplicates.title') }}</h2>
          <p class="text-sm text-muted-foreground">{{ i18n.t('reception.duplicates.lead') }}</p>
          <ul class="flex flex-col divide-y divide-border border border-border">
            @for (c of duplicates(); track c.id) {
              <li class="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm" [attr.data-test]="c.number">
                <span>
                  <span class="font-medium">{{ name(c) }}</span> <span class="font-mono text-xs">{{ c.number }}</span> · {{ c.birthDate }}
                  <span class="block text-xs text-muted-foreground">@for (r of c.reasons; track r; let last = $last) { {{ i18n.t('reception.duplicates.reasons.' + r) }}@if (!last) { ; } }</span>
                </span>
                <a [routerLink]="['/patients', c.id]" [class]="link" [attr.aria-label]="i18n.t('reception.duplicates.openOf', { name: name(c) })">{{ i18n.t('reception.duplicates.open') }}</a>
              </li>
            }
          </ul>
          <div><button type="button" [class]="secondary" [disabled]="busy()" (click)="saveAnyway()">{{ i18n.t('reception.duplicates.ignore') }}</button></div>
        </section>
      }

      @if (loadError()) {
        <p class="border-l-4 border-status-critical bg-card p-3 text-sm text-status-critical" role="alert">{{ loadError() }}</p>
      } @else if (ready()) {
        <div class="border border-border bg-card p-6">
          <app-form-builder #form [fields]="fields()" [busy]="busy()" formId="patient" (submitted)="save($event)" (action)="onAction($event)" />
        </div>
      }
    </div>
  `,
})
export class PatientFormPage implements OnInit {
  /** Présent sur la route de correction (`/patients/:id/edit`), absent à l'ouverture d'un dossier. */
  readonly id = input<string>();

  protected readonly i18n = inject(Translator);
  private readonly gateway = inject(ReceptionGateway);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  private readonly form = viewChild<FormBuilderComponent>('form');

  protected readonly link = LINK;
  protected readonly secondary = SECONDARY;
  protected readonly editing = computed(() => !!this.id());
  protected readonly patient = signal<Patient | null>(null);
  protected readonly ready = signal(false);
  protected readonly loadError = signal<string | null>(null);
  protected readonly busy = signal(false);
  protected readonly notice = signal<string | null>(null);
  protected readonly duplicates = signal<readonly DuplicateCandidate[]>([]);
  private lastValues: Record<string, unknown> = {};

  protected readonly fields = computed(() => patientFields({ patient: this.patient(), editing: this.editing(), notice: this.notice() }));

  async ngOnInit(): Promise<void> {
    const id = this.id();
    if (!id) return this.ready.set(true);
    try {
      this.patient.set(await this.gateway.getPatient(id));
      this.ready.set(true);
    } catch (error) {
      this.loadError.set(failureMessage(error, this.i18n));
    }
  }

  protected save(values: Record<string, unknown>): Promise<void> {
    this.lastValues = values;
    return this.submit(false);
  }

  protected saveAnyway(): Promise<void> {
    return this.submit(true);
  }

  private async submit(ignoreDuplicates: boolean): Promise<void> {
    const mapped = toPatientInput(this.lastValues, this.editing());
    if ('error' in mapped) return this.notice.set(this.i18n.t(mapped.error));
    this.notice.set(null);
    this.busy.set(true);
    const input = ignoreDuplicates ? { ...mapped.input, ignoreDuplicates: true } : mapped.input;
    try {
      const saved = this.editing() ? await this.gateway.updatePatient(this.id()!, input) : await this.gateway.registerPatient(input);
      this.toast.show(this.i18n.t(this.editing() ? 'reception.patient.saved' : 'reception.patient.created', { number: saved.number }));
      await this.router.navigate(['/patients', saved.id]);
    } catch (error) {
      const api = toApiError(error);
      if (api.code === 'PATIENT_POSSIBLE_DUPLICATE') {
        const candidates = (api.body as { candidates?: DuplicateCandidate[] } | null)?.candidates ?? [];
        this.duplicates.set(candidates);
        this.notice.set(null);
      } else {
        this.duplicates.set([]);
        this.notice.set(failureMessage(error, this.i18n, this.form()));
      }
    } finally {
      this.busy.set(false);
    }
  }

  protected onAction(event: FormAction): void {
    if (event.action === 'cancel') void this.router.navigate(this.editing() ? ['/patients', this.id()] : ['/patients']);
  }

  protected name(p: { lastName: string; firstName: string }): string {
    return personName(p);
  }
}
