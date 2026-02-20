// server.js 

// --- Importations principales ---
const express = require("express");
const dotenv = require("dotenv");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const path = require("path");
const fs = require("fs");
const connectDB = require("./config/db");

// --- Configuration de base ---
dotenv.config();
connectDB();
const app = express();

// ============================================================
// 🛡️ SÉCURITÉ (Helmet & Logs)
// ============================================================
// ✅ CORRECTION : Configuration optimisée pour autoriser les images
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" }, 
    contentSecurityPolicy: false,
    // ✅ AJOUT : Autoriser le chargement d'images depuis différentes origines
    crossOriginEmbedderPolicy: false,
  })
);

app.use(morgan("dev"));
app.use(express.json({ limit: '50mb' })); // ✅ Augmenter la limite pour les uploads
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// ============================================================
// 🔓 CONFIGURATION CORS AMÉLIORÉE
// ============================================================
const allowedOrigins = [
  "https://altitudevision.agency",
  "https://www.altitudevision.agency",
  "https://altitudevision.netlify.app",
  "https://altitude-vision-frontend.onrender.com",
  "http://localhost:5173",
  "http://localhost:3000",
  "http://localhost:5174", // Vite en cas de conflit de port
  process.env.FRONTEND_URL 
].filter(Boolean); // Enlever les valeurs undefined

console.log('🌍 [CORS] Origines autorisées:', allowedOrigins);

app.use(cors({
  origin: (origin, callback) => {
    // ✅ Autoriser les requêtes sans origine (Postman, applis mobiles, curl)
    if (!origin) {
      console.log('✅ [CORS] Requête sans origine autorisée');
      return callback(null, true);
    }
    
    // ✅ Vérifier si l'origine est dans la liste
    if (allowedOrigins.includes(origin)) {
      console.log('✅ [CORS] Origine autorisée:', origin);
      callback(null, true);
    } else {
      console.log('🚫 [CORS] Origine bloquée:', origin);
      // ✅ En développement, autoriser quand même pour faciliter le debug
      if (process.env.NODE_ENV === 'development') {
        console.log('⚠️ [CORS] Mode dev: origine autorisée malgré tout');
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    }
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With", "Accept", "Origin"],
  exposedHeaders: ["Content-Range", "X-Content-Range"], // Pour la pagination
  maxAge: 86400 // Cache CORS pendant 24h
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
    console.log(`📁 [Setup] Dossier créé: ${dir}`);
  }
});

// ============================================================
// 📸 GESTION DES FICHIERS STATIQUES (IMAGES)
// ============================================================
// ✅ CORRECTION : Servir les fichiers statiques AVANT les routes API
// Important pour que les images soient accessibles

// Middleware de log pour déboguer les requêtes d'images
app.use('/uploads', (req, res, next) => {
  console.log(`📸 [Static] Requête image: ${req.path}`);
  next();
});

// Servir le dossier uploads en static avec headers CORS explicites
app.use('/uploads', 
  express.static(path.join(__dirname, 'uploads'), {
    setHeaders: (res, path) => {
      // ✅ Headers CORS pour les images
      res.set('Access-Control-Allow-Origin', '*');
      res.set('Cross-Origin-Resource-Policy', 'cross-origin');
      res.set('Cache-Control', 'public, max-age=31536000'); // Cache 1 an
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
const messageRoutes = require("./routes/messageRoutes");
const internalMailRoutes = require("./routes/internalMailRoutes");
const companyEmailRoutes = require("./routes/companyEmailRoutes");
const altcomRoutes = require('./routes/altcomRoutes');
const contactRoutes = require('./routes/contactRoutes');
const emailRoutes = require('./routes/emailRoutes'); //

// ============================================================
// 🛣️ ROUTES PRINCIPALES
// ============================================================

// ✅ Utilisateurs & Admin
app.use("/api/users", userRoutes);
app.use("/api/admin", adminRoutes);

// 🏠 Pôle Altimmo
app.use("/api/properties", propertyRoutes);
app.use("/api/transactions", transactionRoutes);

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

// 💬 Messagerie & Emails
app.use("/api/conversations", conversationRoutes);
app.use("/api/messages", messageRoutes);
app.use("/api/internal-mails", internalMailRoutes);
app.use("/api/company-emails", companyEmailRoutes);
app.use("/api/emails", emailRoutes);

// ❤️ Social & Contact
app.use("/api/likes", likeRoutes);
app.use("/api/comments", commentRoutes);
app.use('/api/contact', contactRoutes);

// ============================================================
// 🔍 ROUTE DE TEST
// ============================================================
app.get("/", (req, res) => {
  res.status(200).json({
    status: "success",
    message: "🚀 API Altitude-Vision est en ligne.",
    version: "1.5.1",
    service: "Backend",
    maintenance: false,
    environment: process.env.NODE_ENV || 'development',
    uploadPath: '/uploads',
    apiDocs: '/api'
  });
});

// ✅ Route de santé pour monitoring
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage()
  });
});

// ============================================================
// 🚨 GESTION D'ERREURS
// ============================================================

// ✅ 404 pour images manquantes - Log spécifique
app.use('/uploads/*', (req, res) => {
  const requestedPath = path.join(__dirname, req.path);
  console.error(`❌ [Static] Image non trouvée: ${req.path}`);
  console.error(`❌ [Static] Chemin complet: ${requestedPath}`);
  
  res.status(404).json({ 
    status: 'fail',
    message: 'Image non trouvée',
    path: req.path,
    tip: 'Vérifiez que le fichier existe dans le dossier uploads/'
  });
});

// 404 - Route introuvable
app.use("*", (req, res) => {
  res.status(404).json({
    status: "fail",
    message: `Route introuvable : ${req.originalUrl}`,
    availableEndpoints: [
      '/api/properties',
      '/api/events', 
      '/api/dashboard',
      '/uploads/:folder/:filename'
    ]
  });
});

// Gestionnaire global d'erreurs
app.use((err, req, res, next) => {
  // Gestion spécifique CORS
  if (err.message === "Not allowed by CORS") {
    console.error('❌ [CORS] Requête bloquée:', req.headers.origin);
    return res.status(403).json({ 
      status: "fail", 
      message: "Bloqué par la politique CORS",
      origin: req.headers.origin,
      tip: "Contactez l'administrateur pour ajouter votre domaine à la whitelist"
    });
  }

  // Erreur Multer (upload)
  if (err.name === 'MulterError') {
    console.error('❌ [Upload] Erreur Multer:', err.message);
    return res.status(400).json({
      status: 'fail',
      message: 'Erreur lors de l\'upload du fichier',
      error: err.message
    });
  }

  console.error("❌ [Serveur] Erreur:", err.stack);

  const statusCode = err.statusCode || 500;
  res.status(statusCode).json({
    status: "error",
    message: err.message || "Erreur interne du serveur.",
    // Stack trace uniquement en dev
    ...(process.env.NODE_ENV === "development" && { stack: err.stack })
  });
});

// ============================================================
// 🚀 DÉMARRAGE DU SERVEUR
// ============================================================
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log('\n' + '='.repeat(60));
  console.log(`✅ Serveur Altitude-Vision lancé sur le port ${PORT}`);
  console.log(`🌍 Mode: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔗 API disponible sur: http://localhost:${PORT}/api`);
  console.log(`📸 Images disponibles sur: http://localhost:${PORT}/uploads`);
  console.log(`🔗 Frontend autorisé: ${process.env.FRONTEND_URL || 'localhost'}`);
  console.log(`📊 Health check: http://localhost:${PORT}/api/health`);
  console.log('='.repeat(60) + '\n');
});

// ============================================================
// 🛑 GRACEFUL SHUTDOWN
// ============================================================
const gracefulShutdown = (signal) => {
  console.log(`\n⚠️ Signal ${signal} reçu. Arrêt gracieux du serveur...`);
  
  // Fermer les nouvelles connexions
  process.exit(0);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Gestion des erreurs non capturées
process.on('unhandledRejection', (err) => {
  console.error('❌ [UNHANDLED REJECTION]', err);
  gracefulShutdown('UNHANDLED_REJECTION');
});

process.on('uncaughtException', (err) => {
  console.error('❌ [UNCAUGHT EXCEPTION]', err);
  gracefulShutdown('UNCAUGHT_EXCEPTION');
});

module.exports = app;