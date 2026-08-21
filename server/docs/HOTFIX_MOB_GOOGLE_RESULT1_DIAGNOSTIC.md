# HOTFIX-MOB-GOOGLE-RESULT-1 — Diagnostic

## Cause prouvée sur Samsung

Le résultat Google natif n'est pas perdu entre Android et JavaScript. Sur le Samsung SM-S918B, Login a produit la chaîne expurgée suivante :

1. bouton Login Google pressé ;
2. Play Services disponible ;
3. `signIn()` appelé ;
4. `signIn()` résolu, sans exception ;
5. résultat `type: success`, clés racine `data,type` ;
6. `data` présent avec les clés `idToken,scopes,serverAuthCode,user` ;
7. `user` présent, `idToken` présent, longueur 1086, `serverAuthCode` absent ;
8. résultat classé `success`, ID token extrait ;
9. `POST /auth/google` tenté ;
10. réponse backend HTTP 401 (`AxiosError`, `ERR_BAD_REQUEST`) ;
11. aucune session et aucune navigation finale.

Aucune valeur de token, identité, adresse email ou donnée personnelle n'a été journalisée.

## Contrat de la bibliothèque

La version installée `16.1.4` renvoie pour Original Google Sign-In :

- succès : `{ type: 'success', data: User }` ;
- annulation : `{ type: 'cancelled', data: null }` ;
- autre erreur native : rejet de la promesse.

Le code initial savait déjà lire `data.idToken` en succès, mais ne classait pas `type` et conservait un fallback historique `result.idToken`. Une annulation moderne était donc transformée en erreur « ID token absent ». Ce défaut secondaire est corrigé avec `isSuccessResponse` et `isCancelledResponse`; la forme historique racine est maintenant explicitement refusée.

## Pourquoi l'ancien diagnostic concluait « pas de backend »

`AuthContext.loginWithGoogle()` capture une erreur Axios backend, affiche l'alerte « Connexion Google échouée », puis retourne sans rejeter. Le caller ne pouvait donc pas distinguer succès et échec. L'alerte observée lors de la validation précédente venait précisément de cette branche. L'instrumentation DEV prouve maintenant l'appel et le HTTP 401.

## Frontière du hotfix

Google natif et parsing mobile sont PASS. Le blocage courant est la vérification backend du token. L'API mobile cible `https://altitude-vision.onrender.com/api`; seul l'environnement backend local avait été aligné lors du hotfix précédent, sans déploiement. La valeur réellement chargée par le backend distant est **NON CONFIRMÉE** et constitue le prochain diagnostic. Aucun changement backend n'est effectué ici.
