# CLOUDINARY-SANDBOX-PROVISION-1 — Rapport final

Aucun appel Cloudinary, d'aucune sorte, n'a été effectué pendant ce sprint. L'audit complet est dans `CLOUDINARY_SANDBOX_PROVISION_1_AUDIT.md`.

## 1. État initial

`CLOUDINARY-SANDBOX-CERT-1` s'était arrêté en Phase 1 avec `BLOCKED — CLOUDINARY SANDBOX REQUIRED` : un seul compte Cloudinary existe dans ce dépôt (`cloud_name = dop8vzm5z`), confirmé être celui de production. `STORAGE-LEGACY-CERT-1` reste à `PARTIALLY READY`, le moteur de migration certifié uniquement en mode mocké.

## 2. Résultat de l'audit

Recherche exhaustive élargie (Netlify/Render/EAS/CI inclus, détail complet dans l'audit §2) : **aucune variable `CLOUDINARY_SANDBOX_*`/`_STAGING`/`_TEST`/`_DEV` n'existe nulle part dans ce dépôt ni dans l'environnement d'exécution local.** Confirmation stricte du constat de `CLOUDINARY_SANDBOX_CERT_1_AUDIT.md`.

## 3. Cloudinary production identifié

`cloud_name = dop8vzm5z` (`server/.env` → `CLOUDINARY_CLOUD_NAME`), confirmé identique à `client/.env.local` (`NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME`), le compte réellement utilisé en production selon le guide de référence du projet.

## 4. Sandbox identifié ou absent

**Absent.** Aucune action de provisionnement externe (création d'un second compte Cloudinary) n'a été effectuée ni tentée — hors du périmètre de ce qui peut être accompli par un agent automatisé sur ce dépôt (§3 du sprint : « Tu NE DOIS PAS créer un compte Cloudinary »).

## 5. Architecture de configuration

Nouveau module `server/config/cloudinarySandbox.js`, strictement séparé de `server/config/cloudinary.js` (production, jamais importé). Validation locale en 4 étapes ordonnées et fail-closed : absence totale de configuration → configuration partielle → confirmation manquante → collision avec la production. Chaque étape retourne un code d'erreur explicite et typé, jamais un comportement dégradé silencieux.

## 6. Variables sandbox

Convention standardisée, documentée dans `.env.example` (racine) avec commentaire explicite (« Never reuse production Cloudinary credentials here ») :
```
CLOUDINARY_SANDBOX_CLOUD_NAME=
CLOUDINARY_SANDBOX_API_KEY=
CLOUDINARY_SANDBOX_API_SECRET=
CLOUDINARY_SANDBOX_CONFIRM=
```
Aucune valeur réelle n'a été écrite dans `.env.example` ni ailleurs.

## 7. Protection anti-production

`validateSandboxConfig()` compare `CLOUDINARY_SANDBOX_CLOUD_NAME` à la fingerprint de production (`server/config/cloudinaryProductionFingerprint.js`, source unique, lue dynamiquement depuis `CLOUDINARY_CLOUD_NAME` — jamais recopiée en dur à plusieurs endroits). Toute correspondance → `CLOUDINARY_SANDBOX_PRODUCTION_COLLISION`, avant tout appel réseau (par construction : la fonction de validation ne contient elle-même aucun appel réseau). Testé (test 4, `git diff` inclus).

**Découverte supplémentaire non prévue par le prompt initial (Phase 30)** : le SDK Cloudinary Node partage sa configuration au niveau du module entre tous les importateurs du même process — une isolation par instance (`Object.create`) est illusoire. Un garde dédié (`assertProcessIsolation`, code `CLOUDINARY_SANDBOX_PROCESS_ISOLATION_REQUIRED`) refuse de créer un client sandbox si `config/cloudinary.js` (production) est déjà chargé dans le process courant — détail complet en audit §3. Testé (« isolation de process »).

## 8. Protection anti-fallback

Aucune variable `CLOUDINARY_SANDBOX_*` ne retombe jamais sur `CLOUDINARY_CLOUD_NAME`/`CLOUDINARY_API_KEY`/`CLOUDINARY_API_SECRET`/`CLOUDINARY_URL` — `readSandboxEnv()` ne lit que les variables `CLOUDINARY_SANDBOX_*`, sans aucune valeur par défaut. Testé explicitement (test 5 : credentials production présents, sandbox absent → `NOT_CONFIGURED`, jamais un repli).

## 9. Gestion des secrets

`.env` (racine, `server/`, `client/`, `altimmo-app/`) déjà couvert par `.gitignore` (vérifié : `server/.env`, `client/.env`, `client/.env.local`, `.env`, `.env.*` avec exception explicite `!.env.example`, `altimmo-app/.env`, `altimmo-app/.env.*` avec exception `!altimmo-app/.env.example`). Aucune modification de `.gitignore` nécessaire. Aucun secret réel n'a été écrit dans un document, un test, une fixture ou un log — vérifié explicitement par test (test 7 : le résultat de validation ne contient jamais la valeur du secret fourni). Le preflight (`checkCloudinarySandbox.js`) masque systématiquement le `cloud_name` affiché et n'affiche jamais `API_KEY`/`API_SECRET`.

## 10. Preflight

`server/scripts/checkCloudinarySandbox.js` — exécutable seul (`node server/scripts/checkCloudinarySandbox.js`), aucun appel réseau, sortie JSON masquée. Vérifié manuellement pour les 4 scénarios (absent/collision/partiel/valide synthétique), résultats conformes dans chaque cas — codes de sortie `0` (valide) / `1` (invalide) corrects.

## 11. Tests collision

Test dédié (§13 du sprint) : `CLOUDINARY_SANDBOX_CLOUD_NAME=dop8vzm5z` → `CLOUDINARY_SANDBOX_PRODUCTION_COLLISION`, zéro appel réseau (vérifié par mock Jest du module `cloudinary` : `config`/`uploader.upload`/`uploader.rename`/`uploader.destroy`/`api.resource`/`api.ping` tous à zéro appel). PASS.

## 12. Tests fail-closed

11 tests dans `cloudinarySandboxConfig.test.js` couvrant les 8 scénarios minimaux demandés (§28 du sprint) : sandbox absent, confirmation absente, config partielle (2 variantes), collision, anti-fallback, config synthétique distincte acceptée, secrets jamais dans la sortie, aucun appel réseau même en scénario valide, plus le test dédié à l'isolation de process. Tous PASS.

## 13. Namespace fixtures

Réservé et documenté (`altitude-vision-cert/<run-id>/`), repris tel quel de `CLOUDINARY_SANDBOX_CERT_1` — aucune fixture créée ce sprint, donc aucun usage réel de ce namespace.

## 14. Cleanup policy

Documentée dans `CLOUDINARY_SANDBOX_PROVISIONING.md` et rappelée : toute suppression Cloudinary future devra vérifier le préfixe `altitude-vision-cert/` avant `destroy` — non implémentée en code ce sprint (aucun script de certification réseau n'a été créé, voir §18 ci-dessous), donc rien à tester concrètement à ce stade.

## 15. Documentation opérateur

`server/docs/CLOUDINARY_SANDBOX_PROVISIONING.md` — 9 étapes précises (création du compte → récupération des identifiants → vérification de non-collision → configuration locale → interdiction Git → preflight → reprise du sprint suivant), plus une section dédiée à l'isolation de process et une section sur les capacités Cloudinary à vérifier (jamais supposées).

## 16. Gates exécutées

| Gate | Résultat |
|---|---|
| Tests sandbox dédiés (`cloudinarySandboxConfig.test.js`) | **PASS** — 11/11 |
| Backend Unit complet | **PASS** — 110 suites, 1265 tests, 0 échec (un flake isolé sur `rentalPropertyRoutes.test.js` observé sur un run, non reproductible : suite standalone 16/16 PASS, puis run complet suivant 110/110 PASS — non lié à ce sprint) |
| Backend Mongo complet | **NOT RUN — NO IMPACT** : aucun runtime backend partagé modifié (uniquement des fichiers nouveaux, isolés, jamais importés par le code métier existant) ; conforme au §32 du sprint |
| ESLint serveur | **PASS** — 0 erreur, 127 warnings (identique à la ligne de base d'avant ce sprint ; 0 warning provenant des fichiers créés/modifiés ce sprint) |
| `git diff --check` | **PASS** — aucune erreur d'espace ou marqueur de conflit (avertissements CRLF préexistants et non liés à ce sprint) |
| Web Vitest / Mobile Jest / TypeScript Mobile / Expo Doctor / ESLint client / ESLint mobile / Build Next.js / Export Android / Playwright | **NOT RUN — NO IMPACT** : aucune modification `client/`/`altimmo-app/` ce sprint |

Aucune gate non exécutée n'est déclarée PASS.

## 17. Limitations

Identiques à celles de `CLOUDINARY_SANDBOX_CERT_1_REPORT.md` — aucune preuve Cloudinary réelle n'existe toujours pour aucun `resource_type`. Ce sprint prépare l'infrastructure de guard nécessaire, sans pouvoir la faire progresser davantage sans action humaine externe (provisionnement effectif d'un compte).

## 18. Fichiers créés

- `server/config/cloudinaryProductionFingerprint.js`
- `server/config/cloudinarySandbox.js`
- `server/scripts/checkCloudinarySandbox.js`
- `server/__tests__/cloudinarySandboxConfig.test.js`
- `server/docs/CLOUDINARY_SANDBOX_PROVISIONING.md`
- `server/docs/CLOUDINARY_SANDBOX_PROVISION_1_AUDIT.md`
- `server/docs/CLOUDINARY_SANDBOX_PROVISION_1_REPORT.md`

`server/scripts/certifyCloudinarySandbox.js` (le futur script de certification réseau, §24 du sprint) n'a **pas** été créé — conforme à l'instruction explicite du sprint (« ne crée le script réseau maintenant que si cela améliore réellement la sécurité ; sinon laisse sa création à la reprise de CLOUDINARY-SANDBOX-CERT-1 »). L'écrire sans jamais pouvoir l'exécuter contre un sandbox réel n'aurait rien certifié.

## 19. Fichiers modifiés

- `.env.example` (racine) : ajout des 4 placeholders `CLOUDINARY_SANDBOX_*` avec commentaire explicite, aucune valeur réelle.

## 20. Verdict

### PROVISIONING READY — CREDENTIALS REQUIRED

L'architecture de configuration sandbox est prête : convention de variables standardisée, garde anti-collision avec fingerprint production centralisée, garde anti-fallback, garde d'isolation de process (risque réel découvert et neutralisé ce sprint), preflight local sans appel réseau, documentation opérateur complète, 11 tests automatisés tous verts prouvant l'absence de tout appel réseau dans chaque scénario d'échec. **Aucun véritable compte Cloudinary sandbox n'a encore été fourni** — action humaine requise, hors de portée de ce sprint (voir `CLOUDINARY_SANDBOX_PROVISIONING.md`).

Conformément au §36 du sprint : cette validation certifie les **guards**, pas Cloudinary lui-même. Aucune certification Cloudinary n'est déclarée.

## 21. Confirmation

Aucun commit. Aucun push. Aucun déploiement. Aucun appel Cloudinary de production. Aucun upload de production. Aucun `destroy` de production. Aucune migration réelle. Aucun asset utilisateur touché — aucun asset d'aucune sorte créé ou touché, réel ou fixture. Aucun secret ajouté au dépôt (`.env.example` ne contient que des clés vides). Aucune donnée de production modifiée. Environnement Cloudinary exact utilisé : **aucun** — zéro appel réseau Cloudinary pendant tout ce sprint. Cleanup : sans objet, aucune fixture créée. Verdict exact : **PROVISIONING READY — CREDENTIALS REQUIRED**.
