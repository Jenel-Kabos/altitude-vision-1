// __tests__/setup.js — Variables d'environnement pour les tests (pas de vraie DB)
process.env.NODE_ENV    = 'test';
process.env.JWT_SECRET  = 'test-secret-jwt-altitude-vision-2024';
process.env.JWT_EXPIRES_IN = '1d';
process.env.MONGO_URI   = 'mongodb://localhost/altitude-test'; // jamais connecté (modèles mockés)
process.env.PORT        = '5001';
process.env.FRONTEND_URL = 'http://localhost:3000';
