# MESSAGING-MESSAGE-READ-AUTHORITY-ASSESSMENT-1 — Cause racine

## Classification (mandat §33)

**Check participant absent** — pas un middleware manquant au niveau routeur pour l'authentification (`protect` est bien présent), pas une route trop large au sens RBAC (aucun rôle n'est en cause), pas un bypass de service (il n'y a pas de couche service ici, la requête Mongo est directe dans le contrôleur). La fonction `messageController.getMessages` n'a **jamais** intégré de vérification d'appartenance à la conversation (`participants.includes`) ni de restriction d'autorité staff (`ALL_STAFF` + portée), contrairement à **toutes** les autres fonctions de lecture du même domaine (`getConversationById`, `getConversationMessages`, `getConversations`, `getMyInbox`, `getStaffInbox`, `downloadAttachment` — voir `_AUTHORITY_MODEL.md`).

## Pourquoi HF-FINAL-01 n'a pas fermé ce gap

HF-FINAL-01 a ajouté `requireTenantScopeForStaffOrPlatformOperator` sur cette route précise (`messageRoutes.js:51`) — un ajout **correct et nécessaire** pour fermer HF-FINAL-01 (contournement de la frontière **tenant** pour un staff ambigu), mais ce garde ne s'occupe et n'a jamais prétendu s'occuper que de « quel tenant ? », jamais de « quelle conversation précise cet utilisateur peut-il lire au sein de ce tenant ? ». Les deux frontières sont orthogonales : HF-FINAL-01 a fermé la première, jamais ouvert ni prétendu fermer la seconde — c'est exactement la distinction que ce mandat devait vérifier (voir bandeau final du mandat).

## Pourquoi ce n'est pas une "staff authority" légitime déjà voulue

Si le produit voulait qu'un staff tenant-wide puisse lire toute conversation de son tenant (une politique métier possible en soi), on s'attendrait à trouver cette même règle dans au moins une autre fonction du domaine. Or `assertConversationAccess` (utilisée par 4 fonctions sœurs) limite le staff à `isStaff || participant` — ce qui, combiné à la façon dont les conversations sont créées (`isStaffInbox` séparant explicitement « boîte partagée visible par tout staff » de « conversation 1-à-1 privée »), prouve que l'autorité staff voulue s'arrête à la boîte partagée et aux conversations dont le staff est réellement participant — **jamais** une conversation privée arbitraire d'un autre staff. `getMessages` dépasse ce contrat déjà établi, il ne l'applique pas simplement de façon plus permissive par choix : il ne l'applique pas du tout.

## Ce qui N'EST PAS la cause racine (écarté par preuve)

- **RBAC** : aucun rôle n'a de permission excessive documentée — le problème est l'absence totale de vérification, pas une permission mal calibrée.
- **Tenant** : HZ-02/HF-FINAL-01 restent corrects et non affectés — confirmé par la reproduction elle-même (le scénario 2 utilise un tenant correctement résolu et correspondant, la fuite se produit malgré cela).
- **HZ-08** : aucune conversation `unresolved`/legacy n'est impliquée dans la reproduction — les deux conversations de test sont des conversations normales, fraîchement créées, avec ou sans tenant explicite selon le scénario. HZ-08 n'est pas engagé par ce finding.
- **`errorMiddleware` (500 vs 404)** : non engagé — la requête réussit (200), il n'y a pas d'erreur à sérialiser dans le chemin vulnérable.

## Portée exacte du gap

Uniquement `messageController.js::getMessages` (`GET /api/messages/:conversationId`). Les fonctions voisines du même fichier (`sendMessage`, `markAsRead`, `deleteMessage`, `downloadAttachment`, `getConversations`) ont chacune au moins une vérification d'autorité réelle (ownership stricte pour `markAsRead`/`deleteMessage`, participant/tenant pour `downloadAttachment`, borne `sender/receiver===me` pour `getConversations`). `sendMessage` bénéficie désormais aussi de la garde HF-FINAL-01 pour la dimension tenant, mais n'a pas non plus de vérification participant explicite au-delà de la logique de routage staff/client déjà présente — **non ré-examiné en détail dans ce sprint**, car le mandat cible spécifiquement `getMessages` (lecture) ; noté ici pour référence future, `NON CONFIRMÉ` comme identique ou différent.
