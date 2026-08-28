# INBOX-2 — MATRICE DE VALIDATION VISUELLE (Chromium réel)

Méthode : `@playwright/test` + Chromium déjà installés (aucune dépendance ajoutée), le VRAI composant de production `InternalMessagingPage.jsx` bundlé en mémoire (esbuild) avec ses seules dépendances externes stubbées (services réseau, auth, routeur), monté dans la vraie structure `.dashboard-shell > .dashboard-content-inner` avec le **vrai CSS compilé de production** (`npm run build:next`). Détail de la méthode et limites : `INBOX2_VISUAL_VALIDATION.md`. Ce document a été **revalidé** dans cette session (nouveau build, nouvelle exécution des 6 tests, captures réinspectées) — aucune régression, résultats identiques à la validation initiale.

| Scénario | Viewport | Thème | Résultat | Capture |
|---|---|---|---|---|
| Liste + panneau de lecture + pièces jointes | 1440×900 (desktop) | Clair | ✅ Conforme | `desktop-light.png` |
| Liste + panneau de lecture + pièces jointes | 1440×900 (desktop) | Sombre | ✅ Conforme (corps HTML lisible après correctif) | `desktop-dark.png` |
| Écran dossiers | 390×844 (mobile) | Clair | ✅ Conforme | `mobile-light-folders.png` |
| Écran dossiers | 390×844 (mobile) | Sombre | ✅ Conforme | `mobile-dark-folders.png` |
| Liste puis lecture plein écran | 390×844 (mobile) | Clair | ✅ Conforme | `mobile-light-list.png`, `mobile-light-detail.png` |
| État vide (recherche sans résultat) | 1440×900 (desktop) | Clair | ✅ "Aucun résultat." affiché | — |

## Détail — email body (mandat §5)

| Élément | Avant | Après |
|---|---|---|
| Texte HTML (paragraphes) | Lisible en clair, illisible en sombre | Lisible dans les deux thèmes |
| Liens (`<a>`) | `#2563eb` (clair uniquement) | `#2563eb` en clair, `#60a5fa` en sombre (contraste adapté) |
| Tableaux | Rendus, largeur contrainte (`max-width:100%`), scroll horizontal local si large | Inchangé |
| Texte brut (fallback) | Déjà couvert par la compatibilité dashboard (`text-gray-700` → token) | Inchangé, déjà correct |
| Images inline (CID) | Non supporté (confirmé par `INBOX-1`, hors périmètre) | Inchangé, non traité (candidat `INBOX-3`) |
| Signatures / longues lignes | `word-wrap: break-word`, `overflow-x: auto` déjà présents | Inchangé |

## Détail — dark mode iframe (mandat §6)

| Propriété interne à l'iframe | Avant (sombre) | Après (sombre) |
|---|---|---|
| `background` | Non défini → assombrissement automatique du navigateur (comportement non maîtrisé) | `#111827` (explicite, aligné sur `--db-surface-solid` du dashboard) |
| `color` (texte) | `#1f2937` (codé en dur, sombre) → illisible sur fond assombri | `#f1f5f9` (aligné sur `--db-text`) |
| Liens | `#2563eb` (identique aux deux modes) | `#60a5fa` en sombre |
| Sandbox (`allow-popups allow-popups-to-escape-sandbox`, sans `allow-scripts`/`allow-same-origin`) | Intact | **Strictement intact — non modifié** |
| DOMPurify (config, appel) | Intact | **Strictement intact — non modifié** |

## Limite honnête (rappel de `INBOX2_VISUAL_VALIDATION.md`)

Seul le mode sombre déclenché par `prefers-color-scheme` (préférence OS) a pu être testé — l'iframe ne peut pas voir un éventuel contrôle dark mode explicite du dashboard (`.dark` sur `.dashboard-shell`, indépendant de l'OS), limite structurelle de l'isolation cross-document, non aggravée par ce sprint.
