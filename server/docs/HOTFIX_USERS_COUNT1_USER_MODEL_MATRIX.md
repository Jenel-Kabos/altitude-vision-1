# HOTFIX-USERS-COUNT-1 — Matrice des modèles impliqués

## Matrice de comparaison (déduite du code, aucune donnée de production consultée)

| Dimension | Altitude Vision (Admin visible) | huinlogistics (Proprietaire absent) |
|---|---|---|
| `User` existe | Oui | Oui (authentifiable, condition sine qua non de son accès à `/mes-biens`) |
| Rôle `User.role` | `Admin` | `Proprietaire` |
| Document `Proprietaire` associé | NON CONFIRMÉ (aucun accès aux données de production) — non nécessaire à son accès admin de toute façon | NON CONFIRMÉ — non nécessaire non plus : `/mes-biens` (`GET /api/properties/my-properties`) ne requiert que `authController.protect` (authentification), aucune lecture de `Proprietaire` dans le contrôleur de route |
| `OrgMembership` | Aucun trouvé en pratique pour le compte fondateur d'un tenant (c'est précisément la situation couverte par `resolveLegacyTenantForUser` / source `legacy_fallback`) | Aucun — confirmé structurellement : `authController.signup` (inscription publique) ne crée jamais d'`OrgMembership` (grep exhaustif, zéro occurrence) |
| Tenant résolu | `legacy_fallback` (fondateur de l'org racine, antérieur à l'introduction d'`OrgMembership`) | Aucun — un `User` sans `OrgMembership` et qui n'a pas créé lui-même de `PlatformTenant`/`OrgUnit` racine ne résout **aucun** tenant via `resolveEffectiveTenantContext` |
| Actif | Présumé oui (peut se connecter) | Oui — confirmé, peut se connecter et accéder à `/mes-biens` |
| Visible sur `/dashboard/users` (avant correctif) | Oui — via le push explicite de son propre id dans `req.tenantScopeUserIds` (`tenantContext.js`, branche `source === 'legacy_fallback'`) | **Non** — absent de `OrgMembership`, donc absent de `getScopeUserIds`, et n'est pas l'acteur résolvant le tenant (donc jamais poussé explicitement) |
| Visible sur `/dashboard/users` (après correctif) | Oui (inchangé) | **Oui** — inclus par `includeUnaffiliatedUsersIfSoleTenant` tant qu'un seul `PlatformTenant` `trial`/`active` existe sur la plateforme |
| Raison de la visibilité | Cas explicitement prévu par le code (`legacy_fallback` + auto-push) | Nouvelle règle : sur un tenant unique, tout compte non technique, actif, non rattaché à un autre tenant/opérateur, appartient sans ambiguïté à ce tenant unique |

## Sémantique réelle de l'onglet "Propriétaires" (mandat §8)

**Confirmé par lecture directe de `UsersPanel.jsx`** (frontend, pas de supposition) : l'onglet "Propriétaires" est un filtre **purement frontend** sur le même tableau `users` déjà reçu de `GET /api/users` :
```js
list = list.filter(u => u.role === filterTab); // filterTab === 'Proprietaire'
```
C'est donc **exactement `User.role === 'Proprietaire'`**, pas un comptage de documents `Proprietaire`, pas un `businessProfile`, pas un `OrgMembership`. Le compteur du header (`ADMINS`, `PROPRIÉTAIRES`, etc.) provient du même calcul frontend (`users.filter(...).length`) sur le tableau déjà chargé — **catégorie D du mandat (calcul frontend), pas un endpoint statistics séparé** (aucun appel réseau distinct pour les compteurs).

Le backend possède par ailleurs un endpoint distinct `GET /admin/owners` (`userController.getAllOwners`) qui, lui, utilise une définition différente et plus riche (`userKpiService.getProprietaireUserIds()` — union propriétaire immobilier + exploitant d'établissement, voir commentaire `USER-KPI-1`) — **mais cet endpoint n'est pas appelé par `UsersPanel.jsx`**, qui n'utilise que `GET /api/users`. Les deux définitions de "propriétaire" coexistent dans le code sans être unifiées, mais ce n'est pas la cause du bug rapporté (non modifié par ce hotfix, hors périmètre).

## Invariants User/Proprietaire (mandat §9)

- Un `User.role === 'Proprietaire'` peut exister **sans** document `Proprietaire` associé — confirmé : rien dans `authController.signup` ni dans le contrôleur `getMyProperties` n'exige un document `Proprietaire` pour fonctionner. Le modèle `Proprietaire` (avec `user: ObjectId ref User`) semble être une **fiche métier enrichie optionnelle**, pas une condition d'accès.
- Un document `Proprietaire` sans `User` correctement représenté : NON CONFIRMÉ (nécessiterait une requête sur la collection réelle, hors périmètre de cet audit en lecture de code).
- **Aucune double source de vérité n'a été introduite ni aggravée par ce hotfix** : le correctif ne touche ni `User` ni `Proprietaire`, uniquement la résolution du **scope tenant** (une couche d'autorisation, pas une source de données métier).
