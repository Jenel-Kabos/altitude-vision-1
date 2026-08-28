# RBAC-ACCOMMODATION-AVAILABILITY-BLOCKS-1 — Matrice zéro effet de bord

| Action | Refusée (Client/non-owner/staff non autorisé) | Autorisée (staff/owner légitime) |
|---|---|---|
| GET (`listBlocks`) | 403, **`Block.find` jamais exécuté** — la vérification RBAC intervient avant toute requête Mongo de lecture | Inchangé — même requête, même payload qu'avant ce hotfix |
| POST (`createBlock`) | 403 (déjà correct avant ce hotfix), aucune écriture | Inchangé |
| DELETE (`deleteBlock`) | 403 (déjà correct), aucune suppression — confirmé par assertion DB (`Block.findById` non-null après tentative refusée dans le test de non-régression) | Inchangé |

## Preuve

`accommodationAvailabilityBlocksRbac.mongo.integration.test.js` inclut une assertion DB explicite (`expect(await Block.findById(blockA._id)).not.toBeNull()`) après une tentative `DELETE` refusée par un Proprietaire non-owner — confirme qu'aucune mutation n'a lieu pour un acteur refusé, comportement déjà correct et non affecté par ce hotfix (qui ne touche que `listBlocks`, une route de lecture pure sans effet de bord possible par nature).

## Payload pour les acteurs toujours autorisés

`res.json({status:'success', data:{blocks}})` — strictement identique avant/après pour tout acteur qui passe la nouvelle vérification (staff des 4 rôles, ou owner) : aucun champ retiré, aucun champ ajouté, aucune pagination modifiée.
