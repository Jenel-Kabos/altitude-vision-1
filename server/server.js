// server.js
const dns = require('dns');
dns.setServers(['8.8.8.8', '1.1.1.1']);
const http = require('http');

const generateSitemap = require('./utils/generateSitemap');
// ============================================================
// ✅ DOTENV EN PREMIER - avant tous les autres imports
// ============================================================
const dotenv = require("dotenv");
dotenv.config();
const logger = require('./utils/logger');

logger.success("🔍 MONGO_URI chargé:", process.env.MONGO_URI ? "✅ OK" : "❌ UNDEFINED");

// --- Importations principales ---
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const path = require("path");
const fs = require("fs");
const mongoose = require("mongoose");
const connectDB = require("./config/db");

// --- Connexion MongoDB ---
connectDB();

// ============================================================
// ⏰ CRON JOB - Synchronisation Facebook automatique
// ============================================================
const cron = require('node-cron');
const { syncFacebook } = require('./scripts/sync-facebook');
const scheduledJobsDisabled = process.env.DISABLE_SCHEDULED_JOBS === '1';
const schedule = scheduledJobsDisabled ? () => ({ stop() {} }) : cron.schedule.bind(cron);

// 🔄 Tâches de démarrage une fois MongoDB connecté (un seul handler)
if (!scheduledJobsDisabled) mongoose.connection.once('open', async () => {
  // Sync Facebook
  try {
    await syncFacebook();
    logger.success('✅ [STARTUP] Sync Facebook terminée');
  } catch (error) {
    logger.error('❌ [STARTUP] Erreur sync Facebook:', error.message);
  }

  // Premier polling IMAP Zoho (délai 10s pour laisser le serveur se stabiliser)
  setTimeout(async () => {
    try {
      const stats = await pollZohoInbox();
      if (stats.imported > 0) logger.success(`✅ [STARTUP] IMAP — ${stats.imported} email(s) importé(s)`);
    } catch (err) {
      logger.error('❌ [STARTUP] Erreur premier poll IMAP:', err.message);
    }
  }, 10000);
});

// ⏰ Sync automatique toutes les heures
schedule('0 * * * *', async () => {
  logger.info('⏰ [CRON] Démarrage synchronisation Facebook...');
  try {
    await syncFacebook();
    logger.success('✅ [CRON] Synchronisation Facebook terminée');

    // Nettoyage posts > 5 jours
    const FacebookPost = mongoose.models.FacebookPost;
    if (FacebookPost) {
      const cinqJoursAvant = new Date();
      cinqJoursAvant.setDate(cinqJoursAvant.getDate() - 5);
      const deleted = await FacebookPost.deleteMany({
        date_sync: { $lt: cinqJoursAvant }
      });
      logger.info(`🧹 [CRON] ${deleted.deletedCount} vieux posts supprimés`);
    }

  } catch (error) {
    logger.error('❌ [CRON] Erreur:', error.message);
  }
});

logger.info('⏰ [CRON] Planificateur Facebook activé (toutes les heures)');

// ============================================================
// 📬 CRON JOB — Polling IMAP Zoho (emails entrants)
// À ajouter dans server.js, juste après le cron Facebook existant
// ============================================================

const { pollZohoInbox } = require('./services/zohoImapService');

// ⏰ Polling toutes les 5 minutes
schedule('*/5 * * * *', async () => {
    logger.info('⏰ [CRON] Démarrage polling IMAP Zoho...');
    try {
        const stats = await pollZohoInbox();
        if (stats.imported > 0) {
            logger.success(`✅ [CRON] IMAP — ${stats.imported} email(s) importé(s)`);
        }
    } catch (error) {
        logger.error('❌ [CRON] Erreur polling IMAP:', error.message);
    }
});

// Rappels des séjours en hébergement indépendant. Le service porte toute la
// logique de fuseau et d'idempotence ; le serveur ne fait que le déclencher.
const { processAccommodationReservationReminders } = require('./services/accommodationReservationReminderService');
schedule('*/15 * * * *', async () => {
  try {
    const result = await processAccommodationReservationReminders();
    if (result.sent) logger.info(`⏰ [CRON Hébergements] ${result.sent} rappel(s) envoyé(s)`);
  } catch (error) {
    logger.error(`❌ [CRON Hébergements] ${error.message}`);
  }
});

logger.info('⏰ [CRON] Polling IMAP Zoho activé (toutes les 5 minutes)');

// ============================================================
// 💸 CRON JOB — Pénalités de retard locatif (6h du matin)
// ============================================================
const { verifierPaiementsEnRetard } = require('./services/alerteService');
const { runRentalFinancialAutomations } = require('./services/rentalFinancialAutomationService');

schedule('0 6 * * *', async () => {
  logger.info('⏰ [CRON] Vérification paiements en retard...');
  try {
    const result = await verifierPaiementsEnRetard();
    logger.success(`✅ [CRON] ${result.verifies} paiements vérifiés, ${result.penalites} pénalité(s) appliquée(s)`);
    const alerts = await runRentalFinancialAutomations();
    logger.success(`✅ [CRON] Alertes locatives : ${alerts.payments.notified} paiement(s), ${alerts.contracts.notified} contrat(s)`);
  } catch (err) {
    logger.error('❌ [CRON] Erreur vérification paiements:', err.message);
  }
});

logger.info('⏰ [CRON] Vérification pénalités locatives activée (6h quotidien)');

// ============================================================
// 📅 CRON JOB — rappels et expiration des demandes non confirmées.
// Une visite confirmée n'est jamais annulée automatiquement sans décision métier.
// ============================================================
const { processVisitAutomation } = require('./services/visiteAutomationService');

schedule('*/5 * * * *', async () => {
  try {
    const result = await processVisitAutomation();
    if (result.reminders || result.expired) logger.info(`⏰ [CRON Visites] ${result.reminders} rappel(s), ${result.expired} expiration(s)`);
  } catch (err) {
    logger.error('❌ [CRON Visites] Erreur automatisation:', err.message);
  }
});

logger.info('⏰ [CRON] Rappels de visites activés (toutes les 5 minutes)');

// ============================================================
// 🛎️ CRON JOB — Sprint C : expiration des demandes de réservation hôtelière
// 'pending' non confirmées avant leur pendingExpiresAt. Même fréquence et
// même pattern que le cron Visites ci-dessus (fonction pure testable,
// aucune dépendance à l'horloge système dans son test).
// ============================================================
const { processReservationExpiry } = require('./services/hotelReservationExpiryService');
const { expireReservations: expireRealEstateReservations, sendExpirationReminders: remindRealEstateReservations } = require('./services/realEstateApplicationService');

schedule('*/5 * * * *', async () => {
  try {
    const result = await processReservationExpiry();
    if (result.expired) logger.info(`⏰ [CRON Réservations Hôtel] ${result.expired} expiration(s)`);
  } catch (err) {
    logger.error('❌ [CRON Réservations Hôtel] Erreur automatisation:', err.message);
  }
});

logger.info('⏰ [CRON] Expiration des réservations hôtelières en attente activée (toutes les 5 minutes)');

schedule('*/5 * * * *', async () => {
  try {
    const result = await expireRealEstateReservations();
    if (result.expired) logger.info(`⏰ [CRON Immobilier] ${result.expired} réservation(s) expirée(s)`);
    const reminders = await remindRealEstateReservations();
    if (reminders.reminded) logger.info(`⏰ [CRON Immobilier] ${reminders.reminded} rappel(s) d’expiration`);
  } catch (err) {
    logger.error(`❌ [CRON Immobilier] ${err.message}`);
  }
});


const app = express();

// Trust Render / Cloudflare reverse-proxy pour que req.ip retourne
// la vraie IP du client (et non celle du proxy) — requis par
// express-rate-limit pour limiter par utilisateur et pas globalement
app.set('trust proxy', 1);

app.get('/sitemap.xml', async (req, res) => {
  const xml = await generateSitemap();
  res.header('Content-Type', 'application/xml');
  res.header('Cache-Control', 'public, max-age=3600');
  res.send(xml);
});

// ============================================================
// 🛡️ SÉCURITÉ (Helmet & Logs)
// ============================================================
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
  })
);

const compression       = require('compression');
const mongoSanitize     = require('express-mongo-sanitize');

app.use(compression());
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
app.use(express.json({
  limit: '2mb',
  verify: (req, _res, buffer) => {
    // Les signatures de paiement portent sur les octets exacts reçus, pas
    // sur un objet JSON re-sérialisé. Limité aux webhooks concernés afin de
    // ne pas conserver inutilement tous les corps de requête en mémoire.
    if (req.originalUrl?.includes('/api/transactions/paiements/webhook')) {
      req.rawBody = Buffer.from(buffer);
    }
  },
}));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));
app.use(mongoSanitize());

// ============================================================
// 🔓 CONFIGURATION CORS AMÉLIORÉE
// ============================================================
const allowedOrigins = [
  "https://altitudevision.agency",
  "https://www.altitudevision.agency",
  "https://altitude-vision-1.vercel.app",
  "https://altitudevision.netlify.app",
  "https://altitude-vision-frontend.onrender.com",
  "http://localhost:5173",
  "http://localhost:3000",
  "http://localhost:5174",
  process.env.FRONTEND_URL
].filter(Boolean);

logger.info('🌍 [CORS] Origines autorisées:', allowedOrigins);

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) {
      logger.success('✅ [CORS] Requête sans origine autorisée');
      return callback(null, true);
    }

    if (allowedOrigins.includes(origin)) {
      logger.success('✅ [CORS] Origine autorisée:', origin);
      callback(null, true);
    } else {
      logger.info('🚫 [CORS] Origine bloquée:', origin);
      if (process.env.NODE_ENV === 'development') {
        logger.warn('⚠️ [CORS] Mode dev: origine autorisée malgré tout');
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    }
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "X-Requested-With",
    "Accept",
    "Origin",
    "Idempotency-Key",
    "X-Platform-Tenant-Id",
    "X-Tenant-Id",
  ],
  exposedHeaders: ["Content-Range", "X-Content-Range"],
  maxAge: 86400
}));

// ✅ MIDDLEWARE PREFLIGHT pour toutes les routes
app.options('*', cors());

// --- Création automatique des dossiers uploads ---
const uploadDirs = [
  path.join(__dirname, "uploads"),
  path.join(__dirname, "uploads/users"),
  path.join(__dirname, "uploads/properties"),
  path.join(__dirname, "uploads/services"),
  path.join(__dirname, "uploads/events"),
  path.join(__dirname, "uploads/documents"),
  path.join(__dirname, "uploads/internal-mails"),
];

uploadDirs.forEach((dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    logger.info(`📁 [Setup] Dossier créé: ${dir}`);
  }
});

// ============================================================
// 📸 GESTION DES FICHIERS STATIQUES (IMAGES)
// ============================================================
app.use('/uploads', (req, res, next) => {
  logger.info(`📸 [Static] Requête image: ${req.path}`);
  next();
});

app.use('/uploads',
  express.static(path.join(__dirname, 'uploads'), {
    setHeaders: (res, path) => {
      res.set('Access-Control-Allow-Origin', '*');
      res.set('Cross-Origin-Resource-Policy', 'cross-origin');
      res.set('Cache-Control', 'public, max-age=31536000');
    }
  })
);

// ✅ Route de test pour vérifier si une image existe
app.get('/api/check-image/:folder/:filename', (req, res) => {
  const { folder, filename } = req.params;
  const imagePath = path.join(__dirname, 'uploads', folder, filename);

  if (fs.existsSync(imagePath)) {
    res.json({
      exists: true,
      path: `/uploads/${folder}/${filename}`,
      fullUrl: `${req.protocol}://${req.get('host')}/uploads/${folder}/${filename}`
    });
  } else {
    res.status(404).json({
      exists: false,
      message: 'Image non trouvée',
      searchedPath: imagePath
    });
  }
});

// --- Importation des routes ---
const { notFound, errorHandler } = require('./middleware/errorMiddleware');

const userRoutes = require("./routes/userRoutes");
const adminRoutes = require("./routes/adminRoutes");
const propertyRoutes = require("./routes/propertyRoutes");
const transactionRoutes = require("./routes/transactionRoutes");
const serviceRoutes = require("./routes/serviceRoutes");
const portfolioRoutes = require("./routes/portfolioRoutes");
const eventRoutes = require("./routes/eventRoutes");
const reviewRoutes = require("./routes/reviewRoutes");
const quoteRoutes = require("./routes/quoteRoutes");
const documentRoutes = require("./routes/documentRoutes");
const dashboardRoutes = require("./routes/dashboardRoutes");
const likeRoutes = require("./routes/likeRoutes");
const commentRoutes = require("./routes/commentRoutes");
const conversationRoutes = require("./routes/conversationRoutes");
const visiteRoutes = require('./routes/visiteRoutes');
const messageRoutes = require("./routes/messageRoutes");
const internalMailRoutes = require("./routes/internalMailRoutes");
const companyEmailRoutes = require("./routes/companyEmailRoutes");
const altcomRoutes = require('./routes/altcomRoutes');
const contactRoutes = require('./routes/contactRoutes');
const estimationRoutes = require('./routes/estimationRoutes');
const devisRoutes = require('./routes/devisRoutes');
const emailRoutes = require('./routes/emailRoutes');
// ✅ NOUVEAU — Webhook Zoho (sans JWT)
const webhookRoutes = require('./routes/webhookRoutes');

// 🏘️ Gestion Locative
const proprietaireRoutes     = require('./routes/proprietaireRoutes');
const locataireRoutes        = require('./routes/locataireRoutes');
const contratRoutes          = require('./routes/contratRoutes');
const paiementRoutes         = require('./routes/paiementRoutes');
const gestionDocumentRoutes  = require('./routes/gestionDocumentRoutes');
const rentalDocumentRoutes   = require('./routes/rentalDocumentRoutes');
const rentalManagementRoutes = require('./routes/rentalManagementRoutes');
const rentalMaintenanceRoutes = require('./routes/rentalMaintenanceRoutes');
const tenantPortalRoutes = require('./routes/tenantPortalRoutes');
const accommodationRoutes    = require('./routes/accommodationRoutes');
const hotelRoutes            = require('./routes/hotelRoutes');
const altimmoSearchRoutes    = require('./routes/altimmoSearchRoutes');
const hotelReservationRoutes = require('./routes/hotelReservationRoutes');
const housekeepingRoutes     = require('./routes/housekeepingRoutes');
const inspectionRoutes       = require('./routes/inspectionRoutes');
const maintenanceRoutes      = require('./routes/maintenanceRoutes');
const salePropertyRoutes     = require('./routes/salePropertyRoutes');
const rentalPropertyRoutes   = require('./routes/rentalPropertyRoutes');
const financialRoutes        = require('./routes/financialRoutes');
const paymentProviderRoutes  = require('./routes/paymentProviderRoutes');
const dashboardAnalyticsRoutes = require('./routes/dashboardAnalyticsRoutes');
const accommodationReservationRoutes = require('./routes/accommodationReservationRoutes');
// DOC-EVO-1 — moteur générique de dossier métier (Centre documentaire).
const dossierRoutes = require('./routes/dossierRoutes');
// GL-LIFE-1 — cycle de vie du bail (machine d'état, renouvellement,
// avenants, caution, tableau de bord).
const rentalLeaseLifecycleRoutes = require('./routes/rentalLeaseLifecycleRoutes');
// GL-ASSET-1 — cycle de vie patrimonial du bien (indépendant du bail).
const propertyAssetRoutes = require('./routes/propertyAssetRoutes');

// ============================================================
// 🛣️ ROUTES PRINCIPALES
// ============================================================

// ✅ Utilisateurs & Admin
app.use("/api/users", userRoutes);
app.use("/api/admin", adminRoutes);
app.use('/api/auth', require('./routes/authRoutes'));

// 🏠 Pôle Altimmo
app.use("/api/properties", propertyRoutes);
app.use("/api/transactions", transactionRoutes);
app.use('/api/real-estate-applications', require('./routes/realEstateApplicationRoutes'));
app.use('/api/publicites', require('./routes/publiciteRoutes'));

// 🏘️ Gestion Locative
app.use('/api/proprietaires',    proprietaireRoutes);
app.use('/api/locataires',       locataireRoutes);
app.use('/api/contrats',         contratRoutes);
app.use('/api/paiements',        paiementRoutes);
app.use('/api/gestion-docs',     gestionDocumentRoutes);
// Accès contrôlé aux documents Gestion Locative (GL-DEBT-1, Phase 3) —
// distinct de /api/gestion-docs (génération) et /api/documents (facturation
// générale) : cette route sert uniquement la lecture protégée d'un document
// déjà généré et attaché à un Contrat.
app.use('/api/rental-documents', rentalDocumentRoutes);
// DOC-EVO-1 — Centre documentaire : dossier métier (agrégation en lecture
// seule, jamais une nouvelle collection). Voir server/services/dossier/.
app.use('/api/dossiers', dossierRoutes);
// GL-LIFE-1 — cycle de vie du bail (Contrat.cycleVie/avenants/caution) —
// distinct de /api/rental-management (occupation/publication du bien) et de
// /api/contrats (CRUD légal du contrat).
app.use('/api/rental-lease-lifecycle', rentalLeaseLifecycleRoutes);
// GL-ASSET-1 — distinct de /api/rental-lease-lifecycle (bail) et de
// /api/rental-management (occupation) : ceci porte le cycle de vie du bien
// lui-même, indépendant de tout bail.
app.use('/api/property-asset', propertyAssetRoutes);
app.use('/api/rental-management', rentalManagementRoutes);
app.use('/api/rental-contract-regularization', require('./routes/rentalContractRegularizationRoutes'));
// 🔧 Maintenance locative (Sprint GL-B2) — distincte de /api/maintenance (hôtelier, Sprint E).
app.use('/api/rental-maintenance', rentalMaintenanceRoutes);
// 🏠 Portail locataire (dette technique GL-B2, Mission 2) — préparation,
// aucune page publique modifiée.
app.use('/api/tenant-portal', tenantPortalRoutes);

// 🛎️ Hébergement (meublés — Sprint 2)
app.use('/api/accommodations', accommodationRoutes);
app.use('/api/hotels', hotelRoutes);
app.use('/api/altimmo', altimmoSearchRoutes);
app.use('/api/hotel-reservations', hotelReservationRoutes);
// 💰 Noyau financier F1 — routes staff protégées, sans fournisseur réel.
app.use('/api/financial', financialRoutes);
app.use('/api/payments/providers', paymentProviderRoutes);
app.use('/api/dashboard-analytics', dashboardAnalyticsRoutes);
app.use('/api/accommodation-reservations', accommodationReservationRoutes);
// 🧹 Housekeeping / Inspection / Maintenance (Sprint E)
app.use('/api/housekeeping', housekeepingRoutes);
app.use('/api/inspections', inspectionRoutes);
app.use('/api/maintenance', maintenanceRoutes);

// 🏷️ Vente / Location — formulaires admin dédiés (Sprint A, séparation par
// transaction). Espace de noms dédié (comme /api/accommodations et
// /api/hotels), volontairement PAS sous /api/admin/properties : ce préfixe
// est déjà utilisé par adminRoutes.js (GET /api/admin/properties existant)
// et un sous-chemin /properties/sales aurait risqué d'être masqué par ses
// routes internes.
app.use('/api/sale-properties', salePropertyRoutes);
app.use('/api/rental-properties', rentalPropertyRoutes);

// 💼 Pôle Altcom
app.use("/api/services", serviceRoutes);
app.use("/api/portfolio", portfolioRoutes);
app.use('/api/altcom', altcomRoutes);

// 🎉 Pôle Mila Events
app.use("/api/events", eventRoutes);
app.use("/api/reviews", reviewRoutes);
app.use("/api/quotes", quoteRoutes);

// 📂 Documents & Dashboard
app.use("/api/documents", documentRoutes);
app.use("/api/dashboard", dashboardRoutes);
// CRM-CORE-1 — couche relationnelle transverse; les données métier restent
// dans leurs moteurs sources (DOC, GL, ACC, HM, messagerie et finance).
app.use('/api/crm', require('./routes/crmRoutes'));
// USER-ARCH-1 — profils métiers (User → profils → domaines), distinct de
// /api/users (identité) et de /api/crm (relations commerciales).
app.use('/api/user-business-profiles', require('./routes/userBusinessProfileRoutes'));
// CRM-AUTOMATION-1 — moteur d'automatisation (registre de règles, cockpit,
// score dérivé) : observe les événements déjà émis par /api/crm et les
// autres domaines, n'en produit jamais de nouveaux.
app.use('/api/crm-automation', require('./routes/crmAutomationRoutes'));
// REPORTING-1 — Centre de Pilotage : agrège exclusivement des services déjà
// existants (dashboardAnalyticsController, userKpiService, crmService,
// crmCockpitService, propertyAssetPortfolioService, valuationMarketAnalytics
// Service, finance/hotelFinancialDashboardService) — aucun calcul métier
// nouveau, uniquement de l'orchestration/agrégation en lecture seule.
app.use('/api/reporting', require('./routes/reportingRoutes'));
// ORGANIZATION-1 — couche organisationnelle générique (Organisation →
// Filiale → Établissement → Département → Équipe), AU-DESSUS de User/
// UserBusinessProfile/HotelStaffAssignment/Property.owner/Hotel.manager/CRM
// — ne remplace aucun d'entre eux, orthogonale.
app.use('/api/organization', require('./routes/organizationRoutes'));

// API-PUBLIC-1 — plateforme d'API publiques, complètement découplée des
// routes internes ci-dessus : les contrôleurs public/v1 n'appellent jamais
// un contrôleur interne, uniquement services/publicApi/*. Authentifiée par
// clé API (jamais le JWT interne — voir audit Phase 1), versionnée
// (/api/public/v1 ; v2 s'ajoutera en sœur de v1, jamais en remplacement).
// Documentation OpenAPI/Swagger (Phase 7) — jamais authentifiée par clé,
// montée avant la chaîne authentifiée de v1 pour rester consultable sans clé.
app.use('/api/public/v1', require('./routes/publicApi/docs'));
app.use('/api/public/v1', require('./routes/publicApi/v1'));
// Administration des clés/webhooks (portail développeur, Phase 9) — staff
// uniquement, JWT interne classique (ce n'est pas une route publique).
app.use('/api/dev-portal', require('./routes/apiPlatformAdminRoutes'));

// MARKETING-AUTOMATION-1 — Altcom Marketing (segments dynamiques, modèles
// versionnés, campagnes avec approbation humaine obligatoire, journal
// d'envoi). Réutilise CRM-AUTOMATION-1 (workflows), Reporting (domaine
// 'marketing'), Notifications (notify(), type 'marketing_message') — ne
// crée aucun second moteur, aucune seconde API.
app.use('/api/marketing', require('./routes/marketingRoutes'));

// ERP-CORE-1 — Centre d'Administration Global : couche d'orchestration
// pure au-dessus de Reporting/CRM/Organisation/Marketing/API Gateway/
// ActionLog — ne remplace aucun dashboard existant, ne recalcule aucun KPI,
// réservé à la Direction (Admin).
app.use('/api/erp', require('./routes/erpRoutes'));

// TENANT-CORE-1 — Racine SaaS multi-tenant. Nommée `PlatformTenant` (jamais
// `Tenant` seul) pour éviter toute collision avec le concept déjà existant
// de locataire (`TenantLinkRequest`, espace locataire) — voir audit Phase 1
// du rapport de sprint. Réservé Admin.
app.use('/api/platform-tenants', require('./routes/platformTenantRoutes'));

// PLATFORM-ADMIN-1 — Gestion de l'identité PlatformOperator elle-même,
// distincte de la gestion des tenants (routeur ci-dessus). Réservé Admin +
// capacité `platform.operators.manage` (voir platformOperatorRoutes.js).
app.use('/api/platform-operators', require('./routes/platformOperatorRoutes'));

// 💬 Messagerie & Emails
app.use("/api/conversations", conversationRoutes);
app.use("/api/messages", messageRoutes);
app.use('/api/visites', visiteRoutes);
app.use("/api/internal-mails", internalMailRoutes);
app.use("/api/company-emails", companyEmailRoutes);
app.use("/api/emails", emailRoutes);

// ✅ NOUVEAU — Webhook Zoho (sans authentification JWT)
// ⚠️  Doit être déclaré AVANT les middlewares d'auth globaux
//     La sécurité est assurée par ZOHO_WEBHOOK_SECRET (HMAC SHA-256)
app.use("/api/webhooks", webhookRoutes);

// ❤️ Social & Contact
app.use("/api/likes", likeRoutes);
app.use("/api/comments", commentRoutes);
app.use('/api/contact', contactRoutes);
app.use('/api/estimation', estimationRoutes);
app.use('/api/devis', devisRoutes);

// ✅ Sync Facebook
app.use('/api/sync', require('./routes/sync'));

// 📘 Facebook Posts
app.use('/api/facebook-posts', require('./routes/facebookPostsRoutes'));

// 📋 Journal d'audit
app.use('/api/action-logs', require('./routes/actionLogRoutes'));

// 📊 Export Marketing
app.use('/api/export', require('./routes/exportRoutes'));

// ⚖️ Litiges
app.use('/api/litiges', require('./routes/litigeRoutes'));

// 🚩 Signalements
app.use('/api/signalements', require('./routes/signalementRoutes'));

// 🔔 Notifications
app.use('/api/notifications', require('./routes/notificationRoutes'));

// ============================================================
// 🔍 ROUTES DE TEST
// ============================================================
app.get("/", (req, res) => {
  res.status(200).json({
    status: "success",
    message: "🚀 API Altitude-Vision est en ligne.",
    version: "1.5.2",
    service: "Backend",
    maintenance: false,
    environment: process.env.NODE_ENV || 'development',
    uploadPath: '/uploads',
    apiDocs: '/api'
  });
});

app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage()
  });
});

// GL-DEBT-1 (Phase 16) : /api/health est une liveness (le process répond),
// pas une readiness (le process peut dépendre à tort). mongoose.STATES :
// 0 disconnected, 1 connected, 2 connecting, 3 disconnecting.
app.get('/api/ready', (req, res) => {
  const mongoState = mongoose.connection.readyState;
  const ready = mongoState === 1;
  res.status(ready ? 200 : 503).json({
    status: ready ? 'ready' : 'not_ready',
    timestamp: new Date().toISOString(),
    dependencies: {
      mongo: ['disconnected', 'connected', 'connecting', 'disconnecting'][mongoState] || 'unknown',
    },
  });
});

// ============================================================
// 🚨 GESTION D'ERREURS
// ============================================================

// 404 pour images manquantes
app.use('/uploads/*', (req, res) => {
  const requestedPath = path.join(__dirname, req.path);
  logger.error(`❌ [Static] Image non trouvée: ${req.path}`);
  logger.error(`❌ [Static] Chemin complet: ${requestedPath}`);

  res.status(404).json({
    status: 'fail',
    message: 'Image non trouvée',
    path: req.path,
    tip: 'Vérifiez que le fichier existe dans le dossier uploads/'
  });
});

// 404 - Route introuvable
app.use(notFound);

// Handler global (Mongoose CastError, E11000, ValidationError, CORS, Multer…)
app.use(errorHandler);

// ============================================================
// 🚀 DÉMARRAGE DU SERVEUR + SOCKET.IO
// ============================================================
const PORT = process.env.PORT || 5000;

const httpServer = http.createServer(app);

// Initialise Socket.IO avec la même config CORS qu'Express
const { initSocket } = require('./socket');
initSocket(httpServer, {
  origin: allowedOrigins,
  credentials: true,
  methods: ['GET', 'POST'],
});

if (process.env.NODE_ENV !== 'test') {
  httpServer.listen(PORT, () => {
    logger.info('\n' + '='.repeat(60));
    logger.success(`✅ Serveur Altitude-Vision lancé sur le port ${PORT}`);
    logger.info(`🌍 Mode: ${process.env.NODE_ENV || 'development'}`);
    logger.info(`🔗 API disponible sur: http://localhost:${PORT}/api`);
    logger.info(`📸 Images disponibles sur: http://localhost:${PORT}/uploads`);
    logger.info(`🔗 Frontend autorisé: ${process.env.FRONTEND_URL || 'localhost'}`);
    logger.info(`📊 Health check: http://localhost:${PORT}/api/health`);
    logger.info(`🪝  Webhook Zoho: http://localhost:${PORT}/api/webhooks/zoho-incoming`);
    logger.info(`🔌 Socket.IO actif sur: ws://localhost:${PORT}`);
    logger.info('='.repeat(60) + '\n');
  });
}

// ============================================================
// 🛑 GRACEFUL SHUTDOWN
// ============================================================
// Render (et la plupart des PaaS) envoient SIGTERM avant chaque redémarrage
// de déploiement — un process.exit() immédiat coupait toute requête en vol
// (y compris une écriture financière) au lieu de la laisser se terminer.
// Ici : on arrête d'accepter de nouvelles connexions, on laisse les requêtes
// en cours se terminer, on ferme Mongo, puis on quitte — avec un filet de
// sécurité pour ne jamais bloquer un déploiement indéfiniment.
const gracefulShutdown = (signal) => {
  logger.warn(`\n⚠️ Signal ${signal} reçu. Arrêt gracieux du serveur...`);
  const forceExit = setTimeout(() => {
    logger.error('❌ [SHUTDOWN] Délai dépassé — arrêt forcé.');
    process.exit(1);
  }, 10000);
  forceExit.unref();
  httpServer.close(async () => {
    try {
      await mongoose.connection.close(false);
    } catch (error) {
      logger.error('❌ [SHUTDOWN] Erreur fermeture MongoDB', error);
    } finally {
      clearTimeout(forceExit);
      process.exit(0);
    }
  });
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Ne pas tuer le serveur sur une promise rejetée isolée (cron job, service tiers…)
// Un exit sur Render entraîne un cold start de 30+ secondes.
process.on('unhandledRejection', (reason) => {
  logger.error('❌ [UNHANDLED REJECTION] Promise non gérée :', reason);
  // On logue sans exit — le process reste vivant.
});

process.on('uncaughtException', (err) => {
  logger.error('❌ [UNCAUGHT EXCEPTION]', err);
  gracefulShutdown('UNCAUGHT_EXCEPTION');
});

module.exports = { app, httpServer };
