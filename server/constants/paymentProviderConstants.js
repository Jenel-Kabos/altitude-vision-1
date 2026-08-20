// PAY-3 — identifiants de provider nommés, additifs au champ existant
// `FinancialPayment.provider` (String libre, jamais un enum Mongoose — voir
// server/models/FinancialPayment.js). Aucun changement de schéma : ces
// constantes évitent seulement les chaînes ad hoc dispersées dans le code
// futur. `method` (FINANCIAL_PAYMENT_METHODS, financialConstants.js) reste
// séparé de `provider` — un même `method` peut être servi par plusieurs
// `provider` (ex: method=mobile_money → provider=mtn_direct|airtel_direct).
const { FINANCIAL_PAYMENT_METHODS } = require('./financialConstants');

const PAYMENT_PROVIDERS = Object.freeze({
  MANUAL: 'manual',
  MTN_DIRECT: 'mtn_direct',
  AIRTEL_DIRECT: 'airtel_direct',
  YABETOO: 'yabetoo',
  CARD_PSP: 'card_psp',
});

// Scope produit (PAY-3 §11/§18/§19) : national = direct opérateur ;
// international = agrégateur pour corridors hors couverture directe ;
// manual = aucune automatisation, jamais de scope pays unique.
const PAYMENT_PROVIDER_SCOPE = Object.freeze({
  [PAYMENT_PROVIDERS.MANUAL]: 'manual',
  [PAYMENT_PROVIDERS.MTN_DIRECT]: 'national',
  [PAYMENT_PROVIDERS.AIRTEL_DIRECT]: 'national',
  [PAYMENT_PROVIDERS.YABETOO]: 'international',
  [PAYMENT_PROVIDERS.CARD_PSP]: 'national_international',
});

// Quel(s) `method` (enum réel FinancialPayment.method) chaque provider sert.
// Un provider manuel sert exactement un method par instance de paiement (le
// method choisi par le staff à la création) ; cette table documente ceux
// qu'il est cohérent de lui associer, pas une contrainte de schéma.
const PAYMENT_PROVIDER_METHODS = Object.freeze({
  [PAYMENT_PROVIDERS.MANUAL]: ['cash', 'bank_transfer', 'cheque', 'other'],
  [PAYMENT_PROVIDERS.MTN_DIRECT]: ['mobile_money'],
  [PAYMENT_PROVIDERS.AIRTEL_DIRECT]: ['mobile_money'],
  [PAYMENT_PROVIDERS.YABETOO]: ['mobile_money'],
  [PAYMENT_PROVIDERS.CARD_PSP]: ['card'],
});

for (const [provider, methods] of Object.entries(PAYMENT_PROVIDER_METHODS)) {
  for (const method of methods) {
    if (!FINANCIAL_PAYMENT_METHODS.includes(method)) {
      throw new Error(`paymentProviderConstants: method "${method}" du provider "${provider}" n'existe pas dans FINANCIAL_PAYMENT_METHODS.`);
    }
  }
}

module.exports = { PAYMENT_PROVIDERS, PAYMENT_PROVIDER_SCOPE, PAYMENT_PROVIDER_METHODS };
