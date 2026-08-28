# INBOX-1 — AUDIT FRONTEND

## Page réelle

`/dashboard/messages` → `client/app/dashboard/messages/page.jsx` (wrapper trivial) → `client/lib/pages/dashboard/InternalMessagingPage.jsx` (792 lignes, `"use client"`).

**Piège de nommage à documenter** : `client/app/dashboard/emails/page.jsx` → `ManageEmailsPage.jsx` est un **écran CRUD différent** (gestion des adresses d'envoi `@altitudevision.agency`, config/toggle/notifications) — ce n'est PAS un lecteur d'email, ne pas le confondre dans une future roadmap malgré le nom proche.

## Arbre de composants réel

```
InternalMessagingPage.jsx (792 lignes — data-fetching + state + logique + rendu, tout confondu)
 ├─ InboxNavRail.jsx (68 lignes) — navigation dossiers
 ├─ InboxToolbar.jsx (62 lignes) — recherche/actions
 ├─ ConversationList.jsx (102 lignes)
 │   └─ ConversationRow.jsx (74 lignes)
 ├─ ConversationViewer — DÉFINI INLINE dans InternalMessagingPage.jsx (lignes 461-530), pas un fichier séparé
 │   ├─ SafeHtmlEmailViewer.jsx (151 lignes) — rendu HTML sécurisé
 │   └─ AttachmentStrip.jsx (68 lignes) — chips de pièces jointes
 └─ ContactDrawer.jsx (100 lignes) — panneau info expéditeur
```

Fichiers `ChatWindow.jsx`/`MessageBubble.jsx`/`MessageInput.jsx` (`lib/components/messaging/`) existent mais ne sont **pas câblés** sur `/dashboard/messages` — UI de chat séparée, hors périmètre.

## Composant monolithique — candidat principal d'extraction

`InternalMessagingPage.jsx` (792 lignes) mélange : 13 fonctions de service importées directement et appelées dans le composant (`sendInternalMail`, `getReceivedMessages`, `markAsRead`, `addStar`, `moveToTrash`, etc.), tout le state de dossier/sélection/composition, ET la logique de rendu du lecteur (`ConversationViewer`, 70 lignes inline) plus des sous-composants utilitaires inline (`ListSkeleton`, `IconButton`). **Candidat principal d'extraction pour INBOX-2** : sortir `ConversationViewer` dans son propre fichier (il a déjà ses dépendances externalisées, `SafeHtmlEmailViewer`/`AttachmentStrip`, seul le conteneur ne l'est pas), et extraire la couche data-fetching dans un hook dédié (`useInternalMailbox` ou équivalent) pour alléger le composant de page.

`ManageEmailsPage.jsx` (424 lignes, écran séparé) présente le même schéma (fetch+CRUD+modal en un seul fichier) — même remarque, mais hors périmètre boîte de réception.

## Rendu HTML — déjà sécurisé (voir `INBOX1_SECURITY_MATRIX.md` pour le détail complet)

`SafeHtmlEmailViewer.jsx` : DOMPurify (v3.4.8, seule bibliothèque de sanitization installée dans `client/package.json`) + rendu dans un `<iframe sandbox="allow-popups allow-popups-to-escape-sandbox">` sans `allow-scripts`/`allow-same-origin`. Aucun `dangerouslySetInnerHTML` contre le DOM du dashboard nulle part dans cette page. Déjà testé (`SafeHtmlEmailViewer.test.jsx`, cas `<script>`/`javascript:` couverts).

## Images distantes / tracking — non traité (confirmé)

Aucun blocage ni confirmation — les images distantes de l'email HTML (y compris d'éventuels pixels de suivi) se chargent automatiquement dans l'iframe sandboxée. Seule règle CSS trouvée : `img { max-width:100%; height:auto; }` (cosmétique, pas une protection de confidentialité).

## CID / images inline — confirmé totalement absent

`grep -rn "cid:"` sur tout `client/` : **zéro résultat**. Aucun mécanisme de résolution `cid:xxx` vers une pièce jointe. Cohérent avec le constat backend (`INBOX1_MIME_PIPELINE.md`) : le Content-ID n'est de toute façon jamais extrait/conservé côté serveur, donc même une résolution côté frontend n'aurait actuellement aucune donnée à consommer.

## Pièces jointes — liste sans aperçu

`AttachmentStrip.jsx` : chips avec icône générique (`ImageIcon` si `mimetype` commence par `image/`, sinon `FileText`), nom tronqué, taille formatée, boutons "Voir"/"Télécharger" si `att.canPreview`. **Aucune miniature pour aucun type de fichier**, y compris les images. Les deux boutons appellent la même fonction `previewInternalMailAttachment()` (`messageService.js:117-122`) qui récupère un blob et l'ouvre via `window.open(url, '_blank')` — pas de distinction réelle preview/téléchargement, pas d'aperçu dans la page.

## Bibliothèques déjà installées pertinentes pour une future roadmap viewers

Recherche exhaustive de `client/package.json` : **seul `dompurify` (^3.4.8) est présent** parmi les bibliothèques listées par le mandat. Absents : `sanitize-html`, `react-pdf`, `pdfjs`, `prismjs`, `highlight.js`, `xlsx`, `docx`, `mammoth`, `papaparse`. Aucun composant de type viewer/preview/PDF/syntax-highlighter réutilisable n'existe ailleurs dans `client/lib/components/` (recherche exhaustive, zéro résultat pertinent au-delà de `SafeHtmlEmailViewer.jsx` lui-même). **Toute future implémentation de viewer PDF/Office/code devra partir de zéro ou ajouter une dépendance — aucune ne peut être "découverte" et réutilisée aujourd'hui.**

## Dark mode

Aucune classe `dark:` trouvée dans `InternalMessagingPage.jsx` ni `lib/components/messaging/*` — cette zone n'a pas encore été touchée par le chantier Dark Mode en cours ailleurs dans le dépôt (constaté, non analysé plus en profondeur, hors périmètre de cet audit).

## UX actuelle — classification P0-P3 (mandat §10)

| Élément | Constat | Priorité |
|---|---|---|
| Rendu HTML sécurisé | Déjà correct (DOMPurify + iframe sandbox) | — (déjà fait) |
| Images distantes non bloquées | Fuite de confidentialité potentielle (tracking) | **P0** (sécurité/données, cohérent avec mandat §13) |
| `emailRoutes.js` sans authentification | Risque de sécurité backend, indépendant du frontend | **P0** |
| CID non résolu | Images inline cassées dans les emails qui en contiennent | **P1** (usage professionnel — un email HTML avec logo/signature inline s'affiche cassé aujourd'hui) |
| Pas de preview réel (image/PDF/etc.) | Toute pièce jointe s'ouvre en téléchargement brut | **P1** |
| Pas de miniature même pour les images | Confort de lecture réduit | **P2** |
| Composant page monolithique (792 lignes) | Dette de maintenabilité, pas un risque utilisateur direct | **P2** (architecture, impacte la vélocité d'INBOX-2+, pas l'UX finale) |
| Nom de fichier constant `"attachment"` sur le téléchargement chat interne | Perte du vrai nom de fichier téléchargé | **P2** (hors périmètre email strict) |
| Dark mode absent sur cette page | Incohérence visuelle si le reste du dashboard passe en dark mode | **P3** |
| Pas d'avertissement sur fichier potentiellement dangereux | Risque limité (téléchargement neutre) mais absence de signal utilisateur | **P2** |
