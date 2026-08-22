# HOTFIX-PROPERTY-APPROVED-VISIBILITY-ENDTOEND-1 — Matrice du document réel

Requête en lecture seule exécutée une fois contre la base Atlas configurée dans `server/.env` (`Property.find({title: /PARCELLE A VENDRE/i}).lean()`, aucune mutation). 1 seul document trouvé.

| Champ | Valeur réelle | Attendu (contrat métier) | Utilisé par quelles requêtes | Verdict |
|---|---|---|---|---|
| `_id` | `6a887b6d3aebee9658c9e4ec` (identique au hotfix précédent) | — | Toutes | Document stable, même bien depuis plusieurs sprints |
| `title` | `PARCELLE A VENDRE` | — | Toutes | OK |
| `type` | `Parcelle` | Type valide (HOTFIX-MOB-ADD-PROPERTY-1) | Valeur par type (Patrimoine), jamais utilisé pour discriminer vente/location | OK — confirmé non impliqué dans la cause |
| `status` | `vente` | Champ canonique Vente/Location | `dashboardAnalyticsController.sales()`, `propertyPortfolioService.PROPERTY_PUBLICATION_FILTER`, `runPropertySearch.baseFilter` (indirectement, via statusAdmin/isPublished), séparation Rentals | OK |
| `statusAdmin` | `Validée` | `'Validée'` pour être éligible à la publication | Toutes les surfaces (portfolio, public catalog, KPI "published") | OK |
| `isPublished` | **`false`** | `true` (un bien Validée classique doit être publié atomiquement) | Portfolio (`/properties/portfolio`), catalogue public (`/properties`, `/properties/latest`), KPI "published"/"drafts" | **CAUSE — incohérent avec `statusAdmin='Validée'`** |
| `availability` | `Disponible` | `'Disponible'` pour apparaître | Toutes les surfaces + KPI "active" | OK |
| `pole` | `Altimmo` | `'Altimmo'` pour apparaître sur les surfaces Altimmo | Toutes les surfaces | OK |
| `price` | `80000000` | — | Valeur totale/Valeur par type | OK |
| `owner` | `6a84080352c6ffabafb26af7` | Soumissionnaire réel (déjà prouvé par HOTFIX-MODERATION-PROPERTY-SUBMITTER-CONTACT-1) | Scope propriétaire, notifications | OK — non concerné par ce bug |
| `createdAt` | `2026-08-21T16:23:09.616Z` | — | Tri "Dernières annonces" | OK |
| `updatedAt` | `2026-08-21T21:46:33.464Z` | — | — | Identique à `reviewedAt` : dernière mutation = la validation elle-même, jamais retouché depuis |
| `reviewedAt` | `2026-08-21T21:46:33.464Z` | — | — | **33 minutes avant** le commit introduisant le correctif atomique (`51f581e`, `2026-08-21T22:19:15Z`) — preuve temporelle directe |
| `listingType` | absent du document | N/A | — | Confirmé : aucun champ `listingType` sur `Property` (le champ canonique reste `status`, cohérent avec tous les hotfixes précédents) |
| `isApproved` | absent | N/A | — | N'existe pas sur le schéma `Property` — `statusAdmin` en tient lieu |
| `publicationStatus` | absent | N/A | — | N'existe que sur `Accommodation`/`Hotel` (workflows spécialisés), jamais sur `Property` classique |
| `moderationStatus` | absent | N/A | — | N'existe pas ; `statusAdmin` en tient lieu |
| `deletedAt` / `archived` / `active` | absents | N/A | — | Aucun soft-delete/flag d'archivage sur ce document ni sur le schéma `Property` pour les biens classiques |
| tenant / organization / agency | non stocké directement sur `Property` | Résolu dynamiquement via `owner` + `OrgMembership`/`PlatformTenant` (architecture déjà auditée par les hotfixes tenant précédents) | `assertPropertyTenantAccess`, `resolveTenantScope` | Non concerné — aucune donnée tenant incohérente observée |

## Verdict de la matrice

**Un seul champ est en cause : `isPublished=false` alors que `statusAdmin='Validée'`.** Tous les autres champs (type, status, availability, pole, owner, tenant) sont dans l'état attendu pour un bien vente approuvé et éligible. La preuve temporelle (`reviewedAt` antérieur de 33 minutes au commit du correctif atomique) élimine toute hypothèse de régression du code actuel : ce document a été validé par l'ancien code, avant l'existence du correctif.
