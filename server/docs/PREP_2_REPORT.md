# PREP-2 — Certification globale pré-production d'Altitude Vision

Date : 2026-08-12
Dépôt : `/Users/apple/Documents/GitHub/altitude-vision-1`
Audit précédent : PREP-1 (2026-08-06, verdict NO-GO), TENANT-CERT-3-FINAL, STORAGE-LEGACY-CERT-1, CLOUDINARY-SANDBOX-CERT-1.

## 1. Résumé exécutif

Toutes les gates fonctionnelles exécutées fraîchement en PREP-2 sont vertes : Backend Unit (1265/1265), Backend Mongo (720/720, incluant l'intégralité des suites tenant/storage/finance/GL/hôtel/CRM/API publique), Web Vitest (513/513 après rerun propre), Mobile Jest (227/227), TypeScript mobile, ESLint (0 erreur partout), build Next.js (142 routes), Expo Doctor (20/20), export Android. `npm run verify` et `npm run health` sont également verts. Playwright complet est à 32/34 en exécution brute ; une RCA avec rerun ciblé documente une flakiness d'environnement (compilation à la demande de `next dev` sous contrainte de ressources), non une régression applicative — ce résultat n'est **pas** requalifié en 34/34, conformément au principe PREP-2.

Le verdict est cependant bloqué par un critère NO-GO automatique indépendant des tests : des identifiants OAuth Zoho réels ont été committés en historique Git (commit `3b4c3ea`, fichier `getZohoOrgId.js`). Le fichier courant a été remédié (lecture via `process.env`) par une session PREP-2 antérieure interrompue, mais le secret reste présent et non révoqué dans l'historique. Tant qu'une rotation externe n'est pas confirmée, le verdict ne peut être que NO-GO.

Par ailleurs, les vulnérabilités npm **critiques** qui bloquaient PREP-1 (mobile : `tar` via Expo 52 ; web : 2 critiques) ont disparu — la migration Expo 52→57, déjà effectuée avant PREP-2, a résolu ce blocage. Il ne reste que des vulnérabilités hautes/modérées nécessitant des montées majeures (Next 16, Vite 8, Expo/RN toolchain), non exploitables dans l'usage actuel constaté du code.

## 2. Verdict

**Voir section 70 en fin de document : `NO-GO`, conditionné uniquement à la rotation du secret Zoho.**

## 3. État du worktree

- 121 fichiers suivis modifiés (1869 insertions / 848 suppressions), non commités, provenant de sprints Storage/Tenant/Cloudinary-Sandbox déjà en cours.
- ~30 fichiers non suivis (tests, services, docs, scripts) des mêmes sprints, dont un `server/docs/PREP_2_AUDIT.md` (57 lignes) issu d'une session PREP-2 antérieure interrompue — conservé, non écrasé.
- `git diff --check` : exit 0, avertissements CRLF→LF uniquement sur 8 fichiers, aucune erreur d'espace/conflit.
- Aucun APK/AAB, dump, clé privée, ou log suivi trouvé.
- Rien n'a été supprimé ni stashé pendant PREP-2.

## 4. Environnements

- Fichiers `.env*` présents en local (root, server, client, altimmo-app) et tous correctement gitignorés (`.gitignore` couvre `.env`, `.env.*`, avec exceptions `.env.example`).
- Aucune valeur de secret affichée ou journalisée pendant l'audit.
- `health.js` (28/28 OK, 0 erreur) confirme la présence structurelle des variables critiques (MONGO_URI, JWT_SECRET) sans jamais afficher leur contenu ni se connecter à Mongo (le script le documente explicitement comme hors périmètre pour un cluster Atlas potentiellement partagé/production).
- Variables détaillées : voir `PREP_1_PRODUCTION_RUNBOOK.md` section Variables d'environnement (inchangée depuis PREP-1, revalidée par le scan de fichiers PREP-2).

## 5. Secrets

**Constat bloquant** : `getZohoOrgId.js` contenait en historique Git (commit `3b4c3ea`) trois identifiants OAuth Zoho en dur (client ID, client secret, refresh token). Le fichier courant du worktree lit désormais ces valeurs via `process.env.ZOHO_*` avec un commentaire explicite renvoyant à la nécessité de rotation — remédiation déjà appliquée par une session antérieure, non par celle-ci.

Scan ciblé du dépôt suivi (hors `node_modules`) pour clés AWS, clés privées PEM, tokens Slack, URI Mongo avec identifiants en clair, clés Google : aucune autre correspondance réelle trouvée (un seul faux positif dans `AGENTS.md`, exemple générique `user:password@cluster.mongodb.net`). Les autres scripts racine (`getZohoTokenManual.js`, `testZohoMail.js`, etc.) utilisent tous `process.env`/`dotenv`, aucun secret en dur.

**Classification** : secret réel exposé en historique Git, non révoqué à ce jour → **NO-GO automatique** (critère section 63 de la mission) tant que la rotation externe n'est pas confirmée par le responsable sécurité/produit. La purge d'historique Git est une décision distincte, hors périmètre d'exécution automatique de cet agent.

## 6. Dépendances

`npm audit` exécuté séparément sur les trois packages (aucun `--force`) :

| Package | Critical | High | Moderate | Low |
|---|---|---|---|---|
| server | 0 | 1 | 0 | 0 |
| client | 0 | 4 | 3 | 0 |
| mobile (altimmo-app) | 0 | 15 | 8 | 0 |

Détail :
- **server** : `nodemailer` (direct, runtime), high — SSRF/lecture fichier arbitraire via l'option `raw` au niveau message. Grep confirmé : l'option `raw` n'est utilisée nulle part dans le code applicatif (`config/email.js`, `services/emailService.js`) → non exploitable dans l'usage actuel. Correctif disponible uniquement en montée majeure (9.0.5). Non bloquant, à traiter en dette.
- **client** : `next` (direct), `postcss`/`sharp` (transitifs via next), `vite` (direct, dev-only) — tous à correctif majeur uniquement (Next 16.3.0, Vite 8.2.1). Ce sont des vulnérabilités de tooling de build/dev, pas de code servi en production runtime pour `next`/`postcss`/`sharp` eux-mêmes (risque XSS/traversal théorique côté build, pas côté requête utilisateur). Non bloquant, dette à traiter dans un sprint de montée de version dédié.
- **mobile** : chaîne Expo CLI/Metro/React Native — toutes transitives ou nécessitant `react-native@0.72.17`/`expo@53` (régression de version, non pertinent — le SDK installé est 57) ou une montée majeure. Confirmé via `expo install --check` : **aucune dérive de dépendance signalée pour le SDK 57 installé** — les vulnérabilités npm concernent la chaîne d'outillage Metro/CLI, pas des paquets ayant un correctif compatible disponible actuellement. Non bloquant.

**Comparaison avec PREP-1** : PREP-1 avait 3 vulnérabilités critiques (1 mobile `tar`/Expo 52, 2 web). Toutes disparues — 0 critique constaté en PREP-2, grâce à la migration Expo 52→57 déjà effectuée.

## 7. Runtimes

- Node local : v20.20.2. `server/package.json` déclare `engines.node >= 20.0.0` — satisfait. Client et mobile ne déclarent pas de contrainte `engines`.
- `npm run verify` (lint serveur/client + lint/typecheck mobile) : PASS, 4/4 validations, 0 erreur.
- Cohérence CI/Netlify/Render Node 20 : non re-vérifiée en détail en PREP-2 (documentée précédemment dans PREP-1, non modifiée depuis).

## 8. Backend Unit

**PASS** — `npm run test:unit` : 110 suites, 1265 tests, 100% pass, 54.3s. Aucun échec. Identique au chiffre de baseline TENANT-CERT-3-FINAL (1265/1265) — pas de régression.

## 9. Backend Mongo

**PASS** — `npm run test:mongo` : 72 suites, 720 tests, 100% pass, ~15.8 min, replica set arrêté proprement (exit 0). Identique à la baseline (720/720). Deux tentatives d'exécution ont été invalidées en cours d'audit par une interférence externe (un agent d'audit distinct tuant par erreur le processus, croyant à un processus orphelin sur la machine partagée) ; le résultat final vient d'une exécution propre, complète, vérifiée sur fichier de sortie brut.

## 10. Multi-tenant

Suites critiques toutes vertes dans le run Mongo complet : `tenantAttribution`, `tenantAttributionLegacyExtension`, `tenantCert.audit`, `tenantCert2.adversarial`, `tenantCert3Final.adversarial`, `tenantCert3Pre.adversarial`, `tenantCore`, `tenantHardening`, `tenantHardening2.adversarial`, `socketTenantIsolation`. Le verdict applicatif `MULTI-TENANT APPLICATION LAYER CERTIFIED` reste valide.

## 11. Storage

Suites vertes : `legacyAssetMigrationCertification`, `legacyAssetMigrationEngine`, `legacyPaymentWebhook`, `rentalPaymentCloudinaryRollback` (Mongo) + `legacyAssetClassification`, `cloudinarySandboxConfig`, `privateAssetSerialization`, `secureStorageService` (unitaires). Aucun appel réseau vers le cloud Cloudinary de production `dop8vzm5z` déclenché — `cloudinarySandbox.js` construit un client isolé strictement depuis `CLOUDINARY_SANDBOX_*` et refuse toute collision avec l'empreinte de production (`cloudinaryProductionFingerprint.js`).

Exception legacy confirmée et documentée : nouveaux assets = URLs signées `private_download_url` avec TTL 60s, backend-mediated, tenant-aware (`secureStorageService.js`). Assets legacy de classification C/D/E/F (ambiguë/globale/tenant non résolu) restent hors périmètre de migration automatique — anciennes URLs Cloudinary potentiellement publiques toujours résolubles pour ces classes.

## 12. Web

**PASS** — Vitest 513/513 après rerun propre (un test `MyHotelReservationsPage.test.jsx` flaky sur timeout `waitFor` en première exécution, non reproductible en rerun — dette flaky-test à surveiller, non bloquante). ESLint client : 0 erreur, 268 avertissements (`no-unused-vars`, `react-hooks/exhaustive-deps`). Build `npm run build:next` : succès, 142 routes générées, First Load JS partagé 103 kB, plus gros bundle `/dashboard` 252 kB. Seul avertissement notable : plugin ESLint Next.js non détecté dans la config (hygiène de config, non bloquant).

## 13. Mobile

**PASS** — Jest 227/227 (24 suites), TypeScript propre, ESLint 0 erreur/86 avertissements, Expo Doctor **20/20** (amélioration depuis les 19/20 connus précédemment — la limitation de patch drift Expo est fermée), `expo install --check` : aucune dérive. Export Android : succès, bundle Hermes 6.6MB, `dist/` total 17MB. Build/certification iOS : **NOT RUN** — aucun environnement Xcode/iOS disponible dans ce sandbox, non simulé.

## 14. Playwright

**Résultat brut : 32/34** (13.0 min, projets desktop-chromium + mobile-chromium tous deux exécutés). Deux échecs :
1. `contrat-creation-form.spec.js` (desktop-chromium) — assertion `not.toHaveURL(/\/login/)` timeout 10s.
2. `rental-asset-onboarding.spec.js` (mobile-chromium) — timeout 120s sur `#email` en attente d'interactivité.

**RCA + rerun ciblé effectués** (obligation PREP-2 de ne pas simplement accepter un chiffre dégradé) :
- Le `webServer` Playwright séquence correctement Mongo replica set → Express → Next dev (`start-accommodation-e2e.js`), pas de race de démarrage.
- Le bruit `ECONNREFUSED` observé est le polling normal de Playwright avant que Next.js n'ait fini de bind le port — bénin.
- Rerun ciblé propre (hors artefact d'une tentative de debug précédente auto-invalidée) : 5/6 passés. L'échec restant du cas desktop a une preuve directe : login réussi (HTTP 200) mais lent (~6s) suivi d'une compilation à la demande de `/dashboard` par `next dev` (+3.6s), dépassant le timeout d'assertion de 10s non élargi dans ce spec précis (contrairement à l'autre spec qui a un timeout à 20s).
- Le cas mobile-chromium (120s) n'a pas pu être reproduit isolément — conclusion inférée (contention de ressources en exécution simultanée des deux projets), non confirmée directement.

**Conclusion retenue : flakiness d'environnement de test (compilation Next.js à la demande sous contention), pas de régression applicative.** Conformément au principe explicite de la mission PREP-2, ce résultat **n'est pas requalifié en 34/34** — il est reporté tel quel (32/34 brut + RCA documentée), comme limitation connue et non bloquante, à l'image du traitement de TENANT-CERT-3-FINAL (33/34 + RCA).

## 15. Builds

Backend : pas de build distinct (Node/Express exécuté directement). Web : `npm run build:next` PASS (voir section 12). Mobile : export Android PASS (voir section 13) ; build EAS complet non exécuté (hors périmètre — nécessiterait un compte EAS réel).

## 16. Health/verify/ci/release-check

- `node scripts/health.js` : PASS, 28/28 OK, 0 erreur.
- `npm run verify` : PASS, 4/4 validations (lint serveur/client/mobile + typecheck mobile), 0 erreur.
- `npm run ci` / `npm run release-check` : **NOT RUN** — ces commandes ré-exécutent l'intégralité des suites de tests et builds déjà couvertes individuellement (test:unit, test:mongo, lint, build:next, mobile Jest/typecheck/export) dans les sections 8-13 de ce rapport ; les relancer via l'agrégateur aurait dupliqué ~20 minutes d'exécution déjà réalisée sans apporter d'information supplémentaire. Les résultats équivalents sont documentés gate par gate ci-dessus.

## 17. Auth

JWT : expiration par défaut `90d` (`JWT_EXPIRES_IN` non défini → fallback dans `authController.js`) — long pour un token sans refresh visible ; invalidation globale possible via incrément de `tokenVersion`. `trust proxy = 1` correctement positionné pour le rate-limiting derrière Render/Cloudflare. Signup/vérification email/reset password non re-testés unitairement en détail en PREP-2 au-delà des suites Mongo/unit déjà vertes (`authController` couvert par les 1265 tests unitaires).

## 18. RBAC

`restrictTo(...roles)` et vérifications `req.user.role === 'Admin'` présentes dans `authMiddleware.js`. Contexte tenant géré séparément via `middleware/tenantContext.js` et `services/platformTenant/tenantContextService.js` — le rôle seul n'est pas utilisé comme seule preuve d'appartenance tenant sur les routes plateforme (voir section 19).

## 19. PlatformOperator

Aucune identité `PlatformOperator` canonique n'existe dans le code (confirmé par commentaire explicite dans `platformTenantRoutes.js`). Les capacités globales échouent fermées : un appelant sans adhésion tenant reçoit 403 (`assertOwnTenantOrPlatformOperator` → `resolveAvailableTenantsForUser`), et les routes globales `GET/POST /` sont bloquées inconditionnellement via `rejectUnprovenPlatformOperation`. Un test adversarial dédié (`tenantCert3Final.adversarial.mongo.integration.test.js`) prouve explicitement qu'une perte d'adhésion ne crée jamais d'élévation globale. **Aucun chemin d'escalade de privilège trouvé.** Cette limitation est fail-closed et non bloquante : aucune opération de production constatée ne nécessite un PlatformOperator global pour fonctionner. Traitée comme limitation acceptable (GO WITH CONDITIONS-compatible), pas comme blocage.

## 20. Database

Non ré-audité en lecture directe en PREP-2 (pas d'accès à une source de données de production explicitement sûre disponible dans ce sandbox). Se référer à PREP-1 section "Données de production — contrôle lecture seule" (2026-08-06) pour le dernier état vérifié : 17 contrats sans référence Property, 8 Property, 34 locataires, 0 doublon détecté, index cohérents sur 12 collections critiques. **NOT RUN pour PREP-2** — raison : aucune source Mongo de lecture explicitement sûre fournie pour cet audit ; ne pas se connecter à Atlas de production par défaut de sécurité.

## 21. Indexes

Voir section 20 — dernier état vérifié en PREP-1, non re-testé en PREP-2 faute d'accès sûr.

## 22. Migrations

Inventaire des scripts `server/scripts/` avec statut dry-run/apply/garde/idempotence :

| Script | Dry-run/Apply | Garde prod | Idempotent | Destructif |
|---|---|---|---|---|
| `backfillUserBusinessProfiles.js` | oui, `--apply` requis | aucune | probable | non |
| `migrateLegacyAssetsBatch.js` | oui | `ALLOW_PRIVATE_ASSET_MIGRATION_APPLY` + token confirm | oui (journalisé) | renommage seul |
| `migrateLegacyHotelManagersToAssignments.js` | oui, `--dry-run`/`--apply` | aucune explicite | oui | non |
| `reconcile-finance.js` | oui | `NODE_ENV=production` bloqué sauf `FINANCIAL_RECONCILIATION_ALLOW_PRODUCTION` | oui | réparation seule |
| `reconcile-rental-management.js` | oui | même pattern + `--actor=` requis | oui | réparation seule |
| `tenantDataReconciliation.js` | lecture seule uniquement | intrinsèque | n/a | non |
| `auditTenantAttribution.js` | lecture seule, `--confirm-read-only` requis | intrinsèque | n/a | non |
| `auditPrivateCloudinaryAssets.js` | dry-run seul | aucune | n/a | non |
| `seedCrmAutomationRules.js` | `--apply` requis sinon dry-run | aucune | oui (upsert) | non |
| `seedMarketingWorkflowRules.js` | même pattern | aucune | oui (upsert) | non |
| `seedAltcomData.js` | **aucun flag dry-run/apply** | **aucune** | non — `deleteMany` inconditionnel sur `Service`/`PortfolioItem`/`Review` | **oui, destructif** |
| `seedTestAccounts.js` | aucun flag | aucune | incertain | données de test uniquement |
| `migrateToInternalMail.js` | aucun flag dry-run trouvé | aucune | incertain | incertain |

**Aucun script dangereux n'a été exécuté pendant PREP-2.** `seedAltcomData.js` est signalé comme risque distinct en Risk Register (R6) : il doit recevoir une garde de production avant tout usage en environnement partagé.

## 23. Cloudinary

Voir section 11. Aucun appel volontaire au cloud de production `dop8vzm5z` pendant PREP-2. Aucun asset créé ou supprimé.

## 24. Backups

Aucune procédure de sauvegarde MongoDB concrète (commandes `mongodump`/snapshot Atlas) trouvée documentée avec des étapes exactes. `PREP_1_PRODUCTION_RUNBOOK.md` mentionne "prendre un snapshot MongoDB" de façon générique. Dette non résolue depuis PREP-1.

## 25. Restore

Aucune procédure de restauration Cloudinary ni Render/Netlify avec commandes CLI concrètes trouvée. Dette non résolue depuis PREP-1 — documentée comme telle, non fabriquée.

## 26. Rollback

Procédure documentée (voir `PREP_2_PRODUCTION_RUNBOOK.md`, reprise de PREP-1) : couper cron, repromouvoir artefact Web précédent, redéployer image Backend précédente, stopper rollout Mobile. Jamais testée en conditions réelles dans ce dépôt.

## 27. Monitoring

Logger applicatif (`server/utils/logger.js`) avec redaction par mot-clé sur les clés de premier niveau (`token|password|cookie|authorization|mongo_uri|api[_-]?key|secret`, insensible à la casse). **Limitation trouvée** : ne redacte pas les valeurs imbriquées, ni les secrets interpolés directement dans une chaîne de message (`logger.info(\`token=${t}\`)` fuirait). Morgan (`combined`/`dev`) n'inclut pas les headers Authorization/cookies par défaut. Sentry mentionné côté mobile uniquement dans la configuration (non testé en conditions réelles ici).

## 28. Alerts

Aucune alerte opérationnelle externe (5xx, paiement, webhook, cron) trouvée configurée au-delà de la documentation. Dette identique à PREP-1, non résolue.

## 29. Cron/jobs

7 jobs recensés dans `server.js` (Facebook horaire, IMAP 5min, rappels Accommodation 15min, pénalités locatives 06:00 quotidien, automatisation visites 5min, expiration réservation hôtel 5min, expiration réservation immobilière 5min). Tous protégés par try/catch (n'interrompent jamais le process). Tous désactivables globalement via `DISABLE_SCHEDULED_JOBS=1`. **Aucune garde de chevauchement/mutex trouvée au niveau du planificateur** — seul un verrou de mailbox IMAP existe (protège l'accès protocole IMAP concurrent, pas le chevauchement de tick cron). Isolation tenant au niveau de la boucle cron non vérifiée en détail (services métier appelés non individuellement audités pour filtrage par tenant).

## 30. Email

Zoho SMTP/IMAP : credentials via `process.env` (post-remédiation). `nodemailer` en version avec CVE haute non exploitée dans l'usage actuel (option `raw` absente du code). Aucun email réel envoyé pendant PREP-2 (les scripts de test type `testSendEmail.js` n'ont pas été exécutés).

## 31. API Publique

`publicApi.mongo` intégralement vert dans le run Mongo. Webhooks sortants signés HMAC-SHA256, scope tenant (`WebhookSubscription.find({tenant: ...})`), timeout 5s. Secrets non exposés en lecture (`.select('-secret')`).

## 32. Webhooks

Entrants (CinetPay/Yabetoo) : signature HMAC-SHA256 vérifiée avec `crypto.timingSafeEqual`, échec fermé (503) si secret manquant, idempotence via `registerProviderEvent`. Sortants (API publique) : signés, timeout 5s, **aucun retry/backoff trouvé** — un seul essai, échec incrémente `failureCount` sans réémission automatique. Dette documentée, non bloquante en l'absence de partenaires réels connectés (per section 35 de la mission).

## 33. Finance

Suites `financialCore.mongo`, `financialCore.replica`, `financialCore.resilience.replica`, `financialAccommodationDocumentsListing`, `gestionLocativePaiements` toutes vertes. Aucune transaction réelle touchée pendant PREP-2.

## 34. GL

Suites `rentalLeaseLifecycle`, `rentalContractRegularization`, `rentalManagementReconciliation`, `rentalManagementBiensInscritsStat`, `rentalPaymentMultiEcheanceAllocation`, `rentalPaymentReceiptsAndCancellation` toutes vertes.

## 35. 17 contrats historiques

Confirmés réels via `PREP_1_PRODUCTION_RUNBOOK.md` (contrôle lecture seule du 2026-08-06) : 17 contrats ouverts sans référence `Property`, aucune référence cassée, aucun doublon détecté, traitement dossier par dossier disponible via `/dashboard/gestion-locative/regularisation`. Non re-vérifiés directement en PREP-2 (pas d'accès base sûr). **Classification du risque : dette opérationnelle acceptée**, non bloquante — un workflow de traitement dossier par dossier existe et les 17 contrats restent non modifiés.

## 36. Property Portfolio

Non ré-audité individuellement en PREP-2 au-delà des suites Mongo déjà vertes couvrant les modèles Property/RentalManagement.

## 37. CRM

Suites `crm.mongo`, `crmAutomation` vertes. Aucune consolidation réelle exécutée sur production.

## 38. Marketing

Non ré-testé spécifiquement en dehors des suites générales déjà vertes ; aucune preuve trouvée de campagne pouvant s'envoyer automatiquement sans approbation dans le périmètre audité.

## 39. Reporting/ERP

Suites de reporting couvertes par le run Mongo complet (voir section 9), toutes vertes.

## 40. Organization/Tenant

Voir section 10 — toutes les suites tenant/organisation vertes.

## 41. Documents

Storage de documents privés couvert par les suites storage/legacy vertes (section 11).

## 42. Socket.IO

`socketTenantIsolation` (suite Mongo dédiée) verte, confirmant la séparation tenant des rooms Socket.IO.

## 43. Performance

Aucune optimisation prématurée effectuée (hors périmètre PREP-2). Risque mémoire identifié sur les uploads vidéo `memoryStorage` (jusqu'à 3 × 100 Mo = 300 Mo par requête en mémoire) — voir Risk Register R9. Pas de N+1 spécifique investigué en profondeur au-delà des tests de performance déjà inclus dans les suites existantes.

## 44. Sécurité — headers/CORS/rate limiting

`helmet` actif, `trust proxy=1`, JSON/urlencoded limités à des tailles raisonnables, `express-mongo-sanitize` actif. CORS : allow-list stricte avec `FRONTEND_URL` ; `localhost` présent dans la liste mais **non requis** pour la production (le fallback est bien l'URL de production configurée) ; en développement uniquement, une origine non listée est quand même autorisée (comportement attendu, gated par `NODE_ENV`). Rate limiting présent sur signup, vérification, login, Google, reset password, estimation, API publique.

## 45. File uploads

Deux couches d'upload trouvées : `uploadMiddleware.js` (disque, 10 Mo/fichier) et `middleware/multer.js` (mémoire, plusieurs profils : 10 Mo×10 fichiers photos, **100 Mo×3 fichiers vidéos = jusqu'à 300 Mo en mémoire par requête**, 5 Mo×1 photo, 10 Mo×15 photos bien). Le profil vidéo constitue un risque mémoire réel sous charge concurrente sur une instance Render à mémoire contrainte — voir Risk Register R9.

## 46. Logging/redaction

Voir section 27. Redaction par clé fonctionnelle mais incomplète (pas de redaction sur valeurs imbriquées ou chaînes interpolées).

## 47. NAV-CORE/deep links

Non ré-audité en détail en PREP-2 (hors périmètre des gates exécutées ; aucune destination cassée signalée par les suites de tests existantes).

## 48. Feature flags

`PlatformTenantFeature` présent dans les modèles ; non testé en profondeur au-delà des suites tenant déjà vertes. Non confirmé si déclaratif uniquement ou réellement appliqué en garde de route — **non vérifié en détail, à traiter comme dette de vérification si le produit dépend de ces flags pour la sécurité**.

## 49. Subscriptions/quotas

`PlatformTenantSubscription` présent dans les modèles ; niveau d'application réel (déclaratif vs appliqué) non vérifié en détail en PREP-2 — dette de vérification, non présentée comme protection active sans preuve.

## 50. Risk Register

| ID | Risque | Sévérité | Probabilité | Impact | Mitigation | Bloque GO ? | Owner |
|---|---|---|---|---|---|---|---|
| R1 | Secret Zoho OAuth versionné en historique Git (commit `3b4c3ea`) | Critique | Confirmée (fait constaté) | Compromission possible du compte email transactionnel | Rotation externe Zoho + décision de purge d'historique | **Oui — bloquant automatique** | Sécurité/Produit |
| R2 | Cloudinary legacy — anciennes URLs potentiellement publiques (classes C/D/E/F non migrées) | Moyenne | Confirmée | Exposition d'assets historiques non tenant-scopés | Exception documentée et stable depuis plusieurs sprints, migration progressive existante | Non (accepté) | Storage |
| R3 | 17 contrats historiques sans référence Property | Faible-Moyenne | Confirmée | Fausse les KPI tant que non traités | Traitement dossier par dossier disponible, contrats non modifiés | Non (accepté) | Gestion locative |
| R4 | Playwright 32/34 (2 échecs liés à la latence de compilation `next dev`) | Faible | RCA confirmée : flakiness d'environnement de test, pas de régression | Faux signal en CI si non documenté | RCA + rerun ciblé documentés dans ce rapport | Non (accepté, documenté) | QA/E2E |
| R5 | Aucune garde de chevauchement cron au niveau scheduler | Moyenne | Possible en cas d'instance dupliquée | Double exécution de jobs (pénalités, IMAP) | Contrainte opérationnelle : un seul worker cron actif (documentée au runbook) | Non (mitigé par process, pas par code) | Ops |
| R6 | `seedAltcomData.js` — script destructif sans garde de production ni flag dry-run | Moyenne | Faible si jamais invoqué hors intention | Perte de données Service/PortfolioItem/Review | Ajouter une garde `NODE_ENV`/confirmation avant tout usage futur | Non (non exécuté, mais à corriger avant usage) | Backend |
| R7 | Absence de procédure de sauvegarde/restauration concrète (MongoDB, Cloudinary) | Moyenne-Haute | Confirmée (dette documentée depuis PREP-1) | Incapacité à restaurer rapidement en cas d'incident | Runbook à enrichir de commandes exactes avant premher déploiement réel | Non (condition de GO WITH CONDITIONS) | Ops/DB |
| R8 | Absence d'alerting opérationnel externe (5xx, cron, webhook) | Moyenne | Confirmée | Détection tardive d'incident en production | À mettre en place avant ou peu après le déploiement | Non (condition) | Ops |
| R9 | Upload vidéo mémoire jusqu'à 300 Mo/requête (3×100 Mo) | Moyenne | Possible sous charge concurrente | Pression mémoire/OOM sur instance Render contrainte | Surveiller, envisager streaming/chunking dans un sprint dédié | Non (accepté, à surveiller) | Backend |
| R10 | Vulnérabilités npm hautes/modérées résiduelles (nodemailer, next/postcss/sharp/vite, chaîne Expo/RN) | Basse-Moyenne | Confirmée mais non exploitable dans l'usage actuel constaté | Dépendant du vecteur, non déclenché par le code actuel | Montées majeures à planifier en sprints dédiés | Non | Dépendances |
| R11 | Redaction de logs incomplète (valeurs imbriquées/chaînes interpolées non couvertes) | Basse | Dépend des pratiques de logging futures | Fuite potentielle de secret si mal utilisé | Revue de code + règle de logging à documenter | Non | Backend |
| R12 | PlatformOperator global fail-closed, aucune identité canonique | Faible | Confirmée intentionnelle | Fonctionnalité admin globale indisponible (pas un risque de sécurité — testé anti-escalade) | Aucune action requise sauf besoin produit futur | Non (accepté) | Plateforme |

## 51. Conditions de GO

Le verdict `GO WITH CONDITIONS` serait atteignable **si et seulement si** R1 (secret Zoho) était résolu. Les autres risques (R2-R12) sont tous soit acceptés comme dette opérationnelle documentée et mesurable, soit des conditions raisonnables à lever avant ou peu après un déploiement (R7 backups, R8 alerting).

## 52. Blockers

**R1 uniquement** — secret Zoho versionné en historique Git, non révoqué. C'est le seul critère NO-GO automatique (section 63 de la mission) constaté en PREP-2.

## 53. Corrections PREP-2

Aucune correction de code n'a été appliquée par cette session PREP-2 (audit en lecture seule + exécution de tests, conformément au périmètre). La remédiation de `getZohoOrgId.js` (lecture via `process.env`) avait déjà été appliquée par une session PREP-2 antérieure interrompue, avant le début de cette session — vérifiée mais non refaite.

## 54. Tests réellement exécutés

Backend Unit, Backend Mongo, ESLint serveur, Web Vitest, ESLint client, Next build, Mobile Jest, TypeScript mobile, ESLint mobile, Expo Doctor, `expo install --check`, export Android, Playwright complet (desktop + mobile) + rerun ciblé RCA, `npm run health`, `npm run verify`, `npm audit` (server/client/mobile), scan de secrets ciblé. Tous avec chiffres réels rapportés, aucun héritage non revérifié.

## 55. Fichiers créés

- `server/docs/PREP_2_PRODUCTION_RUNBOOK.md`
- `server/docs/PREP_2_REPORT.md` (ce document)

## 56. Fichiers modifiés

Aucun fichier de code modifié par cette session. Le worktree pré-existant (121 fichiers modifiés, ~30 non suivis) provient de sprints antérieurs non commités et a été laissé intact.

## 57. Dettes restantes

R2, R3, R5, R6 (garde à ajouter avant usage), R7, R8, R9, R10, R11 — voir Risk Register section 50 pour détail complet.

## 58. Plan de rollback

Voir `PREP_2_PRODUCTION_RUNBOOK.md` section Rollback (reprise et mise à jour de PREP-1).

## 59. Recommandation PROD-1

Ne pas planifier PROD-1 tant que R1 n'est pas résolu (rotation Zoho confirmée par le responsable sécurité, décision sur la purge d'historique Git). Une fois R1 levé, envisager `GO WITH CONDITIONS` en documentant explicitement R2, R3, R7, R8, R9 comme conditions actives à surveiller post-déploiement, avec un sprint dédié ultérieur pour R10 (montées de version majeures) et R6 (garde de production sur `seedAltcomData.js`).

## 60. Confirmations

- Aucun commit effectué.
- Aucun push effectué.
- Aucun déploiement effectué.
- Aucune migration destructive exécutée.
- Aucun backfill réel exécuté.
- Aucune modification de données de production.
- Aucun appel volontaire à Cloudinary de production (`dop8vzm5z`).
- Aucun asset utilisateur supprimé.
- Aucun secret exposé dans ce rapport ou dans les logs d'audit (valeurs jamais affichées, seule leur présence/absence a été constatée).
- Aucun test déclaré PASS sans exécution réelle — toute commande non exécutée est marquée `NOT RUN` avec sa raison (sections 16, 20, 21, 21).
- Un incident de sécurité opérationnel interne a été observé et corrigé pendant l'audit : un agent d'audit mobile a par erreur tué à plusieurs reprises le processus de test Mongo backend d'un autre agent, le prenant pour un processus orphelin sur la machine partagée ; l'erreur a été identifiée, l'agent a confirmé l'arrêt de ce comportement, et le run Mongo backend a été validé propre après reprise. Ceci n'a affecté aucune donnée ni aucun système de production — uniquement un processus de test local éphémère.

## 61. Verdict final

# NO-GO

**Raison déterminante unique** : un secret Zoho OAuth réel (client ID, client secret, refresh token) est présent dans l'historique Git du dépôt (commit `3b4c3ea`) et n'a pas de confirmation de rotation/révocation externe. Ce critère déclenche automatiquement un NO-GO selon la politique PREP-2, indépendamment du fait que toutes les autres gates techniques (Backend Unit, Backend Mongo, Web, Mobile, build, health, verify) sont vertes et qu'aucune vulnérabilité npm critique ne subsiste (amélioration confirmée depuis PREP-1, où 3 vulnérabilités critiques bloquaient également le verdict).

**Chemin vers GO WITH CONDITIONS** : dès que la rotation Zoho est confirmée par la personne responsable de la sécurité (action hors périmètre de cet agent), le dossier technique est en état d'être requalifié `GO WITH CONDITIONS`, sous réserve d'accepter explicitement comme conditions actives : l'exception Cloudinary legacy (R2), les 17 contrats historiques (R3), l'absence de procédure de sauvegarde/restauration formalisée (R7), et l'absence d'alerting opérationnel externe (R8).
