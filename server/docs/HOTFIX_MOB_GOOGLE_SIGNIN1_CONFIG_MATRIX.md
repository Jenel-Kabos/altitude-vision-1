# HOTFIX-MOB-GOOGLE-SIGNIN-1 — Matrice de configuration

| Build | Package | SHA-1 | Client OAuth Android package + SHA-1 | Résultat |
|---|---|---|---|---|
| APK installé Samsung, debug/dev-client 1.0.1 (2) | `com.altitudevision.altimmo` | `5E:8F:…:F6:25` | **NON CONFIRMÉ** dans la Console | Code 10 observé |
| APK debug local existant | `com.altitudevision.altimmo` | `5E:8F:…:F6:25` | **NON CONFIRMÉ** | Non testé |
| APK release local existant (signé debug) | `com.altitudevision.altimmo` | `5E:8F:…:F6:25` | **NON CONFIRMÉ** | Non testé |
| EAS development | `com.altitudevision.altimmo` | Certificat EAS **NON CONFIRMÉ** | **NON CONFIRMÉ** | Non testé |
| EAS preview/staging | `com.altitudevision.altimmo` | Certificat EAS **NON CONFIRMÉ** | **NON CONFIRMÉ** | Non testé |
| EAS production / Play | `com.altitudevision.altimmo` | Upload key et Play App Signing **NON CONFIRMÉS** | **NON CONFIRMÉ** | Non testé |

## Correspondances prouvées localement

| Élément | Valeur/état |
|---|---|
| Package Expo | `com.altitudevision.altimmo` |
| `applicationId` Gradle | `com.altitudevision.altimmo` |
| Package installé | `com.altitudevision.altimmo` |
| Client WEB utilisé | suffixe `…aac4eumo`, identique au `GOOGLE_CLIENT_ID` serveur |
| Client déclaré Android côté serveur | suffixe `…2pg8li6q`, distinct du WEB |
| `google-services.json` | absent ; correspondance impossible à vérifier |

## Action Console obligatoire

Dans Google Cloud Console ou Firebase Console, vérifier/créer un client OAuth **Android** avec exactement :

- package : `com.altitudevision.altimmo`
- SHA-1 : `5E:8F:16:06:2E:A3:CD:2C:4A:0D:54:78:76:BA:A6:F3:8C:AB:F6:25`

Conserver comme `webClientId` le client OAuth **Web application** du même projet (suffixe `…aac4eumo`). Ne pas placer le client Android dans `webClientId` et ne jamais embarquer de client secret.

Chaque certificat EAS/Play réellement utilisé doit disposer de son propre client OAuth Android avec le même package. Si Firebase gère cette configuration, télécharger ensuite le nouveau `google-services.json` et l'intégrer via le mécanisme secret EAS prévu, puis reconstruire nativement.
