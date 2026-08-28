# INBOX-2 — MATRICE RESPONSIVE

Preuve : captures d'écran réelles en Chromium (`client/e2e/inbox2/screenshots/*.png`, voir `INBOX2_VISUAL_VALIDATION.md`), composant de production réel bundlé (esbuild), CSS de production réel (`.next/static/css/*.css`).

| Layout | Viewport testé | Résultat observé |
|---|---|---|
| Desktop large | 1440×900 | Rail de navigation + liste (340px) + panneau de lecture dominant, aucune 3ᵉ colonne permanente — conforme à l'architecture visuelle cible du mandat §12 (déjà en place avant ce sprint) |
| Mobile | 390×844 (iPhone 12/13 standard) | Navigation mono-écran confirmée : écran "dossiers" → liste → lecture plein écran avec bouton "Retour", conforme au mandat §13 |

## Non testés explicitement (mandat §66 : "au minimum")

- **Desktop standard** (~1280px) et **tablet** (~768-1024px) : non capturés séparément dans cette passe. L'architecture (`lg:` breakpoint Tailwind, bascule liste/panneau à `1024px`) est la même déjà validée et testée par `INBOX_PRO2_RESPONSIVE_MATRIX.md` (sprint antérieur) — non re-testée ici faute de changement dans cette zone de code (aucune classe responsive touchée par ce sprint, seul le contenu de l'iframe HTML et l'icône d'attachment ont changé, tous deux indépendants du breakpoint).

## Aucune régression de layout introduite

Les deux changements de ce sprint (dark mode interne à l'iframe, icône de pièce jointe) ne touchent aucune classe de layout (`flex`, `w-*`, `hidden`/`lg:flex`, etc.) — confirmé par diff (`git diff` limité aux deux fichiers, aucune ligne de structure/layout modifiée).
