# HOTFIX-WEB-PUBLICITES-CLOUDINARY-1 — MATRICE DE TESTS

## `publiciteService.test.js` (nouveau, 4 tests)

| Test | Rouge avant correctif ? | Vert après correctif ? |
|---|---|---|
| `cloud_name` manquant → aucune requête, erreur claire | **Oui** — l'ancien code appelait `fetch` puis plantait sur `Cannot read properties of undefined (reading 'json')` | Oui |
| `upload_preset` manquant → aucune requête, erreur claire | **Oui**, même symptôme | Oui |
| Configuration valide + succès → URL correcte, jamais "undefined", `secure_url` retourné | Déjà vert (chemin non modifié) | Oui |
| Configuration valide + échec Cloudinary (pas de `secure_url`) → erreur explicite | Déjà vert (chemin non modifié) | Oui |

## `PublicitesPageUpload.test.jsx` (nouveau, 2 tests) — mandat §30-33/§39-42

| Test | Résultat |
|---|---|
| Échec de l'upload → `createPublicite` jamais appelé, message d'erreur affiché | ✅ Vert — confirme qu'aucune publicité partielle (media vide/undefined) ne peut être créée |
| Succès de l'upload → `createPublicite` appelé avec l'URL Cloudinary réelle | ✅ Vert |

## Suites rejouées

| Suite | Résultat |
|---|---|
| `publiciteService.test.js` (nouveau) | 4/4 ✅ |
| `PublicitesPageUpload.test.jsx` (nouveau) | 2/2 ✅ |
| Suite client complète (`npm test`, 103 fichiers) | 741/745 ✅ — 4 échecs préexistants (`ManageHotelsPage.test.jsx`/`ManageAccommodationsPage.test.jsx`), confirmés sans rapport pour la **5ᵉ fois consécutive** à travers cinq sprints indépendants de cette session |
| `npm run lint` (fichiers touchés/créés) | 0 erreur, 0 warning |
| `npm run build:next` | Réussi — a permis de confirmer l'inlining correct des variables avec `.env.local` (preuve définitive, voir `_ROOT_CAUSE.md`) |
| `git diff --check` | Propre |

## Backend / Architecture

Aucun fichier backend modifié — `test:unit`/`architecture:check` non requis (mandat §45/§46, conditionnés à une modification backend). Aucune suite backend rejouée par précaution supplémentaire, jugée non nécessaire : le bug et son correctif sont entièrement contenus dans une seule fonction frontend, sans interaction avec l'API `/publicites` elle-même (payload envoyé à `createPublicite` inchangé dans sa forme).
