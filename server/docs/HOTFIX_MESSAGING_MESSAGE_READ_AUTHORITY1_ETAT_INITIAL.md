# HOTFIX-MESSAGING-MESSAGE-READ-AUTHORITY-1 — État initial

## Baseline git

- Branche : `main`
- HEAD : `a04055f62952c782b92aeef2f100824a17a5f645` (identique au HEAD connu des quatre mandats précédents)
- `git status --short` : 602 lignes — arbre de travail non propre, cumul de sprints antérieurs non commités. Non touché.
- `git diff --check` : 4 avertissements CRLF pré-existants (`conversationController.js`, `internalMailController.js`, `emailRoutes.js`, `messageRoutes.js`), identiques à l'état connu, aucun nouveau.

## Architecture — baseline canonique

```
Architecture files analyzed: 472
Internal static edges: 1531
Known legacy debt: service→controller: 2, controller→controller: 1, route→model: 12/11, controller→model: 192
known cycles: 0
Statically unresolved imports: 0
New violations: 0
Architecture boundaries: PASS
```
Identique à l'état final des quatre mandats précédents.

## Contexte certifié (rappel, tenu pour acquis)

`MESSAGING-MESSAGE-READ-AUTHORITY-ASSESSMENT-1` a conclu **AUDIT CERTIFIÉ — FIX REQUIRED** : `messageController.getMessages` (`GET /api/messages/:conversationId`) n'applique aucune vérification participant/staff-authority/ownership, uniquement une frontière tenant optionnelle (HF-FINAL-01). Reproduit en conditions réelles : Client non-participant lit une conversation privée d'autrui (contenu + identités exposés, `isRead` altéré) ; staff même tenant, non-participant, lit la conversation privée d'un collègue. Endpoint confirmé activement utilisé par `altimmo-app/src/screens/Messagerie/ChatScreen.jsx`. Sévérité P0.

## Portée de ce mandat

Fermer ce P0 par la correction la plus étroite possible, en réutilisant l'autorité canonique déjà présente dans le domaine Messaging (`assertConversationAccess` ou équivalent) si son contrat correspond exactement au besoin — sans inventer une nouvelle politique, sans toucher à la frontière tenant HF-FINAL-01, sans modifier RBAC, frontend, mobile ou schéma. Reproduction rouge **permanente** (suite conservée, pas supprimée). `errorMiddleware` (500 vs 404), HZ-08, HZ-09 restent explicitement hors périmètre.
