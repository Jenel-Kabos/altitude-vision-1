# HOTFIX-MOB-GOOGLE-AUTH-4 — ROLLBACK

## Principe

Aucune modification de code n'est prévue par ce hotfix — le rollback ne concerne donc que des actions Google Cloud Console, jamais le dépôt.

## Rollback si la suppression de l'ancien client a été effectuée mais la création du nouveau échoue

Voir `HOTFIX_MOB_GOOGLE_AUTH4_MIGRATION_PROCEDURE.md`, étapes 20-22 : recréer, dans **My First Project**, un client Android avec le même package/SHA-1 notés avant suppression (étape 4 de la procédure). Cela restaure l'état antérieur — build EAS de nouveau capable de se connecter via l'ancien projet, mélange de projets toujours présent, mais aucune régression fonctionnelle par rapport à l'état précédent ce hotfix.

## Rollback si le nouveau client Android (Altitude Vision) a été créé mais provoque un comportement inattendu sur l'app

Peu probable — l'opération est additive du point de vue de l'application (aucune variable de code modifiée). Si un comportement anormal est néanmoins observé après la migration :

1. Supprimer uniquement le client Android nouvellement créé sous **Altitude Vision** (`Altimmo Android EAS`).
2. Recréer un client Android sous **My First Project** avec le même package/SHA-1 (voir étape 4 de la procédure pour les valeurs exactes à réutiliser) si un retour rapide à un état fonctionnel connu est nécessaire.
3. Aucun fichier du dépôt n'a été modifié à aucun moment — aucun rollback de code n'est nécessaire dans tous les cas.

## Rollback si une confusion de projet a eu lieu (client créé dans le mauvais projet)

Si l'étape 15 de la procédure (vérification du préfixe `872164120879-`) révèle que le nouveau client a été créé par erreur dans le mauvais projet (ex. encore dans "My First Project" faute d'avoir changé de sélecteur à l'étape 8) :

1. Supprimer le client mal placé immédiatement (il n'est de toute façon pas utilisable — mauvais projet).
2. Reprendre la procédure à partir de l'étape 8 (changement de projet), en vérifiant explicitement le sélecteur de projet Google Cloud Console avant de cliquer "Créer des identifiants".

## Ce qui ne nécessite jamais de rollback

- `webClientId` (mobile), `GOOGLE_CLIENT_ID` (backend), `GOOGLE_CLIENT_ID` (client Web) — non modifiés par cette migration, quel que soit son résultat.
- Le package Android, le SHA-1 du build, le keystore — non régénérés, non modifiés.
- `NEXTAUTH_URL`, `NEXTAUTH_API_SECRET` — non concernés, non touchés.
- RBAC-1→5, `businessProfiles`, `financialAuthorizationService`, `PlatformOperator` — non concernés par un changement de configuration OAuth Android, non touchés.

## Confirmation finale

Ce document n'a nécessité l'exécution d'aucune action au moment de sa rédaction — il documente les chemins de secours pour l'action humaine décrite dans `HOTFIX_MOB_GOOGLE_AUTH4_MIGRATION_PROCEDURE.md`, non encore exécutée à ce stade.
