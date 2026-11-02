# Plan de livraison mobile

État source : Expo `~57.0.26`, version applicative `1.0.1`, runtime policy `appVersion`, Android `versionCode: 2`, EAS `appVersionSource: remote` et production `autoIncrement: true`.

Les changements sont JavaScript/React Native et n'ajoutent aucun module natif. Une OTA serait techniquement envisageable uniquement vers des binaires ayant le runtime `1.0.1`, mais elle n'est pas exécutée. Pour une certification complète et un retour arrière plus clair, la recommandation est un build interne puis un nouveau binaire `1.0.2`; laisser EAS auto-incrémenter les build numbers distants et ne pas modifier les identifiants `com.altitudevision.altimmo`.

Contrôles : `npm ci`, syntaxe, lint, type-check, tests ciblés, `expo-doctor`, export Android, device Android réel et build iOS interne. Vérifier la découverte, le statut « Bientôt disponible », la navigation, l'anonyme, le compte non autorisé et le testeur interne. Les secrets Google Maps/Services et la signature restent gérés par EAS, sans affichage.

Commandes préparatoires, à ne lancer qu'après autorisation :

```bash
cd altimmo-app
npm ci
npm run validate
npx expo-doctor
eas build --profile staging --platform android
eas build --profile production --platform all
```

Soumission Store et `eas update` restent interdites. Retour arrière OTA : repointer le channel vers une update certifiée compatible ; retour arrière Store : conserver le binaire précédent disponible selon les consoles.
