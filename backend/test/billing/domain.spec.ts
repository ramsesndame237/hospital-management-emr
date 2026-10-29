import { BillableItem } from '../../src/modules/billing/domain/item';
import { Invoice, InvoiceLine, lineTotal, Payment, statusFor } from '../../src/modules/billing/domain/invoice';
import {
  Amount, Currency, InvoiceId, InvoiceNumber, InvoiceStatus, ItemCategory, ItemCode, ItemId, ItemName, LineId, parseCategory, parseInvoiceStatus, parseNote, parsePaymentMode, parsePaymentReference,
  PatientRef, PaymentId, PaymentMode, Quantity, Reason, ReceiptNumber,
} from '../../src/modules/billing/domain/values';
import { Temporal } from '../../src/shared-kernel/temporal';
import { must } from '../iam/fakes';

const codeOf = <T>(r: { ok: true; value: T } | { ok: false; error: { code: string } }) => (r.ok ? 'OK' : r.error.code);
const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const amount = (n: number) => must(Amount.create(n));
const NOW = Temporal.Instant.from('2026-11-02T09:00:00Z');

function line(n: number, price: number, quantity = 1): InvoiceLine {
  return {
    id: must(LineId.create(uuid(100 + n))), itemId: must(ItemId.create(uuid(200 + n))), itemCode: must(ItemCode.create(`ACT-${n}`)), itemName: must(ItemName.create(`Acte ${n}`)),
    unitPrice: amount(price), quantity: must(Quantity.create(quantity)),
  };
}

function draft(): Invoice {
  return Invoice.draft({
    id: must(InvoiceId.create(uuid(1))), number: must(InvoiceNumber.fromSequence(1)), patientId: must(PatientRef.create(uuid(2))), currency: must(Currency.create('XAF')), note: null, createdBy: uuid(3),
  });
}

function payment(n: number, value: number, mode = PaymentMode.CASH): Payment {
  return { id: must(PaymentId.create(uuid(300 + n))), receiptNumber: must(ReceiptNumber.fromSequence(n)), mode, amount: amount(value), reference: null, receivedBy: uuid(3), receivedAt: NOW };
}

describe('facturation : valeurs', () => {
  it('un montant est un entier sûr, positif ou nul, jamais décimal', () => {
    for (const ok of [0, 1, 5000, 1_000_000_000_000]) expect(codeOf(Amount.create(ok))).toBe('OK');
    for (const bad of [-1, 0.5, 12.34, Number.NaN, Infinity, 1_000_000_000_001, Number.MAX_SAFE_INTEGER + 1]) expect(codeOf(Amount.create(bad))).toBe('BILLING_AMOUNT_INVALID');
    expect(codeOf(Amount.positive(0))).toBe('BILLING_AMOUNT_INVALID');
    expect(codeOf(Amount.positive(1))).toBe('OK');
  });

  it("additionne sans jamais descendre sous zéro à la soustraction", () => {
    expect(amount(5000).plus(amount(2500)).value).toBe(7500);
    expect(amount(5000).minus(amount(2000)).value).toBe(3000);
    expect(amount(1000).minus(amount(5000)).value).toBe(0);
  });

  it('une quantité est un entier de 1 à 9999', () => {
    for (const ok of [1, 2, 9999]) expect(codeOf(Quantity.create(ok))).toBe('OK');
    for (const bad of [0, -1, 1.5, 10000, Number.NaN]) expect(codeOf(Quantity.create(bad))).toBe('BILLING_QUANTITY_INVALID');
  });

  it('un code d\'acte est normalisé en majuscules et borné', () => {
    expect(must(ItemCode.create(' cons-gen ')).value).toBe('CONS-GEN');
    for (const bad of ['', '   ', '-X', 'A B', 'é', 'A'.repeat(33)]) expect(codeOf(ItemCode.create(bad))).toBe('BILLING_ITEM_CODE_INVALID');
  });

  it('un libellé est nettoyé et borné à 200 caractères', () => {
    expect(must(ItemName.create('  Consultation   générale ')).value).toBe('Consultation générale');
    expect(codeOf(ItemName.create('   '))).toBe('BILLING_ITEM_NAME_INVALID');
    expect(codeOf(ItemName.create('x'.repeat(201)))).toBe('BILLING_ITEM_NAME_INVALID');
  });

  it('reconnaît les catégories, statuts et modes de paiement, sans tenir compte de la casse', () => {
    expect(must(parseCategory('laboratory'))).toBe(ItemCategory.LABORATORY);
    expect(codeOf(parseCategory('MAGIE'))).toBe('BILLING_ITEM_CATEGORY_INVALID');
    expect(must(parseInvoiceStatus('partially_paid'))).toBe(InvoiceStatus.PARTIALLY_PAID);
    expect(codeOf(parseInvoiceStatus('x'))).toBe('BILLING_STATUS_FILTER_INVALID');
    expect(must(parsePaymentMode('mobile_money'))).toBe(PaymentMode.MOBILE_MONEY);
    expect(codeOf(parsePaymentMode('bitcoin'))).toBe('BILLING_PAYMENT_MODE_INVALID');
  });

  it('numérote les factures et les reçus avec leur préfixe', () => {
    expect(must(InvoiceNumber.fromSequence(42)).value).toBe('FAC-0000042');
    expect(must(ReceiptNumber.fromSequence(7)).value).toBe('REC-0000007');
    expect(codeOf(InvoiceNumber.create('REC-0000001'))).toBe('BILLING_INVOICE_NUMBER_INVALID');
    expect(codeOf(ReceiptNumber.create('FAC-0000001'))).toBe('BILLING_RECEIPT_NUMBER_INVALID');
  });

  it('une devise a 3 lettres ; le franc CFA n\'a pas de décimales, l\'euro en a 2', () => {
    expect(must(Currency.create('xaf')).value).toBe('XAF');
    expect(must(Currency.create('XAF')).minorDigits).toBe(0);
    expect(must(Currency.create('EUR')).minorDigits).toBe(2);
    expect(must(Currency.create('TND')).minorDigits).toBe(3);
    expect(codeOf(Currency.create('FCFA'))).toBe('BILLING_CURRENCY_INVALID');
    expect(codeOf(Currency.create('12'))).toBe('BILLING_CURRENCY_INVALID');
  });

  it('borne le motif, la note et la référence de paiement', () => {
    expect(codeOf(Reason.create('  '))).toBe('BILLING_REASON_REQUIRED');
    expect(codeOf(Reason.create('x'.repeat(201)))).toBe('BILLING_REASON_REQUIRED');
    expect(must(parseNote('  '))).toBeNull();
    expect(codeOf(parseNote('x'.repeat(501)))).toBe('BILLING_NOTE_INVALID');
    expect(must(parsePaymentReference('MP240131.12/A-5'))).toBe('MP240131.12/A-5');
    expect(must(parsePaymentReference(undefined))).toBeNull();
    expect(codeOf(parsePaymentReference('x'.repeat(65)))).toBe('BILLING_PAYMENT_REFERENCE_INVALID');
    expect(codeOf(parsePaymentReference("'; DROP TABLE"))).toBe('BILLING_PAYMENT_REFERENCE_INVALID');
  });
});

describe('facturation : acte du catalogue', () => {
  const item = () => BillableItem.create({ id: must(ItemId.create(uuid(1))), code: must(ItemCode.create('CONS')), name: must(ItemName.create('Consultation')), category: ItemCategory.CONSULTATION, unitPrice: amount(5000), serviceId: null });

  it('naît actif, change de prix et de libellé sans toucher à son code', () => {
    const i = item();
    expect(i.active).toBe(true);
    i.update({ name: must(ItemName.create('Consultation générale')), unitPrice: amount(6000) });
    expect(i.state).toMatchObject({ unitPrice: { value: 6000 }, code: { value: 'CONS' } });
    expect(i.state.name.value).toBe('Consultation générale');
  });

  it("ne modifie que les champs fournis, et peut détacher son service", () => {
    const i = item();
    i.update({ category: ItemCategory.PROCEDURE });
    expect(i.state).toMatchObject({ category: 'PROCEDURE', unitPrice: { value: 5000 } });
    i.update({ serviceId: null });
    expect(i.state.serviceId).toBeNull();
  });

  it('se désactive et se réactive (jamais supprimé)', () => {
    const i = item();
    i.setActive(false);
    expect(i.active).toBe(false);
    i.setActive(true);
    expect(i.active).toBe(true);
  });
});

describe('facturation : facture', () => {
  it('calcule les totaux : lignes, remise, à payer, encaissé, solde', () => {
    const inv = draft();
    must(inv.addLine(line(1, 5000, 2))); // 10 000
    must(inv.addLine(line(2, 1500))); // 1 500
    expect(lineTotal(line(1, 5000, 2)).value).toBe(10000);
    expect(inv.subtotal.value).toBe(11500);
    must(inv.setDiscount(amount(1500), must(Reason.create('Personnel'))));
    expect(inv.total.value).toBe(10000);
    expect(inv.paid.value).toBe(0);
    expect(inv.balance.value).toBe(10000);
  });

  it('naît brouillon, vide, sans remise ni encaissement', () => {
    const inv = draft();
    expect(inv.state).toMatchObject({ status: 'DRAFT', lines: [], payments: [], version: 0, issuedAt: null });
    expect(inv.total.value).toBe(0);
  });

  describe('brouillon', () => {
    it('retire une ligne, et refuse une ligne inconnue', () => {
      const inv = draft();
      const l = line(1, 1000);
      must(inv.addLine(l));
      expect(codeOf(inv.removeLine(must(LineId.create(uuid(999)))))).toBe('BILLING_LINE_NOT_FOUND');
      must(inv.removeLine(l.id));
      expect(inv.state.lines).toHaveLength(0);
    });

    it('efface la remise quand elle dépasserait ce qui reste à facturer', () => {
      const inv = draft();
      const [a, b] = [line(1, 1000), line(2, 4000)];
      must(inv.addLine(a));
      must(inv.addLine(b));
      must(inv.setDiscount(amount(3000), must(Reason.create('Geste commercial'))));
      must(inv.removeLine(b.id)); // il ne reste que 1 000 : la remise de 3 000 n'a plus de sens
      expect(inv.state.discount.value).toBe(0);
      expect(inv.state.discountReason).toBeNull();
    });

    it('garde la remise quand elle reste valable', () => {
      const inv = draft();
      const [a, b] = [line(1, 5000), line(2, 1000)];
      must(inv.addLine(a));
      must(inv.addLine(b));
      must(inv.setDiscount(amount(500), must(Reason.create('Fidélité'))));
      must(inv.removeLine(b.id));
      expect(inv.state.discount.value).toBe(500);
    });

    it('exige un motif pour une remise, la plafonne au total, et la retire avec un montant nul', () => {
      const inv = draft();
      must(inv.addLine(line(1, 2000)));
      expect(codeOf(inv.setDiscount(amount(500), null))).toBe('BILLING_REASON_REQUIRED');
      expect(codeOf(inv.setDiscount(amount(2001), must(Reason.create('Trop'))))).toBe('BILLING_DISCOUNT_TOO_HIGH');
      must(inv.setDiscount(amount(2000), must(Reason.create('Gratuité'))));
      expect(inv.total.value).toBe(0);
      must(inv.setDiscount(amount(0), null));
      expect(inv.state.discountReason).toBeNull();
      expect(inv.total.value).toBe(2000);
    });
  });

  describe('émission', () => {
    it('refuse une facture vide ou dont le total est nul', () => {
      const inv = draft();
      expect(codeOf(inv.issue(NOW))).toBe('BILLING_INVOICE_EMPTY');
      must(inv.addLine(line(1, 1000)));
      must(inv.setDiscount(amount(1000), must(Reason.create('Gratuité'))));
      expect(codeOf(inv.issue(NOW))).toBe('BILLING_INVOICE_EMPTY');
    });

    it('verrouille ensuite les lignes et la remise', () => {
      const inv = draft();
      const l = line(1, 1000);
      must(inv.addLine(l));
      must(inv.issue(NOW));
      expect(inv.status).toBe(InvoiceStatus.ISSUED);
      expect(inv.state.issuedAt?.toString()).toBe(NOW.toString());
      expect(codeOf(inv.addLine(line(2, 500)))).toBe('BILLING_INVOICE_NOT_DRAFT');
      expect(codeOf(inv.removeLine(l.id))).toBe('BILLING_INVOICE_NOT_DRAFT');
      expect(codeOf(inv.setDiscount(amount(100), must(Reason.create('x'))))).toBe('BILLING_INVOICE_NOT_DRAFT');
      expect(codeOf(inv.issue(NOW))).toBe('BILLING_INVOICE_NOT_DRAFT');
    });
  });

  describe('encaissement', () => {
    const issued = (price = 10000): Invoice => {
      const inv = draft();
      must(inv.addLine(line(1, price)));
      must(inv.issue(NOW));
      return inv;
    };

    it("n'encaisse pas un brouillon ni une facture annulée", () => {
      const inv = draft();
      must(inv.addLine(line(1, 1000)));
      expect(codeOf(inv.collect(payment(1, 500)))).toBe('BILLING_INVOICE_NOT_PAYABLE');
      const cancelled = draft();
      must(cancelled.cancel(must(Reason.create('Erreur'))));
      expect(codeOf(cancelled.collect(payment(1, 500)))).toBe('BILLING_INVOICE_NOT_PAYABLE');
    });

    it('passe de ISSUED à PARTIALLY_PAID puis PAID, le solde diminuant à chaque encaissement', () => {
      const inv = issued(10000);
      must(inv.collect(payment(1, 4000)));
      expect(inv.status).toBe(InvoiceStatus.PARTIALLY_PAID);
      expect([inv.paid.value, inv.balance.value]).toEqual([4000, 6000]);
      must(inv.collect(payment(2, 6000, PaymentMode.MOBILE_MONEY)));
      expect(inv.status).toBe(InvoiceStatus.PAID);
      expect(inv.balance.value).toBe(0);
      expect(inv.state.payments.map((p) => p.mode)).toEqual(['CASH', 'MOBILE_MONEY']);
    });

    it('ne perçoit jamais plus que le solde, et refuse une facture déjà soldée', () => {
      const inv = issued(10000);
      const over = inv.collect(payment(1, 10001));
      expect(over.ok).toBe(false);
      expect(!over.ok && over.error.code).toBe('BILLING_OVERPAYMENT');
      expect(!over.ok && over.error.details).toMatchObject({ balance: 10000 });
      expect(inv.state.payments).toHaveLength(0);
      must(inv.collect(payment(2, 10000)));
      expect(codeOf(inv.collect(payment(3, 1)))).toBe('BILLING_INVOICE_NOT_PAYABLE');
    });

    it("calcule le statut d'une facture émise d'après ce qui est payé", () => {
      expect(statusFor(amount(1000), amount(0))).toBe(InvoiceStatus.ISSUED);
      expect(statusFor(amount(1000), amount(1))).toBe(InvoiceStatus.PARTIALLY_PAID);
      expect(statusFor(amount(1000), amount(1000))).toBe(InvoiceStatus.PAID);
    });
  });

  describe('annulation', () => {
    it('annule un brouillon ou une facture émise sans encaissement, avec son motif', () => {
      const inv = draft();
      must(inv.addLine(line(1, 1000)));
      must(inv.issue(NOW));
      must(inv.cancel(must(Reason.create('Mauvais patient'))));
      expect(inv.status).toBe(InvoiceStatus.CANCELLED);
      expect(inv.state.cancellationReason?.value).toBe('Mauvais patient');
      expect(codeOf(inv.cancel(must(Reason.create('Encore'))))).toBe('BILLING_INVOICE_ALREADY_CANCELLED');
    });

    it('refuse d\'annuler une facture encaissée, même en partie : il faudra la rembourser', () => {
      const inv = draft();
      must(inv.addLine(line(1, 10000)));
      must(inv.issue(NOW));
      must(inv.collect(payment(1, 100)));
      expect(codeOf(inv.cancel(must(Reason.create('Erreur'))))).toBe('BILLING_INVOICE_HAS_PAYMENTS');
      expect(inv.status).toBe(InvoiceStatus.PARTIALLY_PAID);
    });

    it('verrouille une facture annulée', () => {
      const inv = draft();
      must(inv.addLine(line(1, 1000)));
      must(inv.cancel(must(Reason.create('Erreur'))));
      expect(codeOf(inv.addLine(line(2, 100)))).toBe('BILLING_INVOICE_NOT_DRAFT');
      expect(codeOf(inv.issue(NOW))).toBe('BILLING_INVOICE_NOT_DRAFT');
    });
  });
});
