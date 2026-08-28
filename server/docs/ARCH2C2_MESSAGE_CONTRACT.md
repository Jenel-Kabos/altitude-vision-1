# ARCH-2C2 — Contrat Message observable

## Champs top-level

Le serializer n'applique pas de whitelist top-level : il conserve exactement la représentation produite par `toObject()` ou le plain object appelant. Pour un document `Message` actuel, les champs possibles sont :

- `_id`, `tenant`, `sender`, `receiver`, `conversation`;
- `subject`, `content`, `isRead`, `readAt`, `isStarred`;
- `attachments`;
- `createdAt`, `updatedAt`, `__v` si présent dans la représentation Mongoose.

Les champs optionnels absents restent absents. `attachments` absent devient `[]`. Aucun unread n'est recalculé : `isRead` et `readAt` sont préservés tels quels; `Conversation.unreadCount` n'entre pas dans le serializer.

## Sender/receiver/conversation

- ObjectId non-populated : conservé tel quel.
- Objet populated : conservé tel quel.
- Les requêtes REST concernées projettent explicitement `sender`/`receiver` sur `name email avatar` ou `name email photo`; aucun mot de passe, token, OAuth ou secret n'est chargé.
- Limite historique conservée : le serializer n'est pas un garde d'autorisation ni une seconde projection User. La confidentialité dépend de la projection appelante, comme avant.

## Pièce jointe privée

Les metadata ordinaires (`_id`, `type`, `nom`, `size`, `duration` si présents) sont conservées. `asset` et toute URL brute disparaissent. Le descripteur ajoute :

- `assetClass`, `purpose`, `mimeType`, `originalFilename`, `size`;
- `canPreview`, `canDownload`;
- `previewEndpoint`, `downloadEndpoint`.

Il n'expose pas `publicId`, `provider`, `version`, `deliveryType`, `resourceType` ou URL provider.

## Pièce jointe legacy

Les metadata sont conservées, l'URL est retirée, `legacy: true` est ajouté, ainsi que les deux endpoints. `canPreview` et `canDownload` reflètent strictement la présence de l'ancienne URL.

## HTML/email

Le modèle Message temps réel n'a pas de champ HTML. InternalMail et `SafeHtmlEmailViewer` sont hors du chemin et inchangés.
