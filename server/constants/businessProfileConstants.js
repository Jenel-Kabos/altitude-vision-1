// USER-ARCH-1 — Registre central des profils métiers d'un utilisateur.
// `User.role` reste l'identité de connexion et le RBAC historique (jamais
// modifié par ce sprint) ; ces profils décrivent, en complément, QUELLES
// activités métier cette identité porte réellement (un même User peut
// cumuler plusieurs profils — voir UserBusinessProfile.js). Extensible sans
// changement cassant : ajouter une valeur ici n'affecte aucun code existant.
const BUSINESS_PROFILE_TYPES = [
  'proprietaire_immobilier',   // possède/publie des biens vente/location (Property.owner)
  'exploitant_etablissement',  // exploite un hébergement meublé ou un hôtel (Accommodation/Hotel)
  'locataire',                 // occupe un bien en gestion locative (Locataire.user)
  'client',                    // simple client (réservations, visites, devis...)
];

const BUSINESS_PROFILE_STATUSES = ['active', 'suspended', 'revoked'];

module.exports = { BUSINESS_PROFILE_TYPES, BUSINESS_PROFILE_STATUSES };
