# F-U2.14 — Rapport de récupération après extinction brutale

Date : 2026-10-15 (heure locale UTC+1). Rédigé **avant** toute reprise des corrections.

Cause de l'interruption : extinction de l'ordinateur (batterie déchargée). Redémarrage système : 2026-10-15 10:53.

## A. État Git retrouvé

| Élément | Valeur |
|---|---|
| Dépôt | `/Users/apple/Documents/GitHub/altitude-vision-1` |
| Branche | `main` |
| HEAD | `5a54a135b61b30de9b8d298f2cdc2ae282eec330` (`5a54a13`, inchangé) |
| Fichiers suivis modifiés | 228 (3 578 insertions, 1 193 suppressions) |
| Fichiers non suivis | 199 (~1,9 Mo) |
| Modifications indexées | 0 |
| Conflits (unmerged) | 0 |
| Verrous Git (`*.lock`) | aucun |
| `git diff --check` | propre (seul avertissement : fins de ligne CRLF de `server/models/Conversation.js`, préexistant) |
| Worktrees | principal + 2 worktrees d'agents `.claude/worktrees/agent-a29222de622cdcebd` (`eba833d`) et `agent-a5353e85e3dc3bc4a` (`e61fd23`), ignorés par `.gitignore`, antérieurs à F-U2.14, conservés tels quels |

### Sauvegarde

Emplacement (hors dépôt, droits `700`) : `~/altitude-vision-backups/F-U2.14-recovery-20261015-111526/`

| Fichier | Contenu |
|---|---|
| `tracked-unstaged.patch` | `git diff --binary` complet (vérifié : `git apply --check` réussit sur un export de HEAD) |
| `staged.patch` | vide (aucune modification indexée) |
| `untracked-files.txt` / `untracked-files.tar.gz` | inventaire et archive des 199 fichiers non suivis (chemins et permissions conservés, 199 entrées vérifiées) |
| `tracked-modified-files-snapshot.tar.gz` | copie intégrale des 228 fichiers suivis modifiés |
| `tracked-name-status.txt`, `git-state.txt` | état Git, porcelain, worktrees |
| `SHA256SUMS` | empreintes |

Aucun fichier non suivi ne porte un nom évoquant un secret ; les fichiers ignorés (`.env*`) ne sont pas copiés. `git stash` n'a pas été utilisé.

## B. Dernières traces disponibles

- **Historique de session retrouvé.** F-U2.14 n'a pas été exécuté dans Codex (aucun fil Codex local après le 2026-10-13 dans `~/.codex/state_5.sqlite` / `logs_2.sqlite`) mais dans une session Claude Code : `~/.claude/projects/-Users-apple-Documents-GitHub/37a2d563-84f4-4be6-b11e-1b9ed970f207.jsonl` (lancement du prompt F-U2.14 : 2026-10-14 23:11 ; dernière entrée : 2026-10-15 03:58).
- **Dernière action.** La session s'est arrêtée sur une question en attente de réponse (aucun outil en cours d'exécution) : choix de stabilisation de Node local après des plantages natifs V8 (`ConcurrentMarking — unreachable code`, Node v20.20.2) touchant ~3 démarrages du serveur E2E sur 9 et 2 shards Jest sur 8. Aucune écriture de fichier n'était donc en cours au moment de l'extinction.
- **Journaux perdus.** Les journaux de tests de la session (`/private/tmp/claude-501/.../scratchpad/e2e-*.log`, y compris `e2e-fu213.log`, la campagne de référence 50/46) ont été effacés par le redémarrage. Les résultats ci-dessous proviennent des sorties enregistrées dans la transcription.
- **Artefacts Playwright.** `client/test-results/.last-run.json` (03:57) indique `failed` avec une liste vide, et `client/playwright-report/index.html` date de la même minute : il s'agit d'exécutions ciblées interrompues ou plantées, **sans valeur de certification**.

### Exécutions de tests ciblées pendant F-U2.14 (desktop-chromium uniquement)

| Heure (UTC) | Specs | Résultat |
|---|---|---|
| 22:14 → 22:41 | rental-activation + sale-finalization | 0/2 (itérations de diagnostic) |
| 02:19 | rental-activation + sale-finalization | rental **PASS**, sale FAIL (bouton « Finaliser ») |
| 02:32 | sale-finalization | **PASS** |
| 02:26 | contrat-creation-form ×2, onboarding, sale | 0/4 (avant correctifs G3) |
| 02:36 / 02:50 | contrat-creation-form ×2 + onboarding | 1/3 (« bien propre historique » **PASS**) |
| 02:48 / 02:54 / 02:57 | G3 | **non exécuté** : le serveur E2E n'a pas démarré (2 plantages V8 + 1 refus de `--no-concurrent-marking` dans `NODE_OPTIONS`) |

Aucune campagne complète, aucune certification (`certify:*`, `architecture:check`, Jest, Vitest, mobile) n'a été lancée pendant F-U2.14.

## C. Travaux F-U2.14 récupérés

Attribution par la transcription et par les dates de modification (fenêtre 2026-10-14 23:11 → 2026-10-15 03:58). **11 fichiers**, tous en **test ou fixture E2E** : aucun code applicatif (backend, frontend, mobile) n'a été modifié par F-U2.14.

| Fichier | Nature | Domaine |
|---|---|---|
| `client/e2e/support/auth.js` (nouveau) | Connexion UI robuste (attend `POST /api/users/login`) | Commun |
| `client/e2e/support/platformContext.js` (nouveau) | Sélection explicite du tenant administré par l'opérateur | Lots 1-2 |
| `client/e2e/support/appCss.js` (nouveau) | CSS applicatif compilé (Tailwind/PostCSS du projet) sans dépendre de `.next` | Lot 5 |
| `client/e2e/external-network.fixture.js` | Consentement cookies pré-enregistré (`cookie_consent=refused`) | Commun |
| `client/e2e/real-estate-rental-activation.spec.js` | Connexion partagée, sélection du tenant, en-tête `X-Platform-Tenant-Id` | Lot 1 |
| `client/e2e/real-estate-sale-finalization.spec.js` | idem | Lot 1 |
| `client/e2e/contrat-creation-form.spec.js` | Connexion partagée + sélection du tenant | Lot 2 |
| `client/e2e/rental-asset-onboarding.spec.js` | idem + sélecteur de bien par le sens, et non plus par position | Lot 2 |
| `client/e2e/accommodationSearchBar1/accommodations-visual.spec.js` | `buildAppCss` au lieu de `.next/static/css` | Lot 5 |
| `client/e2e/inbox2/inbox-visual.spec.js` | idem | Lot 5 |
| `server/scripts/start-accommodation-e2e.js` | Seed E2E : `PlatformOperator` (capacités de la Vue plateforme), `businessRole: "Admin"`, abonnement d'organisation actif, `tenant` sur les biens/fiches propriétaires gérés (C2.10A), faux prestataire Yabetoo en HTTPS (5052, certificat autosigné éphémère, `NODE_EXTRA_CA_CERTS` limité au backend E2E), `client_secret` dans l'intent | Lots 1-2 |

Causes racines établies par la session (Phase A/B) :

- **G2 — 403 sur `POST /api/contrats` et `/api/transactions`.** Les 403 sont **légitimes**. Le seed E2E (2026-08-18) est antérieur à l'exigence `platformAuthority` (2026-09-21) : « Admin » global ne vaut plus privilège plateforme. Classement : problème de fixture. Correction dans le seed, sans aucun assouplissement d'autorisation.
- **G1 — `page.addStyleTag` (tests visuels).** Ce n'est pas une incompatibilité Playwright (v1.62.0). `next dev` (serveur E2E) réécrit `.next` et supprime le CSS de production lu par les specs, d'où un `content` vide. Classement : problème de configuration.
- **Paiement de vente (503 `provider_invalid_config`).** Le service Yabetoo exige une URL `https` et un `client_secret`, que le faux prestataire ne fournissait pas. Classement : problème de fixture. Le contrôle de sécurité est conservé.
- **404 « Ressource inaccessible dans ce contexte tenant ».** Règle C2.10A : les biens du seed n'étaient pas rattachés à l'organisation. Classement : problème de fixture.
- **G3 — listes déroulantes vides.** Modules d'organisation conditionnés par l'abonnement (`TenantModuleGateError`), tenant non sélectionné, fiches non rattachées, sélecteur positionnel obsolète. Classement : fixture et test obsolète.

Toutes ces modifications ont été relues : complètes, syntaxiquement valides (`node --check` OK sur le seed), sans code de diagnostic résiduel (`DIAG-FU214` absent).

## D. Travaux incomplets — état par lot

| Lot | État | Preuves / manques |
|---|---|---|
| 1 — Autorisations & immobilier | **TESTS PARTIELS** | Les 2 scénarios sont passés isolément sur desktop (02:19 et 02:32 UTC), mais le seed a encore été modifié ensuite (abonnement, rattachements) : à rejouer. Projet mobile-chromium non rejoué. Audit de la chaîne d'autorisation : 403 qualifiés de légitimes, aucune modification applicative. |
| 2 — Formulaires & contrats | **EN COURS** | 1/3 vert ; derniers correctifs (seed `tenant` sur « Maison Location E2E », sélecteur onboarding) **non testés** (serveur E2E planté). États UI chargement/vide/refus/erreur : non audités. |
| 3 — Hôtels, PMS, hébergements | **NON COMMENCÉ** | Échecs connus : e2e1-pms (document financier, readiness check-out, dérogation), hotel-establishments-portfolio, accommodation-booking (`pending_payment` contre `pending` attendu ; redirection `/mon-espace`). |
| 4 — Messagerie, notifications | **NON COMMENCÉ** | Bouton « Notifications » introuvable (dash4, e2e1) ; inbox IH3 : hauteur d'iframe à 150 px. 6 captures `client/e2e/inbox2/screenshots/*.png` modifiées **avant** F-U2.14 : conservées, non restaurées. |
| 5 — Visuels & Playwright | **MODIFICATIONS PRÉSENTES — NON TESTÉES** | `buildAppCss` validé hors Playwright (168 749 octets, classes `dark`/`dashboard-shell` présentes) ; specs non rejouées. `dashboard-accommodations-visual` (titre « Vente » absent) non traité. |
| 6 — Mobile Expo | **NON COMMENCÉ** | Aucune action F-U2.14. |
| 7 — Non-régression financière/locative | **NON COMMENCÉ** | Aucun code applicatif modifié par F-U2.14, donc risque faible, mais aucune certification rejouée. |
| 8 — Certifications E2E/release | **BLOQUÉ (environnement)** | Instabilité native de Node v20.20.2 (V8) ; aucune campagne complète depuis la référence 50/46. |

`ATTRIBUTION INDÉTERMINÉE` : sans objet pour les 11 fichiers ci-dessus. Les ~416 autres entrées du `git status` sont **antérieures** à F-U2.14 (chantiers F-U1 à F-U2.13, administration plateforme, hôtels, mobile, etc.) et ne lui sont pas attribuées.

## E. Risques après extinction

| Risque | Constat |
|---|---|
| Écriture de fichier interrompue | Aucun : le dernier appel d'outil s'était terminé, et la session attendait une réponse. |
| Processus orphelins / ports | Aucun processus Playwright, Next, Jest ou serveur E2E ; ports 3000, 5000, 5051 et 5052 libres. Seul le `mongod` local (27017) tourne ; il n'est pas utilisé par les tests (MongoDB en mémoire). |
| Données de test intermédiaires | Aucune : les bases E2E et Jest sont en mémoire (`MongoMemoryReplSet`) et ont disparu. Aucun résidu `mongo-mem-*` ni `altitude-e2e-tls-*` dans `$TMPDIR`. |
| `client/.next` | Produit par `next dev` (serveur E2E), ce n'est pas un build de production. Il ne sera pas supprimé ; un `next build` le régénérera lors de la certification frontend. |
| Rapports Playwright | `client/test-results`, `client/playwright-report` : artefacts partiels, sans valeur de preuve. |
| Instabilité Node v20.20.2 | Non résolue. Plantage V8 natif intermittent, sans lien avec le code applicatif. |

## F. Plan de reprise

1. Rejouer les scénarios du lot 2 (contrat-creation-form ×2, rental-asset-onboarding), puis ceux du lot 1 (seed modifié depuis leur passage), sur desktop puis mobile. Un échec n'est relancé **que** si le journal prouve un plantage V8 natif, et chaque relance est documentée.
2. Rejouer les tests visuels du lot 5 (accommodations, inbox) ; traiter IH3 (iframe) et `dashboard-accommodations-visual`.
3. Diagnostiquer et corriger les lots 3 et 4 (PMS, hôtels, réservation d'hébergement, notifications).
4. Lot 7 : `certify:financial`, `certify:rental`, `architecture:check`, puis le reste des tests backend, de façon séquentielle.
5. Frontend (lint, Vitest, build), mobile (`ci:mobile` sans publication), campagne Playwright complète, puis `certify:release`.
6. Rapport final : `docs/runbooks/F-U2.14-STABILIZATION-AND-RELEASE-READINESS.md`.

Décision en attente du propriétaire : installer un autre correctif de Node 20 via nvm pour stabiliser les campagnes locales. Par défaut, la reprise se fait **sans installation**, avec relances documentées sur plantage natif uniquement.
