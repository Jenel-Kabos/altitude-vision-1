# ARCH-2K — Testabilité et plans de caractérisation

| Edge | Direct actuel | Indirect actuel | Mongo | Tenant / ownership / PlatformOperator | Finance | Testabilité |
|---|---|---|---|---|---|---|
| Accommodation | `dashboardAnalyticsController.test.js` : vide, formule, 422/403 owner | Reporting, tenant, réservations/finance accommodation | OUI requis | Matrice propriétaire, staff tenant, hostile tenant, opérateur global | Documents, allocations, refunds, net/gross | MEDIUM |
| Hotel | Vide controller ; suites reporting/org/tenant/hotel finance | Nombreuses suites hotel IAM/finance | OUI requis | Tenant, assignments, legacy manager, requested hotel, opérateur global | Dashboard, ratios, reconciliation | LOW-MEDIUM |
| Location | Vide controller ; reporting/organization/ERP indirect | Suites rental et paiement, mais peu de contrat KPI direct | OUI requis | scope null/Set/list, owners in/out, tenant/org, opérateur global | encaissé, impayé, pénalités | MEDIUM-HIGH après ajout dédié |

## Plan futur — Location (candidat recommandé)

Avant tout déplacement : tests directs du helper historique couvrant base vide ; scope absent ; Set et tableau d'IDs ; owners inclus/exclus ; contrats hors scope ; actifs et expirant à 30 jours ; disponibilité/occupation/préavis ; paiements `impayé|en_retard|partiel` ; `montantTotal` fallback `montant` ; pénalités ; maintenance ouverte ; erreurs de chaque query ; parité exacte de l'objet. Ajouter Mongo ciblé avec deux tenants/owners, et un test Reporting PlatformOperator non scopé. Ne pas réutiliser ni corriger le test de quittance défaillant.

## Plan futur — Accommodation

Base vide ; hébergement indépendant/hôtel ; tenant dedans/dehors ; propriétaire sélectionné/non autorisé ; publication ; locks et formules ; documents/allocations/refunds ; dates limites ; erreurs ; payload exact ; vue globale PlatformOperator.

## Plan futur — Hotel

Base vide ; Admin tenant ; acteur assigné/legacy manager ; hôtel inaccessible et 403 ; hôtel demandé/global ; Property validée/disponible ; statuts chambre/réservation ; maintenance/housekeeping ; finance gross/refund/balance ; PlatformOperator ; interaction `hotelId` finance vs occupation globale ; RevPAR/ADR/null ; erreurs et payload exact.

L'anomalie Mongo `rentalPaymentReceiptsAndCancellation` (fixture `receipt` absente) est une dette de validation indépendante. Elle n'a pas été relancée ni modifiée.
