# INBOX-PRO-2 — Matrice des composants

| Composant | Statut | Fichier | Remplace |
|---|---|---|---|
| `InboxNavRail` | Créé | `client/lib/components/messaging/InboxNavRail.jsx` | Ancienne sidebar `w-64` labellisée (desktop uniquement) |
| `MobileFolderList` | Créé (inline, non partagé) | `InternalMessagingPage.jsx` | Ancienne sidebar `w-64` labellisée (mobile, étape 1/3) |
| `InboxToolbar` | Créé | `client/lib/components/messaging/InboxToolbar.jsx` | Recherche isolée + ajout filtres (nouveau) |
| `ConversationRow` | Créé (extraction) | `client/lib/components/messaging/ConversationRow.jsx` | `MessageItem` (inline) |
| `ConversationViewer` | Créé (inline, extraction + renommage) | `InternalMessagingPage.jsx` | `MessageDetail` (inline) |
| `AttachmentStrip` | Créé (extraction) | `client/lib/components/messaging/AttachmentStrip.jsx` | Bloc pièces jointes inline de `MessageDetail` |
| `ContactDrawer` | Créé (nouveau, aucun équivalent) | `client/lib/components/messaging/ContactDrawer.jsx` | — |
| `SafeHtmlEmailViewer` | **Réutilisé sans modification** | `client/lib/components/messaging/SafeHtmlEmailViewer.jsx` | (INBOX-PRO-1, inchangé) |
| `ComposeModal` | **Réutilisé, mécanisme inchangé** | `InternalMessagingPage.jsx` | (aucune reconstruction, mandat §19-20) |
| `ListSkeleton` | Créé (nouveau) | `InternalMessagingPage.jsx` | Spinner plein écran (mandat §29) |
| `IconButton` | Créé (petit utilitaire local) | `InternalMessagingPage.jsx` | Boutons d'action dupliqués dans l'ancien `MessageDetail` |

## Composants explicitement NON créés (mandat §43 : ne pas créer sans données)

- `MessageThread` — aucune donnée de thread dans `InternalMail` (pas de `threadId`/`inReplyTo`), voir `INBOX_PRO2_UX_AUDIT.md` §1.
- `ReplyComposer` inline — le mécanisme modal existant (`ComposeModal`) a été conservé tel quel (fonctionnel, mandat §19 ne demande pas une reconstruction sans nécessité).
