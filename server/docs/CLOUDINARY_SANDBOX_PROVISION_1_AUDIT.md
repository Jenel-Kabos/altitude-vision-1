# CLOUDINARY-SANDBOX-PROVISION-1 — Audit

Lecture obligatoire effectuée avant toute modification : `STORAGE_SECURITY_1_AUDIT.md`, `STORAGE_SECURITY_1_REPORT.md`, `STORAGE_LEGACY_1_AUDIT.md`, `STORAGE_LEGACY_1_REPORT.md`, `STORAGE_LEGACY_CERT_1_AUDIT.md`, `STORAGE_LEGACY_CERT_1_REPORT.md`, `CLOUDINARY_SANDBOX_CERT_1_AUDIT.md`, `CLOUDINARY_SANDBOX_CERT_1_REPORT.md`, ainsi que `server/config/cloudinary.js`.

## 1. Fingerprint Cloudinary de production — confirmée

`server/.env` (`CLOUDINARY_CLOUD_NAME`) : `dop8vzm5z`. Confirmée identique dans `client/.env.local` (`NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=dop8vzm5z`), le fichier réellement utilisé par le frontend Netlify en production selon le guide de référence du projet. **`dop8vzm5z` est la fingerprint Cloudinary de production actuellement connue de ce dépôt.**

Précision par rapport à `CLOUDINARY_SANDBOX_CERT_1_AUDIT.md` : ce rapport précédent indiquait que `.env.example` « reprend exactement le même cloud_name » — vérification directe faite ce sprint : c'est inexact, `.env.example` (racine du dépôt) contient des clés vides (`CLOUDINARY_CLOUD_NAME=`), pas de valeur réelle. La conclusion de fond (un seul compte réel existe, celui de production) reste cependant entièrement correcte et re-confirmée ici par lecture directe de `server/.env` et `client/.env.local`, les deux seuls fichiers contenant une vraie valeur.

## 2. Nouvel audit READ-ONLY — aucune configuration sandbox trouvée

Recherche exhaustive, élargie par rapport à `CLOUDINARY_SANDBOX_CERT_1_AUDIT.md`, incluant explicitement Netlify/Render/EAS/CI :

- `grep -riE "CLOUDINARY_SANDBOX|CLOUDINARY_STAGING|CLOUDINARY_TEST|CLOUDINARY_DEV|SANDBOX_CLOUD"` sur tous les `.env*`/`.yml`/`.yaml`/`.toml`/`.json` du dépôt → aucun résultat.
- `netlify.toml`, `render.yaml` (absent du dépôt — configuration Render gérée hors dépôt) : aucune référence Cloudinary.
- `.github/` : une seule occurrence, dans `pull_request_template.md` (une case à cocher de checklist, « Les images sont optimisées (Cloudinary) ») — aucune configuration.
- `altimmo-app/eas.json`, `altimmo-app/app.config.js` : aucune référence Cloudinary (l'app mobile utilise un preset d'upload unsigned côté client, jamais de clé API secrète).
- Variables shell de la session courante (`env | grep -i CLOUDINARY`) : vide.

**Confirmation : aucun environnement Cloudinary distinct de la production n'existe dans ce dépôt ni dans son environnement d'exécution local.** Ce sprint ne pouvait donc, par construction, produire qu'un verdict `PROVISIONING READY — CREDENTIALS REQUIRED` (préparation de l'architecture) ou `BLOCKED` (si l'isolation elle-même s'avérait impossible à garantir) — jamais `SANDBOX CONFIGURED`.

## 3. Risque réel découvert (Phase 30) — configuration Cloudinary globale au process

En concevant le guard anti-collision, l'examen du SDK installé (`node_modules/cloudinary/lib/config.js`) révèle que la configuration Cloudinary (`cloud_name`/`api_key`/`api_secret`) est stockée dans une variable `let cloudinary_config` au niveau du **module**, partagée par tout code appelant `require('cloudinary')` dans le même process Node — y compris `cloudinary.v2` importé séparément par deux fichiers différents, qui obtiennent la même instance mise en cache par Node.

**Conséquence concrète** : une tentative naïve d'« isoler » un client sandbox par instanciation (`Object.create(cloudinary)`, ou toute variante similaire) n'offre **aucune isolation réelle** — `.config()` appelé sur un objet dérivé referme toujours sur la même variable de module. Si un script de certification sandbox futur était importé dans le même process qu'un contrôleur métier ayant déjà chargé `server/config/cloudinary.js` (ce qui est le cas de facto pour tout test Jest qui importe des routes/contrôleurs), appeler la configuration sandbox **écraserait silencieusement la configuration de production en mémoire** pour le reste du process — un risque de fuite croisée bien plus insidieux qu'une simple erreur de variable d'environnement, puisqu'aucune erreur ne serait levée.

Ce risque n'existait pas concrètement avant ce sprint (aucun code sandbox n'existait), mais aurait été introduit silencieusement par toute implémentation naïve de la Phase 9 du sprint. Il est neutralisé par `assertProcessIsolation()` dans `server/config/cloudinarySandbox.js` : avant toute création de client sandbox, ce garde vérifie `require.cache` pour détecter si `config/cloudinary.js` (production) a déjà été chargé dans le process courant, et refuse (`CLOUDINARY_SANDBOX_PROCESS_ISOLATION_REQUIRED`) le cas échéant. Testé par `cloudinarySandboxConfig.test.js` (« isolation de process »).

## 4. Types testables — inchangé

Rien de nouveau ce sprint : les trois `resource_type` déjà couverts en mode mocké (`image`/`raw`/`video`, voir `STORAGE_LEGACY_CERT_1_REPORT.md` §6-8) restent les candidats pour une future certification réelle. Aucune capacité Cloudinary (upload/rename/destroy/authenticated delivery/signed access) n'a été vérifiée empiriquement pour un plan Cloudinary Free — documenté comme à vérifier lors de la certification réelle, jamais supposé (`CLOUDINARY_SANDBOX_PROVISIONING.md`, dernière section).

## 5. Architecture proposée (implémentée ce sprint)

- `server/config/cloudinaryProductionFingerprint.js` : source unique de la fingerprint production (`CLOUDINARY_CLOUD_NAME` lu dynamiquement, jamais recopié en dur).
- `server/config/cloudinarySandbox.js` : validation locale pure (`validateSandboxConfig`), garde d'assertion (`assertSandboxConfigValid`), garde d'isolation de process (`assertProcessIsolation`), et factory de client sandbox (`createSandboxCloudinaryClient`, jamais appelée par ce sprint — aucun appel réseau). N'importe jamais `config/cloudinary.js`.
- `server/scripts/checkCloudinarySandbox.js` : preflight exécutable seul, aucun appel réseau, sortie JSON sans secret.
- `.env.example` (racine) : placeholders `CLOUDINARY_SANDBOX_*` documentés, aucune valeur réelle.
- `server/docs/CLOUDINARY_SANDBOX_PROVISIONING.md` : procédure opérateur humain.

Aucune modification de `server/config/cloudinary.js` (production) — le comportement Cloudinary normal de l'application reste strictement inchangé.

## 6. Risques restants

Aucun appel réseau Cloudinary n'a été effectué ce sprint — le risque principal (collision avec la production) reste théorique tant qu'aucun vrai sandbox n'est fourni, mais l'architecture est conçue pour le refuser structurellement dès qu'une tentative aurait lieu. Risque résiduel documenté : la garde de collision compare des chaînes de caractères (`cloud_name`) — un opérateur qui provisionnerait un second compte Cloudinary et lui donnerait accidentellement le même nom que la production (peu probable, Cloudinary garantit l'unicité des `cloud_name`) resterait néanmoins protégé par construction, puisque deux comptes distincts ne peuvent techniquement pas partager le même `cloud_name`.
