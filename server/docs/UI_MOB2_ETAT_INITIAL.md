# UI-MOB-2 — État initial : migration visuelle globale, bottom navigation & cohérence Light/Dark

Date : 2026-08-15. Branche `main`, HEAD `ab5ae586fab50ddce02e65ea081330d2769c6503` (identique à UI-MOB-1, non commité, `git diff --check` propre avant modification). Rapports UI-MOB-1 relus intégralement (`UI_MOB1_ETAT_INITIAL.md`, `UI_MOB1_REPORT.md`) puis chaque affirmation reprise a été revérifiée directement dans le code, pas supposée acquise.

## 1. Baseline Git

`git status --short` : 11 lignes (8 fichiers modifiés + 3 nouveaux, tous hérités d'UI-MOB-1, non commités). `git branch --show-current` → `main`. `git rev-parse HEAD` → `ab5ae586fab50ddce02e65ea081330d2769c6503`. `git diff --check` propre. Baseline tests héritée : 34/34 suites, 320/320 tests, Doctor 21/21.

## 2. Nombre réel de couleurs hardcodées (reproduit, pas supposé)

`grep -rnE "#[0-9A-Fa-f]{3,8}\b|rgb\(|rgba\(|hsl\(|hsla\(" src --include="*.jsx" --include="*.js"` (hors `__tests__`, hors `src/theme/`) → **579**, exactement le chiffre rapporté par UI-MOB-1. Confirmé par exécution réelle, pas recopié du rapport précédent.

## 3. Concentration par fichier (avant modification)

| Rang | Fichier | Occurrences |
|---|---|---:|
| 1 | `components/illustrations/ImmobilierHero.jsx` | 67 |
| 2 | `screens/Publication/PublierBienScreen.jsx` | 47 |
| 3 | `screens/MesBiens/MesAnnoncesScreen.jsx` | 46 |
| 4 | `screens/Annonces/DetailAnnonceScreen.jsx` | 39 |
| 5 | `screens/Notifications/NotificationsScreen.jsx` | 38 |
| 6 | `screens/Onboarding/OnboardingScreen.jsx` | 33 |
| 7 | `screens/Annonces/CarteScreen.jsx` | 33 |
| 8 | `screens/Auth/ResetPasswordScreen.jsx` | 22 |
| 9 | `screens/Auth/RegisterScreen.jsx` | 22 |
| 10 | `screens/Profil/TransactionsScreen.jsx` | 21 |

(liste complète : voir `UI_MOB1_ETAT_INITIAL.md` §15, reproduite ici pour les 10 premiers rangs).

**Correction du postulat implicite du mandat** : le rang #1 (`ImmobilierHero.jsx`, 67 occurrences) n'a jamais été mentionné par UI-MOB-1 ni par le mandat — c'est un composant d'**illustration décorative** (silhouette d'immeuble en SVG-like `View`s empilées), pas un écran fonctionnel. Vérifié par lecture directe : catégorie D (illustration), légitimement hors périmètre de migration (mandat §69).

## 4. Thème existant

Inchangé depuis UI-MOB-1 : `ThemeContext.jsx` (System/Light/Dark), `colors.js`/`colorsDark.js` (tokens historiques + alias sémantiques ajoutés en UI-MOB-1 : `background`, `surface`, `surfaceElevated`, `textPrimary`, `textSecondary`, `textInverse`, `borderStrong`, `primary`, `primaryPressed`, `primarySoft`, `primaryForeground`, `inputBackground`, `divider`). Revérifié par lecture directe des deux fichiers, pas supposé.

## 5. Bottom navigation — audit réel du composant

`src/navigation/CustomTabBar.jsx` (déjà `useTheme()`-aware avant ce sprint, contrairement à l'hypothèse implicite du mandat) :
- Barre : `backgroundColor: c.bgCard`, `borderTopColor: c.border` — déjà theme-aware.
- Labels : affichés **uniquement pour la tab active** (`labelOpacity` animé selon `isFocused`), de façon **identique pour toutes les tabs** — comportement intentionnel et cohérent (pas de tab "Profil" traitée différemment des autres, contrairement à l'hypothèse du mandat §13), confirmé par lecture du composant générique `TabItem`.
- État actif : `color = isFocused ? c.gold : c.textMuted` — conforme mandat §15.
- FAB central ("Publier") : bouton surélevé 52×52 (dépasse la cible tactile 44×44), fond `c.gold`, bordure `c.bgCard` (effet de découpe cohérent avec la barre). **Bug réel trouvé** : icône `+` en `color="#FFFFFF"` codé en dur, alors que le reste de l'app utilise `c.onAccent` (`#0A0A0A`, texte/icône sombre sur fond doré — voir `Button.jsx` variante primary) pour ce même type de surface. Incohérence de contraste potentielle sur le doré, corrigée §-voir REPORT.
- Shadow : `shadowColor: '#000'` fixe — légitime (convention standard, une ombre reste sombre indépendamment du thème).
- Pill de fond glissante : `rgba(200, 150, 12, 0.10)` fixe, commentaire du code documentant explicitement l'effet recherché (« visible en dark, quasi invisible en light ») — accepté tel quel, non modifié (catégorie E, overlay graphique documenté).

`src/navigation/TabNavigator.jsx` : **bug dark-mode réel trouvé** — `AnnoncesStack` (Stack.Navigator imbriqué dans l'onglet Annonces) utilisait `cardStyle: { backgroundColor: colors.bg }` avec `colors` = import **statique clair**, indépendant du thème choisi par l'utilisateur. Pendant les transitions d'écran (`ListeAnnonces` → `DetailAnnonce`/`Notifications`), le fond de la carte de transition restait clair même en mode sombre — un vrai défaut visuel démontré par lecture de code, pas supposé.

## 6. FAB

Voir §5 — FAB déjà correctement positionné (safe area respectée via `bottomPad`), touch target correct (52×52 > 44×44), ne masque aucune tab (largeur `tabWidth` calculée dynamiquement par `SCREEN_WIDTH / tabCount`, le FAB occupe son propre slot comme les autres tabs). Seul bug : couleur d'icône fixe (§5).

## 7. Safe areas

`CustomTabBar` utilise `useSafeAreaInsets()` + `Platform.OS === 'ios' ? insets.bottom : 8` pour le padding bas — déjà correct. `TabNavigator` calcule `tabBarHeight = 65 + (iOS ? insets.bottom : 0)`. Aucun bug de safe area démontré par lecture de code.

## 8. Écrans Light/Dark problématiques (confirmés par lecture directe, pas supposés)

| Écran/fichier | Bug confirmé | Preuve |
|---|---|---|
| `components/Chip.jsx` | Déjà corrigé en UI-MOB-1 | Revérifié : theme-aware ✅ |
| `navigation/TabNavigator.jsx` | `cardStyle` figé sur `colors.bg` (clair) | Lecture directe, §5 |
| `navigation/CustomTabBar.jsx` | Icône FAB `#FFFFFF` fixe au lieu de `c.onAccent` | Lecture directe, §5 |
| `screens/MesBiens/MesAnnoncesScreen.jsx` | Texte/icône `#0A0A0A` (quasi-noir) sur fond `c.goldMuted` — en dark mode `colorsDark.goldMuted = '#2D2208'` (brun quasi-noir) → **texte quasi invisible sur fond quasi noir** | Lecture directe des tokens, bug réel confirmé (pas juste théorique) |
| `screens/MesBiens/MesAnnoncesScreen.jsx` | `toneBg`/`toneBorder` (badge de modération) en rgba fixes, non alignés sur les tokens `success`/`error`/`warning` réels du thème actif | Lecture directe |
| `screens/Hotels/HotelOperationsScreen.jsx` | `c.danger \|\| '#B91C1C'` — le token s'appelle `error`, pas `danger` (`c.danger` est `undefined` dans les deux thèmes) → le fallback hardcodé est **toujours** actif, ignorant silencieusement le thème sur ce texte de blocage financier | Lecture directe des tokens `colors.js`/`colorsDark.js` : aucune clé `danger` n'existe |
| `screens/Notifications/NotificationsScreen.jsx` | `headerBadgeText`/`filterBadgeText` en `#0A0A0A` fixe au lieu de `c.onAccent` (valeur identique dans les deux thèmes actuels, donc pas un bug visuel actif, mais une dette de cohérence) | Lecture directe |

## 9. Accessibilité

Revérifiée sur les composants modifiés en UI-MOB-1 (`Button`/`Chip`/`Input`/`Card`) — toujours conformes. `CustomTabBar` expose déjà `accessibilityRole`/`accessibilityLabel`/`accessibilityState` par tab. Aucun audit exhaustif supplémentaire réalisé sur l'ensemble des icônes seules de l'app (hors périmètre raisonnable, cf. UI-MOB-1 §13) — reste une dette documentée.

## 10. Priorités (P0/P1/P2/P3)

| # | Constat | Priorité |
|---|---|---|
| 1 | Texte `#0A0A0A` sur `c.goldMuted` dans `MesAnnoncesScreen.jsx` — quasi invisible en dark mode | **P0** |
| 2 | `c.danger` (inexistant) dans `HotelOperationsScreen.jsx` — fallback hardcodé toujours actif, thème silencieusement ignoré | **P1** |
| 3 | `TabNavigator.jsx` `AnnoncesStack.cardStyle` figé clair — transitions d'écran incohérentes en dark mode | **P1** |
| 4 | FAB `CustomTabBar` icône blanche fixe au lieu de `c.onAccent` | **P2** |
| 5 | `toneBg`/`toneBorder` badges de modération non alignés sur les tokens sémantiques réels | **P2** |
| 6 | Badges numériques Notifications (`#0A0A0A` au lieu de `c.onAccent`) | **P2 (cosmétique, valeur déjà identique)** |
| 7 | 562 couleurs restantes après ce sprint (voir REPORT), majoritairement catégories A-légitimes (palettes d'accent par type, déjà cohérentes dans les deux thèmes) ou B/D (branding, illustrations) | **P2/P3, backlog documenté** |
| 8 | Badges "type de bien" (Vente/Location/Hébergement) dupliquant les valeurs hex de `c.gold`/`c.blue` au lieu des tokens, répliqué à l'identique sur 6 écrans (`MesAnnonces`, `ListeAnnonces`, `DetailAnnonce`, `CarteScreen`, `FavorisScreen`, `RecommendedCarousel`) | **P2, non traité ce sprint** (migrer un seul écran aurait cassé la cohérence inter-écrans ; nécessite une migration groupée dédiée) |

## 11. Stratégie de migration

Ne pas faire de remplacement massif (mandat §5). Pour chaque fichier à forte concentration, lire le code réel avant de juger : plusieurs « couleurs hardcodées » recensées par le grep sont en réalité des **palettes d'accent sémantiques déjà cohérentes** (ex. `NotificationsScreen.TYPE_CONFIG`, 24 couleurs distinctes par type de notification, fonctionnant correctement dans les deux thèmes car utilisées en accent sur fond teinté à faible opacité, pas en texte plein sur fond de page) ou des **bandeaux de marque volontairement sombres en permanence** (Profil, MesAnnonces, EditProfile, ChangePassword — pattern déjà validé en UI-MOB-1, cohérent avec le splash `AppNavigator.jsx`). Seules les divergences **démontrées** entre la valeur hardcodée et le comportement attendu du thème actif sont corrigées ce sprint. Le reste est classifié et documenté comme dette explicite, pas silencieusement ignoré.
