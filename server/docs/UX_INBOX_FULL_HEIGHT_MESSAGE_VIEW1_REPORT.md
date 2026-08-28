# UX-INBOX-FULL-HEIGHT-MESSAGE-VIEW-1 — Rapport final

## Verdict

**INBOX FULL-HEIGHT VIEW CERTIFIED GREEN.**

La correction reste limitée à la vue frontend `/dashboard/messages`, à son test composant ciblé et au présent rapport. Aucun comportement backend, API, ingestion email ou autorité Messaging n'a été modifié.

## Cause racine

Le panneau de lecture empilait deux conteneurs portant `overflow-y-auto` : le wrapper du message sélectionné puis le body de `ConversationViewer`. En parallèle, `ConversationViewer` retournait un fragment sans racine flex contrainte. Le header et le body ne se partageaient donc pas la hauteur du panneau comme deux enfants d'une colonne flex, ce qui créait un viewport interne artificiel et pouvait faire défiler le header avec le contenu.

L'iframe sécurisée n'était pas la cause : sa hauteur suit déjà la hauteur mesurée du document sanitizé, avec une borne haute destinée aux emails longs.

## Fichiers modifiés

- `client/lib/pages/dashboard/InternalMessagingPage.jsx`
- `client/lib/__tests__/InternalMessagingPageUX.test.jsx`
- `server/docs/UX_INBOX_FULL_HEIGHT_MESSAGE_VIEW1_REPORT.md`

## Anciennes contraintes et nouvelle stratégie

- Ancien wrapper lecteur : `min-h-0 flex-1 overflow-y-auto`.
- Ancien body : `flex-1 overflow-y-auto`, sans `min-h-0` dans une vraie racine flex.
- Nouveau wrapper lecteur : colonne flex contrainte, `min-h-0 flex-1 flex flex-col overflow-hidden`.
- Nouvelle racine `ConversationViewer` : `flex min-h-0 flex-1 flex-col`.
- Header : hauteur naturelle, `flex-shrink-0`, placé hors de la zone scrollable.
- Body : `min-h-0 flex-1 overflow-y-auto overflow-x-hidden` ; il utilise tout l'espace restant et devient l'unique scroll vertical du message.
- Liste : `min-h-0 flex-1 overflow-y-auto` ; son scroll reste indépendant.

La hauteur viewport existante de l'Inbox (`100dvh` moins l'espace réel du dashboard selon le breakpoint) et les largeurs de colonnes ont été conservées.

## Comportements validés

- Email court ou moyen : affiché immédiatement ; le body occupe toute la hauteur restante sans petit viewport imbriqué.
- Email long : un seul scroll vertical pertinent apparaît dans le body du message.
- Header : reste visible au-dessus du body scrollable.
- Liste : conserve son propre scroll sans déplacer le message lu.
- Largeur : le body masque le débordement horizontal global ; l'iframe reste à `width: 100%` et son CSS interne conserve `img { max-width: 100%; height: auto; }`.
- Responsive : la navigation mobile dossiers → liste → détail et ses retours locaux sont inchangés et couverts par les tests existants.
- Sécurité : iframe, sanitization et sandbox `allow-popups allow-popups-to-escape-sandbox` préservées ; aucun `allow-scripts`, `allow-same-origin`, `dangerouslySetInnerHTML` ou assouplissement CSP ajouté.

## Gates

| Gate | Résultat |
|---|---|
| Tests Messaging/Inbox ciblés | **PASS** — 3 fichiers, 29 tests |
| Contrat pleine hauteur / scroll | **PASS** — liste indépendante, wrapper non scrollable, body unique scrollable, header hors body |
| Sandbox renderer | **PASS** — attribut exact conservé, scripts et same-origin non autorisés |
| Responsive Inbox | **PASS** — navigation mobile existante couverte |
| Lint frontend pertinent | **PASS** — 0 erreur, 0 avertissement sur les 3 fichiers ciblés |
| Build Next.js production | **PASS** — compilation, validation et génération des 144 pages réussies ; avertissements préexistants hors scope uniquement |
| `git diff --check` | **PASS** |

## Livraison

Commit : **NON**  
Push : **NON**  
Deploy : **NON**

