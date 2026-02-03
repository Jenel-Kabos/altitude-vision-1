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

// Dashboard (Admin + Collaborateur)
const dashboardRoutes = require("./routes/dashboardRoutes");

// Likes & Commentaires
const likeRoutes = require("./routes/likeRoutes");
const commentRoutes = require("./routes/commentRoutes");

// Conversations & Messagerie (Interne & Publique)
const conversationRoutes = require("./routes/conversationRoutes");
const messageRoutes = require("./routes/messageRoutes");
// const internalMessageRoutes = require("./routes/internalMessageRoutes"); // ← Ancien système (peut être déprécié)

// ✅ NOUVEAU : Emails internes avec brouillons et corbeille
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

// --- Configuration CORS ---
const allowedOrigins = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  process.env.FRONTEND_URL,
].filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        console.warn(`❌ [CORS] Origine non autorisée : ${origin}`);
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
  })
);

// --- Création automatique des dossiers uploads ---
const uploadDirs = [
  path.join(__dirname, "uploads"),
  path.join(__dirname, "uploads/users"),
  path.join(__dirname, "uploads/properties"),
  path.join(__dirname, "uploads/services"),
  path.join(__dirname, "uploads/events"),
  path.join(__dirname, "uploads/documents"),
  path.join(__dirname, "uploads/internal-mails"), // ✅ NOUVEAU : Dossier pour les emails internes
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
  const fileExists = fs.existsSync(filePath);
  if (!fileExists) console.warn(`⚠️ Fichier introuvable: ${filePath}`);
  next();
});

app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// ============================================================
// 🧭 ROUTES PRINCIPALES
// ============================================================

// ✅ Utilisateurs (Standard & Admin)
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

// 🧩 Dashboard Admin/Collaborateur
app.use("/api/dashboard", dashboardRoutes);

// 💬 Messagerie & Communication
app.use("/api/conversations", conversationRoutes);
app.use("/api/messages", messageRoutes); // Messages publics ou clients (conversations en temps réel)
// app.use("/api/internal-messages", internalMessageRoutes); // ← Ancien système (commenté, peut être supprimé)

// ✅ NOUVEAU : Emails internes avec gestion complète (brouillons, corbeille, favoris)
app.use("/api/internal-mails", internalMailRoutes);

// 📧 Emails professionnels
app.use("/api/company-emails", companyEmailRoutes);

// ❤️ Likes & 💭 Commentaires
app.use("/api/likes", likeRoutes);
app.use("/api/comments", commentRoutes);

// Contact
app.use('/api/contact', contactRoutes);


// ============================================================
// 🔍 ROUTE DE TEST / DIAGNOSTIC
// ============================================================
app.get("/", (req, res) => {
  res.status(200).json({
    status: "success",
    message: "🚀 API Altitude-Vision est en ligne.",
    version: "1.4.0", // ✅ Version mise à jour
    environnement: process.env.NODE_ENV,
    nouveautes: [
      "✅ Emails professionnels @altitudevision.cg",
      "✅ Messagerie interne des collaborateurs",
      "✅ Système d'emails internes avec brouillons et corbeille", // ✅ NOUVEAU
      "✅ Gestion des pièces jointes (max 5 fichiers, 10MB chacun)", // ✅ NOUVEAU
      "✅ Logs détaillés des fichiers statiques et CORS",
    ],
    routes_disponibles: {
      emails_internes: "/api/internal-mails",
      conversations: "/api/messages",
      emails_professionnels: "/api/company-emails",
      dashboard: "/api/dashboard",
      documents: "/api/documents"
    }
  });
});

// --- Route de diagnostic des uploads (DEV uniquement) ---
if (process.env.NODE_ENV === "development") {
  app.get("/api/debug/uploads", (req, res) => {
    const uploadsPath = path.join(__dirname, "uploads");

    const listFiles = (dir, basePath = "") => {
      const files = [];
      const items = fs.readdirSync(dir);
      for (const item of items) {
        const fullPath = path.join(dir, item);
        const relativePath = path.join(basePath, item);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
          files.push(...listFiles(fullPath, relativePath));
        } else {
          files.push({
            path: relativePath.replace(/\\/g, "/"),
            size: stat.size,
            modified: stat.mtime,
          });
        }
      }
      return files;
    };

    try {
      const files = listFiles(uploadsPath);
      res.json({
        status: "success",
        totalFiles: files.length,
        files,
      });
    } catch (error) {
      res.status(500).json({ status: "error", message: error.message });
    }
  });

  // ✅ NOUVEAU : Route de diagnostic des emails internes
  app.get("/api/debug/internal-mails", async (req, res) => {
    try {
      const InternalMail = require("./models/InternalMail");
      
      const stats = {
        total: await InternalMail.countDocuments(),
        drafts: await InternalMail.countDocuments({ isDraft: true }),
        sent: await InternalMail.countDocuments({ isDraft: false, isDeleted: false }),
        trash: await InternalMail.countDocuments({ isDeleted: true }),
        unread: await InternalMail.countDocuments({ isRead: false, isDraft: false, isDeleted: false }),
        starred: await InternalMail.countDocuments({ isStarred: true, isDeleted: false }),
      };

      res.json({
        status: "success",
        message: "Statistiques des emails internes",
        stats,
      });
    } catch (error) {
      res.status(500).json({ 
        status: "error", 
        message: error.message,
        hint: "Assurez-vous que le modèle InternalMail existe"
      });
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
    requested_path: req.originalUrl,
    method: req.method,
  });
});

// Gestion des erreurs
app.use((err, req, res, next) => {
  if (err.message === "Not allowed by CORS") {
    return res.status(403).json({ status: "fail", message: err.message });
  }
  console.error("❌ [Serveur] Erreur :", err);
  res.status(500).json({
    status: "error",
    message: "Erreur interne du serveur.",
    ...(process.env.NODE_ENV === "development" && { error: err.message, stack: err.stack }),
  });
});

// ============================================================
// 🚀 DÉMARRAGE DU SERVEUR
// ============================================================
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`\n${"=".repeat(60)}`);
  console.log(`✅ Serveur Altitude-Vision lancé sur le port ${PORT}`);
  console.log(`🌍 Environnement : ${process.env.NODE_ENV || "development"}`);
  console.log(`${"=".repeat(60)}\n`);
  
  console.log("📁 Dossiers uploads :");
  console.log(`   → ${path.join(__dirname, "uploads")}`);
  console.log(`   → ${path.join(__dirname, "uploads/internal-mails")} ✅ NOUVEAU`);
  
  console.log("\n🌐 URLs disponibles :");
  console.log(`   → API principale : http://localhost:${PORT}/`);
  console.log(`   → Uploads : http://localhost:${PORT}/uploads`);
  console.log(`   → Dashboard : http://localhost:${PORT}/api/dashboard`);
  
  console.log("\n💬 Messagerie :");
  console.log(`   → Conversations (temps réel) : http://localhost:${PORT}/api/messages`);
  console.log(`   → Emails internes (brouillons/corbeille) : http://localhost:${PORT}/api/internal-mails ✅ NOUVEAU`);
  // console.log(`   → Messages internes (ancien) : http://localhost:${PORT}/api/internal-messages`); // Commenté
  
  console.log("\n📧 Emails :");
  console.log(`   → Emails professionnels : http://localhost:${PORT}/api/company-emails`);
  
  if (process.env.NODE_ENV === "development") {
    console.log("\n🔧 Routes de debug (DEV uniquement) :");
    console.log(`   → Debug uploads : http://localhost:${PORT}/api/debug/uploads`);
    console.log(`   → Debug emails internes : http://localhost:${PORT}/api/debug/internal-mails ✅ NOUVEAU`);
  }
  
  console.log(`\n${"=".repeat(60)}\n`);
});

// ============================================================
// 🛑 GESTION PROPRE DE L'ARRÊT DU SERVEUR
// ============================================================
process.on('SIGTERM', () => {
  console.log('\n👋 SIGTERM reçu. Fermeture du serveur...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('\n👋 SIGINT reçu. Fermeture du serveur...');
  process.exit(0);
});

// Gestion des erreurs non capturées
process.on('unhandledRejection', (err) => {
  console.error('❌ [Serveur] Rejet non géré :', err);
  process.exit(1);
});

process.on('uncaughtException', (err) => {
  console.error('❌ [Serveur] Exception non capturée :', err);
  process.exit(1);
});

module.exports = app;
