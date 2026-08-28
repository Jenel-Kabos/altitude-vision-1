# HOTFIX-MOB-GOOGLE-AUTH-3 — PLAN DE MIGRATION (PROPOSÉ, NON EXÉCUTÉ)

Ce document propose une procédure. **Rien de ce qui suit n'a été exécuté.** Aucun client OAuth n'a été supprimé, créé ou modifié ; aucune variable d'environnement n'a été changée ; aucun build n'a été relancé dans le cadre de cette proposition.

## Objectif de la migration

Faire converger **tous** les clients OAuth Android liés au package `com.altitudevision.altimmo` sous le projet **Altitude Vision** (`872164120879-…`), en supprimant le besoin du projet "My First Project" (`3869205293-…`) pour ce flux, sans jamais casser un chemin qui fonctionne actuellement.

## Client à conserver

Le **Web Client ID Altitude Vision** (`872164120879-fnllca3lavaintq499hr7rbjjvcrgj3k...`) — déjà utilisé partout (Web, backend local, mobile) depuis `ALIGN-1`, ne nécessite aucune action.

Le **client OAuth Android sous Altitude Vision** avec le SHA-1 local (`5E:8F:16:06…`), s'il existe et fonctionne effectivement (voir la nuance `NON CONFIRMÉ` sur son succès complet dans `HOTFIX_MOB_GOOGLE_AUTH3_AUTH_FLOW.md`) — à conserver, ne jamais supprimer avant d'avoir un remplaçant confirmé fonctionnel.

## Client à créer (pas à migrer — un client OAuth Android ne peut pas changer de projet)

Un **nouveau client OAuth Android**, dans le projet **Altitude Vision**, avec :
- Type : Android
- Nom : au choix (ex. "Altimmo Android — EAS development"), pour le distinguer clairement du client local existant
- Package : `com.altitudevision.altimmo`
- SHA-1 : `62:49:CC:78:71:E9:43:E4:2E:1E:C9:4C:69:40:CA:F2:2B:E9:26:D6`

**Il n'est pas possible de "déplacer" un client OAuth existant d'un projet Google Cloud à un autre** — Google ne propose pas cette opération. La seule voie est de créer un nouveau client équivalent dans le projet cible.

## Client à supprimer — pas pendant cette migration

Le client OAuth Android sous "My First Project" (SHA-1 `62:49:CC:78…`) **ne doit pas être supprimé** au moment de la création du nouveau client. Raisons :
1. Tant que le nouveau client (Altitude Vision) n'est pas confirmé fonctionnel par un test device réel, l'ancien reste le seul filet de sécurité en cas d'erreur d'enregistrement (mauvais SHA-1 recopié, mauvaise casse, etc.).
2. Rien ne prouve depuis le code que ce client n'est pas consommé par un autre build/canal non identifié dans ce dépôt (ex. un ancien build de test distribué en dehors d'EAS, un testeur externe).
3. La suppression d'un client OAuth Google est **immédiate et irréversible** (aucune corbeille) — à ne déclencher qu'après une période d'observation sans incident (recommandé : au moins un cycle de release complet, ou au minimum quelques jours après confirmation du nouveau client).

## Variables à modifier — aucune

Le `webClientId` (`EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`, mobile ET backend) reste **inchangé** (`872164120879-…`, Altitude Vision) — cette migration n'ajoute qu'un enregistrement Android côté Console, elle ne touche à aucune valeur consommée par le code. **Aucun fichier du dépôt n'a besoin d'être modifié pour cette migration.**

## Ordre des opérations proposé

1. Dans Google Cloud Console, sélectionner le projet **Altitude Vision**.
2. APIs & Services → Identifiants → Créer des identifiants → ID client OAuth → Type "Android".
3. Renseigner package `com.altitudevision.altimmo` et SHA-1 `62:49:CC:78:71:E9:43:E4:2E:1E:C9:4C:69:40:CA:F2:2B:E9:26:D6`.
4. Enregistrer. Attendre quelques minutes (propagation).
5. Sans reconstruire l'app, relancer "Continuer avec Google" sur le build EAS déjà installé (`build-1787511872437.apk` ou équivalent plus récent) sur un device réel.
6. Confirmer : sélecteur de compte → retour app → appel `POST /auth/google` observé → réponse 200/201 → session Altimmo créée → navigation post-login → fermeture/réouverture → session restaurée.
7. **Vérifier en parallèle** (indépendant de cette migration mais bloquant pour un succès complet) que `GOOGLE_CLIENT_ID` sur Render (production) est bien `872164120879-…` — voir `HOTFIX-BACK-GOOGLE-AUTH-401-1`, action encore non levée à ce jour.
8. Une fois le point 6 confirmé stable sur plusieurs jours/releases, envisager la suppression du client "My First Project" — dans un mandat séparé, avec sa propre preuve d'absence de consommateur restant.

## Nécessité d'un nouveau build EAS

**Non.** Un changement de client OAuth dans Google Cloud Console ne modifie ni le package, ni le certificat de signature, ni le `webClientId` embarqué dans le build — seule la table de correspondance côté Google est mise à jour. Le build EAS déjà installé sur le device peut être retesté sans reconstruction (cohérent avec la conclusion déjà posée par `HOTFIX-MOB-GOOGLE-SIGNIN-2`, point 12).

## Risque de coupure

**Nul pour les utilisateurs existants** si l'ordre ci-dessus est respecté : l'ajout d'un nouveau client Android n'affecte aucun flux déjà fonctionnel (le client "Altitude Vision" local existant n'est pas touché). Le risque n'existerait qu'en cas de suppression prématurée du client "My First Project" avant confirmation complète — explicitement déconseillée à l'étape 8 ci-dessus.

## Procédure de rollback

Si la création du nouveau client Android provoque un comportement inattendu (peu probable, l'opération est additive) :
1. Supprimer uniquement le client Android nouvellement créé sous Altitude Vision.
2. Aucune variable de code n'ayant été modifiée, aucun rollback de code n'est nécessaire.
3. Le comportement reviendrait exactement à l'état actuel (build EAS en échec `DEVELOPER_ERROR`, build local inchangé).

## Ce que cette migration ne fait PAS

- Ne modifie aucune règle RBAC, aucun contrat d'autorisation.
- Ne touche à aucun secret (le SHA-1 n'en est pas un).
- Ne nécessite aucune modification du code mobile ou backend.
- Ne résout pas, à elle seule, la question ouverte du `GOOGLE_CLIENT_ID` de production sur Render (`HOTFIX-BACK-GOOGLE-AUTH-401-1`) — un mandat distinct, déjà identifié, reste nécessaire pour lever cette réserve séparée.
