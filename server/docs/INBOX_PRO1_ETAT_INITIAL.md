# INBOX-PRO-1 — État initial (audit avant code)

Date : 2026-08-21. Branche `main`.

## 1. Baseline Git

```
git status --short → travail non commité du sprint précédent (TENANT-SCOPE-HOTFIX-3), rien de surprenant
git branch --show-current → main
```

## 2. Identification de la cible réelle

Deux systèmes de messagerie coexistent dans le dashboard, à ne pas confondre :

| Système | Page | Modèle | Nature |
|---|---|---|---|
| **Messages clients** | `/dashboard/conversations` → `StaffInboxPage.jsx` | `Conversation`/`Message` | Chat temps réel (Socket.IO) staff ↔ client, texte brut uniquement, déjà 2 colonnes (liste + chat), déjà correctement cloisonné tenant (voir HOTFIX-OWNER-CONTRACT-RESEND-1/TENANT-SCOPE-*). |
| **Boîte de réception** | `/dashboard/messages` → `InternalMessagingPage.jsx` (1059 lignes) | `InternalMail` | Messagerie **interne** (staff ↔ staff) **ET emails externes réels** reçus via IMAP Zoho (`zohoImapService.js`, polling every 5 min, cron dans `server.js`) — c'est LA cible de ce mandat : c'est ici que les emails HTML (factures, newsletters) entrants via Zoho atterrissent, et c'est ici que se trouve la structure "trois colonnes rigides" décrite dans le mandat (sidebar 264px + liste 384px + détail). |

**`INBOX-PRO-1` cible `InternalMessagingPage.jsx`. `StaffInboxPage.jsx` n'est PAS touché** (hors périmètre — chat client, pas d'emails HTML, déjà 2 colonnes).

## 3. Audit détaillé — Frontend

### Architecture actuelle (confirmée par lecture complète du fichier)
```jsx
<div className="flex h-[...] bg-gray-50">
  <div className="w-64 ..."> {/* Sidebar : dossiers + compose + profil */} </div>
  <div className="w-96 ...">  {/* Liste des messages */} </div>
  <div className="flex-1 ..."> {/* Détail du message sélectionné */} </div>
</div>
```
Trois divs de largeur fixe/flex côte à côte, visuellement égales en poids (mêmes bordures `border-r`, même fond blanc) — exactement le défaut décrit par le mandat : "trois blocs indépendants". **EXISTANT.**

### Composants internes (tous inline dans le même fichier, pas de sous-composants séparés)
- `NavButton` — item de sidebar. **EXISTANT.**
- `MessageItem` — ligne de la liste. **EXISTANT**, assez compact déjà (avatar + nom + objet + aperçu), mais pas de gestion du survol/densité avancée.
- `MessageDetail` — panneau de lecture. **EXISTANT**, contient le rendu HTML :
  ```jsx
  <div className="... prose prose-sm max-w-none"
       dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(message.content) }} />
  ```
  **BUG confirmé** : `prose`/`prose-sm` sont des classes de `@tailwindcss/typography`, **plugin absent** de `client/tailwind.config.js` (`plugins: []`) — ces classes sont actuellement des no-op, aucun style typographique n'est réellement appliqué. **DETTE UX.**
  **BUG DE SÉCURITÉ/ISOLATION structurel** : le HTML de l'email est injecté **directement dans le DOM du dashboard**, sans iframe ni Shadow DOM. Aucune isolation CSS : un `<style>` ou des règles `!important` dans un email peuvent visuellement casser le reste du dashboard (exactement le problème décrit au mandat §14). **DETTE TECHNIQUE MAJEURE.**
- `ComposeModal` — formulaire d'envoi (interne + externe via Zoho), avec pièces jointes, brouillons. **EXISTANT**, fonctionnel, éditeur texte brut (`<textarea>`, pas de rich text — mandat §25 : pas de remplacement sans besoin démontré, aucun rich text existant à préserver donc aucune promesse à casser).

### Services frontend (`client/lib/services/messageService.js`)
Toutes les fonctions attendues existent déjà : `sendInternalMail`, `getReceivedMessages`, `getSentMessages`, `getUnreadMessages`, `getStarredMessages`, `getDraftMessages`, `getTrashedMessages`, `markAsRead`, `addStar`/`removeStar`, `deleteMessage`, `moveToTrash`/`restoreFromTrash`/`permanentlyDelete`/`emptyTrash`, `saveDraft`/`updateDraft`/`deleteDraft`, `previewInternalMailAttachment`, `countUnread`. **EXISTANT — rien à dupliquer.**

### Recherche/filtres
`filteredMessages = messages.filter(...)` — recherche **100 % frontend**, sur le tableau déjà chargé (une seule page à la fois, `limit` par défaut du backend). Aucune API de recherche serveur dédiée trouvée. **PARTIEL** — acceptable pour ce sprint (volumes réels non mesurés, aucune preuve de problème de performance ; pas de nouvelle route créée sans besoin démontré, conformément au mandat §51), mais documenté comme dette si le volume grossit.

### Temps réel
**ABSENT côté InternalMail** — pas de Socket.IO ici (contrairement à `StaffInboxPage.jsx`). Rafraîchissement par `setInterval` toutes les 30s (`fetchMessages`/`fetchUnreadCount`). **EXISTANT (polling, pas de duplication à créer)**.

### Responsive
Un état `mobilePane` (`folders` / `list` / `detail`) gère déjà une navigation écran-par-écran sur mobile via classes `hidden`/`flex` conditionnelles — **EXISTANT**, déjà proche de l'exigence du mandat §30, à conserver et affiner.

## 4. Audit détaillé — Backend

### Modèle `InternalMail` (`server/models/InternalMail.js`)
```js
content: { type: String, required: true, maxlength: 10000 }
```
**BUG CONFIRMÉ, CAUSE RACINE #1** : un seul champ `content`, plafonné à **10 000 caractères**, utilisé indifféremment pour texte brut interne ET pour le corps d'un email externe. Aucun champ `html` séparé. Une facture/newsletter HTML professionnelle dépasse fréquemment 10 000 caractères de markup (styles inline, tableaux, images en base64/URL) — **tronquée en cas de dépassement, potentiellement HTML invalide après troncature**.

### Pipeline IMAP (`server/services/zohoImapService.js`, fonction `processFetchedMessage`)
```js
const textContent = parsed.text || '';
const htmlContent = parsed.html || '';
...
content: textContent || htmlContent || '(Contenu vide)',
```
**BUG CONFIRMÉ, CAUSE RACINE #2 (la plus importante du mandat)** : `mailparser` (`simpleParser`) génère **quasi systématiquement** une version texte auto-dérivée même pour un email HTML pur — `textContent` est donc presque toujours non-vide, et **`htmlContent` n'est en pratique JAMAIS utilisé**. Résultat : tous les emails HTML entrants (factures, tableaux, images, mise en forme, signatures) sont réduits à du texte brut **avant même d'atteindre la base de données**. Le frontend ne peut techniquement PAS afficher un tableau, une couleur ou une image qui n'a jamais été conservée.

Le webhook legacy `internalMailController.receiveExternalMail` (route `POST /api/webhooks/zoho-incoming`, probablement obsolète depuis le passage au polling IMAP direct, mais toujours présente dans le code) a **exactement le même bug** (`content: textContent || htmlContent || ''`).

### Pièces jointes
- Upload : `uploadPrivateAsset` (Cloudinary, stockage privé) — **EXISTANT**, fonctionnel, déjà utilisé de façon cohérente avec le reste du produit (Document, RentalMaintenance…).
- **CID (images inline `cid:...`)** : `parsed.attachments` est bien capturé et uploadé, mais **aucun code ne réécrit les références `cid:xxx` dans le HTML vers l'URL de l'attachment correspondant** — de toute façon sans objet aujourd'hui puisque le HTML n'est pas stocké. **ABSENT / NON CONFIRMÉ tant que la Cause Racine #2 n'est pas corrigée.**
- Téléchargement : routes `previewEndpoint`/`downloadEndpoint` déjà exposées et déjà authentifiées/scopées par `internalMailController` (à re-vérifier §48 du mandat — voir doc sécurité).

### Routes (`server/routes/internalMailRoutes.js` — à confirmer, non listé ci-dessus mais utilisé par les services frontend déjà cités) — **EXISTANT**.

## 5. Synthèse des classifications

| Élément | Statut |
|---|---|
| Architecture 3 colonnes rigides | BUG UX confirmé (mandat) |
| `MessageItem`/liste | EXISTANT, réutilisable |
| Sidebar navigation | EXISTANT, réutilisable |
| Recherche/filtres | PARTIEL (frontend uniquement, acceptable) |
| Temps réel | ABSENT (polling 30s existant, suffisant, pas de Socket.IO à ajouter) |
| Responsive mobile | EXISTANT (bon point de départ) |
| Rendu HTML — isolation CSS/sécurité | DETTE TECHNIQUE MAJEURE (pas d'iframe, `dangerouslySetInnerHTML` direct dans le DOM dashboard) |
| Rendu HTML — classes `prose` | BUG (plugin Tailwind absent, no-op) |
| Stockage du corps HTML | **BUG BACKEND CONFIRMÉ — cause racine principale** : `content` unique, 10 000 caractères, texte préféré à HTML dans les deux points d'entrée IMAP |
| CID images inline | ABSENT (conséquence directe du bug ci-dessus) |
| Pièces jointes upload/download | EXISTANT, fonctionnel |
| Sanitization | EXISTANT (DOMPurify côté client, config par défaut, jamais auditée précisément) |

## 6. Décision sur le périmètre backend (mandat §51)

Le mandat interdit de modifier le backend "tant qu'un besoin réel n'est pas démontré". La cause racine #2 (texte préféré à HTML dans l'import IMAP) est un **besoin backend réel, précisément démontré par lecture de code** — sans cette correction, AUCUNE amélioration frontend du rendu HTML n'a de contenu à afficher. Une correction backend minimale et additive est donc justifiée :
1. Ajouter un champ `html` (optionnel) à `InternalMail`, plafond substantiellement relevé (assez pour une facture/newsletter réaliste), sans supprimer ni renommer `content` (rétrocompatibilité totale, aucune migration destructive).
2. Corriger `zohoImapService.js` et `internalMailController.receiveExternalMail` pour stocker `html` quand disponible, et conserver `content` comme texte brut (fallback + recherche + notifications).
3. Aucune autre route, aucun autre modèle, aucun changement de capacité IAM.

## 7. Plan d'implémentation

1. Backend (minimal, justifié) : `InternalMail.html`, import IMAP corrigé, tests.
2. Frontend : nouveau composant `SafeHtmlEmailViewer` (iframe sandboxée `srcDoc` + DOMPurify), remplaçant le `dangerouslySetInnerHTML` direct.
3. Frontend : restructuration de la mise en page (`InternalMessagingPage.jsx`) — panneau de lecture dominant, sidebar/liste resserrées, densité de la liste améliorée.
4. Tests frontend (viewer HTML, sanitization, fallback texte) + backend (stockage html, non-régression).
5. Gates + documentation finale.
