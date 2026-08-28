# SECURITY-CLOSURE-P1-WAVE-1 — Périmètre exact du diff

HEAD avant/après : `a04055f62952c782b92aeef2f100824a17a5f645` (inchangé — aucun commit).

## Fichiers de code modifiés par ce sprint (10 lots)

| Fichier | Lot(s) |
|---|---|
| `server/controllers/contratController.js`, `server/routes/contratRoutes.js` | P1-A |
| `server/controllers/locataireController.js`, `server/routes/locataireRoutes.js`, `server/controllers/proprietaireController.js`, `server/routes/proprietaireRoutes.js` | P1-J |
| `server/controllers/visiteController.js`, `server/routes/visiteRoutes.js` | P1-B |
| `server/controllers/litigeController.js`, `server/routes/litigeRoutes.js`, `server/controllers/signalementController.js`, `server/routes/signalementRoutes.js` | P1-C |
| `server/controllers/realEstateApplicationController.js`, `server/routes/realEstateApplicationRoutes.js` | P1-D |
| `server/controllers/accommodationController.js` | P1-E |
| `server/controllers/salePropertyController.js`, `server/controllers/rentalPropertyController.js` | P1-F |
| `server/controllers/propertyAssetController.js` | P1-G |
| `server/controllers/hotelStaffAssignmentController.js` | P1-H |
| `server/controllers/transactionController.js`, `server/controllers/paiementTransactionController.js`, `server/routes/transactionRoutes.js` | P1-I |

## Fichiers de test unitaires corrigés (régressions découvertes en cours de route, §47)

`server/__tests__/rentalDossiersRoutes.test.js` (aucune modification directe — corrigé côté code, voir `locataireController.js`), `server/__tests__/visiteRoutes.test.js`, `server/__tests__/transactionFinalizationGuard.test.js`, `server/__tests__/salePropertyRoutes.test.js`, `server/__tests__/rentalPropertyRoutes.test.js`.

## Fichiers de test permanents créés (10, un par lot)

`securityClosureP1WaveContratListTenantAuthority.mongo.integration.test.js`, `securityClosureP1WaveLocataireProprietaireListTenantAuthority.mongo.integration.test.js`, `securityClosureP1WaveVisiteTenantAuthority.mongo.integration.test.js`, `securityClosureP1WaveLitigeSignalementTenantAuthority.mongo.integration.test.js`, `securityClosureP1WaveRealEstateApplicationTenantAuthority.mongo.integration.test.js`, `securityClosureP1WaveAccommodationUpdateFullTenantAuthority.mongo.integration.test.js`, `securityClosureP1WaveSaleRentalPropertyUpdateFullTenantAuthority.mongo.integration.test.js`, `securityClosureP1WavePropertyAssetTransitionAuthority.mongo.integration.test.js`, `securityClosureP1WaveHotelStaffAssignmentAuthority.mongo.integration.test.js`, `securityClosureP1WaveTransactionTenantAuthority.mongo.integration.test.js` — 63 tests permanents au total, tous prouvés rouge→vert.

## Documents créés (14, y compris ce fichier)

`_BASELINE.md`, `_SOURCE_FINDINGS.md`, `_PROGRESS.md`, `_AUTHORITY_MATRIX.md`, `_SIDE_EFFECT_MATRIX.md`, `_NEW_BLOCKERS.md`, `_SECURITY_CLUSTER.md`, `_GATE_MATRIX.md`, `_DIFF_SCOPE.md` (ce fichier), `_DECISION.md`, `_REPORT.md` (créé après ce fichier).

## Ce qui n'a PAS été touché

- Frontend (`client/`) : aucune modification.
- Mobile (`altimmo-app/`) : aucune modification.
- Modèles Mongoose / schémas / migrations : aucune modification.
- Les 5 P0 déjà fermés (P0-Wave-1) : non ré-ouverts, tests re-vérifiés verts.
- Les 9 autres P1 non concernés par ce backlog (aucun — les 10 findings du backlog sont TOUS traités) : sans objet.
- RA-16 à RA-22 (P2/P3) : non corrigés, statuts inchangés (voir `_SOURCE_FINDINGS.md`).
- HZ-08, HZ-09, `errorMiddleware.js`, dette `controller→controller`/`route→model` : non touchés.

## Note sur l'arbre de travail global

Le dépôt contenait déjà, avant ce sprint, un arbre de travail avec des modifications non commitées sans rapport (héritage documenté depuis les mandats précédents de cette session). Ce sprint n'a ajouté strictement que les fichiers listés ci-dessus. Une leçon méthodologique a été tirée en cours de route : la technique initiale de reproduction rouge par `git diff <fichier> | git apply -R` capture TOUT le diff non commité d'un fichier, pas seulement le changement du sprint en cours — elle a été abandonnée au profit d'un commentaire ciblé (`// TEMP-DISABLED-FOR-RED-PROOF`) après avoir produit un faux résultat sur P1-E (revert accidentel d'un correctif d'architecture antérieur sans rapport, immédiatement détecté et corrigé).
