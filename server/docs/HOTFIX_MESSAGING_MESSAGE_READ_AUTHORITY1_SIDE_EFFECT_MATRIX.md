# HOTFIX-MESSAGING-MESSAGE-READ-AUTHORITY-1 — Matrice des effets de bord

| Domaine | Requête refusée (403, avant toute lecture) | Requête autorisée (200, comportement historique) |
|---|---|---|
| Conversation (doc) | Aucune lecture de son contenu retournée au client HTTP ; `assertConversationAccess` s'exécute avant toute construction de payload | Inchangé — chargée normalement pour construire la réponse |
| Message (doc) | Aucun message renvoyé, aucune requête `Message.find` déclenchée après le refus (le throw a lieu avant) | Inchangé — liste des messages renvoyée via `messageSerializer`, comme avant le hotfix |
| `isRead` | **Reste inchangé** — vérifié explicitement par le test « effet de bord : isRead reste inchangé après une lecture refusée » (false avant/après) | **Inchangé** — bascule à `true` pour le destinataire légitime lisant sa conversation, comme avant le hotfix (test « effet de bord : isRead bascule à true ») |
| Notification | Aucune notification de lecture générée pour un accès refusé (le code de notification, s'il existe en aval, n'est jamais atteint) | Inchangé — comportement historique préservé (aucun changement de ce chemin de code) |
| Socket (temps réel) | Aucun évènement socket émis pour un accès refusé | Inchangé — comportement historique préservé (aucun changement de ce chemin) |
| Pièces jointes (attachments) | Aucune métadonnée ni URL d'attachment exposée pour un accès refusé | Inchangé — `downloadAttachment` conserve sa propre vérification d'ownership stricte préexistante, non modifiée par ce hotfix |
| Code HTTP | 403 (`ConversationAccessError`, reconnu par `errorMiddleware.js`) au lieu de 200 avec contenu privé (avant correctif) | 200, corps de réponse identique au format historique (`{status, data: {messages}}`) |
| Journalisation / logs | Pas de changement de comportement de logging introduit par ce hotfix | Inchangé |

## Confirmation par preuve de test (pas par lecture de code seule)

- Refus → `isRead` inchangé : `messageReadAuthority.mongo.integration.test.js`, describe "acteurs SANS autorité", test "effet de bord : isRead reste inchangé après une lecture refusée" — PASS après correctif (faisait partie des 4 tests rouges avant correctif).
- Autorisation → `isRead` bascule à `true` : même fichier, describe "acteurs AVEC autorité", test "effet de bord : isRead bascule à true..." — PASS avant ET après correctif (non affecté par le changement, comportement historique).
- Refus tenant croisé (test 9) → `Message.countDocuments({conversation: convTenantB._id, isRead: true})` reste à `0` — vérifié explicitement dans le test lui-même.
