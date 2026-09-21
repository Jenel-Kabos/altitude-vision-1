jest.mock('../models/AccommodationReservation');
jest.mock('../models/Accommodation'); jest.mock('../models/AccommodationAvailabilityBlock'); jest.mock('../models/AccommodationNightLock');
jest.mock('../models/FinancialPayment'); jest.mock('../models/PaymentAllocation'); jest.mock('../models/FinancialRefund');
jest.mock('../services/finance/accommodationRefundService');
jest.mock('../services/notificationService', () => ({ notify: jest.fn().mockResolvedValue(undefined) }));
jest.mock('../services/platformTenant/tenantContextService', () => ({ resolveTenantForUser: jest.fn() }));
// Financial authorization dépend d'appels DB (resolveActiveOperator, resolveTenantMembership).
// En unit-tests (models mockés, pas de DB), on stubbe le service pour qu'il n'active jamais Mongoose.
jest.mock('../services/finance/financialAuthorizationService', () => {
  const capabilities = { PAYMENT_VIEW: 'payment:view', PAYMENT_CONFIRM: 'payment:confirm' };
  const hasCap = (user, cap) => {
    if (!user) return false;
    if (user.isPlatformOperatorContext && !user.platformTenant) {
      const caps = user.platformOperatorCapabilities || [];
      if (caps.includes('platform.finance.manage')) return true;
      if (caps.includes('platform.finance.read') && cap === capabilities.PAYMENT_VIEW) return true;
      return false;
    }
    return false;
  };
  return {
    CAPABILITIES: capabilities,
    hasFinancialCapability: jest.fn(async (user, cap) => hasCap(user, cap)),
    assertFinancialCapability: jest.fn(async (user, cap) => {
      if (!user) { const e = new Error('Authentification requise.'); e.name = 'FinancialError'; e.statusCode = 401; e.code = 'FINANCIAL_UNAUTHORIZED'; throw e; }
      if (!hasCap(user, cap)) { const e = new Error('Capacite financiere requise.'); e.name = 'FinancialError'; e.statusCode = 403; e.code = 'FINANCIAL_UNAUTHORIZED'; throw e; }
      return true;
    }),
    assertFinancialScope: jest.fn(async () => true),
  };
});
const FinancialRefund = require('../models/FinancialRefund');
const refunds = require('../services/finance/accommodationRefundService');
const ctrl = require('../controllers/accommodationReservationController');

const response = () => { const res = {}; res.status = jest.fn(() => res); res.json = jest.fn(() => res); return res; };
const req = (user, extra = {}) => ({ user, params: {}, query: {}, headers: {}, get: jest.fn(() => null), body: {}, ...extra });

test('client et propriétaire ne peuvent pas lister/finaliser les remboursements financiers', async () => {
  for (const role of ['Client', 'Proprietaire']) { const res = response(); await ctrl.listRefundOperations(req({ id:'U1', role }), res); expect(res.status).toHaveBeenCalledWith(403); }
  const res = response(); await ctrl.completeRefund(req({ id:'U1', role:'Proprietaire' }, { params:{ refundId:'F1' }, headers:{ 'idempotency-key':'K1' }, body:{ reference:'EXT', method:'cash', amountMinor:1 } }), res); expect(res.status).toHaveBeenCalledWith(403); expect(refunds.completeManualRefund).not.toHaveBeenCalled();
});

test('PlatformOperator finance.manage peut finaliser globalement sans qu’un tenant du body ne fasse autorité', async () => {
  FinancialRefund.findOne.mockResolvedValue({ _id:'F1', subjectId:'R1', amountMinor:1000 });
  FinancialRefund.findOneAndUpdate.mockResolvedValue(null);
  refunds.completeManualRefund.mockResolvedValue({ _id:'F1', subjectId:'R1', amountMinor:1000, status:'completed', businessOperationKey:'OP1' });
  const user={ id:'OP1', role:'Client', isPlatformOperatorContext:true, platformTenant:null, platformOperatorCapabilities:['platform.finance.manage'] };
  const res=response(); await ctrl.completeRefund(req(user,{ params:{refundId:'F1'}, headers:{'idempotency-key':'K1'}, body:{reference:'EXT',method:'cash',amountMinor:1000,tenantId:'FORGED'} }),res);
  expect(res.status).not.toHaveBeenCalled(); expect(refunds.completeManualRefund).toHaveBeenCalledWith(expect.objectContaining({ refundId:'F1', amountMinor:1000 }));
});
