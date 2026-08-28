# INBOX-1 — ARCHITECTURE CIBLE (ÉVALUATION, NON IMPLÉMENTÉE)

## `AttachmentViewerRegistry` — évaluation du modèle proposé

```
AttachmentViewer
    +-- ImageViewer / PdfViewer / TableViewer / TextViewer / CodeViewer
    +-- HtmlViewer / AudioViewer / VideoViewer / OfficeViewer / GenericFileViewer
```

**Ce modèle s'intègre proprement à l'architecture actuelle**, pour trois raisons prouvées par cet audit :
1. Le point d'ancrage existe déjà et est propre : `AttachmentStrip.jsx` est un composant isolé, à un seul point d'appel (`InternalMessagingPage.jsx:526`) — brancher un registry de viewers ici ne nécessite pas de toucher au data-fetching ni au modèle backend.
2. Le pipeline attachment est **déjà uniforme** (voir `INBOX1_ATTACHMENT_MATRIX.md`) — tous les fichiers suivent le même chemin stockage/API, donc un registry basé sur le MIME normalisé côté serveur (`attachment.mimetype`, déjà présent dans le schéma) n'exige aucun changement de modèle de données.
3. `SafeHtmlEmailViewer.jsx` est déjà, de facto, une preuve que ce projet sait construire un viewer sécurisé et testé — le patron (composant dédié + config de sécurité explicite + tests ciblés) peut être répliqué pour chaque nouveau viewer.

**Condition impérative avant toute implémentation** (mandat §11, "basé prioritairement sur MIME validé côté serveur") : le MIME actuellement stocké (`attachment.mimetype`) provient du `Content-Type` **déclaré par l'expéditeur de l'email**, jamais revérifié par signature de fichier (`INBOX1_SECURITY_MATRIX.md`, "spoof MIME"). Le registry devra donc router sur un MIME **normalisé et si possible re-vérifié**, pas aveuglément sur la valeur stockée aujourd'hui — sinon un fichier renommé pourrait tromper le choix de viewer (ex. un `.html` déclaré `image/png` router vers `ImageViewer`, ou l'inverse, contournant une éventuelle sanitization conditionnelle).

## `SafeHtmlEmailViewer` — déjà implémenté, à documenter comme référence (pas à reconstruire)

Comparaison des 4 approches demandées par le mandat, **à titre de justification a posteriori de ce qui existe déjà** (pas une décision à prendre — c'est déjà fait et correct) :

| Approche | Sécurité | Fidélité | CID | CSS | Images distantes | Tracking | Responsive | Dark mode | Maintenance |
|---|---|---|---|---|---|---|---|---|---|
| A. Sanitization + DOM direct | Risque résiduel élevé (toute faille DOMPurify atteint directement le DOM du dashboard) | Bonne | Possible | Fuite possible vers le CSS du dashboard sans confinement supplémentaire | Non traité par cette seule couche | Non traité | Bonne | Bonne | Moyenne |
| B. iframe sandbox seul (sans sanitization) | Insuffisant seul — un sandbox sans `allow-scripts` bloque déjà l'exécution, mais un HTML non sanitizé reste un mauvais principe de défense en profondeur | Bonne | Possible | Confinée | Non traité | Non traité | Bonne | Nécessite injection de styles dans l'iframe | Moyenne |
| **C. Sanitization + iframe sandbox (= implémentation actuelle)** | **Excellente — double couche, confirmée par tests** | Bonne (CSS autorisé, confiné) | **Non résolu aujourd'hui** (voir limite ci-dessous — ce n'est pas un défaut de l'approche C, mais du pipeline MIME en amont) | Confinée à l'iframe, ne fuit jamais vers le dashboard | Non bloquées par défaut (voir §13) | Non bloqué par défaut | Bonne (`style={{width:'100%',...}}`) | Nécessite d'injecter les variables de thème dans le `<style>` du `srcDoc` si le dark mode doit s'y refléter (non fait aujourd'hui) | Bonne — composant petit, isolé, testé |
| D. Autre solution du projet | Aucune autre solution de rendu HTML sécurisé n'existe ailleurs dans le projet (recherche exhaustive) | — | — | — | — | — | — | — | — |

**Recommandation : conserver l'approche C actuelle telle quelle.** Aucune réécriture n'est justifiée par cet audit. Les deux lacunes réelles (CID, images distantes) sont des additions à cette architecture existante, pas des raisons de la remplacer.

## CID / images inline — mécanisme futur proposé (non implémenté)

```
cid:image001@example (dans le HTML persisté)
  → nécessite d'abord : conserver att.contentId/att.cid au moment du parsing (zohoImapService.js)
  → associer chaque pièce jointe "related" à son Content-ID dans le schéma InternalMail.attachments
  → au rendu (SafeHtmlEmailViewer), avant sanitization : remplacer les occurrences
    src="cid:XXX" par une URL contrôlée (ex. endpoint de preview déjà existant,
    /internal-mails/:id/attachments/:index, réutilisé tel quel — pas un nouvel endpoint)
  → DOMPurify sanitize (déjà en place) → iframe sandbox (déjà en place)
```
**Prérequis bloquant, confirmé par l'audit** : rien de ce mécanisme n'est possible tant que `zohoImapService.js` ne conserve pas `att.contentId`/`att.cid`/`att.related` au moment du parsing (`INBOX1_MIME_PIPELINE.md`) — c'est un changement backend minimal (ajouter la lecture de 2-3 champs déjà fournis par `mailparser`, aucune nouvelle bibliothèque), pas un changement d'architecture.

## Images distantes et tracking — politique recommandée

Bloquer par défaut (transformer `src="https://..."` en un attribut neutre avant sanitization, ou intercepter au niveau `beforeSanitizeAttributes` de DOMPurify — le hook `afterSanitizeAttributes` existe déjà dans `SafeHtmlEmailViewer.jsx`, un hook `beforeSanitizeAttributes` symétrique peut y être ajouté), avec un bouton explicite "Afficher les images" qui restaure les `src` originaux à la demande. Impact documenté : élimine par défaut les pixels de suivi (confirmation d'ouverture, fuite d'IP/User-Agent), au prix d'un clic supplémentaire pour voir des images légitimes — compromis standard de l'industrie (Gmail, Outlook appliquent la même politique par défaut).

## MIME inconnu — comportement futur du `GenericFileViewer`

Pas d'exécution, pas de rendu spéculatif. Afficher uniquement : nom de fichier, type détecté (MIME stocké, avec un avertissement explicite si non reconnu par le registry), taille, extension, icône générique, bouton de téléchargement. Si l'extension appartient à une liste d'extensions exécutables connues (`.exe`, `.bat`, `.sh`, `.js` en tant que fichier autonome téléchargé, `.jar`, etc.), afficher un avertissement visible avant le téléchargement — jamais un blocage total (l'utilisateur professionnel doit rester libre de télécharger), juste un signal.

## Office / PDF / tableaux — étude séparée par famille (mandat §15)

| Famille | Preview navigateur native | Parsing client | Parsing serveur | Bibliothèque déjà présente | Sécurité | Fidélité | Fallback |
|---|---|---|---|---|---|---|---|
| PDF | **Oui** (tous navigateurs modernes rendent un PDF nativement dans un onglet/`<embed>`) | Non nécessaire | Non nécessaire | N/A | Élevée (rendu natif sandboxé par le navigateur lui-même) | Élevée | Téléchargement si le navigateur ne supporte pas l'aperçu (rare) |
| DOC/DOCX | Non | Nécessiterait `mammoth`/équivalent — **non installé** | Alternative possible côté serveur (conversion), **non explorée, non installée** | **Aucune** | À évaluer au moment de l'implémentation | Dépend de la bibliothèque choisie | Téléchargement |
| XLS/XLSX | Non | Nécessiterait `xlsx`/équivalent — **non installé** | Idem | **Aucune** | À évaluer | Dépend | Téléchargement |
| PPT/PPTX | Non | Aucune bibliothèque candidate identifiée dans l'écosystème JS courant avec la même maturité que pour Word/Excel | Idem | **Aucune** | À évaluer | Probablement faible sans investissement important | Téléchargement — probablement le seul choix raisonnable à court terme |
| CSV | Non (le navigateur télécharge ou affiche en texte brut selon config) | Nécessiterait `papaparse`/équivalent pour un `TableViewer` propre — **non installé**, mais un parsing CSV simple peut aussi être fait sans dépendance pour des cas non pathologiques | Alternative possible | **Aucune bibliothèque dédiée**, mais complexité d'implémentation faible sans lib | Voir CSV formula injection (`INBOX1_SECURITY_MATRIX.md`) — obligatoire à traiter | Bonne si bien fait | Téléchargement |

**Aucun package n'a été installé pendant cet audit, conformément au mandat.**

## Code source (HTML/CSS/JS/JSX/TS/TSX/JSON/XML/autres textes)

Principe confirmé applicable : **afficher le code ≠ l'exécuter.** Un `CodeViewer` peut se limiter à un `<pre>`/`<code>` avec le texte échappé (comme le fait déjà `SafeHtmlEmailViewer.jsx` pour son fallback texte brut, ligne ~122-135, via `<pre>{safeText}</pre>`) — sûr par construction, sans bibliothèque. **Aucune bibliothèque de coloration syntaxique n'est installée** (`prismjs`/`highlight.js` absents de `client/package.json`, confirmé) — une coloration syntaxique améliorée nécessiterait un ajout futur, hors périmètre de cet audit.

## Audio / vidéo

Formats `audio/*`/`video/*` standards (MP3, MP4, WebM) sont nativement supportés par `<audio controls>`/`<video controls>` dans tous les navigateurs cibles — aucune bibliothèque nécessaire. **Non vérifié dans cet audit** : si Cloudinary sert ces fichiers avec support des Range requests HTTP (nécessaire pour le seek dans une vidéo) — à confirmer techniquement avant l'implémentation d'un `VideoViewer` (INBOX-7), pas bloquant pour la roadmap mais à ne pas supposer acquis.

## Ce qui doit être réutilisé (mandat §60)

- `secureStorageService.js` (`uploadPrivateAsset`/`readPrivateAsset`) — déjà générique, déjà utilisé par email ET chat interne, aucune raison de le dupliquer.
- Le patron `SafeHtmlEmailViewer.jsx` (sanitization + confinement + tests dédiés) comme référence de conception pour tout futur viewer manipulant du contenu non fiable.
- L'endpoint `downloadAttachment` existant (`internalMailController.js`) pour tout mécanisme de résolution CID — pas de nouvel endpoint à créer.

## Ce qui ne doit surtout pas être reconstruit (mandat §60)

- Un deuxième système de messagerie ou un deuxième modèle d'email — `InternalMail` est le bon modèle, à étendre (ex. champs CID), jamais dupliqué.
- Un deuxième mécanisme de sanitization HTML — `DOMPurify`+iframe sandbox existe déjà et fonctionne, ne pas le remplacer par une nouvelle bibliothèque sans preuve de défaillance.
- Un deuxième service de stockage de pièce jointe — `secureStorageService.js` sert déjà ce rôle pour deux domaines différents (email, chat), le réutiliser pour toute nouvelle famille de fichier.
