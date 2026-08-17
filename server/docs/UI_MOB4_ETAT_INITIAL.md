# UI-MOB-4 — État initial : certification Messagerie & Tenant Portal

Date : 2026-08-15. Branche `main`, HEAD `ab5ae586fab50ddce02e65ea081330d2769c6503` (identique à UI-MOB-1/2/3, non commité, `git diff --check` propre avant modification).

## 1. Git baseline

`git status --short` : 30 lignes (25 modifiés + 5 nouveaux dossiers de test, tous hérités d'UI-MOB-1/2/3, non commités). `git diff --stat` : 25 fichiers, 184 insertions / 86 suppressions. `git branch --show-current` → `main`. `git rev-parse HEAD` → `ab5ae586fab50ddce02e65ea081330d2769c6503`. Rien réinitialisé, rien perdu.

## 2. Tests baseline

38/38 suites, 346/346 tests (dernière mesure UI-MOB-3). Lint 0 erreur, Doctor 21/21, export Android PASS.

## 3. Architecture Messagerie (graphe réel, pas supposé)

`MessagerieStack.jsx` : `ConversationsScreen` (liste) → `ChatScreen` (conversation temps réel, Socket.IO + polling de secours) ou `ChatbotScreen` (contact agence, formulaire de sujet). Pas d'écran de pièce jointe dédié — les pièces jointes sont gérées inline dans `ChatScreen` (modal de sélection : image/vidéo/audio/document via `expo-image-picker`/`expo-document-picker`, aperçu avant envoi, téléchargement sécurisé via `downloadSecureAttachment`).

## 4. Architecture Tenant Portal (graphe réel)

Un seul écran, `TenantPortalScreen.jsx` (179 lignes), avec 6 sections internes (`dashboard`, `lease`, `payments`, `documents`, `notice`, `maintenance`) commutées par état local (`SECTIONS`, `renderContent`), pas par navigation. Alias existants pour compatibilité de paramètres (`bail`→`lease`, `paiements`→`payments`, `preavis`→`notice`). Aucun autre écran Tenant Portal n'existe (confirmé par recherche exhaustive `TenantPortal` dans `src/`).

## 5. Écrans concernés

`ConversationsScreen.jsx` (541 lignes), `ChatScreen.jsx` (822 lignes), `ChatbotScreen.jsx` (377 lignes), `TenantPortalScreen.jsx` (179 lignes).

## 6. Composants partagés utilisés

Messagerie : `LoadingSpinner`, `Divider`, `PageHeader`, `EmptyState`, `IllustrationNoMessages` (déjà corrigés/theme-aware). Tenant Portal : `PageHeader`, `Card` (`components/ui/`), `Button` (`components/ui/`), `EmptyState`, `Skeleton` (déjà corrigé UI-MOB-3).

## 7. Navigation

Aucune modification prévue de `resolveNavigation()`, `registry.json` ou des deep-links PMS/notifications. `MessagerieStack`/accès Tenant Portal via `Profil` déjà intégrés à `CustomTabBar` (UI-MOB-2), non retouchés.

## 8. Thème

`ConversationsScreen`, `ChatScreen`, `ChatbotScreen`, `TenantPortalScreen` utilisent tous `useTheme()` — aucun import statique `colors` (clair) trouvé (recherche exhaustive), contrairement à l'hypothèse implicite du mandat de retrouver la classe de bug UI-MOB-3.

## 9. Hardcodes pertinents

`ChatbotScreen.jsx` (6), `ChatScreen.jsx` (4, avant correction), `ConversationsScreen.jsx` (1, avant correction), `TenantPortalScreen.jsx` (**0**). Détail classification en REPORT §31.

## 10. Light Mode / 11. Dark Mode

Voir matrices REPORT. Bug réel trouvé : badge de rôle « Prestataire » (`ConversationsScreen`) figé sur mauve clair (`#EDE9FE`/`#6D28D9`) alors que les 2 autres rôles (`Proprietaire`/`Client`) du même tableau utilisent déjà des tokens theme-aware — incohérence directement observable dans le code, pas supposée. Bouton Envoyer (`ChatScreen`) : icône blanche fixe sur fond `c.gold`, même classe de bug déjà corrigée 6 fois en UI-MOB-3 (`DetailAnnonceScreen`, `PublierBienScreen`).

## 12. Keyboard

`ChatScreen` utilise déjà `KeyboardAvoidingView` (`behavior: 'padding'` sur iOS, `undefined` sur Android — pattern standard reposant sur `windowSoftInputMode`, non modifié). `TenantPortalScreen` utilise `keyboardShouldPersistTaps="handled"` sur son `ScrollView` principal, correct pour le formulaire de maintenance intégré à la page.

## 13. Safe areas

`ConversationsScreen`/`TenantPortalScreen` : `SafeAreaView edges={['top']}`. `ChatScreen` : `SafeAreaView edges={['bottom']}` (le header natif de navigation gère le haut). Cohérent, non modifié.

## 14. Responsive

Non testé sur device réel (contrainte d'environnement inchangée). `TenantPortalScreen` a déjà une adaptation tablette (`useWindowDimensions`, `width >= 700` → grille 3 colonnes au lieu de 2, `maxWidth: 900` centré) — déjà présente, non ajoutée ce sprint.

## 15. Accessibilité

Boutons d'action (envoi, pièce jointe, retrait pièce jointe, téléchargement document) déjà pourvus d'`accessibilityLabel`/`accessibilityRole` dans le code existant. Revérifié, non régressé.

## 16. Bugs confirmés

1. `ConversationsScreen.jsx` : badge de rôle « Prestataire » non theme-aware (seul des 3 rôles affichés).
2. `ChatScreen.jsx` : icône du bouton Envoyer blanche fixe sur fond gold (contraste WCAG insuffisant dans les deux thèmes, même classe qu'UI-MOB-3).
3. `ChatScreen.jsx` : `bubbleTextMe` valeur `#0A0A0A` en dur au lieu de `c.onAccent` (valeur identique, dette de cohérence, pas un bug visuel actif).
4. `TenantPortalScreen.jsx` : **aucun bug trouvé**, écran déjà entièrement conforme.
5. `ChatbotScreen.jsx` : **aucun bug trouvé**, palette d'accent verte (statut en ligne) déjà cohérente et légitime dans les deux thèmes.

## 17. P0/P1/P2/P3

| # | Constat | Priorité |
|---|---|---|
| 1 | Badge rôle Prestataire non theme-aware | **P2** |
| 2 | Icône Envoyer blanche fixe sur gold | **P1** |
| 3 | `bubbleTextMe` non tokenisé (valeur identique) | **P3** |

## 18. Plan minimal de correction

Ajouter les tokens `purple`/`purpleMuted` (extension additive des deux thèmes, suivant exactement le pattern `blue`/`blueMuted` déjà établi) pour fermer le bug #1 sans inventer un système parallèle. Corriger l'icône Envoyer vers `c.onAccent` (bug #2). Tokeniser `bubbleTextMe` par cohérence (bug #3, zéro risque). Ne toucher à aucune logique de conversation/socket/upload/API. Ne rien modifier dans `TenantPortalScreen.jsx` (aucun bug démontré).
