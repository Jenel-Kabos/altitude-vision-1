# HOTFIX-MOB-GOOGLE-SIGNIN-1 — Rapport

## Résultat

Le package et le certificat du binaire fautif sont établis. Le code utilise désormais une source de vérité `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`, injectée dans tous les profils EAS, et l'Alert production ne divulgue plus le code 10 ni l'URL technique. La correction déterminante du code 10 côté Console reste **NON CONFIRMÉE** faute d'accès Google/Firebase ; aucun nouveau build n'a donc été installé ou certifié.

## Réponses obligatoires

1. Package installé : `com.altitudevision.altimmo`.
2. `applicationId` du code : `com.altitudevision.altimmo`.
3. Identiques : oui.
4. Build installé : version 1.0.1, code 2, APK extrait du Samsung.
5. Type : `DEBUGGABLE`, cohérent avec debug/dev-client ; origine EAS exacte **NON CONFIRMÉE**.
6. SHA-1 réel : `5E:8F:16:06:2E:A3:CD:2C:4A:0D:54:78:76:BA:A6:F3:8C:AB:F6:25`.
7. SHA-1 attendu localement : le debug keystore et les APK locaux debug/release portent la même empreinte.
8. SHA-1 Google Console : **NON CONFIRMÉ**.
9. Client OAuth Android : un identifiant distinct est déclaré localement côté serveur (`…2pg8li6q`), mais son couple package/SHA-1 Console est **NON CONFIRMÉ**.
10. `webClientId` : client suffixé `…aac4eumo`, désormais fourni par `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`.
11. Type WEB : la séparation avec le client Android et la correspondance avec `GOOGLE_CLIENT_ID` serveur sont prouvées localement ; son type dans la Console est **NON CONFIRMÉ**.
12. `google-services.json` : absent, donc correspondance package **NON CONFIRMÉE**.
13. Cause exacte : mismatch Android OAuth/signature fortement circonscrit ; l'absence du SHA-1 en Console ne peut pas être déclarée confirmée sans accès Console. Package mismatch et usage du client Android comme `webClientId` sont exclus localement.
14. Correctif appliqué : source de vérité env du client WEB, injection EAS, service Google Sign-In testé et message production assaini. Action Console exacte documentée dans la matrice.
15. Reconstruction native : non, car la configuration Console préalable n'a pas pu être réalisée.
16. Nouvel APK installé : non.
17. Chooser Google : **NON CONFIRMÉ** après correction.
18. Disparition du code 10 : **NON CONFIRMÉE**.
19. Identité Google reçue : **NON CONFIRMÉE** sur device.
20. Requête backend : **NON CONFIRMÉE** sur device.
21. Session Altimmo : **NON CONFIRMÉE** sur device.
22. Login final : **NON CONFIRMÉ**.
23. Second bug backend : aucun constat ; non audité avant résolution native conformément au périmètre.
24. Secrets : aucun client secret OAuth embarqué/tracé. Les Client IDs OAuth publics ne sont pas des secrets.
25. UX : oui côté code ; code 10 et détails techniques restent dans les logs de développement uniquement.
26. Tests/gates : tests ciblés 7/7, suite complète 386/386, lint sans erreur, types verts, export Android vert, assemblage Gradle debug exécuté, `git diff --check` vert. Expo Doctor : 20/21, échec limité à huit patchs Expo 57 préexistants en retard.
27. Fichiers : service/tests Google, Login, Register, `eas.json`, trois documents de preuve.
28. Git : aucun add/commit/push/deploy.
29. Verdict : **GO SOUS RÉSERVES**, jamais `CERTIFIÉ VERT` sans Console + rebuild + test Samsung complet.

## Procédure de clôture device

1. Enregistrer le package et le SHA-1 exacts dans le client OAuth Android.
2. Mettre à jour `google-services.json` uniquement si le projet Firebase l'exige.
3. Reconstruire le profil réellement destiné au Samsung.
4. Vérifier la signature du nouvel APK avec `apksigner` avant installation.
5. Installer avec `adb install -r`, capturer un logcat expurgé et tester chooser, retour app, identité, requête backend, session et navigation.

## Gates

- Tests Google ciblés : **7/7 verts**.
- Tests mobiles complets : **45 suites, 386/386 verts** (des avertissements React `act(...)` préexistants sont émis).
- ESLint : **0 erreur**, 101 avertissements préexistants.
- TypeScript : **vert**.
- Export Expo Android : **vert**.
- Gradle `:app:assembleDebug` : exécuté sans erreur ; l'APK debug existant reste signé par le SHA-1 documenté. Comme un dev-client charge le bundle JS via Metro/updates, ce contrôle ne remplace pas un rebuild après modification Console/native.
- Expo Doctor : **20/21** ; huit dépendances Expo 57 ont un patch de retard. Aucun upgrade n'a été fait dans ce hotfix.
- `git diff --check` : **vert**.
- Test Samsung post-Console : **NON EFFECTUÉ**.
