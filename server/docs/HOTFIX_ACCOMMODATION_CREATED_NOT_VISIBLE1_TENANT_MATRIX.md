# HOTFIX-ACCOMMODATION-CREATED-NOT-VISIBLE-1 — Matrice tenant

## Tenant du document créé (inchangé par ce hotfix)

`server/services/accommodationService.js::createFullAccommodation` fixe :
```js
tenant: actingUser.platformTenant?._id || actingUser.platformTenant || null
```
dérivé du JWT de l'Admin qui crée (`req.user.platformTenant`), **jamais** de `req.platformTenant` (résolu par le middleware de scope, absent sur cette route d'écriture). Ce mécanisme n'est touché par aucune ligne de ce hotfix — la seule modification apportée (auto-soumission `brouillon → soumis`) intervient strictement après la création du document et ne touche ni `tenant`, ni `owner`, ni `createdBy`.

## Vérification HZ-01 → HZ-04 (non-régression)

- `server/__tests__/accommodationAdminListsTenantScope.mongo.integration.test.js` (HZ-04, `/admin/list` et `/status/pending`) : aucune modification de ce fichier par ce mandat ; exécuté dans le cadre de `npm run test:mongo` (voir `_GATE_MATRIX.md`) — doit rester vert sans aucune adaptation, car l'auto-soumission n'altère ni le tenant, ni les critères de filtre déjà testés (`status='soumis'`, `status='publie'`, isolation croisée A/B).
- `server/__tests__/accommodationReservationListTenantScope.mongo.integration.test.js`, `accommodationReservationTenantScope.mongo.integration.test.js`, `accommodationCalendarTenantScope.mongo.integration.test.js`, `accommodationReservationTenantScope.mongo.integration.test.js` : hors du chemin de code modifié (réservations, calendrier), non affectés.

## PlatformOperator

Non concerné par ce hotfix : `createFull` ne consulte ni ne modifie `PlatformOperator` ; l'auto-soumission est un effet strictement local au document `Accommodation` fraîchement créé, sans lecture d'un scope global/opérateur.

## Owner

`ownerId = mongoose.isValidObjectId(owner) ? owner : req.user.id` (comportement pré-existant, non modifié) : le `Property.owner` reste l'Admin créateur par défaut (le formulaire n'envoie jamais de champ `owner` explicite). Ce hotfix ne touche ni ce calcul, ni la valeur stockée.

## Conclusion

Aucun affaiblissement de l'isolation tenant, de PlatformOperator, ni de l'ownership. Le correctif est confiné à une transition de statut post-création, appliquée uniquement au document déjà correctement scopé.
