# HOTFIX-MOB-ADD-PROPERTY-1 — Matrice FormData (`uploadToCloudinary`)

Seul point de construction FormData dans le parcours de publication vente/location/hébergement (`altimmo-app/src/services/annonceService.js`). Le reste du payload (`buildSalePropertyPayload` → `creerAnnonce`) est envoyé en JSON pur via axios, jamais en FormData.

| Champ | Valeur UI | Type JS avant `.append()` | Type envoyé (partie FormData) | Backend attendu |
|---|---|---|---|---|
| `file` | URI locale de la photo sélectionnée (`expo-image-picker`, `res.assets[i].uri`) | `string` (`file://...` ou `content://...`) | Objet `{uri, name, type}` — forme classique RN, jamais un `Blob`/`File` web | Cloudinary `auto/upload` (endpoint tiers, pas notre backend) — accepte `multipart/form-data`, champ `file` |
| `upload_preset` | Constante fixe `'lqwel6X6'` | `string` | `string` | Cloudinary — preset non signé, doit matcher exactement |

## Cause racine confirmée

`uploadToCloudinary` utilisait `fetch()` global pour poster ce FormData vers Cloudinary. Depuis Expo SDK 57 (installé ici — `expo: ~57.0.13`, confirmé dans `package.json`), `expo/fetch` **remplace `fetch()` global par défaut** sur Android/iOS (confirmé via la documentation Expo v57 officielle). Son implémentation WinterCG ne reconnaît pas la forme `{uri, name, type}` héritée de React Native pour une partie fichier — elle attend un vrai `Blob`/`File` — et lève **`Unsupported FormDataPart implementation`** dès l'appel `fetch()`, avant même l'envoi réseau. Cette exception n'était interceptée par aucun `try/catch` local dans `uploadToCloudinary` : elle remontait telle quelle (message technique brut inclus) jusqu'au `catch` de `handlePublish` dans `AddSalePropertyScreen.jsx`, qui l'affichait directement à l'utilisateur via `Alert.alert('Erreur', err.message)`.

**Preuve que ce n'est pas propre à Cloudinary/au type de fichier** : tous les autres uploads de fichiers de l'app (`ProfilScreen.jsx` — photo de profil, `transactionService.js`, `tenantPortalService.js`, `realEstateApplicationService.js`, `ChatScreen.jsx`) utilisent la **même forme `{uri, name, type}`** mais via **axios** (`api.patch`/`api.post`), jamais via `fetch()` global. Axios, sur React Native, passe par `XMLHttpRequest`, qui n'est pas affecté par le remplacement de `fetch()` par `expo/fetch` — ce qui explique pourquoi seule la publication de bien (le seul endroit du code qui utilisait `fetch()` directement) était cassée.

## Correctif appliqué

`uploadToCloudinary` bascule sur `axios.post(url, fd, { headers: { 'Content-Type': 'multipart/form-data' } })` — réutilise le pattern déjà éprouvé partout ailleurs dans l'app, sans nouvelle librairie. Aucune modification de la forme `{uri, name, type}` elle-même (elle était déjà correcte ; c'est le transport qui était en cause). Une instrumentation DEV-only (`logFormDataPartDev`, jamais de contenu binaire — uniquement nom de champ, type JS, présence/schéma d'URI, MIME, nom de fichier) trace chaque partie avant `.append()` pour permettre une vérification sur le device réel.

## Non couvert par cette matrice

- `PhotoManager.jsx` (sélection locale des photos, `expo-image-picker`) — ne construit aucun FormData, seulement un state local `{uri, uploading, url}`.
- `creerAnnonce()` — payload JSON pur (`photos: string[]` = URLs Cloudinary déjà uploadées), jamais de FormData vers notre backend pour ce parcours.
