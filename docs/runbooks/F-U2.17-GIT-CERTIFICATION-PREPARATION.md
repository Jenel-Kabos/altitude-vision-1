# F-U2.17 — Préparation Git sécurisée et certification Linux

Date : 2026-10-16. Dépôt `altitude-vision-1`.

**Aucun push, aucune fusion, aucun déploiement ni publication.** Les commits ont été créés **localement uniquement**, sur une branche dédiée.

Références :
- [F-U2.14](F-U2.14-STABILIZATION-AND-RELEASE-READINESS.md)
- [F-U2.15](F-U2.15-FINAL-RELEASE-CERTIFICATION.md)
- [F-U2.16](F-U2.16-RELEASE-GATE-CLOSURE.md)

## 1. État Git

| | Initial | Final |
|---|---|---|
| Branche active | `main` | `certification/f-u2.17-release-readiness` |
| HEAD | `5a54a13` | 13 commits locaux au-dessus de `5a54a13` (§6) |
| `main` / `origin/main` | `5a54a13` / `5a54a13` (en phase, après `git fetch`) | **inchangés** : `5a54a13` / `5a54a13` |
| Modifications non commitées | 246 fichiers suivis modifiés, 205 non suivis, 0 indexé, 0 stash | **0** (tout est commité sur la branche) |
| Branche de certification | absente en local et sur `origin` | locale uniquement, **non poussée** |

## 2. Sauvegardes et garanties de préservation

**Sauvegarde F-U2.17**, prise avant toute opération : `~/altitude-vision-backups/F-U2.17-start-20261016-065846/` (droits `700`). Elle contient :
- `tracked.patch` : patch binaire complet, dont l'application sur HEAD a été vérifiée ;
- `name-status.txt` ;
- `untracked.txt` et `untracked.tar.gz` (205 fichiers) ;
- `tracked-files-snapshot.tar.gz` : copie intégrale des fichiers modifiés ;
- `SHA256SUMS`.

**Comparaison avec la sauvegarde F-U2.14** (`F-U2.14-recovery-20261015-111526`) :
- +20 fichiers suivis modifiés et +6 nouveaux, issus des travaux F-U2.14 à F-U2.16 ;
- 2 fichiers sortis du diff : deux captures inbox **régénérées à l'identique** de HEAD.

**Aucune perte.**

Garanties appliquées :
- Aucun `reset`, `clean`, `stash`, `checkout --` ni `restore`.
- La branche a été créée avec `git switch -c`. Le patch des fichiers suivis et la liste des non suivis ont été vérifiés **identiques octet pour octet** avant et après la bascule.
- Chaque commit a été indexé par `git add --pathspec-from-file=<liste>`, jamais avec `git add -A`. Avant chaque commit, le contenu de l'index a été comparé à la liste prévue.
- Aucun hook Git actif. Identité de commit identique à l'historique (`Altitudevision`).

**Retour à l'état initial, sans perte :**
1. `git switch main`. `main` n'a jamais bougé ; tout le travail reste dans la branche de certification et dans la sauvegarde.
2. Pour retrouver l'état « modifications non commitées sur `main` » : depuis `main`, `git restore --source=certification/f-u2.17-release-readiness --worktree -- .` restaure les fichiers suivis. Les fichiers nouveaux se restaurent avec `git checkout certification/f-u2.17-release-readiness -- <chemins>`, puis `git restore --staged .` pour les retirer de l'index.
3. Une **restauration exacte** de l'état du 2026-10-16 06:58 reste possible depuis la sauvegarde F-U2.17 : `git apply tracked.patch` sur `5a54a13`, puis extraction de `untracked.tar.gz`.

## 3. Inventaire des modifications (456 fichiers)

Audit de contenu sur environ 27 000 lignes ajoutées :
- **0 secret** : clés privées, AWS, Google API, Stripe, Slack, GitHub, URI MongoDB avec identifiants, comptes de service, clés de prestataires de paiement, JWT ;
- **0 donnée personnelle réelle** : les 17 adresses e-mail sont fictives (`example.test`) ou appartiennent au domaine Altitude Vision, et il n'y a aucun IBAN ;
- 0 fichier binaire ou volumineux parmi les fichiers non suivis.

Les fichiers sensibles locaux, tous **ignorés et non suivis**, sont exclus des commits : `.env`, `*.jks`, `client_secret_*.json`, `google-services.json`, APK, `dist/`, `coverage/`, `.next*`, `.claude/`.

| Domaine | Fichiers | Contenu |
|---|---|---|
| Sécurité multi-tenant / administration plateforme | 79 | Opérateurs plateforme, délégation de capacités, éligibilité à la Vue plateforme, `platformAuthority`, `errorMiddleware`, adhésions, portées de route ; tests adversariaux d'isolation |
| Système financier unifié | 77 | Facturation unifiée (F-U2), finance contractuelle (F-U1 à F-U1.H), tarification autonome (F-U2.9), recouvrement et pénalités (F-U2.10 à F-U2.12) |
| Gestion locative | 37 | Politiques contractuelles versionnées, mandats, séparation déléguée / autonome (F-U2.13), portail locataire |
| Immobilier / intermédiation | 46 | Publication commerciale centralisée, autorisation de contact, confidentialité des candidatures, visites, réservations immobilières |
| Messagerie / notifications | 25 | Isolation de la boîte support, autorisation socket, **cloche propriétaire restaurée** |
| PMS / hébergements | 30 | Autorité tenant hôtelière, concurrence de surréservation, **correctif de l'état financier du check-out** |
| KYC | 27 | Stockage, inspection et analyse des documents KYC, attestations d'identité (F-U1.I et F-U1.J) |
| Marketing / consentement / comptes | 53 | Consentement, automatisation CRM, désinscription, suppression de compte, accréditations |
| Application mobile | 17 | Consentement marketing, messagerie, profil (sources et tests) |
| Dépendances | 6 | Expo SDK 57, `axios` 1.20.0, resynchronisation du lockfile client |
| Tests E2E / banc | 31 | Banc en build de production, seed, specs, banc visuel, 9 captures |
| CI / certification | 2 | Nouveau workflow Linux, `scripts/certify.js` |
| Documentation | 26 + ce rapport | Invariants, matrices de conformité, plans et spécifications, rapports F-U2.11 à F-U2.17 |

Points **signalés** et inclus après examen :
- `ALTIMMO_COMMERCIAL_INTERMEDIATION_HARDENING_REPORT.md` est un rapport placé à la **racine** plutôt que dans `docs/`. Il est commité tel quel ; un déplacement reste possible ultérieurement.
- `server/models/Conversation.js` est en CRLF dans la copie de travail. `.gitattributes` (`* text=auto`) l'a normalisé en LF dans le commit, sans impact fonctionnel.
- `client/package-lock.json` : la resynchronisation était **nécessaire**. Le lockfile commité dans `5a54a13` est désynchronisé, et `npm ci` échoue avec `Missing: esbuild@0.28.2 from lock file`, ce qui casse aussi la CI actuelle. Après correction, `npm ci --dry-run` réussit pour les quatre lockfiles (racine, serveur, client, mobile).

## 4. Branche préparée

`certification/f-u2.17-release-readiness`, créée depuis `5a54a13`. Le nom était libre en local et sur `origin`, vérifié par `git ls-remote`.

## 5. Plan des commits

Ordre des dépendances : 01 → 02 → (03, 04, 04b, 04c, 05, 06, 07) → 08 → 09 → 10 → 11.

**Seul l'état final de la branche est certifiable.** Les états intermédiaires ne sont pas garantis compilables ni testables isolément : les domaines partagent des fichiers transverses, et les commits ont été découpés à la granularité du fichier.

| # | Titre | Fichiers | Tests correspondants | Risques |
|---|---|---|---|---|
| 01 | `chore(deps)` Expo SDK 57, axios 1.20.0, resynchronisation du lockfile client | 6 | Mobile 657/657, Doctor 21/21, client 1 366/1 366, serveur unitaire 1 942/1 942 | OTA `expo-updates` (runtimeVersion inchangée) |
| 02 | `feat(platform)` autorité PLATFORM / TENANT / UNRESOLVED | 79 | Tests adversariaux plateforme et tenant (MongoDB) | Commit le plus transverse (`server.js`, `Header.jsx`, routes admin) |
| 03 | `feat(finance)` facturation unifiée, finance contractuelle, recouvrement | 77 | `certify:financial` 501/501 | Volume (9 707 lignes) ; dépend de 02 |
| 04 | `feat(rental)` politiques de bail, séparation déléguée / autonome | 37 | `certify:rental` 141/141 | Dépend de 03 |
| 04b | `feat(real-estate)` publication et autorisation de contact | 46 | Tests intermédiation et confidentialité, E2E immobilier | Dépend de 02 |
| 04c | `fix(messaging)` isolation support, sockets, cloche propriétaire | 25 | Tests support et socket, Vitest `OwnerDashboardNavigation` | — |
| 05 | `fix(pms)` autorité hôtelière, état financier du check-out | 30 | `hotelCheckoutReadinessManagerFU214`, E2E PMS | Dépend de 02 et 03 |
| 06 | `feat(kyc)` stockage et inspection KYC | 27 | Tests de sécurité KYC (MongoDB) | Données sensibles (aucune donnée réelle commitée) |
| 07 | `feat(marketing)` consentement et CRM | 53 | Tests consentement et automatisation | Conformité RGPD |
| 08 | `feat(mobile)` | 17 | Mobile 657/657 | — |
| 09 | `test(e2e)` campagne en build de production | 31 | Playwright 96/96 ×2 (production) | Captures régénérées |
| 10 | `ci` workflow de certification Linux | 2 | Exécution GitHub Actions après push | Durée d'environ 2 h 45 |
| 11 | `docs` | 27 | — | — |

## 6. Commits locaux effectivement créés

Statistiques de `main..HEAD` hors documentation : 430 fichiers, +24 541 / −1 536.

| Commit | Titre | Fichiers |
|---|---|---|
| `e63ebfe` | chore(deps): align Expo SDK 57 patches, upgrade axios to 1.20.0 and resync client lockfile | 6 |
| `604a675` | feat(platform): enforce PLATFORM/TENANT/UNRESOLVED authority and platform operator administration | 79 |
| `44ee78c` | feat(finance): unified billing, contractual finance and rent collection engine | 77 |
| `496b663` | feat(rental): contractual lease policies, delegated/autonomous separation and tenant portal | 37 |
| `cf3fbcd` | feat(real-estate): centralized commercial publication, contact authorization and application privacy | 46 |
| `2b6bdaa` | fix(messaging): support inbox isolation, socket authorization and owner notification bell | 25 |
| `a4124ed` | fix(pms): hotel tenant authority, overbooking concurrency and checkout financial readiness | 30 |
| `7cc37b7` | feat(kyc): governed KYC document storage, inspection and human identity attestation | 27 |
| `cb5a96c` | feat(marketing): consent-based CRM automation, unsubscribe and account privacy | 53 |
| `d74584e` | feat(mobile): marketing consent, messaging and profile updates in the Altimmo app | 17 |
| `6939dbb` | test(e2e): production-build Playwright campaign, fixtures and deterministic visual bench | 31 |
| `ca317c9` | ci: add Linux release certification workflow (certify:release + production E2E) | 2 |
| *(dernier)* | docs: architecture invariants, compliance matrices, sprint plans and F-U2.11 to F-U2.17 runbooks | 27 (dont ce rapport) |

## 7. Correctif axios et tests

**Avant.** `axios` 1.19.0 (12 avis, dont 6 de gravité élevée, tous corrigés à partir de 1.20.0), présent dans :
- `altimmo-app` et `client`, en dépendance directe ;
- `server`, via `twilio`, qui accepte `^1.13.5`.

La racine du dépôt était en 1.13.5.

**Après.** 1.20.0 partout.
- `altimmo-app` et `client` : plancher relevé de `^1.7.2` à `^1.20.0`.
- `server` et racine : mise à jour par le lockfile seul.

**Impact analysé** (comparaison des archives 1.19.0 et 1.20.0) :
- dépendances directes identiques ;
- API publique additive seulement (alias `ContentTooLarge` et `UnprocessableContent`) ;
- correctifs internes : adaptateurs, intercepteurs, `mergeConfig` (pollution de prototype), contournement de proxy, `fromDataURI`.

Les intercepteurs de l'application (`api.js` mobile et client : jeton, en-tête `X-Platform-Tenant-Id`, gestion des 401) n'utilisent pas le mode `synchronous`.

**Tests après mise à jour** (journaux dans `~/altitude-vision-certification-logs/F-U2.17/`) :

| Paquet | Résultat |
|---|---|
| Mobile | typecheck OK, **657/657** |
| Client | **184/184 fichiers, 1 366/1 366 tests** (appels API, authentification, pages de facturation et de paiement) |
| Serveur | tests unitaires **1 942/1 942** (Twilio et SMS via axios) |

Les paiements sont couverts : les tests de paiement (initiation idempotente, prestataire, preuves manuelles) font partie de ces suites, et aucun appel réel n'est effectué.

Aucune migration React Navigation : `decode-uri-component` reste une réserve connue (F-U2.16).

## 8. Préparation de la CI Linux

**Nouveau workflow** `.github/workflows/certify-release.yml`, commit `ca317c9`.

| Paramètre | Valeur |
|---|---|
| Déclencheurs | `push` sur `certification/**` et `workflow_dispatch` uniquement (jamais `main`) |
| Permissions | `contents: read` ; `persist-credentials: false` |
| Runner | `ubuntu-24.04`, dépôt **public** : runner standard 4 vCPU, 16 Go de RAM, environ 14 Go de disque |
| Node | **20.20.2 exact** (`NODE_VERSION`) |
| Dépendances | `npm ci` depuis les quatre lockfiles, cache npm |
| MongoDB | `mongodb-memory-server` (instances éphémères), cache `~/.cache/mongodb-binaries` |

**Job `certify-release`** (plafond 330 min) :
1. contrôle des fichiers d'identifiants suivis ;
2. `npm ci` ;
3. affichage des ressources du runner ;
4. `npm run certify:release`, avec `tee` et `pipefail` ;
5. journal complet conservé en artefact pendant 30 jours.

**Job `e2e-production`** (60 min) : `npx playwright test`, les 96 scénarios sur le build de production isolé. Le rapport Playwright et `test-results` sont conservés en artefact.

**Sécurité et isolation :**
- aucun `secrets.*`, aucune étape de déploiement ou de publication ;
- variables de test neutralisées par `safeTestEnv` ;
- garde réseau `TEST_EXTERNAL_NETWORK=deny` ;
- prestataire de paiement factice local, JWT de test fictif ;
- aucun test désactivé, aucun contrôle d'autorisation modifié.

YAML validé.

Le workflow `e2e.yml` existant reste déclenché sur `main`, `develop` et les pull requests. Il bénéficiera de la resynchronisation du lockfile client : son `npm ci` échouait.

**Limite connue.** La première exécution téléchargera le binaire `mongod` pour Ubuntu 24.04. `lint.yml` exécute déjà `test:mongo` sur `ubuntu-latest`, mais son état récent n'a pas pu être vérifié (`gh` absent).

## 9. Captures validées

Les 9 captures du commit `6939dbb` sont celles analysées en F-U2.16, sans régénération depuis :

| Groupe | Captures | Constat |
|---|---|---|
| Hébergements | 5 (`desktop-dark-filters-closed`, `desktop-light-filters-closed`, `desktop-light-filters-open`, `mobile-dark`, `mobile-light`) | Formats attendus (1440×900 et 390×844, densité 1). Écarts de 0,32 à 1,75 % dus à l'instant de l'animation d'apparition. |
| Inbox | `desktop-light`, `desktop-dark`, `mobile-light-detail` | Message désormais complet. La référence HEAD le tronquait. |
| Inbox | `mobile-light-list` | Seuls changent les horodatages relatifs. |

**Écart résiduel documenté** : ces captures varient à chaque exécution (animation, horloge). La CI les régénérera sans les commiter.

Amélioration suggérée, non appliquée : figer l'horloge (`page.clock`) et attendre la fin des animations.

## 10. Risques résiduels

1. **Certification non encore exécutée sous Linux.** La porte 13/13 reste à démontrer en CI.
2. Commits intermédiaires non certifiés isolément : seul le sommet de branche l'est.
3. `decode-uri-component` (React Navigation 6) exposé à l'exécution : correction majeure à planifier.
4. Vulnérabilités d'outillage sans correctif publié (`node-forge`, `braces`, `sprintf-js`).
5. Captures non déterministes.
6. `SENTRY_DISABLE_AUTO_UPLOAD=true` en production. `google-service-account.json` absent : prérequis pour `eas submit`.
7. Poste local instable (plantages V8, redémarrages GPU) : diagnostic matériel conseillé.

## 11. Liste exacte des changements destinés à GitHub

La seule référence à pousser est la branche **`certification/f-u2.17-release-readiness`**, soit les **13 commits** de `main..certification/f-u2.17-release-readiness` (§6) :
- 430 fichiers de code, tests, dépendances et CI ;
- 27 fichiers de documentation.

`main` n'est pas modifiée, et aucune autre branche, aucun tag ni aucun fichier non suivi n'est concerné.

Commande de contrôle à lancer avant le push :

```bash
git log --oneline main..certification/f-u2.17-release-readiness
git diff --stat main..certification/f-u2.17-release-readiness | tail -1
git ls-files | grep -Ei '(^|/)\.env($|\.)|client_secret|service-account|credentials\.json|\.jks$|\.keystore$|\.p8$|\.p12$' | grep -Eiv '\.env\.(example|sample)$' || echo "aucun fichier d'identifiants suivi"
```

## 12. Commandes proposées pour le push (non exécutées)

```bash
cd /Users/apple/Documents/GitHub/altitude-vision-1
git push -u origin certification/f-u2.17-release-readiness
# Le push déclenche automatiquement « Release certification (Linux) »
# (jobs certify-release et e2e-production). Suivi :
#   https://github.com/Jenel-Kabos/altitude-vision-1/actions/workflows/certify-release.yml
```

**Aucune fusion dans `main` ni aucun déploiement** ne découle de ce push. Ces opérations restent soumises à une autorisation distincte, après examen des résultats de la CI.
