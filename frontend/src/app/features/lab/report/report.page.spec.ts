import { DOCUMENT } from '@angular/common';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ApiError } from '../../../core/http/api-error';
import { LabGateway } from '../../../core/lab/lab.gateway';
import { FakeLabGateway, report, reportItem } from '../../../core/lab/testing/fake-lab-gateway';
import { configureApp, settle, watchMissingKeys } from '../../../testing/app-testing';
import { LabReportPage } from './report.page';

const norm = (text: string) => text.replace(/\s+/g, ' ').trim();

function textOf(el: Element | null): string {
  if (!el) return '';
  const parts: string[] = [];
  const walker = el.ownerDocument.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) parts.push(node.textContent ?? '');
  return norm(parts.join(' '));
}

describe('LabReportPage', () => {
  let fixture: ComponentFixture<LabReportPage>;
  let lab: FakeLabGateway;
  let missingKeys: () => string[];
  const root = () => fixture.nativeElement as HTMLElement;
  const q = <T extends HTMLElement>(selector: string) => root().querySelector<T>(selector);
  const text = () => textOf(root());

  async function setup(loaded = report(), prepare?: (g: FakeLabGateway) => void) {
    lab = new FakeLabGateway();
    lab.getReport.mockResolvedValue(loaded);
    prepare?.(lab);
    const { i18n } = configureApp({ roles: ['DOCTOR'], permissions: ['lab.requisitions:read:own'], providers: [{ provide: LabGateway, useValue: lab }] });
    missingKeys = watchMissingKeys(i18n);
    fixture = TestBed.createComponent(LabReportPage);
    fixture.componentRef.setInput('id', 'r-1');
    await settle(fixture);
  }

  afterEach(() => expect(missingKeys()).toEqual([]));

  it('affiche le patient, la demande, les résultats publiés avec leurs valeurs de référence et leurs signatures', async () => {
    await setup();
    expect(lab.getReport).toHaveBeenCalledWith('r-1');
    expect(q('h1')?.textContent).toContain('Rapport d’analyses');
    expect(text()).toContain('LAB-0000123');
    expect(text()).toContain('Mbarga Élisabeth');
    expect(text()).toContain('PAT-0000001');
    expect(text()).toContain('Né(e) le 1990-03-14');
    expect(text()).toContain('par medecin');
    const row = textOf(q('tr[data-test="HGB"]'));
    expect(row).toContain('Hémoglobine');
    expect(row).toContain('13.5 g/dL');
    expect(row).toContain('Normal');
    expect(row).toContain('11.5 – 15.5 g/dL · critique < 7 ou > 20');
    expect(row).toContain('Validé par labo2');
    expect(row).toContain('Publié le');
    expect(row).toContain('par labo2');
    expect(text()).not.toContain('Rapport partiel');
    expect(text()).toContain('Document confidentiel');
    expect(q('.print-area')).not.toBeNull();
  });

  it('un rapport partiel le dit, et les analyses non publiées sont « en attente » sans valeur', async () => {
    await setup(report({ complete: false, items: [reportItem(), reportItem({ testCode: 'GLU', testName: 'Glycémie', status: 'PENDING', value: null, unit: null, flag: null, refLow: null, refHigh: null, criticalLow: null, criticalHigh: null, version: null, verifiedBy: null, releasedBy: null, releasedAt: null })] }));
    expect(text()).toContain('Rapport partiel');
    const pending = textOf(q('tr[data-test="GLU"]'));
    expect(pending).toContain('En attente');
    expect(pending).not.toContain('Publié le');
  });

  it('signale un résultat amendé avec sa version et son motif', async () => {
    await setup(report({ items: [reportItem({ amended: true, version: 2, amendmentReason: 'Erreur de transcription', flag: 'CRITICAL_HIGH' })] }));
    const row = textOf(q('tr[data-test="HGB"]'));
    expect(row).toContain('Amendé (version 2) : Erreur de transcription');
    expect(row).toContain('Critique haut');
  });

  it('imprime le rapport', async () => {
    await setup();
    const print = vi.spyOn(TestBed.inject(DOCUMENT).defaultView!, 'print').mockImplementation(() => undefined);
    const button = [...root().querySelectorAll<HTMLButtonElement>('button')].find((b) => (b.textContent ?? '').trim() === 'Imprimer le rapport')!;
    button.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(print).toHaveBeenCalledOnce();
  });

  it('renvoie à la demande, et signale une demande introuvable sans offrir d\'impression', async () => {
    await setup(report(), (g) => g.getReport.mockRejectedValue(new ApiError(404, 'LAB_REQUISITION_NOT_FOUND', 'Demande d’analyses introuvable.')));
    expect(q('[role=alert]')?.textContent).toContain('introuvable');
    expect(q('.print-area')).toBeNull();
    expect(q('a[href="/lab/requisitions/r-1"]')).not.toBeNull();
    expect([...root().querySelectorAll('button')].some((b) => (b.textContent ?? '').includes('Imprimer'))).toBe(false);
  });
});
