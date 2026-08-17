# UI-MOB-3 — État initial : certification visuelle finale Light/Dark & écrans restants

Date : 2026-08-15. Branche `main`, HEAD `ab5ae586fab50ddce02e65ea081330d2769c6503` (identique à UI-MOB-1/2, non commité, `git diff --check` propre avant modification).

## 1. Baseline Git

`git status --short` : 18 lignes (14 modifiés + 4 nouveaux dossiers de test, tous hérités d'UI-MOB-1/UI-MOB-2, non commités). `git diff --stat` : 14 fichiers, 137 insertions / 52 suppressions (chiffres UI-MOB-1+2 cumulés). `git branch --show-current` → `main`. `git rev-parse HEAD` → `ab5ae586fab50ddce02e65ea081330d2769c6503`. Aucune modification perdue, rien réinitialisé.

## 2. Baseline tests

34/34 suites, 320/320 tests (UI-MOB-1) → 36/36 suites, 332/332 tests (UI-MOB-2, dernière mesure connue au départ de ce sprint). Lint 0 erreur, Doctor 21/21, export Android PASS.

## 3. Écrans déjà certifiés (à ne pas retoucher sans nouveau bug démontré)

`ThemeContext`, tokens, `Button`, `Chip`, `Input`, `Card`, `StepHeader`, `StepFooter` (UI-MOB-1) ; `CustomTabBar`, `TabNavigator`, `MesAnnoncesScreen`, `HotelOperationsScreen`, `NotificationsScreen` (UI-MOB-2, corrections préservées et revérifiées présentes dans le code actuel).

## 4. Écrans NON CONFIRMÉS (liste exacte extraite de `UI_MOB2_REPORT.md`)

D'après les réponses factuelles de `UI_MOB2_REPORT.md` (section « Questions obligatoires ») : `PublierBienScreen` (NON CONFIRMÉ), `DetailAnnonceScreen` (non audité), `CarteScreen` (20/33 occurrences non qualifiées), écrans Auth (non mentionnés du tout dans UI-MOB-2), `Messagerie` (NON CONFIRMÉ), `TenantPortal` (« probable » mais non testé visuellement).

## 5. Correction du postulat implicite du mandat sur `PublierBienScreen`

**Découverte critique par lecture directe du code, pas supposée** : `PublierBienScreen.jsx` (1733 lignes, 47 couleurs en dur) n'est **pas** le flux de création d'une nouvelle annonce en 6 étapes. Le commentaire de `PublicationStack.jsx` le dit explicitement : *« l'écran de choix initial remplace l'ancien formulaire unique PublierBienScreen (conservé uniquement pour l'édition d'une annonce existante, via ProfilStack "PublierBien") »*.

Le vrai flux de création (« Publier ») est : `ChoixTypeAnnonceScreen` → `AddRentalPropertyScreen` / `AddSalePropertyScreen` / `AddAccommodationScreen` / `HotelEstablishmentScreen` — ces 4 écrans, déjà audités en détail en UI-MOB-1, utilisent tous `StepHeader`/`StepFooter`/`ChipMultiSelect`/`Input` (déjà corrigés) et contiennent **0 couleur hardcodée** (vérifié par grep direct, résultat vide sur les 4 fichiers). Les composants partagés `components/publication/*` contiennent également 0 hardcode, à l'exception de `PhotoManager.jsx` (8 occurrences, toutes des overlays blancs sur miniatures photo — catégorie légitime mandat §23).

**Conséquence** : le vrai flux « publier une nouvelle annonce » en 6 étapes est déjà entièrement certifié par héritage des correctifs UI-MOB-1, sans action nécessaire ce sprint. L'audit de ce sprint porte donc sur `PublierBienScreen.jsx` en tant qu'écran d'**édition** d'une annonce existante (chemin réel, distinct, toujours accessible).

## 6. Composants partagés audités

`components/ui/LoadingSpinner.jsx`, `Divider.jsx`, `Skeleton.jsx`, `SkeletonPropertyCard.jsx`, `components/PrixFCFA.jsx` (variante par défaut) : **bug réel découvert** — les 5 importaient statiquement `colors` (thème clair) au lieu d'appeler `useTheme()`, exactement le même défaut que `Chip.jsx` en UI-MOB-1. `SkeletonPropertyCard` en particulier restait blanc (`colors.bgCard`) en toutes circonstances, produisant un bloc blanc figé en mode sombre — le cas explicitement cité en exemple par le mandat §54. `components/ui/Button.jsx`/`Card.jsx`/`Badge.jsx`/`EmptyState.jsx` (un second système de composants `ui/`, distinct de `components/Button.jsx`/`Card.jsx`, découvert lors de l'audit — les deux sont utilisés en parallèle, 7 écrans chacun) : déjà theme-aware, aucune action requise, duplication architecturale documentée mais non traitée (hors périmètre : pas de refonte du design system, mandat §10).

## 7. Recherche de tokens fantômes (mandat §39-40)

Extraction programmatique des 45 clés réelles de `colors.js`/`colorsDark.js` (parfaitement symétriques), puis scan de tout `src/` pour `c.xxx`/`themeColors.xxx` où `xxx` n'est pas une clé valide. **Un seul cas trouvé avant correction** : `c.danger` dans `HotelOperationsScreen.jsx` — déjà corrigé en UI-MOB-2 vers `c.error`, revérifié absent du code actuel. Recherche des motifs `c.xxx || '#...'` : 6 occurrences trouvées (`CacheManagementScreen.jsx` ×5, `HotelBookingScreen.jsx` ×1), toutes sur des tokens **valides** (`c.blue`, `c.success`) — fallback mort (jamais actif), pas un bug, non corrigé (cosmétique).

## 8. Risques Light / 9. Risques Dark

Motif récurrent trouvé : boutons/badges à fond `c.gold` avec texte/icône blanc fixe (`#FFFFFF`) au lieu de `c.onAccent` — `c.gold` restant un ton moyennement clair dans les deux thèmes, le blanc fixe échoue au contraste WCAG AA dans les deux modes (pas seulement en dark mode). Trouvé dans : `PublierBienScreen.jsx` (bouton Suivant/Publier), `DetailAnnonceScreen.jsx` (3 CTA principaux + bouton envoi commentaire + chip/bouton RDV). Motif récurrent supplémentaire, spécifique au contraste : sous-titre de hero à opacité ≤ 0,55 sur fond `#0A0A0A` permanent, trouvé identique dans 4 des 5 écrans Auth (`LoginScreen` 0,55 ; `RegisterScreen`/`ResetPasswordScreen`/`ForgotPasswordScreen` 0,5) — même classe de défaut déjà corrigée en UI-MOB-1 pour le splash (0,35→0,72) et le profil (0,5→0,75).

## 10. Responsive

Non testé sur device/simulateur réel (contrainte d'environnement inchangée). Les corrections de ce sprint sont exclusivement des couleurs (aucun changement de dimension/layout), donc risque de régression responsive nul par construction.

## 11. Modales

`DetailAnnonceScreen.jsx` contient plusieurs modales (bail, signalement, RDV) — déjà theme-aware (`c.bgCard` pour la surface, `rgba(0,0,0,0.5)` pour l'overlay — légitime, mandat §48). Aucun bug de modale trouvé lors de l'audit.

## 12. Clavier

Non modifié — `Screen.jsx`/`avoidKeyboard` (architecture UI-MOB-1) déjà en place sur les écrans de formulaire. Aucun second système introduit.

## 13. Navigation

`TabNavigator.jsx`/`CustomTabBar.jsx` déjà corrigés en UI-MOB-2, revérifiés sans nouvelle divergence. Aucun autre `cardStyle`/`contentStyle`/`sceneStyle` hardcodé trouvé par recherche exhaustive dans `src/navigation/`.

## 14. Priorités (P0/P1/P2/P3)

| # | Constat | Preuve | Priorité |
|---|---|---|---|
| 1 | `LoadingSpinner`/`Divider`/`Skeleton`/`SkeletonPropertyCard`/`PrixFCFA` figés sur le thème clair (bloc blanc agressif en dark mode pour les skeletons de cartes propriété) | Lecture directe, import statique `colors` | **P0/P1** |
| 2 | CTA gold à texte/icône blanc fixe, échec de contraste dans les deux thèmes (`PublierBienScreen`, `DetailAnnonceScreen` ×5 occurrences) | Lecture directe des tokens, calcul de contraste | **P1** |
| 3 | Sous-titres Auth à opacité ≤0,55, même classe que le bug splash déjà corrigé | Lecture directe, 4 écrans identiques | **P2** |
| 4 | Duplication architecturale `components/Button.jsx` vs `components/ui/Button.jsx` | Lecture directe, 7 usages chacun | **P3, documenté, non traité** |
| 5 | Échelle `spacing` non strictement croissante (hérité UI-MOB-1/2) | Non revérifié ce sprint, toujours non corrigé | **P3, backlog** |

Corrections prévues : P0/P1/P2 démontrés ci-dessus. Aucun refactoring massif (mandat §63).
