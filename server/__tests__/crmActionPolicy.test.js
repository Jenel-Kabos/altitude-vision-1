const { classifyCrmAction } = require('../services/crmActionPolicy');

test.each(['crm.activity.create', 'crm.task.create', 'crm.reminder.create', 'crm.opportunity.close_won'])(
  '%s reste une action CRM opérationnelle tenant',
  (actionId) => expect(classifyCrmAction(actionId)).toBe('operational'),
);

test('marketing.message.send exige toujours l’autorité marketing plateforme', () => {
  expect(classifyCrmAction('marketing.message.send')).toBe('marketing');
});

test('crm.notification.create distingue staff opérationnel et communication utilisateur', () => {
  expect(classifyCrmAction('crm.notification.create', { audience: 'staff' })).toBe('operational');
  expect(classifyCrmAction('crm.notification.create', { audience: 'user' })).toBe('marketing');
  expect(classifyCrmAction('crm.notification.create', { audience: 'staff', purpose: 'commercial' })).toBe('marketing');
});

test('une nouvelle action CRM sortante inconnue échoue fermée', () => {
  expect(classifyCrmAction('crm.whatsapp.broadcast')).toBe('denied_outbound_unknown');
});

test('toute action hors registre opérationnel échoue fermée, quel que soit son préfixe', () => {
  expect(classifyCrmAction('sms.broadcast')).toBe('denied_outbound_unknown');
  expect(classifyCrmAction('')).toBe('denied_outbound_unknown');
  expect(classifyCrmAction(undefined)).toBe('denied_outbound_unknown');
});

test('crm.notification.create sans audience explicite reste staff (opérationnel) ; une audience inconnue est marketing', () => {
  expect(classifyCrmAction('crm.notification.create')).toBe('operational');
  expect(classifyCrmAction('crm.notification.create', { audience: 'all' })).toBe('marketing');
});

test('assertTenantAutomationAction refuse avec un code stable et laisse passer l’opérationnel', () => {
  const { assertTenantAutomationAction } = require('../services/crmActionPolicy');
  expect(assertTenantAutomationAction('crm.task.create')).toBe('operational');
  expect(() => assertTenantAutomationAction('marketing.message.send')).toThrow(expect.objectContaining({ code: 'CRM_MARKETING_ACTION_FORBIDDEN', statusCode: 403 }));
  expect(() => assertTenantAutomationAction('crm.notification.create', { audience: 'user' })).toThrow(expect.objectContaining({ code: 'CRM_MARKETING_ACTION_FORBIDDEN' }));
  expect(() => assertTenantAutomationAction('sms.broadcast')).toThrow(expect.objectContaining({ code: 'CRM_OUTBOUND_ACTION_NOT_ALLOWED' }));
});
