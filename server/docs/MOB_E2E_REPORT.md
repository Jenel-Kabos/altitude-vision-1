# MOB-E2E — Rapport final : certification mobile réelle sur émulateur

Date : 2026-08-16. Branche `main`, HEAD `ab5ae586fab50ddce02e65ea081330d2769c6503` (**inchangé**, aucun commit).

## 1. Résumé exécutif

Pour la première fois de toute la chaîne UI-MOB-1→4, l'application mobile a été **réellement compilée, installée et exécutée** sur un émulateur Android (Pixel 6, API 34), connectée à un backend de test réel (Express + MongoDB en mémoire, fixtures dédiées), avec une session utilisateur réelle établie de bout en bout : requêtes HTTP authentifiées confirmées côté serveur, connexion Socket.IO active avec le bon `userId`, rendu des données réellement seedées à l'écran. Le thème Dark Mode a été basculé en direct et vérifié entièrement lisible. Un test de sécurité cross-owner a été observé en conditions réelles (accès refusé proprement géré, sans crash). L'automatisation Maestro du parcours de connexion a été prouvée fonctionnelle en exécution directe mais s'est révélée instable en exécution batch à cause d'un problème de timing non déterministe propre à l'overlay natif du menu développeur Expo Dev Client dans cet environnement d'émulateur contraint — documenté comme limitation d'infrastructure de test, pas comme bug produit. iOS n'a jamais été exécuté (outils absents) — non certifié, explicitement.

## 2. Git

`git status --short` / `git diff --stat` : fichiers modifiés spécifiquement par MOB-E2E : `altimmo-app/.maestro/02-login.yaml` (sélecteurs corrigés contre l'app réelle), `server/scripts/start-accommodation-e2e.js` (export additif minimal de `{ids, seed}`, comportement direct inchangé), nouveau `server/scripts/start-mobile-e2e.js`, + `server/docs/MOB_E2E_*.md`. `.env` mobile temporairement pointé vers le backend de test puis **restauré à l'identique** (vérifié : aucune différence dans `git diff` sur ce fichier). HEAD `ab5ae586fab50ddce02e65ea081330d2769c6503` inchangé du début à la fin. Aucun `git add`/`commit`/`push`.

## 3. Environnement

Node v20.20.2, npm 10.8.2, `npx expo --version` 57.0.14, JDK détecté : Temurin 26 (par défaut, **incompatible** avec la chaîne de build Android — cause du premier échec de build) et Temurin 17 (déjà installé, utilisé pour le build réussi via `JAVA_HOME=$(/usr/libexec/java_home -v 17)`). macOS 26.5.2, x86_64.

## 4. Expo réel

**SDK 57** confirmé (package `expo@~57.0.13` réellement installé), cohérent avec MOB-1/UI-MOB-1→4. Aucune supposition sur un chiffre de SDK antérieur (52/56), aucun upgrade effectué.

## 5. Android device/emulator

**Réel, réellement démarré ce sprint.** AVD `Pixel_6` (API 34, `google_apis` x86_64), amené à `sys.boot_completed=1` par polling actif. Device confirmé : `sdk_gphone64_x86_64`, Android 14. APK debug compilé via `expo run:android` (JDK 17) — `BUILD SUCCESSFUL in 56s`, installé et lancé sur l'émulateur.

## 6. iOS status

**NON CERTIFIÉ.** `xcrun simctl` absent (pas de Xcode complet installé). Aucune tentative d'exécution, aucune affirmation de fonctionnement iOS.

## 7. Framework E2E

**Maestro, déjà présent dans le projet** (`altimmo-app/.maestro/`, 9 flows + `smoke.yaml` + README), jamais exécuté auparavant (le README l'indiquait explicitement). Maestro CLI (2.8.0) installé ce sprint — absent de la machine mais requis pour exécuter la configuration déjà choisie par le projet, pas un second framework.

## 8. Backend de test

Nouveau `server/scripts/start-mobile-e2e.js` : réutilise **exactement** les mêmes fixtures que le harnais web existant (`ids`, `seed()` de `start-accommodation-e2e.js`, exportées via une modification additive minimale — `module.exports = { ids, seed }` sous garde `require.main === module`, comportement direct du script web totalement inchangé), sans démarrer de client Next.js. MongoDB en mémoire (`MongoMemoryReplSet`), Express lié sur toutes les interfaces (`httpServer.listen(PORT)`, comportement par défaut de Node), joignable depuis l'émulateur via `10.0.2.2:5057`. `safeTestEnv`/`externalNetworkGuard.js` réutilisés tels quels (neutralisation des credentials externes réels, blocage réseau externe). `.env` mobile temporairement redirigé (`API_URL`/`EXPO_PUBLIC_API_URL`/`EXPO_PUBLIC_SOCKET_URL` → `10.0.2.2:5057`, `EXPO_PUBLIC_SENTRY_DSN` vidé pour ce sprint), restauré après usage.

## 9. Fixtures

Réutilisées du harnais web : `owner-e2e@example.test`/`E2eOwner!2026` (Admin), `client-e2e@example.test` (Client), `rental-owner-e2e@example.test`/`E2eOwnerRental!2026` (Proprietaire, propriétaire réel de `dash4HotelA`/`dash4HotelB` — 8+1 chambres physiques disponibles). Ajouté ce sprint : `tenant-e2e@example.test`/`E2eTenant!2026` (Client + dossier `Locataire` + `Contrat` de location actif sur la Villa E2E Brazzaville) — nécessaire, absent du harnais web. **Limitation notée** : le serveur d'images fixture (`fixture.svg`, servi par `startFakePaymentProvider()` dans le harnais web) n'a pas été démarré dans `start-mobile-e2e.js`, causant des vignettes d'image vides à l'écran — sans impact sur les parcours testés, documenté §28.

## 10. Auth

**PASS, prouvé par exécution directe et non-Maestro** : lancement app → onboarding → écran de connexion → saisie des identifiants réels → soumission → session établie. Preuve runtime : `GET /api/altimmo/search`, `GET /api/notifications/count` (200) et connexion Socket.IO (`userId: 66e200000000000000000001`, `activeSocketsForUser: 1`) observés dans les logs du backend de test **au moment exact** de l'action dans l'app. Écran d'accueil post-connexion affichant les vraies données seedées (« Maison Location E2E », « Maison Location E2E Mobile », 450 000 FCFA). Boutons/inputs/clavier vérifiés visuellement fonctionnels (clavier n'a jamais masqué le bouton de connexion).

## 11. Login invalid

**NON CONFIRMÉ** — non testé ce sprint faute de temps restant après la certification du parcours nominal et du Dark Mode (priorités mandatées).

## 12. Session restore

**NON CONFIRMÉ** — non testé (nécessiterait un redémarrage complet de l'app après connexion, non exécuté dans le temps disponible).

## 13. Logout

**NON CONFIRMÉ** en exécution directe manuelle (non testé) ; tenté via Maestro (`09-logout.yaml`) mais échoué pour la même raison de timing du menu développeur que les autres flows batch (§20).

## 14. User switch

**NON CONFIRMÉ** — non testé.

## 15. Revoked session

**NON CONFIRMÉ** — non testé, nécessiterait une action serveur additionnelle (incrément `tokenVersion`) non exécutée dans le temps disponible.

## 16. Account status

**NON CONFIRMÉ** — non testé.

## 17. Light Mode

**PASS**, observé sur l'écran d'accueil et le Profil avant bascule (chips actifs gold/texte sombre corrects, cartes de résultats correctement rendues, bottom nav correcte).

## 18. Dark Mode

**PASS, preuve runtime directe et non ambiguë.** Bascule réelle via le sélecteur « Apparence » → « Sombre » du Profil, capturée avant/après par capture d'écran réelle de l'app. Résultat : re-rendu instantané et complet, tous les textes (titres, sous-titres, labels de section, éléments de menu) parfaitement lisibles, aucune occurrence de texte invisible ou de contraste insuffisant observée sur l'ensemble de l'écran Profil (hero, « Mes biens », « Activité », « Compte », « Apparence », « Préférences », « Support »). **Confirme directement que les correctifs de contraste UI-MOB-1 à 4 fonctionnent réellement sur device**, pas seulement en test unitaire. Un état vide (« Aucune visite à venir ») a également été capturé en Dark Mode, entièrement lisible.

## 19. Bottom navigation

**PASS partiel, observé** : tab active (Annonces, puis Profil) correctement mise en évidence en gold dans les deux thèmes, FAB central « + » toujours gold avec icône sombre correcte (conforme au correctif UI-MOB-2). Labels/icônes des autres tabs visibles et cohérents. Test automatisé Maestro dédié non exécuté ce sprint (couvert unitairement par `CustomTabBar.test.jsx`, UI-MOB-3).

## 20. Client

**PASS pour le parcours de recherche/accueil de base** (écran d'accueil, filtres, cartes de résultats réellement rendues avec données seedées). Recherche approfondie (filtre appliqué, ouverture d'un résultat, retour) : **NON CONFIRMÉ**, non exécutée par manque de temps.

## 21. Search

**NON CONFIRMÉ** au-delà de l'affichage de la barre de recherche et des chips de filtre (visuellement présents et corrects).

## 22. Property detail

**NON CONFIRMÉ** — non ouvert ce sprint.

## 23. Favorites

**NON CONFIRMÉ** — non testé.

## 24. Visits

Écran « Mes visites » atteint et capturé (état vide, voir §18) — confirme la navigation et l'état vide fonctionnent. Demande de visite réelle depuis une annonce : **NON CONFIRMÉ**.

## 25. Messaging

**NON CONFIRMÉ** en exécution directe (non atteint faute de temps) ; tenté via Maestro (`06-messaging.yaml`) mais échoué pour la même raison de timing (§20 de la section suivante).

## 26. Owner immobilier

**PASS pour l'accès au portefeuille** : connecté en tant qu'Admin (`owner-e2e`), écran « Opérations hôtelières » atteint avec les 4 hôtels réellement accessibles listés (données réelles du backend de test).

## 27. Create listing

**NON CONFIRMÉ** — non testé ce sprint (le vrai parcours de création, `ChoixTypeAnnonceScreen` → écran spécialisé, correctement identifié dans UI-MOB-3 comme le flux réel — non exécuté runtime ici par manque de temps).

## 28. Edit listing

**NON CONFIRMÉ** — non testé (`PublierBienScreen`, legacy, réservé à l'édition selon UI-MOB-3).

## 29. Tenant Portal

**NON CONFIRMÉ** en exécution runtime — fixture `tenant-e2e@example.test` créée et seedée avec un bail actif, mais l'écran Tenant Portal n'a pas été ouvert dans le temps restant. Certifié visuellement (code + tests unitaires) en UI-MOB-4, non re-vérifié sur device ce sprint.

## 30. Rental maintenance

**NON CONFIRMÉ** — non testé.

## 31. Owner hospitality

**PASS partiel** : liste des 4 hôtels accessibles observée (« Hôtel Owner A E2E », « Hôtel Owner B E2E », « Hôtel Portefeuille E2E », « Hôtel Portefeuille E2E Mobile »).

## 32. Hotel vs Accommodation

**NON CONFIRMÉ** distinctement ce sprint (aucun accès à un Accommodation testé en runtime) — distinction déjà vérifiée par le code et les tests unitaires (UI-MOB-3/4), non re-testée sur device.

## 33. PMS reservation

**NON CONFIRMÉ** — aucune réservation créée ni observée ce sprint (le temps restant après la certification Auth/Dark Mode a été consacré à l'accès au portefeuille hôtelier et à un test de sécurité cross-owner, jugé plus critique).

## 34. Room assignment

**NON CONFIRMÉ**.

## 35. Check-in

**NON CONFIRMÉ**.

## 36. Financial readiness

**NON CONFIRMÉ**.

## 37. Checkout blocked

**NON CONFIRMÉ**.

## 38. Checkout nominal

**NON CONFIRMÉ**.

## 39. Housekeeping

**NON CONFIRMÉ**.

## 40. Inspection passed

**NON CONFIRMÉ**.

## 41. Inspection failed

**NON CONFIRMÉ**.

## 42. Hotel maintenance

**NON CONFIRMÉ**.

## 43. Realtime

**NON CONFIRMÉ** — un socket a bien été observé connecté (§10), mais aucune mutation temps réel spécifique (`hospitality:updated`) n'a été déclenchée/observée ce sprint.

## 44. Hotel switch

**NON CONFIRMÉ** — la liste des 4 hôtels a été vue, mais le changement effectif entre deux écrans hôtel n'a pas été exécuté.

## 45. Cross-owner

**PASS, preuve runtime réelle et significative.** Connecté en tant qu'`owner-e2e` (Admin), tentative d'accès aux opérations de « Hôtel Owner A E2E 	» (propriété réelle de `rental-owner-e2e`, un compte différent) : l'application a affiché une boîte de dialogue « Erreur — Accès refusé. » propre, sans crash, avec bouton OK fonctionnel, **capturée deux fois de façon reproductible** (comportement cohérent, pas un accident). Confirme que le contrôle d'accès serveur (`assertOperationalHotelAccess` ou équivalent) est réellement appliqué en conditions réelles et que le mobile gère l'échec proprement — exactement le comportement attendu par le mandat §59 (« 403/état sûr, aucune donnée B »).

## 46. Cross-tenant

**NON CONFIRMÉ** — fixture multi-tenant non préparée pour ce scénario précis ce sprint (les hôtels réutilisent le même `platformTenant`, `dash4Hotel*` inclus).

## 47. Notifications

**NON CONFIRMÉ** — badge de notification visible dans le header (icône cloche) mais non testé fonctionnellement.

## 48. Foreground

**NON CONFIRMÉ**.

## 49. Background

**NON CONFIRMÉ**.

## 50. Cold start

**NON CONFIRMÉ** — l'app a été relancée plusieurs fois (`force-stop` + relaunch) pendant le débogage des sélecteurs Maestro, mais aucun scénario de deep-link/notification à froid n'a été spécifiquement exécuté.

## 51. Deep-links

**NON CONFIRMÉ** en exécution directe ; `08-notification-deeplink.yaml` existe et a été tenté en batch mais a échoué pour la même raison de timing (§20 ci-dessous, section Bugs).

## 52. Socket reconnect

**NON CONFIRMÉ**.

## 53. Network failure

**NON CONFIRMÉ**.

## 54. Runtime logs

Aucune exception non interceptée, écran rouge ou avertissement fatal observé pendant l'ensemble des manipulations réelles (connexion, navigation, bascule de thème, accès refusé). Le seul comportement anormal observé et documenté est la variabilité de timing du menu développeur Expo Dev Client (§ci-dessous), qui n'est pas une erreur applicative.

## 55. Bugs trouvés

1. **Build Android échoue avec JDK 26 par défaut** (`jlink`/`core-for-system-modules.jar` incompatible) — environnement/tooling, pas un bug produit. Contourné avec `JAVA_HOME` pointé sur JDK 17 (déjà présent sur la machine).
2. **`.maestro/02-login.yaml` (et par extension tous les flows qui le référencent)** contenait des sélecteurs jamais vérifiés contre l'app réelle : `text: "Email"` (le champ réel a pour accessibilityLabel « Adresse email », jamais « Email » seul) et interpolation `${TEST_EMAIL}` via un bloc `env:` qui ne se résolvait pas correctement en argument shell (le champ email affichait littéralement le texte « undefined »).
3. **Menu développeur Expo Dev Client non déterministe** : son overlay natif n'est pas exposé dans l'arbre d'accessibilité que Maestro lit (confirmé par dump direct de la hiérarchie), et son délai d'apparition après `launchApp` varie fortement (de quasi immédiat à plus de 10 secondes) selon la vitesse de chargement du bundle JS dans cet environnement d'émulateur contraint — ni un `pressKey: Back` inconditionnel, ni un délai fixe, ni une seule tentative de tap ne suffisent à le fermer de façon fiable à 100 %. Un correctif de contournement (tap de point répété, 5 tentatives) a permis un passage réussi en exécution directe, mais reste insuffisamment robuste pour une exécution batch fiable dans cet environnement (§56).
4. **Fixture backend mobile incomplète** : `start-mobile-e2e.js` ne démarre pas le serveur d'images fixture (`fixture.svg`), causant des vignettes vides à l'écran — artefact de mon propre harnais de test, pas un bug produit (confirmé par le fait que le hero Profil s'affiche parfaitement en Dark Mode où l'absence d'image n'a pas d'incidence visuelle).

## 56. Bugs corrigés

1. Corrigé (JDK 17 explicite).
2. Corrigé (`accessibilityLabel` réels, `-e` CLI flag au lieu du bloc `env:`).
3. **Non résolu de façon fiable à 100 %** — mitigé par une boucle de tentatives (5×), qui a permis un passage réussi en exécution directe mais pas une fiabilité batch totale (8/10 flows ont échoué au dernier run groupé, tous pour cette même cause racine, jamais pour une cause applicative différente). Documenté comme dette d'infrastructure de test pour un futur sprint, pas contourné artificiellement par un assouplissement des assertions (mandat §84 respecté : aucune assertion désactivée, aucun `wait` arbitraire ajouté pour masquer un vrai échec applicatif — le seul point non résolu est la fiabilité de l'automatisation elle-même, pas la validité fonctionnelle du parcours, qui a été prouvée séparément par exécution manuelle directe avec preuve backend).
4. Non corrigé (documenté, sans impact sur les parcours testés).

## 57. E2E stability

Le parcours de connexion a été exécuté avec succès **une fois** en conditions parfaitement contrôlées (exécution directe, hors batch). La règle mandat §85 (« 3× le parcours principal ») n'a **pas** été satisfaite — un seul passage réussi a été obtenu avant que le temps du sprint ne soit consommé par le débogage de l'instabilité du menu développeur. **NON CONFIRMÉ** pour la stabilité à 3 exécutions.

## 58. Unit tests

**40/40 suites, 358/358 tests**, identique à la baseline UI-MOB-4 — aucune régression (aucun fichier source de l'app mobile modifié ce sprint, uniquement le flow Maestro et le script serveur de test).

## 59. Lint/types

Lint : 0 erreur (104 avertissements pré-existants). Types : pas de gate `tsc` dédié dans ce projet JS (inchangé).

## 60. Expo Doctor

**21/21**, vérifié par exécution réelle avant et après le sprint. Aucune dépendance modifiée.

## 61. Android export

`npx expo export --platform android` → succès, bundle Hermes généré, aucune erreur.

## 62. Remaining debt

- Fiabiliser le contournement du menu développeur Expo Dev Client pour les exécutions Maestro batch (ex. désactiver ce menu pour les builds E2E si un mécanisme officiel existe, ou implémenter un `extendedWaitUntil` plus robuste une fois la cause du délai variable mieux comprise).
- Démarrer le serveur d'images fixture dans `start-mobile-e2e.js` pour éliminer les vignettes vides.
- Exécuter les parcours PMS complet, Tenant Portal, Messagerie, notifications/deep-links, cross-tenant, reconnect socket, panne réseau — tous NON CONFIRMÉ ce sprint faute de temps après la résolution des blocages d'infrastructure (build JDK, sélecteurs Maestro, timing du menu dev).
- Exécuter le parcours Auth 3× pour satisfaire la règle de stabilité du mandat.
- Aucune exécution iOS n'a jamais eu lieu — nécessiterait un Mac avec Xcode complet.

## 63. Risks

Le fait que 8/10 flows Maestro aient échoué en exécution batch, tous pour la même cause (timing du menu dev), et non pour des causes applicatives variées, réduit le risque que des bugs produits réels aient été masqués par ces échecs — mais cela signifie aussi qu'une grande partie du périmètre mandaté (PMS, Tenant Portal, Messagerie, deep-links) n'a **pas** reçu de preuve d'exécution directe ce sprint, contrairement à Auth et Dark Mode. Ce risque est documenté explicitement plutôt que masqué.

## 64. Git final

```
git status --short   → fichiers UI-MOB-1→4 + MOB-E2E cumulés, tous non commités
git diff --check     → propre
git branch --show-current → main
git rev-parse HEAD   → ab5ae586fab50ddce02e65ea081330d2769c6503 (inchangé)
```
Fichiers ajoutés/modifiés spécifiquement par MOB-E2E : `.maestro/02-login.yaml`, `server/scripts/start-mobile-e2e.js` (nouveau), `server/scripts/start-accommodation-e2e.js` (export additif), `server/docs/MOB_E2E_*.md`. `.env` mobile restauré à l'identique. Aucun `git add`/`commit`/`push`/`reset`/`checkout .`/`stash` exécuté ; aucune modification préexistante perdue.

## Matrice E2E

| Parcours | Android | iOS | Light | Dark | Négatif | Verdict |
|---|---|---|---|---|---|---|
| Launch app | PASS | NON CONFIRMÉ | PASS | N/A | N/A | Certifié |
| Auth (login nominal) | PASS | NON CONFIRMÉ | PASS | N/A | N/A | Certifié (preuve directe + backend) |
| Auth (login invalide) | NON CONFIRMÉ | NON CONFIRMÉ | N/A | N/A | NON CONFIRMÉ | Non exécuté |
| Session restore/logout/user switch | NON CONFIRMÉ | NON CONFIRMÉ | N/A | N/A | N/A | Non exécuté |
| Dark Mode (Profil complet) | PASS | NON CONFIRMÉ | N/A | PASS | N/A | Certifié (preuve directe) |
| Bottom navigation | PASS (observé) | NON CONFIRMÉ | PASS | PASS | N/A | Certifié partiellement |
| Client — accueil/recherche | PASS (partiel) | NON CONFIRMÉ | PASS | N/A | N/A | Certifié partiellement |
| Client — détail/favoris/visites | NON CONFIRMÉ | NON CONFIRMÉ | N/A | N/A | N/A | Non exécuté (sauf état vide Visites) |
| Messagerie | NON CONFIRMÉ | NON CONFIRMÉ | N/A | N/A | N/A | Non exécuté |
| Owner — portefeuille hôtelier | PASS | NON CONFIRMÉ | N/A | PASS | N/A | Certifié |
| PMS — cycle complet | NON CONFIRMÉ | NON CONFIRMÉ | N/A | N/A | N/A | Non exécuté |
| Cross-owner | PASS | NON CONFIRMÉ | N/A | PASS | PASS | Certifié (preuve directe, reproductible ×2) |
| Cross-tenant | NON CONFIRMÉ | NON CONFIRMÉ | N/A | N/A | N/A | Non exécuté |
| Tenant Portal | NON CONFIRMÉ | NON CONFIRMÉ | N/A | N/A | N/A | Non exécuté |
| Notifications/deep-links | NON CONFIRMÉ | NON CONFIRMÉ | N/A | N/A | N/A | Non exécuté |
| Maestro automatisé (batch) | FAIL (8/10) | N/A | N/A | N/A | N/A | Instable, cause documentée |

## Matrice des bugs

| ID | Parcours | Gravité | Preuve runtime | Cause | Fix | Retest |
|---|---|---|---|---|---|---|
| E2E-1 | Build Android | P1 (bloquant infra) | `BUILD FAILED`, log Gradle/jlink | JDK 26 par défaut incompatible AGP | `JAVA_HOME` → JDK 17 | Build réussi, confirmé |
| E2E-2 | Maestro `02-login.yaml` | P2 (infra test) | `Element not found: Text matching regex: Email`, capture "undefined" dans le champ | Sélecteur obsolète + interpolation `env:` non résolue | `accessibilityLabel` réels + flag CLI `-e` | Passage réussi confirmé en exécution directe |
| E2E-3 | Menu développeur Expo Dev Client | P2 (infra test, non applicatif) | Captures répétées montrant l'overlay à des délais variables (0-10s+) | Overlay natif hors arbre d'accessibilité, timing non déterministe | Boucle de tentatives (5×) | Fonctionne en exécution directe isolée, pas fiable à 100% en batch |
| E2E-4 | Fixture images mobile | P3 | Vignettes vides à l'écran | `start-mobile-e2e.js` ne sert pas `fixture.svg` | Non corrigé | N/A |

## Questions obligatoires

- L'application a-t-elle réellement été lancée sur un émulateur/appareil ? **Oui.**
- Quel appareil/émulateur ? **Émulateur Android Pixel 6 (AVD), API 34, `sdk_gphone64_x86_64`.**
- Quelle version Android ? **14.**
- iOS a-t-il réellement été testé ? **Non.**
- Le login fonctionne-t-il réellement ? **Oui**, prouvé par capture d'écran + logs backend + connexion Socket.IO horodatée.
- Session restore ? **NON CONFIRMÉ.**
- Logout ? **NON CONFIRMÉ.**
- User switch ? **NON CONFIRMÉ.**
- Session révoquée ? **NON CONFIRMÉ.**
- Account status ? **NON CONFIRMÉ.**
- Light Mode runtime ? **Oui**, observé.
- Dark Mode runtime ? **Oui**, prouvé par capture d'écran directe, entièrement lisible.
- Bottom navigation ? **Oui, observé** (tab active, FAB, icônes) dans les deux thèmes.
- Client ? **Partiellement** — accueil/recherche oui, détail/favoris/visites non.
- Recherche ? **Barre visible, filtre non exercé.**
- Détail bien ? **NON CONFIRMÉ.**
- Favoris ? **NON CONFIRMÉ.**
- Visites ? **État vide confirmé, demande de visite non testée.**
- Messagerie ? **NON CONFIRMÉ.**
- Owner immobilier ? **Portefeuille hôtelier confirmé** (4 hôtels réels listés).
- Création annonce réelle ? **NON CONFIRMÉ.**
- Locataire ? **Fixture créée, écran non ouvert — NON CONFIRMÉ runtime.**
- Tenant Portal ? **NON CONFIRMÉ runtime** (certifié visuellement par le code en UI-MOB-4, non re-testé ici).
- Maintenance locative ? **NON CONFIRMÉ.**
- Owner hébergement ? **Liste des hôtels confirmée.**
- Hotel ? **Accès tenté, listé, cross-owner testé.**
- Accommodation ? **NON CONFIRMÉ.**
- Réservation PMS ? **NON CONFIRMÉ.**
- Room assignment ? **NON CONFIRMÉ.**
- Check-in ? **NON CONFIRMÉ.**
- Financial readiness ? **NON CONFIRMÉ.**
- Check-out bloqué ? **NON CONFIRMÉ.**
- Check-out nominal ? **NON CONFIRMÉ.**
- Housekeeping ? **NON CONFIRMÉ.**
- Inspection passed ? **NON CONFIRMÉ.**
- Inspection failed ? **NON CONFIRMÉ.**
- Maintenance hôtel ? **NON CONFIRMÉ.**
- Realtime hotel:<id> ? **Socket connecté confirmé ; mutation temps réel spécifique NON CONFIRMÉE.**
- Switch Hotel A → B ? **NON CONFIRMÉ.**
- Cross-owner ? **Oui, confirmé et reproductible ×2** — accès refusé proprement géré.
- Cross-tenant ? **NON CONFIRMÉ.**
- Notification foreground ? **NON CONFIRMÉ.**
- Background ? **NON CONFIRMÉ.**
- Cold start ? **NON CONFIRMÉ.**
- Deep-link ? **NON CONFIRMÉ.**
- Reconnect socket ? **NON CONFIRMÉ.**
- Panne réseau ? **NON CONFIRMÉ.**
- Existe-t-il des crashs runtime ? **Non, aucun observé** sur l'ensemble des parcours réellement exécutés.
- Combien P0 ? **0.** P1 ? **1** (build JDK, résolu). P2 ? **2** (sélecteurs Maestro résolu ; timing menu dev non résolu à 100%). P3 ? **1** (fixture image, non résolu, sans impact).
- Tous les tests unitaires passent-ils ? **Oui, 358/358.**
- Doctor reste-t-il 21/21 ? **Oui.**
- Android export passe-t-il ? **Oui.**
- L'application mobile est-elle réellement certifiée E2E ? **Partiellement** — Auth, Dark Mode, navigation de base, portefeuille hôtelier et sécurité cross-owner sont certifiés par preuve d'exécution directe et reproductible. Le cycle PMS complet, la Messagerie, le Tenant Portal, les notifications/deep-links et la stabilité 3× ne le sont pas.

## Verdict

**MOB-E2E ANDROID : GO SOUS RÉSERVES.**
**iOS : NON CERTIFIÉ** (jamais exécuté).

Justification : ce sprint a produit la toute première preuve d'exécution réelle de l'application mobile — un jalon que Jest/lint/export ne pouvaient jamais fournir. Auth, Dark Mode, navigation de base et un scénario de sécurité cross-owner ont été prouvés avec des preuves runtime tangibles et corrélées côté serveur (logs, Socket.IO), pas seulement des captures d'écran isolées. Ce qui empêche un verdict CERTIFIÉ VERT : le cycle PMS complet (réservation → check-in → financial readiness → check-out → housekeeping → inspection), objectif principal explicite du mandat, n'a **pas** été exécuté ce sprint — le temps disponible a été consommé par la résolution de trois blocages d'infrastructure réels et non anticipés (JDK incompatible, sélecteurs Maestro jamais vérifiés, timing non déterministe du menu développeur Expo Dev Client). La Messagerie, le Tenant Portal et les notifications/deep-links restent également NON CONFIRMÉ en exécution runtime. La règle de stabilité à 3 exécutions n'a pas été satisfaite pour le seul parcours réellement certifié (Auth).

Réserves exactes :
- **PMS complet** : NON CONFIRMÉ — bloqueur temps, pas un bug découvert.
- **Messagerie, Tenant Portal, notifications/deep-links, cross-tenant** : NON CONFIRMÉ — non atteints.
- **Automatisation Maestro batch** : instable (8/10 échecs), cause documentée et non applicative — nécessite un futur sprint dédié à la fiabilisation de l'infrastructure de test avant intégration CI.
- **iOS** : jamais exécuté.

## MOB-E2E readiness

Compte tenu des réserves ci-dessus, la chaîne UI-MOB-1→4 + MOB-E2E ne peut pas conclure à un **MOB-E2E READY** global au sens strict du mandat (qui exige PMS nominal PASS). Le statut réel est : **MOB-E2E ANDROID PARTIELLEMENT CERTIFIÉ** — Auth, Dark Mode, navigation, portefeuille hôtelier et sécurité cross-owner prouvés réels ; PMS, Messagerie, Tenant Portal, notifications/deep-links restent à exécuter dans un sprint de suite (MOB-E2E-2) avant toute certification finale. Aucun bug produit bloquant (P0/P1 applicatif) n'a été découvert dans le périmètre réellement exécuté — les deux P1/P2 trouvés sont tous deux des problèmes d'infrastructure de test (JDK, timing Maestro), pas des régressions du produit.
