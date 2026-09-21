const { calculateDeductionImpact } = require('../services/finance/accommodationDeductionService');

describe('FURNISHED-HOUSE-CLIENT-FAULT-DEDUCTIONS-7', () => {
  test.each([
    [250000, 100000, 0, 150000, 0, 150000],
    [250000, 100000, 40000, 150000, 40000, 110000],
    [250000, 100000, 200000, 150000, 150000, 0],
    [150000, 100000, 20000, 50000, 20000, 30000],
    [100000, 100000, 50000, 0, 0, 0],
  ])('paid %i consumed %i deductions %i', (paid, consumed, deductions, future, applied, refund) => {
    expect(calculateDeductionImpact({ validatedPaidAmount: paid, consumedStayAmount: consumed, validatedDeductions: deductions })).toMatchObject({ futurePaidRefundable: future, appliedDeductions: applied, finalRefund: refund });
  });
  test('remboursements termines et reserves sont deduits avant retenues', () => {
    expect(calculateDeductionImpact({ validatedPaidAmount: 250000, consumedStayAmount: 100000, alreadyRefundedAmount: 20000, alreadyReservedForRefundAmount: 30000, validatedDeductions: 40000 })).toMatchObject({ futurePaidRefundable: 100000, appliedDeductions: 40000, finalRefund: 60000 });
  });
});
