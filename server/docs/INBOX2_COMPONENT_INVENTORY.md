# INBOX-2 — INVENTAIRE DES COMPOSANTS

Complète `INBOX_PRO2_COMPONENT_MATRIX.md` (déjà exhaustif sur l'origine/le remplacement de chaque composant) avec la responsabilité, la source de données et l'évaluation de réutilisabilité, telles que confirmées par lecture directe du code sur ce HEAD.

| Component | Responsibility | Data source | Current UX | Reusable |
|---|---|---|---|---|
| `InternalMessagingPage` | Conteneur racine, state (dossier actif, message sélectionné, recherche/filtre), orchestration data-fetching | `messageService.js` (`getReceivedMessages`/`getSentMessages`/etc.), `userService.js` | Déjà mature (loading/empty/error, mono-écran mobile) | Oui — inchangé par ce sprint |
| `InboxNavRail` | Navigation desktop entre dossiers | Props (`activeView`, `unreadCount`) | Rail compact, icônes + badges | Oui — inchangé |
| `MobileFolderList` (inline) | Navigation mobile entre dossiers (étape 1/3) | Props | Liste labellisée, cohérente avec `InboxNavRail` | Oui — inchangé |
| `InboxToolbar` | Titre de dossier, recherche, filtre, rafraîchir | Props | Compact, `Rechercher dans ce dossier...` | Oui — inchangé |
| `ConversationRow` | Une ligne de la liste | Props (`message`) | `<button>` réel, `aria-current`, hiérarchie lu/non-lu déjà correcte | Oui — inchangé |
| `ConversationViewer` (inline) | En-tête + corps + actions du message sélectionné | Props (`message`) | Header avec avatar/expéditeur/date/priorité, actions étoile/suppression | Oui — inchangé |
| `SafeHtmlEmailViewer` | Rendu sécurisé du corps HTML/texte | Props (`html`, `text`) | DOMPurify + iframe sandbox (SECURITY-2) | **Modifié cette session** — dark mode interne uniquement, sandbox/sanitize intacts |
| `AttachmentStrip` | Liste des pièces jointes du message sélectionné | Props (`attachments`) | Icône/nom/taille/voir/télécharger (SECURITY-2) | **Modifié cette session** — icône par catégorie présentationnelle uniquement, logique de sécurité intacte |
| `SafeAttachmentPreview` | Modal d'aperçu sandboxé pour pièces jointes actives | Props | Sandboxé, DOMPurify (SECURITY-2) | Oui — inchangé |
| `ContactDrawer` | Panneau info expéditeur escamotable | Props (`message`) | Drawer latéral | Oui — inchangé, non audité en détail (hors du chemin HTML/attachments) |
| `ComposeModal` (inline) | Composition/édition de message | `userService.js`, `messageService.js` | Formulaire complet (interne/externe, pièces jointes, priorité, brouillon) | Oui — inchangé |
| `ListSkeleton` (inline) | État de chargement de la liste | — | 8 lignes animées | Oui — inchangé |
| `IconButton` (inline) | Bouton d'action à icône dans le header | Props | Tons sémantiques (green/red/amber/gray) | Oui — inchangé |

## Nouveaux fichiers créés par ce sprint

| Fichier | Rôle |
|---|---|
| `client/lib/utils/attachmentPresentation.js` | Classification présentationnelle (icône) par catégorie de fichier — **distincte** de `attachmentSecurity.js` (sécurité, non modifiée), mandat §22 |
