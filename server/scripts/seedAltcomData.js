/**
 * Script de seed pour peupler la base de données avec des données Altcom
 * Compatible avec votre structure existante
 * Usage: node scripts/seedAltcomData.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Service = require('../models/Service');
const PortfolioItem = require('../models/PortfolioItem');
const Review = require('../models/Review');
const User = require('../models/User');

// ========================================
// CONNEXION À MONGODB
// ========================================
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ MongoDB connecté pour le seeding');
  } catch (error) {
    console.error('❌ Erreur de connexion MongoDB:', error);
    process.exit(1);
  }
};

// ========================================
// DONNÉES DE SEED - SERVICES ALTCOM
// ========================================
const servicesData = [
  {
    title: 'Communication Digitale',
    description: 'Création de contenus percutants et campagnes sur mesure pour les réseaux sociaux et le web. Stratégies d\'engagement et visibilité maximale.',
    pole: 'Altcom',
    price: 500000,
    imageUrl: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800',
    options: [
      { name: 'Gestion réseaux sociaux', price: 300000, description: '3 posts/semaine' },
      { name: 'Campagne complète', price: 800000, description: 'Stratégie + contenus + suivi' },
    ]
  },
  {
    title: 'Branding & Design',
    description: 'Définition d\'identité visuelle complète et création de supports graphiques professionnels. Logo, charte graphique, papeterie.',
    pole: 'Altcom',
    price: 1000000,
    imageUrl: 'https://images.unsplash.com/photo-1561070791-2526d30994b5?w=800',
    options: [
      { name: 'Logo simple', price: 400000, description: '3 propositions' },
      { name: 'Identité complète', price: 1500000, description: 'Logo + charte + supports' },
    ]
  },
  {
    title: 'Stratégie de Contenu',
    description: 'Élaboration de stratégies éditoriales et de contenus adaptés à vos objectifs marketing. Planification et optimisation SEO.',
    pole: 'Altcom',
    price: 750000,
    imageUrl: 'https://images.unsplash.com/photo-1552664730-d307ca884978?w=800',
  },
  {
    title: 'Campagne Publicitaire',
    description: 'Conception et gestion de campagnes publicitaires multi-canaux pour maximiser votre ROI. Facebook Ads, Google Ads, display.',
    pole: 'Altcom',
    price: 2000000,
    imageUrl: 'https://images.unsplash.com/photo-1533750516457-a7f992034fec?w=800',
  },
  {
    title: 'Production Audiovisuelle',
    description: 'Réalisation de vidéos corporate, spots publicitaires et contenus audiovisuels de qualité professionnelle.',
    pole: 'Altcom',
    price: 1500000,
    imageUrl: 'https://images.unsplash.com/photo-1574717024653-61fd2cf4d44d?w=800',
  },
];

// ========================================
// DONNÉES DE SEED - PORTFOLIO ALTCOM
// ========================================
const portfolioData = [
  {
    title: 'Campagne Digitale TechStartup Congo',
    description: 'Campagne de lancement produit sur les réseaux sociaux avec génération de 10 000 leads qualifiés en 3 mois. Stratégie multi-plateformes (Facebook, Instagram, LinkedIn).',
    pole: 'Altcom',
    category: 'Communication Digitale',
    images: [
      'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800',
    ],
    link: 'https://techstartup-cg.com',
    client: 'TechStartup Congo',
    tags: ['Social Media', 'Lead Generation', 'Digital', 'B2B'],
    projectDate: new Date('2024-09-15'),
    isPublished: true,
  },
  {
    title: 'Refonte Identité Visuelle GlobalCorp',
    description: 'Création complète d\'une nouvelle identité visuelle moderne et impactante. Logo, charte graphique, supports print et digital.',
    pole: 'Altcom',
    category: 'Branding & Design',
    images: [
      'https://images.unsplash.com/photo-1561070791-2526d30994b5?w=800',
    ],
    link: 'https://globalcorp-cg.com',
    client: 'GlobalCorp Brazzaville',
    tags: ['Branding', 'Logo', 'Charte Graphique', 'Design'],
    projectDate: new Date('2024-10-20'),
    isPublished: true,
  },
  {
    title: 'Stratégie Éditoriale E-commerce Fashion',
    description: 'Développement d\'une stratégie de contenu complète ayant augmenté le trafic organique de 200% en 6 mois.',
    pole: 'Altcom',
    category: 'Stratégie de Contenu',
    images: [
      'https://images.unsplash.com/photo-1552664730-d307ca884978?w=800',
    ],
    link: 'https://fashioncg.com',
    client: 'Fashion CG E-Store',
    tags: ['Content Strategy', 'SEO', 'E-commerce', 'Blog'],
    projectDate: new Date('2024-08-10'),
    isPublished: true,
  },
  {
    title: 'Campagne TV & Digital - Banque Postale',
    description: 'Campagne intégrée TV et digital pour le lancement d\'une nouvelle offre bancaire. Couverture nationale avec 5M d\'impressions.',
    pole: 'Altcom',
    category: 'Campagne Publicitaire',
    images: [
      'https://images.unsplash.com/photo-1533750516457-a7f992034fec?w=800',
    ],
    link: 'https://laposte.cg',
    client: 'Banque Postale du Congo',
    tags: ['TV', 'Digital', 'Finance', 'Campagne Nationale'],
    projectDate: new Date('2024-11-05'),
    isPublished: true,
  },
  {
    title: 'Spot Corporate - Innovation Lab Congo',
    description: 'Production d\'un spot vidéo corporate de 2 minutes présentant les valeurs et l\'équipe de l\'entreprise.',
    pole: 'Altcom',
    category: 'Production Audiovisuelle',
    images: [
      'https://images.unsplash.com/photo-1574717024653-61fd2cf4d44d?w=800',
    ],
    link: 'https://innovationlab-cg.com',
    client: 'Innovation Lab Congo',
    tags: ['Vidéo', 'Corporate', 'Production', 'Storytelling'],
    projectDate: new Date('2024-07-25'),
    isPublished: true,
  },
  {
    title: 'Social Media Management - Green Earth ONG',
    description: 'Gestion complète des réseaux sociaux avec croissance de 500% de l\'engagement en 4 mois. Campagnes de sensibilisation environnementale.',
    pole: 'Altcom',
    category: 'Communication Digitale',
    images: [
      'https://images.unsplash.com/photo-1611162617474-5b21e879e113?w=800',
    ],
    link: 'https://greenearth-cg.org',
    client: 'Green Earth ONG',
    tags: ['Social Media', 'NGO', 'Engagement', 'Environnement'],
    projectDate: new Date('2024-06-12'),
    isPublished: true,
  },
];

// ========================================
// FONCTION PRINCIPALE DE SEED
// ========================================
const seedData = async () => {
  try {
    await connectDB();

    console.log('🗑️  Suppression des données Altcom existantes...');
    
    // Supprimer uniquement les données Altcom
    await Service.deleteMany({ pole: 'Altcom' });
    await PortfolioItem.deleteMany({ pole: 'Altcom' });
    
    console.log('✅ Données Altcom supprimées');

    // === INSERTION DES SERVICES ===
    console.log('📦 Insertion des services Altcom...');
    const services = await Service.insertMany(servicesData);
    console.log(`✅ ${services.length} services insérés`);

    // === INSERTION DU PORTFOLIO ===
    console.log('📦 Insertion des éléments de portfolio Altcom...');
    const portfolioItems = await PortfolioItem.insertMany(portfolioData);
    console.log(`✅ ${portfolioItems.length} éléments de portfolio insérés`);

    // === CRÉATION DES REVIEWS ===
    console.log('📦 Création de reviews...');
    
    // Récupérer ou créer un utilisateur test
    let testUser = await User.findOne({ email: 'client.altcom@test.com' });
    
    if (!testUser) {
      console.log('👤 Création d\'un utilisateur test pour les reviews...');
      testUser = await User.create({
        name: 'Marie Dupont',
        email: 'client.altcom@test.com',
        password: 'Test123!',
        role: 'Client',
        isActive: true,
      });
    }

    // Créer 4 reviews pour différents projets
    const reviewsData = [
      {
        rating: 5,
        comment: 'Excellent travail ! L\'équipe Altcom a dépassé toutes nos attentes. Communication fluide, respect des délais et résultats exceptionnels. Notre campagne digitale a généré 3 fois plus de leads que prévu.',
        author: testUser._id,
        portfolioItem: portfolioItems[0]._id, // TechStartup
      },
      {
        rating: 5,
        comment: 'Très satisfait de la refonte de notre identité visuelle. Professionnalisme et créativité au rendez-vous. Notre nouvelle image de marque a été saluée par tous nos partenaires.',
        author: testUser._id,
        portfolioItem: portfolioItems[1]._id, // GlobalCorp
      },
      {
        rating: 4,
        comment: 'Un partenaire de confiance pour notre stratégie de contenu. Réactivité, qualité et résultats mesurables. Le trafic de notre site a été multiplié par deux en quelques mois.',
        author: testUser._id,
        portfolioItem: portfolioItems[2]._id, // Fashion
      },
      {
        rating: 5,
        comment: 'Production vidéo de haute qualité qui a parfaitement capturé l\'essence de notre entreprise. Équipe professionnelle et à l\'écoute. Nous recommandons vivement Altcom.',
        author: testUser._id,
        portfolioItem: portfolioItems[4]._id, // Innovation Lab
      },
    ];

    await Review.insertMany(reviewsData);
    console.log(`✅ ${reviewsData.length} reviews créées`);

    // Recalculer les moyennes pour les éléments avec reviews
    console.log('🔄 Recalcul des notes moyennes...');
    for (const reviewData of reviewsData) {
      if (PortfolioItem.calcAverageRating) {
        await PortfolioItem.calcAverageRating(reviewData.portfolioItem);
      }
    }
    console.log('✅ Notes moyennes calculées');

    console.log('\n🎉 Seeding Altcom terminé avec succès !');
    console.log(`\n📊 Récapitulatif:`);
    console.log(`   - ${services.length} services`);
    console.log(`   - ${portfolioItems.length} projets portfolio`);
    console.log(`   - ${reviewsData.length} avis clients`);
    console.log(`\n💡 Vous pouvez maintenant tester la page Altcom !`);
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur lors du seeding:', error);
    process.exit(1);
  }
};

// ========================================
// FONCTION DE NETTOYAGE (OPTIONNELLE)
// ========================================
const cleanData = async () => {
  try {
    await connectDB();

    console.log('🗑️  Suppression de toutes les données Altcom...');
    
    await Service.deleteMany({ pole: 'Altcom' });
    await PortfolioItem.deleteMany({ pole: 'Altcom' });
    // NOTE: Ne supprime pas TOUTES les reviews, seulement celles liées à Altcom
    const altcomPortfolioIds = await PortfolioItem.find({ pole: 'Altcom' }).select('_id');
    await Review.deleteMany({ portfolioItem: { $in: altcomPortfolioIds } });
    
    console.log('✅ Toutes les données Altcom supprimées');
    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur lors du nettoyage:', error);
    process.exit(1);
  }
};

// ========================================
// EXÉCUTION DU SCRIPT
// ========================================
if (process.argv[2] === '-d' || process.argv[2] === '--delete') {
  cleanData();
} else {
  seedData();
}

// Usage:
// node scripts/seedAltcomData.js           -> Insère les données
// node scripts/seedAltcomData.js -d        -> Supprime les données Altcom
// node scripts/seedAltcomData.js --delete  -> Supprime les données Altcom