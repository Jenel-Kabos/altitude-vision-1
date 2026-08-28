# HOTFIX-MESSAGING-MESSAGE-READ-AUTHORITY-1 — Reproduction rouge → verte (permanente)

Fichier : `server/__tests__/messageReadAuthority.mongo.integration.test.js` (14 tests, **conservé en permanence**, non supprimé après correction — contrainte explicite du mandat, à la différence du test temporaire de l'assessment précédent).

## AVANT correctif (état du code au moment de l'écriture du test, `getMessages` encore vulnérable)

```
Test Suites: 1 failed
Tests:       4 failed, 10 passed, 14 total
```

Échecs exacts (et uniquement ceux-là — reproduction précise, ni sur- ni sous-couverte) :
1. `1. Client A (non-participant) sur conversation privée Client B/C → 403, aucun contenu` — reçu `200` au lieu de `403`, contenu `SECRET-BC-CONTENT` exposé.
2. `2. Proprietaire A (non-participant, même chemin que Client) sur conversation privée → 403` — reçu `200` au lieu de `403`.
3. `3. Client A sur conversation attribuée au tenant B (sans lien) → 403` — reçu `200` au lieu de `403`.
4. `effet de bord : isRead reste inchangé après une lecture refusée` — `isRead` passait à `true` alors que l'accès n'aurait pas dû être autorisé (effet de bord d'une lecture illégitime).

Les 10 autres tests (participant légitime, staff tenant-wide, Admin, PlatformOperator, HF-FINAL-01 ×3, non-régression `conversationController` ×2, effet de bord légitime) passaient déjà **avant** le correctif — confirmant que la reproduction cible précisément et uniquement le gap identifié par l'assessment, sans überreach.

## APRÈS correctif (`assertConversationAccess` appliquée dans `getMessages`)

```
Test Suites: 1 passed, 1 total
Tests:       14 passed, 14 total
```

Tous les tests, y compris les 4 précédemment rouges, passent désormais. Aucune régression sur les 10 tests déjà verts.

## Pourquoi ce test reste en permanence (contrairement au test temporaire de l'assessment)

Contrainte explicite du mandat : ce test constitue désormais la suite de non-régression permanente pour l'autorité de lecture des messages (`GET /api/messages/:conversationId`), garantissant qu'un futur changement de route/controller ne pourra pas réintroduire silencieusement ce gap sans faire échouer `npm run test:mongo`.
