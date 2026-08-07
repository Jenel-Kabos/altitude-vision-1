# TECH-EXPO-1 — Migration contrôlée Expo SDK 52 → 57

Date : 2026-08-06.

## Périmètre et audit initial

La migration est exclusivement technique. Aucun endpoint, modèle MongoDB, règle métier, écran fonctionnel Web, CRM, Gestion locative ou workflow documentaire n'a été modifié.

État initial : Expo 52.0.49, React Native 0.76.9, React 18.3.1, Reanimated 3.16, Hermes, New Architecture activée dans `app.config.js`. L'application utilise React Navigation 6 sans Expo Router. Les projets `android/` et `ios/` sont des sorties de prebuild ignorées par Git ; les copies SDK 52 ont été préservées sous `/private/tmp/tech-expo-1-native-sdk52` avant régénération.

Modules natifs audités : AsyncStorage, DateTimePicker, Google Sign-In, Sentry, Camera, ImagePicker, DocumentPicker, FileSystem, SecureStore, Notifications, Location, Maps, Sharing, WebView, Reanimated/Gesture Handler, Expo Updates, audio et vidéo. Aucun NativeWind n'est installé ; Tailwind n'est pas utilisé par l'application Mobile.

Contraintes officielles SDK 57 : React Native 0.86, React 19.2.3, Node 22.13 minimum, Android 7+/API compile et target 36, iOS 16.4+ et Xcode 26.4+. Le poste utilise Node 24.15, mais ne possède pas Xcode complet.

## Migration réalisée

La migration a suivi les paliers 53, 54, 55, 56 puis 57, avec `expo install --fix` et contrôle de compatibilité à chaque palier. Cible obtenue :

- Expo 57.0.10 ;
- React Native 0.86.2 ;
- React 19.2.3 ;
- Reanimated 4.5.1 et `react-native-worklets` ;
- Jest Expo 57.0.3, React Native Jest Preset 0.86.2 et TypeScript 6.0.3 ;
- packages Expo alignés sur leur version recommandée SDK 57.

Les autres bibliothèques ont été conservées lorsqu'Expo ne demandait pas d'évolution, notamment React Navigation 6, Google Sign-In 16, React Native Paper, Socket.IO, Axios, date-fns, le slider, le modal et Supercluster.

## Breaking changes et corrections

- `expo-av` a été retiré et remplacé par `expo-video` et `expo-audio`. Un composant technique `VideoPlayer` centralise le cycle de vie du player, les contrôles, le mode cover/contain, mute, loop et play/pause. La messagerie utilise le hook audio natif moderne.
- Depuis SDK 54, l'API FileSystem historique n'est plus l'export par défaut. Les deux services de téléchargement sécurisé importent explicitement `expo-file-system/legacy`, ce qui conserve le comportement métier et permet une migration ultérieure indépendante vers `File`/`Directory`.
- Le handler de notification utilise `shouldShowBanner` et `shouldShowList` à la place de `shouldShowAlert`, déprécié.
- Les config plugins désormais requis ont été déclarés dans la configuration dynamique : asset, image, sharing, status bar, web browser, vidéo et audio.
- React 19 active de nouveaux diagnostics React Compiler via ESLint. Les quatre diagnostics impliquant des refactorings fonctionnels globaux restent désactivés ; les règles historiques `rules-of-hooks` et `exhaustive-deps` demeurent actives.
- Jest Expo 57 exige `@react-native/jest-preset`. Testing Library a été alignée en 13.3 afin de conserver l'API synchrone des 24 suites existantes, et les mocks FileSystem/Image ont été adaptés.
- npm tente de résoudre le peer optionnel Windows du DateTimePicker malgré une cible Android/iOS. Les installations ont utilisé `--legacy-peer-deps` uniquement pour ne pas installer `react-native-windows`; Expo Doctor et `expo install --check` valident les versions runtime prescrites.

## Navigation, deep links et notifications

L'architecture NAV-CORE n'a pas changé. `app.config.js`, React Navigation, les notifications et les écrans continuent de lire `shared/navigation/registry.json`.

- schéma : `altimmo://` ;
- Universal Links/App Links : `https://altitudevision.agency` ;
- 41 destinations enregistrées ;
- 25 chemins deep link ;
- aucun chemin dupliqué ;
- résolution de notification toujours effectuée par `resolveNotificationMobileTarget` avant les fallbacks legacy.

## Sécurité des dépendances

Avant TECH-EXPO-1, l'audit de production Mobile recensait 25 vulnérabilités : 1 critique, 6 hautes et 18 modérées. Après migration, `npm audit --omit=dev` recense 14 vulnérabilités modérées, aucune haute et aucune critique. La vulnérabilité critique `tar` identifiée par PREP-1 est donc éliminée.

Les alertes modérées restantes appartiennent notamment aux chaînes Expo CLI/config/Metro, DateTimePicker, Google Sign-In, Sentry, Sharing, UUID et Xcode. Elles ne disposent pas toutes d'un correctif compatible automatique ; aucun `npm audit fix --force` n'a été exécuté.

## Gates réellement exécutées

| Gate | Résultat |
| --- | --- |
| Expo dependency check | PASS — dépendances SDK 57 alignées |
| Expo Doctor | PASS — 20/20 |
| TypeScript Mobile | PASS — aucune erreur |
| ESLint Mobile | PASS — 0 erreur, 81 avertissements existants |
| Jest Mobile | PASS — 24 suites, 227 tests |
| Export Android | PASS — 2 239 modules, bundle Hermes 6,3 MB |
| Vérification NAV-CORE/deep links | PASS — 41 destinations, 25 chemins, aucun doublon |
| Vérification notifications | PASS — tests Jest et API SDK 57 adaptées |
| Build Android release | PASS — `assembleRelease`, API 36, Hermes, 4 ABI, 1 253 tâches, 16 min 28 s |
| Build iOS | NON EXÉCUTABLE localement — Xcode complet absent |
| `git diff --check` | PASS final |

Artefact Android local : `android/app/build/outputs/apk/release/app-release.apk` (142 MB, APK universel). L'upload automatique des sourcemaps Sentry a été désactivé pour le build local, faute de jeton CI ; la collecte locale des modules Sentry a bien été exécutée. L'upload reste à valider dans la CI disposant de `SENTRY_AUTH_TOKEN`.

## Risques et dettes

- Tester sur appareils physiques les notifications foreground/background/cold start, Google Sign-In, Maps, caméra, galerie, géolocalisation, partage, téléchargement, SecureStore, audio/vidéo et App/Universal Links.
- Produire un build iOS sur Xcode 26.4+ ou EAS, puis tester iOS 16.4 minimum.
- Valider l'upload des sourcemaps Sentry dans la CI authentifiée ; ce contrôle ne peut pas être certifié depuis le poste local sans secret.
- Migrer FileSystem `/legacy` vers l'API objet dans un sprint technique séparé.
- Les avertissements `act(...)` de quelques tests de publication sous React 19 n'échouent pas les suites mais doivent être nettoyés.
- Les projets natifs générés restent ignorés par Git conformément à l'organisation existante ; les builds doivent toujours partir de `app.config.js` et du lockfile.

## Fichiers TECH-EXPO-1

Créés :

- `src/components/VideoPlayer.jsx`
- `docs/TECH_EXPO_1_REPORT.md`

Modifiés :

- `.eslintrc.js`
- `app.config.js`
- `package.json`
- `package-lock.json`
- `src/screens/Annonces/DetailAnnonceScreen.jsx`
- `src/screens/Messagerie/ChatScreen.jsx`
- `src/screens/Publication/PublierBienScreen.jsx`
- `src/services/accommodationReservationService.js`
- `src/services/tenantPortalService.js`
- `src/services/notificationsService.js`
- `src/services/__tests__/accommodationReservationService.test.js`
- `src/services/__tests__/tenantPortalService.test.js`
- `src/test/setup.js`

Codex n'a exécuté aucun commit, aucun push, aucune migration destructive et aucune suppression de données. Pendant l'exécution du build, un processus externe à cette mission a créé le commit `58e4441` (`Update Altimmo 11`, 2026-08-06 09:28:37 +0100), qui inclut les fichiers TECH-EXPO-1 ainsi que des travaux CRM/PREP préexistants. L'historique n'a pas été réécrit et ce commit externe n'a pas été poussé par Codex.
