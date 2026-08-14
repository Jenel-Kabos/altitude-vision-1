// GL-UX-1 — même groupe de rôles que server/utils/roles.js STAFF_IMMO
// (Admin/GestionnaireImmobilier/Collaborateur). Aucun helper partagé
// n'existait côté client (chaque page redéfinissait son propre
// `canManage` local, souvent incomplet — voir audit GL-UX-1) ; celui-ci est
// réutilisé par tous les nouveaux écrans du cycle de vie du bail pour ne
// jamais afficher un bouton qui recevrait un 403 côté serveur.
export const STAFF_IMMO_ROLES = ['Admin', 'GestionnaireImmobilier', 'Collaborateur'];

export const isStaffImmo = (user) => STAFF_IMMO_ROLES.includes(user?.role);

// GL-ASSET-UX-1 — même groupe que server/utils/roles.js ROLES_DOCS/STAFF_DOC
// (Admin/Secretaire/Collaborateur/GestionnaireImmobilier), utilisé côté
// serveur par propertyAssetController.assertReadAccess pour les routes de
// LECTURE (historique/carnet/valorisation/alertes). Distinct de
// `isStaffImmo` (plus strict, réservé aux actions d'ÉCRITURE — transition
// de cycle de vie) : un Secretaire peut consulter le cockpit patrimonial
// mais ne peut pas faire transitionner le bien.
export const STAFF_DOCS_ROLES = ['Admin', 'Secretaire', 'Collaborateur'];

export const isStaffDocs = (user) => STAFF_DOCS_ROLES.includes(user?.role);
