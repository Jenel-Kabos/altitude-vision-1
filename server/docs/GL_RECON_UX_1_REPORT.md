# GL-RECON-UX-1 — Rapport d'implémentation

## Audit initial

L'audit en lecture seule est détaillé dans `GL_RECON_UX_1_AUDIT.md`. Les 17 contrats historiques disposent tous d'un locataire, d'un propriétaire et d'une adresse contractuelle, mais aucun ne référence un `Property`. Cinq seulement ont un loyer, deux des dates et aucun document. Ces données permettent une revue humaine, pas un rattachement automatique fiable.

## Cartographie et architecture

- Le centre Web est accessible sous `/dashboard/gestion-locative/regularisation` aux rôles Admin, Gestionnaire immobilier et Collaborateur.
- `GET /api/rental-contract-regularization` agrège contrats, parties, fiches propriétaire, biens compatibles et décisions antérieures.
- `POST /:contractId/decision` exécute l'une des quatre décisions contrôlées.
- `POST /:contractId/revert` est réservé à l'Admin.
- `RentalContractReconciliation` conserve la décision et un journal append-only avec acteur, motif et états avant/après. `ActionLog` apporte une deuxième trace transverse.

Les suggestions sont explicables et non décisionnelles : propriétaire explicite (55), ville (20), adresse proche (20), loyer (5). Aucun score ne déclenche une action automatiquement.

## Workflows connectés

1. Rattachement à un `Property` existant : validation du propriétaire, de l'état du bien et de l'absence de bail ouvert concurrent, création non destructive du `RentalManagement` s'il manque, puis synchronisation par le moteur GL-RECON-1 certifié.
2. Création interne : réutilisation de `rentalAssetOnboardingService.createManaged`, puis rattachement et synchronisation du contrat.
3. Clôture historique : passage contrôlé en résilié/archivé et ajout dans l'historique de cycle.
4. Anomalie : classement sans mutation du contrat.

## Interface

La liste présente locataire, propriétaire, adresse contractuelle, type de bien (ou absence explicite), loyer, dates, documents, anomalies de complétude, biens similaires et actifs de la fiche propriétaire. Le détail permet de choisir l'action, le bien cible ou les données du nouveau bien, et impose un motif et une confirmation. Les décisions déjà prises restent consultables. Un Admin peut lancer la procédure de réversion avec justification.

## Sécurité, RBAC et réversibilité

- Lecture/décision : Admin, GestionnaireImmobilier, Collaborateur.
- Réversion : Admin uniquement.
- Le serveur est l'unique autorité ; l'interface ne modifie aucun KPI localement.
- Chaque mutation vérifie les invariants métier et les droits de propriété.
- La réversion compare l'état courant à l'état attendu afin de refuser l'écrasement d'évolutions ultérieures.
- Un bien créé par régularisation n'est jamais supprimé lors d'une réversion : il est conservé vacant. Cette règle évite toute suppression de données.

## Éléments réutilisés

- moteur `rentalManagementLeaseSyncService` / GL-RECON-1 ;
- onboarding `rentalAssetOnboardingService` ;
- modèles `Contrat`, `Property`, `RentalManagement`, `Proprietaire` et `ActionLog` ;
- navigation et composants du dashboard Gestion locative ;
- client API et mécanismes d'authentification existants.

## Impacts

- Backend : nouvelles API, modèle de journal et orchestration ; aucun endpoint métier existant dupliqué.
- Web : nouvel écran et entrée de navigation.
- Mobile : aucun impact.
- Données : aucune migration et aucune modification des 17 dossiers pendant l'implémentation.

## Tests réellement exécutés

- Backend Unit complet : 105 suites, 1 215 tests réussis.
- Backend Mongo complet : 49 suites réussies sur 50, 407 tests réussis sur 408. L'unique échec provenait du test legacy simulant volontairement un doublon désormais bloqué par l'index certifié.
- Backend Mongo ciblé du centre : 1 suite, 3 tests réussis.
- Test Mongo ciblé après correction de l'isolation du scénario legacy : 1 suite, 9 tests réussis.
- Web Vitest complet : 75 fichiers, 503 tests réussis.
- ESLint serveur : 0 erreur, 109 avertissements historiques.
- ESLint client après la dernière modification : 0 erreur, 267 avertissements historiques.
- Build Next.js : réussi.
- `git diff --check` : réussi.

Le test legacy crée désormais temporairement son index, le retire pour injecter le doublon historique, nettoie les données puis restaure l'index dans un bloc `finally`. Une nouvelle campagne Mongo complète reste recommandée pour confirmer ce correctif d'isolation sur les 50 suites.

## Risques résiduels et dette

- Les suggestions textuelles restent volontairement indicatives : les adresses historiques ne sont pas normalisées/géocodées.
- La décision et les deux journaux ne sont pas enveloppés dans une transaction Mongo multi-document ; le journal dédié est persistant et la réversion possède des garde-fous, mais une transaction serait un durcissement futur.
- `ActionLog` est secondaire et non bloquant ; le journal de réconciliation demeure la preuve canonique.
- Les 17 contrats restent à traiter individuellement par un opérateur autorisé.

## Fichiers créés

- `client/app/dashboard/gestion-locative/regularisation/page.jsx`
- `client/lib/pages/dashboard/RentalContractRegularizationPage.jsx`
- `server/__tests__/rentalContractRegularization.mongo.integration.test.js`
- `server/controllers/rentalContractRegularizationController.js`
- `server/docs/GL_RECON_UX_1_AUDIT.md`
- `server/docs/GL_RECON_UX_1_REPORT.md`
- `server/models/RentalContractReconciliation.js`
- `server/routes/rentalContractRegularizationRoutes.js`
- `server/services/rentalContractRegularizationService.js`

## Fichiers modifiés pour GL-RECON-UX-1

- `client/lib/pages/dashboard/AdminDashboard.jsx`
- `client/lib/services/gestionLocativeService.js`
- `server/__tests__/rentalManagementReconciliation.mongo.integration.test.js`
- `server/server.js`

Les autres fichiers sales visibles appartiennent au chantier GL-RECON-1 préalable et ont été préservés.

## Confirmations

- Aucun commit.
- Aucun push.
- Aucune migration destructive.
- Aucune suppression de données métier.
