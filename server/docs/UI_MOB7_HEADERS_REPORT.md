# UI-MOB-7 — Uniformisation des headers / titres d'écrans

Date : 2026-08-19. Branche `main`, `HEAD 29044699d25df30d1fffbbadf11fefc9cd6f9cac` (inchangé). Device réel : Samsung Galaxy SM_S918B, navigation Android 3 boutons.

## 1. Résumé

Les trois écrans cités ("Mes réservations hôtel", "Mes transactions", "Mes dossiers") avaient chacun une implémentation de header entièrement différente : un composant partagé théoriquement destiné à ce rôle (`PageHeader.jsx`) existait déjà et était utilisé par 9 autres écrans, mais ces trois-là ne l'avaient jamais adopté. Les trois ont été migrés vers `PageHeader`. Un défaut caché a été découvert et corrigé au passage : l'un des trois (`RealEstateApplicationsScreen`) n'utilisait jamais `useTheme()` pour son corps de liste — invisible tant que son header était, lui aussi, figé en clair, mais devenu un défaut Dark flagrant (header sombre / corps clair) dès que le header a été corrigé.

## 2. Écrans audités

| Écran | Fichier réel |
|---|---|
| Mes réservations hôtel | `altimmo-app/src/screens/Hotels/MyHotelReservationsScreen.jsx` |
| Mes transactions | `altimmo-app/src/screens/Profil/TransactionsScreen.jsx` |
| Mes dossiers | `altimmo-app/src/screens/Profil/RealEstateApplicationsScreen.jsx` (route `RealEstateApplications`, libellé menu Profil : "Mes offres et candidatures") |

Tous trois déclarés dans `altimmo-app/src/navigation/stacks/ProfilStack.jsx`, qui a **`screenOptions={{ headerShown: false }}` globalement** — aucun header natif React Navigation nulle part sur cette stack. C'est la cause structurelle de fond : chaque écran devait recréer son propre header à la main, et rien n'imposait de convention commune.

## 3. Headers avant (matrice)

| Écran | Header component | Back | Right action | Padding X | Title size | SafeArea | Verdict |
|---|---|---:|---:|---:|---:|---:|---|
| Mes réservations hôtel | Aucun — `Screen` + `Text` inline dans le contenu scrollable | ❌ absent | ❌ | `spacing.md` (contenu, pas header) | `fontSize.xl` (**token inexistant → `undefined`**, taille par défaut RN) | `Screen` (tous bords) | FAIL |
| Mes transactions | Hand-rolled (`View` row + `Ionicons`) | ✅ `arrow-back`, 22px | ✅ `refresh-outline`, 20px | `spacing.md` + `paddingVertical:14` | `fontSize.lg` (22, valide) | `SafeAreaView edges={['top']}` | PARTIEL (propre mais dupliqué, pas partagé) |
| Mes dossiers | Hand-rolled (`View` row + `Text` `‹`) | ✅ glyphe `‹` brut, 36px, `colors.gold` figé | ❌ | `spacing.lg` (36, différent des deux autres) | `fontSize.xxl` (**token inexistant → `undefined`**) | `SafeAreaView` (tous bords, défaut) | FAIL |

Les tailles de titre "différentes" observées dans les captures ne sont pas un choix de design : deux des trois écrans référençaient des clés `fontSize.xl`/`fontSize.xxl` qui n'existent pas dans `theme/typography.js` (clés réelles : `xs, sm, md, lg, display`). React Native ne lève aucune erreur pour un `fontSize: undefined` — il retombe silencieusement sur la taille système par défaut, donc **visuellement plus petit et incohérent** avec le troisième écran qui utilisait, lui, une clé valide (`fontSize.lg`). Même classe de bug que celui documenté dans `UI_MOB2_REPORT.md` (`c.danger` inexistant).

## 4. Cause des décalages

1. **Aucune convention imposée** : `headerShown: false` sur toute la stack, et aucune revue n'a signalé que 3 écrans sur ~30 réinventaient leur header au lieu de réutiliser `PageHeader.jsx`, déjà adopté par 9 écrans.
2. **Tokens de taille de police invalides** (`fontSize.xl`, `fontSize.xxl`) utilisés sans jamais avoir été définis — silencieux, jamais détecté par les sprints précédents (aucun test de garde équivalent à `tokenIntegrity.test.js` pour `fontSize`, seulement pour les couleurs `c.xxx`).
3. **Bouton retour non uniforme** : glyphe Unicode `‹` en `Text` brut (taille/couleur arbitraires) vs `Ionicons` vs absence totale.
4. **Un écran sans back button du tout** alors qu'il s'agit d'un écran de pile secondaire (accessible uniquement via Profil → "Mes réservations hôtel"), pas d'un écran racine d'onglet.

## 5. Composant partagé existant

`altimmo-app/src/components/PageHeader.jsx` — trouvé avant toute décision de créer quoi que ce soit (mandat §4). Déjà consommé par 9 écrans (`ConversationsScreen`, `FavorisScreen`, `CompleterProfilScreen`, `TenantPortalScreen`, `VisitesScreen`, `PersonalDocumentDetailScreen`, `MyDocumentsScreen`, `AccommodationBookingScreen`, `MyAccommodationReservationsScreen`, `AccommodationReservationDetailScreen`). Aucun second système créé. Le composant n'a **pas été modifié** — son API (`title`, `subtitle`, `onBack`, `rightIcon`, `onRightPress`) couvrait déjà tous les besoins des 3 écrans cibles, y compris l'action droite de rafraîchissement pour "Mes transactions".

## 6. Pattern canonique

```
[←]         Titre                [action]
```

- Zone gauche et zone droite : **44dp chacune, toujours réservées**, que le bouton soit présent ou non — c'est ce qui garantit que le titre reste centré à l'identique sur les trois écrans, avec ou sans back, avec ou sans action droite (vérifié par test, §18).
- `onBack` optionnel : si absent, la zone gauche reste vide mais garde sa largeur (pas de `marginLeft` compensatoire arbitraire).
- `rightIcon`/`onRightPress` optionnels, symétriques à `onBack`.
- Titre centré, `numberOfLines={1}`, `fontFamily: fonts.display`, `fontSize: 22` fixe (ne dépend d'aucun token `fontSize.*`, élimine la classe de bug §3-4.2).
- `minHeight: 60`, `paddingHorizontal: spacing.md`, `borderBottomWidth: 1`.
- Couleurs 100 % `useTheme()` (`c.bgCard`, `c.border`, `c.text`, `c.textMuted`, `c.gold`).

## 7. Safe area

Les 3 écrans utilisent désormais `<SafeAreaView edges={['top']}>` (au lieu de l'ancien défaut tous-bords sur "Mes dossiers", ou de `Screen` tous-bords sur "Mes réservations hôtel") — cohérent avec les 9 consommateurs `PageHeader` existants et avec `TabNavigator.jsx` qui réserve déjà `insets.bottom` pour la tab bar (UI-MOB-5) : appliquer `edges: bottom` en plus aurait doublé la marge basse (mandat §8, "ne double-compense pas").

## 8. Back

Uniformisé sur les 3 écrans : `Ionicons name="chevron-back" size={20}` sur pastille 36×36 (`c.bgCardAlt`, bordure `c.border`), couleur `c.gold`, `hitSlop` 8dp sur chaque bord (cible tactile effective ≈ 52×52dp, > 44dp). Remplace le glyphe `‹` brut de "Mes dossiers" et ajoute un bouton retour qui n'existait pas du tout sur "Mes réservations hôtel" (écran de pile secondaire, classé STACK DETAIL SCREEN — un back y est attendu, mandat §11/§19).

## 9. Right action

Seul "Mes transactions" en a une (rafraîchissement) — conservée à l'identique fonctionnellement (`onRightPress={() => load(false)}`), migrée vers `rightIcon="refresh-outline"` du composant partagé. Les deux autres écrans n'en ont pas — `PageHeader` gère nativement ce cas sans rien casser (zone droite vide mais toujours 44dp).

## 10. Typography

`fonts.display` (Cormorant Garamond) pour le titre sur les 3 écrans, cohérent avec les 9 autres consommateurs de `PageHeader` — même famille, même niveau hiérarchique pour tout titre d'écran de pile secondaire. Aucun mélange serif/sans-serif arbitraire introduit.

## 11. Spacing

`paddingHorizontal: spacing.md` (20dp) et `minHeight: 60` uniformes sur les 3 écrans (au lieu de `spacing.lg`/`padding` uniforme sur "Mes dossiers", `spacing.md + paddingVertical:14` sur "Mes transactions", aucun header dédié sur "Mes réservations hôtel").

## 12. Light

**PASS**, vérifié sur device réel pour les 3 écrans après migration : back, titre, action droite (le cas échéant) tous alignés à l'identique, contrastés, cohérents entre eux.

## 13. Dark

**PASS**, vérifié sur device réel (thème "Sombre" activé manuellement) pour les 3 écrans : header correctement thémé sur les 3 (composant partagé, jamais figé). **Défaut découvert et corrigé** : le corps de "Mes dossiers" restait en clair (`colors.bg` figé au lieu de `useTheme()`) — écran mi-sombre/mi-clair après la migration du header seul. Corrigé en convertissant `RealEstateApplicationsScreen.jsx` à `useTheme()` pour tous ses styles (safe, card, textes, erreur) — changement strictement UI/thème, aucune logique métier touchée. Re-vérifié PASS sur device après correction.

## 14. Mes réservations hôtel

Migré de `Screen` (wrapper générique, titre inline sans header dédié, aucun back) vers `SafeAreaView edges={['top']} + PageHeader + ScrollView` — même schéma que l'écran jumeau `MyAccommodationReservationsScreen.jsx` ("Mes hébergements"), déjà conforme, pris comme référence directe. Bouton retour ajouté (absent avant, alors qu'il s'agit d'un écran de pile secondaire). Bouton "Réserver un hôtel" et logique de réservation/annulation strictement inchangés (aucun changement métier). Token `fontSize.xl` invalide supprimé avec la suppression du style de titre local (le titre vient maintenant de `PageHeader`, taille fixe 22).

## 15. Mes transactions

Pris comme candidat de référence (mandat §20) : son header hand-rolled était déjà le plus propre des trois (theme-aware, back + action droite). Simplement migré vers `PageHeader` pour éliminer la duplication de code et bénéficier de la garantie structurelle des zones 44dp symétriques. Styles `header`/`backBtn`/`refreshBtn`/`headerTitle` devenus inutiles, supprimés. Logique de chargement/rafraîchissement, filtres, cartes de transaction : strictement inchangés.

## 16. Mes dossiers

Migré vers `PageHeader` (glyphe `‹` et styles `header`/`back`/`title` obsolètes supprimés, token `fontSize.xxl` invalide éliminé). Bouton retour désormais cohérent avec les deux autres écrans. Padding gauche et taille de titre alignés sur le pattern canonique. **En plus** (défaut Dark révélé par la migration, §13) : le corps de l'écran (liste de dossiers, carte, erreur, état vide) est passé de `colors` figés à `useTheme()` — aucun changement de contenu (labels de statut, structure des cartes, logique de retrait de dossier strictement identiques).

## 17. Autres écrans identifiés

Recherche rapide (`navigation.goBack` sans `PageHeader`) : une vingtaine d'écrans supplémentaires ont un back button géré à la main sans passer par `PageHeader` (ex. `ChatScreen`, `EditProfileScreen`, `ChangePasswordScreen`, `NotificationsScreen`, `DetailAnnonceScreen`, `MesAnnoncesScreen`, les écrans `Publication/*`…). Une partie de ces écrans utilise légitimement un autre pattern dédié (`StepHeader` pour les wizards de publication, hors périmètre de ce sprint). Conformément au mandat (§13-14 : ne pas migrer 30 écrans sans nécessité prouvée), **aucun de ces écrans n'a été touché** — ils sont classés **À MIGRER (sprint futur)** si un défaut visuel y est démontré, ou pour une passe de cohérence dédiée. Non audités individuellement dans ce sprint : **NON TESTÉ**.

## 18. Tests

`altimmo-app/src/components/__tests__/PageHeader.test.jsx` (nouveau, 10 tests, thèmes clair + sombre) — cible le mécanisme réel du pattern canonique, pas une simple présence de texte :
- sans `onBack` : bouton absent, mais les zones gauche/droite réservent toujours 44dp chacune (garantit le centrage identique du titre, cause structurelle des décalages avant ce sprint) ;
- avec `onBack` : bouton affiché, cible tactile 36dp + hitSlop 8dp ;
- `rightIcon` optionnel : absent par défaut, affiché si fourni ;
- titre long : `numberOfLines={1}`, jamais de wrap ;
- couleur du titre suit `c.text` du thème actif (clair et sombre), jamais figée.

`altimmo-app/src/screens/Profil/__tests__/ProfilScreenHero.test.jsx` (UI-MOB-6) et les suites existantes non modifiées.

## 19. Device evidence

Captures réelles conservées dans le répertoire de travail de session : headers Light des 3 écrans (`tx.png`, `hotel2.png`, `dossiers.png`) — alignement identique confirmé visuellement ; headers + corps Dark des 3 écrans (`dark_hotel.png`, `is_dark.png`/`dark_dossiers.png`, `dark_dossiers5.png` avant/après correction du corps de "Mes dossiers"). Aucune image générée artificiellement.

## 20. Gates

- `npm run check:syntax` → 188 fichiers, 0 erreur.
- `npm run lint` → **0 erreur**, 105 avertissements (identique à la baseline UI-MOB-6).
- `npm run typecheck` → 0 erreur.
- `npm run test:coverage` → **44/44 suites, 379/379 tests** (baseline UI-MOB-6 : 43/369 ; +1 suite, +10 tests, aucune régression).
- `npx expo-doctor` → 20/21 checks, identique à la baseline (8 patchs mineurs pré-existants).
- `npm run export -- --platform android` → succès (bundle `.hbc` 6.7MB).
- `git diff --check` → exit 0.

## 21. Fichiers modifiés

- `altimmo-app/src/screens/Hotels/MyHotelReservationsScreen.jsx` — migration `Screen` → `SafeAreaView + PageHeader + ScrollView`, ajout back button, suppression token `fontSize.xl` invalide.
- `altimmo-app/src/screens/Profil/TransactionsScreen.jsx` — header hand-rolled → `PageHeader` (back + refresh), suppression des styles devenus inutiles.
- `altimmo-app/src/screens/Profil/RealEstateApplicationsScreen.jsx` — header hand-rolled (`‹` + `fontSize.xxl` invalide) → `PageHeader` ; corps de l'écran converti de `colors` figés à `useTheme()` (défaut Dark révélé par la migration).
- `altimmo-app/src/components/__tests__/PageHeader.test.jsx` — nouveau, 10 tests.

Aucun composant partagé modifié (`PageHeader.jsx` intact — son API existante suffisait). Aucun fichier backend touché. Aucun changement métier (Auth/API/Tenant/IAM/logique transactions/réservations/dossiers/Mongo/Payments).

## 22. Dette restante

1. Une vingtaine d'écrans supplémentaires avec header ad hoc, non audités (§17) — candidats pour un futur sprint de cohérence, ou à traiter au cas par cas si un défaut est démontré.
2. Aucun test de garde équivalent à `tokenIntegrity.test.js` pour les clés `fontSize.*`/`spacing.*` (seules les couleurs `c.xxx` sont couvertes) — la classe de bug `fontSize.xl`/`fontSize.xxl` inexistants pourrait resurgir ailleurs sans être détectée automatiquement. Non traité ce sprint (hors périmètre strict "headers"), mais signalé comme piste sérieuse pour un futur test de garde générique.
3. `RealEstateApplicationsScreen.jsx` reste un fichier très compact (une ligne par bloc JSX) — non reformaté dans ce sprint (diff minimal), ce qui le rend plus coûteux à relire/modifier que les autres écrans du même dossier.

## 23. Verdict

**UI-MOB-7 : CERTIFIÉ VERT.**

Justification (critères mandat §26) :
- Les 3 écrans montrés ont des headers cohérents : ✅ (composant partagé unique, `PageHeader`).
- Alignement horizontal uniforme : ✅ (zones 44dp symétriques, garanties par test).
- Spacing vertical cohérent : ✅ (`minHeight: 60`, `paddingHorizontal: spacing.md` uniformes).
- SafeArea correcte : ✅ (`edges={['top']}` uniforme, pas de double-compensation avec la tab bar).
- Back button cohérent : ✅ (`chevron-back` Ionicons, même taille/couleur/touch target sur les 3).
- Action droite cohérente : ✅ (présente et fonctionnelle sur "Mes transactions", absente proprement ailleurs, même composant).
- Light PASS : ✅. Dark PASS : ✅ (y compris le défaut de corps non thémé découvert et corrigé sur "Mes dossiers").
- Device réel vérifié : ✅ (Samsung SM_S918B, les 3 écrans, Light et Dark).
- Tests/gates verts : ✅.

La cause architecturale (headers ad hoc au lieu du composant partagé déjà existant, plus deux tokens de taille de police inexistants) est corrigée à la source pour les 3 écrans démontrés, sans modification du composant partagé lui-même ni du contenu métier.
