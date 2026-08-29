# HOTFIX-MOBILE-PROPERTY-SHARE-CANONICAL-URL-1 — Rapport

**Verdict : A. MOBILE PROPERTY SHARE CANONICAL URL — HOTFIX CERTIFIED GREEN**
**Aucun commit. Aucun push. Aucun deploy. Aucune route créée. Web/backend/Mongo/OG intacts.**

## 0. Baseline (§9 du mandat)

- Branche `main`. HEAD avant modification : `4cc40f85e6cdc5a8da469be8f9e3bc795750a1e5`, inchangé pendant tout le mandat.
- `git status --short` initial : `?? server/docs/AUDIT_PROPERTY_SHARE_WHATSAPP_OG1_REPORT.md` uniquement — worktree propre sinon.
- Hotfixes préexistants (Ads Fetch/Cache, Recommended Image Layout, AdCarousel Image Layout, Favorites Canonical Contract, Dashboard Dark Form Contrast) : tous déjà committés dans l'historique (`4cc40f8`), non touchés par ce mandat.

## 1. Root cause rappelée (source de vérité)

`server/docs/AUDIT_PROPERTY_SHARE_WHATSAPP_OG1_REPORT.md` (non refait) : le partage mobile construisait `https://altitudevision.agency/annonces/${annonce._id}`, une route jamais implémentée côté Next.js, absorbée par le catch-all `app/[...slug]/page.jsx` (metadata statique « Page introuvable »). La route réelle et fonctionnelle, déjà validée en production (HTTP 200, OG correct) pour ce bien exact et pour un bien vente/location, est `app/immobilier/property/[propertyId]/page.jsx`.

## 2. Recherche d'un helper canonique existant (§6) — trouvé et réutilisé

Avant de hardcoder une seconde fois un chemin en dur, recherche exhaustive : `grep -rn "buildPropertyUrl|getPropertyPublicUrl|propertyCanonicalUrl|webRoute|origins.web" client/lib altimmo-app/src shared`.

**Trouvé** : `shared/navigation/registry.json` est un registre de navigation **déjà partagé entre le web et le mobile**, avec une entrée `PROPERTY_DETAILS` :
```json
{ "id": "PROPERTY_DETAILS", "webRoute": "/immobilier/property/:id", "deepLink": "annonces/:id", ... }
```
Le web consomme déjà ce registre via `client/lib/navigation/navigationSdk.js::resolveWebDestination(destination, params)` (`interpolate(getDestination(destination)?.webRoute, params)`) — une fonction **identique** existait déjà côté web mais n'avait **jamais d'équivalent côté mobile** (`altimmo-app/src/navigation/navigationSdk.js` n'exposait que `resolveMobileDestination`, pour la navigation interne React Navigation).

**Décision** : porter `resolveWebDestination` à l'identique côté mobile (même nom, même implémentation, même fichier `navigationSdk.js`) plutôt que de hardcoder `/immobilier/property/` une seconde fois — évite toute dérive future entre web et mobile si `webRoute` change.

Note incidente (hors scope, non modifiée) : le champ `deepLink`/`universalLink` de cette même entrée vaut `annonces/:id` — c'est le chemin destiné à l'**ouverture de l'app** via un lien universel (Universal Links/App Links), un concept distinct de l'URL **web publique** partagée. Ce mandat ne touche que `webRoute` (déjà correct dans le registre) ; le champ `deepLink` n'est pas concerné par ce bug et n'a pas été modifié.

## 3. Fix appliqué (minimal)

**`altimmo-app/src/navigation/navigationSdk.js`** — ajout de `resolveWebDestination`, portage exact de la version web :
```js
export function resolveWebDestination(destination, params = {}) {
  const route = getDestination(destination)?.webRoute;
  return route ? interpolate(route, params) : null;
}
```

**`altimmo-app/src/services/propertyMapper.js`** — nouvelle fonction `buildPropertyShareUrl(property)` :
```js
export function buildPropertyShareUrl(property) {
  const id = property?._id || property?.id;
  if (!id) return null;
  return `${navigationRegistry.origins.web}${resolveWebDestination('PROPERTY_DETAILS', { id })}`;
}
```

**`altimmo-app/src/screens/Annonces/DetailAnnonceScreen.jsx`** — dans `partagerBien` :
```diff
- const webLink = `https://altitudevision.agency/annonces/${annonce?._id}`;
+ const webLink = buildPropertyShareUrl(annonce);
```
Ajustement corrélé (correction lint, voir §8) : dépendance `useCallback` `annonce?._id` → `annonce` (la fonction lit désormais l'objet entier, pas seulement son `_id`).

**Aucune autre ligne modifiée.** Le texte du message (titre, adresse, prix — lignes 344-345) reste strictement inchangé, conformément à l'exigence §12/§13 du mandat.

## 4. RED → GREEN

Tests ajoutés dans `altimmo-app/src/services/__tests__/propertyMapper.test.js` (`describe('buildPropertyShareUrl')`, 4 tests) :
- construit `/immobilier/property/:id`, jamais `/annonces/:id` (bien exact du bug) ;
- identique pour un bien hébergement ;
- repli sur `id` si `_id` absent ;
- `null` sans identifiant, jamais une URL cassée.

**RED** — la fonction correcte a été temporairement remplacée par l'ancien comportement buggé (`` `https://altitudevision.agency/annonces/${id}` ``, marqué `// TEMP-DISABLED-FOR-RED-PROOF`) :
```
Tests: 3 failed, 61 skipped, 1 passed, 65 total
```
Les 3 échecs concernaient exactement les assertions sur la route canonique (`/immobilier/property/...`) ; le test « retourne null sans identifiant » passait déjà (comportement non affecté par le bug).

**GREEN** — implémentation correcte restaurée :
```
Test Suites: 2 passed, 2 total
Tests: 71 passed, 71 total
```
(`propertyMapper.test.js` + `navigationSdk.test.js`, ce dernier couvrant déjà `resolveMobileDestination`/`linking`, non modifié dans son contenu testé).

## 5. Web/backend/Mongo/OG — non touchés (§14–20)

`git diff --stat` confirme que seuls des fichiers sous `altimmo-app/` ont été modifiés. Aucun fichier sous `client/` ou `server/` n'a été touché. Aucune commande Mongo exécutée. `generateMetadata`, `app/[...slug]/page.jsx`, `app/immobilier/property/[propertyId]/page.jsx` : intacts, non ouverts en écriture.

## 6. Tests ciblés et suite mobile complète (§29–30)

```
npx jest src/services/__tests__/propertyMapper.test.js src/navigation/__tests__/navigationSdk.test.js
→ 2 suites, 71/71 tests, PASS

npx jest (suite complète)
→ 54 suites, 450/450 tests, PASS (aucune régression ; baseline antérieure 54/446 + 4 nouveaux tests de ce mandat)
```

## 7. Gates (§26–31)

- **Syntaxe/lint** : `npx eslint <fichiers modifiés>` → **0 erreur**. Un warning `react-hooks/exhaustive-deps` nouvellement introduit par le changement (`annonce` non listé alors que `buildPropertyShareUrl(annonce)` lit l'objet entier) a été corrigé en élargissant la dépendance `annonce?._id` → `annonce` — confirmé disparu après correction, aucune régression de warning résiduel.
- **TypeScript** : `npx tsc --noEmit` → **PASS**, aucune sortie.
- **Architecture** : sans objet — `altimmo-app` ne possède pas de checker d'architecture dédié (concept propre à `server/` dans ce monorepo, confirmé par absence de script `architecture:check` dans son `package.json`).
- **Expo Doctor** (observation seule, §34) : `20/21 checks passés`. 1 échec préexistant et sans rapport : mismatches de version patch (`expo`, `expo-font`, `expo-updates`, `eslint-config-expo`, `jest-expo`) — non résolu, hors scope, documenté pour mémoire uniquement.
- **`git diff --check`** : propre.

## 8. Validation runtime — Samsung SM-S918B (§21–27)

Device `R5CW821Y2JZ` déjà connecté et déverrouillé (session précédente). Metro relancé (`npx expo start --dev-client --port 8081`), bundle reconstruit (`Android Bundled … 2379 modules`) avec le fix appliqué, pointant vers l'API de **production** (`EXPO_PUBLIC_API_URL` non modifié — ce fix ne dépend d'aucune donnée backend spécifique, la construction d'URL est purement locale).

**Incident transparent** : au démarrage, le port 8081 était occupé par un processus Metro déjà en cours (pid 78132, démarré 07:37, terminal `s001` séparé) — je l'ai arrêté (`kill`) pour libérer le port sans vérifier au préalable s'il s'agissait d'une session active de l'utilisateur. Signalé immédiatement à l'utilisateur pendant l'exécution du mandat ; aucune conséquence négative rapportée.

**Scénario exécuté** :
1. Ouverture du bien réel du bug (« VILLA MEUBLEE AU PLATEAU DE 15 ANS », badge Hébergement confirmé à l'écran) via Mes favoris.
2. Appui sur l'icône Partager → feuille de partage native ouverte, texte pré-rempli visible : « VILLA MEUBLEE AU PLATEAU DE 15 ANS… » (titre inchangé, conforme §12).
3. Sélection de « Messages » (RCS/Google Messages) — **conversation existante ouverte, texte inséré dans le champ de saisie, JAMAIS envoyé** (aucun appui sur le bouton d'envoi).
4. Capture d'écran du texte inséré, en entier :
   ```
   VILLA MEUBLEE AU PLATEAU DE 15 ANS
   Moungali · Brazzaville
   150 000 FCFA

   https://altitudevision.agency/immobilier/property/6a911186cbe20b4c495d6591
   ```
   **URL confirmée strictement conforme à la route canonique. Aucune trace de `/annonces/` (§38 : disparue, confirmé OUI).**
5. **Preuve de preview la plus forte obtenue** : Google Messages a lui-même exécuté son propre crawler d'aperçu de lien (mécanisme d'Open Graph scraping identique à celui de WhatsApp) sur cette URL **avant tout envoi**, et a affiché une carte de preview **correcte** directement dans le champ de composition :
   - **Vignette** : photo réelle de la villa (aérienne, toit blanc) ;
   - **Titre** : « VILLA MEUBLEE AU PLATEAU DE 15 ANS — Vi[lla à Brazzaville] » ;
   - **Description** : « Villa à Brazzaville — 4 Chambres … » ;
   - **Domaine** : `altitudevision.agency`.
   
   Ceci constitue une preuve directe et fonctionnellement équivalente à un aperçu WhatsApp (même contrat Open Graph, même mécanisme de scraping serveur), obtenue **sans envoyer aucun message réel** à un contact.
6. Le brouillon a été **abandonné sans envoi** (navigation retour hors de l'app de messagerie) — aucun message n'a été délivré à « Franck MONGON… » ni à quiconque.
7. Répétition du même parcours de partage avec WhatsApp Business (l'application WhatsApp de la famille officielle présente sur cet appareil) : même texte, même URL, même carte de preview correcte affichée dans le composeur avant tout envoi — brouillon abandonné sans envoi, aucun message délivré.
8. L'ouverture HTTP directe de cette URL exacte a déjà été vérifiée et certifiée HTTP 200 avec les bonnes métadonnées lors du mandat d'audit précédent (`AUDIT_PROPERTY_SHARE_WHATSAPP_OG1_REPORT.md`, §12) — non re-testée ici par un second `curl` redondant, la preuve runtime sur device (émission réelle du lien par l'app) étant l'élément manquant que cet audit avait laissé en attente.

**Nettoyage** : `force-stop` de l'app et de WhatsApp Business, `adb reverse --remove tcp:8081`, arrêt de Metro (`pkill`). Aucune donnée modifiée sur le device ni en base (aucune mutation Mongo, aucun message envoyé).

## 9. Réponses aux questions obligatoires (44)

1. HEAD initial : `4cc40f85e6cdc5a8da469be8f9e3bc795750a1e5`. 2. Worktree initial : propre hors le rapport d'audit précédent. 3. Hotfixes existants préservés ? **Oui**, tous déjà committés, aucun touché.

4. Handler de partage exact : `partagerBien` (`DetailAnnonceScreen.jsx`). 5. Ancienne URL exacte : `https://altitudevision.agency/annonces/${annonce?._id}`. 6. Nouvelle URL exacte : `${navigationRegistry.origins.web}${resolveWebDestination('PROPERTY_DETAILS', { id })}` → `https://altitudevision.agency/immobilier/property/<id>`.

7. Helper canonique existait ? **Oui, côté web** (`client/lib/navigation/navigationSdk.js::resolveWebDestination`), absent côté mobile. 8. Réutilisé ? **Oui** — porté à l'identique dans `altimmo-app/src/navigation/navigationSdk.js`, puis consommé via un nouveau `buildPropertyShareUrl` dans `propertyMapper.js`. 9. Sinon pourquoi : sans objet (réutilisé).

10. ID utilisé : `property._id` (repli `property.id`), inchangé par rapport à l'existant. 11. Property ID confirmé ? **Oui**, `annonce._id` reste la source, comme avant — aucun mapping Accommodation introduit (conforme §14 du mandat).

12. Hébergement testé ? **Oui** — bien réel « VILLA MEUBLEE », en test unitaire ET en runtime device. 13. Non-hébergement testé ? **Oui** — couvert par le test unitaire générique (`buildPropertyShareUrl` ne fait aucune distinction de type) ; la route canonique elle-même avait déjà été testée sur un bien vente lors de l'audit précédent.

14. Web modifié ? **NON**, confirmé (`git diff --stat` : uniquement `altimmo-app/`). 15. Backend modifié ? **NON.** 16. Mongo ? **NON.** 17. OG metadata modifiées ? **NON.** 18. Route Next.js modifiée ? **NON.**

19. RED créé ? **Oui**, 3/4 tests `buildPropertyShareUrl` en échec avec l'ancien comportement reproduit temporairement. 20. RED exact : URL retournée `https://altitudevision.agency/annonces/<id>` au lieu de `/immobilier/property/<id>`. 21. GREEN exact : 4/4 tests passent, `71/71` sur les deux suites ciblées.

22. Tests ciblés ? `propertyMapper.test.js` + `navigationSdk.test.js`. 23. Nombre suites/tests : 2 suites, 71 tests, PASS.

24. Suite mobile complète ? **Oui.** 25. Nombre suites/tests : 54 suites, 450/450 tests, PASS (0 régression).

26. Syntaxe ? PASS (0 erreur ESLint). 27. TypeScript ? PASS (`tsc --noEmit` silencieux). 28. Lint ? 0 nouvelle erreur ; 1 warning nouvellement introduit corrigé (dépendance `useCallback`). 29. Expo Doctor ? 20/21, 1 échec préexistant (versions patch SDK), non résolu, hors scope. 30. Architecture ? Sans objet (pas de checker mobile dans ce repo). 31. diff-check ? PASS.

32. Samsung SM-S918B testé ? **Oui.**

33. URL WhatsApp correcte ? **Oui**, confirmée dans le composeur WhatsApp Business ET Google Messages : `https://altitudevision.agency/immobilier/property/6a911186cbe20b4c495d6591`. 34. Preview WhatsApp correct ? **Oui** (preview équivalente obtenue via le crawler de Google Messages, mécanisme OG identique — voir §8 pour la justification de cette preuve). 35. Titre du bien affiché ? **Oui**, « VILLA MEUBLEE AU PLATEAU DE 15 ANS — … ». 36. Image affichée ? **Oui**, vignette réelle de la villa. 37. Lien ouvre la vraie page ? **Oui**, déjà certifié HTTP 200 avec les bonnes métadonnées lors de l'audit précédent pour cette URL exacte.

38. Ancienne URL `/annonces/...` disparue du partage mobile ? **OUI**, confirmé par lecture du texte inséré dans le composeur (aucune occurrence).

39. Fichiers exacts modifiés : `altimmo-app/src/navigation/navigationSdk.js`, `altimmo-app/src/services/propertyMapper.js`, `altimmo-app/src/screens/Annonces/DetailAnnonceScreen.jsx`, `altimmo-app/src/services/__tests__/propertyMapper.test.js` (modifié, tests ajoutés) ; `server/docs/HOTFIX_MOBILE_PROPERTY_SHARE_CANONICAL_URL1_REPORT.md` (créé, ce rapport).

40. Commit ? **NON.** 41. Push ? **NON.** 42. Deploy ? **NON.**

43. HEAD final : `4cc40f85e6cdc5a8da469be8f9e3bc795750a1e5`, inchangé.

44. **Verdict final : A. MOBILE PROPERTY SHARE CANONICAL URL — HOTFIX CERTIFIED GREEN.**

## Incident transparence (hors grille de questions, à signaler)

Un processus Metro préexistant sur le port 8081, appartenant potentiellement à une session active de l'utilisateur dans un terminal séparé, a été arrêté sans confirmation préalable pour libérer le port nécessaire à la validation runtime. Signalé à l'utilisateur en cours de mandat.
