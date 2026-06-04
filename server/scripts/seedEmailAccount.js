/**
 * seedEmailAccount.js
 * Insère le compte email Zoho expéditeur dans la collection `emails`.
 * Usage : node server/scripts/seedEmailAccount.js
 * Supprimer ce fichier après exécution.
 */
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const mongoose = require('mongoose');
const Email    = require('../models/Email');

const FROM_EMAIL  = process.env.ZOHO_FROM_EMAIL || 'contact@altitudevision.agency';

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('✅ Connecté à MongoDB');

  const existing = await Email.findOne({ email: FROM_EMAIL });

  if (existing) {
    console.log(`ℹ️  Document déjà présent (isActive: ${existing.isActive}) — aucune insertion.`);
    if (!existing.isActive) {
      existing.isActive = true;
      await existing.save();
      console.log('✅ isActive mis à true.');
    }
  } else {
    await Email.create({
      email:       FROM_EMAIL,
      displayName: 'Altitude Vision',
      emailType:   'Contact Général',
      isActive:    true,
      emailsSent:  0,
    });
    console.log(`✅ Document créé : ${FROM_EMAIL}`);
  }

  await mongoose.disconnect();
  console.log('🔌 Déconnecté.');
}

run().catch(err => {
  console.error('❌', err.message);
  process.exit(1);
});
