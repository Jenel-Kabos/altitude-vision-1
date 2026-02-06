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
// Optimisation pour autoriser les images externes (Cloudinary, Unsplash)
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" }, // Autorise le chargement des ressources (images) sur d'autres origines
    contentSecurityPolicy: false, // Désactive le CSP strict pour éviter les blocages de scripts/images externes en dev
  })
);

app.use(morgan("dev"));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ============================================================
// 🔓 CONFIGURATION CORS
// ============================================================
// Liste des origines autorisées
const allowedOrigins = [
  "https://altitudevision.agency",
  "https://www.altitudevision.agency",
  "https://altitudevision.netlify.app",
  "https://altitude-vision-frontend.onrender.com", // Ajoute ici l'URL exacte de ton frontend sur Render si différente
  "http://localhost:5173",
  "http://localhost:3000",
  process.env.FRONTEND_URL 
];

app.use(cors({
  origin: (origin, callback) => {
    // Autoriser les requêtes sans origine (ex: Postman, applis mobiles)
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.log("🚫 Origine bloquée par CORS:", origin);
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true, // Important pour les cookies/sessions
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With", "Accept", "Origin"]
}));

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

// --- Création automatique des dossiers uploads (Sécurité anti-crash) ---
// Note : Sur Render, ces dossiers sont temporaires. Utilisez Cloudinary pour la persistance.
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
    console.log(`📁 Dossier créé : ${dir}`);
  }
});

// --- Gestion des fichiers statiques (Fallback) ---
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// ============================================================
// compass ROUTES PRINCIPALES
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
    version: "1.5.0",
    service: "Backend",
    maintenance: false
  });
});

// ============================================================
// 🚨 GESTION D'ERREURS
// ============================================================

// 404 - Route introuvable
app.use("*", (req, res) => {
  res.status(404).json({
    status: "fail",
    message: `Route introuvable : ${req.originalUrl}`,
  });
});

// Gestionnaire global d'erreurs
app.use((err, req, res, next) => {
  // Gestion spécifique CORS
  if (err.message === "Not allowed by CORS") {
    return res.status(403).json({ status: "fail", message: "Bloqué par la politique CORS" });
  }

  console.error("❌ [Serveur] Erreur :", err.stack);

  const statusCode = err.statusCode || 500;
  res.status(statusCode).json({
    status: "error",
    message: err.message || "Erreur interne du serveur.",
    // Stack trace uniquement en dev pour la sécurité
    stack: process.env.NODE_ENV === "development" ? err.stack : undefined,
  });
});

// ============================================================
// 🚀 DÉMARRAGE DU SERVEUR
// ============================================================
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`\n✅ Serveur Altitude-Vision lancé sur le port ${PORT}`);
  console.log(`🌍 Mode: ${process.env.NODE_ENV}`);
  console.log(`🔗 Frontend autorisé: ${process.env.FRONTEND_URL || 'Non défini'}\n`);
});

// Gestion arrêt propre (Graceful Shutdown)
process.on('SIGTERM', () => {
    console.info('SIGTERM signal reçu. Arrêt du serveur...');
    process.exit(0);
});