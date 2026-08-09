// ERP-CORE-1 (Phase 4) — Moteur d'alertes stratégiques. AUCUNE règle métier
// n'est recalculée ici : chaque alerte est un simple SEUIL appliqué à des
// chiffres déjà produits par un service existant (reportingService,
// crmCockpitService) ou à un comptage direct sur un champ déjà réel et déjà
// modélisé (MaintenanceTicket.priority, ApiCallLog.statusCode,
// WebhookSubscription.failureCount) — jamais une nouvelle métrique
// fabriquée. Ce fichier n'est PAS un second moteur d'automatisation : il ne
// déclenche aucune action, ne crée aucune notification, ne modifie aucune
// donnée — il ne fait que lire et qualifier des signaux déjà existants.
const MaintenanceTicket = require('../../models/MaintenanceTicket');
const RentalMaintenanceTicket = require('../../models/RentalMaintenanceTicket');
const ApiCallLog = require('../../models/ApiCallLog');
const WebhookSubscription = require('../../models/WebhookSubscription');

const API_ERROR_RATE_THRESHOLD = 0.1; // 10 % d'erreurs sur 24h — seuil documenté, jamais caché.
const WEBHOOK_FAILURE_THRESHOLD = 3;
const OCCUPANCY_LOW_THRESHOLD = 40; // %
const CAMPAIGN_OPEN_RATE_LOW_THRESHOLD = 10; // %
const GROWTH_ABNORMAL_THRESHOLD = 50; // % — variation mensuelle jugée "anormale" dans un sens ou l'autre

async function countCriticalMaintenance() {
  const [hotel, gl] = await Promise.all([
    MaintenanceTicket.countDocuments({ priority: 'urgent', status: { $in: MaintenanceTicket.OPEN_MAINTENANCE_STATUSES } }),
    RentalMaintenanceTicket.countDocuments({ priority: 'urgente', status: { $in: RentalMaintenanceTicket.OPEN_RENTAL_MAINTENANCE_STATUSES } }),
  ]);
  return hotel + gl;
}

async function computeApiErrorRate() {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const [total, errors] = await Promise.all([
    ApiCallLog.countDocuments({ createdAt: { $gte: since } }),
    ApiCallLog.countDocuments({ createdAt: { $gte: since }, statusCode: { $gte: 400 } }),
  ]);
  return { total, errors, rate: total > 0 ? errors / total : 0 };
}

// `context` est construit par erpService.js à partir de reportingService.
// getExecutiveReport() (déjà agrégé) + de quelques comptages directs
// justifiés ci-dessus — jamais une seconde agrégation des mêmes collections
// métier (CRM/Finance/Hôtel/GL restent la seule source de vérité).
async function evaluateAlerts(context = {}) {
  const { domains = {}, growth = null } = context;
  const crm = domains.crm?.data;
  const hotel = domains.hotel?.data;
  const location = domains.location?.data;
  const finance = domains.finance?.data;
  const marketing = domains.marketing?.data;

  const [criticalMaintenance, apiHealth, webhookFailures] = await Promise.all([
    countCriticalMaintenance(),
    computeApiErrorRate(),
    WebhookSubscription.countDocuments({ status: 'active', failureCount: { $gte: WEBHOOK_FAILURE_THRESHOLD } }),
  ]);

  const alerts = [];

  const opportunitesBloquees = crm?.cockpit?.opportunitesBloquees?.length || 0;
  if (opportunitesBloquees > 0) {
    alerts.push({
      key: 'pipeline_bloque', severity: 'warning', domain: 'crm',
      label: 'Pipeline commercial bloqué',
      detail: `${opportunitesBloquees} opportunité(s) sans mouvement depuis plus de 21 jours (crmCockpitService.opportunitesBloquees).`,
      count: opportunitesBloquees,
    });
  }

  if (hotel && typeof hotel.kpis?.occupancyRate === 'number' && hotel.kpis.occupancyRate < OCCUPANCY_LOW_THRESHOLD) {
    alerts.push({
      key: 'occupation_faible', severity: 'warning', domain: 'hotel',
      label: 'Occupation hôtelière faible',
      detail: `Taux d'occupation à ${hotel.kpis.occupancyRate}% (seuil ${OCCUPANCY_LOW_THRESHOLD}%).`,
      count: hotel.kpis.occupancyRate,
    });
  }

  const unpaidRent = location?.kpis?.unpaidRent || 0;
  if (unpaidRent > 0) {
    alerts.push({
      key: 'impayes', severity: unpaidRent > 500000 ? 'critical' : 'warning', domain: 'location',
      label: 'Impayés en gestion locative',
      detail: `${unpaidRent.toLocaleString('fr-FR')} FCFA de loyers impayés en cours.`,
      count: unpaidRent,
    });
  }

  if (criticalMaintenance > 0) {
    alerts.push({
      key: 'maintenance_critique', severity: 'critical', domain: 'operations',
      label: 'Maintenance critique en attente',
      detail: `${criticalMaintenance} ticket(s) de maintenance à priorité urgente encore ouverts (hôtel + gestion locative).`,
      count: criticalMaintenance,
    });
  }

  if (apiHealth.total > 0 && apiHealth.rate >= API_ERROR_RATE_THRESHOLD) {
    alerts.push({
      key: 'api_degradee', severity: 'critical', domain: 'api',
      label: 'API publique dégradée',
      detail: `Taux d'erreur de ${Math.round(apiHealth.rate * 10000) / 100}% sur les dernières 24h (${apiHealth.errors}/${apiHealth.total} appels).`,
      count: apiHealth.errors,
    });
  }
  if (webhookFailures > 0) {
    alerts.push({
      key: 'webhooks_en_echec', severity: 'warning', domain: 'api',
      label: 'Webhooks en échec répété',
      detail: `${webhookFailures} abonnement(s) webhook actif(s) avec ${WEBHOOK_FAILURE_THRESHOLD}+ échecs consécutifs.`,
      count: webhookFailures,
    });
  }

  const campagnesSansOuverture = (marketing?.campagnesRecentes || []).filter(
    (c) => typeof c.tauxOuverture === 'number',
  );
  const inefficaces = (marketing?.kpis?.tauxOuverture !== null && marketing?.kpis?.tauxOuverture !== undefined
    && marketing.kpis.envoisReussis > 0 && marketing.kpis.tauxOuverture < CAMPAIGN_OPEN_RATE_LOW_THRESHOLD)
    ? 1 : 0;
  if (inefficaces) {
    alerts.push({
      key: 'campagnes_inefficaces', severity: 'info', domain: 'marketing',
      label: 'Campagnes marketing peu performantes',
      detail: `Taux d'ouverture global à ${marketing.kpis.tauxOuverture}% (seuil ${CAMPAIGN_OPEN_RATE_LOW_THRESHOLD}%).`,
      count: marketing.kpis.tauxOuverture,
    });
  }
  void campagnesSansOuverture; // conservé pour un futur détail par campagne (Phase 11) — non exploité aujourd'hui.

  if (finance?.note) {
    // Aucun P&L consolidé n'existe (voir financeReport.js) — signalé comme
    // information, jamais comme une alerte de baisse fabriquée sans donnée.
    alerts.push({
      key: 'finance_perimetre_limite', severity: 'info', domain: 'finance',
      label: 'Reporting financier consolidé limité',
      detail: finance.note,
      count: null,
    });
  }

  if (growth && typeof growth.newUsersGrowthPercent === 'number' && Math.abs(growth.newUsersGrowthPercent) >= GROWTH_ABNORMAL_THRESHOLD) {
    alerts.push({
      key: 'croissance_anormale', severity: 'info', domain: 'organisation',
      label: 'Variation anormale de nouveaux comptes',
      detail: `${growth.newUsersGrowthPercent > 0 ? '+' : ''}${growth.newUsersGrowthPercent}% de nouveaux comptes ce mois vs le mois précédent (${growth.newUsersThisMonth} vs ${growth.newUsersPreviousMonth}).`,
      count: growth.newUsersGrowthPercent,
    });
  }

  const severityOrder = { critical: 0, warning: 1, info: 2 };
  alerts.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);
  return alerts;
}

module.exports = { evaluateAlerts, API_ERROR_RATE_THRESHOLD, WEBHOOK_FAILURE_THRESHOLD, OCCUPANCY_LOW_THRESHOLD };
