# IAM-3 — ÉTAT INITIAL DES PERMISSIONS STAFF

Date : 2026-08-14  
Branche/HEAD : `main` / `c523b3118549da770bc761d5e7b93de8deb58605`  
Base : worktree IAM-2 conservé sans modification.

## 1. Rôles staff

`Admin`, `Secretaire`, `GestionnaireImmobilier`, `CommunityManager`, plus `Collaborateur` et `Communicant` legacy. `User.role` reste inchangé. IAM-2 fournit déjà `server/utils/iamArchitecture.js`, mais sa projection n'est pas encore un guard backend.

## 2. Routes utilisées

Inventaire prioritaire des surfaces réellement montées :

| Domaine | Méthode / route | Auth / tenant | Guard actuel | Action |
|---|---|---|---|---|
| Documents | GET `/api/documents`, `/:id` | protect + tenant | `STAFF_DOC` | READ |
| Documents | POST `/api/documents`; PATCH `/:id` | protect + tenant + write window | `STAFF_DOC` | MANAGE |
| Documents | DELETE `/api/documents/:id` | protect + tenant | Admin | MANAGE |
| Docs locatifs | GET `/api/gestion-docs/contrat/:id` | protect | `STAFF_DOC` | READ |
| Docs locatifs | POST `/api/gestion-docs/{bail,quittance,mise-en-demeure,preavis,etat-des-lieux,envoyer}/…` | protect | `STAFF_DOC` | MANAGE |
| Docs privés | GET `/api/rental-documents/:documentId/download` | protect; scope contrôleur | ownership/tenant contrôleur | READ ciblé |
| Paiements | GET `/api/paiements`, `/:id`, `/stats`, `/alertes`, proof/receipts | protect; tenant ressource sur `:id` | `ROLES_PAIEMENTS` | READ sensible |
| Paiements | POST calcul pénalités/encaissements/marquer payé; PUT `/:id` | protect; tenant ressource | `ROLES_PAIEMENTS` | MANAGE |
| Paiements | DELETE `/:id` | protect; tenant ressource | Admin | MANAGE |
| GL | GET `/api/rental-management`, stats, `/:id`, history | protect + tenant + scope ressource | `ROLES_GL` | READ |
| GL | POST/PATCH `/api/rental-management/**` | protect + tenant + scope ressource | `ROLES_GL` | MANAGE |
| Locataires | GET `/api/locataires/**` | protect; tenant/scope selon route | `STAFF_IMMO + Secretaire` | READ ciblé |
| Locataires | POST/PUT/PATCH/DELETE `/api/locataires/**` | protect; scope selon route | `STAFF_IMMO` | MANAGE |
| Contrats | GET `/api/contrats`, `/:id`, `/:id/paiements` | protect; tenant/scope ressource | `STAFF_IMMO + Secretaire` | READ |
| Contrats | POST/PUT `/api/contrats/**` | protect; tenant/scope ressource | `STAFF_IMMO` ou `STAFF_DOC` | MANAGE |
| Visites | GET `/api/visites`, unread, all-payments | protect | `ROLES_UNIVERSAL` | READ |
| Visites | PATCH `/api/visites/:id` et paiement | protect | `ROLES_UNIVERSAL` | MANAGE |
| Maintenance GL | GET `/api/rental-maintenance/**` | protect + tenant; scope contrôleur | aucun guard staff explicite | READ |
| Maintenance GL | POST/PATCH `/api/rental-maintenance/**` | protect + tenant; scope contrôleur | contrôleur | MANAGE |
| Maintenance hôtel | GET/POST/PATCH `/api/maintenance/**` | protect; ABAC hôtel contrôleur | assignment/ownership | READ/MANAGE |
| Préavis | POST `/api/rental-management/:id/{start,acknowledge,cancel}-notice` | protect + tenant + scope | `ROLES_GL` | MANAGE |
| Altcom | GET `/api/altcom/projects/**` | protect | `STAFF_CM` | READ |
| Altcom | PATCH/DELETE `/api/altcom/projects/**` | protect | `STAFF_CM` | MANAGE |
| Mila Events | GET `/api/events/**` | public | aucun | READ public |
| Mila Events | POST/PUT/PATCH/DELETE `/api/events/**` | protect + write window | `STAFF_CM` | MANAGE |
| Utilisateurs | `/api/users/**`, `/api/admin/owners/**` | protect + tenant selon surface | essentiellement Admin | READ/MANAGE |
| Notifications | `/api/notifications/**` | protect | self | READ/MANAGE self |
| Messagerie | `/api/conversations/**`, `/api/messages/**` | protect | participants/staff inbox | READ/MANAGE scoped |

Controllers/services/modèles principaux : `documentController`→`Document`; `gestionDocumentController`→`Contrat/Paiement`; `paiementController`→`Paiement`; `rentalManagementController`→`RentalManagement`; `locataireController`→`Locataire`; `contratController`→`Contrat`; `visiteController`→`Visite`; `rentalMaintenanceController`→`RentalMaintenance`; `maintenanceController`→maintenance hôtel + ABAC; `altcomController`→`AltcomProject`; `eventController`→`Event`.

## 3. Guards actuels

Les tableaux `STAFF_DOC`, `ROLES_PAIEMENTS`, `ROLES_GL`, `STAFF_CM` et `ROLES_UNIVERSAL` sont appliqués à des routeurs entiers ou réutilisés pour GET et mutations. Le tenant et l'ownership sont généralement des couches séparées et doivent rester en place.

## 4. Capacités actuelles

IAM-2 projette des capacités, sans middleware d'enforcement. Les routes continuent donc de décider uniquement par listes de rôles. Le frontend recopie aussi des listes dans `AdminDashboard.jsx`.

## 5. Mélange lecture/mutation

Mélange confirmé dans Documents, gestion documentaire locative, Paiements, Gestion locative, Visites, Altcom et Mila Events. Les routes sont déjà distinctes; une réécriture des contrôleurs n'est pas nécessaire. Un middleware simple par action peut être inséré sans modifier les contrats API.

## 6. Admin

Admin figure dans tous les groupes audités. Il reste néanmoins dépendant du tenant, du scope ressource, de l'ABAC hôtel et des invariants métier. Le futur wildcard ne devra contourner aucune de ces couches.

## 7. Secrétaire

Conforme sur documents/paiements, trop large sur toute la GL via `ROLES_GL`. Lecture auxiliaire déjà présente pour contrats et locataires. Risque P1 : mutations rental et préavis actuellement possibles.

## 8. Gestionnaire immobilier

Conforme sur GL/visites/maintenance. Trop large sur documents via `STAFF_DOC`; une correction GL-B2 précédente a volontairement accordé cet accès global pour éviter des 403 UI, mais la cible IAM-3 exige désormais la séparation. Il n'est pas dans `ROLES_PAIEMENTS`, sauf annulation de reçu explicitement accordée — incohérence financière P1.

## 9. Community Manager

Conforme sur Altcom/Mila Events. Trop large sur visites via `ROLES_UNIVERSAL` et sur plusieurs surfaces immobilières via `ROLES_ALTIMMO`. IAM-3 traitera les domaines staff prioritaires sans réécrire les parcours propriétaires/hôteliers.

## 10. Risques

- capacité seule sans tenant/scope : IDOR;
- menu caché sans guard backend : contournement API direct;
- remplacement global de groupes legacy : régression `Collaborateur`;
- application globale aux routeurs maintenance partagés : régression propriétaire/client/assignment hôtel;
- documents privés et financiers : exposition d'assets si le contrôleur est contourné.

## 11. P0/P1/P2/P3/P4

- P0 : aucun nouveau bypass tenant démontré dans ce preflight.
- P1 : Secrétaire peut muter la GL; CommunityManager peut muter les visites; Gestionnaire peut gérer les documents et annuler un reçu.
- P2 : mêmes guards pour GET et mutations dans sept domaines.
- P3 : sidebar/dashboard fondés sur listes de rôles dupliquées.
- P4 : `Collaborateur` legacy large et `Communicant` nécessitent une compatibilité explicite.

## 12. Stratégie de correction

Étendre la source IAM-2; ajouter `requireCapability`; préserver `Collaborateur` comme legacy complet et Admin comme wildcard; appliquer les capacités route par route dans l'ordre Documents, Paiements, GL/Locataires/Contrats, Visites, Maintenance GL, Altcom, Mila Events; ne pas remplacer l'ABAC hôtel ni les scopes propriétaires; ajouter des tests API directs et aligner prudemment le shell web.

Ce rapport précède toute modification IAM-3 significative.
