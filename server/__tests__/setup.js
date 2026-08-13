// __tests__/setup.js — environnement hermétique (DB locale, aucun credential fournisseur)
const { applySafeTestEnv } = require('../test-utils/safeTestEnv');
applySafeTestEnv(process.env);
process.env.JWT_SECRET  = 'test-secret-jwt-altitude-vision-2024';
process.env.JWT_EXPIRES_IN = '1d';
process.env.MONGO_URI   = 'mongodb://localhost/altitude-test'; // jamais connecté (modèles mockés)
process.env.PORT        = '5001';
process.env.FRONTEND_URL = 'http://localhost:3000';
require('../test-utils/externalNetworkGuard').installExternalNetworkGuard();
