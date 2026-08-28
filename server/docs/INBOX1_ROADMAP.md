# INBOX-1 — ROADMAP RECOMMANDÉE (BASÉE SUR PREUVES)

La roadmap indicative du mandat est globalement confirmée pertinente, avec un **réordonnancement justifié par les preuves** : deux corrections de sécurité P0 découvertes pendant l'audit (endpoint `emailRoutes.js` non authentifié, pièces jointes SVG/HTML non sanitizées si ouvertes directement) doivent précéder toute amélioration visuelle, car elles sont indépendantes de l'UX et représentent un risque réel dès aujourd'hui — les corriger n'attend pas une refonte.

## HOTFIX (avant INBOX-2, hors roadmap viewers — recommandé, non exécuté)

Deux corrections ponctuelles, sans lien avec les viewers, découvertes par cet audit :
1. **Authentifier `emailRoutes.js`** (`/api/emails/*`) — actuellement 100% ouvert, aucun `protect`. Risque immédiat indépendant de toute décision produit.
2. **Router tout fichier `.html`/`.svg` en pièce jointe à travers la même sanitization que le corps d'email** avant `window.open`, au lieu du `window.open(blob)` brut actuel dans `previewInternalMailAttachment`.

Ces deux points sont des candidats de hotfix ciblé, pas un sprint d'architecture — je recommande de les traiter séparément et rapidement, avant ou en parallèle d'INBOX-2, plutôt que de les laisser attendre la fin de la roadmap complète.

## INBOX-2 — Refonte UX professionnelle de la boîte de réception

Confirmée pertinente. Cible technique concrète révélée par l'audit : extraire `ConversationViewer` (actuellement inline, 70 lignes dans `InternalMessagingPage.jsx`) dans son propre fichier, et extraire la couche data-fetching (13 appels de service actuellement dans le composant de page) dans un hook dédié — avant d'ajouter de nouvelles fonctionnalités UI sur un fichier de 792 lignes.

## INBOX-3 — `AttachmentViewerRegistry` + contrat MIME normalisé

Confirmée pertinente et faisable sans changement de modèle de données (le MIME est déjà stocké). **Condition ajoutée par cet audit** : le registry doit router sur un MIME re-vérifié/normalisé, jamais sur la valeur brute déclarée par l'expéditeur — sinon le registry lui-même devient un nouveau vecteur de confusion de type (voir `INBOX1_TARGET_ARCHITECTURE.md`).

## INBOX-4 — Viewers fondamentaux (image, PDF, texte, code, CSV/tableau, fallback)

Confirmée pertinente, avec deux ajouts de sécurité obligatoires révélés par l'audit, à traiter DANS ce sprint et non après :
- `ImageViewer` doit sanitizer tout SVG avant rendu (jamais un `<img src=blob>` direct pour ce MIME).
- `TableViewer` (CSV) doit échapper les cellules `=`/`+`/`-`/`@` dès sa première version, pas dans un correctif ultérieur.

## INBOX-5 — `SafeHtmlEmailViewer` : sanitization, sandbox, CID, images distantes, tracking

**Changement important par rapport à la roadmap indicative du mandat** : la sanitization et le sandbox de `SafeHtmlEmailViewer` **existent déjà et sont corrects** (voir `INBOX1_SECURITY_MATRIX.md`) — ce sprint n'a pas besoin de les (re)construire. Son périmètre réel, réduit et donc probablement plus rapide que prévu :
1. Ajouter la conservation du Content-ID au parsing backend (`zohoImapService.js`) — seul changement backend nécessaire.
2. Résoudre `cid:` → URL d'attachment existante dans `SafeHtmlEmailViewer` avant sanitization.
3. Ajouter le blocage des images distantes par défaut + bouton "Afficher les images" (hook `beforeSanitizeAttributes` symétrique au hook existant).

## INBOX-6 — Office (Word, Excel, PowerPoint)

Confirmée comme le sprint le plus coûteux et le moins mature de la roadmap — **aucune bibliothèque candidate n'est installée ni identifiée avec un niveau de confiance suffisant** pour PowerPoint en particulier (voir `INBOX1_TARGET_ARCHITECTURE.md`). Recommandation : traiter Word/Excel séparément de PowerPoint, et accepter un simple téléchargement pour PowerPoint à moyen terme plutôt que de bloquer tout le sprint sur ce format.

## INBOX-7 — Audio/vidéo + galerie + preview avancée

Confirmée simple pour audio/vidéo standards (support natif navigateur). **Point de vigilance ajouté par l'audit, non vérifié** : confirmer le support des Range requests HTTP par la configuration Cloudinary actuelle avant de promettre un seek fluide en vidéo.

## INBOX-8 — Email → CRM

Aucune connexion effectuée pendant cet audit (conforme au mandat). Constat utile pour la suite : le modèle `InternalMail` n'a aujourd'hui aucun champ de liaison CRM (pas de `contact`/`lead`/`opportunity` référencé) — cette roadmap nécessitera une extension de schéma, pas une simple UI, quand elle sera abordée. Hors périmètre de tout chiffrage dans ce tour.

## Coût architectural estimé (qualitatif, pas un chiffrage en jours — mandat §58)

Du moins coûteux au plus coûteux, sur la base des preuves ci-dessus : **INBOX-3 et INBOX-5 sont plus légers que ne le laissait supposer la roadmap indicative** (l'essentiel de la sécurité HTML est déjà fait) ; **INBOX-4** est de complexité moyenne mais comporte des obligations de sécurité non négociables (SVG, CSV) ; **INBOX-6 (Office)** reste, comme anticipé, le sprint le plus coûteux et le plus incertain, faute de bibliothèque déjà présente ou clairement candidate.
