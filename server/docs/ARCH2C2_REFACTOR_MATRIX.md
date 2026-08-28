# ARCH-2C2 — Matrice de refactor

| Source | Ancien target | Symbole | Nouvelle abstraction | Consumer final | Baseline retirée |
|---|---|---|---|---|---|
| `controllers/conversationController.js` | `controllers/messageController.js` | `serializeMessage` | `services/messageSerializer.js` | `conversationController` | Oui |
| `controllers/messageController.js` | helper local | `serializeMessage` | `services/messageSerializer.js` | `messageController` | Sans objet |

L'export du helper depuis `messageController` a été supprimé. Aucun wrapper, duplicata ou require différé n'a été introduit.
