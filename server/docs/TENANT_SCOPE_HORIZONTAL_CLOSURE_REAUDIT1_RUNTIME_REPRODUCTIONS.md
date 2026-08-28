# TENANT-SCOPE-HORIZONTAL-CLOSURE-REAUDIT-1 — Reproductions runtime

Conformément au mandat (§47-48), un test Mongo+HTTP **temporaire** a été écrit pour reproduire de façon non ambiguë le finding le plus structurant de ce re-audit (RA-02/RA-03, fuite et mutation financières cross-tenant sur Paiement/Contrat). Ce fichier sera **supprimé avant STOP**, conformément au mode strictement read-only de ce mandat (aucune suite permanente n'est ajoutée par un audit).

## Fichier temporaire

`server/__tests__/_tmp_reaudit_paiement_tenant_leak.mongo.integration.test.js` — 3 scénarios :
1. `GET /api/paiements` par un Secretaire du tenant A renvoie les échéances du tenant A **et** du tenant B.
2. `GET /api/paiements/stats` agrège les montants des deux tenants dans `totalAttendu`.
3. `POST /api/paiements/encaisser-multiple` par un Secretaire du tenant A marque payée une échéance appartenant au tenant B (`fresh.statut === 'payé'` après l'appel).

## Résultat d'exécution

Exécuté isolément après le run Mongo exhaustif complet (le fichier temporaire avait été créé après le démarrage du run exhaustif principal et n'avait donc pas été détecté par son scan initial de fichiers ; ré-exécuté séparément pour obtenir un résultat réel plutôt que de le présumer).

**Résultat : 3/3 PASS**, confirmant sans ambiguïté :
1. `GET /api/paiements` par un Secretaire du tenant A renvoie bien les montants du tenant A **et** du tenant B (`montants` contient les deux valeurs de test, 111111 et 222222).
2. `GET /api/paiements/stats` agrège `totalAttendu` sur les deux tenants (`≥ 50000 + 70000`, valeurs des deux tenants de test).
3. `POST /api/paiements/encaisser-multiple` par un Secretaire du tenant A marque effectivement **payée** (`statut: 'payé'`) une échéance appartenant au tenant B, sans aucun rejet.

(Une première tentative de test 3 a échoué avec un HTTP 500 dû à une valeur d'énumération invalide dans le fixture du test lui-même — `modePaiement: 'especes'` au lieu de `'espèces'`, un défaut de mon fixture de test, pas une preuve de protection : corrigé et ré-exécuté, confirmant le statut 200 attendu et la mutation cross-tenant.)

Le fichier temporaire `server/__tests__/_tmp_reaudit_paiement_tenant_leak.mongo.integration.test.js` a été **supprimé** immédiatement après obtention de ce résultat, conformément au mode read-only du mandat. `git status --short` confirme son absence.

## Confirmation indépendante par lecture de code (avant même le résultat du test)

Indépendamment du résultat du test temporaire, les trois findings ont été confirmés par lecture directe et mécanique du code source par l'auditeur principal (pas seulement par les agents de recherche) :
- `paiementController.js:23-60` (`getAll`) — `filter` construit uniquement de `req.query.contrat/statut/annee`, jamais de dimension tenant.
- `paiementController.js:66-93` (`getStats`) — agrégation Mongo sans `$match` sur un champ tenant.
- `paiementController.js:291-412` (`encaisserMultiple`) — `contrat`/`allocations[].paiementId` pris du corps de la requête, jamais vérifiés contre `req.platformTenant`.
- `models/Paiement.js`/`models/Contrat.js` — confirmé : aucun champ `tenant` dans le schéma, aucun plugin Mongoose de filtrage automatique.
- `middleware/capabilityMiddleware.js:1-16` — confirmé par le commentaire du fichier lui-même : « Ce guard ne remplace jamais auth, tenant, ownership, ABAC ou invariants métier. »
- `routes/paiementRoutes.js:32-37,72` — confirmé : `/alertes`, `/stats`, `/encaisser-multiple`, `/` (getAll) sont toutes déclarées **avant** le `router.param('id', …)` qui protège les routes `:id`, et aucune ne consomme de paramètre `:id`.

Le finding RA-01 (`sendMessage`, Messaging) a été confirmé de façon identique par lecture directe de `messageController.js:79-127` par l'auditeur principal (indépendamment du rapport de l'agent de recherche dédié) : aucun appel à `assertConversationAccess`/`ALL_STAFF.includes` avant le calcul de `targetUserId` et la création du `Message`.

Le finding RA-09 (`adminController.js`, Property legacy) a été confirmé de façon identique : lecture directe de `controllers/adminController.js:210-274` (aucune vérification) et de `routes/adminRoutes.js:44-50` + `server.js:410` (`app.use('/api/admin', adminRoutes)`, route effectivement montée et live).

## Ce que cette reproduction NE couvre PAS

Les 16 autres findings CONFIRMED GAP de `_FINDING_MATRIX.md` (RA-04 à RA-19, hors RA-01/RA-09 confirmés séparément ci-dessus) ont été confirmés par lecture de code par les agents de recherche spécialisés, avec citation exacte fichier:ligne, mais n'ont pas fait l'objet d'une reproduction HTTP+Mongo dédiée dans le temps imparti à ce mandat — leur nature mécanique (filtre `{}` ou absence totale de garde, visible directement dans le code source, sans logique conditionnelle complexe masquant un faux positif) rend une reproduction runtime redondante avec la lecture directe pour la plupart d'entre eux. Une reproduction runtime systématique de chacun pourrait faire l'objet d'un sprint de correction ultérieur (qui devra de toute façon écrire des tests de non-régression permanents pour chaque correctif).
