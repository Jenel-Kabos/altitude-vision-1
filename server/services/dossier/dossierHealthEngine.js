// DOC-EVO-2 — Moteur de santé du dossier : un score calculé à la volée à
// partir des données déjà agrégées par l'adaptateur, JAMAIS stocké. Chaque
// check ne s'active que si une donnée réelle le justifie — aucune vérité
// inventée (ex : pas de champ "assurance" dans les modèles actuels, donc
// pas de check "assurance absente" ici).
const LEVEL_RANK = { conforme: 0, attention: 1, critique: 2 };

function worst(a, b) {
  return LEVEL_RANK[a] >= LEVEL_RANK[b] ? a : b;
}

const DAY_MS = 24 * 60 * 60 * 1000;

function computeDossierHealth({ contrat, rental, paiements, maintenanceTickets, identiteDocs }) {
  const checks = [];
  const now = Date.now();

  if (contrat.statut === 'actif' && contrat.dateFinBail) {
    const joursRestants = Math.ceil((new Date(contrat.dateFinBail).getTime() - now) / DAY_MS);
    if (joursRestants <= 15) {
      checks.push({ key: 'bail_expire_imminent', level: 'critique', label: `Bail expire dans ${Math.max(joursRestants, 0)} jour(s)` });
    } else if (joursRestants <= 60) {
      checks.push({ key: 'bail_bientot_expire', level: 'attention', label: `Bail expire dans ${joursRestants} jours` });
    }
  }

  const enRetard = paiements.filter((p) => p.statut === 'en_retard');
  const impayes = paiements.filter((p) => p.statut === 'impayé');
  if (enRetard.length > 0) {
    checks.push({ key: 'paiement_en_retard', level: 'critique', label: `${enRetard.length} échéance(s) en retard` });
  } else if (impayes.length > 0) {
    checks.push({ key: 'paiement_impaye', level: 'attention', label: `${impayes.length} échéance(s) impayée(s)` });
  }

  const ticketOuvertUrgent = maintenanceTickets.find((t) => t.priority === 'urgente' && t.status !== 'resolu' && t.status !== 'cloture');
  const ticketOuvertHaut = maintenanceTickets.find((t) => t.priority === 'haute' && t.status !== 'resolu' && t.status !== 'cloture');
  if (ticketOuvertUrgent) {
    checks.push({ key: 'maintenance_urgente', level: 'critique', label: 'Maintenance urgente en cours' });
  } else if (ticketOuvertHaut) {
    checks.push({ key: 'maintenance_haute', level: 'attention', label: 'Maintenance prioritaire en cours' });
  }

  if (rental?.noticeStartedAt && !rental?.exitInspectionClearedAt) {
    checks.push({ key: 'preavis_actif', level: 'attention', label: 'Préavis en cours' });
  }

  if (contrat.locataire && identiteDocs.length === 0) {
    checks.push({ key: 'piece_identite_manquante', level: 'attention', label: "Pièce d'identité du locataire manquante" });
  }

  const hasEtatEntree = (contrat.documents || []).some((d) => d.type === 'etat_entree');
  if (contrat.statut !== 'en_attente' && !hasEtatEntree) {
    checks.push({ key: 'etat_des_lieux_absent', level: 'attention', label: "État des lieux d'entrée absent" });
  }

  const paiementsRegles = paiements.filter((p) => p.statut === 'payé');
  const quittanceRefs = new Set((contrat.documents || []).filter((d) => d.type === 'quittance' && d.sourcePaiement).map((d) => String(d.sourcePaiement)));
  const quittanceManquante = paiementsRegles.find((p) => !quittanceRefs.has(String(p._id)));
  if (quittanceManquante) {
    checks.push({ key: 'quittance_manquante', level: 'attention', label: 'Quittance manquante pour une échéance réglée' });
  }

  const level = checks.reduce((acc, c) => worst(acc, c.level), 'conforme');
  return { level, checks };
}

module.exports = { computeDossierHealth };
