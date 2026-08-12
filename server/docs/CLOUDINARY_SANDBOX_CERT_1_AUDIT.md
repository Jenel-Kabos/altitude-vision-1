# CLOUDINARY-SANDBOX-CERT-1 — Audit d'environnement (avant tout appel Cloudinary)

Conformément au principe absolu du sprint (§2) : cet audit a été produit **avant tout appel réseau vers Cloudinary**, quel qu'il soit. Aucune requête Cloudinary (lecture, écriture, ou même simple `ping`) n'a été exécutée à aucun moment de ce sprint.

## 1. Méthode

Recherche exhaustive de toute variable d'environnement Cloudinary dans l'ensemble du dépôt, pas seulement `server/` :

```
grep -riE "CLOUDINARY_SANDBOX|CLOUDINARY_STAGING|CLOUDINARY_TEST|CLOUDINARY_DEV|SANDBOX_CLOUD" \
  --include="*.env*" --include="*.yml" --include="*.yaml" --include="*.toml" --include="*.json" -r .
```
→ **aucun résultat**, y compris hors `.env` (aucun fichier CI/CD, aucun `docker-compose`, aucun `render.yaml`/`netlify.toml` ne référence de second compte Cloudinary).

Fichiers `.env*` du dépôt effectivement inspectés :
`.env`, `.env.example`, `client/.env`, `client/.env.local`, `client/.env.example`, `altimmo-app/.env`, `altimmo-app/.env.example`, `server/.env` (le seul contenant des identifiants Cloudinary API), plus l'environnement shell courant (`env | grep -i CLOUDINARY`, vide).

Variables shell/CI vérifiées : aucune (session locale, aucune variable `CLOUDINARY_*` exportée hors des fichiers `.env`).

## 2. Résultat — un seul compte Cloudinary existe dans ce dépôt

- `server/.env` : `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` — un seul jeu, `cloud_name = dop8vzm5z`.
- `server/.env.example` : reprend exactement le même `cloud_name` (fichier d'exemple non générique — confirme qu'il n'existe qu'un seul compte connu du projet, y compris dans le template destiné aux nouveaux environnements).
- `client/.env.local` et `client/.env.example` : `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME = dop8vzm5z` — **identique** au `cloud_name` backend.
- Ce `cloud_name` (`dop8vzm5z`) est documenté dans le guide de référence du projet comme la variable Netlify de **production** (`NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=dop8vzm5z`, aux côtés de `NEXT_PUBLIC_API_URL=https://altitude-vision.onrender.com/api`), avec le même preset d'upload unsigned (`lqwel6X6`) utilisé à la fois par le site web et l'application mobile en production.
- Aucune variable `CLOUDINARY_SANDBOX_CLOUD_NAME`, `CLOUDINARY_SANDBOX_API_KEY`, `CLOUDINARY_SANDBOX_API_SECRET`, ni aucune convention équivalente (`_STAGING`, `_TEST`, `_DEV`) n'existe nulle part dans le dépôt.
- Aucune variable `CLOUDINARY_SANDBOX_CONFIRM` n'existe (le garde exigé par le sprint §5 ne peut donc de toute façon jamais être satisfait dans cet environnement).

## 3. Conclusion de l'identification d'environnement

Il n'existe **aucun environnement Cloudinary explicitement distinct de la production** dans ce dépôt. Le seul compte disponible (`dop8vzm5z`) est, par preuve directe (même `cloud_name` utilisé côté Netlify pour le site public et pour l'application mobile), le compte de **production**. Conformément au §2 du sprint :

> « Si aucun environnement Cloudinary de test explicitement distinct n'est disponible : ARRÊTER LE SPRINT. »

Aucun appel Cloudinary — pas même la création d'une fixture jetable, pas même un `ping`/`api.ping()` — n'a été tenté. Le sprint s'arrête ici, avant la Phase 2 (protection anti-production), qui n'a par construction rien à protéger puisqu'aucune tentative de connexion n'a eu lieu.

## 4. Ce qui aurait été testable si un sandbox avait existé

Documenté pour référence future (aucune tentative réelle) : les trois `resource_type` déjà couverts par le moteur en mode mocké (`image`, `raw`, `video` — voir `STORAGE_LEGACY_CERT_1_REPORT.md` §6-8) auraient été les candidats naturels pour une certification réelle, avec le même protocole de preuve en 6 étapes déjà exigé par le sprint précédent (public avant → migration → authenticated → old URL inaccessible → accès direct nouveau inaccessible → accès backend autorisé).

## 5. Plan de certification pour un futur sprint (si un sandbox devient disponible)

1. Provisionner un compte Cloudinary distinct, gratuit ou de test, avec un `cloud_name` différent de `dop8vzm5z`.
2. Exposer ses identifiants sous `CLOUDINARY_SANDBOX_CLOUD_NAME`/`CLOUDINARY_SANDBOX_API_KEY`/`CLOUDINARY_SANDBOX_API_SECRET`, jamais en écrasant les variables `CLOUDINARY_*` existantes.
3. Positionner explicitement `CLOUDINARY_SANDBOX_CONFIRM=YES` pour l'exécution du script de certification.
4. Le script de certification (à créer à ce moment-là, `server/scripts/certifyCloudinarySandbox.js`, non créé ce sprint faute d'environnement) devra comparer `CLOUDINARY_SANDBOX_CLOUD_NAME` à `CLOUDINARY_CLOUD_NAME` et refuser (`CLOUDINARY_SANDBOX_PRODUCTION_COLLISION`) toute correspondance, avant le premier appel réseau.
5. Réutiliser strictement `legacyAssetMigrationService`, `verifyOldUrlProof.js` et `secureStorageService` — jamais une réimplémentation parallèle.

## Verdict de cette phase

**BLOCKED — CLOUDINARY SANDBOX REQUIRED.** Voir `CLOUDINARY_SANDBOX_CERT_1_REPORT.md` pour le rapport complet.
