import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ApiError } from '../../../core/http/api-error';
import { LabGateway } from '../../../core/lab/lab.gateway';
import { FakeLabGateway, page, summary } from '../../../core/lab/testing/fake-lab-gateway';
import { configureApp, settle, watchMissingKeys } from '../../../testing/app-testing';
import { ResultsPage } from './results.page';

function textOf(el: Element | null): string {
  if (!el) return '';
  const parts: string[] = [];
  const walker = el.ownerDocument.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) parts.push(node.textContent ?? '');
  return parts.join(' ').replace(/\s+/g, ' ').trim();
}

describe('ResultsPage', () => {
  let fixture: ComponentFixture<ResultsPage>;
  let lab: FakeLabGateway;
  let missingKeys: () => string[];
  const root = () => fixture.nativeElement as HTMLElement;
  const q = <T extends HTMLElement>(selector: string) => root().querySelector<T>(selector);

  async function setup(arrange?: (g: FakeLabGateway) => void) {
    lab = new FakeLabGateway();
    arrange?.(lab);
    const { i18n } = configureApp({ roles: ['DOCTOR'], permissions: ['lab.requisitions:read:own'], providers: [{ provide: LabGateway, useValue: lab }] });
    missingKeys = watchMissingKeys(i18n);
    fixture = TestBed.createComponent(ResultsPage);
    await settle(fixture);
  }

  afterEach(() => expect(missingKeys()).toEqual([]));

  it('ne demande que les résultats publiés et les liste avec patient, analyses et lien vers le rapport', async () => {
    await setup((g) => g.listRequisitions.mockResolvedValue(page([summary({ status: 'RELEASED', priority: 'URGENT', testCodes: ['HGB', 'GLU'] })])));
    expect(lab.listRequisitions).toHaveBeenCalledWith({ status: 'RELEASED' }, 0, 25);
    const row = textOf(q('[data-test="LAB-0000123"]'));
    expect(row).toContain('Mbarga');
    expect(row).toContain('HGB, GLU');
    expect(row).toContain('Urgent');
    expect(q('[data-test="LAB-0000123"] a')?.getAttribute('href')).toBe('/lab/requisitions/r-1/report');
    expect(q('a[href="/lab/worklist"]')).not.toBeNull();
  });

  it('dit quand aucun résultat n\'est publié', async () => {
    await setup((g) => g.listRequisitions.mockResolvedValue(page([])));
    expect(textOf(root())).toContain('Aucun résultat publié pour le moment.');
  });

  it('pagine par 25', async () => {
    await setup((g) => g.listRequisitions.mockResolvedValue(page([summary()], { total: 60 })));
    expect(textOf(root())).toContain('1');
    const next = [...root().querySelectorAll<HTMLButtonElement>('button')].find((b) => b.textContent!.trim() === 'Suivant')!;
    next.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await settle(fixture);
    expect(lab.listRequisitions).toHaveBeenLastCalledWith({ status: 'RELEASED' }, 25, 25);
  });

  it('signale une erreur de chargement', async () => {
    await setup((g) => g.listRequisitions.mockRejectedValue(new ApiError(403, 'FORBIDDEN', 'Accès refusé.')));
    expect(q('[role=alert]')?.textContent).toContain('Accès refusé');
  });
});
