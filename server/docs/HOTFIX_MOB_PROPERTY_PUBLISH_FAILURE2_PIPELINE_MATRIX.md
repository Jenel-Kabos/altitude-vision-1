# HOTFIX-MOB-PROPERTY-PUBLISH-FAILURE-2 — MATRICE DU PIPELINE

## Étapes du pipeline (bien de vente, `AddSalePropertyScreen.jsx`)

| # | Étape | Fichier | Statut avant ce tour |
|---|---|---|---|
| A | State formulaire (`form`, `photos`) | `AddSalePropertyScreen.jsx` | Non prouvé fautif — `form.type` est une source unique (pas de variable recap séparée) |
| B | Validation locale par étape | `publicationValidation.js` (`salePropertySchema.validateStep`) | Bloque déjà l'avancée si `type` vide à l'étape `info` — un `type` invalide/vide en résumé est donc structurellement impossible |
| C | Sélection images | `PhotoManager` | Logs device déjà capturés : chaque fichier a `uriScheme=file`, `type=image/jpeg`, `name` défini — **rien d'anormal observé** |
| D | Upload Cloudinary | `annonceService.js` `uploadToCloudinary` | **Instrumentation ajoutée ce tour** (`[Cloudinary upload start/success/failure]`) — pas encore rejouée sur device |
| E | Construction payload | `publicationPayloads.js` `buildSalePropertyPayload`/`buildBasePropertyPayload` | Confirmé : `type` (nature physique) et `categorie` (vente/location/hebergement) sont deux champs **distincts et jamais dérivés l'un de l'autre** — le mandat §9 (ne pas laisser le type physique déterminer vente/location) est déjà respecté structurellement |
| F | Appel API `POST /properties/mobile` | `annonceService.js` `creerAnnonce` | **Instrumentation ajoutée ce tour** (`[Property publish request/response/failure]`) — pas encore rejouée sur device |
| G | Validation Mongoose | `server/models/Property.js` | Non auditée ce tour — dépend du résultat de l'instrumentation F |
| H | Auth | `services/api.js` (intercepteur JWT) | Non modifié, non suspecté sans preuve |
| I | Tenant | Backend `POST /properties/mobile` | Non modifié, non suspecté sans preuve |
| J | Backend (contrôleur) | `server/controllers/propertyController.js` (route mobile) | Non auditée ce tour — en attente du code d'erreur réel |

## Ce qui est déjà prouvé (logs device précédents, avant ce tour)

- Le helper Cloudinary est bien atteint et construit un FormData valide pour chaque photo (`kind=file`, `hasUri=true`, `uriScheme=file`, `type=image/jpeg`, `name` défini).
- `upload_preset` est bien une primitive string, jamais un objet.
- Aucune occurrence de `"Unsupported FormDataPart implementation"` — le correctif HOTFIX-MOB-ADD-PROPERTY-1 (axios au lieu de fetch/expo-fetch) tient toujours, confirmé encore présent dans le code (non modifié).
- Aucune erreur Axios/HTTP/Cloudinary/backend n'était encore visible dans ces traces — la première erreur réelle n'a pas encore été capturée.

## Hypothèse non confirmée sur `type = Appartement`

Lecture du code (pas de log device) : `form.type` est fixé exclusivement par `onSelectType`/`sanitizePropertyFieldsForType`, jamais réinitialisé ailleurs. `AddSalePropertyScreen.jsx` charge un brouillon existant au montage (`useDraftAnnonce('vente').loadDraft()`) et, si l'utilisateur accepte "Reprendre", fusionne ce brouillon dans le formulaire courant (`setForm(prev => ({...prev, ...draft}))`) — un brouillon antérieur avec `type: 'Appartement'` resterait donc actif si l'utilisateur ne retouche pas le chip Type après avoir repris un brouillon, même en changeant le titre. **Hypothèse plausible, non confirmée par un log device** — aucune correction appliquée sur cette base seule, conformément à l'instruction explicite de ne rien corriger avant la première erreur réelle. Un `SummaryRow` affiche `form.type` directement (aucune variable recap séparée), donc l'invariant `recap === payload.type` (mandat §14) est déjà garanti par construction du code, pas seulement par un test — confirmé par lecture, pas encore par device.

## Instrumentation ajoutée ce tour (DEV uniquement, expurgée)

`altimmo-app/src/services/annonceService.js` :
- `uploadToCloudinary(uri, { index, total })` — nouveau deuxième paramètre optionnel, log `[Cloudinary upload start]`/`[Cloudinary upload success]`/`[Cloudinary upload failure]` autour de l'appel `axios.post` réel vers Cloudinary.
- `creerAnnonce(payload)` — log `[Property publish request]` juste avant `api.post('/properties/mobile', ...)`, `[Property publish response]` en succès, `[Property publish failure]` en échec — capture `httpStatus`, `backendCode`, `backendMessageSafe` (tronqué à 300 caractères, jamais un stack trace ni un secret).

`altimmo-app/src/screens/Publication/AddSalePropertyScreen.jsx` : le mapping `photos.map(...)` passe désormais `{ index, total: photos.length }` à `uploadToCloudinary` pour que l'instrumentation distingue quelle photo échoue sur un lot de plusieurs.

Aucun autre écran (`AddRentalPropertyScreen.jsx`, `AddAccommodationScreen.jsx`, `HotelEstablishmentScreen.jsx`, `PublierBienScreen.jsx`) n'a été modifié — hors périmètre du bug rapporté (vente uniquement), diff minimal.

## Ce qui reste à faire (nécessite le device)

Rejouer UNE publication de vente (Parcelle, comme dans le bug rapporté) sur le Samsung SM-S918B et capturer les logs entre `[Cloudinary upload start]` et `[Property publish response]`/`[Property publish failure]`. Cette instrumentation répondra précisément à :
1. Un upload Cloudinary échoue-t-il ? Lequel, quel `axiosStatus` ?
2. Tous les uploads réussissent-ils ?
3. L'appel Property est-il ensuite déclenché ?
4. Quel `httpStatus` retourne le backend ?
5. Quel `backendMessageSafe` exact ?
6. Le payload final contient-il `type=Appartement` ou `type=Parcelle` (`[Property publish request].type`) ?
7. Le récapitulatif affiché correspond-il à `type` du payload (déjà garanti par le code, à confirmer par le log réel) ?

**Aucune correction du type, de Cloudinary ou du backend n'a été appliquée à ce stade** — conforme à l'instruction explicite d'attendre la première erreur réelle avant de corriger quoi que ce soit.
