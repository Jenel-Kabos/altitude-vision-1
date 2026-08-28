# AUDIT-INBOX-EMAIL-IFRAME-HEIGHT-2 — Rapport

## Verdict

**A. ROOT CAUSE CONFIRMED — IFRAME/EMAIL BODY HEIGHT BUG.**

Le correctif `UX-INBOX-FULL-HEIGHT-MESSAGE-VIEW-1` a réparé la chaîne flex externe, mais le renderer email conserve un viewport iframe de **80 px**. Sa tentative de redimensionnement lit `iframe.contentWindow.document`; Chromium la refuse avec `SecurityError`, conformément au sandbox sans `allow-same-origin`. Le `catch` réapplique alors explicitement `80 px`. Le document email, plus haut que son viewport, devient la zone scrollable visible tandis que le panneau parent reste largement vide.

Audit read-only : aucun code applicatif, backend, test ou configuration de sécurité n'a été modifié. Seul ce rapport a été créé.

## 1. Baseline

| Question | Résultat |
|---|---|
| Branche | `main` |
| HEAD | `3a22c08987bb7427981666c541316324b6f53a27` — conforme au release attendu `3a22c08...` |
| Worktree propre | **NON** avant l'audit : `M server/docs/RELEASE_CONSOLIDATION_INBOX_RENTAL_DASHBOARD1_REPORT.md`, modification préexistante, hors périmètre et préservée |
| `git diff --check` initial | PASS |

## 2. Chaîne de layout tracée

| Niveau | Élément / composant | Règles pertinentes |
|---|---|---|
| Page Inbox | root `InternalMessagingPage` | `display:flex`; desktop `height:calc(100dvh - 3rem)`; mobile `calc(100dvh - 7.5rem)`; `min-height:32rem`; `overflow:hidden` |
| Reading pane | panneau droit | `display:flex`; `flex-direction:column`; `flex:1 1 0%`; `min-width:0`; aucune hauteur fixe propre; hérite de la hauteur du root |
| Message container | `inbox-message-viewer` | `display:flex`; colonne; `min-height:0`; `flex:1`; `overflow:hidden` |
| Viewer | `ConversationViewer` root | `display:flex`; colonne; `min-height:0`; `flex:1` |
| Header | premier enfant du viewer | `flex-shrink:0`; hors de la zone de scroll |
| Email body wrapper | `inbox-message-body-scroll` | `min-height:0`; `flex:1`; `overflow-y:auto`; `overflow-x:hidden`; padding horizontal 24 px, vertical 20 px |
| Renderer | `SafeHtmlEmailViewer` | iframe directe, sans wrapper supplémentaire |
| Iframe | `email-html-frame` | inline `width:100%`, **`height:80px` initial**, `border:none`, `display:block`; aucune classe, aucun `min-height`, aucun `max-height`, aucun attribut HTML `height` ou `scrolling` |
| Document iframe | `srcDoc` | `html, body { margin:0; padding:0 }` |
| Body iframe | CSS injecté | padding `16px`; `box-sizing:border-box`; `overflow-x:auto`; pas de `height`/`min-height`/`max-height` déclaré |

La chaîne flex externe est désormais cohérente. La contrainte fautive se situe au dernier niveau : l'iframe est un item de hauteur intrinsèque/inline de 80 px et ne grandit pas avec le panneau.

## 3. Preuve Chromium réelle

Une page locale synthétique a reproduit sans donnée de production les règles exactes du renderer : panneau de 700 px, wrapper parent `overflow-y:auto`, iframe sandboxée identiquement, hauteur initiale 80 px, même handler `load`, même `srcDoc` et contenus de 250, 600 et 1400 px. Mesures Playwright/Chromium :

| Contenu fixture | Reading pane `clientHeight` | Wrapper `clientHeight / scrollHeight` | Iframe `clientHeight / offsetHeight` | Document `html clientHeight / scrollHeight` | Résultat |
|---:|---:|---:|---:|---:|---|
| 250 px | 700 | 700 / 700 | **80 / 80** | 80 / 282 | scroll interne iframe |
| 600 px | 700 | 700 / 700 | **80 / 80** | 80 / 632 | scroll interne iframe |
| 1400 px | 700 | 700 / 700 | **80 / 80** | 80 / 1432 | scroll interne iframe |

Dans les trois cas :

- le handler rencontre `SecurityError` ;
- le parent ne déborde pas (`scrollHeight === clientHeight === 700`) ;
- `document.scrollingElement === document.documentElement` (`html`) dans l'iframe ;
- le body interne calcule `overflow-x:auto` et `overflow-y:auto` ;
- le viewport du document iframe reste 80 px.

La capture Chromium existante `client/e2e/inbox2/screenshots/desktop-light.png`, produite avec le vrai composant et les fixtures Inbox, montre aussi le contenu coupé dans une bande basse alors que le panneau droit est haut. Elle constitue une preuve visuelle concordante ; ses dimensions DOM contemporaines au HEAD actuel ne sont toutefois pas enregistrées, donc les hauteurs exactes de la page complète sont **NON CONFIRMÉES**. Les valeurs ci-dessus sont des mesures réelles de la reproduction isolée du mécanisme fautif, pas des valeurs inventées pour la production.

## 4. Propriétaire exact du scroll

La scrollbar en cause est celle du **browsing context de l'iframe / document iframe**, catégorie **E** (son élément scroll racine est `html`). Ce n'est ni le reading pane, ni `ConversationViewer`, ni le wrapper parent dans la reproduction : leur contenu ne dépasse pas leur hauteur. Le body contribue à la hauteur et calcule un overflow automatique, mais l'élément de scrolling du document observé par Chromium est `html`.

La règle/chaîne JS exacte responsable est :

1. `const MIN_HEIGHT = 80` ;
2. état initial `useState(MIN_HEIGHT)` ;
3. inline `style.height = height`, donc 80 px au premier rendu ;
4. au `load`, lecture de `iframe.contentWindow.document` ;
5. sandbox opaque-origin : lecture interdite ;
6. `catch { setHeight(MIN_HEIGHT); }`, donc maintien explicite à 80 px.

Une borne `MAX_HEIGHT = 4000` existe, mais elle n'intervient jamais dans ce chemin d'échec. Il n'existe pas de `max-height` CSS sur l'iframe.

## 5. Sandbox et sécurité

Sandbox actuel : `allow-popups allow-popups-to-escape-sandbox`, sans `allow-scripts` et sans `allow-same-origin`. Le `srcDoc` reçoit au préalable le résultat de `sanitizeForSandboxedIframe` (DOMPurify et durcissement des liens).

Sans `allow-same-origin`, le document sandboxé reçoit une origine opaque ; le parent ne peut donc pas lire son DOM/`scrollHeight`. C'est volontaire et la mesure actuelle ne peut pas fonctionner dans Chromium. **Il ne faut pas ajouter `allow-same-origin`, ni scripts, ni relâcher DOMPurify. Aucune modification de sécurité n'est nécessaire ou recommandée.**

## 6. Pourquoi les tests précédents étaient verts

Le test `pleine hauteur` de `InternalMessagingPageUX.test.jsx` vérifie uniquement :

- les classes flex/overflow des conteneurs parents ;
- que le header est hors du wrapper scrollable ;
- `width:100%` et `display:block` sur l'iframe ;
- le sandbox.

Il ne vérifie ni `clientHeight`, ni `scrollHeight`, ni le succès du handler `load`, ni l'origine du scroll, ni les cas court/moyen/long. Il n'affirme même pas que la hauteur de l'iframe dépasse 80 px. jsdom ne fournit pas un moteur de layout fiable et ne reproduit pas fidèlement la frontière opaque-origin du sandbox ; il est donc insuffisant pour certifier ce bug. Les tests ont correctement couvert le parent, mais leur intitulé et la certification ont dépassé leur preuve.

Test manquant : un test composant en vrai Chromium, montant le vrai `InternalMessagingPage`/`SafeHtmlEmailViewer` avec fixtures 250/600/1400 px et affirmant les zones réellement scrollables via `clientHeight`, `scrollHeight` et `document.scrollingElement`. Une capture seule ne suffit pas ; les assertions DOM/layout doivent accompagner la validation desktop, DevTools-width, tablette et mobile.

## 7. Findings démontrés

### IH2-F01 — Iframe bloquée à la hauteur minimale

Sévérité : haute. L'iframe est initialisée à 80 px et le chemin d'erreur la remet à 80 px. Confirmé par code et Chromium.

### IH2-F02 — Mesure `scrollHeight` incompatible avec le sandbox

Sévérité : haute. La lecture parent → document échoue avec `SecurityError` en l'absence volontaire de `allow-same-origin`. Confirmé par Chromium.

### IH2-F03 — Scroll interne du document iframe

Sévérité : haute UX. Pour 250, 600 et 1400 px de contenu, le viewport iframe reste 80 px et `html` devient l'élément scroll racine. Confirmé par mesures.

### IH2-F04 — Faux positif de couverture layout

Sévérité : moyenne. Le test précédent valide seulement les classes du parent et la présence sécurisée de l'iframe, jamais sa hauteur effective ni le nested scroll.

La chaîne flex externe n'est pas retenue comme seconde root cause : aucune rupture n'a été trouvée dans le code actuel et la reproduction garde le parent à 700/700 sans overflow.

## 8. Correctif minimal recommandé — à ne pas implémenter dans cet audit

Choix architectural recommandé pour les emails longs : **B, iframe dimensionnée au viewport disponible**, avec l'iframe comme unique scroll vertical du corps email. Une mesure automatique du contenu est incompatible avec le sandbox actuel ; il faut donc dimensionner le viewport, pas inspecter le document.

| Fichier futur | Composant / élément | Actuel | Modification minimale recommandée |
|---|---|---|---|
| `client/lib/pages/dashboard/InternalMessagingPage.jsx` | `inbox-message-body-scroll` | `overflow-y-auto`, contient iframe + pièces jointes | en faire un conteneur flex colonne `min-h-0 flex-1 overflow-hidden`; garder les pièces jointes non rétractables |
| `client/lib/components/messaging/SafeHtmlEmailViewer.jsx` | iframe | état/handler de mesure et hauteur inline 80..4000 px | retirer la mesure parent→document devenue inopérante ; rendre l'iframe `min-height:0; flex:1 1 0%; height:100%` dans l'espace disponible |
| `client/lib/__tests__/InternalMessagingPageUX.test.jsx` et/ou test unitaire renderer | assertions structurelles | ne mesure pas le viewport | ajuster la structure attendue, sans prétendre certifier le layout réel |
| `client/e2e/inbox2/…` | test Chromium Inbox | capture visuelle sans assertions de scroll | ajouter des fixtures court/moyen/long et assertions de layout/scroll réelles |

Comportement cible :

- court (250/700) : iframe haute comme l'espace disponible, document non scrollable ;
- moyen (600/700) : contenu entièrement visible, document non scrollable ;
- long (1400/700) : iframe haute comme le viewport disponible, **un seul scroll**, celui du document iframe ;
- liste gauche : conserve son scroll indépendant ;
- header : reste fixe ;
- mobile/tablette : même modèle mono-scroll dans le volet détail ; à valider en Chromium aux breakpoints réels ;
- sécurité : sandbox et sanitization strictement inchangés.

La gestion des pièces jointes devra être caractérisée dans le test futur (bandeau hors iframe, `flex-shrink:0`) afin qu'elle ne réintroduise pas un scroll parent. Aucun backend n'est impliqué.

## 9. Réponses obligatoires

1. HEAD ? `3a22c08987bb7427981666c541316324b6f53a27`.  
2. Worktree propre ? NON, un rapport de consolidation préexistant était modifié.  
3. Reading pane ? Panneau droit flex de `InternalMessagingPage`.  
4. Email body ? `SafeHtmlEmailViewer`, dans `ConversationViewer`.  
5. Iframe ? OUI.  
6. Créée où ? `client/lib/components/messaging/SafeHtmlEmailViewer.jsx`.  
7. Hauteur reading pane ? Dépend du root (`100dvh - 3rem` desktop) ; reproduction mesurée 700 px ; production exacte NON CONFIRMÉE.  
8. Hauteur viewer ? Flex 1 dans le panneau ; reproduction utile 700 px au niveau disponible ; page complète exacte NON CONFIRMÉE.  
9. Hauteur wrapper ? Reproduction : 700 px client/700 px scroll.  
10. Hauteur iframe ? **80 px** client/offset dans tous les cas mesurés.  
11. Élément de scrollbar ? Document iframe, scrolling root `html`.  
12. CSS/JS responsable ? `height:80px` issu de l'état et réappliqué dans le `catch` après `SecurityError`.  
13. Hauteur fixe ? OUI, 80 px effectifs.  
14. Max-height ? Pas en CSS ; borne JS 4000 px inaccessible sur ce chemin.  
15. Overflow interne ? OUI.  
16. Document iframe avec overflow propre ? OUI, viewport 80 px et scrolling root `html`; body calcule aussi `overflow-y:auto`.  
17. Mesure `scrollHeight` ? OUI, `documentElement.scrollHeight`, fallback `body.scrollHeight`.  
18. Fonctionne avec sandbox ? NON, `SecurityError` confirmé.  
19. Sandbox ? `allow-popups allow-popups-to-escape-sandbox`.  
20. Sanitization préservée ? OUI, inchangée.  
21. Modifier sécurité ? NON.  
22. Tests verts pourquoi ? Classes parent/sandbox seulement, aucune géométrie réelle.  
23. Scénario absent ? iframe 80 px avec contenus court/moyen/long et scroll interne.  
24. jsdom suffisant ? NON.  
25. Browser test requis ? OUI.  
26. Root cause ? Mesure DOM interdite par sandbox, puis fallback explicite à 80 px.  
27. Fix minimal ? Iframe flex pleine hauteur du viewport disponible, un seul scroll interne pour les longs contenus, aucune mesure cross-origin.  
28. Fichiers futurs ? Les quatre surfaces listées au §8 ; deux fichiers de production.  
29. Backend ? NON.  
30. Code modifié ? NON.  
31. Commit ? NON.  
32. Push ? NON.  
33. Deploy ? NON.  
34. Verdict ? **A. ROOT CAUSE CONFIRMED — IFRAME/EMAIL BODY HEIGHT BUG.**
