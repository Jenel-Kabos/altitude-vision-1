# INBOX-2 — AUDIT DE L'EXISTANT

Ce document répond directement à l'exigence du mandat ("auditer avant de modifier, ne pas supposer que tout reste à créer"). Le détail complet par surface est dans `INBOX2_UX_AUDIT.md` ; ce fichier résume l'audit et la décision qui en découle.

## Ce qui existait déjà avant ce sprint (confirmé par lecture directe du code)

Deux sprints antérieurs (`INBOX-PRO-1`, `INBOX-PRO-2`) avaient déjà professionnalisé l'Inbox :

- **Navigation** : rail compact desktop (`InboxNavRail`) + écran dossiers mobile dédié, navigation mono-écran mobile (dossiers → liste → lecture plein écran, bouton retour).
- **Liste** : `ConversationRow`, hiérarchie lu/non-lu (gras/normal), badges étoile/pièce jointe, date relative, `<button>` natif avec `aria-current`/`focus-visible`.
- **Panneau de lecture** : `ConversationViewer` (header expéditeur cliquable → drawer contact, date complète, badge priorité, actions étoile/suppression/restauration).
- **Corps HTML** : `SafeHtmlEmailViewer`, DOMPurify + iframe sandbox (`HOTFIX-INBOX-SECURITY-2`, certifié vert).
- **Pièces jointes** : `AttachmentStrip` + `SafeAttachmentPreview`, classification sécurité fail-closed (`attachmentSecurity.js`, certifiée SECURITY-2).
- **États** : loading (skeleton), empty (différencié "aucun message"/"aucun résultat"), error (message + retry), no-selection.
- **Recherche/filtres** : `InboxToolbar`, filtres Tous/Non lus/Avec pièce jointe.
- **Drawer contact** : `ContactDrawer`, escamotable.
- **Dark mode shell** : `HOTFIX-DASHBOARD-DARK-MODE-UI-1` avait déjà mis en place la compatibilité `.dashboard-content-inner` pour l'ensemble du shell dashboard (nav, cartes, listes, inputs).

## Ce qui manquait réellement (seuls écarts prouvés, par capture d'écran réelle)

1. **Corps HTML illisible en mode sombre** — l'iframe sandboxée de `SafeHtmlEmailViewer` a son propre document CSS, isolé du dashboard par conception (SECURITY-2) ; son style interne (`BASE_STYLE`) codait un texte sombre (`#1f2937`) sans fond explicite, et Chromium assombrit alors automatiquement le fond du document tout en gardant ce texte sombre → texte quasi invisible. **Corrigé** (bloc `@media (prefers-color-scheme: dark)` ajouté dans le CSS interne de l'iframe, sandbox/DOMPurify strictement inchangés).
2. **Icône de pièce jointe non différenciée** — tous les types non-image partageaient la même icône générique (`FileText`). **Amélioré** (classification présentationnelle par catégorie, `attachmentPresentation.js`, strictement séparée de la classification sécurité).

## Décision (mandat §15 — pas de reconstruction)

Aucun autre écart n'a été trouvé par l'audit ni par la validation visuelle réelle en Chromium (voir `INBOX2_VISUAL_MATRIX.md`). **Aucune reconstruction n'a été effectuée** — seuls les deux points ci-dessus ont été corrigés/améliorés, dans les fichiers exacts où le défaut a été localisé.
