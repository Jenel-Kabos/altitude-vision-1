// UX-OWNER-4 — script ponctuel, jamais exécuté en production, jamais appelé
// par le harnais principal. Ajoute UN utilisateur `role: 'Proprietaire'`
// sans aucune Property/Hotel/Accommodation/HotelStaffAssignment/Locataire
// associée, à la même instance Mongo éphémère que start-accommodation-e2e.js
// (URI passée en argument, jamais codée en dur). Aucune règle IAM
// contournée : ce compte est un utilisateur normal, simplement dépourvu de
// toute ressource — exactement le cas que le mandat UX-OWNER-4 demande de
// tester (réserve A d'UX-OWNER-3).
const mongoose = require('mongoose');
const User = require('../models/User');

async function main() {
  const uri = process.argv[2];
  if (!uri) { console.error('Usage: node add-owner-zero-resource-fixture.js <mongo-uri>'); process.exit(1); }
  await mongoose.connect(uri);

  const email = 'owner-zero-resource-e2e@example.test';
  const existing = await User.findOne({ email });
  if (existing) {
    console.log('FIXTURE_READY id=' + existing._id);
    await mongoose.disconnect();
    return;
  }

  const user = await User.create({
    name: 'Owner Zero Resource E2E',
    email,
    password: 'OwnerZeroResource!2026',
    passwordConfirm: 'OwnerZeroResource!2026',
    role: 'Proprietaire',
    isEmailVerified: true,
  });

  console.log('FIXTURE_READY id=' + user._id);
  await mongoose.disconnect();
}

main().catch((err) => { console.error(err); process.exit(1); });
