# UI-MOB-6 — État initial

Date : 2026-08-19. Branche `main`.

## 1. Baseline Git

```
git status --short
 M altimmo-app/src/components/ui/EmptyState.jsx
 M altimmo-app/src/navigation/CustomTabBar.jsx
 M altimmo-app/src/navigation/TabNavigator.jsx
 M altimmo-app/src/screens/Annonces/ListeAnnoncesScreen.jsx
 M client/lib/components/layout/Footer.jsx
 D client/public/images/Logo_Altitude1.png
?? altimmo-app/src/components/ui/__tests__/EmptyState.test.jsx
?? altimmo-app/src/navigation/__tests__/CustomTabBarSafeArea.test.jsx
?? client/public/images/Logo-Altitude.png
?? client/public/images/Logo_Altitude_Vision.png
?? server/docs/HOTFIX_WEB_FOOTER_LOGO1_REPORT.md
?? server/docs/UI_MOB5_1_EMPTY_STATE_REPORT.md
?? server/docs/UI_MOB5_VISUAL_ETAT_INITIAL.md
?? server/docs/UI_MOB5_VISUAL_REPORT.md
git branch --show-current → main
git rev-parse HEAD → 29044699d25df30d1fffbbadf11fefc9cd6f9cac
git diff --check → exit 0
```

Modifications héritées des sprints UI-MOB-5 et UI-MOB-5.1 de cette même session (hero Home, bottom nav safe-area, empty state compact) — non commitées, conservées intactes comme baseline de ce sprint, non touchées.

## 2. Rapports lus

Synthèse pertinente pour Profil :

- **UI-MOB-1** : `ProfilScreen.jsx` déjà corrigé — `heroEmail` opacité 0.5→0.75, `roleBadge` rééquilibré, `hero.paddingBottom` réduit (spacing.xxl→spacing.lg). `heroName` (`#F0EDE8`) non modifié, jugé alors "pleinement opaque, pas la source du problème" — **jamais vérifié sur device réel**.
- **UI-MOB-2 à UI-MOB-4** : Profil non repris.
- **UI-MOB-5 / UI-MOB-5.1** : Home hero corrigé pour un bug identique (LinearGradient ne se peignant pas sur ce device réel, sans fond de secours) — pattern à vérifier explicitement sur Profil, qui utilise la même architecture (hero + LinearGradient sans backgroundColor).

**Point capital** : comme pour la Home, aucune vérification visuelle réelle du Profil sur device n'avait eu lieu avant ce sprint — les corrections UI-MOB-1 reposaient sur la lecture de code et le calcul de contraste théorique (opacité 0.75 d'un blanc cassé sur un fond supposé sombre), jamais sur une capture d'écran réelle.

## 3. Environnement de vérification

- `adb devices` → Samsung Galaxy SM_S918B (`R5CW821Y2JZ`), device réel, navigation 3 boutons.
- Metro déjà actif (process hérité des sprints précédents de cette session, port 8081) — réutilisé, pas de second serveur lancé.
- App relancée via `am force-stop` + `monkey -c android.intent.category.LAUNCHER` pour repartir d'un état propre.

## 4. Constat initial — Profil, Light Mode

Reproduit et capturé sur device réel : dans le hero (bandeau identité), "Altitude Vision" (nom) et "altitudevis3n@gmail.com" (email) apparaissaient en texte fantôme, quasi invisible sur fond quasi blanc. Le badge "Admin" (rouge) restait lisible. Confirme exactement l'observation notée en marge de UI-MOB-5.1.

## 5. Composant identifié

`altimmo-app/src/screens/Profil/ProfilScreen.jsx` — écran unique, pas de sous-composants partagés dédiés à l'identité (nom/email/avatar/badge tous inline dans ce fichier). `TabNavigator.jsx` → route "Profil" → `ProfilScreen`.

## 6. Plan

1. Confirmer par lecture de code + device que la cause est identique à UI-MOB-5 (hero sans fond de secours).
2. Corriger avec le même correctif minimal déjà prouvé (fond de secours `#0A0A0A`).
3. Vérifier Light et Dark sur device réel.
4. Vérifier non-régression bottom nav, sections, hero.
5. Ajouter un test ciblant la cause réelle (pas juste la présence du texte).
6. Gates complets.

Aucune modification métier prévue (Auth/JWT/Tenant/IAM/businessProfiles/Ownership/Messaging/PMS/Payments/Mongo).
