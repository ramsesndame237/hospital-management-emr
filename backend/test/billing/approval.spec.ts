import { ApprovalId, ApprovalKind, ApprovalRequest, ApprovalStatus, discountNeedsApproval, parseApprovalKind, parseApprovalStatus } from '../../src/modules/billing/domain/approval';
import { Amount, InvoiceId, Reason } from '../../src/modules/billing/domain/values';
import { Temporal } from '../../src/shared-kernel/temporal';
import { must } from '../iam/fakes';

const codeOf = <T>(r: { ok: true; value: T } | { ok: false; error: { code: string } }) => (r.ok ? 'OK' : r.error.code);
const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const NOW = Temporal.Instant.from('2026-11-02T08:00:00Z');
const LATER = Temporal.Instant.from('2026-11-02T09:00:00Z');
const CASHIER = uuid(10);
const SUPERVISOR = uuid(20);
const amount = (n: number) => must(Amount.create(n));

function request(kind: ApprovalKind = ApprovalKind.DISCOUNT, over: Partial<{ amount: Amount | null; reason: string }> = {}): ApprovalRequest {
  return must(ApprovalRequest.request({
    id: must(ApprovalId.create(uuid(1))), invoiceId: must(InvoiceId.create(uuid(2))), kind, amount: over.amount === undefined ? amount(1500) : over.amount,
    reason: must(Reason.create(over.reason ?? 'Patient indigent')), invoiceVersion: 3, requestedBy: CASHIER, requestedAt: NOW,
  }));
}

describe('circuit d\'approbation : seuil de remise', () => {
  it('une remise dans le seuil ne demande rien, au-delà elle demande l\'accord d\'un responsable', () => {
    expect(discountNeedsApproval(amount(1000), amount(10000), 10)).toBe(false); // exactement 10 %
    expect(discountNeedsApproval(amount(1001), amount(10000), 10)).toBe(true);
    expect(discountNeedsApproval(amount(999), amount(10000), 10)).toBe(false);
  });

  it('une remise nulle ne demande jamais rien, quel que soit le seuil', () => {
    expect(discountNeedsApproval(amount(0), amount(10000), 0)).toBe(false);
    expect(discountNeedsApproval(amount(0), amount(0), 0)).toBe(false);
  });

  it('seuil à 0 : toute remise est soumise ; seuil à 100 : jamais (une remise ne dépasse pas le sous-total)', () => {
    expect(discountNeedsApproval(amount(1), amount(10000), 0)).toBe(true);
    expect(discountNeedsApproval(amount(10000), amount(10000), 100)).toBe(false);
    expect(discountNeedsApproval(amount(10000), amount(10000), 99)).toBe(true);
  });

  it('compare en entiers, sans arrondi, même sur de très gros montants', () => {
    const big = 1_000_000_000_000;
    expect(discountNeedsApproval(amount(big / 10), amount(big), 10)).toBe(false);
    expect(discountNeedsApproval(amount(big / 10 + 1), amount(big), 10)).toBe(true);
    // 3 % de 33 333 = 999,99 : 1 000 dépasse, 999 non
    expect(discountNeedsApproval(amount(999), amount(33333), 3)).toBe(false);
    expect(discountNeedsApproval(amount(1000), amount(33333), 3)).toBe(true);
  });
});

describe('circuit d\'approbation : création d\'une demande', () => {
  it('démarre en attente, sans décision, avec la version de la facture lue', () => {
    const s = request().state;
    expect(s).toMatchObject({ status: ApprovalStatus.PENDING, kind: ApprovalKind.DISCOUNT, invoiceVersion: 3, requestedBy: CASHIER, decidedBy: null, decidedAt: null, decisionComment: null });
    expect(s.amount?.value).toBe(1500);
    expect(s.reason.value).toBe('Patient indigent');
  });

  it('une remise demande un montant strictement positif', () => {
    const base = { id: must(ApprovalId.create(uuid(1))), invoiceId: must(InvoiceId.create(uuid(2))), kind: ApprovalKind.DISCOUNT, reason: must(Reason.create('x')), invoiceVersion: 0, requestedBy: CASHIER, requestedAt: NOW };
    expect(codeOf(ApprovalRequest.request({ ...base, amount: null }))).toBe('BILLING_AMOUNT_INVALID');
    expect(codeOf(ApprovalRequest.request({ ...base, amount: amount(0) }))).toBe('BILLING_AMOUNT_INVALID');
    expect(codeOf(ApprovalRequest.request({ ...base, amount: amount(1) }))).toBe('OK');
  });

  it('une annulation ne porte pas de montant, même si on en passe un', () => {
    expect(request(ApprovalKind.CANCEL, { amount: amount(500) }).state.amount).toBeNull();
    expect(request(ApprovalKind.CANCEL, { amount: null }).state.amount).toBeNull();
  });

  it('refuse un identifiant invalide', () => {
    expect(codeOf(ApprovalId.create('pas-un-uuid'))).toBe('BILLING_APPROVAL_ID_INVALID');
    expect(codeOf(ApprovalId.create(''))).toBe('BILLING_APPROVAL_ID_INVALID');
  });

  it('reconnaît les types et statuts, sans tenir compte de la casse', () => {
    expect(must(parseApprovalKind(' discount '))).toBe(ApprovalKind.DISCOUNT);
    expect(must(parseApprovalKind('cancel'))).toBe(ApprovalKind.CANCEL);
    expect(codeOf(parseApprovalKind('REFUND'))).toBe('BILLING_APPROVAL_KIND_INVALID');
    expect(must(parseApprovalStatus('pending'))).toBe(ApprovalStatus.PENDING);
    expect(codeOf(parseApprovalStatus('DONE'))).toBe('BILLING_APPROVAL_STATUS_INVALID');
  });
});

describe('circuit d\'approbation : décision', () => {
  it('un responsable accepte, avec ou sans commentaire', () => {
    const r = request();
    expect(codeOf(r.decide(SUPERVISOR, true, null, LATER))).toBe('OK');
    expect(r.state).toMatchObject({ status: ApprovalStatus.APPROVED, decidedBy: SUPERVISOR, decisionComment: null });
    expect(r.state.decidedAt?.toString()).toBe(LATER.toString());
    const withComment = request();
    withComment.decide(SUPERVISOR, true, '  Justificatif vu  ', LATER);
    expect(withComment.state.decisionComment).toBe('Justificatif vu');
  });

  it('un refus s\'explique : sans commentaire (ou vide) il est refusé, et la demande reste en attente', () => {
    const r = request();
    for (const blank of [null, undefined, '', '   ']) {
      expect(codeOf(r.decide(SUPERVISOR, false, blank, LATER))).toBe('BILLING_APPROVAL_COMMENT_REQUIRED');
      expect(r.status).toBe(ApprovalStatus.PENDING);
    }
    expect(codeOf(r.decide(SUPERVISOR, false, 'Hors barème', LATER))).toBe('OK');
    expect(r.state).toMatchObject({ status: ApprovalStatus.REJECTED, decisionComment: 'Hors barème' });
  });

  it('on ne décide jamais de sa propre demande (ni pour accepter, ni pour refuser)', () => {
    const r = request();
    expect(codeOf(r.decide(CASHIER, true, null, LATER))).toBe('BILLING_APPROVAL_SELF');
    expect(codeOf(r.decide(CASHIER, false, 'Non', LATER))).toBe('BILLING_APPROVAL_SELF');
    expect(r.status).toBe(ApprovalStatus.PENDING);
  });

  it('limite le commentaire à 200 caractères', () => {
    const r = request();
    expect(codeOf(r.decide(SUPERVISOR, true, 'x'.repeat(201), LATER))).toBe('BILLING_APPROVAL_COMMENT_INVALID');
    expect(codeOf(r.decide(SUPERVISOR, true, 'x'.repeat(200), LATER))).toBe('OK');
  });

  it('une demande décidée ne se décide plus', () => {
    const r = request();
    r.decide(SUPERVISOR, true, null, LATER);
    expect(codeOf(r.decide(uuid(21), false, 'Trop tard', LATER))).toBe('BILLING_APPROVAL_NOT_PENDING');
    expect(r.status).toBe(ApprovalStatus.APPROVED);
  });
});

describe('circuit d\'approbation : retrait', () => {
  it('l\'auteur retire sa demande tant qu\'elle attend', () => {
    const r = request();
    expect(codeOf(r.withdraw(CASHIER, LATER))).toBe('OK');
    expect(r.state).toMatchObject({ status: ApprovalStatus.WITHDRAWN, decidedBy: CASHIER });
  });

  it('un autre ne la retire pas : pour lui elle n\'existe pas, même décidée', () => {
    const r = request();
    expect(codeOf(r.withdraw(SUPERVISOR, LATER))).toBe('BILLING_APPROVAL_NOT_FOUND');
    r.decide(SUPERVISOR, true, null, LATER);
    expect(codeOf(r.withdraw(SUPERVISOR, LATER))).toBe('BILLING_APPROVAL_NOT_FOUND');
  });

  it('une demande décidée ou déjà retirée ne se retire plus', () => {
    const decided = request();
    decided.decide(SUPERVISOR, false, 'Non', LATER);
    expect(codeOf(decided.withdraw(CASHIER, LATER))).toBe('BILLING_APPROVAL_NOT_PENDING');
    const withdrawn = request();
    withdrawn.withdraw(CASHIER, LATER);
    expect(codeOf(withdrawn.withdraw(CASHIER, LATER))).toBe('BILLING_APPROVAL_NOT_PENDING');
    expect(codeOf(withdrawn.decide(SUPERVISOR, true, null, LATER))).toBe('BILLING_APPROVAL_NOT_PENDING');
  });
});
