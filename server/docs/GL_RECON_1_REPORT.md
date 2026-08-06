# Sprint GL-RECON-1 — Rapport final

## Résultat

Le moteur historique GL-ARCH-1.1 est devenu le moteur unique GL-RECON-1. Il audite tous les contrats locatifs ouverts, produit une matrice complète, sépare les cas réparables des anomalies humaines, protège l'apply par revalidation et journalise chaque réparation. Toute nouvelle création de bail active désormais le `RentalManagement` avant l'insertion du `Contrat`.

La base configurée ne contient aucun cas automatiquement réparable : ses 17 contrats locatifs actifs n'ont aucune référence `bien`. Ils ont été laissés intacts, conformément à l'interdiction de deviner une relation ou de modifier hasardeusement des données.

## Audit initial et cartographie

L'audit préalable est détaillé dans `server/docs/GL_RECON_1_AUDIT.md`.

Cartographie réelle en lecture seule au 5 août 2026 :

- 17 `Contrat`, tous `location`, tous `actif`, donc 17 ouverts.
- 8 `Property`, dont 4 `location` : 1 `Loué`, 3 `Disponible`.
- 1 `RentalManagement`, `active=true`, `managementActivated=true`.
- 0 `Paiement`.
- 34 `Locataire`.
- 2 `Proprietaire`.

La matrice par contrat expose désormais : contrat/statut, Property, RentalManagement, occupation, synthèse des paiements et état de classification.

## Classification des anomalies

- Cas A — contrat, Property et RentalManagement cohérents : 0 sur la base réelle.
- Cas B — RentalManagement absent et relation entièrement prouvée : 0.
- Cas C — Property absent ou introuvable : 17, tous `ANOMALY_NO_PROPERTY_REFERENCE`.
- Cas D — plusieurs contrats ouverts pour le même Property : 0 détecté.
- Cas E — Property vendu/retiré/archivé ou propriétaire divergent : 0 détecté.
- Cas F — RentalManagement inactif ou occupation divergente : 0 détecté.
- Paiements incohérents : 0, car aucun `Paiement` n'existe dans la base auditée.

Résultat exact du dry-run final : 17 contrats ouverts, 0 cohérent, 0 réparable, 17 anomalies, 0 conflit, 0 doublon, 0 anomalie de paiement, 0 action planifiée.

## Décisions d'architecture

- Extension du service existant, sans seconde logique ni nouvel endpoint.
- `Property` reste le bien physique; `RentalManagement` actif devient la source officielle de gestion; `Contrat` et `Paiement` restent les événements locatifs liés.
- Lecture en lots des Property, RentalManagement, Locataire, Proprietaire, Contrat et Paiement afin d'éviter un scan N+1.
- Les contrats `en_attente` et `actif` sont tous considérés ouverts.
- Les données vendues, retirées, archivées, dupliquées, sans participant ou avec propriétaire divergent sont bloquées et seulement rapportées.
- Les composants Dossier, Documents, Cockpit et statistiques continuent de lire leurs modèles actuels; aucune projection parallèle n'a été créée.

## Service de réconciliation

`scanRentalManagementConsistency()` construit la matrice et les compteurs. `planRentalManagementReconciliation()` ne retient que les dossiers dont le Property location, les participants et l'unicité sont prouvés. `applyRentalManagementReconciliation()` exige un acteur `Admin` ou `GestionnaireImmobilier`, re-scane chaque contrat avant écriture, appelle `syncLeaseOccupation()` puis rejoue le diagnostic complet.

Les statuts réparables sont limités à : RentalManagement absent, RentalManagement inactif, bail actif divergent et occupation divergente. Les conflits ne sont jamais transformés en action.

## Mode dry-run

Commande :

```bash
npm run rental:reconcile -- --dry-run
```

Le dry-run est le défaut, refuse les options inconnues et n'écrit aucune donnée. Il retourne les compteurs, la matrice, les anomalies, les paiements incohérents et le plan simulé.

## Mode apply

Commande contrôlée :

```bash
npm run rental:reconcile -- --apply --actor=<userId>
```

L'apply exige un acteur staff autorisé et reste interdit en production sans `RENTAL_RECONCILIATION_ALLOW_PRODUCTION=true`. Chaque action est revalidée immédiatement avant mutation. Le service officiel effectue ensuite l'upsert idempotent et la synchronisation.

Sur la base réelle, l'apply n'a pas été lancé : le plan contenait exactement 0 action et 17 anomalies non réparables. Nombre exact de biens réparés : **0**. Nombre exact d'anomalies restantes : **17**.

## Synchronisation des données

La réparation réutilise `rentalManagementLeaseSyncService` et `rentalListingSyncService` :

- activation durable de `RentalManagement`;
- `activeLease` et `currentTenant`;
- `occupancyStatus=occupe` et `availabilityStatus=loue` pour un bail actif;
- `Property.availability=Loué`, suspension de publication;
- cycle patrimonial GL-ASSET;
- notifications existantes;
- données visibles automatiquement dans Cockpit, KPI, Dossier et Documents.

Les paiements et documents ne sont ni recalculés, ni déplacés, ni dupliqués.

## Blocage des anomalies futures

`contratController.create` appelle désormais `ensureRentalManagementActive()` avant `Contrat.create` pour un bail. Ce service partagé crée ou réactive idempotemment le dossier de gestion, puis la synchronisation d'occupation existante finalise le cycle après insertion. L'index unique partiel continue de bloquer deux contrats ouverts concurrents sur un même Property.

## Journalisation

Chaque réparation réelle crée un `ActionLog` dans le module `GestionLocative`, avec : acteur, date, contrat/property cible, motif, résultat `CREATED` ou `UPDATED`, ancien état et nouvel état. Le `workflowHistory` et les notifications existants restent également alimentés par les services officiels.

## Impacts Web et Mobile

Aucun fichier Web ou Mobile n'a été modifié. Les clients bénéficient de la cohérence backend via leurs APIs existantes. Playwright, Mobile Jest, ESLint Mobile, TypeScript Mobile, Expo Doctor et Export Android n'ont pas été exécutés car aucun comportement ni fichier Web/Mobile n'est impacté. Le Build Next.js et Vitest ont néanmoins été exécutés comme demandé.

## Résultats des tests réellement exécutés

- Dry-run réel sur Mongo configuré : succès, 17 anomalies, 0 action, aucune écriture.
- Backend Unit : **105 suites, 1 215 tests réussis**.
- Backend Mongo : **49 suites, 405 tests réussis**.
- Tests ciblés réconciliation/CLI : **2 suites, 12 tests réussis**; également inclus dans les campagnes complètes selon leur catégorie.
- Web Vitest : **75 fichiers, 503 tests réussis**.
- Build Next.js : **succès**, 134 pages générées.
- ESLint serveur : **0 erreur**, 109 avertissements historiques.
- ESLint client : **0 erreur**, 267 avertissements historiques.
- `git diff --check` : **succès**.

Incident de lancement : une première exécution ciblée Mongo a été bloquée avant les tests par l'interdiction de port du sandbox (`listen EPERM`). La suite a été relancée intégralement dans l'environnement autorisé; seuls les résultats complets figurent ci-dessus.

## Risques résiduels et dettes restantes

- Les 17 contrats réels sans `bien` exigent une décision humaine. Il faut déterminer s'il s'agit réellement de baux immobiliers ou de contrats historiques mal typés, puis rattacher explicitement les seuls contrats légitimes à un Property vérifié.
- Le moteur ne peut pas déduire un Property depuis une adresse, un titre, un locataire ou un propriétaire : cette absence de rapprochement heuristique est intentionnelle.
- Sans transaction Mongo multi-document imposée par la CLI, une panne entre synchronisation et ActionLog reste théoriquement possible; la revalidation, l'idempotence et la vérification finale permettent une reprise contrôlée.
- Les contrats legacy sans `bien` ne bénéficient pas de l'index unique par Property; ils restent visibles dans chaque dry-run jusqu'à traitement humain.

## Fichiers créés

- `server/docs/GL_RECON_1_AUDIT.md`
- `server/docs/GL_RECON_1_REPORT.md`
- `server/__tests__/reconcileRentalManagementScript.test.js`

## Fichiers modifiés

- `server/services/rentalManagementReconciliationService.js`
- `server/services/rentalManagementLeaseSyncService.js`
- `server/scripts/reconcile-rental-management.js`
- `server/controllers/contratController.js`
- `server/__tests__/rentalManagementReconciliation.mongo.integration.test.js`
- `server/package.json`

## Confirmation de conformité

- Aucun commit effectué.
- Aucun push effectué.
- Aucune migration destructive.
- Aucune suppression de données.
- Aucune donnée réelle modifiée par la réconciliation.
- Aucun nouvel endpoint.
