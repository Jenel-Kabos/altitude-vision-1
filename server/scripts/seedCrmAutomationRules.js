// CRM-AUTOMATION-1 (Phase 4) — Catalogue initial des règles d'automatisation.
// Additif et idempotent (upsert par ruleId, jamais de suppression) — sans
// argument, tourne en DRY-RUN (affiche ce qui serait créé/mis à jour sans
// écrire) ; `--apply` exécute réellement les upserts. N'a PAS été exécuté
// contre une base de développement réelle durant ce sprint (voir rapport
// final) — les règles ont été exercées uniquement via les tests
// d'intégration Mongo (base éphémère MongoMemoryReplSet).
//
// Chaque `triggerEvent` correspond à une valeur RÉELLEMENT déjà émise par
// notify() dans un domaine existant (voir audit Phase 1) — aucun nouvel
// événement métier n'est inventé ici. La règle "Réservation créée" du
// brief est déclinée en deux règles distinctes (hébergement indépendant et
// immobilier), car ce sont deux événements réels différents ; la variante
// hôtelière est volontairement absente : l'audit a découvert que les
// `notify()` de création de réservation hôtelière (`hotel_reservation_*`)
// référencent des valeurs absentes de `NOTIFICATION_TYPES`
// (server/models/Notification.js), donc probablement déjà en échec de
// validation en production — un défaut préexistant, hors périmètre de ce
// sprint (voir §9 du rapport), documenté plutôt que corrigé silencieusement.
const mongoose = require('mongoose');
const CrmAutomationRule = require('../models/CrmAutomationRule');

const RULES = [
  {
    ruleId: 'nouveau-prospect',
    label: 'Nouveau prospect',
    description: "Un nouveau devis est soumis par un client — création d'une activité CRM et d'une tâche de premier contact.",
    triggerEvent: 'quote_received',
    actions: [
      { actionId: 'crm.activity.create', params: { type: 'note', title: 'Nouveau prospect (devis soumis)' } },
      { actionId: 'crm.task.create', params: { title: 'Premier contact', dueInMinutes: 60 } },
    ],
    priority: 100,
  },
  {
    ruleId: 'visite-effectuee',
    label: 'Visite effectuée',
    description: 'Une visite est marquée terminée — tâche de suivi et rappel commercial.',
    triggerEvent: 'visite_terminee',
    actions: [
      { actionId: 'crm.task.create', params: { title: 'Suivi post-visite', dueInMinutes: 1440 } },
      { actionId: 'crm.reminder.create', params: { title: 'Rappeler après la visite' } },
    ],
    priority: 100,
    delayMinutes: 2880,
  },
  {
    ruleId: 'devis-envoye-relance',
    label: 'Devis envoyé — relance',
    description: "Un devis chiffré est envoyé au client — relance automatique si aucune évolution après le délai configuré.",
    triggerEvent: 'quote_response',
    actions: [{ actionId: 'crm.reminder.create', params: { title: 'Relancer le devis envoyé' } }],
    priority: 100,
    delayMinutes: 4320, // 3 jours — configurable via l'administration (Phase 7)
  },
  {
    ruleId: 'contrat-signe',
    label: 'Contrat signé',
    description: "Un nouveau contrat est créé — l'opportunité ouverte correspondante est marquée gagnée et fermée automatiquement.",
    triggerEvent: 'contrat_new',
    actions: [{ actionId: 'crm.opportunity.close_won', params: { reason: 'Contrat signé' } }],
    priority: 50, // avant les règles génériques de pipeline
  },
  {
    ruleId: 'reservation-hebergement-creee',
    label: 'Réservation hébergement créée',
    description: "Nouvelle demande de réservation d'hébergement indépendant — activité CRM.",
    triggerEvent: 'accommodation_reservation_pending',
    actions: [{ actionId: 'crm.activity.create', params: { type: 'note', title: 'Nouvelle réservation hébergement' } }],
    priority: 100,
  },
  {
    ruleId: 'reservation-immobiliere-creee',
    label: 'Réservation immobilière créée',
    description: 'Nouvelle réservation immobilière (dossier) créée — activité CRM.',
    triggerEvent: 'real_estate_reservation_created',
    actions: [{ actionId: 'crm.activity.create', params: { type: 'note', title: 'Nouvelle réservation immobilière' } }],
    priority: 100,
  },
  {
    ruleId: 'preavis-recu',
    label: 'Préavis reçu',
    description: 'Un préavis de départ locataire démarre — tâche gestionnaire.',
    triggerEvent: 'rental_notice_started',
    actions: [{ actionId: 'crm.task.create', params: { title: 'Traiter le préavis', dueInMinutes: 1440 } }],
    priority: 100,
  },
  {
    ruleId: 'maintenance-importante',
    label: 'Maintenance importante',
    description: 'Une intervention de maintenance locative démarre — activité CRM si impact client potentiel.',
    triggerEvent: 'rental_maintenance_started',
    actions: [{ actionId: 'crm.activity.create', params: { type: 'note', title: 'Maintenance importante signalée' } }],
    priority: 100,
  },
  {
    ruleId: 'paiement-en-retard',
    label: 'Paiement en retard',
    description: 'Un paiement locatif est en retard — rappel commercial.',
    triggerEvent: 'rental_payment_overdue',
    actions: [{ actionId: 'crm.reminder.create', params: { title: 'Relancer le paiement en retard' } }],
    priority: 100,
    delayMinutes: 1440,
  },
];

async function seed({ apply = false } = {}) {
  const summary = { scanned: RULES.length, wouldCreate: [], wouldUpdate: [], created: [], updated: [] };
  for (const rule of RULES) {
    const existing = await CrmAutomationRule.findOne({ ruleId: rule.ruleId }).select('_id').lean();
    if (!apply) {
      (existing ? summary.wouldUpdate : summary.wouldCreate).push(rule.ruleId);
      continue;
    }
    // Upsert additif : ne touche jamais `enabled` d'une règle déjà présente
    // (une désactivation faite depuis l'administration ne doit jamais être
    // silencieusement réactivée par un nouveau déploiement du seed).
    const { enabled: _ignoredEnabled, ...fields } = rule;
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
    console.log(apply ? 'CRM-AUTOMATION-1 — règles appliquées :' : 'CRM-AUTOMATION-1 — DRY-RUN (aucune écriture, relancer avec --apply) :');
    console.log(JSON.stringify(summary, null, 2));
    await mongoose.disconnect();
  })().catch((err) => { console.error(err); process.exit(1); });
}

module.exports = { seed, RULES };
