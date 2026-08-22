# RBAC-1 — État initial

Date : 2026-08-22. Branche `main`. `HEAD` = `63880f58ff41bd805b828d07603d878d55122d45`.

`git log -5 --oneline` :
```
63880f5 Update Altimmo 38
51f581e Update Altimmo 37
88c99d7 Update Altimmo 36
3cd0f1c Update Altimmo 35
f4f6b40 Update Img
```

`git status --short` : 14 lignes, `git diff --stat` : 1 fichier (`client/app/api/auth/[...nextauth]/route.js`, +11), `git diff --check` : exit 0. Toutes ces lignes proviennent des deux sprints immédiatement précédents dans cette même session (`HOTFIX-PROPERTY-APPROVED-VISIBILITY-ENDTOEND-1`, `HOTFIX-WEB-GOOGLE-AUTH-1`) — aucun travail externe non identifié à préserver. **Aucun de ces fichiers n'est touché par RBAC-1** — audit pur, aucune modification de code produit dans ce sprint.

## Portée de l'audit

RBAC-1 est un audit exhaustif, en lecture seule, des mécanismes de décision d'autorisation à travers :
- `server/` (rôles globaux, groupes, middleware, controllers, tenant, ownership, business profiles, hotel staff, platform operator) ;
- `client/` (Next.js Web — navigation, guards, menus) ;
- `altimmo-app/` (React Native — écrans, navigation).

**Aucun comportement d'autorisation n'a été modifié.** Aucun rôle renommé, supprimé ou ajouté. Aucun `restrictTo` touché. Aucune migration Mongo. Aucun commit.

## Découverte architecturale majeure (avant même l'inventaire détaillé)

Il n'existe pas 1 mais **4 systèmes d'autorisation parallèles, indépendants et non unifiés** dans le backend :

1. **`User.role`** — RBAC global, 10 valeurs (`server/models/User.js`), consommé via `authController.restrictTo(...)` et les groupes de `server/utils/roles.js`.
2. **`UserBusinessProfile`** — profils métier cumulables (`proprietaire_immobilier`, `exploitant_etablissement`, `locataire`, `client`), dérivés en lecture seule depuis les données existantes (`Property.owner`, `Hotel.manager`, `Locataire.user`) ET explicitement accordables (`grantProfile`).
3. **`HotelStaffAssignment`** — capacités granulaires (`hotel.*`, ex. `hotel.reservation.create`) scopées à un hôtel précis, indépendantes du rôle global de l'utilisateur, avec des capacités par défaut par `assignmentRole` (`hotel_manager`, `reception`, `housekeeping`, `inspector`, `maintenance`, `finance`, `viewer`).
4. **`PlatformOperator`** — capacités transversales plateforme (`platform.*`, ex. `platform.tenants.manage`), explicitement documenté comme **distinct** de `User.role === 'Admin'` (qui reste strictement tenant-scopé).

S'y ajoute un **cinquième** système domain-scopé : `financialAuthorizationService.js`, qui mappe `FINANCIAL_CAPABILITIES[user.role]` → liste de capacités financières (`financial.document.view`, etc.) — un système de capacités **dérivées du rôle**, ni identique à `HotelStaffAssignment` (scopé hôtel) ni à `PlatformOperator` (transversal plateforme).

Cette pluralité déjà existante est une preuve directe que le codebase a déjà, de façon organique et non coordonnée, commencé à migrer vers des capacités par domaine (`hotel.*`, `platform.*`, `financial.*`) sans jamais généraliser la convention — exactement le drift que RBAC-1 doit cartographier.

## Méthode

Étant donné l'ampleur (des centaines d'occurrences potentielles à travers 3 codebases), l'inventaire exhaustif backend/web/mobile a été délégué à 3 agents de recherche en lecture seule en parallèle (grep/lecture uniquement, aucune modification), dont les résultats bruts sont synthétisés dans les matrices livrées. L'architecture des 4+1 systèmes ci-dessus, les groupes canoniques (`server/utils/roles.js`), et le schéma `User.role` ont été audités directement.
