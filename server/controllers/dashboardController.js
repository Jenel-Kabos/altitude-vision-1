// server/controllers/dashboardController.js
const User          = require('../models/User');
const Property      = require('../models/Property');
const Event         = require('../models/Event');
const PortfolioItem = require('../models/portfolioItemModel');
const AltcomProject = require('../models/AltcomProject');
const Review        = require('../models/Review');
const Contrat       = require('../models/Contrat');
const userKpiService = require('../services/userKpiService'); // USER-KPI-1

/**
 * @DESC   Statistiques enrichies du Dashboard
 * @ROUTE  GET /api/dashboard/stats
 * @ACCESS Private (Admin, Collaborateur)
 */
exports.getDashboardStats = async (req, res) => {
  try {
    const now        = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    // USER-KPI-1 — source unique, remplace l'ancien
    // `User.countDocuments({role:'Proprietaire'})` (voir dashboardRoutes.js
    // pour la justification complète de la règle d'union).
    const kpis = await userKpiService.getUserKpiSummary();

    const [
      // Comptages globaux
      usersCount,
      propertiesTotal,
      eventsTotal,
      ownersCount,
      portfolioCount,
      // Altimmo KPIs
      propertiesActives,
      propertiesPending,
      propertiesThisMonth,
      // Mila Events KPIs
      eventsUpcoming,
      eventsPublished,
      // Altcom KPIs
      altcomEnCours,
      altcomReviews,
      // Gestion Locative
      contratsActifs,
      // Activité récente
      recentProperties,
      recentEvents,
      recentProjects,
    ] = await Promise.all([
      User.countDocuments(),
      Property.countDocuments(),
      Event.countDocuments(),
      Promise.resolve(kpis.proprietaires),
      PortfolioItem.countDocuments({ isPublished: true }),
      // Altimmo
      Property.countDocuments({ statusAdmin: 'Validée' }),
      Property.countDocuments({ statusAdmin: 'En attente' }),
      Property.countDocuments({ createdAt: { $gte: monthStart } }),
      // Events
      Event.countDocuments({ date: { $gte: now }, status: 'Publié' }),
      Event.countDocuments({ status: 'Publié' }),
      // Altcom
      AltcomProject.countDocuments({ status: { $in: ['En cours', 'Accepté'] } }),
      Review.countDocuments(),
      // Gestion locative
      Contrat.countDocuments({ statut: 'actif' }),
      // Activité récente (4 items par pôle)
      Property.find()
        .sort({ createdAt: -1 }).limit(4)
        .select('title statusAdmin status createdAt price'),
      Event.find()
        .sort({ createdAt: -1 }).limit(4)
        .select('name status date createdAt'),
      AltcomProject.find()
        .sort({ createdAt: -1 }).limit(4)
        .select('projectName companyName status createdAt'),
    ]);

    // Score de performance global (0–100)
    const validationRate  = propertiesTotal > 0 ? Math.round((propertiesActives / propertiesTotal) * 100) : 0;
    const eventsScore     = Math.min(eventsUpcoming * 12, 100);
    const portfolioScore  = Math.min(portfolioCount * 8, 100);
    const reviewScore     = Math.min(altcomReviews * 5, 100);
    const globalScore     = Math.round((validationRate * 0.35) + (eventsScore * 0.25) + (portfolioScore * 0.25) + (reviewScore * 0.15));

    res.status(200).json({
      status: 'success',
      data: {
        // Rétrocompatibilité — les composants existants continuent de fonctionner
        stats: {
          Altimmo:    propertiesTotal,
          MilaEvents: eventsTotal,
          Altcom:     portfolioCount,
          Users:      usersCount,
          Owners:     ownersCount,
        },
        // KPIs détaillés par pôle
        kpis: {
          altimmo: {
            actives:    propertiesActives,
            pending:    propertiesPending,
            leadsMonth: propertiesThisMonth,
            total:      propertiesTotal,
          },
          milaEvents: {
            upcoming:  eventsUpcoming,
            published: eventsPublished,
            total:     eventsTotal,
          },
          altcom: {
            projetsEnCours: altcomEnCours,
            servicesActifs: portfolioCount,
            avisRecus:      altcomReviews,
          },
          gestionLocative: {
            contratsActifs,
          },
        },
        // Activité récente (pour le widget)
        activity: {
          properties: recentProperties,
          events:     recentEvents,
          projects:   recentProjects,
        },
        // Indicateur de performance global
        performance: {
          globalScore,
          validationRate,
          eventsScore,
          portfolioScore,
          reviewScore,
        },
      },
    });

  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Impossible de récupérer les statistiques.',
      error: error.message,
    });
  }
};
