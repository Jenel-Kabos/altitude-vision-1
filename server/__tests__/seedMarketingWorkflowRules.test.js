// LOT E — le catalogue historique de workflows marketing ne peut plus être
// appliqué : une règle d'automatisation est toujours tenant et une action
// marketing y consommerait le consentement d'Altitude Vision. L'écriture est
// refusée avant tout accès base ; la politique fermée le confirme.
jest.mock('../models/CrmAutomationRule', () => ({ findOne: jest.fn(), findOneAndUpdate: jest.fn() }));

const CrmAutomationRule = require('../models/CrmAutomationRule');
const { seed, RULES } = require('../scripts/seedMarketingWorkflowRules');
const { classifyCrmAction } = require('../services/crmActionPolicy');

test('chaque règle du catalogue est une action marketing refusée par la politique tenant', () => {
  expect(RULES.length).toBeGreaterThan(0);
  for (const rule of RULES) {
    for (const action of rule.actions) expect(classifyCrmAction(action.actionId, action.params)).toBe('marketing');
  }
});

test('--apply est refusé sans aucune écriture', async () => {
  await expect(seed({ apply: true })).rejects.toMatchObject({ code: 'CRM_MARKETING_ACTION_FORBIDDEN' });
  expect(CrmAutomationRule.findOne).not.toHaveBeenCalled();
  expect(CrmAutomationRule.findOneAndUpdate).not.toHaveBeenCalled();
});
