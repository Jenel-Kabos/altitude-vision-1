# MOB-E2E — État initial : certification mobile réelle sur émulateur

Date : 2026-08-16. Branche `main`, HEAD `ab5ae586fab50ddce02e65ea081330d2769c6503` (identique à UI-MOB-1/2/3/4, non commité, `git diff --check` propre avant modification).

## 1. Git

`git status --short` : 41 lignes (27 modifiés + 6 nouveaux dossiers de test hérités d'UI-MOB-1→4, tous non commités). `git branch --show-current` → `main`. `git rev-parse HEAD` → `ab5ae586fab50ddce02e65ea081330d2769c6503`. Rien réinitialisé, rien perdu.

## 2. Node/npm

`node -v` → v20.20.2. `npm -v` → 10.8.2 (inchangé depuis MOB-1).

## 3. Expo

`npx expo --version` → 57.0.14 (CLI). Package `expo` installé : `~57.0.13` (aligné depuis MOB-1).

## 4. SDK réel

**SDK 57**, confirmé par lecture directe de `package.json`/`node_modules/expo/package.json` — pas 52, pas 56 (chiffres contradictoires des anciens documents, déjà corrigés dans MOB-1). Aucune supposition, aucun upgrade effectué.

## 5. Doctor

`npx expo-doctor` → **21/21**, confirmé par exécution réelle avant toute modification.

## 6. Infrastructure E2E disponible

**Un framework existe déjà : Maestro**, configuré dans `altimmo-app/.maestro/` (9 flows + README + `smoke.yaml`), jamais exécuté auparavant (le README l'indique explicitement : « Les sélecteurs devront être stabilisés avec des `testID` après le premier build preview disponible »). Aucun second framework installé — Maestro CLI (2.8.0) installé car absent de la machine mais requis pour exécuter la configuration déjà choisie par le projet (pas un nouveau choix d'outil).

## 7. Android disponible ?

**Oui, réellement.** Android SDK présent (`~/Library/Android/sdk`), AVD `Pixel_6` disponible (API 34, `google_apis` x86_64), émulateur démarré et amené à `sys.boot_completed=1` avec succès pendant ce sprint. Device confirmé : `sdk_gphone64_x86_64`, Android 14.

## 8. iOS disponible ?

**Non.** `xcrun simctl` absent (Xcode complet non installé, seulement les Command Line Tools). iOS runtime : **NON CERTIFIÉ** dès ce constat initial — ne sera à aucun moment prétendu testé.

## 9. Appareil physique disponible ?

Non — aucun appareil physique connecté (`adb devices` ne montre que l'émulateur après démarrage). Émulateur uniquement.

## 10. Backend de test

Aucun serveur de test mobile dédié n'existait avant ce sprint — seul `server/scripts/start-accommodation-e2e.js` existait, conçu pour Playwright web (démarre Next.js + Express ensemble). Créé ce sprint : `server/scripts/start-mobile-e2e.js`, qui réutilise **exactement** les mêmes fixtures (`ids`, `seed()`, exportées depuis le script web via une modification additive minimale — voir REPORT §détail) sans démarrer de client web, et démarre uniquement Express + MongoMemoryReplSet, joignable depuis l'émulateur Android via `10.0.2.2:<port>` (mécanisme standard de l'émulateur pour atteindre le loopback hôte). Crédentials externes neutralisés via `safeTestEnv`/`externalNetworkGuard.js` (déjà utilisés et audités par le harnais web), `DISABLE_SCHEDULED_JOBS=1`.

## 11. Fixtures

Réutilisées du harnais web existant : `owner-e2e@example.test` (Admin), `client-e2e@example.test` (Client), `rental-owner-e2e@example.test` (Proprietaire, propriétaire réel de `dash4HotelA`/`dash4HotelB` avec 8+1 chambres physiques disponibles — fixture E2E-1 déjà conçue pour un cycle PMS complet). Ajoutées ce sprint, spécifiquement pour MOB-E2E : `tenant-e2e@example.test` (Client avec dossier `Locataire` rattaché + `Contrat` de location actif sur la Villa E2E Brazzaville déjà seedée) — nécessaire car aucun fixture locataire n'existait dans le harnais web.

## 12. Parcours à certifier

Auth (login/logout/session), navigation globale Light/Dark, Client (recherche/détail/favoris/visites/messagerie), Owner immobilier (mes biens/création annonce), Owner hébergement (Hotel vs Accommodation), PMS complet (réservation→check-in→financial readiness→check-out→housekeeping→inspection), Tenant Portal, notifications/deep-links, realtime hôtel, cross-owner.

## 13. Limitations

- Aucun environnement iOS — Android uniquement.
- Aucun appareil physique — émulateur uniquement.
- Sélecteurs Maestro existants écrits sans jamais avoir été exécutés contre un vrai build — attendus fragiles au premier passage (texte français avec regex `|`, un seul `testID` référencé : `property-card`, à vérifier réellement présent dans le code).
- Build de développement local (`expo run:android`), pas de build EAS cloud (conforme mandat §94).
- Temps de session fini : certains parcours secondaires (cross-tenant multi-tenant, notification push réelle background/cold-start) peuvent rester partiellement ou totalement NON CONFIRMÉ selon le temps réellement disponible après le cycle PMS (objectif principal explicite du mandat).

## 14. Risques

- Build natif Android (Gradle) potentiellement long (plusieurs minutes) — géré en arrière-plan avec suivi.
- Sélecteurs texte Maestro peuvent ne pas matcher exactement le texte réel des écrans (accents, casse, wording) — à corriger un par un sur preuve d'échec réel, jamais en assouplissant artificiellement une assertion sans vérifier la cause.
- `.env` mobile pointait par défaut vers le backend de **production** Render — corrigé pour ce sprint vers le backend de test local (`10.0.2.2:5057`), sera restauré à l'état d'origine à la fin du sprint.

## 15. Stratégie

1. Auditer l'existant (fait — Maestro déjà présent, jamais exécuté).
2. Construire un backend de test mobile minimal, isolé, réutilisant les fixtures web existantes plutôt que d'en dupliquer un second jeu.
3. Builder un dev client Android local via `expo run:android` (pas de cloud EAS) et l'installer sur l'émulateur réel.
4. Exécuter les 9 flows Maestro existants tels quels contre l'app réellement lancée, corriger les sélecteurs sur preuve d'échec réel (pas de contournement).
5. Étendre les flows pour couvrir l'objectif principal explicite du mandat — le cycle PMS complet — et les scénarios obligatoires non couverts (dark mode, session restore, cross-owner, switch hôtel).
6. Documenter honnêtement ce qui est réellement exécuté vs NON CONFIRMÉ, sans jamais fabriquer une certification non prouvée.
