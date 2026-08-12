# PREP-2 — Runbook de production

Date de l'audit : 2026-08-12. Ce document est un runbook ; il n'autorise aucune écriture en base, aucun déploiement, aucune migration.

Ce runbook succède à `PREP_1_PRODUCTION_RUNBOOK.md` (2026-08-06, verdict NO-GO). Il ne le remplace pas : il le met à jour avec l'état réel du 2026-08-12. Se référer à PREP-1 pour le détail de l'inventaire de données de production en lecture seule (17 contrats, 8 Property, 34 locataires, etc.) — non ré-exécuté en PREP-2 (accès base de production hors périmètre, cf. section Sauvegardes/Restauration).

## Prérequis avant toute tentative de déploiement

1. **Rotation Zoho obligatoire** — révoquer/roter `ZOHO_CLIENT_ID` / `ZOHO_CLIENT_SECRET` / `ZOHO_REFRESH_TOKEN` exposés en historique Git (commit `3b4c3ea`, fichier `getZohoOrgId.js`). Voir Risk Register R1. Sans confirmation externe de cette rotation, ne pas déployer.
2. Purge ou réécriture d'historique Git à évaluer séparément par la personne responsable de la sécurité (hors périmètre PREP-2 — nécessite une décision produit/sécurité, pas une action automatique de l'agent).
3. Confirmer `DISABLE_SCHEDULED_JOBS=1` sur toute nouvelle instance avant bascule de trafic (cron à activer sur un seul worker désigné après validation, cf. PREP-1 section Cron).
4. Confirmer un snapshot MongoDB pris juste avant déploiement (aucune procédure de sauvegarde automatisée n'a été trouvée — cf. Risk Register R7).

## Variables d'environnement

Se référer à `PREP_1_PRODUCTION_RUNBOOK.md` section "Variables d'environnement" (toujours à jour, non modifiée en PREP-2). Aucune nouvelle variable obligatoire n'a été introduite depuis PREP-1.

## Ordre de déploiement

Identique à PREP-1 (Backend → Web → Mobile → Cron → Monitoring), avec l'ajout suivant :

### 0. Pré-déploiement — sécurité
- Confirmer rotation Zoho effectuée (prérequis 1 ci-dessus).
- Confirmer qu'aucun secret réel n'est présent dans le worktree actuel (vérifié PREP-2 : aucun secret versionné trouvé hors l'historique `getZohoOrgId.js`).

### 1. Backend
1. Geler les écritures administratives sensibles et prendre un snapshot MongoDB.
2. Installer avec `npm ci`, injecter les secrets (post-rotation), conserver `DISABLE_SCHEDULED_JOBS=1` sur toutes les nouvelles instances.
3. Déployer une instance canari, vérifier `/api/health`, authentification/RBAC, MongoDB, Socket.IO, stockage, paiement et email.
4. Basculer le trafic après smoke tests. Ne conserver les cron actifs que sur **une seule** instance désignée (aucun verrou de chevauchement cron n'existe au niveau applicatif — cf. Risk Register R5 — la contrainte "une seule instance" est donc la seule protection réelle contre l'exécution concurrente).

### 2. Web
Construire avec les URL du backend validé (`npm run build:next` — vérifié PASS en PREP-2, 142 routes), déployer en preview, tester login, dashboards, navigation NAV-CORE, documents et paiements, puis promouvoir sans changer le backend.

### 3. Mobile
Produire un AAB avec le profil EAS `production` (Expo SDK ~57, migration depuis SDK 52 confirmée effectuée depuis PREP-1 — `expo-doctor` 20/20, aucune dérive de dépendance détectée). Vérifier API/socket/deep links, signer et diffuser progressivement.

### 4. Cron
Inchangé depuis PREP-1 : activer sur un worker unique. Absence confirmée de garde de chevauchement au niveau du scheduler (`server.js`) — surveiller manuellement la durée d'exécution des jobs IMAP/IA/hôtel/immobilier lors de la mise en production initiale.

### 5. Monitoring
Inchangé depuis PREP-1. Aucune alerte opérationnelle externe (Sentry backend, alerting 5xx, échecs cron) n'a été trouvée configurée au-delà de ce qui est documenté — cf. Risk Register R8.

## Rollback

Identique à PREP-1 (section "Rollback contrôlé") — non modifié, toujours valide :
- Déclencheurs : hausse 5xx, auth/RBAC dégradé, écriture financière incohérente, cron dupliqué, index en erreur, crash Web/Mobile.
- Couper d'abord les cron (`DISABLE_SCHEDULED_JOBS=1`) et les écritures sensibles.
- Web : repromouvoir l'artefact précédent. Backend : redéployer l'image précédente. Mobile : stopper le rollout ; OTA seulement si compatible `runtimeVersion`.
- Base : ne restaurer un snapshot qu'après décision d'incident (écrase les écritures postérieures).
- Aucune procédure concrète de `mongorestore` ni de récupération d'assets Cloudinary n'a été documentée avec des commandes exactes — dette non résolue depuis PREP-1 (Risk Register R7).

## Smoke tests post-déploiement (à exécuter manuellement, non automatisés dans ce dépôt)

- [ ] `GET /api/health` répond 200
- [ ] Login web + mobile fonctionnel (voir note RCA Playwright ci-dessous sur la latence de première compilation Next.js — non pertinente en production où le build est déjà compilé)
- [ ] Dashboard admin accessible, RBAC correct (Admin vs Collaborateur vs Client)
- [ ] Upload document/image fonctionne (Cloudinary nouveaux assets)
- [ ] Paiement test (sandbox CinetPay/Yabetoo si disponible) déclenche bien le webhook signé
- [ ] Email transactionnel (Zoho) part correctement après rotation des credentials
- [ ] Socket.IO se connecte et respecte l'isolation tenant

## Seuils d'arrêt (stop-the-line)

- Toute erreur 5xx en hausse soutenue après bascule de trafic.
- Toute preuve de fuite cross-tenant (accès à des données d'un autre tenant).
- Tout échec de vérification de signature webhook (paiement).
- Toute anomalie sur les 17 contrats historiques non réconciliés (aucune écriture automatique ne doit jamais leur être appliquée).

## Checklist GO-LIVE

- [x] Backend Unit vert (1265/1265)
- [x] Backend Mongo vert (720/720)
- [x] Web Vitest vert (513/513 après rerun propre — un test flaky identifié, non bloquant)
- [x] Mobile Jest vert (227/227)
- [x] Expo Doctor vert (20/20)
- [ ] Playwright 34/34 strict — **32/34 brut**, RCA = flakiness d'environnement (non-régression applicative), non requalifié en 34/34 par principe PREP-2
- [ ] Secrets vérifiés — **bloquant** : rotation Zoho externe non confirmée
- [ ] Backup confirmé — non documenté avec procédure concrète
- [ ] Rollback prêt — procédure documentée mais jamais testée en conditions réelles
- [x] Monitoring de base présent (logs, Sentry mobile) — alerting actif non confirmé
- [x] Cloudinary legacy risk accepté (exception documentée et stable depuis plusieurs sprints)
- [x] 17 contrats historiques acceptés comme dette opérationnelle (traitement dossier par dossier existant)
- [~] Dépendances critiques traitées — 0 vulnérabilité critique (amélioration depuis PREP-1 où 3 critiques existaient), vulnérabilités hautes restantes toutes à correctif majeur uniquement, non exploitables en l'état constaté

## Fichiers PREP-2

Créés : `server/docs/PREP_2_PRODUCTION_RUNBOOK.md`, `server/docs/PREP_2_REPORT.md`.
Aucun autre fichier modifié par PREP-2 (audit en lecture seule ; le fichier `getZohoOrgId.js` avait déjà été remedié par une session PREP-2 antérieure interrompue, non par celle-ci).
