# INBOX-2 — MATRICE DES COMPOSANTS (mandat §2/§9/§11/§14)

Version consolidée de `INBOX2_COMPONENT_INVENTORY.md`, avec l'état d'audit explicite par composant demandé par ce mandat.

| Composant | Rôle | État avant ce sprint | Modifié ? | Accessible/responsive/dark confirmé |
|---|---|---|---|---|
| `InternalMessagingPage` | Conteneur, state, data-fetching | Déjà mature | Non | Oui (capture réelle) |
| `InboxNavRail` | Navigation desktop | Déjà professionnel | Non | Oui |
| `MobileFolderList` (inline) | Navigation mobile (étape 1) | Déjà professionnel | Non | Oui |
| `InboxToolbar` | Recherche + filtres | Déjà professionnel | Non | Oui |
| `ConversationRow` | Ligne de liste | Déjà accessible (`<button>`, `aria-current`, `focus-visible`) | Non | Oui |
| `ConversationViewer` (inline) | Header + corps + actions | Déjà professionnel | Non | Oui |
| `SafeHtmlEmailViewer` | Rendu HTML sécurisé | Sandbox/DOMPurify déjà corrects ; dark mode interne manquant | **Oui — dark mode interne uniquement** | Oui (corrigé, revalidé) |
| `AttachmentStrip` | Liste des pièces jointes | Sécurité déjà correcte (SECURITY-2) ; icône générique unique | **Oui — icône par catégorie uniquement** | Oui |
| `SafeAttachmentPreview` | Modal d'aperçu sandboxé | Déjà correct (SECURITY-2) | Non | Oui (tests Chromium SECURITY-2 rejoués) |
| `ContactDrawer` | Panneau info expéditeur | Déjà présent | Non | Non ré-audité en détail (hors du chemin HTML/attachments, mandat §14 : "si présent, préserver") |
| `ComposeModal` (inline) | Composition de message | Déjà fonctionnel | Non | Non ré-audité (hors périmètre de ce sprint) |
| `ListSkeleton`/`IconButton` (inline) | Loading / boutons d'action | Déjà professionnel | Non | Oui |

## Nouveau fichier (présentation uniquement, pas de nouveau composant métier)

| Fichier | Rôle |
|---|---|
| `client/lib/utils/attachmentPresentation.js` | Classification par catégorie de fichier pour le choix d'icône — jamais consulté pour la sécurité |
