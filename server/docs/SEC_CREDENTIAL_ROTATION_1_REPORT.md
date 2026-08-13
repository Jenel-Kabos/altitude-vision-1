# SEC-CREDENTIAL-ROTATION-1 — Rapport de préparation

Date : 2026-08-12
Dépôt : `/Users/apple/Documents/GitHub/altitude-vision-1`
Documents associés : `SEC_CREDENTIAL_ROTATION_1_INVENTORY.md`, `SEC_CREDENTIAL_ROTATION_1_RUNBOOK.md`

---

# PHASE 2 — Vérification post-rotation (2026-08-12, même date, session distincte)

## Phase 2 — 1. Executive Summary

**Aucune rotation n'a été effectuée depuis la Phase 1.** La comparaison de fingerprints SHA-256 (tronqués, non réversibles, aucune valeur affichée) entre les valeurs historiquement exposées dans Git et les valeurs actuellement configurées dans les fichiers `.env` locaux montre **SAME sur les 10 credentials à rotation obligatoire** identifiés en Phase 1 : `ZOHO_CLIENT_ID`, `ZOHO_CLIENT_SECRET`, `ZOHO_REFRESH_TOKEN`, `ZOHO_ACCOUNT_ID`, `JWT_SECRET`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`, `FACEBOOK_ACCESS_TOKEN`, `CINETPAY_API_KEY`, `CINETPAY_SITE_ID`, `GOOGLE_MAPS_API_KEY`. Seul `MONGO_URI`, déjà documenté comme changé avant la Phase 1, reste `DIFFERENT`.

Conformément à la section 43 de la mission Phase 2 : puisqu'aucune rotation n'a été effectuée, la vérification s'arrête ici. Aucune suite de tests (Backend Unit/Mongo, Web, Mobile, Playwright, npm audit) n'a été relancée, conformément à l'instruction explicite de ne pas relancer les grandes suites tant que les rotations n'ont pas eu lieu.

## Phase 2 — 2. Phase 1 Baseline

Relue intégralement : `SEC_CREDENTIAL_ROTATION_1_INVENTORY.md`, `SEC_CREDENTIAL_ROTATION_1_RUNBOOK.md`, la section Phase 1 de ce même rapport, et `PREP_2_RECHECK_REPORT.md`. Aucune divergence trouvée entre la cartographie Phase 1 et l'état réel du dépôt — la cartographie des consommateurs runtime reste valide et n'a pas été refaite.

## Phase 2 — 3. Human Rotation Confirmation

**Aucune confirmation de rotation reçue, et la vérification technique la contredit directement.** Les fingerprints sont strictement identiques à ceux mesurés en Phase 1 et lors de PREP-2-RECHECK.

## Phase 2 — 4. Worktree State

`git status` : working tree propre, seuls les 4 fichiers de documentation SEC-CREDENTIAL-ROTATION-1 (dont ce rapport) et `PREP_2_RECHECK_REPORT.md` apparaissent en non suivi — aucune autre modification. `git diff --stat` : vide. `git diff --check` : exit 0.

## Phase 2 — 5. Fingerprint Comparison (méthode)

Extraction des valeurs depuis `git show 2400fa1^:.env` et `git show 2400fa1^:altimmo-app/.env` (dernières versions trackées avant retrait), comparées aux fichiers `.env` / `server/.env` / `altimmo-app/.env` actuellement présents sur disque (non trackés par Git, vérifié via `git ls-files`). SHA-256 tronqué à 10 caractères hexadécimaux calculé localement pour chaque valeur, jamais affiché en clair, jamais journalisé.

## Phase 2 — 6. Credential Matrix

| Credential | Old found | Current configured | OLD vs CURRENT | Revocation proof | Runtime config | Verdict |
|---|---|---|---|---|---|---|
| `ZOHO_CLIENT_ID` | Oui | Oui | SAME | Non applicable (rotation non faite) | `process.env` uniquement, aucun fallback | NOT ROTATED |
| `ZOHO_CLIENT_SECRET` | Oui | Oui | SAME | REVOCATION NOT TECHNICALLY VERIFIED | `process.env` uniquement | NOT ROTATED |
| `ZOHO_REFRESH_TOKEN` | Oui | Oui | SAME | REVOCATION NOT TECHNICALLY VERIFIED | `process.env` uniquement | NOT ROTATED |
| `ZOHO_ACCOUNT_ID` | Oui | Oui | SAME | Non applicable (identifiant, pas un secret rotatable seul) | `process.env` uniquement | UNCHANGED (attendu tant que l'app Zoho n'est pas recréée) |
| `JWT_SECRET` | Oui | Oui | SAME | Non applicable | `process.env` uniquement, aucun fallback détecté | NOT ROTATED |
| `CLOUDINARY_API_KEY` | Oui | Oui | SAME | REVOCATION NOT TECHNICALLY VERIFIED | `process.env` uniquement | NOT ROTATED |
| `CLOUDINARY_API_SECRET` | Oui | Oui | SAME | REVOCATION NOT TECHNICALLY VERIFIED | `process.env` uniquement | NOT ROTATED |
| `CLOUDINARY_CLOUD_NAME` | Oui | Oui | SAME (attendu — non secret) | Non applicable | `process.env` + `NEXT_PUBLIC_*`/public mobile | NOT APPLICABLE (jamais à roter) |
| `FACEBOOK_ACCESS_TOKEN` | Oui | Oui | SAME | REVOCATION NOT TECHNICALLY VERIFIED | `process.env` uniquement | NOT ROTATED |
| `CINETPAY_API_KEY` | Oui | Oui | SAME | REVOCATION NOT TECHNICALLY VERIFIED | `process.env` uniquement | NOT ROTATED |
| `CINETPAY_SITE_ID` | Oui | Oui | SAME | Non applicable (identifiant de compte marchand, statut rotatable non confirmé par CinetPay) | `process.env` uniquement | UNCHANGED |
| `GOOGLE_MAPS_API_KEY` | Oui | Oui | SAME | REVOCATION NOT TECHNICALLY VERIFIED | Configuration native `app.config.js`, pas encore modifiée | NOT ROTATED |
| `MONGO_URI` | Oui | Oui | **DIFFERENT** | REVOCATION NOT TECHNICALLY VERIFIED (ancien utilisateur Atlas non confirmé désactivé) | `process.env` uniquement | ROTATED (valeur), révocation non confirmée |
| `ACCESS_TOKEN` (générique) | Oui | Oui | SAME | Non applicable | **Aucun consommateur runtime** (reconfirmé, voir section 14) | DEAD / UNUSED — non bloquant |

## Phase 2 — 7. Zoho

`ZOHO_CLIENT_ID`, `ZOHO_CLIENT_SECRET`, `ZOHO_REFRESH_TOKEN` : tous les trois **SAME**. Aucune rotation, même partielle (le client secret et le refresh token — les deux éléments réellement secrets du flux OAuth — restent identiques à ceux exposés dans l'historique Git). Aucun test de révocation de l'ancien refresh token n'a été tenté : la mission interdit d'improviser un tel test, et puisque l'ancien et le "nouveau" sont identiques, un test de révocation testerait en réalité le secret de production actif — sans valeur probante et hors périmètre sûr.

## Phase 2 — 8. JWT

`JWT_SECRET` : **SAME**. Vérification du code (`server/utils/generateToken.js`, `server/middleware/authMiddleware.js`) : aucun fallback vers une ancienne valeur, aucun secret par défaut codé en dur — la configuration reste correcte en soi, mais la valeur active n'a pas changé. **Aucun test de régression JWT (ancien token rejeté / nouveau accepté) n'a été ajouté ou exécuté** : un tel test n'aurait de sens qu'après une rotation réelle, puisqu'"ancien" et "actuel" désignent aujourd'hui la même valeur — le test serait trivialement non concluant.

## Phase 2 — 9. Cloudinary

`CLOUDINARY_API_KEY` et `CLOUDINARY_API_SECRET` : **SAME**. `CLOUDINARY_CLOUD_NAME` : SAME comme attendu (non secret, ne doit pas changer). Aucun appel réseau vers le compte `dop8vzm5z` n'a été effectué, conformément à l'interdiction absolue.

## Phase 2 — 10. Facebook

`FACEBOOK_ACCESS_TOKEN` : **SAME**. Aucune publication, aucune lecture Graph API supplémentaire déclenchée pour cette vérification.

## Phase 2 — 11. CinetPay

`CINETPAY_API_KEY` : **SAME**. `CINETPAY_SITE_ID` : SAME — conformément à la Phase 1, ce champ est traité comme un identifiant de compte marchand potentiellement non rotatable indépendamment, pas comme un blocage supplémentaire, mais la clé API elle-même (secret) reste non rotée. Aucune transaction, aucun remboursement.

## Phase 2 — 12. Google Maps

`GOOGLE_MAPS_API_KEY` : **SAME**. Configuration `altimmo-app/app.config.js` non modifiée depuis la Phase 1. Puisque la clé n'a pas changé, la question d'un rebuild EAS ne se pose pas encore — **MOBILE REBUILD REQUIRED** restera applicable une fois (et seulement une fois) la clé effectivement rotée côté Google Cloud Console.

## Phase 2 — 13. MongoDB

`MONGO_URI` : confirmé **DIFFERENT**, inchangé par rapport à l'état déjà documenté en PREP-2-RECHECK et Phase 1 — pas un nouveau changement de cette vérification. Révocation de l'ancien utilisateur Atlas : **NOT TECHNICALLY VERIFIED**, aucune connexion Atlas établie, aucune confirmation humaine reçue à ce jour.

## Phase 2 — 14. Generic ACCESS_TOKEN

Reconfirmé par `grep -rn "process.env.ACCESS_TOKEN\b"` sur l'ensemble du dépôt (hors `node_modules`) : **0 résultat**. Statut inchangé depuis la Phase 1 : **DEAD / UNUSED**. Aucune origine inventée.

## Phase 2 — 15. Current Secret Scan

Non refait en profondeur dans cette passe (déjà réalisé en Phase 1 et re-scanné en PREP-2-RECHECK, aucune modification de fichier tracké depuis) — reconfirmé uniquement via `git status`/`git diff --stat` : aucun nouveau fichier suivi n'a été ajouté ou modifié qui pourrait introduire un secret. **NO ACTIVE SECRET IN TRACKED FILES** (statut inchangé).

## Phase 2 — 16. Git Tracking

`git ls-files` : `.env`, `server/.env`, `client/.env`, `altimmo-app/.env` toujours absents du suivi. `.gitignore` inchangé et toujours correct. Statut inchangé depuis la Phase 1.

## Phase 2 — 17. Rotation Evidence

**Aucune** — 10/10 credentials à rotation obligatoire retournent `SAME`. Seul `MONGO_URI` (non concerné par une nouvelle rotation dans cette vérification) est `DIFFERENT`.

## Phase 2 — 18. Revocation Evidence

Sans objet pour les credentials `SAME` — il n'existe pas d'« ancien » distinct du « nouveau » à révoquer, puisque rien n'a été remplacé. Pour `MONGO_URI` : `REVOCATION NOT TECHNICALLY VERIFIED`.

## Phase 2 — 19. Runtime Configuration

Le code applicatif reste correctement configuré pour lire exclusivement `process.env.*` sans fallback vers des valeurs par défaut ou codées en dur, pour l'ensemble des credentials audités (reconfirmé par grep ciblé sur les fichiers consommateurs identifiés en Phase 1). Ce point est indépendant de l'état de rotation et reste correct.

## Phase 2 — 20 à 28. Backend Unit / Backend Mongo / Tenant Security / Web / Mobile / Expo / NPM Audit / Health-Verify / Playwright

**NOT RUN — conformément à la section 43 de la mission Phase 2** : aucune rotation n'ayant eu lieu, la certification s'arrête immédiatement sans relancer les grandes suites de tests. Relancer ces gates n'aurait aucune valeur probante supplémentaire tant que le blocage de sécurité fondamental (credentials non rotés) n'est pas levé, et consommerait un temps d'exécution significatif sans pouvoir faire progresser le verdict.

## Phase 2 — 29. Remaining Security Risks

Identiques à ceux de la Phase 1 et de PREP-2-RECHECK, sans aucune amélioration mesurée : les 10 credentials listés en section 6 restent activement exploitables avec leur valeur historiquement exposée.

## Phase 2 — 30. Git History Risk

Inchangé. Aucune réécriture d'historique effectuée. `GIT-HISTORY-SANITIZE-1` reste une recommandation future, non exécutée, à envisager seulement après rotation effective.

## Phase 2 — 31. Cloudinary Legacy Exception

Inchangée et non affectée par cette vérification — reste un risque distinct, accepté, indépendant du blocage de rotation de credentials.

## Phase 2 — 32. Tests Actually Executed

`git status`, `git diff --stat`, `git diff --check`, extraction de noms de variables et calcul de 14 fingerprints SHA-256 tronqués (OLD vs CURRENT, sans affichage de valeur), `git ls-files` pour confirmer le non-suivi des `.env`, grep de reconfirmation sur `ACCESS_TOKEN` et sur les patterns de fallback JWT/Zoho.

## Phase 2 — 33. Commands Not Executed

Backend Unit, Backend Mongo, suites tenant, Web Vitest, ESLint (serveur/client/mobile), Next build, Mobile Jest, TypeScript, Expo Doctor, `npm audit` (server/client/mobile), `npm run health`, `npm run verify`, Playwright — **NOT RUN, raison : aucune rotation confirmée, arrêt immédiat conformément à la section 43 de la mission.**

## Phase 2 — 34. Files Created

Aucun nouveau fichier — mise à jour de `SEC_CREDENTIAL_ROTATION_1_REPORT.md` uniquement (ajout de la section Phase 2).

## Phase 2 — 35. Files Modified

- `server/docs/SEC_CREDENTIAL_ROTATION_1_REPORT.md` (ajout de la section Phase 2 ci-dessus, contenu Phase 1 préservé intégralement).

## Phase 2 — 36. Recommendation for PREP-2-RECHECK

Ne pas relancer PREP-2-RECHECK. La séquence documentée (`SEC-CREDENTIAL-ROTATION-1 → ROTATION VERIFIED → PREP-2-RECHECK → verdict → OPS-READY-1 → PROD-1`) reste bloquée à sa toute première étape. L'opérateur humain doit exécuter les actions listées dans `SEC_CREDENTIAL_ROTATION_1_RUNBOOK.md` (Zoho, Facebook, CinetPay, Cloudinary, Google Maps, confirmation de révocation MongoDB Atlas, puis JWT_SECRET en dernier) avant qu'une nouvelle vérification Phase 2 puisse progresser.

## Phase 2 — 37. Explicit Confirmations

- Aucun commit effectué.
- Aucun push effectué.
- Aucun déploiement effectué.
- Aucune migration destructive exécutée.
- Aucun backfill exécuté.
- Aucune suppression de données.
- Aucune écriture MongoDB de production.
- Aucun email utilisateur réel envoyé.
- Aucun paiement réel effectué.
- Aucune publication Facebook réelle.
- Aucun appel volontaire à Cloudinary de production (`dop8vzm5z`).
- Aucun asset Cloudinary modifié.
- Aucun secret affiché à aucun moment.
- Aucun secret écrit dans ce rapport ou tout autre document.
- Aucun historique Git réécrit.
- Aucun résultat de test inventé — les gates fonctionnelles sont explicitement marquées NOT RUN avec leur raison (section 20-28, 33), conformément à l'arrêt immédiat prescrit par la mission.

## Phase 2 — 38. Final Verdict

# READY FOR HUMAN CREDENTIAL ROTATION — WAITING FOR PROVIDER ACTIONS

Aucune rotation n'a été effectuée depuis la Phase 1. Les 10 credentials à rotation obligatoire (`ZOHO_CLIENT_ID`, `ZOHO_CLIENT_SECRET`, `ZOHO_REFRESH_TOKEN`, `JWT_SECRET`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`, `FACEBOOK_ACCESS_TOKEN`, `CINETPAY_API_KEY`, `CINETPAY_SITE_ID`, `GOOGLE_MAPS_API_KEY`) retournent tous `SAME` entre la valeur historiquement exposée dans Git et la valeur actuellement configurée. Seul `MONGO_URI`, déjà documenté comme changé avant même la Phase 1, est `DIFFERENT` — mais la révocation de l'ancien utilisateur Atlas reste non confirmée.

**Aucune suite de tests n'a été relancée** (Backend Unit/Mongo, Web, Mobile, Playwright, npm audit), conformément à l'instruction explicite de la mission de ne pas relancer les grandes campagnes tant que les rotations n'ont pas eu lieu.

**Prochaine étape : exécuter les actions du runbook `SEC_CREDENTIAL_ROTATION_1_RUNBOOK.md` côté fournisseurs (Zoho, Facebook, CinetPay, Cloudinary, Google Maps), confirmer la révocation de l'ancien utilisateur MongoDB Atlas, traiter `JWT_SECRET` en dernier dans une fenêtre annoncée, puis redemander une vérification Phase 2.**

---

## 1. Executive Summary

Ce sprint prépare, sans l'exécuter, la rotation de 9 credentials confirmés exposés dans l'historique Git (~5,5 mois, 2026-02-03 → 2026-07-17) et dont la valeur actuelle est cryptographiquement identique à la valeur exposée (confirmé par PREP-2-RECHECK, revérifié ici) : `ZOHO_CLIENT_ID`, `ZOHO_CLIENT_SECRET`, `ZOHO_REFRESH_TOKEN`, `JWT_SECRET`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`, `FACEBOOK_ACCESS_TOKEN`, `CINETPAY_API_KEY`, `CINETPAY_SITE_ID`, `GOOGLE_MAPS_API_KEY`. `MONGO_URI` a déjà été changé (fingerprint `DIFFERENT`) mais la révocation de l'ancien utilisateur Atlas n'est pas vérifiable depuis cet environnement.

Un inventaire complet des consommateurs runtime, une classification par catégorie, une matrice de services, et un runbook détaillé provider par provider (préparation, action humaine, mise à jour env, redémarrage, validation, rollback) ont été produits. Aucune rotation n'a été effectuée par cette session — c'est une action humaine, hors périmètre de Claude Code.

Recherche élargie effectuée pour d'autres secrets historiquement exposés au-delà de la liste connue de PREP-2-RECHECK : aucun nouveau fichier de secrets trouvé dans l'historique Git (seuls `.env` racine et `altimmo-app/.env` étaient trackés). `GOOGLE_CLIENT_SECRET`/`GOOGLE_CLIENT_ID` (NextAuth) et `client/.env` confirmés jamais exposés.

## 2. Historical Exposure

Voir `SEC_CREDENTIAL_ROTATION_1_INVENTORY.md` section méthode. Confirmé : `.env` (racine) tracké du commit `2b25924` (2026-02-03) au commit `2400fa1` (2026-07-17), `altimmo-app/.env` tracké jusqu'au même commit de nettoyage. `getZohoOrgId.js` (commit `3b4c3ea`) contenait en plus une copie en dur des trois credentials OAuth Zoho.

## 3. Credentials Inventory

Voir `SEC_CREDENTIAL_ROTATION_1_INVENTORY.md` — table complète avec provider, exposition historique, fingerprint actuel (SAME/DIFFERENT), consommateurs runtime, nécessité de rotation, impact.

## 4. Current Runtime Consumers

Cartographie complète effectuée par recherche de code (`grep` ciblé, pas de supposition de noms) :

- **Zoho** : `getZohoTokenManual.js`, `getZohoOrgId.js`, `server/config/email.js`, `server/services/zohoMailService.js`.
- **JWT** : `server/socket.js`, `server/middleware/authMiddleware.js`, `server/utils/generateToken.js`, `server/controllers/authController.js`, `scripts/health.js` (présence seulement, jamais la valeur), `server/scripts/start-accommodation-e2e.js`, `server/scripts/verifyAltcomSetup.js`.
- **Cloudinary** : `server/config/cloudinary.js` (secret), `server/config/cloudinaryProductionFingerprint.js`, `client/lib/services/publiciteService.js` et `altimmo-app/src/services/annonceService.js` (cloud_name public uniquement, jamais le secret côté client/mobile).
- **Facebook** : `server/scripts/sync-facebook.js` uniquement (cron horaire).
- **CinetPay** : `server/controllers/cinetpayController.js`, `server/controllers/paiementTransactionController.js`.
- **Google Maps** : `altimmo-app/app.config.js` (injection native au build EAS, pas runtime JS).
- **MongoDB** : `server/config/db.js` et l'ensemble du backend (24 fichiers référencent `MONGO_URI`, majoritairement des tests utilisant `mongodb-memory-server`).

Aucune configuration CI/Netlify/Render trouvée dans le dépôt contenant un secret en clair (`netlify.toml` et `altimmo-app/eas.json` vérifiés — uniquement des URLs et des noms de variables, jamais de valeur).

## 5. Rotation Strategy

Ordre recommandé confirmé pertinent après audit des dépendances : préparation → Zoho → Facebook → CinetPay → Cloudinary → Google Maps (nécessite rebuild EAS, à traiter séparément du reste) → MongoDB (déjà fait, vérification de révocation restante) → **JWT_SECRET en dernier**, dans une fenêtre annoncée, car c'est le seul changement à impact utilisateur immédiat (déconnexion globale par design — aucun mécanisme de compatibilité ancien/nouveau secret ne doit être introduit).

## 6. Zoho

Procédure complète en section A du runbook. Point clé : le mécanisme utilisé est un flux OAuth `refresh_token` standard (`accounts.zoho.com/oauth/v2`) — régénérer le client secret et regénérer un nouveau refresh token via un nouveau flux d'autorisation. Le Client ID n'a pas besoin d'être changé sauf si la console Zoho impose une recréation d'application pour régénérer le secret (à déterminer sur place par l'opérateur, non vérifiable depuis ce dépôt).

## 7. JWT

Traité séparément conformément à la mission (section B du runbook). Mécanisme confirmé : signature HS256 via `jsonwebtoken`, expiration par défaut 90 jours, `tokenVersion` en base pour invalidation individuelle (indépendant de la rotation de secret). **Une rotation de `JWT_SECRET` invalide globalement tous les tokens existants, Web et Mobile — c'est le comportement attendu et à ne pas contourner.** Procédure `JWT ROTATION WINDOW` documentée en 8 étapes (annonce → génération → mise à jour env → redémarrage → validation ancien rejeté/nouveau accepté → vérification Web → vérification Mobile → vérification Socket.IO).

## 8. Cloudinary

Distinction confirmée entre `CLOUDINARY_CLOUD_NAME` (identifiant public, ne pas changer) et `CLOUDINARY_API_KEY`/`CLOUDINARY_API_SECRET` (secrets serveur uniquement, rotation obligatoire). Compte `dop8vzm5z` identifié comme le compte de production connu du projet — aucune opération d'asset n'a été ni ne sera effectuée par cette session, avant ou après une éventuelle rotation.

## 9. Facebook

Type exact de token non déterminable depuis le code seul (`server/scripts/sync-facebook.js` consomme le token pour l'API Graph en lecture, cron horaire) — à vérifier par l'opérateur dans Meta for Developers. Procédure de remplacement documentée sans supposition sur le type de token.

## 10. CinetPay

Traité comme credential financier critique. `CINETPAY_API_KEY` : rotation obligatoire. `CINETPAY_SITE_ID` : documenté comme potentiellement non rotatable indépendamment (identifiant de compte marchand) — à confirmer avec le support CinetPay plutôt que d'exiger arbitrairement son changement. Aucune transaction réelle envisagée à aucune étape.

## 11. Google

`GOOGLE_MAPS_API_KEY` : injection native au build EAS (`altimmo-app/app.config.js`), donc une rotation nécessite un rebuild + republication mobile, pas un simple redémarrage — documenté explicitement comme cas différent des autres secrets serveur. Restrictions fournisseur (package/SHA Android) recommandées mais non supposées déjà en place. `GOOGLE_CLIENT_SECRET`/`GOOGLE_CLIENT_ID` (NextAuth, backend web) : confirmés **jamais exposés** dans l'historique Git audité — aucune action requise pour ceux-ci dans ce sprint.

## 12. MongoDB

`MONGO_URI` déjà changé (fingerprint `DIFFERENT`, confirmé par PREP-2-RECHECK et revérifié). Point restant, non vérifiable depuis cet environnement (aucune connexion Atlas établie, conformément à l'interdiction de connexion automatique à une base de production) : confirmer humainement que l'ancien utilisateur de base de données associé à l'ancienne URI est bien désactivé/supprimé côté Atlas, pas seulement remplacé en parallèle par un nouvel utilisateur actif simultanément.

## 13. Other Credentials

`ACCESS_TOKEN` (générique, root `.env` historique) : confirmé exposé (fingerprint SAME) mais **aucun consommateur trouvé dans le code actuel** — variable morte. Documentée par prudence dans l'inventaire, recommandation de rotation si le fournisseur associé peut être identifié par l'opérateur (le nom générique ne permet pas de le déterminer depuis le code), sinon à traiter comme dette d'hygiène plutôt que comme blocage actif.

`DB_NAME`, `UPLOAD_PATH`, `MAX_FILE_SIZE`, `COMPANY_*`, `EMAIL_HOST`/`EMAIL_PASSWORD`/`EMAIL_USERNAME`/`EMAIL_PORT`/`EMAIL_FROM` (ancien SMTP legacy) : exposés historiquement mais non-secrets ou déjà remplacés architecturalement par l'intégration Zoho actuelle — aucun consommateur actuel trouvé pour la branche SMTP legacy.

## 14. Git Tracking

`.env` (racine), `server/.env`, `client/.env`, `altimmo-app/.env` : confirmés **non trackés** à HEAD (`git ls-files`). `.gitignore` couvre correctement `.env`/`.env.*` avec exceptions `*.env.example`, à la racine et dans chaque sous-dossier concerné. Ceci protège les futurs commits, pas les commits historiques déjà réalisés — rappel documenté, pas une garantie rétroactive.

## 15. Environment Files

`.env.example`, `client/.env.example`, `altimmo-app/.env.example` : vérifiés, uniquement des placeholders vides ou de la documentation en commentaire, aucun credential réel.

## 16. Rotation Evidence

**Aucune rotation effectuée par cette session.** Les fingerprints actuels restent identiques à ceux documentés par PREP-2-RECHECK pour les 9 credentials listés en section 1 (revérifiés par le même mécanisme de comparaison SHA-256 tronquée, sans affichage de valeur, lors de la construction de l'inventaire). Seuls `MONGO_URI`, `ZOHO_IMAP_PASSWORD` et `ZOHO_FROM_EMAIL` sont `DIFFERENT`.

## 17. Revocation Evidence

**REVOCATION NOT TECHNICALLY VERIFIED** pour l'ensemble des credentials non encore rotés, puisqu'aucune rotation n'a eu lieu. Pour `MONGO_URI` (déjà changé) : révocation de l'ancien utilisateur Atlas **non vérifiée** — nécessite une confirmation humaine dans la console Atlas, non accessible depuis cet environnement.

## 18. Secret Scan

Reconfirmé lors de la construction de l'inventaire : aucun secret réel actuellement versionné dans les fichiers trackés par Git (scripts, config, tests, docs, `.env.example` tous vérifiés SAFE). Le problème reste exclusivement la non-rotation des valeurs, pas une fuite de code courant.

## 19. Tests

Aucun test de gate (Backend Unit/Mongo, Web, Mobile, Playwright) exécuté dans ce sprint — hors périmètre : la mission prévoit ces tests **après** rotation humaine confirmée (section 24 de la mission), pas avant. Seules des vérifications en lecture (historique Git, présence de fichiers, fingerprints, grep de code) ont été effectuées.

## 20. Remaining Risks

- Les 9 credentials listés restent activement exploitables tant que la rotation humaine n'a pas eu lieu.
- `ACCESS_TOKEN` générique non identifié — fournisseur inconnu, à clarifier par l'opérateur humain qui a le contexte historique du projet.
- Révocation de l'ancien utilisateur MongoDB Atlas non confirmée.
- L'historique Git contient toujours ces valeurs en clair (hors périmètre de purge dans ce sprint) — devient une dette d'hygiène plutôt qu'un risque actif seulement après rotation effective de chaque credential.

## 21. Git History Risk

Aucune réécriture d'historique effectuée ni recommandée dans l'immédiat. Une fois toutes les rotations confirmées, une opération séparée `GIT-HISTORY-SANITIZE-1` reste recommandée pour l'hygiène du dépôt (BFG ou `git filter-repo`, à préparer et exécuter dans un sprint dédié avec ses propres garde-fous, hors périmètre ici).

## 22. Recommendation

Ne pas relancer PREP-2-RECHECK avant que l'opérateur humain ait confirmé avoir exécuté les actions du runbook (`SEC_CREDENTIAL_ROTATION_1_RUNBOOK.md`) pour l'ensemble des 9 credentials à rotation obligatoire, plus la confirmation de révocation de l'ancien utilisateur MongoDB Atlas. Une fois cette confirmation reçue, reprendre SEC-CREDENTIAL-ROTATION-1 en phase de vérification (comparaison de fingerprints attendant `DIFFERENT` partout), puis PREP-2-RECHECK pour la revalidation complète des gates.

## 23. Files Created

- `server/docs/SEC_CREDENTIAL_ROTATION_1_INVENTORY.md`
- `server/docs/SEC_CREDENTIAL_ROTATION_1_RUNBOOK.md`
- `server/docs/SEC_CREDENTIAL_ROTATION_1_REPORT.md` (ce document)

## 24. Files Modified

Aucun. Session strictement en préparation/lecture — aucune valeur de credential, code applicatif, ou configuration n'a été modifiée.

## 25. Explicit Confirmations

- Aucun commit effectué.
- Aucun push effectué.
- Aucun déploiement effectué.
- Aucune migration exécutée.
- Aucun backfill exécuté.
- Aucune suppression de données.
- Aucun secret affiché — uniquement des noms de variables et des verdicts SAME/DIFFERENT déjà établis par PREP-2-RECHECK, revérifiés sans affichage de valeur.
- Aucun paiement réel.
- Aucun email utilisateur réel.
- Aucune publication Facebook.
- Aucun appel volontaire à Cloudinary de production (`dop8vzm5z`).
- Aucun asset Cloudinary modifié.
- Aucun historique Git réécrit.
- Aucune rotation de credential effectuée par cette session — toutes les actions listées dans le runbook sont à la charge exclusive de l'opérateur humain.

## Verdict

# READY FOR HUMAN CREDENTIAL ROTATION

## Checklist exacte pour l'opérateur humain

- [ ] **Zoho** : régénérer client secret + refresh token (voir runbook section A)
- [ ] **Facebook** : régénérer l'access token (voir runbook section D)
- [ ] **CinetPay** : contacter le support pour régénérer l'API key, clarifier le statut du Site ID (voir runbook section E)
- [ ] **Cloudinary** : régénérer l'API secret (et si possible l'API key) du compte `dop8vzm5z` (voir runbook section C)
- [ ] **Google Maps** : régénérer la clé, appliquer les restrictions package/SHA, planifier un rebuild EAS (voir runbook section F)
- [ ] **MongoDB Atlas** : confirmer la désactivation/suppression de l'ancien utilisateur associé à l'ancienne `MONGO_URI` (voir runbook section G)
- [ ] **JWT_SECRET** : générer une nouvelle valeur, planifier la fenêtre de rotation annoncée (voir runbook section B) — à faire en dernier
- [ ] Mettre à jour l'ensemble des nouvelles valeurs dans le coffre Render (et EAS pour Google Maps)
- [ ] Confirmer à l'agent que toutes les rotations ci-dessus sont terminées pour permettre la reprise de SEC-CREDENTIAL-ROTATION-1 (vérification des fingerprints) puis de PREP-2-RECHECK

**La certification ne reprend qu'après confirmation explicite de l'utilisateur.**
