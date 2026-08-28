# ARCH-2E — Analyse exhaustive route→model

| # | Route | Model | Why imported | R/W | Middleware role / class | Risk |
|---:|---|---|---|---|---|---|
| 1 | `contratRoutes.js` | `Contrat` | Charger `:id` et imposer frontière tenant | R | tenant authorization (A/C/F) | Élevé sécurité ; acceptable en middleware spécialisé |
| 2 | `dashboardRoutes.js` | `Event` | Compteur dashboard | R | logique endpoint (G/I) | Faible |
| 3 | `dashboardRoutes.js` | `portfolioItemModel` | Compteur publié | R | logique endpoint (G/I) | Faible |
| 4 | `dashboardRoutes.js` | `Property` | Compteur dashboard | R | logique endpoint (G/I) | Faible |
| 5 | `dashboardRoutes.js` | `User` | Compteur utilisateurs | R | logique endpoint (G/I) | Faible |
| 6 | `devisRoutes.js` | `Devis` | CRUD, validation, workflow, email/notification | R/W | business logic (D/G/I) | Moyen, providers best-effort |
| 7 | `estimationRoutes.js` | `Estimation` | Création publique, liste, remise à jour, total | R/W | business logic (D/G/I) | Élevé, upload/email/provider |
| 8 | `gestionDocumentRoutes.js` | `Contrat` | Garde paramètre tenant document | R | authorization lookup (A/C/F) | Élevé sécurité ; acceptable |
| 9 | `gestionDocumentRoutes.js` | `Paiement` | Garde paramètre tenant document | R | authorization lookup (A/C/F) | Élevé sécurité ; acceptable |
| 10 | `locataireRoutes.js` | `Locataire` | Garde explicite cross-tenant | R | ownership/tenant (B/C/F) | Élevé sécurité ; acceptable |
| 11 | `paiementRoutes.js` | `Paiement` | Garde `:id` tenant avant mutation | R | tenant/finance authorization (C/F) | Très élevé ; ne pas piloter |
| 12 | `platformTenantRoutes.js` | `PlatformTenantDomain` | Résoudre tenant d'un domaine | R | PlatformOperator/tenant (C/E/F) | Très élevé ; ne pas piloter |
| 13 | `proprietaireRoutes.js` | `Proprietaire` | Garde ressource tenant | R | ownership/tenant (B/C/F) | Élevé sécurité ; acceptable |
| 14 | `projetsRoutes.js` | `Projet` | CRUD complet inline | R/W | business/legacy (G/I) | Élevé : modèle cible absent du tree |
| 15 | `realisationsRoutes.js` | `Realisation` | CRUD complet inline | R/W | business/legacy (G/I) | Moyen |
| 16 | `rentalManagementRoutes.js` | `RentalManagement` | Garde paramètre tenant/owner | R | ownership/tenant (B/C/F) | Très élevé sécurité ; acceptable |
| 17 | `userBusinessProfileRoutes.js` | `User` | Garde self/staff et tenant | R | IAM/tenant/ownership (B/C/F) | Très élevé ; ne pas piloter |

## Synthèse

- 17 edges, 13 fichiers, 13 read-only et 4 avec écritures.
- 9 edges servent directement l'auth/tenant/ownership ; leur présence en middleware de route est défendable même si un resolver dédié améliorerait la couche.
- 8 edges portent une vraie logique applicative inline : les 4 compteurs dashboard, Devis, Estimation, Projet et Réalisation.
- Clusters : dashboard KPI (4), formulaires/workflows publics (2), contenu legacy CRUD (2), frontières tenant/ressource (9).
- Quick win recommandé : dashboard KPI, 4 edges supprimables dans un seul endpoint, read-only et sans tenant.
- À ne pas toucher d'abord : paiement, PlatformTenantDomain, profils métier, RentalManagement, Contrat/documents/Locataire/Proprietaire.

`Projet` est actuellement une cible dangling : c'est un finding existant, pas corrigé ici.
