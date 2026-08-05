# MOB-GAP-1 — Roadmap de parité Mobile

## Ordre recommandé avant le CRM

Le premier sprint à lancer est **MOBILE-NAV-1 — Socle destinations personnelles et deep links**, puis **GL-MOBILE-1**. Construire directement le portail locataire sans ce socle reproduirait les liens morts déjà observés dans les notifications.

## MOBILE-NAV-1 — Navigation, contrats transverses et documents personnels

- Audience : client, locataire, propriétaire.
- Objectif : registre typé des destinations, deep links authentifiés, fallback explicite, lecteur/téléchargeur/partageur de document sécurisé.
- Écrans : routeur de notification, destination indisponible, document personnel, paiement/réservation générique.
- API réutilisées : notifications, conversations, propriétés, documents locatifs et financiers.
- API à adapter : projection légère de notification et URL/téléchargement compatible React Native ; contrat de destination stable côté serveur.
- Risques : navigation imbriquée, session expirée au cold start, fichiers privés et URLs éphémères.
- Effort : moyen.
- Certification : tests unitaires de chaque type de notification, cold/warm start, universal links Android/iOS, ouverture et partage de PDF/image.

## GL-MOBILE-1 — Portail locataire natif

- Audience : locataire.
- Objectif : rendre accessibles les obligations et actions quotidiennes du bail.
- Écrans : accueil, bail, échéancier, paiement, quittances, maintenance avec photos, documents, notifications.
- API réutilisées : `/api/tenant-portal/*`, `/api/rental-documents/*`, notifications.
- API à adapter : projections mobiles paginées ; téléchargement privé ; éventuel endpoint de paiement locatif si initiation exigée.
- Dépendances : MOBILE-NAV-1.
- Risques : RBAC relationnel locataire/contrat, upload multipart, données financières sensibles.
- Effort : élevé.
- Certification : bail du seul locataire connecté, paiement et statut, upload maintenance, accès documentaire autorisé/refusé, deep links.

## ACC-MOBILE-1 — Réservations d'hébergements indépendants

- Audience : public/client.
- Objectif : compléter le détail déjà visible par réservation et suivi.
- Écrans : disponibilité, réservation, résumé, mes réservations, détail, annulation, paiement, remboursement.
- API réutilisées : accommodation reservations, disponibilité, payment transactions, refunds.
- API à adapter : projection mobile et idempotency key homogène avec l'hôtel.
- Dépendances : MOBILE-NAV-1 et socle paiement certifié.
- Risques : confusion hôtel/hébergement, concurrence de disponibilité, retour WebView.
- Effort : élevé.
- Certification : réservation concurrente, double clic, paiement succès/échec, annulation/remboursement, facture.

## PAY-MOBILE-1 — Consolidation des paiements personnels

- Audience : client et locataire.
- Objectif : unifier visite, transaction immobilière, location, hébergement et hôtel sans réimplémenter le Financial Core.
- Écrans : choix moyen, WebView/SDK, attente de confirmation, résultat, historique, justificatif, document.
- API réutilisées : intentions et vérification transaction, payment transactions, documents financiers.
- API à adapter : retour universel/deep link, statut canonique et projection d'erreur stable.
- Risques : doubles prélèvements, reprise après fermeture, opérateurs externes.
- Effort : très élevé.
- Certification : idempotence, expiration, retry, webhook tardif, facture/quittance, aucun montant calculé côté appareil.

## OWNER-MOBILE-1 — Cockpit propriétaire utile

- Audience : propriétaire.
- Objectif : compléter `MesAnnonces` avec patrimoine et pilotage personnel.
- Écrans : portefeuille, fiche actif, cycle de vie, revenus/dépenses, entretien, alertes, documents, réservations hébergement.
- API réutilisées : property assets, rental owner, accommodations/hotel owner.
- API à adapter : agrégats compacts et pagination timeline.
- Dépendances : MOBILE-NAV-1 ; idéalement GL-MOBILE-1 pour composants documentaires.
- Risques : mélanger annonces personnelles et actifs gérés ; exposition financière.
- Effort : élevé.
- Certification : séparation stricte des périmètres, totaux serveur, documents autorisés, alertes navigables.

## HOTEL-MOBILE-1 — Opérations terrain

- Audience : réception, housekeeping, inspecteur, maintenance, manager.
- Objectif : compléter `HotelOperationsScreen` sans déplacer le back-office lourd.
- Écrans : arrivées/départs, affectation, ménage, inspection, incident/maintenance, inventaire rapide.
- API réutilisées : room assignments, reservations, housekeeping, inspections, maintenance, inventory.
- API à adapter : endpoints « mes tâches » et payloads/photos mobiles.
- Dépendances : MOBILE-NAV-1.
- Risques : capacités hôtel par établissement, concurrence d'affectation, mode réseau instable.
- Effort : élevé.
- Certification : RBAC/capabilities, changement chambre concurrent, check-in/out, inspection rejetée → maintenance, reprise réseau.

## DOC-MOBILE-1 — Documents personnels

- Audience : client, locataire, propriétaire.
- Objectif : exposer uniquement les documents personnels, jamais le centre administratif.
- Écrans : liste filtrée, aperçu, téléchargement, partage, dossier métier simplifié.
- API réutilisées : rental documents, financial documents, dossiers.
- API à adapter : téléchargement stream/blob vers fichier local sécurisé, métadonnées MIME/nom/taille.
- Dépendances : MOBILE-NAV-1.
- Risques : cache de documents privés et partage involontaire.
- Effort : moyen.
- Certification : contrôle relationnel serveur, expiration locale, aperçu PDF/image, partage volontaire.

## CRM-IMMO-1 / CRM-IMMO-UX-1 / CRM-MOBILE-1

Le CRM doit commencer seulement après stabilisation de MOBILE-NAV-1 et définition de ses événements/destinations. Le backend CRM et le Web lourd précèdent le Mobile. `CRM-MOBILE-1` doit se limiter aux usages terrain : agenda, fiche contact compacte, notes, rappel, appel/message, visite et alerte urgente. Pipelines, reporting, configuration et imports restent Web-only.
