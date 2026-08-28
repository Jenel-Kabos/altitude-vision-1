# HOTFIX-ACCOMMODATION-CREATED-NOT-VISIBLE-1 — Reproduction

## Test rouge obtenu (preuve empirique, pas seulement une lecture de code)

Fichier : `server/__tests__/accommodationCreatedVisibility.mongo.integration.test.js` (nouveau, vrai Mongo — `MongoMemoryReplSet` via `financialMongoEnvironment`, aucun mock de modèle).

Procédure de preuve rouge→vert :
1. Le correctif a été appliqué dans `services/accommodationService.js`.
2. `git stash push -- services/accommodationService.js` (retrait temporaire, réversible, du seul fichier de correctif).
3. `npx jest __tests__/accommodationCreatedVisibility.mongo.integration.test.js` → **2 des 3 tests échouent**, avec le message exact :
   ```
   Expected: "soumis"
   Received: "brouillon"
   ```
   — reproduction directe et non ambiguë du symptôme rapporté (le document créé reste en `'brouillon'`, jamais éligible à `'soumis'` ni `'publie'`).
4. `git stash pop` (restauration du correctif).
5. Ré-exécution : **3/3 tests verts**.

## Scénarios couverts

| Test | Avant correctif | Après correctif |
|---|---|---|
| Création complète (readiness OK) → `publicationStatus` | `brouillon` (FAIL, attendu `soumis`) | `soumis`, `submittedAt` renseigné (PASS) |
| L'hébergement créé apparaît dans la requête "Modération" (`publicationStatus:'soumis'`) | Absent | Présent |
| L'hébergement créé reste absent de la liste "Hébergements" (`validatedOnly`) tant qu'il n'est pas validé | Déjà vrai (mais pour la mauvaise raison — absent de partout) | Vrai, et pour la bonne raison (en attente de modération réelle) |
| Création incomplète (`bathrooms: 0`, readiness KO) → reste `brouillon` | PASS (déjà correct — non testé comme rouge) | PASS (comportement inchangé, confirmé non régressé) |
| Après validation staff (`publicationStatus: 'publie'`) → apparaît dans "Hébergements" | FAIL (bloqué en amont, jamais atteint) | PASS |

## Ce que cette reproduction prouve, et ce qu'elle ne prouve pas

Prouve : la cause exacte identifiée dans `_ROOT_CAUSE.md` (statut par défaut jamais transitionné par ce point d'entrée précis) explique intégralement le symptôme, avec un test qui échoue avant le correctif et réussit après, sans modification du test entre les deux exécutions.

Ne prouve pas (hors périmètre, non nécessaire à la certification) : le rendu visuel réel dans un navigateur — cette reproduction est service-level (Mongo réel, pas de HTTP/JWT/multer, pas de rendu React). La chaîne HTTP → contrôleur → service étant strictement inchangée dans son câblage (mêmes fonctions appelées, mêmes noms de champs de réponse), et `accommodationRoutes.test.js` (HTTP, mocké) restant vert sans modification, il n'a pas été jugé nécessaire de dupliquer une preuve HTTP réelle en plus de la preuve Mongo réelle déjà obtenue.
