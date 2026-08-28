# INBOX-2 — ÉTAT INITIAL

## Baseline git

- Branche : `main`
- HEAD : `a04055f62952c782b92aeef2f100824a17a5f645` ("Update Altimmo 40") — inchangé.
- `git status --short` : 211 lignes — travail parallèle déjà documenté (`ARCH2*`) plus mes hotfix non commités (`SECURITY-1`, `SECURITY-2`, `MOB-ADD-PROPERTY-BEDROOMS-1`, `CONVERSATION-ACTIVE-ATTACHMENT-1`). Aucun écrasement, aucun stash/reset/clean.
- `git diff --check` : propre.

## Découverte majeure avant toute modification — l'Inbox est déjà professionnalisée

Contrairement à la prémisse du mandat ("transformer l'interface InternalMail actuelle en Inbox professionnelle"), la lecture directe de `InternalMessagingPage.jsx` et de ses composants enfants révèle que **deux sprints antérieurs, `INBOX-PRO-1` et `INBOX-PRO-2`, ont déjà largement réalisé cette transformation**, documentés dans `server/docs/INBOX_PRO1_*.md` et `INBOX_PRO2_*.md` (non lus au préalable par le mandat, découverts en auditant). L'architecture actuelle possède déjà :

- Rail de navigation compact desktop (`InboxNavRail`) + écran dossiers mobile dédié (`MobileFolderList`) ;
- Liste dense avec hiérarchie lu/non-lu, étoile, badge pièce jointe, date relative (`ConversationRow`) ;
- Panneau de lecture dominant, pas de 3ᵉ colonne permanente (`ConversationViewer`) ;
- Drawer contact escamotable (`ContactDrawer`) ;
- Toolbar avec recherche + filtres (`InboxToolbar`) ;
- États loading (skeleton), empty, error avec retry — différenciés ;
- Navigation mobile mono-écran (dossiers → liste → lecture plein écran, bouton retour) ;
- Corps HTML sécurisé (`SafeHtmlEmailViewer`, DOMPurify + iframe sandbox, HOTFIX-INBOX-SECURITY-2) ;
- Pièces jointes professionnalisées avec icône/nom/taille/preview/download (`AttachmentStrip` + `SafeAttachmentPreview`, HOTFIX-INBOX-SECURITY-2) ;
- Éléments interactifs déjà accessibles : `ConversationRow` est un vrai `<button>` avec `aria-current`, `focus-visible:ring`, pas un `<div onClick>`.

**Un second sprint, `HOTFIX-DASHBOARD-DARK-MODE-UI-1`, a par ailleurs déjà mis en place un système de tokens dark mode systémique** (`client/app/dashboard/dashboard.css`, mécanisme `.dashboard-content-inner` qui réécrit automatiquement les classes Tailwind `bg-white`/`bg-gray-*`/`text-gray-*`/`border-gray-*` vers des variables CSS `--db-*` en fonction de `prefers-color-scheme`/`.dark`), et liste explicitement "Inbox / SafeHtmlEmailViewer" dans sa matrice de composants, traité comme "conteneur seulement, sandbox inchangé".

## Conséquence pour le périmètre réel d'INBOX-2

Le travail réellement disponible pour ce sprint est **beaucoup plus restreint** que ce que le mandat supposait : la structure, la responsivité, l'accessibilité de base et les états sont déjà en place. L'audit (`INBOX2_UX_AUDIT.md`) se concentre donc sur la vérification empirique de ce qui est déjà là (par capture d'écran réelle en Chromium, voir `INBOX2_VISUAL_VALIDATION.md`) plutôt que sur une reconstruction, conformément à la philosophie du mandat ("améliorer l'existant avant d'ajouter").

Un vrai défaut a été trouvé et corrigé (voir `INBOX2_BEHAVIOR_CONTRACT.md`) : le corps HTML de l'email, rendu dans l'iframe sandboxée de `SafeHtmlEmailViewer`, devenait illisible en mode sombre (texte `#1f2937` sur fond auto-assombri par Chromium, capturé par preuve visuelle). Un second raffinement présentationnel a été ajouté : une classification par catégorie de fichier pour l'icône des pièces jointes (`attachmentPresentation.js`), distincte de la classification sécurité certifiée (`attachmentSecurity.js`, non modifiée).

## Documents lus avant toute action

`INBOX1_*.md` (10 fichiers, audit complet), `HOTFIX_INBOX_SECURITY1_*.md`, `HOTFIX_INBOX_SECURITY2_*.md` (tous), `INBOX_PRO1_*.md`, `INBOX_PRO2_*.md`, `HOTFIX_DASHBOARD_DARK_MODE_UI1_*.md` — tous relus intégralement avant toute modification.
