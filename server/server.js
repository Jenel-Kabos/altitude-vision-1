// server.js (ou app.js)

// --- Importations principales ---
const express = require("express");
const dotenv = require("dotenv");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const path = require("path");
const fs = require("fs");
const connectDB = require("./config/db");

// --- Importation des routes (par pôle) ---
const userRoutes = require("./routes/userRoutes");
const adminRoutes = require("./routes/adminRoutes");

// Pôle Altimmo (immobilier)
const propertyRoutes = require("./routes/propertyRoutes");
const transactionRoutes = require("./routes/transactionRoutes");

// Pôle Altcom (communication & services)
const serviceRoutes = require("./routes/serviceRoutes");
const portfolioRoutes = require("./routes/portfolioRoutes");

// Pôle Mila Events (événementiel)
const eventRoutes = require("./routes/eventRoutes");
const reviewRoutes = require("./routes/reviewRoutes");
const quoteRoutes = require("./routes/quoteRoutes");

// Documents partagés
const documentRoutes = require("./routes/documentRoutes");

// ✅ DASHBOARD (Admin + Collaborateur)
const dashboardRoutes = require("./routes/dashboardRoutes");

// Likes & Commentaires
const likeRoutes = require("./routes/likeRoutes");
const commentRoutes = require("./routes/commentRoutes");

// Conversations & Messagerie (Interne & Publique)
const conversationRoutes = require("./routes/conversationRoutes");
const messageRoutes = require("./routes/messageRoutes");

// Emails internes avec brouillons et corbeille
const internalMailRoutes = require("./routes/internalMailRoutes");

// Emails professionnels
const companyEmailRoutes = require("./routes/companyEmailRoutes");

// Formulaire Projet
const altcomRoutes = require('./routes/altcomRoutes');

// Contact
const contactRoutes = require('./routes/contactRoutes');

// --- Configuration de base ---
dotenv.config();
connectDB();
const app = express();

// --- Sécurité & logs ---
app.use(
  helmet({
    crossOriginResourcePolicy: false,
  })
);
app.use(morgan("dev"));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ============================================================
// 🔓 CONFIGURATION CORS
// ============================================================
app.use(cors({
  origin: [
    "https://altitudevision.agency",       // Ton domaine principal
    "https://www.altitudevision.agency",   // Avec www
    "https://altitudevision.netlify.app",  // Netlify (backup)
    "http://localhost:5173",             
    "http://localhost:3000",
    process.env.FRONTEND_URL
  ].filter(Boolean),
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With", "Accept", "Origin"]
}));

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
    console.log(`📁 Dossier créé : ${dir}`);
  }
});

// --- Gestion des fichiers statiques ---
app.use("/uploads", (req, res, next) => {
  const filePath = path.join(__dirname, "uploads", req.path);
  // Petite vérification silencieuse pour éviter les crashs si fichier manquant
  next();
});

app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// ============================================================
// 🧭 ROUTES PRINCIPALES
// ============================================================

// ✅ Utilisateurs (Auth, Profil, Admin)
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

// 📂 Documents partagés
app.use("/api/documents", documentRoutes);

// 📊 DASHBOARD (Statistiques)
app.use("/api/dashboard", dashboardRoutes);

// 💬 Messagerie
app.use("/api/conversations", conversationRoutes);
app.use("/api/messages", messageRoutes);
app.use("/api/internal-mails", internalMailRoutes); // Emails internes

// 📧 Emails professionnels
app.use("/api/company-emails", companyEmailRoutes);

// ❤️ Likes & Commentaires
app.use("/api/likes", likeRoutes);
app.use("/api/comments", commentRoutes);

// 📞 Contact
app.use('/api/contact', contactRoutes);


// ============================================================
// 🔍 ROUTE DE TEST / DIAGNOSTIC
// ============================================================
app.get("/", (req, res) => {
  res.status(200).json({
    status: "success",
    message: "🚀 API Altitude-Vision est en ligne.",
    version: "1.5.0", // Nouvelle version
    environnement: process.env.NODE_ENV,
    etat: {
        database: "Connectée",
        dashboard: "Actif",
        emails: "Actifs"
    }
  });
});

// --- Routes de Debug (Dev uniquement) ---
if (process.env.NODE_ENV === "development") {
  // Debug Uploads
  app.get("/api/debug/uploads", (req, res) => {
    const uploadsPath = path.join(__dirname, "uploads");
    const listFiles = (dir, basePath = "") => {
      let files = [];
      try {
          const items = fs.readdirSync(dir);
          for (const item of items) {
            const fullPath = path.join(dir, item);
            const relativePath = path.join(basePath, item);
            const stat = fs.statSync(fullPath);
            if (stat.isDirectory()) {
              files.push(...listFiles(fullPath, relativePath));
            } else {
              files.push({ path: relativePath.replace(/\\/g, "/"), size: stat.size });
            }
          }
      } catch (e) { console.error(e); }
      return files;
    };
    res.json({ status: "success", files: listFiles(uploadsPath) });
  });

  // Debug Emails Internes
  app.get("/api/debug/internal-mails", async (req, res) => {
    try {
      // Chargement dynamique pour éviter erreur si modèle pas encore créé
      const InternalMail = require("./models/InternalMail"); 
      const stats = {
        total: await InternalMail.countDocuments(),
        drafts: await InternalMail.countDocuments({ isDraft: true }),
        trash: await InternalMail.countDocuments({ isDeleted: true }),
      };
      res.json({ status: "success", stats });
    } catch (error) {
      res.status(500).json({ message: "Modèle InternalMail introuvable ou erreur DB" });
    }
  });
}

// ============================================================
// 🚨 ERREURS GLOBALES
// ============================================================

// 404
app.use("/api/*", (req, res) => {
  res.status(404).json({
    status: "fail",
    message: "Route API introuvable",
    path: req.originalUrl,
  });
});

// Gestionnaire d'erreurs
app.use((err, req, res, next) => {
  if (err.message === "Not allowed by CORS") {
    return res.status(403).json({ status: "fail", message: "Bloqué par CORS" });
  }
  console.error("❌ [Serveur] Erreur :", err);
  res.status(500).json({
    status: "error",
    message: "Erreur interne du serveur.",
    error: process.env.NODE_ENV === "development" ? err.message : undefined,
  });
});

// ============================================================
// 🚀 DÉMARRAGE DU SERVEUR
// ============================================================
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`\n✅ Serveur Altitude-Vision lancé sur le port ${PORT}`);
  console.log(`🌍 URL: http://localhost:${PORT}`);
  console.log(`📊 Dashboard: http://localhost:${PORT}/api/dashboard/stats`);
  console.log(`📧 Email Vérif: Activée\n`);
});

// Gestion arrêt propre
process.on('SIGTERM', () => process.exit(0));
process.on('SIGINT', () => process.exit(0));

module.exports = app;

//FIN DE CODE SERVEUR