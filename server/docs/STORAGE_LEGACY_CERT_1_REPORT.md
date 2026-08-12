# STORAGE-LEGACY-CERT-1 — Rapport final

Certification du moteur de migration legacy avant tout batch réel. L'audit initial est consigné dans `STORAGE_LEGACY_CERT_1_AUDIT.md`. Aucune migration réelle, aucun batch réel, aucune écriture Cloudinary de production n'a été exécutée pendant ce sprint.

## 1. État initial

STORAGE-LEGACY-1 livré avec verdict **PARTIALLY READY**. Composants préservés et réutilisés tels quels ou étendus additivement : `legacyAssetClassification.js`, `legacyAssetMigrationService.js`, `PrivateAssetMigration.js`, `verifyOldUrlProof.js`, `auditPrivateCloudinaryAssets.js`, `tenantResourceAttributionService.js` étendu. Gates backend au démarrage : Backend Unit 109/109 (1243 tests), Backend Mongo 68/68 (646 tests), toutes PASS.

## 2. Raisons du verdict PARTIALLY READY

Reprises intégralement de `STORAGE_LEGACY_1_REPORT.md` §42 (jamais reconstruites de mémoire, voir `STORAGE_LEGACY_CERT_1_AUDIT.md` §1) : (1) aucun inventaire jamais exécuté contre des données réelles ; (2) aucune preuve OLD URL contre un compte Cloudinary réel, seulement mockée ; (3) Playwright GL/Expo Doctor/gates Web-Mobile-E2E non revérifiés à l'époque.

## 3. Classification A–F

Taxonomie inchangée (A/B/C/D/E/F, voir `legacyAssetClassification.js`). Nouveauté de ce sprint : traduction opérationnelle explicite via `migrationDecisionFor` — A→PUBLIC-NO-ACTION, B→AUTO-MIGRABLE, C→MANUAL-REVIEW, D→MANUAL-REVIEW, E→PUBLIC-NO-ACTION, F→BLOCKED (défaut pour toute classification inconnue, jamais AUTO-MIGRABLE par défaut). 20 tests unitaires `legacyAssetClassification.test.js`, tous PASS.

## 4. Matrice par collection

Inchangée par rapport à `STORAGE_LEGACY_1_AUDIT.md` §5 (aucune nouvelle collection découverte). Complétée par une vérification directe du code (§4 de l'audit de certification) : les 9 `resourceType` ajoutés par STORAGE-LEGACY-1 sont désormais testés individuellement (§9 ci-dessous), pas seulement exercés indirectement.

## 5. Matrice par type de fichier

Confirmé : tous les uploads legacy de ce dépôt utilisent `resource_type: 'auto'` (`config/cloudinary.js`, `CLOUDINARY_DEFAULTS`) — aucun contrôleur métier ne fixe un type fixe. Le type réel stocké (`image`/`raw`/`video`) n'est donc connu qu'à la lecture de l'URL.

## 6. Resource types Cloudinary

`image` (photos, pièces d'identité), `raw` (PDF — quittances, contrats, factures), `video` (inclut l'audio — notes vocales). Aucun `auto` en sortie (Cloudinary ne le permet pas). Les trois sont désormais certifiés par le moteur (§7).

## 7. Preuve rename→authenticated

**Bug réel détecté et corrigé pendant ce sprint** : le moteur défaultait `resource_type` à `'raw'` en l'absence d'override explicite — incorrect pour tout document `image`/`video` réel (précisément les pièces d'identité et notes vocales, les cas les plus sensibles). Corrigé : `resourceTypeFromUrl(url)` dérive systématiquement le type depuis l'URL legacy observée ; `apply=true` sans type dérivable lève `CLOUDINARY_RESOURCE_KIND_UNKNOWN` avant tout appel Cloudinary plutôt que de tenter un `rename` probablement erroné. Certifié par `describe.each(['image','raw','video'])` dans `legacyAssetMigrationCertification.mongo.integration.test.js` — `rename` toujours appelé avec le type réellement dérivé, jamais un défaut fixe. **Limitation non résolue : ce test utilise un client Cloudinary mocké, jamais le SDK réel** (voir §28).

## 8. Preuve old URL

`verifyOldUrlProof.js` inchangé, réutilisé. Pour chacun des 3 `resource_type`, un test dédié confirme qu'une migration où `verifyOldUrlInaccessible` retourne `false` (URL encore accessible) échoue avec `OLD_URL_STILL_ACCESSIBLE` et reste `failed`, jamais `completed` — le principe fondamental du sprint STORAGE-LEGACY-1 (une écriture Mongo seule ne prouve rien) tient pour les trois types. **Limitation non résolue : sonde HTTP jamais exécutée contre une vraie URL `res.cloudinary.com`** (voir §28).

## 9. Nouvel accès privé

Non re-testé au niveau HTTP applicatif ce sprint (aurait nécessité de rejouer les routes de téléchargement STORAGE-SECURITY-1 avec un asset réellement migré) — délégué aux suites TENANT-CERT-2/STORAGE-SECURITY-1 existantes, non spécifiquement ré-exécutées pour un asset migré. Le moteur lui-même vérifie uniquement que `rename` retourne `type: 'authenticated'` avant de considérer l'étape franchie (`NEW_PRIVATE_ASSET_VERIFICATION_FAILED` sinon).

## 10. Tenant isolation

`tenantAttributionLegacyExtension.mongo.integration.test.js` (14 tests, tous PASS) : chacun des 9 `resourceType` ajoutés testé individuellement en `resolved`/`unresolved` selon les cas réalistes (Property liée ou non, `Contrat` rattaché ou non, `domain` connu/inconnu pour `FinancialDocumentArtifact`, `user` rattaché ou non pour `Proprietaire`). Cas `ambiguous` testé sur `RentalMaintenanceTicket` (seul type combinant preuve directe et relationnelle) dans `legacyAssetMigrationCertification...test.js` : tenant direct B + Property réellement liée à A → `ambiguous`, migration refusée. `InternalMail` confirmé sans aucune branche d'attribution possible (schéma sans relation Property/Contrat/Hotel) — reste `unresolved` par construction, jamais migrable.

## 11. Assets publics protégés

`Property.images` classifié E par construction (`isPublicMedia: true` prioritaire sur toute autre condition). Tentative `apply: true` avec `classification: 'E'` forcée explicitement → refusée par `assertApplyAuthorized` (`classification_not_B`), testé directement au niveau du garde d'autorisation, pas seulement au niveau du plan.

## 12. Pièces d'identité

`Locataire.pieceIdentite` testé aux deux extrêmes : sans `Contrat` rattaché → `unresolved` → refus ; rattaché à un `Contrat` sur une `Property` tenant-resolved → `resolved` → `classification: B` → migratable. Aucune pièce d'identité, réelle ou fixture, migrée pendant ce sprint.

## 13. Contrats

`Contrat.documents[]` exercé par la quasi-totalité des tests de certification (fixtures dédiées). **Aucun des 17 contrats réels n'a été lu, modifié ni approché** — uniquement des fixtures MongoMemoryReplSet.

## 14. Finance

`FinancialDocumentArtifact` (déjà classe A, architecture saine), `RentalPaymentReceipt`, `PaiementTransaction` testés en attribution tenant (§10). Aucun calcul financier modifié.

## 15. Conversations

Non retouché ce sprint — `Message`/`Conversation` gérés par la branche d'attribution déjà existante avant STORAGE-LEGACY-1, non modifiée.

## 16. Maintenance

`RentalMaintenanceTicket` : seul type utilisé pour le test du cas contradictoire (§10) — preuve directe et relationnelle simultanées, exactement le scénario le plus probable pour ce type de ressource opérationnelle.

## 17. DOC-EVO

Non retouché ce sprint (aucune modification `documentController`/`locataireController`). Comportement déjà conforme constaté par STORAGE-LEGACY-1 (distinction `legacy: true/false` en sérialisation), non re-vérifié activement mais non plus modifié.

## 18. Idempotence

Inchangée, déjà prouvée par STORAGE-LEGACY-1 (`legacyAssetMigrationEngine...test.js`, rejoué ce sprint sans régression : 15/15 PASS).

## 19. Concurrence

Inchangée, déjà prouvée par STORAGE-LEGACY-1 (verrouillage atomique en une seule commande `findOneAndUpdate`, corrigé pendant ce sprint précédent). Rejouée sans régression.

## 20. Crash recovery

Inchangé, rejoué sans régression (checkpoint distinct du status final, reprise testée après échec avant bascule DB).

## 21. Rollback

Inchangé, rejoué sans régression (refus sur `completed`, restauration DB uniquement sur échec post-bascule, jamais de republication automatique).

## 22. Apply guardrails

Les 5 conditions cumulatives auditées individuellement ce sprint (`legacyAssetMigrationCertification...test.js`, describe « Guardrails ») : `apply` seul → refus ; `ALLOW_PRIVATE_ASSET_MIGRATION_APPLY` + `mongoUri` seul (tenant/classification/confirm manquants) → refus (`tenantId_not_explicit`) ; `tenantIdExplicit` manquant isolément → refus ; `classification` ≠ B isolément → refus ; `confirmToken` incorrect isolément → refus ; absence par défaut de la variable d'activation confirmée (`process.env.ALLOW_PRIVATE_ASSET_MIGRATION_APPLY` non définie sauf action explicite d'un opérateur — absente de `.env`, absente de toute configuration CI de ce dépôt) ; toutes conditions réunies → autorisé. 7/7 PASS. Aucune condition assouplie.

## 23. Batching

`server/scripts/migrateLegacyAssetsBatch.js` (nouveau) — réutilise `auditPrivateCloudinaryAssets`/`legacyAssetMigrationService`, aucun moteur concurrent. `assertBounded` refuse toute invocation sans `--tenant`, `--collection` ou `--ids` (jamais « tout migrer »), vérifié par test direct (`BATCH_NOT_BOUNDED`). `--limit` plafonné à 200, défaut 25. En dry-run (défaut, sans `--apply`), le script n'appelle jamais `executeLegacyMigration` avec `apply: true` — il se contente de planifier et rapporter. Le chemin `--apply` de ce script est délibérément non câblé à une implémentation Cloudinary/DB réelle (`deps: {}`) : même si toutes les conditions `assertApplyAuthorized` étaient réunies par erreur, l'exécution échouerait immédiatement faute de `cloudinaryClient` fourni — une garde supplémentaire au-delà des 5 conditions déjà exigées. Câblage réel volontairement hors périmètre de ce sprint de certification.

## 24. Dry-run

`auditPrivateCloudinaryAssets.js` inchangé depuis STORAGE-LEGACY-1 (bug `+champ` déjà corrigé ce sprint-là). Non ré-exécuté contre une base réelle ce sprint (aucune fournie) ; ré-exécuté avec succès contre des fixtures MongoMemoryServer isolées pour confirmer le comportement de `migrateLegacyAssetsBatch.js` (`collectBatch`).

## 25. Attribution tenant

Voir §10. 9 `resourceType` étendus, chacun testé `resolved`/`unresolved` ; `ambiguous` testé sur un cas représentatif ; `global` non applicable directement (aucun `resourceType` de ce dépôt ne retourne littéralement `'global'` — ce statut, mentionné dans le brief, correspond en pratique au cas `unresolved` d'une ressource historique sans aucune attribution possible, déjà couvert).

## 26. Web/Mobile

Non modifiés ce sprint. Aucune nouvelle exposition d'URL n'a été introduite côté Web/Mobile — aucun fichier de ces répertoires n'a été touché.

## 27. Gates globales

| Gate | Résultat |
|---|---|
| Backend Unit complet | **PASS** — 109 suites, 1254 tests, 0 échec (rejoué ce sprint) |
| Backend Mongo complet | **PASS** — 70 suites, 682 tests, 0 échec, replica set arrêté proprement (936 s Jest) — inclut les 2 nouvelles suites de certification |
| Suites STORAGE-LEGACY-CERT-1 (classification, certification par resource_type, cas contradictoires, guardrails, attribution étendue) | **PASS** — 20+22+14 = 56/56 |
| Régression STORAGE-LEGACY-1 (moteur, idempotence, concurrence, crash recovery, rollback) | **PASS** — 15/15, aucune régression |
| ESLint serveur | **PASS** — 0 erreur, 127 warnings (dont 0 issus des fichiers de ce sprint ; 123 était la ligne de base historique, drift pré-existant hors périmètre) |
| Expo Doctor | **FAIL — inchangé** — 19/20, mêmes 9 dépendances patch-behind qu'à STORAGE-SECURITY-1, non traité (hors périmètre backend) |
| Playwright `rental-asset-onboarding.spec.js` (desktop + mobile) | **PARTIEL** — desktop PASS, mobile FAIL sur un timeout d'affichage KPI distinct du bug originel documenté par STORAGE-SECURITY-1 (« option Property absente », qui semble résolu) — flakiness préexistante, non liée à ce sprint (voir `STORAGE_LEGACY_CERT_1_AUDIT.md` §10) |
| Web Vitest / Mobile Jest / TypeScript Mobile / ESLint client / ESLint mobile / Build Next.js / Export Android / Playwright complet / `git diff --check` | **NON RÉEXÉCUTÉS CE SPRINT** — aucune modification `client/`/`altimmo-app/` autre que ce qui est déjà couvert ; non déclarés PASS |

Aucune gate non exécutée n'est déclarée PASS.

## 28. Risques

Le risque principal reste inchangé depuis STORAGE-LEGACY-1 : **aucune preuve n'a jamais été obtenue contre un compte Cloudinary réel**, à aucun moment des deux sprints. Ce dépôt ne dispose que d'un unique jeu d'identifiants Cloudinary (celui de production, partagé avec Netlify/Render) — aucun sandbox distinct n'existe, et ce sprint a délibérément refusé de l'utiliser pour des tests, même non destructifs, conformément à la consigne de prudence de la Phase 5. Une migration réelle pourrait donc échouer sur des comportements Cloudinary non observables depuis ce dépôt : limites de débit, latence de `rename` sur des fichiers volumineux, comportement exact de `invalidate: true` sur le CDN (documenté par Cloudinary comme best-effort, non garanti à 100 %). Risque secondaire : le nouvel accès privé post-migration (téléchargement backend authentifié) n'a pas été re-testé au niveau HTTP pour un asset réellement migré (§9).

## 29. Cas manual review

Classification C (publicId fiable, tenant `ambiguous`/`unresolved`) et D (tenant potentiellement exploitable, publicId insuffisant) : `migrationDecisionFor` les marque toutes deux `MANUAL-REVIEW`, jamais migrées automatiquement par le moteur ni par `migrateLegacyAssetsBatch.js` (qui ne sélectionne jamais autre chose que `classification === 'B'`).

## 30. Cas blocked

Classification F (provenance non prouvable, ou tenant `global` sans attribution) : `migrationDecisionFor` → `BLOCKED`. `InternalMail` y reste structurellement confiné (aucune relation exploitable sur le schéma actuel).

## 31. Fichiers créés

- `server/__tests__/legacyAssetMigrationCertification.mongo.integration.test.js`
- `server/__tests__/tenantAttributionLegacyExtension.mongo.integration.test.js`
- `server/scripts/migrateLegacyAssetsBatch.js`
- `server/docs/STORAGE_LEGACY_CERT_1_AUDIT.md`
- `server/docs/STORAGE_LEGACY_CERT_1_REPORT.md`

## 32. Fichiers modifiés

- `server/services/storage/legacyAssetClassification.js` (ajout `resourceTypeFromUrl`, `MIGRATION_DECISION`/`migrationDecisionFor` — additif)
- `server/services/storage/legacyAssetMigrationService.js` (correction du bug `resource_type` par défaut — §7 ; dérivation systématique depuis l'URL legacy observée)
- `server/__tests__/legacyAssetClassification.test.js` (tests ajoutés pour les nouvelles fonctions)
- `server/__tests__/legacyAssetMigrationEngine.mongo.integration.test.js` (nettoyage lint, aucun changement de comportement)

## 33. Verdict

### PARTIALLY READY

Justification : cette certification renforce sensiblement la confiance dans le moteur — un bug réel et potentiellement grave (`resource_type` par défaut incorrect, qui aurait fait échouer toute migration réelle de document `image`/`video`, précisément les pièces d'identité) a été détecté et corrigé ; la couverture par `resource_type` Cloudinary réellement utilisé (image/raw/video), les cas contradictoires, la protection des assets publics, la priorité pièces d'identité et l'attribution tenant des 9 types étendus sont désormais tous testés individuellement et passent (56 nouveaux tests, 0 échec) ; les gates backend (Unit + Mongo) sont vertes ; les guardrails `--apply` résistent à un audit condition-par-condition ; un runner de batch borné existe et refuse structurellement toute exécution non bornée ou non entièrement câblée.

Le verdict reste PARTIALLY READY, pas READY FOR CONTROLLED MIGRATION (même « WITH MANUAL REVIEW »), pour une raison unique mais bloquante : **aucune preuve n'a jamais été obtenue contre un compte Cloudinary réel**, ni pour le rename→authenticated, ni pour l'inaccessibilité de l'ancienne URL, ni pour le nouvel accès privé — dans ce dépôt, en l'absence de tout environnement Cloudinary de test distinct de la production. C'est exactement le critère listé comme obligatoire pour READY FOR CONTROLLED MIGRATION (« old URL revocation prouvée », « authenticated delivery prouvé ») que ce sprint ne peut honnêtement pas cocher au-delà d'une simulation, aussi rigoureuse soit-elle.

Playwright GL (mobile) et Expo Doctor restent rouges, mais ne sont pas déterminants pour ce verdict : ce sont des dettes hors périmètre du moteur de migration lui-même, déjà présentes avant ce sprint et non aggravées par lui.

**Prochaine étape si un environnement Cloudinary de test devient disponible** : rejouer `legacyAssetMigrationCertification.mongo.integration.test.js` (ou un équivalent) avec un `cloudinaryClient` réel pointant vers ce sandbox, en créant/révoquant exclusivement des assets jetables créés par le test lui-même — jamais de données réelles. Si cette preuve réelle est positive pour les trois `resource_type`, le verdict pourrait alors légitimement passer à READY FOR CONTROLLED MIGRATION WITH MANUAL REVIEW (les classes C/D restant toujours exclues du batch automatique).

Conformément au sprint : **STORAGE-LEGACY-CERT-1 n'est pas TENANT-CERT-3.** Aucune certification multi-tenant n'est déclarée. Aucun batch réel, même pilote, n'a été exécuté — la prochaine étape technique (batch pilote) reste un sprint séparé et explicitement autorisé au préalable.

## Confirmations finales

Aucun commit. Aucun push. Aucun déploiement. Aucune migration réelle. Aucun backfill réel. Aucun asset Cloudinary de production supprimé. Aucune donnée réelle modifiée. Aucune écriture production. Aucun bypass Admin. Aucun fallback tenant global.
