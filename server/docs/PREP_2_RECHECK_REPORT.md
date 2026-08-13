# PREP-2-RECHECK — Re-certification ciblée après (tentative de) rotation des credentials Zoho

Date : 2026-08-12
Dépôt : `/Users/apple/Documents/GitHub/altitude-vision-1`
Document de référence : `server/docs/PREP_2_REPORT.md` (verdict NO-GO du 2026-08-12)

## 1. Executive Summary

**La certification est arrêtée dès la Phase D, conformément à la section 35 de la mission.** La preuve de rotation recherchée n'existe pas — elle est même contredite : les fingerprints cryptographiques (SHA-256, non réversibles) des identifiants OAuth Zoho actuellement configurés (`ZOHO_CLIENT_ID`, `ZOHO_CLIENT_SECRET`, `ZOHO_REFRESH_TOKEN`, `ZOHO_ACCOUNT_ID`) sont **strictement identiques** à ceux exposés dans l'historique Git entre le 2026-02-03 et le 2026-07-17. Aucune rotation n'a eu lieu.

**Découverte supplémentaire, hors périmètre strict de la mission mais directement pertinente** : l'audit de l'historique Git révèle que l'exposition ne s'est pas limitée à `getZohoOrgId.js` (commit `3b4c3ea`, mentionné dans PREP-2). Les fichiers `.env` (racine) et `altimmo-app/.env` ont eux-mêmes été versionnés en clair pendant 8 commits, du tout premier commit du dépôt (`2b25924`, 2026-02-03) jusqu'à leur retrait (`2400fa1`, 2026-07-17). Le même exercice de fingerprinting montre que `JWT_SECRET`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`, `FACEBOOK_ACCESS_TOKEN`, `ACCESS_TOKEN`, `CINETPAY_API_KEY`, `CINETPAY_SITE_ID` et `GOOGLE_MAPS_API_KEY` sont **eux aussi identiques** entre la valeur historiquement exposée et la valeur actuellement configurée. Seuls `MONGO_URI` et quelques champs de compte email (`EMAIL_HOST`, `EMAIL_PASSWORD`, `EMAIL_USERNAME`, `ZOHO_IMAP_PASSWORD`, `ZOHO_FROM_EMAIL`) diffèrent.

Aucune valeur secrète n'a été affichée ou enregistrée à aucun moment de cet audit — uniquement des empreintes SHA-256 tronquées à 10 caractères, comparées entre elles.

## 2. Previous PREP-2 Verdict

`NO-GO`, bloqueur unique documenté : credentials OAuth Zoho versionnés en historique Git (commit `3b4c3ea`), rotation externe non confirmée à l'époque.

## 3. Recheck Scope

Vérifier si la rotation Zoho a eu lieu depuis PREP-2. Conformément à la section 35 de la mission : si la rotation n'est pas prouvée, arrêter la certification après confirmation de l'état et ne pas poursuivre la revalidation complète des gates. C'est le cas ici — voir sections 5 à 9.

## 4. Worktree Baseline

`git status` : `nothing to commit, working tree clean`. `git diff --stat` : vide. `git diff --check` : exit 0.

Différence notable avec PREP-2 : le worktree PREP-2 (121 fichiers modifiés non commités + ~30 fichiers non suivis) a depuis été commité en intégralité par l'utilisateur (15 commits `Update Altimmo N` / `Update AltitudeVision` / `Update USER-KPI`, jusqu'au commit `60099d8`), en dehors de cette session — cette session n'a effectué et n'effectuera aucun commit.

## 5. Historical Zoho Exposure

`git show 3b4c3ea --stat` confirme : ajout de `getZohoOrgId.js` (85 lignes), suppression de `getZohoToken.js` (139 lignes), et modification du fichier `.env` racine (80 lignes changées) dans le même commit.

| Credential | Historical exposure |
|---|---|
| Client ID | CONFIRMED |
| Client secret | CONFIRMED |
| Refresh token | CONFIRMED |

Recherche élargie dans l'historique complet (`git log --all --follow -- .env` et `altimmo-app/.env`) : ces deux fichiers ont été suivis par Git du commit initial `2b25924` (2026-02-03) au commit `2400fa1` (2026-07-17, "Secure and stabilize Altimmo mobile application", qui les a retirés du suivi et introduit `.env.example`/`altimmo-app/.env.example`). Fenêtre d'exposition effective : **environ 5,5 mois**, à travers 8 commits pour le fichier racine et 6 pour le fichier mobile. Aucune valeur n'a été affichée pendant cette vérification — seuls les noms de variables ont été extraits (`grep -oE '^[A-Za-z_]+='`).

Variables exposées identifiées (noms uniquement) :
- Racine `.env` : `MONGO_URI`, `JWT_SECRET`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`, `CLOUDINARY_CLOUD_NAME`, `ZOHO_CLIENT_ID`, `ZOHO_CLIENT_SECRET`, `ZOHO_REFRESH_TOKEN`, `ZOHO_ACCOUNT_ID`, `ZOHO_API_DOMAIN`, `ZOHO_IMAP_PASSWORD`, `ZOHO_FROM_EMAIL`, `EMAIL_PASSWORD`, `EMAIL_HOST`, `EMAIL_USERNAME`, `EMAIL_PORT`, `EMAIL_FROM`, `ACCESS_TOKEN`, `FACEBOOK_ACCESS_TOKEN`, `DB_NAME`, plus variables non sensibles (URLs, noms d'entreprise, etc.).
- `altimmo-app/.env` : `CINETPAY_API_KEY`, `CINETPAY_SITE_ID`, `GOOGLE_MAPS_API_KEY`, `EXPO_PUBLIC_SENTRY_DSN`, plus variables non sensibles.

## 6. Current Secret Scan

| Élément | Classification |
|---|---|
| `getZohoOrgId.js` (tracké, HEAD) | SAFE — lit exclusivement `process.env.ZOHO_*`, aucune valeur en dur |
| `getZohoTokenManual.js`, `testZohoMail.js`, autres scripts racine | SAFE — `process.env`/`dotenv` uniquement |
| `.env.example`, `client/.env.example`, `altimmo-app/.env.example` | SAFE — placeholders vides (`CLE=`), aucune valeur réelle |
| `.env` (racine), `server/.env`, `client/.env`, `altimmo-app/.env` (actuels) | Non trackés par Git (vérifié via `git ls-files`), correctement ignorés — contenu non affiché, non lu au-delà de l'extraction de noms de variables pour la comparaison de fingerprints (section 7) |
| Scan par motif (clés AWS, PEM, Slack, Mongo URI en clair, clés Google) sur fichiers trackés | SAFE — un seul faux positif dans `AGENTS.md` (exemple générique de commande `mongosh`) |

Aucun `CONFIRMED SECRET` dans les fichiers actuellement trackés par Git. Le problème n'est pas une fuite de code courant, mais la **non-rotation** des valeurs elles-mêmes après leur exposition passée (voir section 7).

## 7. Zoho Rotation Evidence

Méthode : extraction des valeurs de variables depuis l'historique Git (`git show 2400fa1^:.env`, dernière version trackée avant suppression) et depuis les fichiers `.env` actuels du disque, calcul local d'une empreinte SHA-256 tronquée à 10 caractères hexadécimaux pour chaque valeur, comparaison des empreintes uniquement. Aucune valeur brute n'a été imprimée, journalisée, ni incluse dans ce rapport.

| Variable | Résultat |
|---|---|
| `ZOHO_CLIENT_ID` | **SAME** |
| `ZOHO_CLIENT_SECRET` | **SAME** |
| `ZOHO_REFRESH_TOKEN` | **SAME** |
| `ZOHO_ACCOUNT_ID` | **SAME** |
| `ZOHO_API_DOMAIN` | SAME (non sensible) |
| `ZOHO_FROM_EMAIL` | DIFFERENT |
| `ZOHO_IMAP_PASSWORD` | DIFFERENT |

**OLD_CLIENT_SECRET == CURRENT_CLIENT_SECRET ? → SAME**
**OLD_REFRESH_TOKEN == CURRENT_REFRESH_TOKEN ? → SAME**

Conformément à la section 9 de la mission : **SAME → NO-GO immédiat.**

Constat élargi (mêmes méthode et garanties de non-affichage) sur les autres secrets exposés dans la même fenêtre historique :

| Variable | Résultat |
|---|---|
| `JWT_SECRET` | SAME |
| `CLOUDINARY_API_KEY` | SAME |
| `CLOUDINARY_API_SECRET` | SAME |
| `CLOUDINARY_CLOUD_NAME` | SAME (non secret) |
| `FACEBOOK_ACCESS_TOKEN` | SAME |
| `ACCESS_TOKEN` | SAME |
| `MONGO_URI` | DIFFERENT |
| `CINETPAY_API_KEY` (mobile) | SAME |
| `CINETPAY_SITE_ID` (mobile) | SAME |
| `GOOGLE_MAPS_API_KEY` (mobile) | SAME |

## 8. Old Credential Revocation Proof

**NOT TESTED.** La mission autorise un test de révocation OAuth uniquement si aucune donnée métier n'est modifiée, aucun email n'est envoyé, et aucun secret n'est journalisé — mais surtout, un tel test n'a de sens que pour confirmer qu'un ancien secret différent du nouveau a bien été invalidé. Ici, ancien et nouveau sont **identiques** : il n'existe littéralement pas d'« ancien » token distinct à tester contre le mécanisme OAuth Zoho, puisqu'aucun nouveau secret n'a été émis. Tester le refresh token actuel reviendrait à tester le secret de production actif, ce qui est hors périmètre d'un test de révocation et n'apporterait aucune preuve supplémentaire.

## 9. Current Credential Configuration

`getZohoOrgId.js` et les autres scripts lisent exclusivement `process.env.ZOHO_*` (section 6). `.env.example` ne contient que des placeholders. **Mais** la valeur réellement stockée dans `process.env` au runtime (via `server/.env` / plateforme Render) est la même valeur qui a fuité en historique Git — la remédiation du code (lire depuis l'environnement plutôt qu'en dur) a été faite, mais **la valeur elle-même n'a jamais été changée**. C'est une remédiation de forme, pas de fond.

## 10. Zoho Runtime Security

Non ré-audité en détail dans ce recheck (déjà couvert par PREP-2 : credentials via `process.env`, aucun secret journalisé trouvé dans `emailService.js`/`zohoImapService.js`, `nodemailer` sans usage de l'option `raw` vulnérable). Cette conclusion reste valide indépendamment du blocage de rotation — le code applicatif n'est pas en cause, la valeur du secret l'est.

## 11. Git History Assessment

Aucune réécriture d'historique effectuée (interdit dans ce sprint). Rappel de la mission : une fois la rotation **réellement effectuée**, la présence de l'ancien secret (désormais invalide) dans l'historique deviendrait une dette d'hygiène plutôt qu'un risque actif. **Ce n'est pas encore le cas ici** — le secret présent en historique est toujours le secret actif en production. Une opération `GIT-HISTORY-SANITIZE-1` reste recommandée à terme, mais elle est secondaire tant que la rotation elle-même n'a pas eu lieu.

## 12. Gitignore Assessment

`.gitignore` couvre correctement `.env`, `.env.*` (racine, `server/`, `client/`, `altimmo-app/`), avec exceptions explicites pour les `.env.example`. Ces règles ont été ajoutées au commit `2400fa1` (2026-07-17), au moment du retrait des fichiers `.env` du suivi. **Précision importante documentée conformément à la section 14 de la mission** : le fait que ces fichiers soient désormais ignorés ne les protège pas rétroactivement — ils restent lisibles dans les 8 (racine) et 6 (mobile) commits historiques où ils étaient trackés, tant que l'historique n'est pas purgé.

## 13–27. Backend Unit / Backend Mongo / Tenant / Storage / Web / Mobile / Expo Doctor / Playwright / Health-Verify / NPM Audit / Cloudinary / Contrats historiques / Backup-Restore / Monitoring-Alerting / PlatformOperator

**NOT RUN — certification arrêtée à la Phase D conformément à la section 35 de la mission.** La preuve de rotation étant non seulement absente mais activement contredite (fingerprints SAME), il n'y a aucune valeur à revalider les gates fonctionnelles : le blocage de sécurité n'est pas fermé, quel que soit l'état des tests. Relancer l'intégralité des suites (Backend Unit/Mongo, Web, Mobile, Playwright, npm audit) aurait consommé un temps d'exécution significatif sans pouvoir changer le verdict, puisque celui-ci est déterminé uniquement par l'état de rotation. Les résultats de PREP-2 (tous verts sauf Playwright 32/34 avec RCA documentée) restent la dernière mesure connue de ces gates et n'ont pas de raison de s'être dégradés (aucune modification de code depuis, seulement des commits de l'utilisateur qui correspondent exactement au contenu déjà audité en PREP-2).

## 28. Risk Register (mise à jour)

| ID | Risque | Statut PREP-2 | Statut PREP-2-RECHECK |
|---|---|---|---|
| R1 | Secret Zoho OAuth versionné en historique Git, non révoqué | BLOCKING | **BLOCKING — aggravé** : confirmé non rotoé (fingerprint SAME), pas seulement "non confirmé" |
| R1-bis (nouveau) | `.env` racine et `altimmo-app/.env` versionnés en clair ~5,5 mois (2026-02-03 → 2026-07-17), incluant `JWT_SECRET`, `CLOUDINARY_API_KEY/SECRET`, `FACEBOOK_ACCESS_TOKEN`, `CINETPAY_API_KEY/SITE_ID`, `GOOGLE_MAPS_API_KEY` — tous confirmés **non rotés** (fingerprint SAME) | Non documenté en PREP-2 | **BLOCKING — nouveau** |
| R2 | Cloudinary legacy URLs | ACCEPTED | ACCEPTED (inchangé) |
| R3 | 17 contrats historiques | ACCEPTED | ACCEPTED (inchangé) |
| R4 | Playwright flakiness | ACCEPTED (documenté) | Non revérifié (gates non relancées, cf. section 13-27) |
| R5 | Pas de garde de chevauchement cron | MITIGATED (process) | Inchangé |
| R6 | `seedAltcomData.js` destructif sans garde | OPEN | Inchangé |
| R7 | Backup/restore non formalisé | OPEN (condition) | Inchangé |
| R8 | Alerting opérationnel absent | OPEN (condition) | Inchangé |
| R9 | Upload vidéo mémoire 300 Mo/requête | ACCEPTED (à surveiller) | Inchangé |
| R10 | Vulnérabilités npm hautes/modérées résiduelles | ACCEPTED | Non revérifié (gates non relancées) |
| R11 | Redaction de logs incomplète | ACCEPTED | Inchangé |
| R12 | PlatformOperator fail-closed | ACCEPTED | Inchangé |

## 29. Risks Closed Since PREP-2

Aucun. R1 n'est pas fermé — il est confirmé actif avec preuve directe (fingerprint), ce qui est un état plus grave que "rotation non confirmée" documenté en PREP-2.

## 30. Remaining Conditions

Sans objet tant que R1/R1-bis ne sont pas résolus — aucune requalification en `GO WITH CONDITIONS` n'est possible avant cela (cf. section 28 de la mission : "rotation Zoho prouvée" est une condition **sine qua non**, pas une parmi d'autres).

## 31. Blockers

**R1 et R1-bis.** Blocage total tant que les secrets suivants n'ont pas été rotés avec une valeur strictement différente de celle exposée en historique Git :
- `ZOHO_CLIENT_ID`, `ZOHO_CLIENT_SECRET`, `ZOHO_REFRESH_TOKEN` (Zoho OAuth)
- `JWT_SECRET` (invalidation de toutes les sessions actives au moment de la rotation — à planifier)
- `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`
- `FACEBOOK_ACCESS_TOKEN`
- `CINETPAY_API_KEY`, `CINETPAY_SITE_ID`
- `GOOGLE_MAPS_API_KEY`

## 32. Files Created

- `server/docs/PREP_2_RECHECK_REPORT.md` (ce document)

## 33. Files Modified

Aucun. Session strictement en lecture (historique Git, fichiers `.env` locaux lus uniquement pour extraction de noms de variables et calcul de fingerprints, jamais modifiés).

## 34. Tests Actually Executed

`git status`, `git diff --stat`, `git diff --check`, `git show 3b4c3ea --stat`, `git log --all --follow` sur `.env` et `altimmo-app/.env`, extraction de noms de variables (sans valeurs) depuis l'historique et le disque, calcul et comparaison de 39 empreintes SHA-256 tronquées (Zoho + secrets élargis, racine + mobile), scan par motif sur fichiers trackés, vérification `.gitignore`, vérification `.env.example`.

## 35. Commands Not Executed

Backend Unit, Backend Mongo, Web Vitest, Mobile Jest, TypeScript Mobile, ESLint (serveur/client/mobile), Expo Doctor, Next build, Playwright (desktop/mobile), `npm run health`, `npm run verify`, `npm audit` (server/client/mobile) — **NOT RUN, raison : certification arrêtée à la Phase D conformément à la section 35 de la mission (rotation non prouvée, gates fonctionnelles non déterminantes pour ce verdict).**

## 36. Recommendation for OPS-READY-1

Sans objet tant que R1/R1-bis ne sont pas fermés — OPS-READY-1 ne doit pas être planifié avant qu'une preuve de rotation existe pour l'ensemble des identifiants listés en section 31.

## 37. Recommendation for PROD-1

Ne pas planifier PROD-1. Action humaine requise avant toute reprise de PREP-2-RECHECK :

1. **Zoho** : dans la console développeur Zoho (API Console), révoquer l'application OAuth existante ou régénérer client secret + refresh token, puis mettre à jour `ZOHO_CLIENT_SECRET`/`ZOHO_REFRESH_TOKEN` (et `ZOHO_CLIENT_ID` si l'application est recréée) dans les coffres Render/local — jamais en dur dans le code.
2. **JWT** : générer un nouveau `JWT_SECRET` aléatoire de haute entropie. **Attention opérationnelle** : ceci invalide immédiatement tous les tokens actifs (déconnexion globale de tous les utilisateurs) — à planifier en fenêtre de maintenance annoncée, pas en rotation silencieuse.
3. **Cloudinary** : régénérer `CLOUDINARY_API_SECRET` (et si possible `CLOUDINARY_API_KEY`) depuis la console Cloudinary du compte `dop8vzm5z`. Vérifier l'impact sur les URLs signées actives (TTL courts, donc impact transitoire limité).
4. **Facebook** : régénérer `FACEBOOK_ACCESS_TOKEN` depuis Meta for Developers.
5. **CinetPay** : contacter le support CinetPay pour régénérer `CINETPAY_API_KEY`/`CINETPAY_SITE_ID` si l'API le permet, sinon ouvrir un ticket de rotation.
6. **Google Maps** : régénérer `GOOGLE_MAPS_API_KEY` depuis Google Cloud Console et restreindre par empreinte d'application/domaine.
7. Une fois toutes ces rotations effectuées et les nouvelles valeurs déployées, relancer **PREP-2-RECHECK** — qui recalculera les fingerprints et devrait alors observer `DIFFERENT` partout, avant de poursuivre vers la revalidation complète des gates (sections 13-27 non exécutées ici).
8. Envisager séparément une opération `GIT-HISTORY-SANITIZE-1` (purge d'historique) une fois la rotation confirmée — non bloquante pour le GO si la rotation est prouvée, mais recommandée pour l'hygiène du dépôt.

## 38. Final Verdict

# NO-GO — ZOHO ROTATION REQUIRED

**Constat** : aucune rotation n'a eu lieu. Les identifiants OAuth Zoho actuellement configurés sont cryptographiquement identiques à ceux exposés dans l'historique Git entre le 2026-02-03 et le 2026-07-17. La remédiation appliquée avant PREP-2 (lecture via `process.env` dans `getZohoOrgId.js`) a corrigé la forme du code mais pas la valeur du secret lui-même.

**Découverte aggravante** : l'exposition historique ne se limitait pas à Zoho — les fichiers `.env` complets (racine et mobile) ont été versionnés pendant ~5,5 mois, exposant également `JWT_SECRET`, les credentials Cloudinary, Facebook, CinetPay et Google Maps. Tous ces secrets sont également confirmés non rotés à ce jour (même méthode de fingerprint).

**Action requise avant toute reprise de la certification** : rotation effective, côté fournisseur, de l'ensemble des credentials listés en section 31 — pas seulement Zoho — suivie d'un déploiement des nouvelles valeurs et d'un nouveau passage de PREP-2-RECHECK pour confirmer `DIFFERENT` sur chaque fingerprint avant de poursuivre vers la revalidation complète des gates.

## 39. Explicit Confirmations

- Aucun commit effectué.
- Aucun push effectué.
- Aucun déploiement effectué.
- Aucune migration destructive exécutée.
- Aucun backfill réel exécuté.
- Aucune suppression de données.
- Aucune écriture en production.
- Aucun email utilisateur réel envoyé.
- Aucun appel volontaire à Cloudinary de production (`dop8vzm5z`).
- Aucun asset Cloudinary modifié.
- Aucun secret affiché dans ce rapport — uniquement des empreintes SHA-256 tronquées à 10 caractères, non réversibles, et des verdicts SAME/DIFFERENT.
- Aucun historique Git réécrit.
- Aucun test déclaré PASS sans exécution réelle — les gates fonctionnelles sont explicitement marquées NOT RUN avec leur raison (sections 13-27, 35).
