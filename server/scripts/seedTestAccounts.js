const mongoose = require('mongoose');
require('dotenv').config();
const User = require('../models/User');
const bcrypt = require('bcryptjs');

async function seed() {
  await mongoose.connect(process.env.MONGO_URI);
  const password = await bcrypt.hash('Test1234!', 12);

  const accounts = [
    { name: 'Client Test', email: 'client.test@altimmo.test', role: 'Client' },
    { name: 'Admin Test',  email: 'admin.test@altimmo.test',  role: 'Admin'  },
  ];

  for (const acc of accounts) {
    const existing = await User.findOne({ email: acc.email });
    if (existing) {
      console.log(`⚠️  Déjà existant: ${acc.email}`);
      continue;
    }

    // Insertion directe via insertOne pour contourner la validation
    // passwordConfirm (virtual, requis uniquement via save()) et les
    // hooks pre-save qui re-hasheraient un hash déjà haché.
    const result = await User.collection.insertOne({
      name:            acc.name,
      email:           acc.email,
      role:            acc.role,
      password,          // déjà hashé — pas de re-hash par le hook
      isEmailVerified: true,
      isActive:        true,
      status:          'Actif',
      authProvider:    'local',
      tokenVersion:    0,
      createdAt:       new Date(),
      updatedAt:       new Date(),
    });

    console.log(`✅ Créé: ${acc.email} (${acc.role}) — ID: ${result.insertedId}`);
  }

  process.exit(0);
}

seed().catch(err => { console.error('❌', err.message); process.exit(1); });
