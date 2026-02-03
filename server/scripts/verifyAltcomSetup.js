/**
 * Script de vérification de la configuration Altcom
 * Vérifie que tous les fichiers et modèles sont en place
 * Usage: node scripts/verifyAltcomSetup.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

// Codes couleur pour console
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[36m',
};

const log = {
  success: (msg) => console.log(`${colors.green}✅ ${msg}${colors.reset}`),
  error: (msg) => console.log(`${colors.red}❌ ${msg}${colors.reset}`),
  warning: (msg) => console.log(`${colors.yellow}⚠️  ${msg}${colors.reset}`),
  info: (msg) => console.log(`${colors.blue}ℹ️  ${msg}${colors.reset}`),
};

// ========================================
// VÉRIFICATION DES FICHIERS
// ========================================
const checkFile = (filePath, required = true) => {
  const fullPath = path.join(__dirname, '..', filePath);
  const exists = fs.existsSync(fullPath);
  
  if (exists) {
    log.success(`${filePath}`);
  } else {
    if (required) {
      log.error(`${filePath} (REQUIS)`);
    } else {
      log.warning(`${filePath} (optionnel)`);
    }
  }
  
  return exists;
};

// ========================================
// VÉRIFICATION DE LA BASE DE DONNÉES
// ========================================
const checkDatabase = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    log.success('Connexion MongoDB établie');

    // Vérifier les modèles
    const Service = require('../models/Service');
    const PortfolioItem = require('../models/PortfolioItem');
    const Review = require('../models/Review');

    log.info('Vérification des données Altcom...');

    // Compter les services Altcom
    const servicesCount = await Service.countDocuments({ pole: 'Altcom' });
    if (servicesCount > 0) {
      log.success(`${servicesCount} services Altcom trouvés`);
    } else {
      log.warning('Aucun service Altcom trouvé. Exécutez: node scripts/seedAltcomData.js');
    }

    // Compter les éléments du portfolio Altcom
    const portfolioCount = await PortfolioItem.countDocuments({ pole: 'Altcom' });
    if (portfolioCount > 0) {
      log.success(`${portfolioCount} projets portfolio Altcom trouvés`);
    } else {
      log.warning('Aucun projet portfolio Altcom trouvé. Exécutez: node scripts/seedAltcomData.js');
    }

    // Compter les reviews liées à Altcom
    const altcomPortfolio = await PortfolioItem.find({ pole: 'Altcom' }).select('_id');
    const portfolioIds = altcomPortfolio.map(p => p._id);
    const reviewsCount = await Review.countDocuments({ portfolioItem: { $in: portfolioIds } });
    
    if (reviewsCount > 0) {
      log.success(`${reviewsCount} reviews Altcom trouvées`);
    } else {
      log.warning('Aucune review Altcom trouvée. Exécutez: node scripts/seedAltcomData.js');
    }

    // Vérifier le modèle PortfolioItem
    log.info('Vérification du schéma PortfolioItem...');
    const portfolioSchema = PortfolioItem.schema.obj;
    
    if (portfolioSchema.pole) {
      log.success('Champ "pole" présent dans PortfolioItem');
    } else {
      log.error('Champ "pole" MANQUANT dans PortfolioItem - Mettre à jour le modèle');
    }

    if (portfolioSchema.averageRating) {
      log.success('Champ "averageRating" présent dans PortfolioItem');
    } else {
      log.error('Champ "averageRating" MANQUANT dans PortfolioItem - Mettre à jour le modèle');
    }

    if (PortfolioItem.calcAverageRating) {
      log.success('Méthode "calcAverageRating" présente dans PortfolioItem');
    } else {
      log.error('Méthode "calcAverageRating" MANQUANTE dans PortfolioItem - Mettre à jour le modèle');
    }

    await mongoose.disconnect();
    log.success('Déconnexion MongoDB');

  } catch (error) {
    log.error(`Erreur de connexion MongoDB: ${error.message}`);
    return false;
  }

  return true;
};

// ========================================
// VÉRIFICATION DES VARIABLES D'ENVIRONNEMENT
// ========================================
const checkEnvVariables = () => {
  log.info('Vérification des variables d\'environnement...');
  
  const requiredVars = ['MONGO_URI', 'JWT_SECRET', 'NODE_ENV'];
  const optionalVars = ['FRONTEND_URL', 'PORT'];

  let allPresent = true;

  requiredVars.forEach(varName => {
    if (process.env[varName]) {
      log.success(`${varName} défini`);
    } else {
      log.error(`${varName} MANQUANT (requis)`);
      allPresent = false;
    }
  });

  optionalVars.forEach(varName => {
    if (process.env[varName]) {
      log.success(`${varName} défini`);
    } else {
      log.warning(`${varName} non défini (optionnel)`);
    }
  });

  return allPresent;
};

// ========================================
// FONCTION PRINCIPALE
// ========================================
const verify = async () => {
  console.log('\n' + '='.repeat(60));
  console.log('🔍 VÉRIFICATION DE LA CONFIGURATION ALTCOM');
  console.log('='.repeat(60) + '\n');

  // 1. Vérifier les variables d'environnement
  console.log('📋 Variables d\'environnement:');
  const envOk = checkEnvVariables();
  console.log('');

  // 2. Vérifier les fichiers backend
  console.log('📁 Fichiers Backend:');
  const backendFiles = [
    'models/Service.js',
    'models/PortfolioItem.js',
    'models/Review.js',
    'models/AltcomProject.js',
    'controllers/serviceController.js',
    'controllers/portfolioController.js',
    'controllers/reviewController.js',
    'controllers/altcomController.js',
    'routes/serviceRoutes.js',
    'routes/portfolioRoutes.js',
    'routes/reviewRoutes.js',
    'routes/altcomRoutes.js',
  ];

  let allBackendFilesPresent = true;
  backendFiles.forEach(file => {
    if (!checkFile(file, true)) {
      allBackendFilesPresent = false;
    }
  });
  console.log('');

  // 3. Vérifier le serveur principal
  console.log('🖥️  Serveur Principal:');
  checkFile('server.js', true);
  console.log('');

  // 4. Vérifier la base de données
  console.log('🗄️  Base de Données:');
  const dbOk = await checkDatabase();
  console.log('');

  // 5. Résumé final
  console.log('='.repeat(60));
  console.log('📊 RÉSUMÉ DE LA VÉRIFICATION');
  console.log('='.repeat(60));
  
  if (envOk && allBackendFilesPresent && dbOk) {
    log.success('Tous les éléments critiques sont en place !');
    console.log('\n✨ Votre configuration Altcom est prête à l\'emploi.\n');
    console.log('🚀 Prochaines étapes :');
    console.log('   1. Démarrer le serveur: npm start');
    console.log('   2. Accéder à: http://localhost:5000/api/services?pole=Altcom');
    console.log('   3. Tester le frontend: http://localhost:5173/altcom\n');
  } else {
    log.error('Certains éléments sont manquants.');
    console.log('\n🔧 Actions recommandées :');
    
    if (!envOk) {
      console.log('   - Vérifier le fichier .env');
    }
    
    if (!allBackendFilesPresent) {
      console.log('   - Créer/copier les fichiers backend manquants');
    }
    
    if (!dbOk) {
      console.log('   - Vérifier la connexion MongoDB');
      console.log('   - Exécuter: node scripts/seedAltcomData.js');
    }
    
    console.log('');
  }

  process.exit(envOk && allBackendFilesPresent && dbOk ? 0 : 1);
};

// Exécution
verify();