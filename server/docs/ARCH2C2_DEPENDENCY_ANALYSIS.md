# ARCH-2C2 — Analyse de dépendance

| Élément | Preuve |
|---|---|
| Source | `controllers/conversationController.js`, import ligne 4 avant extraction |
| Cible | `controllers/messageController.js` |
| Symbole | `serializeMessage` |
| Callsites source | 1 : `messages.map(serializeMessage)` dans `getMessages` |
| Callsites cible | 2 : réponse de `sendMessage`, liste de `getMessages` |
| Entrée | Document-like possédant `toObject()`, lean/plain object ou objet JavaScript |
| Sortie | Copie top-level avec `attachments` normalisées |
| Effets secondaires | Aucun; ne mute pas le document source |
| DB | Aucune requête |
| Express | Aucun `req`, `res` ou `next` |
| Dépendance interne | `safePrivateDescriptor` de `secureStorageService` |

## Classification

**A + B + C : serializer/presenter/DTO mapper.** La fonction ne contient aucune règle métier, permission, résolution tenant ou handler HTTP. Elle préserve les champs top-level obtenus en amont et transforme uniquement les pièces jointes en représentation publique sécurisée.

## Temps réel

Le chemin Socket.IO de `sendMessage` émet le document `message` brut dans `{ conversationId, message }`; il n'appelle pas `serializeMessage`. Ce comportement préexistant n'est ni unifié ni changé dans ARCH-2C2. REST continue à utiliser le serializer canonique; Socket continue à utiliser son payload historique.
