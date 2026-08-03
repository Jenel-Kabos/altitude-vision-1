// DOC-ARCH-1/2 — Taxonomie de navigation du Centre documentaire unifié
// (Pôle → Service → Catégorie). Purement une structure de NAVIGATION/AFFICHAGE
// (les dossiers sont des vues, jamais un lieu de stockage).
//
// DOC-ARCH-2 — le classement dans ces dossiers ne doit jamais dépendre d'un
// choix manuel quand un workflow métier existe : `pole`/`service`/`categorie`
// sont déduits automatiquement au moment de la création du document (voir
// server/services/finance/realEstateTransactionFinalizationService.js,
// server/controllers/locataireController.js, proprietaireController.js).
// La création manuelle (sélecteurs Pôle/Service/Catégorie du modal "Nouveau
// document") n'est qu'un mécanisme TRANSITOIRE pour les catégories qui n'ont
// pas encore de workflow dédié (ex: compromis/offres de vente, candidatures
// de location, tout Altcom/Mila Events/Administration) — elle disparaîtra
// naturellement service par service à mesure que de vrais workflows
// documentaires y seront construits. Ce n'est PAS une fonctionnalité
// métier en soi.
//
// `dataSource` indique comment le service alimente sa liste :
// - 'document'  : uniquement Document (filtré par pole/service côté API,
//                 tagué automatiquement par le workflow s'il existe, sinon
//                 saisi manuellement à titre transitoire)
// - 'contrats'  : fusionne Document ET Contrat.documents[] (Gestion Locative
//                 — ces fichiers ne sont stockés que dans Contrat.documents[],
//                 jamais dupliqués dans la collection Document). 100%
//                 automatique, aucune création manuelle dans ce dossier.
// `financialDomain` (optionnel) : le service affiche EN PLUS une projection
// en lecture seule de FinancialDocument (jamais dupliqué, voir
// FinancialDocumentsFolder.jsx) — 'hotel' ou 'accommodation'.
export const POLES = [
  {
    key: 'Altimmo',
    label: 'Altimmo',
    services: [
      {
        key: 'gestion_locative', label: 'Gestion locative', dataSource: 'contrats',
        categories: ['Contrats de bail', 'Quittances', 'États des lieux', 'Préavis', 'Mises en demeure', "Pièces d'identité", 'Dépôts de garantie', 'Courriers locatifs'],
      },
      {
        key: 'proprietaires', label: 'Propriétaires', dataSource: 'document',
        categories: ['Contrats de partenariat', 'Mandats', "Pièces d'identité", 'Titres de propriété'],
      },
      {
        key: 'vente', label: 'Vente', dataSource: 'document',
        categories: ['Compromis', 'Contrats de vente', 'Devis', 'Factures', 'Offres', 'Réservations', 'Documents juridiques'],
      },
      {
        key: 'location', label: 'Location', dataSource: 'document',
        categories: ['Candidatures', 'Réservations', 'Contrats', 'Devis', 'Factures'],
      },
      {
        key: 'hebergements', label: 'Hébergements', dataSource: 'document', financialDomain: 'accommodation',
        categories: ['Réservations', 'Factures', 'Paiements', 'États des lieux', 'Annulations'],
      },
      {
        key: 'hotellerie', label: 'Hôtellerie', dataSource: 'document', financialDomain: 'hotel',
        categories: ['Réservations', 'Factures', 'Check-in', 'Check-out', 'Housekeeping', 'Maintenance', "Rapports d'inspection"],
      },
    ],
  },
  {
    key: 'Altcom',
    label: 'Altcom',
    services: [
      {
        key: 'communication', label: 'Communication', dataSource: 'document',
        categories: ['Devis', 'Contrats', 'Factures', 'Briefs', 'Cahiers des charges', 'Livrables', 'Rapports', 'Bons de commande'],
      },
    ],
  },
  {
    key: 'MilaEvents',
    label: 'Mila Events',
    services: [
      {
        key: 'evenementiel', label: 'Événementiel', dataSource: 'document',
        categories: ['Devis', 'Contrats', 'Factures', 'Feuilles de route', 'Planning', 'Prestataires', 'Rapports', 'Bilans'],
      },
    ],
  },
  {
    key: 'Administration',
    label: 'Administration Altitude Vision',
    services: [
      {
        key: 'administration', label: 'Administration', dataSource: 'document',
        categories: ['Documents RH', 'Documents internes', 'Documents financiers', 'Documents juridiques', 'Procès-verbaux', 'Décisions', 'Courriers administratifs'],
      },
    ],
  },
];

export const findPole = (poleKey) => POLES.find((p) => p.key === poleKey) || null;
export const findService = (poleKey, serviceKey) => findPole(poleKey)?.services.find((s) => s.key === serviceKey) || null;
