# HOTFIX-WEB-PUBLICITES-CLOUDINARY-1 — MATRICE DES VARIABLES D'ENVIRONNEMENT

Aucune valeur secrète n'est écrite dans ce document. `cloud_name` et `upload_preset` (unsigned) sont par construction des identifiants non secrets — ils apparaissent en clair dans toute requête d'upload Cloudinary depuis n'importe quel navigateur ou l'application mobile ; ce ne sont pas des équivalents de `API_SECRET`.

| Variable | Used by | Client-safe? | Present locally (`.env.local`) ? | Present in `.env.example` ? | Expected in Netlify ? |
|---|---|---|---|---|---|
| `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` | `client/lib/services/publiciteService.js::uploadToCloudinary` (seul usage) | **Oui** — préfixe `NEXT_PUBLIC_`, correct pour un `cloud_name`, jamais un secret | **Oui** | **Oui** (nom documenté, valeur vide) | **Oui — preuve indique absente au dernier build de production** (voir `_ROOT_CAUSE.md`) |
| `NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET` | Idem, même fonction | **Oui** — un preset unsigned est conçu pour être exposé côté client | **Oui** | **Oui** | **Oui — même statut** |
| `CLOUDINARY_CLOUD_NAME` (serveur, sans préfixe) | `server/config/cloudinary.js` (SDK Cloudinary backend, uploads Property/Hotel/etc.) | Non applicable — jamais exposé au navigateur, usage serveur uniquement | Oui (`server/.env`) | Non applicable à ce hotfix | Déjà configurée côté Render (fonctionne pour tous les autres uploads du projet, hors périmètre) |
| `CLOUDINARY_API_KEY`/`CLOUDINARY_API_SECRET` | `server/config/cloudinary.js` | **Non — jamais côté client, confirmé absent de tout code frontend** | Oui (`server/.env`), jamais lu par `client/` | Non applicable | Déjà configurées côté Render |

## Confirmation — aucun secret exposé côté client

Recherche exhaustive de `API_SECRET`/`api_secret`/`API_KEY` dans `client/` : **zéro résultat**. Le frontend web n'utilise et n'a jamais utilisé que `cloud_name` + `upload_preset` (unsigned) — cohérent avec le contrat existant du projet (le mobile fait exactement la même chose, avec la même valeur de `cloud_name`, confirmée par un hotfix mobile antérieur de cette même session).

## Cohérence de l'identité `cloud_name` à travers le projet

La valeur présente dans `.env.local` (`dop8vzm5z`) est **identique** à celle du backend (`server/.env`, `CLOUDINARY_CLOUD_NAME`) et à celle hardcodée côté mobile (`altimmo-app`, confirmé lors d'un hotfix antérieur) — un seul compte Cloudinary pour tout le projet, aucune divergence d'identité à réconcilier.
