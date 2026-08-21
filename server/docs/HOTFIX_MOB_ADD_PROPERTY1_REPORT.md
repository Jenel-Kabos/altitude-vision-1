# HOTFIX-MOB-ADD-PROPERTY-1 — Rapport final

Date : 2026-08-21. Branche `main`. Aucun commit créé (`git add`/`push`/`deploy`/`reset --hard` jamais exécutés), conformément au mandat.

## Résumé exécutif

Deux bugs distincts, tous deux réellement corrigés à la racine (aucun n'a été masqué par l'autre) :

- **Problème A ("Parcelle" absent)** : "Parcelle" n'existait dans **aucune** des 6 sources de vérité du type de bien (backend `Property.js`, mirror `propertyFilterConstants.js`, legacy `Proprietaire.js`, constantes mobile et web, logique dérivée `isLand`/`NO_BEDROOMS_TYPES`). Ajouté partout, comme type **distinct** de "Terrain" (jamais en remplacement — les deux coexistent, "Terrain" n'a subi aucune régression).
- **Problème B ("Unsupported FormDataPart implementation")** : cause racine identifiée avec preuve technique (pas une hypothèse) — `uploadToCloudinary` utilisait `fetch()` global, remplacé silencieusement par `expo/fetch` depuis Expo SDK 57 (confirmé installé : `expo ~57.0.13`), dont l'implémentation ne supporte pas la forme classique RN `{uri, name, type}` pour un fichier. Corrigé en basculant sur `axios`, le pattern déjà utilisé et fonctionnel partout ailleurs dans l'app pour l'upload de fichiers (ex. photo de profil). Voir `HOTFIX_MOB_ADD_PROPERTY1_FORMDATA_MATRIX.md` pour le détail complet.

## Réponses aux questions du mandat

1. **"Parcelle" existait-il déjà côté backend avant ce hotfix ?** Non — confirmé par lecture directe de `server/models/Property.js`.
2. **"Terrain" et "Parcelle" sont-ils censés être identiques ou distincts ?** Distincts — le mandat les liste comme deux entrées séparées à faire coexister ; aucune preuve dans le code d'une fusion voulue.
3. **Combien de sources de vérité dupliquées existent pour `Property.type` ?** 6 : `server/models/Property.js` (canonique), `server/constants/propertyFilterConstants.js` (miroir testé), `server/models/Proprietaire.js` (legacy `bienSchema`), `client/lib/constants/propertyTypes.js`, `altimmo-app/src/constants/propertyTypes.js`, plus la logique dérivée (`isLand`, `NO_BEDROOMS_TYPES`/`NO_BATHROOMS_TYPES`).
4. **Existe-t-il un test anti-dérive protégeant ces sources ?** Oui — `server/__tests__/propertyFilterConstants.test.js`, qui échoue si `Property.js` et `propertyFilterConstants.js` divergent. Vérifié vert après l'ajout de "Parcelle" aux deux fichiers simultanément.
5. **"Parcelle" a-t-il été ajouté partout où c'était nécessaire, et nulle part où ce n'était pas nécessaire ?** Oui — backend enum + message d'erreur, mirror de filtrage, legacy `Proprietaire`, constantes mobile et web, `isLand` (web), `NO_BEDROOMS_TYPES`/`NO_BATHROOMS_TYPES` (mobile, mêmes règles que "Terrain" — un terrain/une parcelle n'a ni chambres ni salles de bain). Le référentiel `valuationConstants.js` (estimation de valeur, contient déjà "Parcelle agricole", concept distinct) n'a **pas** été touché — hors périmètre, confirmé non lié à `Property.type`.
6. **Une valeur mappée/normalisée a-t-elle été inventée côté backend ?** Non — le backend stocke les libellés français littéraux directement (pas de couche de normalisation), donc "Parcelle" est stocké tel quel, comme tous les autres types.
7. **Le bug B a-t-il été reproduit avant correction ?** Reproduit par analyse de code (lecture complète du chemin d'exécution `AddSalePropertyScreen.jsx` → `uploadToCloudinary` → `fetch()`), pas sur device réel dans cette session (aucun device disponible). La cause a été confirmée par recherche externe (documentation Expo v57 officielle + issue GitHub `expo/expo#33134` référençant exactement ce message d'erreur avec `expo/fetch`).
8. **Une instrumentation DEV-only a-t-elle été ajoutée avant la correction ?** Oui — `logFormDataPartDev()` dans `annonceService.js`, gardée par `__DEV__`, logge uniquement `{fieldName, kind, hasUri, uriScheme, type, name}` pour un fichier ou `{fieldName, jsType, isString}` pour un champ primitif. **Jamais de contenu binaire.** Vérifié fonctionnel dans les tests (logs visibles en sortie Jest, aucune fuite de contenu).
9. **Quel `FormData.append()` exact causait l'erreur ?** `fd.append('file', {uri, name, type})` dans `uploadToCloudinary` — pas la forme de l'objet elle-même (qui était déjà correcte), mais le transport (`fetch()` global devenu `expo/fetch`).
10. **La correction a-t-elle introduit une nouvelle librairie ou un encodage base64 par défaut ?** Non — `axios` était déjà une dépendance directe de l'app (utilisée par `api.js` et partout ailleurs pour l'upload de fichiers). Aucun changement de la forme du fichier envoyé.
11. **Un pattern d'upload déjà fonctionnel a-t-il été réutilisé plutôt que réinventé ?** Oui — exactement le pattern de `ProfilScreen.jsx` (`api.patch(url, formData, {headers:{'Content-Type':'multipart/form-data'}})`), adapté ici en `axios.post` direct puisque Cloudinary est un hôte tiers (pas notre API `baseURL`).
12. **La route backend réelle correspond-elle exactement à ce que le mobile envoie ?** Le parcours de publication vente n'envoie **aucun** fichier à notre backend — `creerAnnonce()` poste un JSON pur (`POST /properties/mobile`, `propertyMobileController.js`) avec `photos: string[]` déjà uploadées sur Cloudinary au préalable. Aucun multer/upload middleware backend n'est concerné par ce bug précis.
13. **Le double-submit est-il empêché ?** Oui, déjà en place avant ce hotfix (non-régression vérifiée) : `if (submitting) return;` en tête de `handlePublish`, et `StepFooter` reçoit `loading={submitting}` qui désactive les deux boutons pendant la publication.
14. **Le message d'erreur brut a-t-il été remplacé par un message propre ?** Oui pour le point précis en cause — `uploadToCloudinary` catch désormais localement toute erreur (native ou réseau) et lève systématiquement `'Cloudinary upload failed'`, jamais le message technique natif. Le détail réel (`err.response?.data || err.message`) est loggé uniquement en DEV.
15. **Les erreurs sont-elles classifiées (construction/réseau/4xx/5xx) plutôt que génériques ?** Partiellement — `creerAnnonce()` distingue déjà message serveur (`err.response.data.message/error`) vs message générique de repli ; `uploadToCloudinary` distingue désormais erreur d'upload (message dédié) du reste. Une classification fine par code HTTP (401/403/413/500) n'a pas été ajoutée dans cette passe — non demandée explicitement au-delà de "ne pas tout réduire à 'erreur réseau'", ce qui est respecté (le message générique de repli n'apparaît que si le backend ne fournit vraiment aucun détail).
16. **Tests de type de bien écrits ?** Oui — `altimmo-app/src/constants/__tests__/propertyTypes.test.js` (Parcelle présent, Terrain non régressé, 2 entrées distinctes, total 10 types) + extension de `publicationValidation.test.js` (Parcelle masque chambres/SdB comme Terrain, `sanitizePropertyFieldsForType` remet à 0, `salePropertySchema.validateStep('info', ...)` accepte "Parcelle").
17. **Tests de construction FormData écrits ?** Oui — `altimmo-app/src/services/__tests__/annonceService.uploadToCloudinary.test.js`, 5 tests : régression (axios.post utilisé, jamais fetch), forme de la partie fichier (uri/name/type définis), détection vidéo par extension, `upload_preset` en chaîne, gestion d'erreur propre.
18. **Un test de régression qui aurait échoué avant et passe après existe-t-il ?** Oui — le test "régression : utilise axios.post (jamais fetch global)" aurait échoué avec l'ancien code (`fetch()` n'appelle jamais `axios.post`) et passe avec le correctif.
19. **Vérification device réel (Samsung SM-S918B) effectuée ?** **NON CONFIRMÉ** — aucun device physique ni émulateur disponible dans cet environnement d'exécution. Le mandat lui-même reconnaît explicitement que Jest ne peut pas certifier la compatibilité Android FormData native ; cette certification reste à faire par l'utilisateur sur son device.
20. **Capture Logcat/Metro fournie ?** NON CONFIRMÉ — même limitation que Q19.
21. **Chaîne complète vérifiée end-to-end (Parcelle sélectionnable → formulaire → Publier → multipart valide → 2xx → bien créé → images enregistrées) ?** Vérifiée **structurellement** (tests unitaires/intégration passants sur chaque maillon : sélection de type, validation, construction FormData, route backend `POST /properties/mobile`), **jamais observée en conditions réelles sur device**. NON CONFIRMÉ pour la partie device réel.
22. **Mode sombre / clair vérifiés pour le nouveau bouton "Parcelle" ?** NON CONFIRMÉ — `ChipMultiSelect` (composant déjà existant, réutilisé tel quel pour afficher "Parcelle") applique le même style que les 9 types existants via `useTheme()` ; aucune classe/couleur spécifique ajoutée qui pourrait diverger, mais aucune capture visuelle réelle n'a été prise (pas d'outil de rendu disponible cette session).
23. **Responsive Samsung SM-S918B vérifié ?** NON CONFIRMÉ — même limitation, le composant `ChipMultiSelect` est déjà responsive pour les 9 types existants (wrap automatique), "Parcelle" suit la même logique sans changement de layout.
24. **Tests mobile ciblés ?** 9/9 suites, 63/63 tests verts (`propertyTypes.test.js`, `publicationValidation.test.js`, `annonceService.uploadToCloudinary.test.js`, `annonceService.hebergement.test.js`, écrans `Publication/*`).
25. **Suite mobile complète ?** 48/48 suites, 414/414 tests verts.
26. **Lint mobile ?** 0 erreur (111 warnings, baseline pré-existante — `no-console`/`import/first`, aucun nouveau type d'erreur introduit).
27. **Types (tsc) mobile ?** `npx tsc --noEmit` → 0 erreur.
28. **Expo Doctor ?** 20/21 checks passés. 1 échec **pré-existant et sans rapport avec ce hotfix** : dérive de versions patch entre 12 packages `expo-*` installés et ceux attendus par `expo@57.0.13` (ex. `expo-image-picker` `57.0.10` vs `~57.0.12` attendu) — dette technique de dépendances, non introduite ni aggravée par ce sprint, hors périmètre (aucune montée de version demandée par le mandat).
29. **Export/build Android effectué ?** Non effectué dans cette session (nécessiterait un environnement de build EAS/Android SDK non disponible ici) — recommandé avant certification finale, en même temps que le test device réel.
30. **Backend touché — tests SaleProperty/Property/upload/owner + unit + lint ?** Oui : `propertyRoutes.test.js`, `rentalPropertyRoutes.test.js`, `salePropertyRoutes.test.js`, `propertyMobileController.unit.test.js`, `propertyFilterConstants.test.js`, `propertyFilterService.test.js` → 6/6 suites, 94/94 tests verts. Suite unit complète backend : 127/127 suites, 1455/1455 tests verts. Lint backend : 0 erreur (106 warnings baseline pré-existante).
31. **`git diff --check` final ?** exit 0.
32. **Fichiers modifiés (backend) ?** `server/models/Property.js` (enum + message), `server/constants/propertyFilterConstants.js` (mirror), `server/models/Proprietaire.js` (legacy bienSchema, cohérence).
33. **Fichiers modifiés (mobile) ?** `altimmo-app/src/constants/propertyTypes.js` (Parcelle), `altimmo-app/src/utils/publicationValidation.js` (NO_BEDROOMS/NO_BATHROOMS), `altimmo-app/src/services/annonceService.js` (fix FormData + instrumentation DEV) + 2 fichiers de tests créés + 1 étendu.
34. **Fichiers modifiés (web) ?** `client/lib/constants/propertyTypes.js` (Parcelle), `client/lib/utils/propertyFormConfig.js` (`isLand` étendu à Parcelle).
35. **Dette restante / réserves ?** (a) Aucune vérification device réel (Samsung) — bloquant pour la certification finale du bug B selon le mandat lui-même. (b) Pas de capture visuelle réelle dark/light/responsive pour le nouveau bouton "Parcelle" (même réserve que les sprints Inbox précédents — pas d'outil de capture disponible cette session). (c) Pas de build/export Android exécuté. (d) Classification fine des erreurs par code HTTP (401/403/413/500) non implémentée au-delà de ce qui existait déjà — non explicitement requise par le mandat au-delà d'éviter le message brut, qui est corrigé.

## Gates

| Gate | Résultat |
|---|---|
| Tests mobile ciblés | 9/9 suites, 63/63 ✅ |
| Suite mobile complète | 48/48 suites, 414/414 ✅ |
| Lint mobile | 0 erreur ✅ |
| Types mobile (`tsc --noEmit`) | 0 erreur ✅ |
| Expo Doctor | 20/21 (1 échec pré-existant, dérive de versions patch, hors périmètre) ⚠️ |
| Export/build Android | Non exécuté (environnement indisponible) ⚠️ |
| Tests backend ciblés (Property/SaleProperty/RentalProperty/mobile controller/filtres) | 6/6 suites, 94/94 ✅ |
| Suite backend unit complète | 127/127 suites, 1455/1455 ✅ |
| Lint backend | 0 erreur ✅ |
| `git diff --check` | exit 0 ✅ |

## Verdict

**GO SOUS RÉSERVES.**

Les deux bugs sont réellement corrigés à la racine, avec preuve technique pour chacun (pas de correctif de façade) :
- Problème A : "Parcelle" ajouté de façon cohérente aux 6 sources de vérité identifiées, protégé par le test anti-dérive existant, "Terrain" non régressé (tests dédiés verts).
- Problème B : cause racine prouvée (remplacement silencieux de `fetch()` par `expo/fetch` depuis Expo SDK 57, incompatible avec la forme FormData classique RN), corrigée en réutilisant le pattern axios déjà fonctionnel ailleurs dans l'app — jamais masquée par un simple changement de message d'erreur.

Le **CERTIFIÉ VERT** n'est pas atteint car le mandat exige explicitement une vérification sur le device Samsung réel ("Jest ne peut pas certifier la compatibilité Android FormData native") — impossible à réaliser dans cet environnement d'exécution. Restent à faire par l'utilisateur, avant mise en production : test de publication complet sur le device physique (Parcelle sélectionnable, photos réellement uploadées sur Cloudinary, bien créé en base), capture Logcat/Metro en cas de nouvel échec, vérification visuelle dark/light/responsive du bouton "Parcelle", et export/build Android.

## STOP

Conformément au mandat : aucun refactor complet du formulaire, aucun travail paiement, aucun nouveau sprint Inbox Pro entamé. En attente de validation utilisateur, notamment sur le test device réel obligatoire pour la certification finale.
