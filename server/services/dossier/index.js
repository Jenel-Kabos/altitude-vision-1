// DOC-EVO-1 — Point d'enregistrement unique des adaptateurs de dossier.
// Pour connecter un nouveau pôle demain (Altcom, Mila Events,
// Administration, RH, Comptabilité) : écrire un adaptateur
// `load({ entityId, user })` retournant l'enveloppe uniforme documentée
// dans dossierRegistry.js, puis l'enregistrer ici. Rien d'autre à modifier
// (ni le contrôleur, ni les routes, ni le frontend générique DossierPanel).
const { registerDossierAdapter } = require('./dossierRegistry');
const gestionLocative = require('./gestionLocativeDossierAdapter');
const venteLocation = require('./venteLocationDossierAdapter');
const { loadHebergementDossier, loadHotelDossier } = require('./hebergementHotelDossierAdapter');
// GL-ASSET-1 — 5ème domaine : dossier patrimonial du bien (entityId =
// Property._id), indépendant du bail.
const propertyAsset = require('./propertyDossierAdapter');

registerDossierAdapter('gestion_locative', gestionLocative.load);
registerDossierAdapter('vente_location', venteLocation.load);
registerDossierAdapter('hebergement', loadHebergementDossier);
registerDossierAdapter('hotellerie', loadHotelDossier);
registerDossierAdapter('bien', propertyAsset.load);

module.exports = require('./dossierRegistry');
