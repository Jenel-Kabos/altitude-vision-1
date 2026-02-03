// scripts/migrateToInternalMail.js
/**
 * Script de migration pour transformer les anciens messages (Message) 
 * en emails internes (InternalMail)
 * 
 * USAGE:
 * node scripts/migrateToInternalMail.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Message = require('../models/Message');
const InternalMail = require('../models/InternalMail');

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('✅ MongoDB connecté pour la migration');
  } catch (error) {
    console.error('❌ Erreur de connexion MongoDB:', error.message);
    process.exit(1);
  }
};

const migrateMessages = async () => {
  try {
    console.log('\n🔄 Démarrage de la migration...\n');

    // 1. Compter les messages existants
    const messageCount = await Message.countDocuments();
    console.log(`📊 Messages à migrer : ${messageCount}`);

    if (messageCount === 0) {
      console.log('ℹ️  Aucun message à migrer.');
      return;
    }

    // 2. Récupérer tous les messages
    const messages = await Message.find()
      .populate('sender', 'name email')
      .populate('receiver', 'name email')
      .lean();

    console.log(`📥 ${messages.length} messages récupérés\n`);

    // 3. Transformer et insérer dans InternalMail
    let successCount = 0;
    let errorCount = 0;
    const errors = [];

    for (const msg of messages) {
      try {
        // Vérifier si le message existe déjà dans InternalMail
        const exists = await InternalMail.findOne({
          sender: msg.sender._id || msg.sender,
          receiver: msg.receiver._id || msg.receiver,
          content: msg.content,
          createdAt: msg.createdAt
        });

        if (exists) {
          console.log(`⏭️  Message ${msg._id} déjà migré, ignoré`);
          continue;
        }

        // Créer le nouvel email interne
        await InternalMail.create({
          sender: msg.sender._id || msg.sender,
          receiver: msg.receiver._id || msg.receiver,
          subject: msg.subject || 'Sans objet',
          content: msg.content,
          priority: 'Normale', // Priorité par défaut
          isRead: msg.isRead || false,
          readAt: msg.readAt || null,
          isStarred: msg.isStarred || false,
          isDraft: false, // Les anciens messages ne sont pas des brouillons
          isDeleted: false,
          attachments: msg.attachments || [],
          createdAt: msg.createdAt,
          updatedAt: msg.updatedAt,
        });

        successCount++;
        console.log(`✅ Message ${msg._id} migré avec succès`);
      } catch (error) {
        errorCount++;
        errors.push({ messageId: msg._id, error: error.message });
        console.error(`❌ Erreur lors de la migration du message ${msg._id}:`, error.message);
      }
    }

    // 4. Résumé de la migration
    console.log('\n' + '='.repeat(60));
    console.log('📊 RÉSUMÉ DE LA MIGRATION');
    console.log('='.repeat(60));
    console.log(`✅ Messages migrés avec succès : ${successCount}`);
    console.log(`❌ Erreurs : ${errorCount}`);
    console.log(`📊 Total traité : ${successCount + errorCount}`);

    if (errors.length > 0) {
      console.log('\n⚠️  Détails des erreurs :');
      errors.forEach((err, index) => {
        console.log(`   ${index + 1}. Message ${err.messageId}: ${err.error}`);
      });
    }

    // 5. Vérification
    const internalMailCount = await InternalMail.countDocuments();
    console.log(`\n📧 Total d'emails internes dans la base : ${internalMailCount}`);

    console.log('\n✅ Migration terminée avec succès !');
  } catch (error) {
    console.error('❌ Erreur lors de la migration:', error);
    throw error;
  }
};

// Fonction principale
const main = async () => {
  try {
    await connectDB();
    await migrateMessages();
    
    console.log('\n🎉 Migration complète !');
    console.log('\nℹ️  IMPORTANT :');
    console.log('   - Les anciens messages (Message) sont toujours dans la base');
    console.log('   - Ils ont été COPIÉS dans InternalMail');
    console.log('   - Vous pouvez maintenant utiliser /api/internal-mails');
    console.log('   - Pour supprimer les anciens messages, lancez le script de nettoyage\n');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Échec de la migration:', error);
    process.exit(1);
  }
};

// Lancement du script
console.log('\n' + '='.repeat(60));
console.log('🚀 SCRIPT DE MIGRATION : Message → InternalMail');
console.log('='.repeat(60) + '\n');

main();