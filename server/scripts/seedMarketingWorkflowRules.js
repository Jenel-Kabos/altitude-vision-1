// MARKETING-AUTOMATION-1 (Phase 5) — Catalogue des scénarios marketing
// déclaratifs. Même patron que scripts/seedCrmAutomationRules.js
// (CRM-AUTOMATION-1) : additif, idempotent (upsert par ruleId), DRY-RUN par
// défaut, `--apply` requis pour écrire réellement. N'a PAS été exécuté
// contre une base de développement réelle durant ce sprint.
//
// Chaque règle utilise l'actionId 'marketing.message.send' (voir
// crmAutomationActions.js) — CE SPRINT NE CRÉE AUCUNE RÈGLE, AUCUN MOTEUR :
// ce sont des CrmAutomationRule ordinaires, exécutées par
// crmAutomationEngine.handleEvent(), exactement comme les règles CRM
// existantes.
//
// Note sur "Client inactif → campagne de relance" (liste Phase 5 du brief) :
// CE scénario n'est PAS un workflow ci-dessous, volontairement. L'audit a
// confirmé que crmAutomationEngine ne réagit qu'à des événements déjà émis
// par notify() — "un client devient inactif" n'est pas un événement, c'est
// un ÉTAT dérivé (segment `clients_inactifs`, voir
// marketingSegmentService.js). Ce scénario doit être opéré comme une
// CAMPAGNE ciblant ce segment (création manuelle ou déclenchement
// périodique via node-cron, déjà utilisé ailleurs sur la plateforme — non
// implémenté ce sprint, voir rapport final §11 dettes), jamais forcé dans
// le moteur réactif au prix d'un second mécanisme de déclenchement.
//
// `templateFamily` référence un MarketingTemplate déjà ACTIF (voir
// marketingTemplateService.createTemplateVersion/activateTemplate) — une
// règle dont le modèle n'existe pas encore se contente d'être "skipped"
// (voir crmAutomationActions.sendMarketingMessage), jamais une erreur.
const mongoose = require('mongoose');
const CrmAutomationRule = require('../models/CrmAutomationRule');

const RULES = [
  {
    ruleId: 'marketing-nouveau-prospect-bienvenue',
    label: 'Nouveau prospect — séquence de bienvenue',
    description: "Un nouveau devis est soumis (même événement que la règle CRM 'nouveau-prospect') — envoi d'un message de bienvenue marketing, en complément de l'activité CRM déjà créée.",
    triggerEvent: 'quote_received',
    actions: [{ actionId: 'marketing.message.send', params: { templateFamily: 'sequence_bienvenue_prospect', channel: 'email' } }],
    priority: 150, // après la règle CRM 'nouveau-prospect' (priority 100)
  },
  {
    ruleId: 'marketing-nouveau-proprietaire-presentation',
    label: 'Nouveau propriétaire — campagne de présentation',
    description: 'Un bien est validé pour la première fois — présentation des services Altimmo au propriétaire.',
    triggerEvent: 'bien_valide',
    actions: [{ actionId: 'marketing.message.send', params: { templateFamily: 'presentation_nouveau_proprietaire', channel: 'email' } }],
    priority: 100,
  },
  {
    ruleId: 'marketing-nouveau-locataire-onboarding',
    label: 'Nouveau locataire — onboarding',
    description: "Un nouveau contrat est créé — message d'accueil et présentation de l'espace locataire.",
    triggerEvent: 'contrat_new',
    actions: [{ actionId: 'marketing.message.send', params: { templateFamily: 'onboarding_locataire', channel: 'email' } }],
    priority: 150, // après la règle CRM 'contrat-signe' (priority 50)
  },
  {
    ruleId: 'marketing-reservation-confirmee-fidelisation',
    label: 'Réservation confirmée — fidélisation',
    description: "Une réservation d'hébergement indépendant est confirmée.",
    triggerEvent: 'accommodation_reservation_confirmed',
    actions: [{ actionId: 'marketing.message.send', params: { templateFamily: 'fidelisation_reservation', channel: 'email' } }],
    priority: 100,
  },
  {
    ruleId: 'marketing-fin-sejour-demande-avis',
    label: "Fin de séjour — demande d'avis",
    description: "Un client termine son séjour (check-out) — sollicitation d'un avis.",
    triggerEvent: 'accommodation_reservation_checked_out',
    actions: [{ actionId: 'marketing.message.send', params: { templateFamily: 'demande_avis', channel: 'email' } }],
    priority: 100,
    delayMinutes: 60, // laisse un délai raisonnable après le départ avant de solliciter un avis
  },
];

async function seed({ apply = false } = {}) {
  const summary = { scanned: RULES.length, wouldCreate: [], wouldUpdate: [], created: [], updated: [] };
  for (const rule of RULES) {
    // eslint-disable-next-line no-await-in-loop
    const existing = await CrmAutomationRule.findOne({ ruleId: rule.ruleId }).select('_id').lean();
    if (!apply) {
      (existing ? summary.wouldUpdate : summary.wouldCreate).push(rule.ruleId);
      continue;
    }
    const { enabled: _ignoredEnabled, ...fields } = rule;
    // eslint-disable-next-line no-await-in-loop
    const result = await CrmAutomationRule.findOneAndUpdate(
      { ruleId: rule.ruleId },
      { $set: fields, $setOnInsert: { enabled: true } },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
    (existing ? summary.updated : summary.created).push(result.ruleId);
  }
  return summary;
}

if (require.main === module) {
  const apply = process.argv.includes('--apply');
  (async () => {
    await mongoose.connect(process.env.MONGO_URI);
    const summary = await seed({ apply });
    console.log(apply ? 'MARKETING-AUTOMATION-1 — workflows appliqués :' : 'MARKETING-AUTOMATION-1 — DRY-RUN (aucune écriture, relancer avec --apply) :');
    console.log(JSON.stringify(summary, null, 2));
    await mongoose.disconnect();
  })().catch((err) => { console.error(err); process.exit(1); });
}

module.exports = { seed, RULES };
