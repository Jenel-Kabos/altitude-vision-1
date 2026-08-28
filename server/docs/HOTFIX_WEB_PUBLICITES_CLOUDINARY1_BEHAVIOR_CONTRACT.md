# HOTFIX-WEB-PUBLICITES-CLOUDINARY-1 — CONTRAT COMPORTEMENTAL

| Scenario | Before | After |
|---|---|---|
| Image valide, configuration Netlify correcte | Upload réussi, publicité créée | **Inchangé** |
| GIF valide, configuration Netlify correcte | Upload réussi (le champ `type` reste au choix de l'utilisateur, `accept="image/*"` accepte les GIF), publicité créée | **Inchangé** |
| **`cloud_name` manquant (cas de production actuel)** | Requête envoyée vers `/v1_1/undefined/image/upload`, 401 Cloudinary, erreur peu explicite | **Erreur immédiate côté client** ("Configuration d'upload indisponible. Contactez un administrateur."), **aucune requête réseau envoyée** |
| `upload_preset` manquant | Requête envoyée avec `upload_preset: undefined` (comportement Cloudinary non garanti) | **Erreur immédiate côté client, aucune requête réseau envoyée** |
| Cloudinary répond 401 (config toujours invalide au niveau Cloudinary, ex. mauvais preset) | `data.secure_url` absent → `throw new Error('Échec upload Cloudinary')` | **Inchangé** — ce chemin n'a pas été modifié |
| Upload Cloudinary réussi | `createPublicite`/`updatePublicite` appelé avec l'URL réelle | **Inchangé**, prouvé par test |
| Upload Cloudinary échoué (toute cause) | `createPublicite`/`updatePublicite` jamais appelé (déjà garanti par `await` + `try/catch` existant) | **Inchangé**, comportement déjà correct, reconfirmé par test |

## Fichier modifié

`client/lib/services/publiciteService.js::uploadToCloudinary` — ajout d'une vérification `if (!cloudName || !uploadPreset) throw ...` avant la construction de `FormData`/l'appel `fetch`. Aucune autre ligne modifiée. Le nom des variables lues (`NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME`/`NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET`) est **inchangé** — déjà correct.

## Ce qui n'a PAS changé

Modèle Publicité, pôle, ordre, actif/carrousel, dates, ciblage, droits, rôles, tenant, pagination, `createPublicite`/`updatePublicite`/`deletePublicite` (backend), preview locale du fichier, support Image/GIF, mobile (`altimmo-app/` non touché), cache mobile des publicités actives (finding distinct déjà documenté, non traité ici).
