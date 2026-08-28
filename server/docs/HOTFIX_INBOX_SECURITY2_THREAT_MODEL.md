# HOTFIX-INBOX-SECURITY-2 — MODÈLE DE MENACE

## Fait fondateur : origine des Blob URL

`URL.createObjectURL(blob)` produit une URL `blob:<origine-du-créateur>/<uuid>`. Le document qu'elle sert **hérite de l'origine de la page qui l'a créée** — ce n'est **pas** une origine opaque. Un `window.open()` sur une telle URL depuis le dashboard (`altitudevision.agency`) ouvre donc un document **de la même origine que le dashboard**. Tout script exécuté dans ce document a accès à `localStorage` (où `client/lib/services/api.js:29` lit le JWT), à `sessionStorage`, et peut effectuer des requêtes same-origin avec les cookies/headers implicites du navigateur pour ce domaine. `noopener`/`noreferrer` empêche seulement le document ouvert d'accéder à `window.opener` — cela ne change rien à sa propre origine ni à son accès à son propre `localStorage`.

**Conséquence directe** : avant ce hotfix, un fichier `.html` ou `.svg` contenant un script, joint à un email (y compris un email externe entrant par IMAP, puisqu'il alimente le même modèle `InternalMail` que les échanges internes), pouvait — au clic sur "Voir" ou "Télécharger" — exécuter du JavaScript arbitraire avec les pleins pouvoirs same-origin du dashboard, y compris la lecture du JWT stocké en `localStorage`. C'est un vecteur de **vol de session**, pas seulement de phishing.

## Vecteurs analysés

| Vecteur | Applicable avant correctif ? | Bloqué après correctif ? | Mécanisme |
|---|---|---|---|
| HTML attachment → `<script>` | Oui (rendu direct par le navigateur) | **Oui** | DOMPurify `FORBID_TAGS: ['script', ...]` (défaut DOMPurify, explicite en défense en profondeur) + iframe sandbox sans `allow-scripts` (double barrière) |
| HTML attachment → `javascript:` URL | Oui | **Oui** | DOMPurify neutralise `href="javascript:..."` par défaut (même comportement que `SafeHtmlEmailViewer`, testé) |
| HTML attachment → gestionnaires d'événements (`onerror`, `onload`, `onclick`...) | Oui | **Oui** | `FORBID_ATTR` + comportement par défaut DOMPurify (strip tout `on*`) |
| HTML attachment → `<iframe>` externe | Oui | **Oui** | `FORBID_TAGS: ['iframe', ...]` |
| HTML attachment → `<form>` | Oui | **Oui** | `FORBID_TAGS: ['form']` |
| HTML attachment → `<meta http-equiv="refresh">` | Oui (le document ouvert aurait pu se rediriger vers une origine externe avec les pleins droits same-origin du contexte parent au moment du clic) | **Oui, structurellement** | Le contenu n'est plus jamais navigué en direct comme document top-level — il est injecté en `srcDoc` dans une iframe déjà sandboxée (`allow-popups allow-popups-to-escape-sandbox`, sans `allow-top-navigation`) ; un `<meta refresh>` sanitizé ou non ne peut plus rediriger le contexte parent |
| SVG attachment → `<script>` intégré | Oui | **Oui** | Sanitize SVG avec `FORBID_TAGS` incluant `script` (explicite, en plus du profil DOMPurify) |
| SVG attachment → `onload`/gestionnaires | Oui (`<svg onload=...>` est un vecteur XSS SVG classique) | **Oui** | `FORBID_ATTR` inclut `onload` |
| SVG attachment → `<foreignObject>` (HTML arbitraire imbriqué) | Oui | **Oui** | `FORBID_TAGS` étend explicitement le profil SVG de DOMPurify pour retirer `foreignObject` (mandat §18, sécurité > fidélité de rendu) |
| SVG attachment → ressource externe (`<image href="https://...">`, `<use href="...">`) | Oui (chargement réseau depuis le contexte sandboxé, sans exécution de code) | Partiellement mitigé (isolation iframe, aucune capacité `allow-same-origin`) — même niveau de risque résiduel que les images distantes du corps d'email (`INBOX1_SECURITY_MATRIX.md`, "tracking pixel"), non aggravé par ce hotfix, non traité ici (hors périmètre, mandat §43) | Iframe sandboxée sans `allow-same-origin` |
| SVG attachment → `javascript:` URL | Oui | **Oui** | Même neutralisation DOMPurify que HTML |
| MIME spoofing / extension-MIME mismatch | Oui (aucune vérification) | **Oui — fail-closed** | Classification `isActiveAttachmentContent` : actif si extension OU MIME signale html/svg (voir `attachmentSecurity.js`), testé avec `photo.jpg`/`text/html` |
| Exécution via Blob URL (mécanisme général) | Oui (`window.open(blob)` pour tout type) | **Oui, pour les types actifs** | Les types actifs ne passent plus jamais par `previewInternalMailAttachment` (raw blob + window.open) — ni pour "Voir" ni pour "Télécharger" |
| `window.opener` | Non applicable — `previewInternalMailAttachment` utilisait déjà `noopener,noreferrer` (inchangé, non touché) | Inchangé | `window.open(url, '_blank', 'noopener,noreferrer')`, préexistant |
| Navigation vers une origine externe | Non applicable directement (le vecteur réel était l'exécution same-origin, pas une redirection vers un tiers) | N/A | — |

## Ce qui N'A PAS été traité ici (hors périmètre, documenté, pas oublié)

- Tracking pixels / ressources distantes chargées automatiquement dans le corps HTML de l'email (`SafeHtmlEmailViewer`) — déjà identifié P0 UX par `INBOX1_FRONTEND_AUDIT.md`, non touché par ce hotfix (mandat §43).
- CID/images inline — mandat §42, hors périmètre (`INBOX-5`).
- Détection de type par signature de fichier (magic bytes) — mandat §13 l'interdit explicitement pour ce hotfix ; la classification reste basée sur extension+MIME déclarés, fail-closed en cas de divergence, jamais un sniffer de contenu.
- `X-Content-Type-Options: nosniff` — déjà présent sur `downloadAttachment` (`internalMailController.js:687`), confirmé, non modifié (backend non touché par ce hotfix).
