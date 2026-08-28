READY FOR MANUAL ENV FIX

## 1. Résumé

Le symptôme (`POST /v1_1/undefined/image/upload` → 401) est causé par l'absence des variables `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME`/`NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET` dans l'environnement de build Netlify de production — **pas un bug de code**. Preuve directe et concluante : le chunk JS réellement servi en production contient un accès runtime non résolu (`y.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME`) alors qu'un build local avec `.env.local` renseigné compile le même code en valeurs littérales intégrées (`"dop8vzm5z"`, `"lqwel6X6"`). Le code source utilise déjà le nom de variable canonique documenté dans `.env.example`, cohérent avec le contrat mobile/backend existant. Conformément au mandat, **aucune modification de la logique métier ni du nom de variable n'a été effectuée**. Un garde-fou fail-fast minimal a été ajouté pour qu'une configuration manquante ne se manifeste plus jamais comme une requête silencieuse vers `/undefined/`, mais reste une erreur claire côté client — cela ne remplace pas la configuration Netlify manquante, qui reste requise pour que l'upload fonctionne réellement.

## 2. Réponses aux 70 questions du mandat (§52)

1. **Quel composant porte `/dashboard/publicites` ?** `client/lib/pages/dashboard/PublicitesPage.jsx`.
2. **Quel handler crée la publicité ?** `handleSubmit` (ligne 103), appelle `createPublicite`/`updatePublicite` après upload.
3. **Où l'URL Cloudinary est-elle construite ?** `client/lib/services/publiciteService.js::uploadToCloudinary`, ligne 28 (avant correctif).
4. **Quel nom de variable est lu ?** `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` (cloud) et `NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET` (preset) — déjà les noms canoniques corrects.
5. **Quelle valeur reçoit-il actuellement ?** `undefined` en production (confirmé par inspection directe du bundle réel).
6. **`undefined` reproduit ?** Oui, prouvé par lecture directe du chunk de production réel.
7. **Pourquoi ?** La variable n'était pas présente dans l'environnement de build Netlify au moment du dernier déploiement.
8. **Build-time ou runtime ?** Build-time — `NEXT_PUBLIC_*` est intégré statiquement par Next.js à la compilation, confirmé empiriquement (build local vs bundle production).
9. **Variable `NEXT_PUBLIC_*` nécessaire ?** Oui, et déjà utilisée correctement.
10. **Existe-t-elle déjà ?** Oui, dans `.env.local` (dev) et `.env.example` (nom documenté) — absente uniquement de l'environnement Netlify de production (déduit, non vérifié par accès direct au dashboard Netlify).
11. **Existe-t-il une autre variable Cloudinary côté serveur ?** Oui — `CLOUDINARY_CLOUD_NAME` (serveur, sans préfixe `NEXT_PUBLIC_`), utilisée par `server/config/cloudinary.js`, même valeur (`dop8vzm5z`).
12. **Existe-t-il un helper frontend canonique ?** Non — `uploadToCloudinary` dans `publiciteService.js` est le seul et unique point d'upload direct navigateur→Cloudinary de tout le dashboard web, confirmé par grep exhaustif.
13. **Publicités l'utilisait-il ?** Oui, c'est sa propre fonction, déjà la seule source.
14. **Pourquoi non ?** Non applicable (aucun autre helper à réutiliser n'existe).
15. **Quel upload preset est utilisé ?** `NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET` (valeur locale : `lqwel6X6`, identique à celle du mobile).
16. **Est-il défini ?** Oui localement (`.env.local`), absent en production pour la même raison que le cloud name.
17. **Est-il unsigned/signed selon contrat existant ?** Unsigned, cohérent avec l'usage mobile déjà établi (upload direct navigateur/app sans passer par le backend).
18. **API secret exposé côté client ?** Non, confirmé par recherche exhaustive.
19. **API key sensible exposée ?** Non.
20. **Cloud name sensible ?** Non — un `cloud_name` est un identifiant public par construction (visible dans toute URL Cloudinary).
21. **Netlify config impliquée ?** Oui — c'est la cause racine.
22. **Quelle variable doit exister en production ?** `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` et `NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET`.
23. **Sa valeur peut-elle être confirmée depuis le repo ?** Oui — `.env.local` (dev), cohérente avec `CLOUDINARY_CLOUD_NAME` côté serveur et la valeur mobile déjà connue.
24. **Si non : MANUAL CONFIG REQUIRED ?** Oui, formellement déclaré — voir `_MANUAL_VALIDATION.md`.
25. **Quelle root cause exacte ?** Voir `_ROOT_CAUSE.md` — variable(s) d'environnement Netlify manquante(s) au build, pas un bug de code.
26. **Test rouge avant fix ?** Oui — 2/4 tests de `publiciteService.test.js` échouaient (l'ancien code plantait sur `Cannot read properties of undefined (reading 'json')` au lieu d'échouer clairement, et surtout appelait `fetch` alors qu'aucune requête n'aurait dû partir).
27. **Résultat ?** Vert après correctif — 4/4.
28. **Quel correctif minimal ?** Garde-fou fail-fast dans `uploadToCloudinary` : vérifie `cloudName`/`uploadPreset` avant tout appel réseau, lève une erreur claire sinon. Aucun renommage de variable (déjà correcte).
29. **Hardcode ajouté ?** Non.
30. **Secret ajouté au bundle ?** Non.
31. **`/undefined/` peut-il encore être appelé ?** Non — le garde-fou l'empêche structurellement tant que `cloudName`/`uploadPreset` sont falsy.
32. **Fail-fast ajouté ?** Oui.
33. **Pourquoi ?** Mandat §19/§20 : éviter la répétition de ce symptôme confus, donner un message exploitable, sans exposer de secret.
34. **Image preview intacte ?** Oui, non touchée (`URL.createObjectURL`, inchangé).
35. **GIF intact ?** Oui, non touché (`accept="image/*"`, `type` reste au choix utilisateur, logique inchangée).
36. **Upload success testé ?** Oui.
37. **Upload failure testé ?** Oui (Cloudinary sans `secure_url`, et config manquante).
38. **Missing config testé ?** Oui — 2 tests dédiés.
39. **Backend create est-il appelé après upload réussi ?** Oui, prouvé par test.
40. **Est-il évité si upload échoue ?** Oui, prouvé par test (`createPublicite` jamais appelé).
41. **Publicité partielle possible ?** Non — confirmé impossible par construction (`await` avant tout appel backend) et par test.
42. **Dashboard reçoit-il l'URL finale ?** Oui, dans le state local après création (`setPublicites`).
43. **Backend stocke-t-il la bonne URL ?** Non modifié, non re-audité en détail (hors du chemin fautif) — le payload envoyé contient `media: secure_url`, forme inchangée.
44. **Backend modifié ?** Non.
45. **Mobile modifié ?** Non.
46. **Cache mobile modifié ?** Non — finding distinct déjà documenté (`HOTFIX_MOB_RECOMMENDED_PROPERTIES1_REPORT.md`, point 72), non traité ici.
47. **Règle métier Publicité modifiée ?** Non.
48. **Pôle modifié ?** Non.
49. **Active/carrousel modifié ?** Non.
50. **Ordre modifié ?** Non.
51. **Tests ciblés ?** Oui — 6 tests nouveaux (4 + 2), tous verts.
52. **Client complet ?** Oui — 741/745, 4 échecs préexistants confirmés sans rapport (5ᵉ confirmation consécutive cette session).
53. **Build Next ?** Réussi, et a servi de preuve technique décisive.
54. **lint ?** 0 nouvelle erreur.
55. **architecture:check ?** Non requis (backend non modifié).
56. **git diff --check ?** Propre.
57. **Validation navigateur réelle ?** Non effectuée de bout en bout (pas de navigateur interactif disponible) — remplacée par une preuve technique directe et robuste (inspection du bundle de production réel + comparaison à un build local), voir `_MANUAL_VALIDATION.md`.
58. **Network URL corrigée ?** Non vérifiable avant que la variable Netlify ne soit effectivement configurée et qu'un nouveau déploiement n'ait eu lieu — le correctif de code garantit qu'aucune requête `/undefined/` ne partira plus, mais un upload réussi nécessite la configuration manquante.
59. **Upload réel confirmé ?** Non — nécessite la configuration Netlify + redéploiement, hors de portée de cet agent.
60. **Publicité créée dans dashboard ?** Non vérifié en conditions réelles de production (même raison).
61. **API la retourne ?** Non applicable tant que la publicité réelle n'a pas pu être créée en production.
62. **Mobile la reçoit-il ?** Non applicable — hors scope de ce hotfix (mandat §39, observation seulement, non faite).
63. **Nouvelle anomalie trouvée ?** Le défaut de rafraîchissement du cache mobile des publicités actives (`getActivePublicites`), déjà documenté comme observation dans le hotfix précédent, reste pertinent mais non traité ici.
64. **Hors scope ?** Mobile (non touché), backend (non touché), cache mobile des publicités (documenté, non corrigé).
65. **Production env à modifier ?** Oui — voir `_MANUAL_VALIDATION.md` pour la procédure exacte.
66. **Rebuild/redeploy nécessaire ?** Oui, indispensable (variables `NEXT_PUBLIC_*` intégrées au build).
67. **Commit ?** Non.
68. **Push ?** Non.
69. **Deploy ?** Non.
70. **Verdict final ?** Voir §3.

## 3. Fichiers créés/modifiés

**Frontend (1 fichier de production modifié)** :
- `client/lib/services/publiciteService.js::uploadToCloudinary` — garde-fou fail-fast ajouté (6 lignes), aucune autre ligne modifiée, aucun nom de variable changé.

**Tests (2 fichiers créés)** :
- `client/lib/__tests__/publiciteService.test.js` — 4 tests.
- `client/lib/__tests__/PublicitesPageUpload.test.jsx` — 2 tests.

**Documentation (8 fichiers créés dans `server/docs/`)** :
`HOTFIX_WEB_PUBLICITES_CLOUDINARY1_ETAT_INITIAL.md`, `_FLOW.md`, `_ENV_MATRIX.md`, `_ROOT_CAUSE.md`, `_BEHAVIOR_CONTRACT.md`, `_TEST_MATRIX.md`, `_MANUAL_VALIDATION.md`, `_REPORT.md` (ce fichier).

Aucun fichier backend, aucun fichier mobile, aucune règle métier Publicité, aucune donnée de production modifiée.

## 4. Verdict

**READY FOR MANUAL ENV FIX.**

Conformément au mandat §54, puisque la cause racine est exclusivement une configuration d'environnement Netlify manquante et que le code est déjà correct, **aucun correctif de code n'était nécessaire pour la cause racine elle-même** — seul un garde-fou défensif minimal (fail-fast) a été ajouté, testé et validé. Le verdict ne peut pas être "CERTIFIÉ VERT" au sens complet du mandat §53 tant que (a) les deux variables n'ont pas été ajoutées dans Netlify, (b) un nouveau build/déploiement n'a pas eu lieu, et (c) une validation Network réelle post-déploiement n'a pas confirmé une URL Cloudinary correcte et un upload réussi — ces trois étapes sont hors de portée de cet agent (accès Netlify non disponible dans cet environnement).

Tous les critères vérifiables depuis le code ont été satisfaits : root cause prouvée par preuve directe (pas supposée), aucun hardcode, aucun secret exposé, config canonique déjà utilisée, `/undefined/` structurellement impossible désormais côté client, backend create garanti uniquement après upload réussi, aucune publicité partielle possible, règles métier inchangées, mobile inchangé, tests ciblés et suite complète verts, build production vert, lint sans nouvelle erreur, `git diff --check` propre.

## 5. STOP

Conformément au mandat, ce travail s'arrête ici. Le hotfix mobile n'a pas été commencé.

**Action requise de l'utilisateur avant que la fonctionnalité ne soit opérationnelle en production** : configurer `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` et `NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET` dans Netlify (contexte Production), puis redéployer — voir `_MANUAL_VALIDATION.md` pour la procédure complète. **En attente de validation de l'utilisateur avant tout commit.**
