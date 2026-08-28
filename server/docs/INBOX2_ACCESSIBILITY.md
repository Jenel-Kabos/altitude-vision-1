# INBOX-2 — ACCESSIBILITÉ (mandat §10)

Version consolidée de `INBOX2_ACCESSIBILITY_MATRIX.md`, avec les points explicitement listés par ce mandat.

| Point du mandat | Constat |
|---|---|
| Button semantics | `ConversationRow` est un vrai `<button>` (jamais un `<div onClick>`), tous les boutons d'action (étoile, suppression, restauration, voir, télécharger, fermer l'aperçu) sont de vrais `<button type="button">` |
| `aria-current` | `ConversationRow` : `aria-current={selected ? 'true' : undefined}` |
| `focus-visible` | Présent sur `ConversationRow`, `IconButton`, boutons de dossier, boutons d'attachment — `focus-visible:ring-2 focus-visible:ring-blue-500` (motif cohérent partout) |
| Labels | Tous les boutons d'action ont un `aria-label`/`title` explicite (ex. `` `Voir ${att.filename}` ``, `` `Diminuer ${label}` ``) |
| Contraste (clair) | Tokens `--db-text`/`--db-muted` déjà conçus pour un contraste correct |
| Contraste (sombre, shell) | Déjà correct (nav, liste, toolbar, cartes) |
| **Contraste (sombre, corps HTML email)** | **Corrigé cette session** — voir `INBOX2_VISUAL_MATRIX.md`, texte désormais `#f1f5f9` sur `#111827` |
| Clavier | Tab/Shift+Tab/Enter/Space fonctionnent nativement sur tous les éléments interactifs (vrais `<button>`, jamais de gestion clavier custom nécessaire) |
| Mobile touch targets | Boutons d'action déjà dimensionnés en cohérence avec le design system dashboard (padding `p-2`/`p-2.5`, zones cliquables ≥ 32px), non modifiés par ce sprint |
| Focus modal (`SafeAttachmentPreview`) | Focus posé sur le bouton de fermeture à l'ouverture, fermeture au clavier (Échap) — déjà certifié SECURITY-2, non modifié |

## Non couvert (honnêteté du rapport, inchangé depuis `INBOX2_ACCESSIBILITY_MATRIX.md`)

Aucun audit automatisé WCAG (axe-core ou équivalent) — aucun outil de ce type disponible sans ajouter une dépendance (hors périmètre, mandat "frontend only par défaut" ne justifie pas l'ajout d'un nouvel outil ici). Évaluation manuelle ciblée sur les points explicitement listés, pas un audit exhaustif.

## Verdict

Aucune régression d'accessibilité. Le seul changement fonctionnel touchant l'accessibilité est une amélioration (contraste du corps HTML en mode sombre) — aucun élément interactif, aucun label, aucune structure sémantique n'a été modifié.
