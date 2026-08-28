# HOTFIX-MOB-GOOGLE-AUTH-2 — RAPPORT

**Verdict : GO SOUS RÉSERVES — validation Google Cloud Console et re-test device réel requis.**

Cause racine identifiée avec un haut niveau de confiance par preuve technique directe (extraction de certificats réelle, lecture seule) et confirmée par une comparaison de comportement entre deux builds réels fournie par l'utilisateur : le certificat de signature géré par EAS Cloud Build pour le profil `development` (SHA-1 `62:49:CC:78:71:E9:43:E4:2E:1E:C9:4C:69:40:CA:F2:2B:E9:26:D6`) n'est très vraisemblablement pas enregistré sur le client OAuth Android "Altimmo Android" dans Google Cloud Console — alors qu'un autre SHA-1 (build gradle local, `5E:8F:16:06:...`) l'est, expliquant pourquoi seul ce dernier fonctionne. **Aucune modification de code n'a été nécessaire ni appliquée** — le code était déjà correct, déjà correctement testé (17/17 tests préexistants, y compris deux tests nommés explicitement pour ce code d'erreur). La correction est entièrement une action Google Cloud Console, hors de portée de cette session.

## Réponses aux 38 questions du mandat

1. **Quelle bibliothèque Google mobile est réellement utilisée ?** `@react-native-google-signin/google-signin` (confirmé, seul import trouvé dans `src/`).
2. **Quel fichier déclenche Google Sign-In ?** `altimmo-app/src/services/googleSignIn.js` (`configureGoogleSignIn`, `signInWithGoogle`, `getGoogleIdToken`), appelé depuis `LoginScreen.jsx`/`RegisterScreen.jsx`.
3. **Quelle erreur réelle était masquée par le message générique ?** `error.code` = `'10'`/`'DEVELOPER_ERROR'` (code natif Google Sign-In Android), classifié explicitement dans `getGoogleSignInErrorMessage` — pas une erreur réseau ni backend.
4. **Quel Android package est réellement utilisé ?** `com.altitudevision.altimmo` — confirmé identique dans `app.config.js` et dans le binaire APK réel (`aapt2 dump badging`).
5. **Quel build a reproduit le problème ?** `build-1787511872437.apk`, généré par EAS (profil `development` de `eas.json`, `gradleCommand: :app:assembleDebug`, credentials distantes EAS). Confirmé par l'utilisateur : ce build échoue, le build gradle local fonctionne.
6. **Quel Android OAuth Client est utilisé ?** Non consulté directement (pas d'accès Google Cloud Console) — le client "Altimmo Android" mentionné dans le mandat est la cible logique, jamais référencé dans le code (son rôle est purement une vérification Google Play Services côté device, pas un identifiant manipulé par l'app).
7. **Quel Web OAuth Client est utilisé ?** `872164120879-fnllca3lavaintq499hr7rbjjvcrgj3k.apps.googleusercontent.com`, passé comme `webClientId` à `GoogleSignin.configure()` — confirmé dans `eas.json` (4 profils) et `environment.ts`.
8. **Pourquoi chacun est-il utilisé ?** Le client Web sert à obtenir un `idToken` vérifiable côté serveur (usage documenté de la librairie) ; le client Android (non référencé en code) sert uniquement à la vérification native SHA-1/package par Google Play Services avant l'émission du token.
9. **Quel SHA-1 signe le build fautif ?** `62:49:CC:78:71:E9:43:E4:2E:1E:C9:4C:69:40:CA:F2:2B:E9:26:D6` — extrait directement du fichier APK réel via `apksigner verify --print-certs` (lecture seule).
10. **Correspond-il au client Android Google ?** **NON CONFIRMÉ** — nécessite une vérification humaine dans Google Cloud Console, non accessible depuis cette session. La preuve indirecte (comportement observé) est cependant forte.
11. **Quel redirect URI est réellement généré ?** Non applicable — ce flux utilise le SDK natif `@react-native-google-signin/google-signin`, pas `expo-auth-session`/`expo-web-browser` (aucun redirect URI/deep link impliqué dans ce mécanisme).
12. **Quel scheme est réellement compilé ?** Non pertinent pour ce flux précis (voir Q11) — non audité pour ce hotfix.
13. **Quel token/code Google est obtenu ?** Un `idToken` (JWT Google), extrait de `response.data.idToken` — jamais atteint pour le build fautif puisque `GoogleSignin.signIn()` échoue avant.
14. **Quel endpoint backend le reçoit ?** `POST /auth/google` — jamais atteint pour le build fautif (confirmé par construction : l'erreur natif survient avant tout appel réseau).
15. **Quelle audience backend est vérifiée ?** `GOOGLE_CLIENT_ID` (+ `GOOGLE_CLIENT_ID_ANDROID`/`_IOS` si définies) — non modifiée, non atteinte dans le scénario fautif.
16. **Web et Android sont-ils correctement séparés ?** Oui, intentionnellement partagés au niveau de l'endpoint/audience backend (usage prévu de la librairie), mais avec une vérification native Android additionnelle (SHA-1/package) totalement absente du flux Web — les deux surfaces sont cohérentes, pas confondues.
17. **Variable EAS manquante ?** Non — `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` est bien présente dans les 4 profils `eas.json`. Le problème n'est pas une variable manquante mais une empreinte de certificat non enregistrée côté Google Cloud.
18. **Secret exposé côté mobile ?** Non — aucun secret n'a été introduit ni trouvé ; le SHA-1 documenté est une donnée publique par nature.
19. **Cause racine exacte ?** SHA-1 du certificat de signature EAS Cloud Build (profil `development`) non enregistré (vraisemblablement) sur le client OAuth Android "Altimmo Android" dans Google Cloud Console.
20. **Correctif exact ?** Ajouter l'empreinte `62:49:CC:78:71:E9:43:E4:2E:1E:C9:4C:69:40:CA:F2:2B:E9:26:D6` comme SHA-1 supplémentaire (pas un remplacement) sur ce client OAuth Android, dans Google Cloud Console — action humaine hors du dépôt de code.
21. **Nombre de fichiers production modifiés ?** **0** — aucune modification de code, la cause étant entièrement externe.
22. **RBAC intact ?** Oui — non concerné, non modifié.
23. **Tenant intact ?** Oui — non concerné.
24. **Web Google Auth intact ?** Oui — `HOTFIX-WEB-GOOGLE-AUTH-1`/`route.js`/`trustHost` non touchés.
25. **Email/password auth intact ?** Oui — non concerné, non modifié.
26. **Tests Google ciblés ?** Oui — 17/17 tests préexistants rejoués verts (`googleSignIn.test.js`), déjà exhaustifs pour ce code d'erreur précis.
27. **Tests mobile complets ?** Oui — 48/48 suites, 422/422 tests.
28. **Backend auth tests ?** Non rejoués spécifiquement — aucun fichier backend modifié, cause hors du périmètre backend (voir Q14/Q15).
29. **Lint ?** 0 erreur (116 warnings, baseline inchangée).
30. **Typecheck ?** 0 erreur.
31. **Expo export ?** Non exécuté dans cette session — aucun fichier de code modifié, gate non nécessaire pour une investigation pure documentation. **NON CONFIRMÉ** si requis strictement malgré l'absence de changement.
32. **Build Android réel ?** Non reconstruit — inutile, le correctif ne touche à aucune configuration native nécessitant un rebuild (mandat §14 : un changement Google Cloud Console ne requiert aucune reconstruction de l'app).
33. **Samsung réel testé ?** Oui pour le diagnostic (extraction de certificats en lecture seule sur l'APK connecté, `adb devices` confirmant `SM_S918B` connecté) — **mais la correction elle-même (ajout SHA-1) n'a pas pu être testée de bout en bout** faute d'accès Google Cloud Console dans cette session.
34. **git diff --check ?** exit 0.
35. **Commit ?** Aucun.
36. **Push ?** Aucun.
37. **Deploy ?** Aucun.
38. **Verdict ?** **GO SOUS RÉSERVES — validation Google Cloud Console requise.** La cause racine est identifiée avec un haut niveau de confiance (preuve technique directe + comparaison de comportement réelle entre deux builds), mais ne peut être déclarée `CERTIFIÉ VERT` tant que (a) l'enregistrement effectif du SHA-1 manquant dans Google Cloud Console n'est pas confirmé par un humain ayant accès à la console, et (b) une connexion Google réussie sur le build EAS n'a pas été revalidée après cette correction.

## Prochaine étape (hors code, action humaine)

1. Se connecter à Google Cloud Console → APIs & Services → Identifiants.
2. Ouvrir le client OAuth 2.0 **"Altimmo Android"**.
3. Ajouter l'empreinte SHA-1 `62:49:CC:78:71:E9:43:E4:2E:1E:C9:4C:69:40:CA:F2:2B:E9:26:D6` (garder l'empreinte existante).
4. Enregistrer, attendre quelques minutes.
5. Relancer "Continuer avec Google" sur le build EAS déjà installé sur le Samsung — **sans reconstruire l'app**.
6. Confirmer : sélecteur de compte Google → retour dans l'app → JWT Altitude Vision obtenu → session active → `/me` fonctionne → navigation post-login correcte → fermeture/réouverture de l'app → session restaurée.

## STOP

Conformément au mandat : aucun changement de code effectué, aucune vérification Google désactivée, aucune audience élargie, RBAC/tenant/Web Google Auth/email-password intacts. Aucun commit/push/déploiement. Aucun autre chantier démarré. En attente de la vérification Google Cloud Console par l'utilisateur, puis d'un nouveau test device pour passer ce hotfix en `CERTIFIÉ VERT`.
