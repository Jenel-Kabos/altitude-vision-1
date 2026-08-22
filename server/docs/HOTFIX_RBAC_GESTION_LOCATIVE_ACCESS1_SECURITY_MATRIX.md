# HOTFIX-RBAC-GESTION-LOCATIVE-ACCESS-1 — MATRICE DE SÉCURITÉ

## Principe : aucune permission backend modifiée

Ce hotfix ne modifie **aucun fichier `server/`**. Tous les fichiers de routes/middleware cités dans `HOTFIX_RBAC_GESTION_LOCATIVE_ACCESS1_ENDPOINT_MATRIX.md` (`proprietaireRoutes.js`, `locataireRoutes.js`, `contratRoutes.js`, `rentalManagementRoutes.js`) sont restés inchangés pendant tout l'audit et la correction. Le frontend a été aligné sur un contrat backend déjà en production, jamais l'inverse.

## Matrice de sécurité par rôle

| Rôle | Onboarding/désactivation mandat | Contrat create/edit | Contrat delete | Propriétaire+biens CRUD | Locataire CRUD | Menu GL |
|---|---|---|---|---|---|---|
| Admin | ALLOWED (backend `restrictTo`) | ALLOWED (`leases.manage`) | ALLOWED (`adminOnly`) | ALLOWED (`STAFF_IMMO`) | ALLOWED (`tenants.manage`) | ALLOWED (tout) |
| Collaborateur | DENIED (backend `restrictTo`, exclusion volontaire préservée) | **ALLOWED (corrigé)** | DENIED (`adminOnly`) | **ALLOWED (corrigé)** | **ALLOWED (corrigé)** | ALLOWED (tout, `legacy.full`) |
| GestionnaireImmobilier | ALLOWED | ALLOWED | **DENIED (corrigé — bouton retiré)** | ALLOWED | ALLOWED | ALLOWED (capacités déclarées) |
| Secretaire | DENIED (inchangé) | DENIED (inchangé) | DENIED (inchangé) | DENIED (inchangé) | DENIED (inchangé) | CONDITIONAL (inchangé) |
| CommunityManager/Communicant | DENIED (inchangé) | DENIED (inchangé) | DENIED (inchangé) | DENIED (inchangé) | DENIED (inchangé) | Aucune entrée (inchangé) |
| Proprietaire/Client/User/Prestataire | N/A (hors dashboard staff, inchangé) | N/A | N/A | N/A | N/A | N/A |

## Preuve que le backend reste l'autorité — même après correction frontend

Le frontend `can()`/`canManage`/`canManageStaffImmo`/`isAdmin` ne sécurise rien par construction — chaque bouton corrigé correspond à une route backend qui **continue d'appliquer indépendamment** `restrictTo(...)`/`requireCapability(...)` exactement comme avant ce hotfix :
- Un `Collaborateur` qui contournerait l'UI (DevTools, requête directe) pour appeler `POST /rental-management/onboarding` recevrait toujours un 403 (`restrictTo('Admin','GestionnaireImmobilier')`, non modifié).
- Un `GestionnaireImmobilier` qui appellerait directement `DELETE /contrats/:id` recevrait toujours un 403 (`adminOnly`, non modifié) — le hotfix retire simplement le bouton qui menait à un échec garanti, une amélioration UX pure, jamais un changement de sécurité.
- Un `Collaborateur` qui appelle `PUT /proprietaires/:id`/`POST /locataires`/`PUT /contrats/:id` obtient désormais un 200, comme il l'obtenait déjà **avant** ce hotfix (le bouton était juste caché) — aucune élévation de privilège introduite, uniquement une action déjà autorisée rendue visible.

## Tenant / Ownership — non concernés, non modifiés

Aucun des changements frontend n'affecte `assertProprietaireInScope`, `assertLocataireInScope`, `router.param('id')` sur `contratRoutes.js`/`rentalManagementRoutes.js`, ni `requireTenantScope`. Ces gardes continuent de s'appliquer identiquement à tout rôle, y compris `Collaborateur` désormais capable d'atteindre l'UI de mutation — un `Collaborateur` du Tenant A reste incapable d'agir sur une ressource du Tenant B, comme c'était déjà le cas indépendamment de ce hotfix.

## PlatformOperator — non concerné

Aucune route de ce domaine n'implique `PlatformOperator`. Le comportement fail-closed de ce système (sélection de tenant obligatoire) reste inchangé, aucun fichier le concernant n'a été touché.

## Capacités backend — source canonique inchangée

`server/utils/iamArchitecture.js`, `server/utils/roles.js` (`STAFF_IMMO`), `server/middleware/capabilityMiddleware.js` (`requireCapability`) : aucun modifié. Aucune capacité ajoutée, supprimée, ou réassignée à un rôle. `getEffectiveCapabilities`, `assertKnownCapability`, `can()` Web (`AuthContext.jsx`, non modifié) restent la seule source de vérité pour les capacités staff nommées — le nouveau `canManageStaffImmo` est une liste de rôles locale à `GestionLocativePage.jsx` (même patron que `canDoc`, déjà existant dans ce fichier avant ce hotfix), pas un mapping rôle→capacités généralisé, et ne remplace ni ne duplique `iamArchitecture.js`.

## Vérifié : pas de mapping role→capabilities recréé

`canManageStaffImmo = isAdmin || ['GestionnaireImmobilier', 'Collaborateur'].includes(user?.role)` est une expression booléenne unique pour un seul groupe d'actions (édition patrimoniale/locative), pas une structure `{ role: [capabilities] }`. Elle mirrore par valeur l'ensemble `STAFF_IMMO` déjà déclaré côté backend (`server/utils/roles.js`), exactement comme `canDoc` (préexistant) mirrore `STAFF_DOC`/`ROLES_PAIEMENTS` — un patron déjà en usage dans ce fichier avant ce hotfix, non introduit par lui.
