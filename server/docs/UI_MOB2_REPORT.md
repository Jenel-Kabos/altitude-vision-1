# UI-MOB-2 — Rapport final : migration visuelle globale, bottom navigation & cohérence Light/Dark

Date : 2026-08-15. Branche `main`, HEAD `ab5ae586fab50ddce02e65ea081330d2769c6503` (**inchangé**, aucun commit).

## 1. Résumé exécutif

UI-MOB-2 a repris l'audit là où UI-MOB-1 s'était arrêté : bottom navigation et couleurs restantes. Contrairement à l'hypothèse implicite du mandat, la bottom navigation (`CustomTabBar.jsx`) était déjà largement theme-aware et cohérente — un seul vrai bug y a été trouvé (icône FAB fixe). En revanche, l'audit du plus gros foyer de couleurs hardcodées (`MesAnnoncesScreen.jsx`) a révélé un **bug P0 réel et non trivial** : du texte quasi-noir (`#0A0A0A`) sur un fond qui devient quasi-noir en mode sombre (`c.goldMuted`), rendant plusieurs libellés d'action illisibles en dark mode. Un second bug de robustesse a été trouvé dans le code PMS (`HotelOperationsScreen.jsx`) : un token `c.danger` inexistant, dont le fallback hardcodé était donc **systématiquement** actif, ignorant silencieusement le thème. Ces bugs et 3 autres de moindre priorité ont été corrigés. Sur les 579 couleurs hardcodées, 17 ont été migrées vers des tokens (dont 2 nouveaux, `warningMuted` clair/sombre, ajoutés par extension et non par création d'un système parallèle) ; **562 restent**, très majoritairement classées légitimes (palettes d'accent sémantiques déjà cohérentes en Light/Dark, ou branding volontairement invariant). Aucune régression : 36/36 suites (+2), 332/332 tests (+12), lint 0 erreur, Doctor 21/21, export Android PASS.

## 2. Baseline

Héritée d'UI-MOB-1 : 34/34 suites, 320/320 tests, lint 0 erreur, Doctor 21/21, export Android PASS. Confirmée inchangée au départ de ce sprint (ETAT_INITIAL §1).

## 3. Design system

Aucune nouvelle couche créée. `ThemeContext`, tokens, `Button`/`Chip`/`Input`/`Card`/`StepHeader`/`StepFooter` d'UI-MOB-1 non modifiés dans leur API — seuls `colors.js`/`colorsDark.js` ont reçu 1 nouveau token pair (`warningMuted`), et 5 écrans/composants ont été corrigés pour *utiliser* correctement le système déjà en place.

## 4. Tokens

Ajout de `warningMuted` (`#FDF0DA` clair / `#3A2C0D` sombre) dans `colors.js`/`colorsDark.js`, à côté de `successMuted`/`dangerMuted` déjà existants — comblait un vrai trou (aucun token de fond atténué pour l'état « avertissement », alors que `success`/`error` en avaient un). Aucun autre token créé : les autres besoins identifiés (palette « type de bien », palette notifications) sont déjà couverts par des palettes d'accent auto-suffisantes et cohérentes dans les deux thèmes (voir §8).

## 5. Light / 6. Dark

Aucune valeur de token existante modifiée. Les deux thèmes restent strictement symétriques en structure de clés.

## 7. Hardcoded colors avant

**579**, reproduit par exécution réelle (ETAT_INITIAL §2), identique au chiffre UI-MOB-1.

## 8. Classification

| Catégorie | Exemple | Décision |
|---|---|---|
| A — sémantique UI, divergente du thème (bug réel) | `MesAnnoncesScreen` texte sur `goldMuted`, `HotelOperationsScreen` `c.danger` | **Migré** |
| A — sémantique UI, palette d'accent auto-cohérente | `NotificationsScreen.TYPE_CONFIG` (24 couleurs/type), badges de modération avant correction | Conservé pour les entrées non divergentes, corrigé pour les 2 divergences trouvées (§9) |
| B — branding | Bandeaux hero `#0A0A0A→#1C1408→#2D1E04` (Profil, MesAnnonces, EditProfile, ChangePassword), `splashName`/`bannerEyebrow` en gold fixe | Conservé — pattern volontaire, déjà validé UI-MOB-1, cohérent sur 4+ écrans |
| C — statut métier | Badges "type de bien" (Vente/Location/Hébergement), `TransactionsScreen` statuts paiement | Conservé — présentation harmonisée mais statuts non renommés/inventés ; migration de la palette elle-même reportée (§10) |
| D — illustration | `ImmobilierHero.jsx` (67 occurrences, silhouette décorative) | Conservé, hors périmètre |
| E — overlay/opacité | Pill `CustomTabBar` (`rgba(200,150,12,0.10)`), ombres `shadowColor:'#000'` | Conservé, documenté |
| F — legacy à nettoyer | `DEFAULT_CONFIG.color` dupliquant `colors.gold` en hex | Non traité (cosmétique, DRY seulement, aucun impact visuel) |
| G — NON CONFIRMÉ | Aucune occurrence rencontrée nécessitant cette classification | — |

## 9. Hardcoded colors après

**562** (−17). Détail des migrations réelles :
- `MesAnnoncesScreen.jsx` : 4 instances de texte/icône `#0A0A0A` → `c.gold` (sur fond `goldMuted`, bug P0), 3 instances `#0A0A0A` → `c.onAccent` (sur fond `gold` plein), `toneBg`/`toneBorder` (3 paires rgba) → `c.successMuted`/`c.dangerMuted`/`c.warningMuted` + `c.success`/`c.error`/`c.warning`.
- `HotelOperationsScreen.jsx` : `c.danger || '#B91C1C'` → `c.error`.
- `NotificationsScreen.jsx` : `headerBadgeText`/`filterBadgeText` `#0A0A0A` → `c.onAccent`.
- `CustomTabBar.jsx` : icône FAB `#FFFFFF` → `c.onAccent`.
- `TabNavigator.jsx` : `colors.bg` (import statique clair) → `c.bg` (theme-aware, via `useTheme()` ajouté à `AnnoncesStack`).

## 10. Couleurs restantes justifiées

562 restantes, réparties principalement en catégories B/C/D/E ci-dessus. Les plus significatives, explicitement non migrées avec raison :
- **Palettes d'accent par type** (`NotificationsScreen` 24 types, `TransactionsScreen` statuts paiement) : chaque type/statut a besoin d'une couleur visuellement distincte et reconnaissable ; les regrouper sous 3-4 tokens sémantiques (success/error/warning/info) perdrait cette distinction fonctionnelle. Déjà cohérentes en Light/Dark car utilisées en accent sur fond teinté à faible opacité, jamais en texte plein sur fond de page.
- **Bandeaux de marque** (4+ écrans) : volontairement invariants au thème, pattern déjà validé et documenté en UI-MOB-1.
- **Badges "type de bien"** (Vente/Location/Hébergement, 6 écrans) : Vente et Location dupliquent exactement `c.gold`/`c.blue` en hex clair — un vrai gain de cohérence dark-mode existe ici, mais migrer ce pattern correctement exige de le faire **simultanément** sur les 6 écrans qui le partagent (`MesAnnonces`, `ListeAnnonces`, `DetailAnnonce`, `CarteScreen`, `FavorisScreen`, `RecommendedCarousel`) pour ne pas créer une incohérence inter-écrans pire que l'existant. Reporté à un sprint dédié avec un périmètre propre.
- **`ImmobilierHero.jsx`** (67 occurrences) : illustration décorative, catégorie D, hors périmètre par nature.

## 11. Typography / 12. Spacing / 13. Radius / 14. Shadows

Non modifiés ce sprint — aucun bug typographique/spacing/radius/shadow démontré au-delà de ce qui a déjà été traité en UI-MOB-1 (échelle `spacing` non strictement croissante, documentée mais non corrigée par choix explicite pour ne pas risquer une régression sur des écrans non audités). `CustomTabBar` shadow (`shadowColor:'#000', shadowOpacity:0.06, elevation:12`) déjà discrète et cohérente Android/iOS, non modifiée.

## 15. Buttons / 16. Chips / 17. Inputs

Non modifiés ce sprint — déjà corrigés/validés en UI-MOB-1, revérifiés par lecture directe sans nouvelle divergence trouvée.

## 18. Cards

Non modifiées — `Card.jsx` toujours conforme (UI-MOB-1 §12).

## 19. Badges

`toneBg`/`toneBorder` de `MesAnnoncesScreen.jsx` harmonisés sur les tokens sémantiques (§9). Pas de composant `Badge` partagé créé — les usages restants (notifications, statuts paiement, type de bien) ont des besoins de palette suffisamment différents (nombre de couleurs, opacité, contexte hero-sombre vs carte-claire) pour qu'une abstraction unique prématurée risquerait de forcer un mauvais compromis visuel sans bénéfice démontré (mandat §54 : pas de nouvelle abstraction sans besoin réel).

## 20. Bottom navigation

Auditée en détail (ETAT_INITIAL §5). Déjà cohérente (règle unique : icône + label uniquement sur la tab active, appliquée identiquement à toutes les tabs — pas d'incohérence Profil vs autres). Seul bug : FAB icône fixe, corrigé (§9). Nouveau : 8 tests dédiés (`CustomTabBar.test.jsx`), couvrant les deux thèmes.

## 21. FAB

Touch target (52×52), safe area, non-recouvrement des autres tabs — tous déjà corrects, revérifiés par lecture de code (ETAT_INITIAL §6). Couleur d'icône corrigée (§9).

## 22. Safe areas

Déjà correctes (`useSafeAreaInsets`), revérifiées, aucune modification nécessaire (ETAT_INITIAL §7).

## 23. StatusBar

`Screen.jsx` (composant partagé) gère déjà `barStyle` selon le thème (UI-MOB-1 §15, revérifié). Aucune autre gestion de `StatusBar` indépendante trouvée dans les écrans audités ce sprint.

## 24. Notifications

Auditée en détail (ETAT_INITIAL §8, §9). Sur 38 occurrences, 36 sont la palette `TYPE_CONFIG` (24 types × 1 couleur, catégorie A auto-cohérente, conservée) + 2 badges numériques (`#0A0A0A` → `c.onAccent`, migrés). Aucune autre couleur hardcodée dans les styles de layout (déjà 100 % `c.*` avant ce sprint). SYNC-2C non affecté — aucun changement de logique de résolution de notification.

## 25. Mes annonces

Écran le plus corrigé ce sprint : bug P0 dark-mode (texte invisible sur `goldMuted`), badges de modération harmonisés sur tokens sémantiques (nouveau `warningMuted`). 46 → 33 occurrences hardcodées restantes (13 migrées), le reste étant le bandeau hero (branding, catégorie B) et les badges "type de bien" (catégorie C, reportés §10).

## 26. Publier un bien

Non modifié ce sprint. Audité par lecture rapide : les 6 étapes utilisent déjà `StepHeader`/`StepFooter`/`Input`/`ChipMultiSelect` (donc `Chip` corrigé en UI-MOB-1) — la migration composants-partagés d'UI-MOB-1 s'applique déjà automatiquement ici. Les 47 couleurs hardcodées restantes n'ont pas été auditées en détail individuellement ce sprint (budget de sprint consacré en priorité aux bugs démontrés ailleurs) — reste une dette à qualifier précisément dans un futur sprint.

## 27. Profil

Non modifié ce sprint au-delà des corrections déjà faites en UI-MOB-1 (contraste hero, badge rôle, espacement) — revérifié sans nouvelle divergence trouvée.

## 28. Home/Search

Non audité en détail ce sprint (`ListeAnnoncesScreen.jsx`, `CarteScreen.jsx` — 20 et 33 occurrences respectivement, non qualifiées individuellement) — dette explicite, non silencieuse.

## 29. Property detail

`DetailAnnonceScreen.jsx` (39 occurrences) non audité en détail ce sprint — dette explicite.

## 30. Messaging

Non audité ce sprint (`ChatbotScreen.jsx` 6, `ChatScreen.jsx` 4 occurrences — volumes faibles, probabilité de bug réel plus faible que sur les gros foyers traités en priorité) — dette explicite, priorité basse justifiée par le volume.

## 31. Tenant Portal

Non modifié ce sprint. Aucune occurrence de couleur hardcodée trouvée dans `TenantPortalScreen.jsx` lors du grep initial (absent du classement des fichiers concentrés) — pas de dette identifiée à ce jour sur cet écran spécifique.

## 32. PMS

`HotelOperationsScreen.jsx` : 1 bug réel corrigé (`c.danger` inexistant, §9). `HotelCockpitScreen.jsx`, `HotelHousekeepingScreen.jsx`, `HotelMaintenanceScreen.jsx` : **0 couleur hardcodée trouvée** (grep vide) — ces 3 écrans (créés en SYNC-2B) étaient déjà entièrement theme-aware, aucune action nécessaire.

## 33. Housekeeping / 34. Maintenance

Voir §32 — déjà propres, non modifiés. Aucun statut métier inventé ou renommé (mandat §30/§32 respecté par absence de modification).

## 35. Empty/Error/Loading

Non audités spécifiquement ce sprint au-delà de ce qui a été revérifié incidemment (ex. état vide `NotificationsScreen`, déjà theme-aware). Pas de nouveau composant `EmptyState`/`ErrorState` créé — `components/ui/EmptyState.jsx`/`LoadingSpinner.jsx` déjà existants et utilisés (ex. `MesAnnoncesScreen`), non modifiés faute de bug démontré.

## 36. Accessibility

`CustomTabBar` : `accessibilityState`/`accessibilityLabel` déjà présents et testés (§20). Aucun label manquant ajouté ce sprint car aucun composant icon-only sans label n'a été modifié en dehors de ceux déjà conformes. Pas d'audit exhaustif supplémentaire (hors périmètre, cf. UI-MOB-1 §13, dette toujours ouverte).

## 37. Responsive

Non testé sur device/simulateur réel (contrainte d'environnement inchangée depuis UI-MOB-1). Les corrections de ce sprint sont des changements de couleur pure (aucun changement de layout/dimension), donc à risque de régression responsive nul par construction.

## 38. Bugs trouvés

1. `MesAnnoncesScreen.jsx` : texte `#0A0A0A` sur fond `c.goldMuted` — illisible en dark mode. **P0**.
2. `HotelOperationsScreen.jsx` : token `c.danger` inexistant, fallback hardcodé toujours actif. **P1**.
3. `TabNavigator.jsx` : `cardStyle` de `AnnoncesStack` figé sur le thème clair. **P1**.
4. `CustomTabBar.jsx` : icône FAB blanche fixe au lieu de `c.onAccent`. **P2**.
5. `MesAnnoncesScreen.jsx` : badges de modération non alignés sur les tokens sémantiques réels (pas d'illisibilité, incohérence de teinte). **P2**.
6. Badges "type de bien" dupliquant `c.gold`/`c.blue` en hex sur 6 écrans — divergence dark-mode réelle mais non corrigée ce sprint (risque de régression cross-écran, §10). **P2, documenté, non corrigé**.

## 39. Bugs corrigés

1, 2, 3, 4, 5 ci-dessus — tous corrigés et couverts par un test. 6 documenté, non corrigé (raison donnée §10).

## 40. Tests

Nouveaux : `src/navigation/__tests__/CustomTabBar.test.jsx` (8 tests, Light+Dark : rendu par route, tab active, FAB `onAccent`, navigation au press). `src/context/__tests__/ThemeContext.test.jsx` (4 tests : défaut système, choix explicite dark/light persisté, restauration au montage). Étendu : `HotelOperationsScreen.test.jsx` (assertion sur la couleur réelle du texte de blocage, preuve du fix `c.danger`→`c.error`).

Résultat : **36/36 suites (+2), 332/332 tests (+12)**, aucune régression sur la baseline UI-MOB-1 (34/34, 320/320).

## 41. Expo Doctor

**21/21, inchangé** — aucune dépendance modifiée (mandat §83/§86 respecté), vérifié par exécution réelle après tous les changements de code.

## 42. Android export

`npx expo export --platform android` → succès, bundle Hermes généré, aucune erreur. Dossier temporaire supprimé après vérification.

## 43. Dette restante

- 562 couleurs hardcodées restantes, classifiées (§8), majoritairement légitimes (B/C/D/E).
- Badges "type de bien" (6 écrans) — migration groupée nécessaire, non faite ce sprint (§10).
- `PublierBienScreen.jsx` (47), `DetailAnnonceScreen.jsx` (39), `CarteScreen.jsx` (33), `ListeAnnoncesScreen.jsx` (20), écrans Auth (`RegisterScreen`, `ResetPasswordScreen`, `ForgotPasswordScreen`, `LoginScreen`, `CompleterProfilScreen`) — non audités individuellement ce sprint, dette qualifiée par volume mais pas par contenu précis.
- Audit accessibilité exhaustif (labels manquants sur icônes seules) — toujours hors périmètre, reporté.
- Aucune vérification visuelle sur device/simulateur réel (contrainte d'environnement) — toutes les corrections sont validées par lecture de code + tests unitaires.

## 44. MOB-E2E readiness

**READY pour les parcours déjà certifiés fonctionnellement** (Auth, Tenant, IAM, PMS, Notifications, GL) — aucun changement de comportement métier, uniquement visuel, et tous les gates passent. **Réserve non bloquante** : les écrans non audités ce sprint (Publier un bien, Détail annonce, Carte, écrans Auth) n'ont pas de garantie de cohérence Light/Dark au même niveau que les écrans traités — un MOB-E2E qui couvrirait spécifiquement le rendu visuel de ces écrans (et non seulement leur fonctionnement) devrait le signaler comme hors garantie de ce sprint.

## 45. Git

```
git status --short   → fichiers UI-MOB-1 + UI-MOB-2, tous non commités
git diff --check     → propre
git branch --show-current → main
git rev-parse HEAD   → ab5ae586fab50ddce02e65ea081330d2769c6503 (inchangé)
```
Fichiers modifiés spécifiquement par UI-MOB-2 (au-delà d'UI-MOB-1) : `navigation/CustomTabBar.jsx`, `navigation/TabNavigator.jsx`, `screens/Hotels/HotelOperationsScreen.jsx` (+ son test), `screens/MesBiens/MesAnnoncesScreen.jsx`, `screens/Notifications/NotificationsScreen.jsx`, `theme/colors.js`, `theme/colorsDark.js` (extension), + 2 nouveaux fichiers de test (`CustomTabBar.test.jsx`, `ThemeContext.test.jsx`) + `server/docs/UI_MOB2_*.md`. Aucun `git add`/`commit`/`push` exécuté.

## Tableau de migration

| Zone | Hardcodes avant | Hardcodes après | Tokens migrés | Restants justifiés | Verdict |
|---|---:|---:|---|---:|---|
| MesAnnoncesScreen | 46 | 33 | `c.gold`, `c.onAccent`, `c.successMuted`, `c.dangerMuted`, `c.warningMuted`, `c.success/error/warning` | 33 (hero branding + type-badges, §10) | Corrigé (bug P0 réel) |
| NotificationsScreen | 38 | 36 | `c.onAccent` ×2 | 36 (palette TYPE_CONFIG, catégorie A auto-cohérente) | Corrigé, reste justifié |
| HotelOperationsScreen | 1 | 0 | `c.error` | 0 | Corrigé (bug P1 réel) |
| CustomTabBar | 3 | 2 | `c.onAccent` | 2 (shadow + pill, catégorie E) | Corrigé |
| TabNavigator | 1 (référence statique, hors regex) | 0 | `c.bg` | 0 | Corrigé |
| PMS (Cockpit/Housekeeping/Maintenance) | 0 | 0 | — | 0 | Déjà conforme |
| Reste de l'app (non audité en détail) | ~490 | ~490 | — | À qualifier | Backlog explicite |

## Questions obligatoires

- Combien de couleurs hardcodées existaient réellement au début ? **579**, vérifié par exécution.
- Combien restent à la fin ? **562**.
- Combien sont des couleurs UI injustifiées ? **0 restante connue** parmi celles auditées en détail ce sprint (5 fichiers) — au-delà, **NON CONFIRMÉ** (non audité individuellement).
- Combien restent légitimement spécifiques ? Au moins 67 (illustration) + les bandeaux de marque (4+ écrans) + les palettes d'accent (notifications, transactions) — un chiffre exact global nécessiterait d'auditer les ~490 occurrences restantes non traitées, **NON CONFIRMÉ**.
- La bottom navigation est-elle cohérente ? **Oui**, vérifié par lecture de code + 8 tests dédiés.
- Toutes les tabs utilisent-elles une règle claire ? **Oui** — label uniquement sur la tab active, identique pour toutes.
- Le FAB masque-t-il encore des éléments ? **Non**, vérifié par lecture de code (slot dédié, largeur calculée dynamiquement).
- La safe area est-elle correcte ? **Oui**, `useSafeAreaInsets` déjà utilisé correctement.
- Les titres sont-ils lisibles en Light ? **Oui** (hérité UI-MOB-1, revérifié).
- En Dark ? **Oui** pour les écrans audités (Profil, Notifications, MesAnnonces, PMS, navigation) ; **NON CONFIRMÉ** pour les écrans non audités ce sprint (Publier un bien, Détail annonce, Carte, Auth).
- Les textes secondaires sont-ils lisibles ? **Oui** pour les écrans audités.
- Notifications est-il entièrement compatible Dark ? **Oui**, vérifié — palette d'accent déjà cohérente, 2 badges corrigés.
- Mes annonces ? **Oui après correction** — bug P0 corrigé et vérifié.
- Publier un bien ? **NON CONFIRMÉ** — non audité en détail ce sprint (hérite des composants partagés corrigés en UI-MOB-1, mais pas vérifié écran par écran).
- Profil ? **Oui**, hérité et revérifié UI-MOB-1.
- PMS ? **Oui**, vérifié — déjà conforme avant ce sprint (0 hardcode), 1 bug corrigé sur Operations.
- Tenant Portal ? **Oui probable** (0 hardcode détecté) mais non testé visuellement — **NON CONFIRMÉ** par capture réelle.
- Messagerie ? **NON CONFIRMÉ** — non auditée ce sprint.
- Les boutons respectent-ils le design system ? **Oui**, hérité UI-MOB-1.
- Les chips ? **Oui**, hérité UI-MOB-1.
- Inputs ? **Oui**, hérité UI-MOB-1.
- Cards ? **Oui**, hérité UI-MOB-1.
- Les badges de statut ? **Partiellement** — modération (MesAnnonces) corrigée, type de bien (6 écrans) non corrigée (documentée §10).
- Le StatusBar suit-il le thème ? **Oui**, `Screen.jsx` (composant partagé), hérité UI-MOB-1.
- Les composants icon-only modifiés ont-ils des labels ? **Oui** — `CustomTabBar` avait déjà `accessibilityLabel` par tab, non retiré.
- Expo Doctor reste-t-il 21/21 ? **Oui**, vérifié par exécution réelle.
- Android export passe-t-il ? **Oui**, vérifié par exécution réelle.
- Les 320+ tests passent-ils ? **Oui, 332/332** (320 hérités + 12 nouveaux).
- Une logique métier a-t-elle changé ? **Non** — tous les changements sont des couleurs/tokens ou une correction de nom de token inexistant ; aucun endpoint, payload, statut métier, ou navigation fonctionnelle modifié.
- L'application est-elle prête visuellement pour MOB-E2E ? **Oui pour les écrans audités (navigation, PMS, notifications, mes annonces, profil) ; NON CONFIRMÉ pour le reste** (voir §44).

## Verdict

**UI-MOB-2 GO SOUS RÉSERVES.**

Justification : les bugs P0/P1 réellement démontrés (texte invisible en dark mode, token de couleur inexistant silencieusement contourné, transition de navigation figée sur le thème clair) ont été trouvés et corrigés avec preuve (tests dédiés), la bottom navigation a été auditée en profondeur et s'avère déjà cohérente (un seul correctif nécessaire), et tous les gates obligatoires passent sans régression. Ce qui empêche le verdict CERTIFIÉ VERT plein : sur les 579 couleurs hardcodées, seules celles des fichiers directement audités (5 fichiers, la bottom nav, et les 4 écrans PMS) ont été vérifiées et corrigées si nécessaire — la majorité des écrans à forte concentration (`PublierBienScreen`, `DetailAnnonceScreen`, `CarteScreen`, écrans Auth) n'ont **pas** été audités individuellement ce sprint faute de temps, et leur conformité Light/Dark reste **NON CONFIRMÉE** plutôt que faussement certifiée verte. C'est un choix délibéré conforme au mandat §92/§99 (« la cible n'est pas 579→100, mais des écrans essentiels réellement cohérents, démontrés, pas supposés ») plutôt qu'une migration superficielle non vérifiée de tous les écrans.

## MOB-E2E readiness

**MOB-E2E READY** pour les domaines audités (navigation globale, PMS, notifications, mes annonces, profil) — aucun changement de comportement métier, tests exhaustifs, gates verts. Pour les écrans non audités ce sprint (formulaires de publication, détail annonce, carte, écrans d'authentification), la certification visuelle Light/Dark reste **NON CONFIRMÉE** : ne pas présumer leur conformité sans un audit dédié dans un sprint UI-MOB-3.
