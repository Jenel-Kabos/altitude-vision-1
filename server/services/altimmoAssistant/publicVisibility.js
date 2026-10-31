// ALTIMMO-AI-INTEGRATION-01 — portes publiques de l'assistant, alignées sur la règle certifiée de main.
// La visibilité publique d'une annonce est celle de `commerciallyPublishedMongoFilter` (cycle de
// publication GIT-INTEGRATION-03B : validée, publiée, disponible, état `published` ou historique),
// restreinte à la marketplace Altimmo. Aucune autre porte n'est définie ici : une annonce retirée,
// suspendue, refusée, en attente ou en révision n'est jamais candidate.
const { commerciallyPublishedMongoFilter } = require('../propertyPublicationLifecycleService');

const assistantPublicPropertyGates = () => ({ ...commerciallyPublishedMongoFilter(), pole: 'Altimmo' });

module.exports = { assistantPublicPropertyGates };
