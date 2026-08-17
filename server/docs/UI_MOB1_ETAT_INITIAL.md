# UI-MOB-1 — État initial : audit UI/UX mobile, dark mode & design system

Date : 2026-08-15. Branche `main`, HEAD `ab5ae586fab50ddce02e65ea081330d2769c6503` (état commité hérité, non touché par ce sprint avant modification). `git status --short` propre, `git diff --check` propre.

## 1. Architecture styles actuelle

Le projet dispose déjà d'une vraie architecture de theming, à étendre — pas à recréer :

- `src/context/ThemeContext.jsx` : `ThemeProvider`/`useTheme()`, préférence `system`/`light`/`dark` persistée (`AsyncStorage`, clé `theme_preference`), résout `isDark` via `useColorScheme()` + préférence utilisateur. **Les trois modes demandés par le mandat §8 sont déjà supportés.**
- `src/theme/colors.js` / `src/theme/colorsDark.js` : deux objets de tokens plats (gold, blue, bg, bgCard, bgCardAlt, text, textSub, textMuted, placeholder, border, borderGold, inputBorder, focusRing, success, error, warning, info, overlay, goldMuted, blueMuted, shadow, dangerMuted, successMuted…). Système déjà cohérent, juste incomplet face au vocabulaire du mandat §6.
- `src/theme/typography.js` : `fonts` (CormorantGaramond = `display*`, DM Sans = `body*`), `fontSize` (xs 11 / sm 13 / md 16 / lg 22 / display 32), `typography` (styles de compatibilité h1/h2/h3/body/caption/tiny).
- `src/theme/spacing.js` : échelle `xs 6 / sm 12 / md 20 / lg 36 / xl 24 / xxl 48`. **Anomalie relevée** : `xl (24) < lg (36)`, l'échelle n'est pas strictement croissante — non corrigé ce sprint (risque de casser des écrans qui dépendent déjà de ces valeurs précises), documenté comme dette P3.
- `src/theme/radius.js` : `none/xs/sm/md/lg` cohérent.
- `src/components/index.js` : `Screen`, `Card`, `Button`, `Chip`, `Input`, `Checkbox`, `FormSwitch`, `PageHeader`, etc. déjà centralisés et exportés — pas de duplication de composants concurrents à corriger, seulement des lacunes de theming à l'intérieur.
- `src/components/publication/` : `StepHeader`, `StepFooter`, `ChipMultiSelect`, `SelectableCard`, `Counter`, `PhotoManager`, `SummaryRow` — déjà le composant multi-étapes demandé par le mandat §12, pas à recréer.

**Conclusion architecture** : contrairement à l'hypothèse implicite du mandat (« créer un design system »), celui-ci existe déjà et est globalement bien conçu. Le travail réel est un **audit ciblé des points où des écrans/composants n'utilisent pas ce système déjà en place**, pas une reconstruction.

## 2. Bug dark mode confirmé — cause exacte

`src/components/Chip.jsx` (avant modification) importait le token statique `colors` (le thème **clair** uniquement) au lieu d'appeler `useTheme()`. Résultat : quel que soit le thème actif de l'appareil/préférence utilisateur, tous les chips (type de bien, ville, arrondissement, commodités, profils locataires, documents requis — utilisés dans les 4 écrans de publication via `ChipMultiSelect`) restaient rendus avec les couleurs du thème clair. En mode sombre :
- chip inactif : bordure claire (`colors.border = #F0F0EE`) sur fond d'écran sombre → contraste incohérent, chip visuellement « cassé » ;
- chip actif : fond crème clair (`colors.goldMuted = #FCEFD6`) sur fond sombre → bloc lumineux incohérent avec le reste de l'écran, pas « invisible » à proprement parler mais visuellement incorrect et jamais testé.

C'est la cause directe du symptôme « chips trop pâles / sélection peu visible » — confirmé par lecture de code, pas supposé. `ChipMultiSelect.jsx` (le composant qui consomme `Chip`) était, lui, déjà correctement `useTheme()`-aware — la fuite venait uniquement de `Chip.jsx`.

## 3. Contraste faible confirmé — deux occurrences réelles

Recherche de tout usage de `rgba(...)` à faible opacité sur texte :

- `src/navigation/AppNavigator.jsx` (écran splash, avant l'auth) : `splashSub` (« par Altitude Vision ») en `rgba(240,237,232,0.35)` sur fond `#0A0A0A` — opacité 35 % : contraste très faible, quasiment illisible. Correspond exactement à « le nom sous le logo manque de contraste » (mandat §25).
- `src/screens/Profil/ProfilScreen.jsx` : `heroEmail` en `rgba(240,237,232,0.5)` — opacité 50 %, lisible mais faible, correspond à « email presque invisible » (mandat §25).

Ces deux écrans utilisent un fond hero **volontairement sombre en permanence** (gradient `#0A0A0A → #1C1408 → #2D1E04`), indépendant du thème clair/sombre choisi par l'utilisateur — c'est un choix de branding assumé (bandeau de marque), pas un bug en soi. Le bug réel est la **faible opacité du texte secondaire à l'intérieur de ce bandeau**, pas le bandeau lui-même.

## 4. Bouton "Précédent" — cause exacte

`src/components/publication/StepFooter.jsx` : ratio `flex: 1` (Précédent) / `flex: 2` (Continuer), soit 33 %/67 %. `src/components/Button.jsx` : le `<Text>` du label n'avait **aucun** `numberOfLines` — sur les écrans étroits, avec `paddingHorizontal: spacing.md` (20px) de chaque côté du bouton "Précédent" à 33 % de largeur, le texte "Précédent" (9 caractères, `fontSize.md=16`, `bodyBold`) peut dépasser la largeur disponible et retourner à la ligne. Confirmé par lecture directe du composant, pas supposé.

## 5. Boutons — inventaire des variantes existantes

`Button.jsx` supporte déjà `primary/outline/ghost/secondary/danger/success`, avec états `disabled`/`loading` gérés (`accessibilityState`), `minHeight: 44` (sera porté à 48 pour respecter strictement le mandat §14). Pas de duplication de styles de bouton trouvée ailleurs dans le code (`PhotoManager`, écrans PMS, etc. utilisent tous `Button`) — bonne nouvelle, pas de migration de composant à faire, seulement des correctifs internes.

## 6. Titres — inventaire

`PageHeader.jsx` (titres d'écran, `fonts.display`, 22px) et `StepHeader.jsx` (titres d'étape formulaire, `fonts.displaySemi`, 22px) utilisent tous deux la police serif `display` de façon cohérente entre eux. `ProfilScreen.jsx` utilise `sectionTitle` (`fonts.bodyBold`, 11px, uppercase, `textMuted`) pour les en-têtes de section (« Mes biens », « Activité »…) — cohérent avec le mandat §27 (`SectionHeader` conceptuel), déjà en place, pas dupliqué ailleurs avec des valeurs différentes constatées dans les fichiers audités.

## 7. Inputs

`Input.jsx` gère déjà label/placeholder/focus/error/disabled/multiline/readOnly, theme-aware (`useTheme()`), focus visible via `borderColor: c.focusRing` (pas seulement une ombre — conforme mandat §21). Aucun bug trouvé ici — composant déjà conforme au design system cible.

## 8. Chips — type de bien

`PROPERTY_TYPES` (`src/constants/propertyTypes.js`) contient bien "Appartement meublé" parmi les 9 valeurs. `ChipMultiSelect` utilise `flexWrap: 'wrap'`, donc les libellés longs ne sont pas coupés (retour à la ligne du chip suivant, pas troncature du texte) — pas de bug de troncature trouvé, seulement le bug de contraste dark-mode (§2).

## 9. Cards / listes

`Card.jsx` déjà theme-aware, ombre légère et conditionnelle par plateforme (`Platform.select`), variantes `gold/selected/disabled/error`. `ProfilScreen.jsx` a son propre système de `menuGroup`/`menuRow`/`menuSep` (non extrait en composant `Card`/`ListItem` réutilisable) — fonctionnellement correct et theme-aware, mais dupliqué en pattern (pas en style) par rapport à `Card.jsx`. Non refactorisé ce sprint (risque de régression visuelle sur un écran très fréquenté sans gain fonctionnel démontré) — documenté comme dette P3 pour UI-MOB-2.

## 10. Profil — hiérarchie et badge

Le badge de rôle (`roleBadge`) avait `paddingVertical: 4`, texte `fontSize.xs` (11px) sur fond `roleColor` plein — visuellement correct mais légèrement disproportionné par rapport au nom/email juste au-dessus qui souffrent, eux, d'un contraste trop faible (§3) : c'est ce déséquilibre relatif (badge net et coloré vs. texte principal fade) qui donne l'impression que « le badge domine trop ». Espace vide : `hero.paddingBottom: spacing.xxl` (48px) + `sectionTitle.marginTop: spacing.lg` (36px) pour la première section = 84px d'espace cumulé avant le premier contenu utile.

## 11. Formulaire — sérif

`StepHeader.title` utilise `fonts.displaySemi` (Cormorant Garamond), cohérent avec `PageHeader.title` (`fonts.display`) utilisé sur tous les écrans à en-tête classique de l'app. **Usage volontaire et cohérent**, pas un choix isolé au formulaire — formalisé tel quel (mandat §11 : « si déjà volontaire et utilisée ailleurs, formaliser son usage »), aucune harmonisation nécessaire.

## 12. Bottom navigation

Non auditée en profondeur dans le temps imparti à ce sprint (mandat §32-37) au-delà d'une recherche de « bouton flottant gris avec roue dentée » (§37, résultat en §14 ci-dessous). Documenté comme dette P2 explicite pour UI-MOB-2 : nécessite un audit dédié de `TabNavigator`/`AppNavigator` avec captures d'écran réelles, hors périmètre raisonnable de ce sprint qui priorise les bugs P0/P1 déjà démontrés par les captures fournies.

## 13. Accessibilité

`Button`, `Chip`, `Input`, `Card`, `SelectableCard` exposent déjà `accessibilityRole`/`accessibilityLabel`/`accessibilityState` de façon cohérente. Touch targets : `Button` avait `minHeight: 44` (limite basse recommandée iOS, portée à 48 ce sprint). Pas d'audit exhaustif de `accessibilityLabel` manquants sur icônes seules à travers tout le code (579 occurrences de couleurs en dur recensées §15, un audit accessibilité exhaustif équivalent serait un sprint à part entière) — documenté comme dette pour UI-MOB-2.

## 14. Bouton flottant gris / roue dentée (mandat §37)

Recherche exhaustive (`cog`, `gear`, `settings-outline`, `__DEV__`, `DevMenu`, `floating`) dans tout `src/` : **aucun composant produit ne correspond**. Les seules occurrences de `__DEV__` trouvées sont des garde-fous de logs (`ErrorBoundary.jsx`, `socketService.js`), pas des boutons flottants. Conclusion : l'élément observé sur les captures est très probablement l'overlay natif du **menu développeur Expo Dev Client** (visible uniquement en build de développement/interne, absent des builds de production release) — pas du code produit. Non modifié, aucune action nécessaire (mandat : « ne pas supprimer avant identification » — identifié comme outil de dev, pas de suppression à faire puisqu'il n'existe pas dans le code applicatif).

## 15. Couleurs en dur — ampleur réelle

`grep` de `color:`/`backgroundColor:`/`borderColor:` avec valeur hex/rgba en dur, hors `src/theme/` : **579 occurrences** à travers l'app, concentrées principalement dans (par nombre décroissant) : `NotificationsScreen.jsx` (38), `MesAnnoncesScreen.jsx` (35), `PublierBienScreen.jsx` (29), `DetailAnnonceScreen.jsx` (23), `CarteScreen.jsx` (23), `TransactionsScreen.jsx` (16), `RegisterScreen.jsx` (16), `ResetPasswordScreen.jsx` (15), `ListeAnnoncesScreen.jsx` (15), `EditProfileScreen.jsx` (13), etc.

**Ampleur hors périmètre raisonnable d'un seul sprint** : migrer ces 579 occurrences vers les tokens équivaudrait à une réécriture quasi complète des styles de l'app, avec un risque de régression visuelle élevé sur des écrans jamais captés par les deux exemples du mandat. Ce sprint traite les bugs **démontrés** (P0 chips, P1 bouton/contraste) et étend le système de tokens (§16) ; le reste est documenté comme backlog explicite pour UI-MOB-2 (voir REPORT §22).

## 16. Priorités (P0/P1/P2/P3)

| # | Constat | Preuve | Priorité |
|---|---|---|---|
| 1 | `Chip.jsx` ignore le thème actif (toujours clair) | Lecture directe, `import { colors }` au lieu de `useTheme()` | **P0** |
| 2 | Bouton "Précédent" peut se couper sur plusieurs lignes | `Button.jsx` sans `numberOfLines`, `StepFooter.jsx` ratio 33/67 trop étroit | **P1** |
| 3 | Sous-titre splash quasi invisible (opacité 0.35) | `AppNavigator.jsx` | **P1** |
| 4 | Email profil à contraste faible (opacité 0.5) | `ProfilScreen.jsx` | **P2** |
| 5 | Espace vide excessif avant la 1ère section profil (84px cumulés) | `ProfilScreen.jsx` | **P2** |
| 6 | Badge rôle visuellement dominant par contraste relatif | `ProfilScreen.jsx` | **P2** |
| 7 | Chips « normal » à bordure/texte trop pâles même en clair | `Chip.jsx` (`textMuted` sur libellé inactif, bordure `border` très claire) | **P2** |
| 8 | Échelle `spacing` non strictement croissante (`xl < lg`) | `theme/spacing.js` | **P3** |
| 9 | 579 couleurs en dur à travers l'app, non migrées | Grep exhaustif §15 | **P2/P3 selon écran, backlog UI-MOB-2** |
| 10 | Bottom navigation non auditée en détail | Hors périmètre temporel de ce sprint | **P2, backlog UI-MOB-2** |

## 17. Stratégie de migration retenue

Corriger les P0/P1 démontrés directement dans les composants partagés déjà en place (`Chip`, `Button`, `StepFooter`) plutôt que de patcher les écrans un par un — un seul correctif sur `Chip.jsx` corrige simultanément les 4 écrans de publication (Location/Vente/Hébergement/Hôtel) qui le consomment via `ChipMultiSelect`. Étendre `colors.js`/`colorsDark.js` par des **alias additifs** (mêmes valeurs, noms conceptuels du mandat §6 : `background`, `surface`, `surfaceElevated`, `textPrimary`, `textSecondary`, `textInverse`, `primary`, `primaryPressed`, `primarySoft`, `primaryForeground`, `borderStrong`, `inputBackground`, `divider`) sans renommer ni supprimer aucun token existant, pour ne rien casser sur les écrans non touchés ce sprint. Aucune logique métier, aucun endpoint, aucune navigation métier modifiés.
