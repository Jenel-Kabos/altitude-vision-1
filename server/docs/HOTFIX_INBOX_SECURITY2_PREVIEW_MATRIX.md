# HOTFIX-INBOX-SECURITY-2 — MATRICE DES PREVIEWS (RÉEL, PAS INVENTÉ)

Rappel : le pipeline `InternalMail` ne différencie **aucun** type au parsing/stockage (`storeAttachments`, `secureStorageService.js`) — la seule différenciation existe désormais côté client, dans `AttachmentStrip.jsx`, et uniquement pour la classification introduite par ce hotfix. Cette matrice documente le comportement réel du code, avant et après correctif.

| Extension | MIME déclaré | Preview AVANT (tous types, sans distinction) | Preview APRÈS | Téléchargement APRÈS | Risque d'exécution |
|---|---|---|---|---|---|
| `.pdf` | `application/pdf` | `window.open(blob)` — visualiseur PDF natif du navigateur | **Inchangé** | **Inchangé** (`previewInternalMailAttachment`, raw blob) | Faible (rendu par le moteur PDF du navigateur, pas un moteur HTML/JS arbitraire) |
| `.jpg`/`.jpeg` | `image/jpeg` | `window.open(blob)` | **Inchangé** | **Inchangé** | Faible (image statique) |
| `.png` | `image/png` | `window.open(blob)` | **Inchangé** | **Inchangé** | Faible |
| `.gif` | `image/gif` | `window.open(blob)` | **Inchangé** | **Inchangé** | Faible |
| `.webp` | `image/webp` | `window.open(blob)` | **Inchangé** | **Inchangé** | Faible |
| `.svg` | `image/svg+xml` | `window.open(blob)` — **rendu direct, jamais sanitizé** | **Sanitizé (DOMPurify profil SVG, `foreignObject`/`script`/gestionnaires d'événements retirés) puis rendu dans une iframe sandboxée isolée (`SafeAttachmentPreview`)** | **`<a download>` forcé — jamais une navigation/exécution** | Corrigé (était Moyen selon `INBOX1_ATTACHMENT_MATRIX.md`, révisé à la hausse dans `HOTFIX_INBOX_SECURITY2_ETAT_INITIAL.md` — origine blob: non opaque) |
| `.html`/`.htm` | `text/html` | `window.open(blob)` — **rendu/exécuté directement, hors du sandbox `SafeHtmlEmailViewer`** | **Sanitizé (même config DOMPurify que le corps d'email) puis rendu dans une iframe sandboxée isolée** | **`<a download>` forcé** | Corrigé (était Moyen-Élevé selon `INBOX1_ATTACHMENT_MATRIX.md`, révisé à la hausse) |
| `.txt` | `text/plain` | `window.open(blob)` | **Inchangé** | **Inchangé** | Faible (jamais interprété comme HTML par le navigateur) |
| `.csv`/`.json`/`.xml`/`.css`/`.js`/`.ts` | `text/*`, `application/json`, etc. | `window.open(blob)` (le navigateur les affiche généralement comme texte brut, jamais comme document HTML exécutable, car leur MIME n'est ni `text/html` ni `image/svg+xml`) | **Inchangé** — hors périmètre de classification "actif" de ce hotfix, cohérent avec `INBOX1_ATTACHMENT_MATRIX.md` (risque Faible/Moyen conditionnel à un futur viewer dédié, pas au mécanisme actuel) | **Inchangé** | Faible aujourd'hui (aucun rendu HTML de ces types par le mécanisme actuel) |
| `.doc(x)`/`.xls(x)`/`.ppt(x)`/`.zip`/`.rar`/`.7z` | Office/archive | `window.open(blob)` (télécharge ou échoue silencieusement selon le navigateur, aucun rendu HTML) | **Inchangé** | **Inchangé** | Faible (aucun moteur de rendu HTML/JS impliqué) |
| **Extension/MIME divergents** (`photo.jpg` déclaré `text/html`, ou `page.html` déclaré `image/jpeg`) | — | `window.open(blob)` — le comportement suit le MIME réellement stocké (`attachment.mimetype`), pas le nom affiché | **Classé actif si extension OU MIME signale html/svg (fail-closed) → sanitizé + sandboxé** | **`<a download>` forcé** | Corrigé — voir `AttachmentStripSecurity.test.jsx`, cas `mismatchAttachment` |
| MIME inconnu/absent | — | `window.open(blob)` | **Inchangé** (non classé actif par défaut — mandat §35, ne jamais interpréter un MIME inconnu comme HTML) | **Inchangé** | Inchangé (comportement navigateur par défaut, hors périmètre d'un sniffer de contenu, explicitement exclu par le mandat §13) |

## Ce que cette matrice NE couvre PAS (hors périmètre, mandat §3)

Aucune miniature, aucun viewer Office/Excel/CSV/code, aucune résolution CID, aucune protection tracking pixel — inchangé depuis `INBOX-1`, candidats `INBOX-2` à `INBOX-5`.
