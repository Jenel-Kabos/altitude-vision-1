# UI-MOB-5 — État initial

Date : 2026-08-19. Branche `main`.

## 1. Baseline Git

```
git status --short (racine)
 M client/lib/components/layout/Footer.jsx
 D client/public/images/Logo_Altitude1.png
?? client/public/images/Logo-Altitude.png
?? client/public/images/Logo_Altitude_Vision.png
?? server/docs/HOTFIX_WEB_FOOTER_LOGO1_REPORT.md
git branch --show-current → main
git rev-parse HEAD → 29044699d25df30d1fffbbadf11fefc9cd6f9cac
git diff --check → exit 0
```

Ces changements sont hérités des sprints `UI-WEB-FOOTER-1`/`HOTFIX-WEB-FOOTER-LOGO-1` précédents dans cette même session — non commités, non touchés par ce sprint. `HEAD` n'a pas changé depuis le hotfix logo précédent (pas de nouveau commit externe détecté au lancement de ce sprint).

## 2. Rapports lus

`UI_MOB1_REPORT.md` → `UI_MOB2_REPORT.md` → `UI_MOB3_REPORT.md` → `UI_MOB4_REPORT.md`, synthèse (recherche déléguée, vérifiée) :

- **UI-MOB-1** : `Chip.jsx` figé en light (cassait le dark mode sur 4 écrans Publication), bouton "Précédent" qui wrappait mal, opacité du sous-titre du splash (0.35→lisible), contraste `heroEmail` du Profil (0.5→0.75 opacité).
- **UI-MOB-2** : `CustomTabBar.jsx` audité — un bug réel corrigé (couleur de l'icône du FAB) ; texte quasi-noir sur fond `goldMuted` illisible en dark dans `MesAnnoncesScreen.jsx` ; `HotelOperationsScreen.jsx` référençait un token `c.danger` inexistant. **`ListeAnnoncesScreen.jsx` (Home) explicitement noté "non audité en détail ce sprint" (§28)** — jamais repris dans UI-MOB-3 ni UI-MOB-4.
- **UI-MOB-3** : 5 composants partagés figés en light (`LoadingSpinner`, `Divider`, `Skeleton`, `SkeletonPropertyCard`, `PrixFCFA`) ; contraste blanc-sur-or répété sur 6 boutons/badges ; ajout d'un test de garde `tokenIntegrity.test.js`.
- **UI-MOB-4** : Messagerie et Tenant Portal certifiés (derniers écrans "NON CONFIRMÉ").

**Point capital confirmé à la lecture des 4 rapports** : *aucune vérification visuelle sur device/simulateur réel n'a jamais eu lieu* dans les 4 sprints précédents — verbatim UI-MOB-4 : « toutes les certifications reposent sur la lecture de code, le calcul de contraste et des tests unitaires, jamais une capture d'écran réelle ». Ceci explique directement pourquoi ce mandat existe : le bug de slogan invisible en Light sur la Home a survécu à 4 sprints de « certification ».

## 3. Environnement de vérification réel utilisé

- `adb devices` → un appareil physique connecté en USB : **Samsung Galaxy (SM_S918B)**, `R5CW821Y2JZ`, navigation Android **3 boutons** (barre système classique, pas de navigation gestuelle) — c'est le device de référence pour tout ce sprint (device réel, pas un émulateur).
- Un émulateur `Pixel_6` a également été démarré en parallèle mais n'a pas été nécessaire : le device physique répondait correctement à `adb`.
- App lancée via `npx expo start --android` → dev client déjà installé sur le téléphone (`com.altitudevision.altimmo`), connecté au bundler Metro local. API pointant vers `https://altitude-vision.onrender.com/api` (prod), conforme au mandat (« l'API mobile a déjà été corrigée pour pointer correctement »).
- Vérification par cycle : édition du code → `am force-stop` + relance de l'app → capture d'écran réelle (`adb shell screencap`) + dump d'accessibilité (`uiautomator dump`) pour confirmer la structure réellement montée, jamais une supposition.

## 4. Constat initial — Home / Annonces, Light Mode

Reproduit et **capturé sur device réel** (pas une supposition) :
- Le hero (bandeau sombre censé porter le slogan) affichait un fond **`#FAFAF8`** (le token clair `bg` de l'écran) au lieu du dégradé sombre attendu (`#0A0A0A → #1A1208 → #2D1E04`, `LinearGradient` de `expo-linear-gradient`) — confirmé par échantillonnage de pixels sur la capture (RGB uniforme `(250,250,248)` sur toute la zone du hero).
- Conséquence directe : le slogan « Votre futur bien immobilier vous attend » (couleur `#F0EDE8`, quasi blanc) et l'eyebrow « BRAZZAVILLE · CONGO » (doré) se retrouvaient sur fond quasi blanc — **exactement le défaut décrit au §0 du mandat**, reproduit à l'identique sur device réel.
- Le watermark décoratif (logo à 0.12 d'opacité) restait visible mais très effacé sur ce fond clair.
- Espace vertical important entre "À découvrir" et le contenu suivant (empty state) — confirmé visuellement.

Ce constat confirme le point de départ du mandat (§28 : « Le point de départ de ce sprint est la capture réelle montrant la HOME en Light Mode avec des textes presque invisibles »).

## 5. Plan

1. Corriger et vérifier la Home Light en priorité absolue (hero), sans toucher aux autres écrans.
2. Vérifier Dark ne régresse pas.
3. Documenter honnêtement tout ce qui reste ouvert plutôt que de deviner un correctif non vérifié.
4. Tests ciblés protégeant les corrections réelles (pas de snapshot massif).
5. Gates complets (syntax, lint, types, tests, expo-doctor, export).
6. Rapport avec matrice visuelle et verdict.

Aucune modification métier (Auth/JWT/Tenant/IAM/PMS/Paiement/Mongo) prévue.
