# HOTFIX-MOB-GOOGLE-SIGNIN-2 — Rapport

## Correctif requis

Dans Google Auth Platform, sélectionner explicitement le projet du Client ID WEB runtime (`3869205293-…`), puis vérifier/créer dans **ce même projet** un client de type Android avec :

- package : `com.altitudevision.altimmo`
- SHA-1 : `5E:8F:16:06:2E:A3:CD:2C:4A:0D:54:78:76:BA:A6:F3:8C:AB:F6:25`

Comparer ensuite l'égalité exacte du Client ID WEB Console avec la valeur runtime. Ne pas supprimer un client existant dans un autre projet avant d'avoir inventorié ses consommateurs. Aucun changement backend ou métier ne corrigera ce refus natif.

Cette action Console n'a pas été prétendue réalisée : aucune session Google Console n'était accessible depuis l'environnement. Après correction/propagation Google, redémarrer le flow et retester Samsung ; un rebuild n'est normalement pas nécessaire si seuls les objets OAuth Console changent et si package, certificat et `webClientId` restent identiques.

## Réponses obligatoires

1. Erreur exacte masquée : `DEVELOPER_ERROR`.
2. Code : `10`.
3. Moment : après lancement des activités Google Sign-In, avant succès natif et avant backend.
4. Chooser : aucune sélection de compte utilisable ; le flow se referme pendant la résolution OAuth.
5. SHA-1 du build actuellement installé : `5E:8F:16:06:2E:A3:CD:2C:4A:0D:54:78:76:BA:A6:F3:8C:AB:F6:25`.
6. Correspondance Console package/SHA-1 : oui selon le contexte fourni ; projet Console exact **NON CONFIRMÉ**.
7. Client WEB runtime : présent, longueur 70, préfixe `3869205293-…`, suffixe `….googleusercontent.com`; égalité Console indiquée par le contexte utilisateur.
8. Même projet Android/WEB : **non pour la paire réellement résolue par Google Play Services**, preuve native explicite. Les valeurs locales seules ne suffisent pas à contredire cette trace.
9. Audience : **NON CONFIRMÉE**.
10. Compte test : **NON CONFIRMÉ**, et non causal à ce stade pré-chooser.
11. Play Services : oui, version 26.30.32 ; `hasPlayServices()` réussit.
12. Cause finale : client Android package/SHA-1 absent ou non résolu dans le projet du Client ID WEB runtime.
13. Correction : action Console précise documentée ; diagnostic DEV sûr ajouté. Correction Console **NON EFFECTUÉE** faute d'accès.
14. Login Google : échec code 10 ; le même helper canonique est utilisé.
15. Signup Google : échec code 10 reproduit sur Samsung.
16. Backend : non appelé.
17. Session Altimmo : non créée.
18. Tests/gates : voir section ci-dessous.
19. Git : aucun commit/push/deploy.
20. Verdict : **GO SOUS RÉSERVES**.

## Tests et gates

- Tests ciblés Google Sign-In : **8/8 verts**.
- Suite mobile complète : **45 suites, 387/387 verts**.
- ESLint : **0 erreur**, 101 avertissements préexistants.
- TypeScript : **vert**.
- Export Android : **vert** ; variable Google chargée depuis `.env`.
- Build Gradle debug avec Java 17 : **BUILD SUCCESSFUL**.
- Expo Doctor : **20/21** ; 12 dépendances Expo 57 ont uniquement des patchs de retard, hors périmètre.
- `git diff --check` : **vert**.
- Test Samsung post-correction Console : **NON EFFECTUÉ**, puisque la correction Console reste à appliquer.
