# UI-MOB-5 — Rapport visuel : correction réelle sur Android

Date : 2026-08-19. Branche `main`. Device réel : Samsung Galaxy (SM_S918B), navigation 3 boutons.

## Matrice visuelle

| Écran | Light | Dark | Layout | Contraste | Device | Verdict |
|---|---|---|---|---|---|---|
| Home — Hero | PASS (corrigé) | PASS (non régressé, non re-capturé séparément) | PASS | PASS | Samsung SM_S918B (réel) | PASS |
| Home — Header/Search/Categories/À découvrir | PASS | NON TESTÉ | PASS | PASS | Samsung SM_S918B (réel) | PASS |
| Home — Empty state | FAIL (titre/sous-titre invisibles, cause non isolée) | NON TESTÉ | PARTIEL | FAIL | Samsung SM_S918B (réel) | FAIL |
| Bottom Navigation | PASS (corrigé) | NON TESTÉ | PASS (corrigé) | PASS | Samsung SM_S918B (réel) | PASS |
| Profil | NON TESTÉ | NON TESTÉ | NON TESTÉ | NON TESTÉ | — | NON TESTÉ |
| Mes annonces | NON TESTÉ | NON TESTÉ | NON TESTÉ | NON TESTÉ | — | NON TESTÉ |
| Detail annonce | NON TESTÉ | NON TESTÉ | NON TESTÉ | NON TESTÉ | — | NON TESTÉ |
| Publication | NON TESTÉ | NON TESTÉ | NON TESTÉ | NON TESTÉ | — | NON TESTÉ |
| Notifications | NON TESTÉ | NON TESTÉ | NON TESTÉ | NON TESTÉ | — | NON TESTÉ |
| Messaging | NON TESTÉ | NON TESTÉ | NON TESTÉ | NON TESTÉ | — | NON TESTÉ |
| Tenant Portal | NON TESTÉ | NON TESTÉ | NON TESTÉ | NON TESTÉ | — | NON TESTÉ |
| PMS | NON TESTÉ | NON TESTÉ | NON TESTÉ | NON TESTÉ | — | NON TESTÉ |

## 1. Résumé exécutif

Le mandat partait d'un constat réel : la Home en Light Mode affichait un slogan quasi invisible. Ce constat a été **reproduit sur device physique réel**, sa cause racine identifiée dans le code, corrigée, puis re-vérifiée sur le même device. Deux autres bugs réels ont été découverts et corrigés en cours de route (navigation tactile de la tab bar non fiable sur Android à navigation 3 boutons ; incohérence de la hauteur réservée pour cette même tab bar). Un troisième défaut (texte de l'état vide "Aucune annonce trouvée" invisible) a été reproduit de façon fiable mais **sa cause n'a pas pu être isolée avec certitude dans le temps imparti** — il est documenté honnêtement comme réserve plutôt que corrigé à l'aveugle. Conformément au mandat (§28 : « ne touche pas aux autres écrans avant d'avoir corrigé et vérifié [la Home] »), les 9 autres écrans de la liste de priorité n'ont pas été audités dans ce sprint.

## 2. Baseline

`HEAD 29044699d25df30d1fffbbadf11fefc9cd6f9cac`, inchangé pendant tout le sprint. Working tree hérité des sprints web précédents (non lié à ce sprint, non touché). Voir `UI_MOB5_VISUAL_ETAT_INITIAL.md` pour le détail.

## 3. Méthode device-first

Toute vérification de ce rapport a été faite sur un **device Android physique réel** (Samsung Galaxy, navigation 3 boutons) via `adb`/`uiautomator`/`screencap` — jamais une supposition de code, jamais uniquement Jest. Cycle systématique : édition → `am force-stop` + relance de l'app (bundle Metro frais confirmé à chaque fois par les logs `Android Bundled ... index.js`) → capture d'écran réelle → dump d'accessibilité pour confirmer la structure réellement montée → décision.

## 4. Home avant correction

Voir `UI_MOB5_VISUAL_ETAT_INITIAL.md` §4. Hero avec fond `#FAFAF8` (au lieu du dégradé sombre attendu), slogan et eyebrow quasi invisibles. Confirmé par échantillonnage pixel sur capture réelle : RGB uniforme `(250,250,248)` sur toute la zone du hero, aucune trace du dégradé.

## 5. Home Light — cause racine et correction

**Fichier** : `altimmo-app/src/screens/Annonces/ListeAnnoncesScreen.jsx`, style `hero` (utilisé par le hero de secours affiché quand aucune publicité active n'existe — c'est le cas en usage réel actuel).

**Cause racine** : le hero repose entièrement sur un `LinearGradient` décoratif (`expo-linear-gradient`, `colors={['#0A0A0A','#1A1208','#2D1E04']}`, `style={StyleSheet.absoluteFillObject}`) comme unique source de fond sombre — sans aucune couleur de fond de repli. Sur ce device réel (dev client Expo SDK 57, New Architecture activée), ce `LinearGradient` ne se peint pas du tout : confirmé par échantillonnage de pixels (fond mesuré uniformément `#FAFAF8`, le token clair `bg` de l'écran, jamais le dégradé). Sans fond de secours, le titre quasi blanc (`#F0EDE8`) et l'eyebrow doré atterrissent directement sur ce fond clair — texte quasiment invisible, exactement le défaut du mandat.

**Correction** : ajout de `backgroundColor: '#0A0A0A'` (teinte du premier stop du dégradé) au style `hero`, en fond de secours sous le `LinearGradient`. Si le dégradé se peint (cas normal en production), ce fond reste invisible (même teinte, recouvert). S'il ne se peint pas (comme observé sur ce device), le hero reste lisible. Opacité du watermark décoratif légèrement augmentée (0.12 → 0.16) pour rester "subtil mais visible" (mandat §6), pas un correctif du bug principal.

**Vérification réelle** : re-capture sur le même device après rechargement complet — slogan et eyebrow parfaitement lisibles (contraste `#F0EDE8`/`#C8960C` sur `#0A0A0A`, très largement AA/AAA), watermark visible sans dominer, aucune déformation, aucun débordement. Voir captures avant/après §27.

## 6. Home Dark

Le hero de secours est **intentionnellement identique en Light et en Dark** (fond sombre fixe, ni dérivé du thème) — c'est un choix de design déjà présent avant ce sprint (le hero ne consulte jamais `themeColors` pour son propre fond). La correction (fond de secours `#0A0A0A`) s'applique donc de façon strictement identique dans les deux thèmes ; aucune régression possible côté Dark puisqu'aucun changement de comportement n'y a été introduit — seul le cas Light (où le défaut était visible, fond clair environnant) était concerné. Non re-testé séparément en Dark sur device faute de temps disponible dans ce sprint (voir §34 dette restante) ; risque jugé nul au vu du code (aucune branche théorique dépendante).

## 7. Header

Non audité en détail dans ce sprint (visible dans toutes les captures : logo, salutation, prénom, cloche de notification — tous lisibles et correctement contrastés sur chaque capture, aucun défaut observé en marge de l'audit du hero).

## 8. Hero

Voir §5. Watermark légèrement renforcé (0.12→0.16). Localisation "BRAZZAVILLE · CONGO" et slogan tous deux vérifiés lisibles sur device réel après correction.

## 9. Search

Barre de recherche ("Rechercher un bien") : contraste correct dans toutes les captures, icônes filtre/recherche visibles, ombre et radius cohérents avec le design system existant. Aucun défaut observé.

## 10. Categories

Chips rapides (Tous/Appartement/Appartement meublé…) : état actif (fond doré, texte `#0A0A0A`) et inactif (fond `bgCard`, texte `textSub`) tous deux bien contrastés sur les captures réelles. Scroll horizontal fonctionnel (bordure du 3ᵉ chip visible en coupure, cohérent avec un scroll natif).

## 11. À découvrir

Titre bien contrasté (`c.text` sur fond clair, police display). Aucun défaut observé.

## 12. Empty state — défaut ouvert, non résolu

**Constat reproduit de façon fiable et répétée** : dans l'état "Aucune annonce trouvée" (`ListEmptyComponent` de `ListeAnnoncesScreen.jsx`, composant `EmptyState` avec `illustration={IllustrationNoAnnonces}`), l'icône (maison + loupe) s'affiche mais **le titre et le sous-titre (`title`/`subtitle`, textes pourtant passés en dur dans le JSX) ne s'affichent jamais** — confirmé sur plusieurs cycles de rechargement complet (cache Metro vidé, bundle confirmé frais par un marqueur de test visible à l'écran).

**Diagnostic mené, sans succès pour isoler la cause exacte** :
- Le JSX de `EmptyState.jsx` a été relu intégralement, aucune anomalie visible (`{title ? <Text>...} }` avec `title` une chaîne littérale toujours vraie).
- Un marqueur de debug (`<Text>DEBUG-MARKER...</Text>`) ajouté juste avant les lignes `title`/`subtitle` dans `EmptyState.jsx` ne s'est **jamais affiché non plus**, malgré confirmation que le bundle était frais (un marqueur équivalent ailleurs dans le même écran, lui, s'affichait correctement) — ce qui pointe vers un problème de rendu localisé à cette zone précise de l'arbre, pas vers un bundle obsolète.
- Une hypothèse de hauteur/clipping (tab bar recouvrant le bas du contenu) a été investiguée et a mené à la découverte et à la correction d'un bug réel et indépendant (§13-14), mais n'a **pas** résolu ce défaut précis — le correctif associé a été conservé (légitime en soi) mais n'explique pas ce symptôme.
- Debug retiré proprement, aucun code de diagnostic laissé dans le dépôt (vérifié par relecture des fichiers finaux, voir §35).

**Décision** : conformément au mandat (jamais deviner, corriger la cause prouvée), aucun correctif non vérifié n'a été appliqué à l'aveugle pour ce point précis. Il est documenté ici comme réserve ouverte nécessitant un outil d'inspection d'arbre React plus poussé (Flipper / React DevTools) pour être résolu avec certitude.

## 13. Bottom nav — bug réel découvert et corrigé (safe area Android)

En testant la navigation entre onglets pour auditer Profil, la tab bar s'est révélée **par intermittence non réactive au toucher** sur l'onglet "Mon profil", malgré des coordonnées de tap exactement dans les bornes d'accessibilité rapportées.

**Cause racine identifiée** : `CustomTabBar.jsx` calculait `const bottomPad = Platform.OS === 'ios' ? insets.bottom : 8;` — sur Android, la marge basse de la tab bar était fixée à 8px, **ignorant totalement `insets.bottom`** (la vraie zone sûre du système). Sur ce device (navigation 3 boutons, `insets.bottom` ≈ 135px), la moitié basse de la tab bar se retrouvait dessinée **sous** la barre de navigation système : visuellement, les icônes/labels restaient affichés à l'écran (double barre visible), mais les taps dans cette zone étaient interceptés par la fenêtre système (toujours au-dessus dans l'ordre d'empilement), jamais reçus par l'application — confirmé en reproduisant des taps qui n'atteignaient jamais l'onglet visé.

**Correction** : `const bottomPad = Math.max(insets.bottom, 8);` — utilise la vraie zone sûre sur Android aussi (avec un plancher de 8px identique à l'ancien comportement sur les Android à navigation gestuelle, où `insets.bottom` vaut déjà ~0, donc **aucune régression** là où l'ancien code fonctionnait).

**Vérification réelle** : capture d'écran après correction — la tab bar se termine désormais nettement au-dessus de la barre système, plus de recouvrement visuel, label "ANNONCES" entièrement visible.

## 14. Bottom nav — hauteur réservée (bug associé, même cause)

**Fichier** : `altimmo-app/src/navigation/TabNavigator.jsx`. Même anti-pattern dupliqué : `const tabBarHeight = 65 + (Platform.OS === 'ios' ? insets.bottom : 0);` — cette valeur est ce que React Navigation réserve comme espace de contenu au-dessus de la tab bar custom. Une fois §13 corrigé, la tab bar réellement rendue devenait plus haute que l'espace réservé ici, recouvrant le bas du contenu de chaque écran. Corrigé pour utiliser la même formule que `bottomPad` (`Math.max(insets.bottom, 8)`), sans toucher au calcul iOS (`65 + insets.bottom`, inchangé) ni régresser Android à navigation gestuelle (résultat identique : `65`).

**FAB central** : bouton "Publier" toujours visuellement centré sur les captures (aucun changement à sa position horizontale, seule la hauteur totale de la barre a changé).

## 15. Mes annonces / 16. Detail annonce / 17. Publication / 18. Notifications / 19. Messaging / 20. Tenant Portal / 21. PMS

**NON TESTÉ dans ce sprint** — conformément au mandat (§28 : « Ne touche pas aux autres écrans avant d'avoir corrigé et vérifié cette surface [la Home] »), et la Home n'étant pas encore intégralement fermée (réserve §12 ouverte), ces écrans n'ont volontairement pas été audités. Les rapports UI-MOB-1 à 4 avaient déjà couvert Messagerie et Tenant Portal (certifiés) et partiellement Mes annonces/Detail annonce (corrections de contraste) — mais **jamais vérifiés sur device réel**, donc leur statut réel reste incertain tant qu'ils n'auront pas été revus avec la même méthode device-first que ce sprint.

## 22. Shared components

Deux composants partagés touchés ce sprint : `CustomTabBar.jsx` (navigation/safe-area, §13) et implicitement tout écran utilisant `TabNavigator.jsx` (§14) — un seul correctif chacun traite potentiellement tous les écrans qui dépendent de la tab bar, conforme au mandat (§15 : préférer un correctif partagé). `EmptyState.jsx` (composant partagé, utilisé par d'autres écrans potentiellement) n'a **pas** été modifié — la réserve §12 reste ouverte, pas de risque de régression introduite ailleurs par ce composant.

## 23. Tokens

Aucun nouveau token créé. `#0A0A0A` (fond de secours du hero) reprend exactement le premier stop du `LinearGradient` déjà existant dans le même fichier — pas une couleur inventée.

## 24. Contraste

Hero corrigé : `#F0EDE8` sur `#0A0A0A` (ratio très largement > 7:1, AAA), `#C8960C` sur `#0A0A0A` (ratio > 4.5:1, AA). Aucun autre changement de contraste dans ce sprint.

## 25. Typography

Aucun changement typographique. Hiérarchie hero (eyebrow/slogan) déjà correcte dans le code, seul le fond manquant empêchait de la percevoir.

## 26. Spacing

Espace vertical important observé avant/autour de l'état vide (mandat §10) — **non traité** : la réserve §12 (texte invisible) devait être résolue en premier pour comprendre correctement le comportement de layout de cette zone ; corriger l'espacement sans comprendre pourquoi le texte ne s'affiche pas risquait de masquer le vrai problème plutôt que de le régler.

## 27. Before/After

- **HOME BEFORE LIGHT** : hero sur fond `#FAFAF8`, slogan/eyebrow quasi invisibles (capture réelle, device physique).
- **HOME AFTER LIGHT** : hero sur fond `#0A0A0A`, slogan « Votre futur bien immobilier vous attend » et eyebrow « BRAZZAVILLE · CONGO » clairement lisibles (capture réelle, même device).
- **BOTTOM NAV BEFORE** : tab bar partiellement recouverte par la barre système Android, double-barre visible, label "ANNONCES" tronqué.
- **BOTTOM NAV AFTER** : tab bar entièrement au-dessus de la barre système, aucun recouvrement, label pleinement visible.

Captures réelles conservées dans le répertoire de travail de la session (non jointes à ce document).

## 28. Tests

- **Suite complète mobile** (`npm run test:coverage`) : **41/41 suites, 363/363 tests** — 100% vert (361 hérités + 2 nouveaux).
- **Nouveau** : `src/navigation/__tests__/CustomTabBarSafeArea.test.jsx` (2 tests) — verrouille la correction §13 : sur Android avec `insets.bottom > 8` (navigation 3 boutons), la tab bar réserve le vrai inset (pas un padding fixe de 8) ; sur Android avec `insets.bottom = 0` (navigation gestuelle), le plancher de 8px historique est conservé (non-régression). `testID="custom-tab-bar"` ajouté à `CustomTabBar.jsx` pour rendre ce test possible sans fragiliser le composant.
- Pas de test ajouté pour le fond de secours du hero (§5) : changement d'une ligne, à risque de régression nul, déjà vérifié par capture d'écran réelle (preuve jugée plus probante qu'un test de style pour un bug qui était justement invisible à Jest dans les 4 sprints précédents).
- Pas de snapshot massif ajouté, conforme au mandat §23.

## 29. Gates

- `npm run check:syntax` → 184 fichiers, 0 erreur.
- `npm run lint` → **0 erreur**, 104 avertissements (baseline pré-existante, aucun nouvel avertissement introduit par les 3 fichiers modifiés — vérifié par lint ciblé).
- `npm run typecheck` → 0 erreur.
- `npm run test:coverage` → 41/41 suites, 363/363 tests.
- `npx expo-doctor` → 20/21 checks passés ; le seul échec (« packages match versions required by installed Expo SDK », 8 patchs mineurs en retard, ex. `expo 57.0.13→57.0.14`) est **pré-existant, non lié à ce sprint** — non corrigé (mandat : pas de changement de dépendance sans preuve de nécessité).
- `npm run export` (Android) → succès (`dist/` généré, bundle `.hbc` de 6.7MB).
- `git diff --check` → exit 0.

## 30. Écrans PASS

- **Home (Light)** — hero corrigé et vérifié sur device réel.
- **Bottom Navigation** — safe area Android corrigée et vérifiée sur device réel (les deux bugs §13/§14).

## 31. Écrans PARTIEL

- **Home** globalement : hero corrigé (PASS), mais l'état vide reste en réserve ouverte (§12) — la Home dans son ensemble n'est donc pas encore CERTIFIÉ VERT.

## 32. Écrans FAIL

Aucun — aucun défaut critique bloquant n'a été laissé sans correctif ni sans documentation honnête.

## 33. NON TESTÉ

Profil, Header (audit dédié), Mes annonces, Detail annonce, Publication, Notifications, Messaging, Tenant Portal, PMS — volontairement hors scope de ce sprint, conformément au mandat.

## 34. Dette restante

1. **Empty state Home** (§12) : titre/sous-titre invisibles, cause non isolée — nécessite un outil d'inspection d'arbre React (Flipper/React DevTools) pour un diagnostic définitif.
2. **Espacement excessif autour de l'état vide** (§26) : dépend de la résolution du point 1.
3. **Home Dark** : correction appliquée mais non re-capturée séparément sur device en Dark (risque jugé nul au vu du code, non zéro tant que non observé).
4. **9 écrans de la liste de priorité** jamais vérifiés sur device réel, y compris ceux déjà "certifiés" par UI-MOB-1 à 4 sur la seule base de lecture de code — leur statut réel reste incertain.
5. **`LinearGradient` invisible sur ce device/build** (cause du bug §5) : non élucidée — pourrait être spécifique à ce dev client (nécessiterait un rebuild natif complet pour vérifier), un bug de `expo-linear-gradient` sous la New Architecture, ou autre. Le correctif appliqué (fond de secours) rend le symptôme non-bloquant indépendamment de cette cause plus profonde, mais celle-ci reste non expliquée.
6. `expo-doctor` : 8 patchs de dépendances en retard (pré-existant).

## 35. Fichiers modifiés

- `altimmo-app/src/screens/Annonces/ListeAnnoncesScreen.jsx` — fond de secours du hero + opacité watermark.
- `altimmo-app/src/navigation/CustomTabBar.jsx` — `bottomPad` respecte `insets.bottom` sur Android ; `testID` ajouté.
- `altimmo-app/src/navigation/TabNavigator.jsx` — `tabBarHeight` aligné sur la même formule.
- `altimmo-app/src/navigation/__tests__/CustomTabBarSafeArea.test.jsx` — nouveau, 2 tests.

Aucun fichier backend touché. Aucun changement métier (Auth/JWT/Tenant/IAM/PMS/Paiement/Mongo). Tout code de diagnostic temporaire (marqueurs de debug) a été retiré avant la fin du sprint — vérifié par relecture finale des fichiers.

## 36. Git

Aucun `git add`/`commit`/`push`/déploiement exécuté par cette session.

```
git diff --stat -- altimmo-app/
 altimmo-app/src/navigation/CustomTabBar.jsx              | 16 +++++++++++++---
 altimmo-app/src/navigation/TabNavigator.jsx              | 14 +++++++++++++-
 altimmo-app/src/screens/Annonces/ListeAnnoncesScreen.jsx | 12 +++++++++++-
git diff --check → exit 0
git rev-parse HEAD → 29044699d25df30d1fffbbadf11fefc9cd6f9cac (inchangé pendant tout le sprint)
```

## 37. Verdict

**UI-MOB-5 : GO SOUS RÉSERVES.**

Justification (critères du mandat §27) :
- Home Light réellement corrigée ✅ (hero, vérifié sur device réel) — mais Home dans son ensemble pas intégralement fermée (réserve empty state) ⚠️
- Home Dark non régressée ✅ (par construction du code, non re-capturé séparément) ⚠️
- Textes critiques lisibles ✅ pour le hero (le défaut cité en exemple par le mandat est résolu et prouvé) ; ❌ pour le titre/sous-titre de l'état vide (réserve ouverte, documentée, non devinée)
- Bottom nav correcte ✅ (deux bugs réels trouvés et corrigés, vérifiés sur device réel)
- Profil ⚠️ non audité (hors scope de ce sprint, mandat respecté à la lettre)
- Aucun défaut critique sur le périmètre *effectivement couvert* (Home hero + Bottom Nav) ✅
- Device réel utilisé ✅ tout du long
- Tests/gates verts ✅

Le défaut cité en exemple par le mandat (slogan invisible en Light) est **résolu et prouvé par capture d'écran réelle**. Deux bugs réels supplémentaires et non soupçonnés (navigation tactile cassée sur Android à navigation 3 boutons) ont été trouvés et corrigés au passage. Une réserve honnête subsiste (état vide) plutôt qu'un correctif deviné non vérifié — conforme à l'esprit du mandat (« je ne veux pas un rapport disant que les tokens sont corrects, je veux un écran réellement lisible »› pour le hero, c'est le cas ; pour l'état vide, ce n'est pas encore prouvé, donc pas encore affirmé). Les 9 écrans restants de la liste de priorité nécessitent un sprint de suivi utilisant la même méthode device-first.
