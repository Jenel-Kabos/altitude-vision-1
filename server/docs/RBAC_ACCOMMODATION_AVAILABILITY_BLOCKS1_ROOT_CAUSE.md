# RBAC-ACCOMMODATION-AVAILABILITY-BLOCKS-1 — Cause racine

## Classification (mandat §38)

**Ownership manquant + RBAC trop large (auth-only)** — pas un middleware manquant au niveau routeur (la frontière tenant HZ-02, elle, est correctement présente), et pas une route mal positionnée. `listBlocks` s'arrêtait à `authorizedCalendarAccommodation(req)` (qui résout uniquement la frontière **tenant**, jamais le rôle ni l'ownership) puis retournait directement les blocages, sans jamais vérifier `isStaff(req.user) || owner===req.user.id` — la vérification que ses trois routes sœurs (`calendar`, `createBlock`, `deleteBlock`) appliquent toutes, chacune indépendamment, sur la même ressource.

## Pourquoi ce n'est pas un problème tenant

`authorizedCalendarAccommodation` (HZ-02, non modifié) empêche déjà tout STAFF d'accéder à une Accommodation d'un autre tenant (`query.tenant = ...` si `isStaff`). Ce mécanisme fonctionnait déjà correctement pour `listBlocks` comme pour ses routes sœurs — **la preuve empirique** : dans la reproduction rouge, le staff « sans tenant » était déjà bloqué (403, fail-closed HZ-02) et le PlatformOperator scopé/global se comportait déjà correctement. Le gap concernait exclusivement des acteurs **du bon tenant** (ou sans notion de tenant, comme un Client) qui n'avaient simplement aucune autorité RBAC/ownership sur la ressource.

## Guard canonique identifié et réutilisé (mandat §39)

`isStaff(req.user) || String(accommodation.property?.owner) === String(req.user.id)` — déjà défini une seule fois (`const isStaff = ...`, ligne 19 du même fichier), déjà utilisé par `calendar` (ligne 210) et `deleteBlock` (ligne 195), et sa version service-layer par `createBlock` (`accommodationReservationService.js:105`). Aucun nouveau système d'autorisation créé.

## Correction minimale appliquée (mandat §40)

Ordre de préférence respecté : (1) wiring route-level — non applicable ici, car `calendar`/`createBlock`/`deleteBlock` n'ont pas non plus de garde au niveau routeur, la vérification vit dans le contrôleur/service pour ces trois routes ; (2) guard canonique existant — **c'est l'option retenue**, la même ligne de code exacte ajoutée dans `listBlocks`, cohérente avec l'endroit où vivent déjà les trois vérifications sœurs. Aucun refactor, aucune nouvelle abstraction.

## Ce qui n'a pas changé

- `authorizedCalendarAccommodation` (frontière tenant HZ-02) : **non touchée**.
- `calendar`, `createBlock`, `deleteBlock` : **non touchés** (déjà corrects).
- `routes/accommodationRoutes.js` : **non touché** — aucun wiring de routeur nécessaire, tout le correctif vit dans le contrôleur, exactement où vivent déjà les trois vérifications sœurs.

## Findings hors périmètre rencontrés pendant l'investigation (non corrigés, mandat §63/§64)

Aucun nouveau finding hors périmètre découvert pendant ce sprint. Les findings déjà connus et explicitement exclus (`messageController.getMessages`, `errorMiddleware` 500 vs 404, HZ-08, HZ-09) n'ont pas été retouchés — confirmé par `git status` (voir `_NON_REGRESSION.md`).
