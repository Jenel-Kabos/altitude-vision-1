# HOTFIX-INBOX-EMAIL-IFRAME-HEIGHT-3 — Rapport final

## Verdict

**A. INBOX EMAIL HEIGHT HOTFIX CERTIFIED GREEN.**

Le renderer email n'est plus bloqué à 80 px. L'iframe remplit désormais l'espace restant du panneau de lecture sans inspecter son document sandboxé. En Chromium réel, les emails court et moyen tiennent sans scroll interne ; l'email long possède un unique scroll utile dans une iframe de 695 px. Le sandbox et la sanitization sont inchangés.

## Baseline et périmètre

- Branche : `main`.
- HEAD initial : `3a22c08987bb7427981666c541316324b6f53a27`.
- Modification préexistante préservée intégralement : `server/docs/RELEASE_CONSOLIDATION_INBOX_RENTAL_DASHBOARD1_REPORT.md`.
- Rapport d'audit IH2 déjà présent avant ce hotfix : `server/docs/AUDIT_INBOX_EMAIL_IFRAME_HEIGHT2_REPORT.md`.
- Aucun backend métier, Mongo, API, dépendance, commit, push ou déploiement.

## Correction

### Renderer

`client/lib/components/messaging/SafeHtmlEmailViewer.jsx` :

- suppression de `MIN_HEIGHT = 80` et `MAX_HEIGHT = 4000` ;
- suppression de l'état de hauteur, de la ref, du handler `load` et du `try/catch` ;
- suppression complète de la lecture `iframe.contentWindow.document` et des `scrollHeight` depuis l'application ;
- iframe pilotée uniquement par le layout : `width:100%`, `height:100%`, `minHeight:0`, `flex:1 1 0%`.

### Panneau de lecture

`client/lib/pages/dashboard/InternalMessagingPage.jsx` :

- body area passée à `display:flex`, colonne, `min-height:0`, `flex:1`, `overflow:hidden` ;
- iframe = viewport principal du corps email ;
- bandeau des pièces jointes conservé hors iframe et rendu non rétractable (`flex-shrink-0`) ;
- liste gauche inchangée et toujours `overflow-y:auto`.

Pour le corps du message : zéro zone scrollable si le document tient, une seule zone scrollable (document iframe) s'il dépasse. Le wrapper parent ne scrolle plus et ne peut donc plus former un nested scroll.

## Sécurité

| Contrôle | Avant | Après |
|---|---|---|
| Sandbox | `allow-popups allow-popups-to-escape-sandbox` | identique |
| `allow-same-origin` | absent | absent |
| `allow-scripts` | absent | absent |
| Pipeline | `sanitizeForSandboxedIframe` / DOMPurify | identique |
| `sanitizeSandboxedHtml.js` | référence | aucun diff |
| Accès parent au document iframe | tentative invalide | aucun accès |

Aucun postMessage, script injecté, bridge, rendu HTML brut ou relâchement de l'isolation n'a été introduit.

## RED → GREEN Chromium

Le test permanent monte le vrai `InternalMessagingPage`, le vrai renderer et le CSS de production avec trois fixtures HTML réalistes constituées de paragraphes, sans image réseau ni hauteur CSS artificielle.

### RED avant correction

- desktop court : iframe reçue **80 px**, minimum attendu 685 px ; test en échec ;
- viewport 1024×768 moyen : iframe reçue **80 px**, minimum attendu 553 px ; test en échec ;
- résultat : **2 tests échoués**, reproduction du bug certifiée.

### GREEN après correction — desktop 1440×900

| Cas | Reading pane | Body area client/scroll | Iframe | Document interne client/scroll | Scroll email |
|---|---:|---:|---:|---:|---|
| Court | 852 px | 735 / 735 px | **695 px** | 695 / 695 px | aucun |
| Moyen | 852 px | 735 / 735 px | **695 px** | 695 / 695 px | aucun |
| Long | 852 px | 735 / 735 px | **695 px** | 695 / 1283 px | un, dans l'iframe |

Dans tous les cas desktop : wrapper `overflow-y:hidden`, liste gauche `overflow-y:auto`, scrolling root du document email `html`, sandbox strictement identique.

### Viewport réduit et mobile

| Viewport | Reading pane | Body area client/scroll | Iframe | Document client/scroll | Résultat |
|---|---:|---:|---:|---:|---|
| 1024×768 (DevTools-width représentatif) | 720 px | 603 / 603 px | **563 px** | 563 / 869 px | iframe plein espace, un scroll interne nécessaire après wrapping |
| 390×844 mobile | 663 px | 546 / 546 px | **506 px** | 506 / 869 px | iframe plein espace, un scroll interne nécessaire après wrapping |

Le contenu moyen devient plus haut aux largeurs réduites par retour à la ligne ; cela crée un scroll utile, mais jamais un viewport artificiel de 80 px ni un scroll parent imbriqué.

## Tests permanents

- `client/e2e/inbox2/fixtures.js` : fixtures IH3 court/moyen/long isolées des fixtures de captures historiques.
- `client/e2e/inbox2/inbox-visual.spec.js` : assertions Chromium sur les hauteurs, propriétaires de scroll, desktop, largeur DevTools, mobile et sandbox.
- `client/lib/__tests__/InternalMessagingPageUX.test.jsx` : structure flex/overflow cible et sandbox sans `allow-same-origin`.
- `client/lib/__tests__/SafeHtmlEmailViewer.test.jsx` : iframe à 100%, flexible, sans hauteur 80 px, sécurité inchangée.

## Gates

| Gate | Résultat |
|---|---|
| RED browser | confirmé : 2/2 tests IH3 échouaient avec iframe 80 px |
| GREEN browser permanent | **2/2 PASS** |
| Unit tests ciblés | **24/24 PASS**, 2 fichiers |
| Lint frontend complet | **PASS, 0 erreur**, 267 avertissements préexistants |
| Architecture checker | **PASS**, 0 nouvelle violation, 473 fichiers / 1574 edges |
| Next production build | **PASS**, 144 pages statiques générées |
| Recherche accès cross-origin/fallback | aucun usage applicatif restant |
| `git diff --check` | PASS final |

## Réponses obligatoires

1. HEAD initial ? `3a22c08987bb7427981666c541316324b6f53a27`.  
2. Worktree préexistant préservé ? OUI.  
3. Renderer exact ? `SafeHtmlEmailViewer`.  
4. Ancienne hauteur ? 80 px.  
5. Pourquoi ? état initial `MIN_HEIGHT`, puis fallback identique après `SecurityError`.  
6. Ancienne logique supprimée ? OUI, intégralement.  
7. `contentWindow.document` encore utilisé par l'app renderer ? NON.  
8. `contentDocument` encore utilisé ? NON.  
9. Fallback 80 px supprimé ? OUI.  
10. Nouveau modèle ? Iframe flex à 100% de la zone disponible.  
11. Propriétaire du scroll ? Document iframe seulement lorsque son contenu dépasse.  
12. Nombre de zones pour le corps email ? 0 si court/moyen desktop, 1 si long ; jamais deux. La liste gauche garde son scroll indépendant.  
13. Sandbox avant ? `allow-popups allow-popups-to-escape-sandbox`.  
14. Sandbox après ? Identique.  
15. `allow-same-origin` ajouté ? NON.  
16. Sanitization modifiée ? NON.  
17. Short iframe ? 695 px desktop.  
18. Medium iframe ? 695 px desktop.  
19. Long iframe ? 695 px desktop.  
20. Short scroll ? NON, 695/695.  
21. Medium scroll ? NON sur desktop, 695/695.  
22. Long scroll ? OUI, nécessaire et unique, 1283/695.  
23. Reading pane ? 852 px desktop ; 720 px viewport réduit ; 663 px mobile.  
24. Body area ? 735 px desktop ; 603 px réduit ; 546 px mobile.  
25. RED browser ? OUI, 80 px observés et 2 échecs.  
26. GREEN browser ? OUI, 2/2.  
27. Unit tests ? 24/24.  
28. E2E permanent ? OUI, infrastructure Inbox Playwright existante.  
29. Mobile testé ? OUI, Chromium 390×844.  
30. DevTools viewport testé ? OUI, 1024×768.  
31. Backend modifié ? NON.  
32. Mongo modifié ? NON.  
33. Sécurité affaiblie ? NON.  
34. Tests ciblés ? Unit 24/24 + browser 2/2.  
35. Lint ? PASS, 0 erreur (267 warnings préexistants).  
36. Architecture ? PASS, 0 nouvelle violation.  
37. Next build ? PASS.  
38. Diff-check ? PASS.  
39. Commit ? NON.  
40. Push ? NON.  
41. Deploy ? NON.  
42. HEAD final ? `3a22c08987bb7427981666c541316324b6f53a27`.  
43. Verdict ? **A. INBOX EMAIL HEIGHT HOTFIX CERTIFIED GREEN.**

