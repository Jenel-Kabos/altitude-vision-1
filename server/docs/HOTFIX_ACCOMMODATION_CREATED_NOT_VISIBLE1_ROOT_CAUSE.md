# HOTFIX-ACCOMMODATION-CREATED-NOT-VISIBLE-1 — Cause racine

## Classification (mandat §24)

**A. Bug confirmé — hybride entre B (WRONG_DEFAULT_STATUS, au sens "aucune transition appliquée là où le produit en attend une") et un vrai trou d'UX (aucune voie de sortie reliée à la sidebar staff).** Ni C (aucune régression tenant), ni D (aucun bug de cache/refresh — vérifié : `onSuccess` recharge `load()` et `loadAnalytics()` après création, comportement correct), ni E (aucun nom de champ divergent), ni F (le filtre frontend applique fidèlement les paramètres qu'il envoie), ni G (aucune dérive de nom de champ, `publicationStatus` est cohérent partout).

## Énoncé

`POST /api/accommodations/admin` (`createFull` → `createFullAccommodation`) crée l'`Accommodation` sans jamais fixer `publicationStatus` — la valeur par défaut du schéma (`'brouillon'`) s'applique donc systématiquement. Ce statut ne satisfait ni le filtre de la liste principale "Hébergements" (`publicationStatus:'publie'`), ni celui de "Modération Hébergements" (`publicationStatus:'soumis'`) — les deux seules surfaces reliées à la sidebar staff (`AdminDashboard.jsx`). La seule surface où un `brouillon` est visible (`/mes-hebergements`, avec un bouton "Soumettre") n'est jamais liée dans cette sidebar pour aucun rôle. Résultat : un hébergement créé par ce point d'entrée précis devient **invisible depuis toute navigation staff normale**, tout en étant compté dans le KPI "Hébergements" (qui n'a, lui, aucun filtre de statut) — d'où le compteur à 1 et la liste/modération à 0, exactement le symptôme rapporté.

## Preuve directe du contrat attendu (pas une supposition)

Le point d'entrée structurellement analogue `POST /accommodations/mobile/full` (`createFullMobileAccommodation`, `server/services/accommodation/mobileAccommodationPublicationService.js`) — "créer Property + Accommodation + RatePlan en un seul appel" — **soumet déjà automatiquement** l'hébergement (`publicationStatus:'soumis'`, `submittedAt`) dans la même transaction, immédiatement après création, avec la même garde `evaluateReadiness`. C'est une preuve de code positive, déjà écrite et déjà testée (`mobileAccommodationPublicationService.mongo.integration.test.js`), que le contrat produit voulu pour ce type d'action ("créer un hébergement complet en un geste depuis un outil de publication directe") est : auto-soumission à la modération, jamais blocage silencieux en brouillon.

## Ce qui N'EST PAS la cause racine (écarté par preuve, pas par supposition)

- **Tenant** : `tenant` est correctement dérivé de `actingUser.platformTenant` à la création, inchangé, non régressé (voir `_TENANT_MATRIX.md`).
- **Owner** : `ownerId` résolu correctement (`req.user.id` par défaut), inchangé.
- **Cache/refresh frontend** : `ManageAccommodationsPage.jsx` recharge bien `load()` et `loadAnalytics()` après un `onSuccess` de création — aucun état stale.
- **Nom de champ divergent** : `publicationStatus` est le nom unique et cohérent utilisé par le modèle, le service, les deux contrôleurs de lecture et les deux pages frontend concernées — aucune confusion `isApproved`/`status`/`moderationStatus`.
- **RBAC** : `ROLES_ALTIMMO` inchangé sur toutes les routes concernées ; `IAM-3` (CommunityManager exclu de `createFull`) non retouché.

## Portée du hotfix

Corriger uniquement `createFullAccommodation` (le point d'entrée staff `/accommodations/admin`) pour qu'il applique, immédiatement après création et sous la même garde `evaluateReadiness` déjà utilisée ailleurs, la même transition `brouillon → soumis` que le flux mobile analogue applique déjà. Le point d'entrée propriétaire self-service (`exports.create` / `POST /accommodations`) reste **strictement inchangé** — son brouillon explicite avec bouton "Soumettre" est un contrat produit distinct et déjà prouvé volontaire (voir `_STATUS_MATRIX.md`).
