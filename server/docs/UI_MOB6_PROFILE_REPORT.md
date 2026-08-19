# UI-MOB-6 — Profil : lisibilité device-first & finition visuelle

Date : 2026-08-19. Branche `main`, `HEAD 29044699d25df30d1fffbbadf11fefc9cd6f9cac` (inchangé). Device réel : Samsung Galaxy SM_S918B (`R5CW821Y2JZ`), navigation Android 3 boutons.

## Matrice visuelle

| Zone Profil | Light | Dark | Device | Verdict |
|---|---|---|---|---|
| Header (statut/safe area) | PASS | PASS | Samsung SM_S918B (réel) | PASS |
| Avatar | PASS | PASS | réel | PASS |
| Nom | PASS (corrigé) | PASS | réel | PASS |
| Email | PASS (corrigé) | PASS | réel | PASS |
| Badge rôle | PASS | PASS | réel | PASS |
| Sections (Mes biens/Activité/Compte/…) | PASS | PASS | réel | PASS |
| Icônes | PASS | PASS | réel | PASS |
| Labels | PASS | PASS | réel | PASS |
| Chevrons | PASS | PASS | réel | PASS |
| Logout ("Se déconnecter") | PASS (visuel uniquement) | PASS (visuel uniquement) | réel | PASS |
| Bottom nav | PASS (non régressée) | PASS (non régressée) | réel | PASS |

## 1. Résumé exécutif

Le Profil affichait, sur device réel, un nom et un email quasi invisibles dans le hero — exactement le symptôme flagué en marge de UI-MOB-5.1. La cause a été confirmée identique à celle déjà résolue pour la Home en UI-MOB-5 : le hero repose uniquement sur un `LinearGradient` décoratif comme source de fond sombre, sans fond de secours ; sur ce device, le gradient ne se peint pas et le texte (conçu pour un fond sombre) atterrit sur le fond clair de l'écran. Le même correctif minimal, déjà prouvé, a été appliqué : un `backgroundColor` de secours sur le style `hero`. Vérifié réellement lisible en Light et en Dark sur le même device, sans régression sur le reste de l'écran ni sur la bottom navigation.

## 2. Baseline

`HEAD 29044699d25df30d1fffbbadf11fefc9cd6f9cac`, inchangé pendant tout le sprint. Modifications UI-MOB-5/5.1 préexistantes conservées intactes (voir `UI_MOB6_PROFILE_ETAT_INITIAL.md`).

## 3. Device utilisé

Samsung Galaxy SM_S918B, navigation Android 3 boutons, densité 450. `adb devices` confirmé en début de sprint. Metro réutilisé (process actif hérité des sprints précédents de la même session).

## 4. Reproduction

`Home → Profil` (tap réel sur la tab bar). Capture réelle avant modification : nom "Altitude Vision" et email "altitudevis3n@gmail.com" en texte fantôme sur fond quasi blanc dans le hero ; badge "Admin" (rouge, couleur sémantique indépendante) resté lisible ; avatar et bouton caméra corrects.

## 5. Profil BEFORE

Capture réelle conservée dans le répertoire de travail de session (`profil_before.png`). Fond du hero mesuré visuellement identique au token clair `c.bg` de l'écran (même défaut que la Home avant UI-MOB-5).

## 6. Nom utilisateur

Rendu par `Text style={styles.heroName}` dans `ProfilScreen.jsx` (ligne ~201), directement dans le hero. `heroName.color = '#F0EDE8'` (quasi blanc), non thème-dépendant (choix délibéré, cohérent avec un hero à fond sombre fixe, voir §9).

## 7. Email

Rendu par `Text style={styles.heroEmail}` (ligne ~203), conditionnel à `user?.email`. `heroEmail.color = 'rgba(240,237,232,0.75)'` (quasi blanc, 75 % d'opacité — déjà relevé/ajusté en UI-MOB-1 à partir de 0.5).

## 8. Cause racine

Le style `hero` (`ProfilScreen.jsx`, avant correctif) ne définissait aucun `backgroundColor` — son seul fond provenait d'un `<LinearGradient colors={['#0A0A0A','#1C1408','#2D1E04']} style={StyleSheet.absoluteFillObject} />` placé en premier enfant. Sur ce device réel (Android, dev client), ce gradient ne se peint pas — constat déjà établi pour la Home en UI-MOB-5 avec le même composant et la même architecture, revérifié ici par capture réelle. Sans base, `heroName`/`heroEmail` (couleurs quasi blanches, conçues pour ce fond sombre) atterrissaient sur le fond réellement visible : `c.bg` (`#FAFAF8` en Light), quasi blanc lui aussi → texte quasi invisible.

## 9. Theme/tokens

`heroName`/`heroEmail` utilisent des couleurs fixes (`#F0EDE8`, `rgba(240,237,232,0.75)`), pas de token `useTheme()`. **Ce n'est pas une erreur d'utilisation de token** : le hero est architecturalement un bandeau à fond sombre fixe, volontairement identique en Light et en Dark (même pattern que le hero Home, documenté en UI-MOB-5 §6 : « ne consulte jamais `themeColors` pour son propre fond »). Le correctif respecte ce choix de design existant plutôt que de le remettre en cause sans preuve — conforme au mandat (§24 : pas de hardcode sans justification, mais exception légitime pour un élément volontairement invariant déjà conforme à l'architecture).

## 10. Opacity

`heroEmail` porte une opacité de 75 % **encodée dans le canal alpha de sa couleur** (`rgba(...,0.75)`), pas une prop `opacity` de style séparée — donc pas de risque de double-atténuation par un `opacity` parent. Aucun parent (`hero`, `SafeAreaView`, `ScrollView`) ne porte de prop `opacity`. Vérifié explicitement par lecture du code (mandat §9) : aucune opacité parent en cause.

## 11. Hero

Dimensions non modifiées ce sprint (déjà ajustées en UI-MOB-1 : `paddingBottom` réduit de `spacing.xxl` à `spacing.lg`). Vérifié visuellement correct sur device (avatar, nom, email, badge bien centrés et espacés, pas d'espace mort excessif) — aucune preuve de défaut résiduel, donc non retouché (mandat §14 : ne pas réduire davantage sans preuve).

## 12. Avatar

Taille (92×92, radius 46), bordure dorée, badge caméra : tous corrects sur device, Light et Dark. Non modifié (aucun défaut démontré).

## 13. Badge rôle

"Admin" (fond rouge sémantique `colors.error`, texte blanc) parfaitement lisible en Light et Dark sur device — déjà correctement rééquilibré en UI-MOB-1, non retouché.

## 14. Sections

"MES BIENS", "ACTIVITÉ", "COMPTE", "APPARENCE", "PRÉFÉRENCES", "SUPPORT" : titres de section, cartes, lignes, icônes, labels, chevrons, séparateurs — tous vérifiés lisibles et correctement contrastés sur device réel, en Light et en Dark. Aucun défaut observé.

## 15. Cards

`menuGroup`/`menuRow` (pattern local, déjà noté "fonctionnellement correct et theme-aware" en UI-MOB-1) : confirmé visuellement correct sur device, non refactorisé (mandat §22 : pas de changement spéculatif sans défaut démontré).

## 16. Icons

Icônes `Ionicons` dans `menuIconWrap` (fond doré clair, icône dorée) : contraste correct dans les deux thèmes sur device.

## 17. Typography

Hiérarchie nom (display, taille lg) / email (body, sm) / labels de section (uppercase, `textMuted`) / labels de ligne (body) cohérente et distincte sur device — aucun changement nécessaire au-delà du fond de secours du hero.

## 18. Spacing

Densité des sections jugée correcte sur device (pas d'espace mort excessif ni de cartes exagérément hautes) — aucune correction nécessaire.

## 19. Scroll

Contenu accessible jusqu'au bout ("Se déconnecter" pleinement visible et cliquable au-dessus de la tab bar), scroll fluide, vérifié sur device dans les deux thèmes.

## 20. Safe area

`SafeAreaView edges={['top']}` : aucun titre masqué par la status bar. `paddingBottom: spacing.xxl` sur `scroll` + tab bar réservant `insets.bottom` (correctif UI-MOB-5, intact) : dernier élément non recouvert.

## 21. Bottom nav

Vérification de non-régression uniquement (aucune modification) : onglet Profil sélectionnable et actif visuellement (icône + label dorés), tab bar entièrement au-dessus de la barre système Android 3 boutons, taps reçus normalement (navigation Home↔Profil testée plusieurs fois), aucun recouvrement — correctif UI-MOB-5 intact.

## 22. Light Mode

**PASS**, confirmé sur device réel après correctif : nom et email nettement lisibles (`#F0EDE8` et `rgba(240,237,232,0.75)` sur fond `#0A0A0A` de secours, contrastes largement AA/AAA), badge, avatar, sections toutes correctes.

## 23. Dark Mode

**PASS**, confirmé sur device réel (préférence basculée manuellement sur "Sombre" via les réglages Profil, indépendante du thème système Android). Hero visuellement identique au Light (fond sombre fixe, par design), sections correctement thémées en sombre (cartes, icônes, séparateurs). Aucune régression.

## 24. Responsive

Non re-testé sur une seconde largeur d'écran dans ce sprint — le Samsung SM_S918B (384dp de large effectif) sert de preuve principale, conformément au mandat (§26 : ne pas bloquer le sprint uniquement pour un second device). Nom "Altitude Vision" et email observés sur le compte réel disponible : ni l'un ni l'autre n'approche la largeur de l'écran, aucun wrapping/troncature observé. **NON CONFIRMÉ** pour un nom ou un email significativement plus long, ou une largeur < 380dp.

## 25. Accessibilité

Contrastes mesurés conformes AA/AAA (§22-23). `accessibilityRole`/`accessibilityLabel` déjà présents sur l'avatar (bouton) et chaque `MenuRow` (code existant, non modifié). Tailles tactiles des lignes de menu (padding généreux) inchangées, jugées correctes visuellement.

## 26. Shared components

Aucun composant partagé modifié — la cause était locale à `ProfilScreen.jsx` (même anti-pattern que la Home, mais dans un fichier distinct, pas un composant commun). Conforme au mandat (§22 : ne pas modifier un composant partagé sans que la cause y soit réellement localisée).

## 27. Corrections

Un seul changement fonctionnel : ajout de `backgroundColor: '#0A0A0A'` au style `hero` de `ProfilScreen.jsx`, en fond de secours sous le `LinearGradient` existant — reprend exactement la teinte du premier stop du dégradé (`#0A0A0A`, identique à la correction Home UI-MOB-5), pas une couleur inventée.

## 28. Tests de régression

`altimmo-app/src/screens/Profil/__tests__/ProfilScreenHero.test.jsx` (nouveau, 2 tests) :
- verrouille que le hero (ancêtre direct du nom) porte bien `backgroundColor: '#0A0A0A'` — **vérifié qu'il aurait échoué avant le correctif** : en le retirant temporairement (`git stash` ciblé + re-run), le test échoue en remontant jusqu'au premier ancêtre avec un fond réel, qui est alors `SafeAreaView` (`c.bg`, `#FAFAF8`) — capturant exactement le mécanisme de la régression, pas seulement la présence du texte.
- verrouille les couleurs quasi blanches du nom/email, cohérentes avec un fond sombre garanti.

## 29. Browser/device evidence

Captures réelles conservées dans le répertoire de travail de session : `profil_before.png` (avant), `profil_light_clean.png`/`p11.png` (après, Light), `p8.png` (après, Dark). Aucune image générée artificiellement.

## 30. Gates

- `npm run check:syntax` → 187 fichiers, 0 erreur.
- `npm run lint` → **0 erreur**, 105 avertissements (identique à la baseline UI-MOB-5.1, aucun nouvel avertissement introduit).
- `npm run typecheck` → 0 erreur.
- `npm run test:coverage` → **43/43 suites, 369/369 tests** (baseline UI-MOB-5.1 : 42/367 ; +1 suite, +2 tests, aucune régression).
- `npx expo-doctor` → 20/21 checks, identique à la baseline (8 patchs mineurs pré-existants, non liés).
- `npm run export -- --platform android` → succès (bundle `.hbc` 6.7MB).
- `git diff --check` → exit 0.

## 31. Fichiers modifiés

- `altimmo-app/src/screens/Profil/ProfilScreen.jsx` — `backgroundColor: '#0A0A0A'` ajouté au style `hero` (fond de secours).
- `altimmo-app/src/screens/Profil/__tests__/ProfilScreenHero.test.jsx` — nouveau, 2 tests.

Aucun fichier backend touché. Aucun changement métier (Auth/JWT/Tenant/IAM/businessProfiles/Ownership/Messaging/PMS/Payments/Mongo/API).

## 32. Git

Aucun `git add`/`commit`/`push`/déploiement exécuté par cette session.

```
git diff --stat -- altimmo-app/
 altimmo-app/src/screens/Profil/ProfilScreen.jsx | 9 +++++++++
git diff --check → exit 0
git rev-parse HEAD → 29044699d25df30d1fffbbadf11fefc9cd6f9cac (inchangé pendant tout le sprint)
```

## 33. Réserves

1. **Responsive** : non re-testé sur une largeur < 380dp ni avec un nom/email significativement plus long que celui du compte réel disponible (§24, NON CONFIRMÉ).
2. **Logout** : vérifié uniquement visuellement (couleur destructive rouge, lisible, bien identifiable, proportionné) — aucun tap de validation fonctionnelle exécuté, conformément au périmètre strict de ce sprint (pas de sprint Auth, mandat §28-29).
3. **Cause profonde du `LinearGradient` invisible sur ce device/build** : toujours non élucidée (héritée de la réserve UI-MOB-5 §34.5) — le correctif (fond de secours) rend le symptôme non-bloquant indépendamment de cette cause plus profonde, désormais appliqué de façon cohérente aux deux écrans qui partagent cette architecture (Home, Profil).

## 34. Verdict

**UI-MOB-6 : CERTIFIÉ VERT.**

Justification (critères mandat §37) :
- Nom réellement lisible sur device : ✅ (Light et Dark, capture réelle).
- Email réellement lisible sur device : ✅ (Light et Dark, capture réelle).
- Light PASS : ✅. Dark PASS : ✅.
- Hero correct : ✅ (dimensions déjà justes depuis UI-MOB-1, fond de secours ajouté).
- Avatar correct : ✅. Badge rôle correct : ✅.
- Sections principales lisibles : ✅ (toutes vérifiées, Light et Dark).
- Aucun chevauchement critique : ✅.
- Scroll correct, dernier contenu accessible au-dessus de la tab bar : ✅.
- Bottom nav non régressée : ✅.
- Test de régression pertinent, ciblant la cause réelle (pas juste `getByText`) : ✅, vérifié qu'il échoue avant le correctif.
- Tests/lint/types/expo-doctor/export verts : ✅.
- Aucune régression métier : ✅ (aucun fichier backend ni logique Auth/API touché).

Le défaut cité en priorité absolue par le mandat (nom et email quasi invisibles) est résolu et prouvé par capture d'écran réelle sur le même device que celui ayant servi à le constater, dans les deux thèmes. Aucun défaut visuel important résiduel identifié sur le périmètre du Profil.

**STOP conforme au mandat §39** — aucun autre écran entamé. En attente de validation avant le prochain sprint (Mes annonces ou autre écran prioritaire).
