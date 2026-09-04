# AUDIT-RENTAL-TENANT-OWNER-PORTALS-1 — Rapport final

## Executive Summary

**AUDIT :** AUDIT-RENTAL-TENANT-OWNER-PORTALS-1

**VERDICT : D — TENANT PORTAL EXISTS — DEDICATED OWNER RENTAL PORTAL MISSING**

**RENTAL SELF-SERVICE READINESS : 57/100**

**TENANT WEB : 83/100**

**TENANT MOBILE : 85/100**

**OWNER WEB : 39/100**

**OWNER MOBILE : 31/100**

| Indicateur | Conclusion |
|---|---|
| Tenant portal exists | **YES** |
| Owner rental portal exists | **PARTIAL** — espace patrimoine, pas portail financier locatif dédié |
| Tenant financial tracking | **PARTIAL** |
| Owner financial tracking | **PARTIAL** — résumé par bail actif seulement |
| Owner voit brut → commission → net → reversement | **NO** |
| P0 / P1 / P2 / P3 | **0 / 3 / 6 / 3** |
| Main tenant gap | Totaux financiers calculés sur la page paginée, et aucun reçu par encaissement accessible depuis la ligne de paiement |
| Main owner gap | Aucun écran loyers/transactions/reversements ; `/mes-biens/paiements` est un placeholder |
| Main financial gap | Aucun contrat canonique de net propriétaire et de reversement locatif |
| New financial model required | **NON CONFIRMÉ** — aucune preuve ne justifie un nouveau modèle avant conception du contrat de projection/reversement |
| Recommended next step | Sprint ciblé de correction des agrégats locataire et de caractérisation du ledger propriétaire, puis portail propriétaire en lecture |

Le locataire dispose d'un véritable portail autonome, accessible sur Web et Mobile, fondé sur une chaîne d'autorité sûre `User → Locataire.user → Contrat(type=location) → Paiement`. Il peut consulter son profil, ses baux, échéances, pénalités, documents, préavis, maintenance et notifications. Les téléchargements sont réautorisés côté serveur.

Ce portail n'est cependant pas financièrement complet : `getMyPaymentPage` agrège seulement les échéances de la page courante, bien que l'interface affiche « Total dû », « Total reçu » et « Montant restant » comme des totaux globaux. Le dashboard plafonne cette lecture à 50 lignes. De plus, le modèle granulaire `RentalPaymentReceipt` existe côté staff, mais le portail ne l'expose pas ; une quittance générée dans `Contrat.documents[]` peut être téléchargée, sans garantie d'une quittance pour chaque encaissement.

Le propriétaire dispose d'un espace métier réel `/mes-biens`, sur Web et partiellement sur Mobile. Il voit ses annonces, distingue les dossiers `RentalManagement` actifs des simples listings et obtient, par bail actif et par bien, attendu/payé/restant, impayés et prochaine échéance. Il ne dispose pas d'un portail locatif financier autonome : la page Web « Mes paiements » annonce que la fonctionnalité est à venir, et il n'existe ni vue détaillée des loyers, ni commission appliquée, ni net propriétaire, ni reversement, ni relevé. La vue mobile « Mes transactions » concerne les transactions immobilières `Transaction` client (vente/location), pas les loyers d'un propriétaire.

Aucune fuite cross-tenant ou cross-owner n'a été démontrée. Les routes locataire recalculent l'identité depuis `req.user`; la liste propriétaire filtre `RentalManagement.owner = req.user.id`; les documents recalculent l'autorité sur le bail et le bien. L'audit n'a interrogé aucune donnée de production.

## 1. Baseline Git

| Élément | Valeur |
|---|---|
| Branche | `main` |
| HEAD | `49f12d787b1011d16f9682cedefb81b377823e4d` |
| Worktree initial | Propre |
| Fichiers suivis modifiés | Aucun |
| Fichiers non suivis | Aucun |
| `git diff --stat` initial | Vide |
| `git diff --check` initial | Vert |

Mode strictement read-only. Le présent rapport est le seul fichier créé. Aucun code, modèle, route, test, package, donnée ou configuration n'a été modifié.

## 2. Architecture actuelle

```text
Locataire Web/Mobile
  → /api/tenant-portal/*
  → tenantPortalController
  → tenantPortalService
  → resolveLocataireForUser(req.user.id)
  → Locataire.user
  → Contrat { locataire, type: location }
  → Paiement { contrat }
  → Contrat.documents / RentalMaintenanceTicket / Notification

Propriétaire Web/Mobile
  → /properties/my-properties
  → /rental-management/owner/my
  → Property.owner = req.user.id
  → RentalManagement.owner = req.user.id
  → activeLease
  → agrégat Paiement limité au bail actif
```

`User.role` représente l'accès applicatif ; `Locataire` et `Proprietaire` sont des fiches métier distinctes. Le portail locataire dépend explicitement de `Locataire.user`. L'espace propriétaire courant dépend surtout du `User` de rôle `Proprietaire` directement porté par `Property.owner` et `RentalManagement.owner`; `Proprietaire.user` reste optionnel et historique.

## 3. Inventaire des routes Web

| Route | Audience | Fonction | API principale | État |
|---|---|---|---|---|
| `/espace-locataire` | Tout User authentifié rattaché | Portail locataire complet par onglets | `/tenant-portal/*` | ACTIVE |
| `/activer-espace-locataire` | User authentifié invité | Activation par token | `POST /tenant-portal/activate` | ACTIVE |
| `/mon-espace-proprietaire` | `Proprietaire` | Résout le contexte patrimoine/établissement | profils métier | REDIRECT |
| `/mes-biens` | Propriétaire immobilier | Patrimoine, annonces, résumé GL par bien | `/properties/my-properties`, `/rental-management/owner/my` | ACTIVE/PARTIAL |
| `/mes-biens/paiements` | Propriétaire immobilier | Écran annoncé paiements/loyers/frais | aucun | UI ONLY / PARTIAL |
| `/mes-biens/visites` | Propriétaire immobilier | Rendez-vous/visites | `/visites/owner` | ACTIVE, hors finance locative |
| `/dashboard/gestion-locative` | Staff GL | Pilotage des dossiers | `/rental-management` | ACTIVE STAFF |
| `/dashboard/gestion-locative/baux` | Staff GL | Baux | `/contrats` | ACTIVE STAFF |
| `/dashboard/gestion-locative/paiements` | Staff GL | Échéances/encaissements | `/paiements` | ACTIVE STAFF |
| `/dashboard/gestion-locative/documents` | Staff GL | Documents locatifs | `/contrats`, `/rental-documents` | ACTIVE STAFF |
| `/dashboard/gestion-locative/maintenance` | Staff GL | Maintenance | `/rental-maintenance` | ACTIVE STAFF |
| `/dashboard/gestion-locative/preavis` | Staff GL | Préavis | `/rental-management/:id/*notice*` | ACTIVE STAFF |
| `/dashboard/transactions` | Staff | Transactions immobilières | `/transactions` | ACTIVE, autre domaine |
| `/mes-paiements` | Client | Paiements génériques/transactionnels | domaine paiements client | ACTIVE, pas loyers propriétaire |

Le menu Web rend le portail locataire découvrable depuis l'overview client. Le rôle propriétaire est envoyé après login vers `/mon-espace-proprietaire`, puis vers `/mes-biens` si son profil immobilier est actif.

## 4. Portail locataire

### Matrice fonctionnelle

| Fonction | Existe | Source | Sécurisée | Complète | Gap |
|---|---|---|---|---|---|
| Dashboard | Oui Web/Mobile | `tenantPortalService.getDashboard` | Oui | Partielle | Agrégat financier borné à 50 échéances |
| Profil | Oui | `Locataire` projeté | Oui | Oui | Pas d'édition, non requise par le contrat cible |
| Baux/historique | Oui | `Contrat(type=location)` | Oui | Oui | Multi-baux listés sans filtre avancé |
| Échéances | Oui | `Paiement` | Oui | Oui | Pagination |
| Paiements loyers | Oui | `Paiement` | Oui | Partielle | Totaux calculés sur page courante |
| Historique | Oui | Tous contrats, pagination | Oui | Partielle | Pas de filtre bail/période |
| Solde | Oui | `(montantTotal|montant)-montantRecu` | Oui | **Non fiable globalement** | Résumé paginé |
| Pénalités | Oui | `penaliteMontant`, `retardJours` | Oui | Partielle | Retard/mode/date peu visibles dans UI |
| Reçus | Indirect | Quittance dans `Contrat.documents[]` | Oui | Partielle | `RentalPaymentReceipt` non exposé ; pas d'action par paiement |
| Documents | Oui | `Contrat.documents[]`, états des lieux | Oui | Oui si générés | Pas de génération self-service |
| Préavis | Lecture | `RentalManagement` actif | Oui | Partielle | Pas de création locataire |
| Maintenance | Création + suivi | `RentalMaintenanceTicket` | Oui | Oui | Historique paginé |
| Notifications | Oui, 5 récentes | `Notification.recipient=userId` | Oui | Partielle | Pas de centre filtré dans le portail lui-même |
| Transactions financières | Non | — | — | Non | Seuls paiements de loyer |
| Détail bien | Dans bail | `Contrat.bien` projection limitée | Oui | Partielle | Pas de page détail locative dédiée |

### Identité et activation

Le rattachement n'est jamais inféré par email. Deux voies existent : invitation staff avec token SHA-256 et expiration sept jours, ou demande self-service nécessitant une validation staff. `Locataire.user` possède un index unique partiel. L'activation garde atomiquement `user:null`; un compte déjà lié et un dossier déjà lié sont refusés. Une demande peut mentionner un `locataireId`, mais elle n'accorde aucun accès avant décision staff.

Chaîne canonique : `auth.protect → req.user.id → Locataire.findOne({user}) → Contrat.find({locataire,type:'location'}) → Paiement.find({contrat:{$in: leaseIds}})`.

### Données financières affichées

| Information | Source backend / champ | UI Web/Mobile |
|---|---|---|
| Loyer mensuel | `Contrat.montantLoyer` | Bail |
| Échéance | `Paiement.mois`, `annee`, `jourEcheance` | Mois/année ; jour peu explicite |
| Montant dû | `montantTotal ?? montant` | Ligne + résumé |
| Montant payé | `montantRecu` | Ligne + résumé |
| Restant | calcul serveur `max(0,dû-reçu)` | Ligne + résumé |
| Retard | `statut`, `retardJours` | Statut ; jours non mis en avant |
| Pénalité | `penaliteMontant` | Résumé |
| Date paiement | `datePaiement` | Champ reçu, mais non affiché dans les lignes actuelles |
| Moyen | `modePaiement` | Reçu, mais non affiché |
| Référence | `reference` | Oui |
| Reçu | `Contrat.documents[type=quittance]` | Documents seulement |

Le calcul par ligne est serveur. Le résumé n'est pas un agrégat Mongo global : il réduit seulement `payments`, après `skip/limit`. C'est le principal défaut financier locataire.

### End-to-end locataire

| Étape | État | Preuve |
|---|---|---|
| Login | AVAILABLE | JWT `auth.protect` |
| Accès espace | AVAILABLE | Web `/espace-locataire`, Mobile `TenantPortal` |
| Bail | AVAILABLE | `/tenant-portal/leases` |
| Échéance | AVAILABLE | `/tenant-portal/payments` |
| Paiement | PARTIAL | Lecture/suivi ; encaissement réalisé par staff/autres rails |
| Historique | AVAILABLE | Tous baux, paginé |
| Reçu | PARTIAL | Quittance si générée ; pas le receipt granulaire |

Réponse critique locataire : **PARTIAL**. Il peut comprendre les lignes `dû/payé/restant`, mais le total présenté n'est pas fiable au-delà de la page chargée et les reçus ne sont pas systématiquement reliés aux encaissements.

## 5. Portail propriétaire

### Matrice fonctionnelle

| Fonction | Existe | Source | Sécurisée | Complète | Gap |
|---|---|---|---|---|---|
| Dashboard patrimoine | Oui | `Property.owner` | Oui | Partielle | Mélange patrimoine et résumé locatif |
| Biens | Oui Web/Mobile | `/properties/my-properties` | Oui | Oui | Inclut listings non gérés, correctement distingués |
| Biens en gestion | Oui | `/rental-management/owner/my` | Oui | Oui | Présentation par carte |
| Locataires | Donnée active seulement | `activeLease/currentTenant` | Oui | Très partielle | Pas de liste/dossier propriétaire |
| Contrats | Résumé bail actif | `activeLease` projeté | Oui | Partielle | Pas d'historique ni document de bail dédié |
| Loyers attendus/encaissés/restants | Résumé par bail actif | agrégat `Paiement` | Oui | Partielle | Pas de lignes, périodes ni anciens baux |
| Impayés | Compteur | agrégat `Paiement` | Oui | Partielle | Pas de détail |
| Pénalités | Non exposées | `Paiement` backend | — | Non | BACKEND ONLY |
| Commission agence | Champ interne seulement | `RentalManagement.managementFee`, `Contrat.commissionAgence` | Non exposé | Non | Contrat canonique ambigu |
| Net propriétaire | Non | — | — | Non | ABSENT |
| Reversement | Non | — | — | Non | ABSENT |
| Solde propriétaire | Non | — | — | Non | ABSENT |
| Maintenance | Demande d'action seulement | `ownerRequest(report-maintenance)` | Oui | Partielle | Pas de liste/suivi des tickets |
| Documents/relevés | Backend document bail autorise owner | `/rental-documents/:documentId/download` | Oui | Backend only | Aucun inventaire UI propriétaire |
| Historique transactions locatives | Non | — | — | Non | ABSENT |
| KPI | Patrimoine + résumé par carte | frontend + API | Oui | Partielle | Aucun KPI financier propriétaire global |

`/mes-biens/paiements` rend littéralement « Cette fonctionnalité sera bientôt disponible ». La navigation est donc en avance sur le contrat fonctionnel.

### Property versus RentalManagement

La distinction est correctement matérialisée. `Property` reste le bien/listing. `RentalManagement.managementActivated:true` représente le dossier réellement géré. Le propriétaire charge les deux collections et associe le dossier par `property`; une carte sans `RentalManagement` ne reçoit pas les métriques locatives. Le compteur staff « biens inscrits » est explicitement distinct des dossiers sous gestion. Les contrats locatifs sont filtrés `type:'location'` dans le portail locataire ; l'owner summary s'appuie sur `RentalManagement.activeLease`, pas sur les transactions de vente.

### End-to-end propriétaire

| Étape | État |
|---|---|
| Login / résolution persona | AVAILABLE |
| Espace propriétaire | AVAILABLE |
| Bien géré | AVAILABLE |
| Contrat actif | PARTIAL |
| Loyer encaissé | PARTIAL — agrégat seulement |
| Commission | ABSENT |
| Net propriétaire | ABSENT |
| Reversement | ABSENT |
| Relevé | ABSENT |

Réponse business critique : **NO**. Le propriétaire ne peut pas comprendre « payé X, commission Y, net Z, reversé à telle date ». La chaîne s'arrête à un résumé brut attendu/payé/restant du bail actif.

## 6. Backend/API

| Method | Endpoint | Audience | Scope réel | Consommateur |
|---|---|---|---|---|
| GET | `/tenant-portal/dashboard` | User lié Locataire | `Locataire.user=req.user.id` | Web/Mobile locataire |
| GET | `/tenant-portal/me` | idem | idem | Web/Mobile |
| GET | `/tenant-portal/leases` | idem | contrats location du Locataire | Web/Mobile |
| GET | `/tenant-portal/payments` | idem | paiements de tous ses contrats | Web/Mobile |
| GET | `/tenant-portal/documents` | idem | documents de ses contrats | Web/Mobile |
| GET | `/tenant-portal/documents/:id/download` | idem | document recherché dans ses contrats | Web/Mobile |
| GET | `/tenant-portal/notice` | idem | activeLease → RentalManagement | Web/Mobile |
| GET/POST | `/tenant-portal/maintenance` | idem | ticket `tenant=Locataire._id`, propriété recalculée | Web/Mobile |
| POST | `/tenant-portal/activate` | User authentifié invité | token + gardes atomiques | Web/Mobile |
| POST | `/tenant-portal/request-link` | User authentifié | demande seulement, validation staff | Service Web |
| GET | `/rental-management/owner/my` | `Proprietaire` | `owner=req.user.id` | Web/Mobile owner |
| POST | `/rental-management/:id/owner/:action` | `Proprietaire` | `_id + owner=req.user.id` | Web/Mobile owner |
| GET | `/rental-documents/:documentId/download` | staff, owner ou tenant lié | relation recalculée Contrat/Property/Locataire | UI staff ; backend-only owner |
| GET | `/contrats`, `/paiements`, `/rental-maintenance` | staff capabilities | tenant/capability/resource | Dashboards staff |
| GET | `/transactions/my` | client transaction | `Transaction.client` | Mobile « Mes transactions » ; autre domaine |

Endpoints fonctionnels non exposés au propriétaire : téléchargement sécurisé des documents de ses baux, paiements détaillés staff, `RentalPaymentReceipt`, maintenance détaillée. Ils ne peuvent pas être ouverts tels quels au propriétaire sans une projection d'autorité dédiée.

UI orpheline : `/mes-biens/paiements` n'appelle aucune API. La vue mobile `TransactionsScreen` est branchée, mais sur `Transaction`, donc ne satisfait pas le besoin de transactions locatives propriétaire.

## 7. Modèles financiers et source de vérité

| Modèle | Domaine | Source de vérité | Locataire | Propriétaire |
|---|---|---|---|---|
| `Contrat` | Bail | Termes, loyer, commissionAgence éventuelle, documents | Oui | Résumé actif seulement |
| `Paiement` | Échéance locative | État agrégé canonique de l'échéance | Oui | Résumé agrégé seulement |
| `RentalPaymentReceipt` | Encaissement locatif | Versement granulaire confirmé/annulé | Non exposé | Non exposé |
| `RentalManagement` | Gestion du bien | Enrollment, occupation, mandat/fee descriptif | Indirect | Oui, projection owner |
| `Transaction` | Transaction immobilière vente/location issue d'une réservation | Dossier transactionnel client, commission transaction | Mobile client | Pas ledger de loyers |
| `PaiementTransaction` | Paiement d'une `Transaction` | Rail transactionnel legacy | Non portail loyer | Non portail loyer |
| `FinancialPayment` + `PaymentAllocation` | Financial Core hôtels/hébergements et documents financiers | Paiement/allocation de ces domaines | Non portail loyer | Non portail loyer |
| `FinancialDocument*` | Facturation financière multi-domaines | Documents/lignes/ledger | Non portail loyer actuel | Non portail loyer actuel |

La source de vérité actuelle du loyer est le couple `Paiement` (échéance/solde agrégé) + `RentalPaymentReceipt` (encaissements). `Contrat` fournit le terme contractuel. `Transaction` ne doit pas être fusionné avec ces modèles.

La commission locative n'a pas une représentation canonique univoque : `RentalManagement.managementFee` décrit le frais de gestion, tandis que `Contrat.commissionAgence` existe aussi. Aucun service audité ne projette l'un ou l'autre en retenue sur chaque encaissement. Aucun modèle canonique de reversement locatif, de solde propriétaire ou de relevé propriétaire n'a été trouvé.

Aucune double comptabilisation économique entre `Paiement`, `FinancialPayment` et `Transaction` n'est démontrée : les commentaires et consommateurs séparent explicitement ces domaines. Le risque actuel est l'ambiguïté future, pas une duplication prouvée.

## 8. Reçus, documents, maintenance et préavis

Les quittances, baux, préavis, mises en demeure et états des lieux vivent dans `Contrat.documents[]`/`etatsDesLieux[]`. Le portail locataire liste seulement les documents de ses contrats puis revérifie l'appartenance lors du téléchargement. Le contrôleur générique `/rental-documents/:documentId/download` autorise le staff tenant-scopé, le propriétaire réel du bien ou le `Locataire.user` du bail.

`RentalPaymentReceipt` est un historique d'encaissements, pas nécessairement un fichier reçu. La quittance PDF est un document de contrat généré par le workflow documentaire. Ces concepts ne sont pas fusionnés.

La maintenance locataire est complète en création et suivi, avec bien/bail/locataire recalculés côté serveur. Le propriétaire peut signaler une maintenance par demande d'action, mais ne voit pas le cycle du ticket. Le préavis locataire est en lecture seulement ; le staff le pilote. Le propriétaire voit/sollicite certaines transitions depuis son bien, sans espace d'historique dédié.

## 9. RBAC, tenant authority et privacy

| Resource | Locataire | Propriétaire | Gestionnaire | Admin |
|---|---|---|---|---|
| Property | Bien de ses baux, projection | Ses biens | Scope tenant/capability | Scope tenant/admin |
| RentalManagement | Préavis du bail actif | `owner=req.user.id` | Tenant + capability | Tenant/admin |
| Contrat | Ses contrats location via portail | Résumé actif ; document si bien owner | Tenant + capability | Tenant/admin |
| Paiement | Contrats du `Locataire.user` | Agrégat bail actif | Tenant + capability | Tenant/admin |
| Receipt | Non exposé | Non exposé | Paiement autorisé | Paiement autorisé |
| Document | Ses contrats, contrôle download | Document du bien owner, backend | Tenant + doc role | Tenant/admin |
| Maintenance | `tenant=Locataire._id` | Signalement seulement | Tenant + capability | Tenant/admin |
| Préavis | Bail actif | Dossier owner/action autorisée | Tenant + capability | Tenant/admin |
| Payout/Reversement | Absent | Absent | Absent | Absent |

Aucune route portail de lecture n'accepte `ownerId`, `tenantId` ou `locataireId` pour élargir son scope. Les ObjectId de document et maintenance sont réautorisés côté serveur. Les capacités Admin et PlatformOperator existantes restent intactes et ne sont pas classées comme vulnérabilités.

Privacy : la projection de bail expose au locataire nom, téléphone et email du propriétaire. Cela peut être métierment justifié, mais doit être confirmé par politique de minimisation. La projection owner actuelle ne fournit pas un dossier personnel complet du locataire, ce qui limite l'exposition.

Dual-role : Web choisit la destination principalement depuis `User.role` et les `businessProfiles`; le portail locataire reste accessible à tout User authentifié rattaché, et un lien explicite existe dans l'overview client. Mobile expose l'espace locataire depuis Profil. La coexistence technique est possible, mais aucune interface centrale de changement de persona « propriétaire ↔ locataire » n'est démontrée pour un même compte de rôle Proprietaire lié aussi à `Locataire`.

## 10. Web/Mobile parity

| Fonction | Web Locataire | Mobile Locataire | Web Propriétaire | Mobile Propriétaire |
|---|---|---|---|---|
| Dashboard | Working | Working | Patrimoine | Profil/stats limités |
| Biens | Bail actif | Bail actif | Working | Working |
| Contrats | Historique | Historique enrichi | Résumé actif | Conditions/listing, résumé GL |
| Échéances | Working | Working | Résumé | Résumé |
| Paiements | Working/partial totals | Working/partial totals | Placeholder | Pas de vue loyer dédiée |
| Historique | Paginé | Paginé | Absent | Absent |
| Solde | Page courante | Page courante | Restant par bail actif | Restant par bail actif |
| Pénalités | Résumé | Résumé | Absent | Absent |
| Reçus | Documents | Documents/partage | Backend only | Absent |
| Transactions | Absent | Absent | Absent | `Transaction` client, autre domaine |
| Commission | Absent | Absent | Absent | Commission transactionnelle, autre domaine |
| Reversements | Absent | Absent | Absent | Absent |
| Documents | Working | Working | Backend only | Absent |
| Maintenance | Create/list | Create/list/photos | Demande seulement | Demande seulement |
| Préavis | Lecture | Lecture détaillée | Action/résumé | Action/résumé |
| Notifications | 5 récentes | écran + dashboard | Notifications globales | Notifications globales |

Le portail locataire Mobile a une meilleure profondeur de présentation (caution, timelines, états des lieux, offline cache). Aucun device/browser n'a été utilisé : la conclusion UX est statique et fondée sur code/tests.

## 11. Tests exécutés et preuves

| Gate | Résultat | Preuve |
|---|---|---|
| Backend ciblé | 3 suites, **45/45** tests verts | Portail, rattachement, routes GL |
| Web ciblé | 4 fichiers, **25/25** tests verts | Navigation owner, propriétés, destination, lien locataire |
| Mobile ciblé | 3 suites, **17/17** tests verts | service locataire, deep links, entrée propriétés |
| Premier run backend sandbox | Infrastructure seulement | `listen EPERM 0.0.0.0` |
| Rerun backend hors sandbox | Vert | Supertest port local éphémère |

Les tests Mobile restent verts avec des avertissements React `act(...)` préexistants dans `ProfilScreenMyProperties`. Aucun test n'a été créé. Aucune base de production ni service externe n'a été interrogé.

## 12. Findings

### P0 — 0

Aucune fuite cross-tenant, lecture financière arbitraire ou mutation cross-owner démontrée.

### P1 — 3

1. **BUG / FINANCIAL CLARITY — totaux locataire paginés.** Les totaux sont calculés après pagination mais étiquetés comme globaux. Un historique supérieur à la limite affiche un dû/payé/restant faux.
2. **FEATURE GAP — propriétaire sans suivi financier autonome.** La page paiements est un placeholder ; aucune ligne de loyer, commission, net, reversement ou relevé.
3. **BUSINESS-RULE MISMATCH — contrat commission/reversement non canonique.** Deux champs possibles de commission existent, sans projection par encaissement ni source de vérité de payout.

### P2 — 6

1. Reçus granulaires `RentalPaymentReceipt` non exposés au locataire.
2. Documents de bail autorisables au propriétaire mais sans inventaire UI.
3. Maintenance propriétaire limitée au signalement, sans suivi.
4. Historique propriétaire limité au bail actif et sans multi-baux.
5. Parité propriétaire Mobile/Web faible.
6. Pas de filtre locataire par bail/période et champs date/mode de paiement peu visibles.

### P3 — 3

1. « Mes paiements » propriétaire promet une fonction absente.
2. Labels « paiements » et « transactions » désignent des domaines différents selon l'écran.
3. Changement de persona locataire/propriétaire non explicite pour les comptes cumulant les deux identités.

## 13. Gap analysis

| Classe | Éléments |
|---|---|
| A. Déjà complet | Rattachement locataire, autorité locataire, baux, documents sécurisés, maintenance locataire, distinction Property/RentalManagement |
| B. Backend existe, UI manque | Receipts locatifs, document owner download, paiements détaillés staff, tickets maintenance owner |
| C. UI existe, backend incomplet | Page owner « Mes paiements » sans appel ; totaux locataire présentés globalement |
| D. Manque totalement | Net propriétaire, payout/reversement locatif, solde et relevé propriétaire |
| E. Incohérence métier | Commission locative répartie entre champs sans projection canonique ; transaction immobilière facilement confondue avec loyer |
| F. Sécurité/authority | Aucune faille démontrée ; tests manquants owner concurrents/end-to-end réels |

## 14. Scores

| Axe | Note /100 | Motif |
|---|---:|---|
| Functional completeness | 58 | Locataire riche, propriétaire financier absent |
| Financial clarity | 38 | Totaux paginés, aucun net/payout |
| Security/authority | 88 | Résolution serveur et téléchargements contrôlés |
| Data coherence | 68 | Loyer clair, commission/payout non canoniques |
| Web UX structure | 70 | IA locataire claire, owner placeholder trompeur |
| Mobile parity | 64 | Locataire fort, owner faible |
| Documents | 72 | Locataire sécurisé, owner UI absente |
| Notifications | 74 | Événements locataire nombreux, owner financier incomplet |
| Maintainability | 73 | Services dédiés, projections réutilisables |
| Business-rule coherence | 61 | Bonne séparation des domaines, chaîne owner incomplète |

Scores de surface : Tenant Web **83**, Tenant Mobile **85**, Owner Web **39**, Owner Mobile **31**. Readiness globale **57/100**.

## 15. Architecture cible minimale proposée — sans implémentation

Conserver `Paiement` comme échéance agrégée et `RentalPaymentReceipt` comme encaissement locatif. Corriger d'abord la projection locataire avec un agrégat global indépendant de la pagination et une liste de receipts/quittances autorisée par contrat.

Pour le propriétaire, ajouter ultérieurement une couche de lecture dédiée réutilisant `RentalManagement(owner) → Contrat → Paiement → RentalPaymentReceipt`. Cette projection doit produire par période et bien : brut encaissé, commission selon une règle canonique unique, net dû, puis état de reversement. Aucun nouveau modèle financier ne doit être créé avant de décider si le reversement est seulement dérivable ou s'il constitue un événement métier persistant avec statut, référence et date. Si un payout réel doit être auditable, un modèle/ledger peut devenir nécessaire, mais ce besoin n'est pas prouvé par le code actuel.

## 16. Roadmap maximale en trois phases

### Phase A — correctness/security

Corriger l'agrégat global locataire ; exposer les receipts/quittances avec autorité serveur ; caractériser et tester la règle canonique de commission et les scénarios multi-baux.

### Phase B — owner financial self-service

Créer une projection read-only propriétaire et brancher `/mes-biens/paiements` : filtres bien/période, loyers, impayés, commission, net et reversements uniquement si leur source canonique est établie.

### Phase C — parity/UX/documents

Parité Mobile propriétaire, documents/relevés, maintenance, navigation dual-role et clarification des labels paiement/transaction/reversement.

## 17. Réponses aux 91 questions obligatoires

1. Branche ? `main`.
2. HEAD ? `49f12d787b1011d16f9682cedefb81b377823e4d`.
3. Worktree initial ? Propre.
4. Diff-check initial ? Vert.
5. Fichiers fonctionnels modifiés ? **NON**.
6. Espace locataire existe ? **YES**.
7. Route exacte ? Web `/espace-locataire`; Mobile `Profil/TenantPortal`, deep link `espace-locataire/:section?`.
8. Activation existe ? Oui, invitation ou demande validée staff.
9. Profil locataire ? Oui.
10. Baux ? Oui, actifs et historiques, location seulement.
11. Échéances ? Oui.
12. Paiements ? Oui, échéances locatives `Paiement`.
13. Historique ? Oui, paginé sur tous ses baux.
14. Solde ? Oui par ligne ; total global incorrect au-delà de la page.
15. Pénalités ? Oui.
16. Reçus ? Partiel, quittances documentaires ; receipts granulaires non exposés.
17. Documents ? Oui.
18. Maintenance ? Oui, création et suivi.
19. Préavis ? Lecture oui, création non.
20. Notifications ? Oui, persistées ; Socket/push selon service global.
21. Vue transactions réelle locataire ? **NO**, seulement paiements de loyer.
22. Peut-il comprendre dû/payé/restant ? **PARTIAL**, lignes oui, total global non fiable.
23. Données calculées serveur ? Oui, mais après pagination.
24. Paiements correctement scoped ? Oui via ses contrats.
25. Documents scoped ? Oui, y compris au téléchargement.
26. Espace propriétaire dédié existe ? Espace patrimoine oui ; portail locatif financier dédié **NO**.
27. Route exacte ? `/mon-espace-proprietaire` → `/mes-biens`; paiement `/mes-biens/paiements`.
28. Pages génériques seulement ? Patrimoine owner spécifique, finance locative essentiellement absente ; dashboards complets sont staff.
29. Mes biens gérés ? Oui, distingués des listings.
30. Contrats ? Résumé du bail actif seulement.
31. Locataires ? Très partiel, pas de liste autonome.
32. Loyers attendus ? Agrégat par bail actif.
33. Loyers encaissés ? Agrégat par bail actif.
34. Impayés ? Compteurs par bail actif.
35. Commission agence ? Non exposée.
36. Net propriétaire ? Absent.
37. Reversements ? Absent.
38. Historique reversements ? Absent.
39. Solde propriétaire ? Absent.
40. Relevé propriétaire ? Absent.
41. Documents propriétaire ? Backend autorisé, UI absente.
42. Maintenance propriétaire ? Signalement seulement.
43. KPI ? Patrimoine et paiement brut par bien, pas KPI financier global.
44. Comprend brut → commission → net → reversement ? **NO**.
45. Étape manquante ? Commission canonique, net, événement/statut de reversement et UI.
46. Property distinct de RentalManagement ? Oui.
47. `managementActivated` respecté ? Oui dans les listes de dossiers gérés ; listing-only reste distinct.
48. Contrats vente exclus ? Oui dans le portail locataire ; owner summary passe par activeLease de RentalManagement.
49. Modèle financier canonique loyer ? `Paiement` + `RentalPaymentReceipt`, termes dans `Contrat`.
50. Modèle canonique commission ? **NON CONFIRMÉ** (`managementFee` et `commissionAgence`).
51. Modèle canonique reversement ? Absent.
52. Plusieurs modèles se chevauchent ? Plusieurs domaines coexistent, frontières explicites.
53. Duplication économique démontrée ? **NO**.
54. Endpoints backend non exposés UI ? Oui : receipts, documents owner, paiements/tickets détaillés staff.
55. UI sans backend réel ? Oui, `/mes-biens/paiements`.
56. Web locataire score ? **83/100**.
57. Mobile locataire score ? **85/100**.
58. Web propriétaire score ? **39/100**.
59. Mobile propriétaire score ? **31/100**.
60. Global readiness ? **57/100**.
61. P0 ? **0**.
62. P1 ? **3**.
63. P2 ? **6**.
64. P3 ? **3**.
65. Cross-tenant leak démontrée ? **NO**.
66. ObjectId authority correcte ? Oui sur chemins portail inspectés.
67. Propriétaire A peut lire B ? Non via endpoints owner/documents inspectés.
68. Locataire A peut lire B ? Non via portail inspecté.
69. Admin contract préservé ? Oui.
70. PlatformOperator préservé ? Oui.
71. Dual-role correctement géré ? **PARTIAL**, accès possible mais switch persona non explicite.
72. Mobile/Web parity ? Forte locataire, faible propriétaire.
73. Realtime utilisé ? Notifications globales peuvent être Socket ; pages portail chargent principalement par HTTP.
74. Notifications cohérentes ? Globalement oui côté locataire ; finance owner absente.
75. Lacune locataire principale ? Totaux financiers paginés et reçus non reliés.
76. Lacune propriétaire principale ? Aucun portail financier locatif autonome.
77. Lacune financière principale ? Pas de chaîne canonique commission/net/reversement.
78. Peut-on construire owner en réutilisant l'existant ? **YES**, pour échéances/encaissements/documents ; payout reste à caractériser.
79. Nouveau modèle financier requis ? **NON CONFIRMÉ**.
80. Si oui, preuve ? Aucune à ce stade.
81. Si non, modèles à réutiliser ? `RentalManagement`, `Contrat`, `Paiement`, `RentalPaymentReceipt`, documents existants.
82. Futur sprint minimal ? Correction agrégat locataire + caractérisation ledger owner + projection read-only.
83. Code modifié ? **NON**.
84. Tests créés ? **NON**.
85. Migration ? **NON**.
86. Commit ? **NON**.
87. Push ? **NON**.
88. Deploy ? **NON**.
89. Rapport créé ? Oui, uniquement ce fichier.
90. Diff-check final ? Vert après création du rapport.
91. Verdict final ? **D — TENANT PORTAL EXISTS — DEDICATED OWNER RENTAL PORTAL MISSING**.

## Verdict final

**D — TENANT PORTAL EXISTS — DEDICATED OWNER RENTAL PORTAL MISSING.**

Le portail locataire est substantiel et sécurisé, mais sa clarté financière doit être corrigée avant certification complète. Le propriétaire dispose d'un espace patrimoine, pas encore d'un portail de gestion locative capable d'expliquer les loyers, commissions, nets et reversements. L'existant permet de construire une grande partie de la future projection sans dupliquer le système financier ; la source canonique de commission et l'événement de reversement doivent d'abord être décidés et caractérisés.

**RENTAL SELF-SERVICE READINESS : 57/100.**

Aucun correctif, test, modèle, migration, package, commit, push ou déploiement n'a été effectué.
