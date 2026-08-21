# INBOX-PRO-1 — Matrice de rendu email

## Pipeline avant/après

| Étape | Avant | Après |
|---|---|---|
| IMAP (`zohoImapService.js`) | `content = textContent \|\| htmlContent \|\| '(Contenu vide)'` — HTML quasi jamais utilisé (mailparser génère systématiquement un texte auto-dérivé) | `content` = texte (inchangé, fallback/recherche/notifications) ; **`html` = corps HTML original conservé séparément**, tronqué défensivement à 200 000 caractères pour ne jamais faire échouer l'import |
| Webhook legacy (`internalMailController.receiveExternalMail`) | Même bug | Même correction appliquée |
| Stockage (`InternalMail`) | `content` unique, 10 000 caractères | `content` (10 000, inchangé) **+ `html`** (nouveau champ optionnel, 200 000 caractères) |
| API | `content` seul exposé | `content` + `html` (aucun `.select()` ne les filtre — passent tels quels) |
| Frontend | `dangerouslySetInnerHTML` direct dans le DOM du dashboard, `DOMPurify.sanitize(message.content)` (donc sanitizait déjà du TEXTE, jamais du vrai HTML) | `SafeHtmlEmailViewer` : iframe sandboxée (`srcDoc`), DOMPurify appliqué au vrai `message.html`, fallback texte propre si absent |

## Test 1-16 (mandat §41) — `SafeHtmlEmailViewer.test.jsx`

| # | Cas | Résultat |
|---|---|---|
| 1 | Texte simple | ✅ Fallback texte, jamais interprété comme HTML |
| 2 | HTML simple | ✅ Rendu en iframe sandboxée |
| 3 | Signature | NON CONFIRMÉ — aucun test dédié distinct (couvert implicitement par le cas HTML simple/tableau ; une signature HTML typique ne présente pas de structure différente d'un email HTML classique) |
| 4 | Tableau | ✅ Conservé intact (`<table>`, contenu) |
| 5 | Tableau large | NON CONFIRMÉ automatisé (JSDOM ne mesure pas de layout réel) — le CSS injecté (`overflow-x:auto` sur `body`) est en place et documenté, à valider visuellement en environnement réel |
| 6 | Image externe | ✅ `src` conservé intact |
| 7 | Image responsive | Couvert par le CSS injecté (`img{max-width:100%}`), non testé automatiquement (mesure de layout) |
| 8 | Liens | ✅ Conservés + forcés `target="_blank"`/`rel` sécurisé |
| 9 | Listes | NON CONFIRMÉ automatisé — aucune règle de sanitization ne les affecte (tags standards autorisés par défaut DOMPurify), risque jugé négligeable |
| 10 | Facture HTML | Couvert par le test tableau (#4) — structure équivalente |
| 11 | Newsletter | Couvert par le test `<style>` — non testé avec un fixture newsletter réaliste complet (NON CONFIRMÉ) |
| 12 | HTML malveillant (général) | ✅ Voir #13-16 |
| 13 | `<script>` | ✅ Retiré systématiquement |
| 14 | Event handlers (`onerror`, `onclick`) | ✅ Retirés systématiquement |
| 15 | `javascript:` URL | ✅ Neutralisée |
| 16 | CSS essayant de sortir du viewer | ✅ Structurellement impossible — le CSS est confiné dans l'iframe sandboxée (isolation par construction, pas par sanitization), `<style>` conservé sans risque pour le dashboard |

Tests complémentaires ajoutés au-delà de la liste du mandat : `<iframe>`/`<object>`/`<form>` imbriqués retirés ; HTML entièrement neutralisé retombe proprement sur le texte ; absence totale de contenu affiche un message explicite (jamais `undefined`/`[object Object]`).

## CID (images inline)

**ABSENT, documenté, non implémenté ce sprint.** `zohoImapService.js` upload bien les pièces jointes (y compris celles avec un `cid`), mais aucune réécriture de `cid:xxx` → URL n'existe dans le HTML stocké. Une image inline dans un email HTML entrant s'affichera donc comme une image cassée (`<img src="cid:...">` ne résout vers rien). Nécessite un traitement dédié (associer `parsed.attachments[].cid` à l'asset uploadé, réécrire le HTML avant stockage) — **hors périmètre de ce sprint**, dette explicitement documentée, pas simulée comme fonctionnelle.

## Images distantes / tracking pixels

**NON CONFIRMÉ / non modifié.** Aucune politique de blocage de tracking pixel n'existait avant ce sprint et aucune n'a été ajoutée — les images externes se chargent normalement dans l'iframe (comportement identique à un navigateur standard). Un email contenant un pixel de tracking chargera ce pixel. Ce risque de confidentialité est documenté mais non traité (aucune politique préexistante à conserver, et créer une politique de blocage d'images n'était pas démontré comme un besoin par le mandat au-delà de la mention de vigilance).

## Encodage

**NON CONFIRMÉ / non ré-audité en détail.** `mailparser` gère nativement le décodage MIME (quoted-printable/base64/charset) avant que `parsed.text`/`parsed.html` ne soient lus — ce sprint n'a pas modifié cette étape ni testé spécifiquement les accents/emoji/caractères français, faisant confiance au comportement existant de la bibliothèque (déjà en production).

## Quoted replies (`gmail_quote`, "Le ... a écrit :")

**NON CONFIRMÉ / non traité.** Aucune détection ni condensation de citations n'existait avant ce sprint ; aucune n'a été ajoutée. Le contenu cité s'affiche tel quel dans le HTML (conservé, pas de perte de contenu) mais sans traitement spécial de condensation.
