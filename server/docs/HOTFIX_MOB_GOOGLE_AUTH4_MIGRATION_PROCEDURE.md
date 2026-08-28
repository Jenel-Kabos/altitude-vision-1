# HOTFIX-MOB-GOOGLE-AUTH-4 — PROCÉDURE DE MIGRATION (ACTION HUMAINE REQUISE)

## Phase B — détermination de l'opération Google Cloud

**Contrainte confirmée** : l'utilisateur rapporte que Google Cloud refuse la création d'un nouveau client Android sous "Altitude Vision" avec le message "le nom du package Android et son empreinte sont déjà utilisés" — ce qui correspond exactement au comportement documenté de Google : le couple **(package, empreinte SHA-1)** doit être unique à travers l'ensemble des clients OAuth Android, tous projets Google Cloud confondus, pas seulement au sein d'un même projet. Cette contrainte n'est pas propre à ce projet ; c'est une règle générale de Google Identity Platform.

**Conséquence directe** : il n'existe **aucune procédure documentée permettant de "déplacer" un client OAuth existant d'un projet Google Cloud vers un autre** — un client OAuth appartient définitivement au projet dans lequel il a été créé. La seule voie possible pour libérer le couple (package, SHA-1) est donc :

**Procédure A (confirmée nécessaire, pas d'alternative connue) : supprimer l'ancien client Android dans "My First Project", puis créer immédiatement un nouveau client équivalent dans "Altitude Vision".**

Il n'existe pas de "Procédure B" alternative officiellement supportée par Google pour ce cas précis (contrairement à un transfert de projet Google Cloud entier, qui est un mécanisme différent et disproportionné pour ce besoin, non recommandé ici).

## Ce que cette procédure implique en termes de risque

Entre la suppression (étape 5) et la recréation (étape 8), il existe une **fenêtre de quelques minutes** pendant laquelle **aucun** client Android ne correspond au couple (package, SHA-1 EAS) dans **aucun** projet Google Cloud. Pendant cette fenêtre, toute tentative de connexion Google sur le build EAS échouerait avec `DEVELOPER_ERROR` — un état **temporaire et attendu**, pas une régression. Le client Web (Altitude Vision) et le client Android du build gradle local (déjà sous Altitude Vision, SHA-1 différent) ne sont **pas affectés** par cette fenêtre.

## Procédure numérotée exacte

### Avant de commencer

1. **Se placer dans le projet Google Cloud "My First Project"** (sélecteur de projet en haut de la Google Cloud Console).
2. Aller dans **APIs & Services → Identifiants**.
3. Repérer le client OAuth Android nommé **"altitudevision altimmo"**, préfixe `3869205293-…`.
4. **Ouvrir ce client et noter/copier avant toute suppression** :
   - Le **Client ID complet** (`3869205293-….apps.googleusercontent.com`) — à conserver dans une note personnelle, au cas où un rollback serait nécessaire.
   - Le **package** affiché (doit être `com.altitudevision.altimmo` — à vérifier, pas à supposer).
   - Le **SHA-1** affiché (doit être `62:49:CC:78:71:E9:43:E4:2E:1E:C9:4C:69:40:CA:F2:2B:E9:26:D6` — à vérifier, pas à supposer).
   - La **date de création** si affichée (utile pour confirmer qu'il s'agit bien du client créé lors du build EAS et non d'un autre client plus ancien).

### Client à ne jamais toucher pendant cette opération

5. **Ne pas toucher** au client **Web** utilisé par le backend/mobile (préfixe `872164120879-…`, projet Altitude Vision) — ni ses "Authorized JavaScript origins", ni ses "Authorized redirect URIs". Cette procédure ne concerne que le client **Android**.
6. **Ne pas toucher** au client Android d'Altitude Vision correspondant au SHA-1 du build gradle local (`5E:8F:16:06:2E:A3:CD:2C:4A:0D:54:78:76:BA:A6:F3:8C:AB:F6:25`), s'il existe déjà — c'est un client différent, avec un SHA-1 différent, qui n'entre pas en collision avec celui de l'étape 3.

### Suppression (client candidat)

7. Le client candidat à la suppression est **exclusivement** celui identifié à l'étape 3 : "altitudevision altimmo", `3869205293-…`, SHA-1 `62:49:CC:78:…`, dans le projet **My First Project**. Cliquer **Supprimer**. Confirmer.

### Changement de projet

8. **Immédiatement après la suppression confirmée**, changer de projet dans le sélecteur Google Cloud Console : passer de "My First Project" à **"Altitude Vision"**.

### Création du nouveau client

9. Dans "Altitude Vision" → **APIs & Services → Identifiants → Créer des identifiants → ID client OAuth**.
10. **Type d'application** : `Android`.
11. **Nom** : `Altimmo Android EAS` (recommandé — permet de le distinguer clairement du client Android du build local existant).
12. **Nom du package** : `com.altitudevision.altimmo` (copier-coller exact, sensible à la casse).
13. **Empreinte du certificat SHA-1** : `62:49:CC:78:71:E9:43:E4:2E:1E:C9:4C:69:40:CA:F2:2B:E9:26:D6` (copier-coller exact, avec ou sans les deux-points selon le format demandé par le formulaire — Google normalise généralement automatiquement).
14. Cliquer **Créer**.

### Vérification post-création

15. Confirmer que le **Client ID nouvellement généré commence bien par `872164120879-`** (préfixe du projet Altitude Vision) — si le préfixe est différent, la création a eu lieu dans le mauvais projet ; revérifier le sélecteur de projet à l'étape 8 avant de continuer.
16. Attendre **5 à 10 minutes** (propagation des changements Google Identity Platform — un délai plus court peut suffire mais n'est pas garanti).

## Si Google refuse encore le couple package/SHA-1 après suppression

17. Revenir dans **My First Project → Identifiants** et confirmer que le client supprimé à l'étape 7 n'apparaît plus dans la liste (une suppression Google Cloud est en principe immédiate, mais une actualisation de page peut être nécessaire pour le confirmer visuellement).
18. Si le client apparaît encore : attendre quelques minutes supplémentaires puis réessayer l'étape 9-14 — la suppression peut avoir un léger délai de propagation dans de rares cas.
19. Si le refus persiste après confirmation de suppression et attente : **ne pas insister par tâtonnement**. Documenter le message d'erreur exact affiché par Google Cloud Console et arrêter cette procédure — cela indiquerait un comportement Google non documenté nécessitant une investigation séparée (éventuellement via le support Google Cloud), hors du périmètre de ce hotfix.

## Procédure de rollback si la création échoue après suppression de l'ancien client

20. Si l'étape 9-14 échoue pour une raison quelconque après que la suppression de l'étape 7 a déjà été confirmée, **il n'est pas possible de restaurer automatiquement l'ancien client supprimé** — une suppression Google Cloud est définitive, sans corbeille.
21. Rollback possible : recréer, dans **My First Project**, un nouveau client Android avec le **même package et le même SHA-1** que ceux notés à l'étape 4 (nom au choix, par exemple "altitudevision altimmo (recréé)"). Cela restaure l'état fonctionnel antérieur (build EAS de nouveau capable de se connecter via My First Project), au prix de revenir à la situation de mélange de projets que ce hotfix cherche à corriger — un état temporaire acceptable en attendant une nouvelle tentative.
22. Dans tous les cas, **aucune modification de code n'est nécessaire pour ce rollback** — `webClientId` reste `872164120879-…` (Altitude Vision) quoi qu'il arrive côté client Android, conformément à `HOTFIX-MOB-GOOGLE-AUTH-3`.

## Ce qui n'est PAS modifié par cette procédure (rappel)

`NEXTAUTH_URL`, `NEXTAUTH_API_SECRET`, `GOOGLE_CLIENT_ID` (backend), `GOOGLE_CLIENT_ID_ANDROID` (backend — non consommé de façon vérifiée, voir `HOTFIX_MOB_GOOGLE_AUTH3_CLIENT_MATRIX.md`, ne pas y toucher sans preuve supplémentaire de consommation réelle), le package Android, le SHA-1 du build (aucune régénération de keystore), les "Authorized JavaScript Origins"/"redirect URIs" du client Web.

## STOP — action humaine requise

Cette procédure ne peut pas être exécutée par cette session (aucun accès à Google Cloud Console). **En attente de confirmation de l'utilisateur** que les étapes 1 à 16 ont été effectuées avant de passer à `HOTFIX_MOB_GOOGLE_AUTH4_POST_MIGRATION_TEST.md`.
