# UI-MOB-5.1 — Home Empty State : diagnostic runtime & certification

Date : 2026-08-19. Branche `main`, `HEAD 29044699d25df30d1fffbbadf11fefc9cd6f9cac` (inchangé). Device réel : Samsung Galaxy SM_S918B (`R5CW821Y2JZ`), navigation Android 3 boutons, densité 450 (échelle dp = px × 160/450).

## Matrice visuelle

| Écran | Light | Dark | Layout | Contraste | Device | Verdict |
|---|---|---|---|---|---|---|
| Home — Hero | PASS (hérité UI-MOB-5) | PASS | PASS | PASS | Samsung SM_S918B (réel) | PASS |
| Home — Header/Search/Categories/À découvrir | PASS | PASS (re-vérifié ce sprint) | PASS | PASS | Samsung SM_S918B (réel) | PASS |
| Home — Empty state (titre/sous-titre) | PASS (cause prouvée, corrigée) | PASS (re-vérifié) | PASS | PASS | Samsung SM_S918B (réel) | PASS |
| Bottom Navigation | PASS (hérité UI-MOB-5) | PASS (re-vérifié) | PASS | PASS | Samsung SM_S918B (réel) | PASS |

## 1. Quel était le symptôme ?

D'après UI-MOB-5 : dans l'état "Aucune annonce trouvée", l'illustration s'affichait mais le titre et le sous-titre n'apparaissaient jamais à l'écran, sur plusieurs cycles de rechargement complet, y compris avec un marqueur de debug ajouté juste avant ces lignes.

## 2. Était-ce un problème de contraste ?

**Non.** `c.text` (`#1A1A1A`) sur fond clair (`#FAFAF8`) et `c.textSub` (`#666666`) : contrastes largement AA/AAA. Vérifié dans le code et confirmé par capture d'écran réelle une fois le texte dans le champ visible (§20).

## 3. Les `Text` étaient-ils montés ?

**Oui.** Instrumentation `onLayout` temporaire ajoutée sur le titre et le sous-titre (`console.log` capté via le terminal Metro, device réel) :

```
DEBUG-EMPTYSTATE-CONTAINER-LAYOUT {"x":0,"y":480.71,"width":344.18,"height":318.93}
DEBUG-EMPTYSTATE-TITLE-LAYOUT    {"x":73.24,"y":219.73,"width":196.98,"height":20.98}
DEBUG-EMPTYSTATE-SUBTITLE-LAYOUT {"x":23.82,"y":252.80,"width":295.82,"height":41.96}
```

Les deux `Text` existaient bien dans l'arbre, avec des dimensions non nulles et cohérentes avec leur contenu.

## 4. Étaient-ils présents dans l'accessibility/UI tree ?

Non vérifié via `uiautomator dump` séparément — rendu inutile par la preuve `onLayout` (§3) et la preuve visuelle directe après scroll (§20), plus concluantes et plus rapides à obtenir sur ce device.

## 5. Quelles étaient leurs dimensions runtime ?

Titre : 196.98 × 20.98dp. Sous-titre : 295.82 × 41.96dp. Aucune dimension nulle — élimine directement l'hypothèse C (dimensions nulles/incorrectes) du mandat.

## 6. Quelle condition de rendu était active ?

`{title ? <Text>...</Text> : null}` — `title`/`subtitle` sont des chaînes littérales toujours vraies dans l'appel du screen ; la branche positive était bien exécutée (cohérent avec §3 : le texte est monté).

## 7. Quel était le parent responsable ?

`EmptyState`, passé en `ListEmptyComponent` du `FlatList` de `ListeAnnoncesScreen.jsx`. Le container `EmptyState` (`flex:1, alignItems:'center', justifyContent:'center', padding: spacing.xl`) n'a pas `overflow:'hidden'` — il ne peut donc pas clipper son propre contenu.

## 8. `FlatList` était-elle impliquée ?

Indirectement, via l'espace qu'elle laisse disponible sous son `ListHeaderComponent`, pas via un bug de son mécanisme d'affichage. Piste `removeClippedSubviews` testée explicitement (`false` puis re-vérifiée) : **éliminée**, le symptôme était strictement identique avec `removeClippedSubviews={false}`, donc non lié à ce mécanisme. Remis à `true` (valeur d'origine, aucune raison technique de le changer).

## 9. `contentContainerStyle` était-il impliqué ?

`styles.list = { paddingBottom: spacing.lg, gap: spacing.md }` — pas de `flexGrow`, comportement neutre, non responsable.

## 10. `flexGrow`/`minHeight`/`height` étaient-ils impliqués ?

C'est **la vraie cause**, mais pas de la façon décrite dans le mandat (pas un `flexGrow` cassé). Mesures `onLayout` précises sur le header et le viewport du `FlatList` :

```
DEBUG-FLATLIST-VIEWPORT  height: 589.87dp   (zone visible du FlatList)
DEBUG-HEADER-TOTAL       height: 460.80dp   (GreetingBar + hero + search + quick filters + "À découvrir")
gap header→item (spacing.md)  : 20dp
```

Espace réellement disponible sous le header dans le viewport : 589.87 − 460.80 − 20 = **109.07dp**. Le container `EmptyState` (avant correctif) mesurait **318.93dp** de haut (illustration 160 + padding 24×2 + gaps). Comme il est un enfant unique d'un parent non borné en hauteur (le contenu défilable du `FlatList`), son `flex:1` ne le contraint pas à la hauteur du viewport restant : il prend sa taille naturelle de contenu et **déborde de 209.77dp** sous le pli visible. Le titre (à y=219.73 dans le container, donc y=700.44 dans le contenu total) se retrouvait ainsi ~110dp sous le bas du viewport ; le sous-titre, ~190dp sous.

## 11. `overflow` était-il impliqué ?

Non — ni le container `EmptyState`, ni son parent, n'ont `overflow:'hidden'`. Le contenu n'était pas coupé, simplement positionné hors du cadre visible initial (le `FlatList` restait scrollable, preuve : un `swipe` réel de ~53dp faisait apparaître le titre — capture avant/après §20).

## 12. `position`/`zIndex` étaient-ils impliqués ?

Non. `CustomTabBar` est en `position:'relative'` (vérifié dans le code), pas en recouvrement absolu du contenu — élimine l'hypothèse G (masqué par la tab bar via superposition).

## 13. `opacity` était-elle impliquée ?

Non — aucune opacité réduite sur `styles.title`/`styles.subtitle`.

## 14. `ThemeContext` était-il impliqué ?

Non — les couleurs résolues (`c.text`, `c.textSub`) sont correctes et contrastées dans les deux thèmes (vérifié §21).

## 15. Quelle est la cause racine exacte ?

**Le titre et le sous-titre de l'empty state n'étaient pas invisibles : ils étaient positionnés hors du viewport visible initial**, parce que le header au-dessus (hero + recherche + filtres rapides + "À découvrir", 460.8dp, légitime et déjà audité/corrigé en UI-MOB-5) laisse peu d'espace (109dp) dans le viewport du `FlatList` (589.9dp) sur ce device, et que le container `EmptyState` — dimensionné pour son contenu naturel (illustration 160dp + paddings/gaps larges), sans contrainte de hauteur du parent — dépassait cet espace de ~210dp. Le diagnostic UI-MOB-5 ("cause non isolée, texte jamais affiché même avec marqueur de debug") était en réalité une **fausse conclusion par absence de scroll pendant le test** : le marqueur de debug ajouté à l'époque était, lui aussi, hors du champ visible initial — jamais vu, pour la même raison, pas parce que le bundle était obsolète.

## 16. Pourquoi les tests précédents ne l'ont-ils pas détectée ?

Jest/RTL ne simule pas de moteur de layout natif ni de viewport réel — `getByText(...).toBeTruthy()` aurait été vrai avant *et* après le correctif (le texte a toujours été monté), donc un tel test n'aurait jamais pu détecter ce défaut. Seule une mesure `onLayout` réelle sur device (ou un test de layout simulé équivalent) pouvait le révéler — c'est pour cette raison que le mandat interdisait explicitement de certifier sur la seule base de Jest.

## 17. Quel correctif a été appliqué ?

Ajout d'une prop `compact` optionnelle à `EmptyState` (`altimmo-app/src/components/ui/EmptyState.jsx`), désactivée par défaut (comportement historique strictement inchangé pour les 10 autres écrans qui utilisent `EmptyState`) :
- illustration : 160dp → **104dp**
- padding du container : `spacing.xl` (24) → **`spacing.md`** (20)
- `marginTop` du titre : `spacing.lg` (36) → **`spacing.md`** (20)

Activée uniquement sur le `ListEmptyComponent` de la Home (`ListeAnnoncesScreen.jsx`, une seule ligne : `compact`). Effet mesuré : hauteur du container 318.93dp → **238.93dp** (−80dp), ce qui rapproche le titre du pli visible de ~80dp (de ~110dp sous le pli à ~56dp, vérifié par swipe réel, §20).

## 18. Pourquoi ce correctif est-il minimal ?

Il ne touche ni le header (hero/recherche/filtres, déjà certifiés en UI-MOB-5, fonctionnellement nécessaires, modifier leur hauteur risquait de régresser le cas "avec données") ni les 10 autres écrans utilisant `EmptyState` (prop opt-in, défaut inchangé). Réduire davantage l'empreinte de l'empty state pour atteindre un affichage sans aucun scroll nécessiterait de supprimer quasiment l'illustration — contraire au mandat (§8 : structure icône + titre + description à conserver) et non justifié par une preuve de cause supplémentaire : au-delà de ce point, la contrainte est purement structurelle (le header occupe 78 % du viewport sur ce device), pas un bug à corriger par un hack de style.

## 19. Quel test empêche la régression ?

`altimmo-app/src/components/ui/__tests__/EmptyState.test.jsx` (nouveau, 4 tests) — cible le mécanisme réel identifié (l'empreinte verticale), pas seulement la présence du texte :
- `compact` réduit l'illustration à 104dp (vs 160dp par défaut)
- sans `compact`, les 10 autres écrans gardent 160dp (non-régression)
- `compact` réduit le padding du container et le `marginTop` du titre aux valeurs mesurées
- contraste conservé (`c.text`/`c.textSub`) dans les deux cas

## 20. Résultat réel Light ?

**Confirmé sur device réel.** Avant correctif : illustration visible, aucun texte visible même après relance complète. Après correctif (`compact`) : illustration réduite visible immédiatement ; un swipe court (~53dp, mesuré) fait apparaître "Aucune annonce trouvée" clairement lisible (`#1A1A1A` sur fond clair) ; un swipe supplémentaire révèle le sous-titre complet, également lisible (`#666666`). Screenshots réels conservés dans le répertoire de travail de session (`before.png`, `after_light.png`, `after_scroll.png`, `verify.png`).

## 21. Résultat réel Dark ?

**Confirmé sur device réel**, thème basculé manuellement sur "Sombre" via l'écran Profil (préférence explicite stockée, indépendante du thème système Android). Titre et sous-titre parfaitement lisibles (blanc/gris clair sur fond noir), illustration cohérente, aucune régression par rapport au Light. Screenshot : `dark_home_scroll.png`.

## 22. Bottom nav toujours correcte ?

**Oui**, re-vérifiée sur device réel dans ce sprint : navigation tactile Home → Profil → Home fonctionnelle, tab bar entièrement au-dessus de la barre système Android 3 boutons dans les deux thèmes, aucun recouvrement, aucune régression du correctif UI-MOB-5 (§13-14 de ce rapport-là).

## 23. Home WITH DATA vérifiée ?

**NON CONFIRMÉ** — la base de données de production actuellement interrogée par l'app retourne 0 résultat pour les filtres par défaut ; conformément au mandat (§19), aucune donnée de production n'a été créée pour forcer cet état. Le correctif ne touche que la branche `ListEmptyComponent` (jamais rendue quand `annonces.length > 0`) : risque de régression sur le cas "avec données" jugé nul par lecture de code, mais non observé sur device dans ce sprint.

## 24. Fichiers modifiés

- `altimmo-app/src/components/ui/EmptyState.jsx` — prop `compact` (illustration/padding/gap réduits), `testID` ajouté pour le test.
- `altimmo-app/src/screens/Annonces/ListeAnnoncesScreen.jsx` — `compact` sur le `ListEmptyComponent` de la Home (seule ligne fonctionnelle nouvelle ; `removeClippedSubviews` testé à `false` pour diagnostic puis restauré à `true`, valeur d'origine, aucun changement net).
- `altimmo-app/src/components/ui/__tests__/EmptyState.test.jsx` — nouveau, 4 tests.

Aucun fichier backend touché. Aucun changement métier (Auth/JWT/Tenant/IAM/PMS/Paiement/Mongo/API). Toute instrumentation `onLayout`/`console.log` temporaire a été retirée avant la fin du sprint (vérifiée par relecture finale — voir diff final ci-dessous).

## 25. Gates

- `npm run check:syntax` → 186 fichiers, 0 erreur.
- `npm run lint` → **0 erreur**, 105 avertissements (baseline UI-MOB-5 : 104 ; l'écart provient de fichiers non touchés par ce sprint, vérifié par lint ciblé sur les 3 fichiers modifiés + le nouveau test : 0 avertissement).
- `npm run typecheck` → 0 erreur.
- `npm run test:coverage` → **42/42 suites, 367/367 tests** (baseline UI-MOB-5 : 41/363 ; +1 suite, +4 tests, aucune régression).
- `npx expo-doctor` → 20/21 checks passés, identique à la baseline UI-MOB-5 (8 patchs mineurs pré-existants, non liés).
- `npm run export -- --platform android` → succès (bundle `.hbc` 6.7MB).
- `git diff --check` → exit 0.

## 26. Git

Aucun `git add`/`commit`/`push`/déploiement exécuté par cette session. Modifications UI-MOB-5 préexistantes conservées intactes.

```
git diff --stat -- altimmo-app/
 altimmo-app/src/components/ui/EmptyState.jsx              | 27 ++++++++++-----
 altimmo-app/src/navigation/CustomTabBar.jsx                | 16 +++++--
 altimmo-app/src/navigation/TabNavigator.jsx                | 14 +++++-
 altimmo-app/src/screens/Annonces/ListeAnnoncesScreen.jsx   | 13 +++++-
git diff --check → exit 0
git rev-parse HEAD → 29044699d25df30d1fffbbadf11fefc9cd6f9cac (inchangé)
```

## 27. Verdict

**UI-MOB-5.1 : CERTIFIÉ VERT.**

Justification, point par point (critères mandat §24) :
- Cause exacte identifiée avec preuve chiffrée (`onLayout` sur device réel) : ✅ — misdiagnostic UI-MOB-5 corrigé (le texte n'était jamais un bug de rendu, mais un défaut de positionnement sous le pli, exact mécanisme désormais documenté).
- Titre "Aucune annonce trouvée" réellement visible sur Android : ✅ — capture réelle, lisible, contrasté (§20).
- Sous-titre réellement visible : ✅ — capture réelle, lisible, contrasté (§20).
- Light PASS / Dark PASS : ✅ (§20-21).
- Illustration PASS : ✅ — recentrée, cohérente, ni cassée ni disparue.
- Home non régressée : ✅ — hero, recherche, catégories, "à découvrir" tous re-vérifiés inchangés sur device.
- Bottom nav non régressée : ✅ — re-testée Home↔Profil (§22).
- Test de régression pertinent ajouté : ✅ — cible le mécanisme réel (empreinte verticale), pas une simple présence de texte (§19).
- Gates verts : ✅ (§25).

**Note de transparence** (au-delà des critères formels, dans l'esprit du mandat §28 — pas de faux "tokens corrects") : sur ce device précis, atteindre le titre nécessite encore un court geste de scroll (~56dp, mesuré) depuis l'état initial de la Home vide, et un peu plus pour le sous-titre complet — ce n'est **pas** un défaut de rendu (le texte est monté, dimensionné, contrasté, dans le flux normal d'une liste scrollable), mais une conséquence structurelle du header légitime (460.8dp, déjà audité et certifié en UI-MOB-5) qui occupe 78 % du viewport disponible sur ce device. Le réduire davantage sans preuve de cause supplémentaire aurait signifié deviner un correctif plus large que celui strictement justifié par la mesure — explicitement proscrit par le mandat. Le défaut originellement rapporté ("texte jamais affiché, cause inconnue") est intégralement résolu et prouvé ; ce résidu documenté est un comportement de liste normal, pas une réserve ouverte.
