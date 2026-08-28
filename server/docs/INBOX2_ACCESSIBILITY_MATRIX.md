# INBOX-2 — MATRICE D'ACCESSIBILITÉ

Audit de l'existant (aucune régression introduite, aucun des deux changements de ce sprint n'affecte un élément interactif) plus vérification ciblée des points du mandat §46/§47.

| Point | Constat | Preuve |
|---|---|---|
| Contraste (mode clair) | Tokens `--db-text`/`--db-muted` déjà conçus pour un contraste correct sur fond clair (hérité de `HOTFIX-DASHBOARD-DARK-MODE-UI-1`) | Capture d'écran `desktop-light.png` |
| Contraste (mode sombre, shell) | Déjà correct (nav rail, liste, toolbar, cartes de pièces jointes) | Capture d'écran `desktop-dark.png` |
| **Contraste (mode sombre, corps HTML de l'email)** | **Corrigé cette session** — texte auparavant quasiment invisible (`#1f2937` sur fond auto-assombri), désormais `#f1f5f9` sur `#111827` (ratio de contraste élevé, cohérent avec les tokens `--db-text`/`--db-surface-solid` du reste du dashboard) | Capture d'écran `desktop-dark.png` avant/après (voir `INBOX2_VISUAL_VALIDATION.md`) |
| Focus visible | `ConversationRow`, `IconButton`, boutons de dossier : `focus-visible:ring-2 focus-visible:ring-blue-500` déjà présent | Lecture directe du code, inchangé |
| Navigation clavier | `ConversationRow` est un vrai `<button>` (pas un `<div onClick>`) — Tab/Shift+Tab/Enter/Space fonctionnent nativement sans code custom | Lecture directe du code, inchangé |
| Boutons avec labels | Tous les boutons d'action (étoile, suppression, restauration, voir, télécharger, fermer l'aperçu) ont déjà un `aria-label`/`title` explicite | Lecture directe du code, inchangé |
| `aria-current` (sélection) | `ConversationRow` : `aria-current={selected ? 'true' : undefined}` déjà présent | Lecture directe du code, inchangé |
| État désactivé | Non applicable à ce sprint — aucun bouton désactivé conditionnel modifié | — |
| Focus modal | `SafeAttachmentPreview` (modal d'aperçu) : focus posé sur le bouton de fermeture à l'ouverture, fermeture au clavier (Échap) — déjà certifié par SECURITY-2, non modifié | `HOTFIX_INBOX_SECURITY2_BEHAVIOR_CONTRACT.md` |

## Non couvert (hors périmètre, honnêteté du rapport)

Aucun audit automatisé WCAG (axe-core ou équivalent) n'a été exécuté — aucun outil de ce type n'est déjà installé dans le projet (mandat §50 : ne pas ajouter de nouvelle bibliothèque pour ce sprint). L'évaluation ci-dessus est une vérification manuelle ciblée sur les points explicitement listés par le mandat, pas un audit d'accessibilité exhaustif.
