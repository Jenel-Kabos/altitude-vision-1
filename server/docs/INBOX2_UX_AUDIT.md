# INBOX-2 — AUDIT UX PAR SURFACE

| Surface | Before | Problem | Change | Business impact |
|---|---|---|---|---|
| Liste des messages | Déjà dense, hiérarchie lu/non-lu (gras/normal), badge étoile/pièce jointe, date relative | Aucun problème trouvé | Aucun | — |
| Toolbar/recherche | Recherche + filtres (Tous/Non lus/Avec pièce jointe) déjà présents | Aucun problème trouvé | Aucun | — |
| Sélection | `ConversationRow` déjà un vrai `<button>`, `aria-current`, fond bleu + bordure gauche | Aucun problème trouvé | Aucun | — |
| Header message | Sujet, avatar+nom expéditeur (cliquable → drawer), date complète, badge priorité | Aucun problème trouvé | Aucun | — |
| **Corps HTML** | `SafeHtmlEmailViewer`, DOMPurify + iframe sandbox | **Confirmé par capture d'écran réelle (Chromium, mode sombre) : texte quasiment illisible** — l'iframe est un document séparé, les tokens dark mode du dashboard ne peuvent pas la traverser ; sans fond explicite, Chromium assombrit automatiquement le fond du document tout en gardant la couleur de texte codée en dur (`#1f2937`, sombre) → texte sombre sur fond sombre | Ajout d'un bloc `@media (prefers-color-scheme: dark)` dans `BASE_STYLE` (fond + texte + liens explicites, mêmes valeurs que les tokens `--db-*` du dashboard) — sandbox/DOMPurify/config de sanitization intacts | Emails illisibles en mode sombre pour tout utilisateur ayant activé ce mode ou dont l'OS l'impose — impact direct sur l'utilisabilité quotidienne de l'Inbox |
| Corps texte simple | `<pre>` avec classes `text-gray-700`, dans le DOM parent | Déjà couvert par la couche de compatibilité dark mode du dashboard (`text-gray-700` → `var(--db-text)`), confirmé par lecture de `dashboard.css` | Aucun | — |
| Pièces jointes | Icône (image générique vs fichier générique), nom, taille, voir/télécharger | Toutes les pièces jointes non-image partagent la même icône générique (`FileText`), quel que soit le type réel (PDF, Excel, archive, audio, vidéo...) | Classification présentationnelle par catégorie (`attachmentPresentation.js`) → icône dédiée par famille (PDF, Office Word/Sheet/Slide, archive, audio, vidéo, texte) | Repérage visuel plus rapide du type de fichier dans une conversation à plusieurs pièces jointes |
| États loading | Skeleton de liste déjà présent (8 lignes animées) | Aucun problème trouvé (dark mode : skeleton utilise `bg-gray-200`/`bg-gray-100`, déjà couverts par la compatibilité dashboard) | Aucun | — |
| État empty | Différencié : "Aucun message." vs "Aucun résultat." (recherche/filtre actif) vs "Sélectionnez une conversation..." | Aucun problème trouvé | Aucun | — |
| État error | Message clair + bouton "Réessayer" | Aucun problème trouvé | Aucun | — |
| Pagination | Non applicable — l'API retourne la liste complète par dossier, aucune pagination backend actuellement exposée au frontend pour ce dossier (voir `INBOX1_ENDPOINT_MATRIX.md`) | — | Aucun ajout — mandat §10 interdit de simuler une fonctionnalité backend absente | — |
| Responsive | Déjà mono-écran mobile (dossiers → liste → lecture), déjà testé (`InternalMessagingPageUX.test.jsx`) | Aucun problème trouvé, confirmé par capture d'écran réelle (390×844) | Aucun | — |
| Dark mode (shell) | Nav rail, liste, toolbar, header, cartes de pièces jointes déjà correctement sombres via `.dashboard-content-inner` | Aucun problème trouvé sur le shell — uniquement l'iframe HTML (ci-dessus) | Aucun sur le shell | — |
| Accessibilité | `ConversationRow`/boutons d'action déjà des éléments natifs avec `aria-label`/`focus-visible` | Aucune régression trouvée ; pas d'audit exhaustif WCAG complet effectué (hors périmètre d'un audit ciblé, mandat ne le demande pas explicitement au-delà de contrastes/clavier/labels déjà couverts) | Aucun | — |

## Fonctionnalités NON ajoutées (mandat §10 — pas de faux bouton)

Archive, spam, dossiers personnalisés, labels, threading, reply-all, forward : **aucun de ces éléments n'existe côté backend** (`InternalMail` n'a ni `folder` personnalisé, ni `threadId`/`inReplyTo`, ni notion de spam — confirmé par `INBOX1_MIME_PIPELINE.md`/`ARCH2C2_MESSAGE_CONTRACT.md`), déjà documenté comme tel par `INBOX_PRO2_UX_AUDIT.md` §1. Aucun bouton fictif n'a été ajouté pour ces fonctionnalités.
