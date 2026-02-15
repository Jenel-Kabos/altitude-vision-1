// fix-reviews-indexes.js
// Script à exécuter UNE SEULE FOIS pour corriger les index de la collection reviews

const mongoose = require('mongoose');
require('dotenv').config();

const fixReviewsIndexes = async () => {
  try {
    console.log('🔧 Connexion à MongoDB...');
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connecté à MongoDB');

    const db = mongoose.connection.db;
    const reviewsCollection = db.collection('reviews');

    // 1. Lister les index existants
    console.log('\n📋 Index actuels:');
    const indexes = await reviewsCollection.indexes();
    indexes.forEach(index => {
      console.log(`   - ${index.name}:`, index.key);
    });

    // 2. Supprimer l'ancien index portfolioItem_1_author_1 s'il existe
    const oldIndexName = 'portfolioItem_1_author_1';
    const hasOldIndex = indexes.some(idx => idx.name === oldIndexName);
    
    if (hasOldIndex) {
      console.log(`\n🗑️  Suppression de l'ancien index: ${oldIndexName}`);
      await reviewsCollection.dropIndex(oldIndexName);
      console.log('✅ Ancien index supprimé');
    } else {
      console.log(`\n⚠️  L'ancien index ${oldIndexName} n'existe pas (déjà supprimé ou jamais créé)`);
    }

    // 3. Créer le nouveau index pole_1_author_1 s'il n'existe pas
    const newIndexName = 'pole_1_author_1';
    const hasNewIndex = indexes.some(idx => idx.name === newIndexName);
    
    if (!hasNewIndex) {
      console.log(`\n🔨 Création du nouvel index: ${newIndexName}`);
      await reviewsCollection.createIndex(
        { pole: 1, author: 1 },
        { unique: true, name: newIndexName }
      );
      console.log('✅ Nouvel index créé');
    } else {
      console.log(`\n✅ Le nouvel index ${newIndexName} existe déjà`);
    }

    // 4. Vérifier les index finaux
    console.log('\n📋 Index finaux:');
    const finalIndexes = await reviewsCollection.indexes();
    finalIndexes.forEach(index => {
      console.log(`   - ${index.name}:`, index.key);
    });

    // 5. Optionnel : Supprimer les reviews avec portfolioItem (anciennes données)
    const oldReviewsCount = await reviewsCollection.countDocuments({ portfolioItem: { $exists: true } });
    if (oldReviewsCount > 0) {
      console.log(`\n⚠️  ${oldReviewsCount} ancien(s) avis avec portfolioItem détecté(s)`);
      console.log('🗑️  Suppression des anciens avis...');
      const result = await reviewsCollection.deleteMany({ portfolioItem: { $exists: true } });
      console.log(`✅ ${result.deletedCount} ancien(s) avis supprimé(s)`);
    } else {
      console.log('\n✅ Aucun ancien avis à supprimer');
    }

    console.log('\n🎉 Migration terminée avec succès !');
    console.log('\n💡 Vous pouvez maintenant redémarrer votre serveur backend.');

  } catch (error) {
    console.error('❌ Erreur lors de la migration:', error);
    throw error;
  } finally {
    await mongoose.disconnect();
    console.log('👋 Déconnexion de MongoDB');
  }
};

// Exécution
fixReviewsIndexes()
  .then(() => {
    console.log('\n✅ Script terminé');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script échoué:', error);
    process.exit(1);
  });