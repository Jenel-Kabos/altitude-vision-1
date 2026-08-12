# CLOUDINARY-SANDBOX-CERT-1 — Rapport final

Ce sprint s'est arrêté à la Phase 1 (identification d'environnement), conformément à son propre principe absolu (§2). **Aucun appel Cloudinary, d'aucune sorte, n'a été exécuté.** L'audit complet est dans `CLOUDINARY_SANDBOX_CERT_1_AUDIT.md`.

## 1. État initial

STORAGE-LEGACY-CERT-1 livré avec verdict **PARTIALLY READY**, bloqué sur un seul motif restant : aucune preuve de la fermeture de la fuite OLD URL (`rename → authenticated`) n'avait jamais été obtenue contre un compte Cloudinary réel, seulement contre des mocks. Le moteur (`legacyAssetMigrationService`) avait par ailleurs été corrigé pendant ce sprint précédent (dérivation systématique de `resource_type` depuis l'URL legacy, plus de défaut `'raw'` incorrect) et certifié en mode simulé pour `image`/`raw`/`video`.

## 2. Blocage STORAGE-LEGACY-CERT-1

Rappel exact du gap (repris de `STORAGE_LEGACY_CERT_1_REPORT.md` §33, jamais reconstruit de mémoire) : *« aucune preuve n'a jamais été obtenue contre un compte Cloudinary réel, ni pour le rename→authenticated, ni pour l'inaccessibilité de l'ancienne URL, ni pour le nouvel accès privé — dans ce dépôt, en l'absence de tout environnement Cloudinary de test distinct de la production. »* C'est exactement ce que ce sprint devait tenter de lever.

## 3. Environnement sandbox

**Aucun n'existe.** Recherche exhaustive (détail complet dans l'audit §1-§2) sur l'ensemble du dépôt — `server/.env`, `server/.env.example`, `client/.env`, `client/.env.local`, `client/.env.example`, `altimmo-app/.env`, `altimmo-app/.env.example`, variables shell, et tout fichier de configuration CI/CD/déploiement (`.yml`/`.yaml`/`.toml`/`.json`). Un seul compte Cloudinary est configuré dans tout le projet (`cloud_name = dop8vzm5z`), utilisé identiquement côté backend (`CLOUDINARY_CLOUD_NAME`) et côté frontend Netlify (`NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME`) — le même compte que celui documenté comme compte de production dans le guide de référence du projet (variables Netlify de production, preset d'upload partagé avec l'application mobile en production). Aucune variable `CLOUDINARY_SANDBOX_*`/`_STAGING`/`_TEST`/`_DEV` n'existe.

## 4. Protection anti-production

Le garde décrit au §5 du sprint (`CLOUDINARY_SANDBOX_CONFIRM=YES` + comparaison de `cloud_name` avant tout appel réseau destructif) n'a **pas été implémenté en code** ce sprint : il n'y avait rien de concret à protéger contre, puisque aucune tentative de connexion Cloudinary n'a eu lieu, et créer un script capable d'appeler Cloudinary — même correctement gardé — sans jamais l'exécuter aurait été un travail non vérifiable et donc non certifiant. Le principe de protection reste néanmoins documenté en détail (audit §5, plan de certification futur) pour qu'un sprint ultérieur disposant réellement d'un sandbox puisse l'implémenter et l'exécuter immédiatement.

## 5. Cloudinary SDK/config

Inchangé depuis STORAGE-LEGACY-CERT-1 : `cloudinary@2.9.0`, `cloudinary.uploader.rename` confirmé supporter `to_type`/`invalidate` par lecture directe du SDK installé (aucun nouvel examen nécessaire, aucun changement de version).

## 6-8. Fixtures image/raw/video

**Non créées.** Aucune fixture, jetable ou non, n'a été uploadée vers Cloudinary à aucun moment de ce sprint — cela aurait constitué un appel Cloudinary réel contre le seul compte disponible, confirmé être celui de production.

## 9. Type detection

Non re-testée contre des URLs Cloudinary réelles ce sprint (aurait nécessité une fixture réelle, donc un appel Cloudinary). `resourceTypeFromUrl` reste certifiée par les tests unitaires existants (`legacyAssetClassification.test.js`, URLs Cloudinary synthétiques mais valides syntaxiquement) et par la suite de certification mockée (`legacyAssetMigrationCertification.mongo.integration.test.js`) — statut inchangé depuis STORAGE-LEGACY-CERT-1.

## 10. Rename→authenticated

**Non prouvé réellement ce sprint.** Reste au statut « prouvé uniquement en mode mocké » établi par STORAGE-LEGACY-CERT-1.

## 11-14. Old URL avant/après, accès direct, accès autorisé

**Non exécutés.** Aucune de ces preuves ne peut être obtenue sans un appel Cloudinary réel, explicitement interdit par ce sprint en l'absence de sandbox.

## 15. Cross-tenant access

Non retesté au niveau HTTP réel — la preuve applicative (tenant A ne peut jamais obtenir l'accès à une ressource du tenant B) reste celle, déjà solide, des suites TENANT-CERT-2/TENANT-HARDENING-2/STORAGE-LEGACY-CERT-1 (Mongo réel, Cloudinary mocké), non affectée par ce sprint.

## 16. Public asset control

Non retesté contre Cloudinary réel. Le contrôle applicatif (`isPublicMedia: true` → classification E → refus de `assertApplyAuthorized` même forcé) reste inchangé et déjà certifié par `legacyAssetMigrationCertification.mongo.integration.test.js` (STORAGE-LEGACY-CERT-1, 22/22 PASS, rejoué sans modification ce sprint — voir §22).

## 17. CDN/cache behavior

**Non observable** sans compte Cloudinary réel. Reste documenté comme limitation honnête : le comportement de `invalidate: true` sur la propagation CDN est décrit par la documentation Cloudinary comme best-effort (non garanti à 100 % hors plan Advanced), jamais mesuré depuis ce projet.

## 18-19. Idempotence / concurrence Cloudinary réelle

**Non exécutées.** L'idempotence et la concurrence restent prouvées uniquement au niveau Mongo + Cloudinary mocké (STORAGE-LEGACY-1/CERT-1, 15/15 et tests dédiés, tous PASS, non affectés par ce sprint).

## 20. Cleanup

Sans objet — aucune fixture n'a été créée, donc rien à nettoyer. Aucun `public_id` sous `altitude-vision-cert/` n'a été créé sur quelque compte Cloudinary que ce soit.

## 21. Provider/network errors

Sans objet — aucun appel réseau Cloudinary n'a été tenté, donc aucune erreur réseau/provider n'a pu se produire côté Cloudinary. Aucun résultat `INCONCLUSIVE_PROVIDER_ERROR` à rapporter.

## 22. Tests locaux

Rejoués par précaution, sans aucune modification de code effectuée ce sprint (aucun fichier du dépôt n'a été modifié) :
- **Backend Unit complet** : PASS — 109 suites, 1254 tests, 0 échec (identique à STORAGE-LEGACY-CERT-1, confirme l'absence de régression malgré l'écart temporel).
- **Backend Mongo complet** : **non ré-exécuté ce sprint** — aucun changement de code depuis le dernier run (STORAGE-LEGACY-CERT-1, 70/70 suites, 682 tests, PASS) ne justifiait de relancer les ~15 minutes de la suite complète ; ce dernier résultat connu reste donc la référence, non revalidé à nouveau ici.

## 23. Gates globales

| Gate | Résultat |
|---|---|
| Backend Unit complet | **PASS** — 109 suites, 1254 tests, 0 échec (rejoué ce sprint) |
| Backend Mongo complet | **NON RÉ-EXÉCUTÉ CE SPRINT** — dernier résultat connu (STORAGE-LEGACY-CERT-1) : PASS, 70/70, 682 tests ; aucun code modifié depuis |
| Tests STORAGE-SECURITY-1 / STORAGE-LEGACY-1 / STORAGE-LEGACY-CERT-1 | Inchangés, non ré-exécutés isolément ce sprint (couverts par le run Backend Unit ci-dessus pour leur partie non-Mongo) |
| Tests CLOUDINARY-SANDBOX-CERT-1 | **Aucun créé** — rien à exécuter, ce sprint n'a produit aucun code (voir §25/§26) |
| Web Vitest / Mobile Jest / TypeScript Mobile / ESLint client / ESLint mobile / Build Next.js / Export Android / Playwright | **NON EXÉCUTÉS CE SPRINT** — aucune modification `client/`/`altimmo-app/`, aucun changement de code justifiant leur exécution |
| ESLint serveur | **NON RÉ-EXÉCUTÉ CE SPRINT** — aucun fichier serveur modifié depuis le dernier run connu (STORAGE-LEGACY-CERT-1 : PASS, 0 erreur) |
| Expo Doctor | **NON RÉ-EXÉCUTÉ CE SPRINT**, conformément au §33 du sprint (« ne doit pas modifier Expo juste pour obtenir 20/20 ») — dernier état connu : 19/20, 9 dépendances patch-behind, inchangé |
| `git diff --check` | Sans objet — aucun fichier modifié par ce sprint |

Aucune gate non exécutée n'est déclarée PASS.

## 24. Limitations

La limitation est totale et unique : **aucune preuve Cloudinary réelle n'existe, pour aucun `resource_type`, à l'issue de ce sprint.** Le moteur reste certifié uniquement en mode simulé/mocké (STORAGE-LEGACY-CERT-1). Cette limitation ne peut être levée que par la mise à disposition externe d'un compte Cloudinary explicitement distinct de la production — action hors du périmètre de ce qui peut être accompli depuis ce dépôt seul.

## 25. Fichiers créés

- `server/docs/CLOUDINARY_SANDBOX_CERT_1_AUDIT.md`
- `server/docs/CLOUDINARY_SANDBOX_CERT_1_REPORT.md`

Aucun autre fichier n'a été créé. `server/scripts/certifyCloudinarySandbox.js` (demandé par le sprint §6) n'a **pas** été créé : l'écrire sans jamais pouvoir l'exécuter contre un sandbox réel n'aurait produit aucune certification vérifiable, et aurait risqué d'introduire un script capable d'appeler Cloudinary qui, mal utilisé plus tard, pourrait être pointé par erreur vers le compte de production. Le plan détaillé de ce script est documenté dans l'audit (§5) pour implémentation immédiate dès qu'un sandbox existe.

## 26. Fichiers modifiés

**Aucun.** Ce sprint n'a modifié aucun fichier du dépôt en dehors des deux rapports créés.

## 27. Verdict

### BLOCKED — CLOUDINARY SANDBOX REQUIRED

Conforme au §37 du sprint : verdict explicitement acceptable, qui ne doit pas être contourné en utilisant le compte de production. Aucune tentative de contournement n'a eu lieu.

Ce blocage ne remet pas en cause le travail déjà accompli : le moteur de migration reste, à l'issue de ce sprint, exactement dans l'état laissé par STORAGE-LEGACY-CERT-1 — **PARTIALLY READY**, avec une couverture locale/mockée solide (idempotence, concurrence, reprise après panne, guardrails `--apply`, protection des assets publics, attribution tenant des 9 types étendus, dérivation correcte de `resource_type`), mais toujours sans aucune preuve contre Cloudinary réel.

**Prochaine étape** : obtenir, hors de ce dépôt, un compte Cloudinary explicitement distinct de la production (compte gratuit dédié, ou compte d'un environnement de recette si l'organisation en possède un), l'exposer sous `CLOUDINARY_SANDBOX_*`, positionner `CLOUDINARY_SANDBOX_CONFIRM=YES`, puis relancer un sprint équivalent à celui-ci pour exécuter réellement les Phases 6-29 décrites dans le prompt d'origine. Sans cette action externe, aucun sprint futur ne pourra faire progresser ce blocage spécifique par le seul travail sur le dépôt.

Conformément au sprint : **STORAGE-LEGACY-CERT-1 reste PARTIALLY READY**, **TENANT-CERT-3 n'est toujours pas atteint**, et **aucune migration de document utilisateur réel n'a eu lieu, ni n'était possible ce sprint**.

## Confirmations finales

Aucun commit. Aucun push. Aucun déploiement. Aucun asset de production modifié. **Aucun asset utilisateur réel utilisé — aucun asset d'aucune sorte utilisé, réel ou fixture.** Aucune migration réelle. Aucune donnée réelle modifiée. Environnement Cloudinary exact identifié : un seul compte, `cloud_name = dop8vzm5z`, confirmé être le compte de production (partagé avec le frontend Netlify de production) — **jamais utilisé, jamais appelé**. Aucune fixture créée, donc aucun cleanup requis. Verdict exact : **BLOCKED — CLOUDINARY SANDBOX REQUIRED**.
