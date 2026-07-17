# Plan de migration Expo

Le projet reste volontairement sur Expo SDK 52 / React Native 0.76 / React 18 pendant
cette stabilisation. La migration doit être isolée sur une branche dédiée.

| Package / zone | État actuel | Cible | Risque | Action |
| --- | --- | --- | --- | --- |
| Expo / React Native / React | 52 / 0.76 / 18.3 | SDK supporté récent | Très élevé | Migrer un SDK à la fois, doctor + build natif à chaque étape |
| Notifications | Expo 0.29 | Version du SDK cible | Élevé | Tester token, permissions, cold start et payload |
| Google Sign-In | 16.x | Compatible SDK cible | Élevé | Vérifier config plugins et clients Android/iOS |
| Maps | RN Maps 1.18 | Version validée Expo | Élevé | Tester nouvelle architecture et clés restreintes |
| Camera / Image Picker | Expo 16.x | Versions du SDK cible | Moyen | Tester permissions, média et métadonnées |
| Secure Store | Expo 14.x | Version du SDK cible | Élevé | Tester restauration/session/logout |
| Sentry | RN 6.10 | Version supportée | Élevé | Vérifier plugin, source maps et filtrage PII |
| Reanimated | 3.16 | Version du SDK cible | Élevé | Vérifier Babel et nouvelle architecture |
| WebView / File System / Document Picker | SDK 52 | Versions du SDK cible | Moyen | Tester fonctions natives et fichiers |
| expo-av | Déprécié à terme | Modules audio/vidéo modernes | Moyen | Inventorier l’usage avant remplacement |

Étapes: figer une baseline de tests, migrer SDK par SDK, appliquer `expo install --fix`
sur la branche dédiée, valider Android/iOS localement, puis seulement créer un build
preview EAS autorisé.

## Cible et étapes recommandées

La cible recommandée est le SDK stable le plus récent compatible avec les contraintes
des stores au moment où la branche de migration démarre. Au 17 juillet 2026, Expo 56
est documenté avec React Native 0.85, React 19.2.3, Android target/compile 36 et iOS
minimum 16.4. Une cible finale plus récente ne doit être retenue qu’après vérification
de sa stabilité et des bibliothèques natives.

1. Créer une branche et un tag de rollback depuis la baseline verte SDK 52.
2. Migrer vers chaque SDK intermédiaire supporté, sans sauter les migrations natives.
3. À chaque étape: `expo install --fix`, Expo Doctor, tests, export, build Android/iOS.
4. Tester notifications, Google Sign-In, Maps, caméra, Secure Store, Sentry, Socket.IO,
   Reanimated, WebView, fichiers et nouvelle architecture.
5. Comparer manifeste/Info.plist, permissions, deep links, taille et performances.
6. Revenir au tag de baseline si un module critique n’a pas de version compatible.

Critères de réussite: zéro erreur Doctor/lint/typecheck/test, deux builds preview,
authentification et session persistante, push foreground/background/cold start,
Socket reconnexion/rooms, deep links, permissions refusées, uploads et absence de PII
dans Sentry.

## Vulnérabilités npm observées

| Package/chaîne | Sévérité | Runtime/dev | Expo 52 | Correctif proposé | Migration majeure |
| --- | --- | --- | --- | --- | --- |
| Expo CLI/config/metro/prebuild | Haute/modérée | Runtime/outillage embarqué | Affecté | Expo récent | Oui |
| `tar` / `cacache` | Haute | Chaîne Expo CLI | Affecté | Versions transitives récentes | Généralement oui |
| `@xmldom/xmldom` / plist | Haute | Config native | Affecté | Dépendance Expo récente | Oui |
| `ws` / engine.io-client | Haute | Socket transitif | Affecté | Mettre à jour Socket.IO compatible | À valider |
| `undici` / `form-data` | Haute | Expo CLI/réseau | Affecté | Versions transitives corrigées | Souvent liée à Expo |
| `postcss`, `ajv`, `uuid`, `js-yaml` | Modérée | Majoritairement outillage | Affecté | Expo/CLI récents | Souvent oui |
| `jest-expo` | Modérée | Dev | Affecté | Aligner avec le SDK cible | Oui |

`npm audit` rapporte 30 vulnérabilités au total et 29 avec `--omit=dev`.
`npm audit fix --force` reste interdit: les résolutions proposées entraînent notamment
une migration Expo majeure.
