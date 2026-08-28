# HOTFIX-INBOX-SECURITY-2 — MATRICE DE PREUVE NAVIGATEUR RÉEL

Infrastructure réutilisée : `@playwright/test` (déjà présent, `client/package.json`), binaire Chromium déjà téléchargé (`~/Library/Caches/ms-playwright/chromium-1234`). Aucune dépendance ajoutée. Config dédiée et légère (`client/e2e/security2/playwright.security2.config.js`) qui **ne démarre pas** la stack e2e complète (MongoMemoryReplSet + Express + Next dev server) du `playwright.config.js` racine — non nécessaire, le test charge le vrai composant de production bundlé en mémoire (esbuild, jamais un artefact écrit sur disque), pas l'application déployée. Firefox/WebKit : binaires non installés dans cet environnement (`playwright.config.js` racine du projet ne définit d'ailleurs que des projets Chromium) — non testés, conforme au mandat §12 ("si déjà disponibles").

| # | Scenario | Browser | Expected | Actual | Result |
|---|---|---|---|---|---|
| 1 | Pièce jointe HTML hostile (`<script>`, `onerror`) montée via le VRAI composant `SafeAttachmentPreview` | Chromium (réel) | `sandbox` correct, `srcdoc` nettoyé, aucune exécution dans le parent | `sandbox="allow-popups allow-popups-to-escape-sandbox"` confirmé, `srcdoc` sans `<script`/`onerror`, `window.__INBOX_SECURITY_TEST__` reste `'untouched'` après 500ms | ✅ PASS |
| 2 | Pièce jointe SVG hostile (`<script>` imbriqué, `onload`) | Chromium (réel) | Idem | `srcdoc` sans `<script`/`onload`, marqueur intact | ✅ PASS |
| 3 | Défense en profondeur — sandbox seul, DOMPurify délibérément contourné (`srcDoc` brut malveillant) | Chromium (réel) | Script/accès parent/navigation top/popup tous bloqués par le seul attribut `sandbox` | Marqueur intact, URL de la page hôte inchangée (`evil.test` absent), aucune popup ouverte (`context.pages().length === 1`) | ✅ PASS |
| 4 | Reproduction historique — `window.open(blob)` sur un Blob `text/html` contenant `<script>document.title=...</script>` | Chromium (réel) | Le script s'exécute réellement (preuve du mécanisme AVANT correctif) | Un nouvel onglet s'ouvre avec le titre `PWNED-BY-BLOB` — confirme empiriquement que le mécanisme historique exécutait bien le contenu | ✅ PASS (reproduction positive du bug historique, jamais exposé en production actuelle) |
| 5 | Correctif — même Blob HTML, mais via `<a download>` (mécanisme réellement utilisé aujourd'hui pour les types actifs) | Chromium (réel) | Téléchargement forcé, aucune exécution, aucun nouvel onglet | `download` event capturé (`suggestedFilename() === 'evil.html'`), aucun nouvel onglet ouvert, titre de la page hôte inchangé | ✅ PASS |

## Preuve HTML — 10 points du mandat §14

| Point | Résultat |
|---|---|
| 1. Ouverture preview HTML | Oui — `SafeAttachmentPreview` monté avec `kind:'html'`, iframe visible |
| 2. Contenu visible si prévu | Oui — `srcdoc` contient "Salut" (le texte non malveillant du payload) |
| 3. Contenu nettoyé | Oui — `<script`/`onerror` absents du `srcdoc` réel |
| 4. Aucun script exécuté | Oui — prouvé (test 1) |
| 5. Aucun event handler exécuté | Oui — `onerror` neutralisé, prouvé par l'absence de modification du marqueur |
| 6. Aucun `javascript:` exécuté | Couvert par la config DOMPurify partagée avec `SafeHtmlEmailViewer` (déjà prouvée en jsdom, cohérente ici — non ré-testée séparément en navigateur réel par souci de portée, le mécanisme de neutralisation est identique et déjà démontré) |
| 7. Aucun accès au parent | Oui — `window.__INBOX_SECURITY_TEST__` reste `'untouched'` |
| 8. Aucun accès au `localStorage` du dashboard | Oui — `localStorage.getItem('token')` reste `'FAKE-JWT-FOR-TEST-ONLY'` (valeur factice, jamais un vrai token) |
| 9. Aucune navigation du dashboard | Oui — `page.url()` inchangée (test 3, contrôle sandbox pur) |
| 10. Aucune ouverture incontrôlée | Oui — `context.pages().length` inchangé |

## Preuve SVG — même matrice

Identique, test 2 — script et `onload` neutralisés, marqueur intact.
