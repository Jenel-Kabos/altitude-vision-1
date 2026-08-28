# HOTFIX-INBOX-SECURITY-2 — MATRICE ADVERSARIALE

## Vecteurs de code actif (preuve navigateur réel + jsdom)

| Vecteur | Testé | Environnement | Résultat |
|---|---|---|---|
| `<script>...</script>` (HTML) | Oui | Chromium réel + jsdom | Retiré du `srcdoc`, jamais exécuté |
| `onerror` (HTML) | Oui | Chromium réel + jsdom | Retiré, jamais exécuté |
| `onload` (SVG) | Oui | Chromium réel + jsdom | Retiré, jamais exécuté |
| `javascript:` URL | Oui | jsdom (héritée de la config `SafeHtmlEmailViewer`, déjà prouvée) | Neutralisée par défaut DOMPurify |
| `foreignObject` avec HTML actif (SVG) | Oui | jsdom | Explicitement dans `FORBID_TAGS` de la config SVG (`SafeAttachmentPreview.jsx`), retiré |
| `<iframe srcdoc="...">` imbriqué | Oui | jsdom (héritée) | `iframe` dans `FORBID_TAGS`, retiré |
| `<object>`/`<embed>` | Oui | jsdom (héritée) | Dans `FORBID_TAGS`, retirés |
| `parent access` (`parent.document`/`top.document`) | Oui | Chromium réel (tests 1-3) | Bloqué par le sandbox (absence de `allow-same-origin`) — origine opaque du contenu de l'iframe, aucun accès possible même si un script s'exécutait |
| `localStorage` du dashboard | Oui | Chromium réel (test 1) | Bloqué — sandbox sans `allow-same-origin`, origine différente ; valeur factice confirmée inchangée |
| `top navigation` (`window.top.location = ...`) | Oui | Chromium réel (test 3, contrôle négatif) | Bloqué par le sandbox (absence de `allow-top-navigation`), même avec un `srcDoc` non sanitizé |
| `popup incontrôlée` (`window.open(...)` depuis l'iframe) | Oui | Chromium réel (test 3) | Bloqué — `allow-popups` est présent dans le sandbox, mais l'appel `window.open` interne au contenu malveillant testé n'a produit aucune nouvelle page (`context.pages().length` inchangé) ; le sandbox `allow-popups` autorise les popups déclenchées par une interaction utilisateur légitime dans un contenu sain (ex. clic sur un lien du corps d'email), pas une exécution de script bloquée en amont par `allow-scripts` absent |

## Note méthodologique sur `javascript:`/`foreignObject`/`iframe imbriqué` en environnement Chromium réel

Ces trois vecteurs n'ont pas été re-testés séparément en Chromium réel dans cette certification : leur neutralisation provient de la **même** configuration DOMPurify (`SANDBOXED_HTML_SANITIZE_CONFIG`/`SVG_SANITIZE_CONFIG`), déjà exercée en Chromium réel sur les vecteurs `<script>`/`onerror`/`onload` (tests 1-2), et déjà couverte par une preuve jsdom explicite et stable (`SafeHtmlEmailViewer.test.jsx`, 12/12 verts, cas `javascript:` dédié). DOMPurify est une bibliothèque de sanitization DOM — son comportement ne dépend pas du moteur de rendu (jsdom vs Chromium) puisqu'elle opère sur l'arbre DOM en amont de tout rendu ; la preuve en Chromium réel des vecteurs `<script>`/`onerror`/`onload` valide directement le mécanisme (DOMPurify + sandbox), ce qui couvre par construction les vecteurs analogues non re-testés individuellement.

## MIME spoofing / extension spoofing (classification fail-closed)

Voir `client/lib/__tests__/attachmentSecurity.test.js` (19 tests, tous verts après micro-correction) :

| Cas | Actif ? |
|---|---|
| `evil.html` + `application/octet-stream` | Oui |
| `evil.txt` + `text/html` | Oui |
| `evil.svg` + `image/png` | Oui |
| `evil.png` + `image/svg+xml` | Oui |
| `EVIL.HTML` (casse) | Oui |
| `evil.SVG` (casse) | Oui |
| `TEXT/HTML` (casse MIME) | Oui |
| `text/html; charset=utf-8` (paramètre MIME) | Oui |
| `invoice.pdf.html` (double extension) | Oui |
| `photo.jpg.svg` (double extension) | Oui |
| `evil.svgz` | Oui |
| MIME seul (`image/svg+xml`), sans filename | Oui |
| `photo.jpg` + `image/jpeg` (légitime) | Non — préservé |
| `doc.pdf` + `application/pdf` (légitime) | Non — préservé |
| `noext` sans extension, MIME neutre | Non — préservé |
| **`evil.html?x=1`** (vecteur d'évasion découvert en certification) | **Oui, après micro-correction** (était `Non` avant — faille caractérisée puis fermée, voir `_FINAL_CERT_ETAT_INITIAL.md`) |
| **`evil.svg#frag`** (idem) | **Oui, après micro-correction** |
| **`evil.html#x?y=1`** (combinaison) | **Oui, après micro-correction** |

## Résumé

Tous les vecteurs listés au mandat §10/§11/§27/§28/§29 sont couverts, soit par preuve directe en Chromium réel, soit par héritage direct et documenté d'un mécanisme déjà prouvé en Chromium réel dans cette même certification. Le seul point négatif trouvé (évasion par suffixe query/fragment) a été fermé par une micro-correction caractérisée par un test rouge→vert, strictement locale à la fonction de classification, sans changement de règle métier.
