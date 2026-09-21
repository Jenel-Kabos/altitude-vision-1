const stay = require('../services/finance/accommodationStayBalanceService');

const reservation = (overrides = {}) => ({
  status: 'confirmed',
  checkInDate: new Date('2027-09-10T00:00:00.000Z'),
  checkOutDate: new Date('2027-09-15T00:00:00.000Z'),
  checkedInAt: null,
  nights: 5,
  total: 250000,
  amountPaid: 50000,
  refundedAmount: 0,
  pricingSnapshot: { nightlyRate: 50000, requiredToConfirm: 50000, total: 250000 },
  ...overrides,
});

describe('Accommodation stay balance contract', () => {
  test('STAY-02/03: la première nuit est couverte et le check-in ne requiert pas le total', () => {
    const result = stay.getStayFinancialSummary(reservation());
    expect(result).toMatchObject({ firstNightCovered: true, remainingBalance: 200000 });
  });

  test('STAY-04/05/06/07/08: les deux montants de paiement sont calculés serveur sans refacturer la première nuit', () => {
    expect(stay.resolveServerPaymentAmount(reservation(), 'remaining_balance')).toBe(200000);
    expect(stay.resolveServerPaymentAmount(reservation(), 'next_night')).toBe(50000);
    expect(stay.resolveServerPaymentAmount(reservation({ amountPaid: 250000 }), 'next_night')).toBe(0);
  });

  test('STAY-11/14: deux nuits consommées retiennent 100k, jamais 150k', () => {
    const result = stay.getStayFinancialSummary(reservation({
      status: 'checked_in', checkedInAt: new Date('2027-09-10T15:00:00.000Z'), amountPaid: 250000,
    }), { now: new Date('2027-09-12T10:00:00.000Z') });
    expect(result).toMatchObject({ consumedNights: 2, consumedStayAmount: 100000, nonRefundableAmount: 100000, refundableAmount: 150000 });
  });

  test('STAY-12/13: le remboursement suit les nuits consommées et les montants déjà remboursés/réservés', () => {
    const base = reservation({ status: 'checked_in', checkedInAt: new Date('2027-09-10T15:00:00.000Z'), amountPaid: 250000 });
    expect(stay.getStayFinancialSummary(base, { now: new Date('2027-09-13T08:00:00.000Z') }).refundableAmount).toBe(100000);
    expect(stay.getStayFinancialSummary({ ...base, amountPaid: 150000 }, { now: new Date('2027-09-13T08:00:00.000Z') }).refundableAmount).toBe(0);
    expect(stay.getStayFinancialSummary(base, { now: new Date('2027-09-13T08:00:00.000Z'), alreadyRefundedAmount: 25000, alreadyReservedForRefundAmount: 25000 }).refundableAmount).toBe(50000);
  });

  test('STAY-16: une valeur consumedNights fournie par le client est ignorée', () => {
    const result = stay.getStayFinancialSummary(reservation({ consumedNights: 99 }), { now: new Date('2027-09-09T10:00:00.000Z') });
    expect(result.consumedNights).toBe(0);
  });
});
