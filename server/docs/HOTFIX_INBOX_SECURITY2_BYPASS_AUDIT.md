# HOTFIX-INBOX-SECURITY-2 — AUDIT DES VOIES DE CONTOURNEMENT

Grep exhaustif dans `client/lib/` et `client/app/` pour `window.open`, `createObjectURL`, `dangerouslySetInnerHTML`, `iframe`, `srcDoc`, `DOMPurify`, `attachment`, `preview` — pas limité au composant modifié (mandat §18).

## Voies identifiées, classées par système

### 1. `InternalMail` (le système corrigé par ce hotfix) — SÉCURISÉ

- `client/lib/components/messaging/AttachmentStrip.jsx` → route les types actifs (HTML/SVG) vers `SafeAttachmentPreview` (sanitizé + sandboxé) et `downloadInternalMailAttachment` (`<a download>`) ; les types sûrs conservent `previewInternalMailAttachment` (raw blob + `window.open`), sans risque prouvé pour ces types (voir `_FILE_MATRIX.md`).
- `client/lib/components/messaging/SafeHtmlEmailViewer.jsx` → corps HTML de l'email, jamais les pièces jointes — chaîne distincte, déjà sécurisée, non affectée.

**Aucune autre voie trouvée pour `InternalMail`** — `AttachmentStrip.jsx` est le seul point de rendu des pièces jointes de ce modèle (confirmé par grep exhaustif de `previewEndpoint`/`downloadEndpoint`/`canPreview` — un seul composant frontend les consomme, `InternalMessagingPage.jsx` → `AttachmentStrip.jsx`).

### 2. `Message`/`Conversation` (système de chat, DISTINCT d'`InternalMail`) — **SECURITY FINDING DISCOVERED, HORS PÉRIMÈTRE**

`client/lib/services/conversationService.js::openConversationAttachment` (lignes 160-172) :
```js
export const openConversationAttachment = async (attachment, { download = false } = {}) => {
  const endpoint = download ? attachment.downloadEndpoint : attachment.previewEndpoint;
  const response = await api.get(endpoint.replace(/^\/api/, ''), { responseType: 'blob' });
  const objectUrl = URL.createObjectURL(response.data);
  const anchor = document.createElement('a');
  anchor.href = objectUrl;
  if (download) anchor.download = attachment.nom || attachment.originalFilename || 'attachment';
  else anchor.target = '_blank';   // ← équivalent fonctionnel à window.open(blob) pour la preview
  anchor.rel = 'noopener noreferrer';
  anchor.click();
  ...
};
```
Utilisé par `client/lib/pages/MessagesPage.jsx` et `client/lib/pages/dashboard/StaffInboxPage.jsx`. **Aucune classification MIME/extension** — un fichier `.html`/`.svg` actif dans une pièce jointe de conversation (chat), prévisualisé (`download: false`), ouvrirait un Blob HTML/SVG via une ancre `target="_blank"` — structurellement équivalent à `window.open(blob)` : même risque d'exécution same-origin que la faille originale de `InternalMail`.

**Pourquoi ce n'est PAS corrigé dans ce mandat** : ce mandat porte exclusivement sur la certification de SECURITY-2, dont le périmètre chartered est `InternalMail` (email). `Message`/`Conversation` est un modèle et un système de fichiers **distinct**, jamais audité par `INBOX-1` (dont le périmètre était explicitement le pipeline email), jamais touché par `HOTFIX-INBOX-SECURITY-1`/`-2`. Le corriger ici constituerait un élargissement de périmètre explicitement interdit par le mandat (§2 "NE PAS ÉLARGIR LE PÉRIMÈTRE", §45/§47 "ne pas transformer cette certification en chantier de sécurité générale").

**Recommandation** : ouvrir un hotfix dédié, par exemple `HOTFIX-CHAT-ATTACHMENT-SECURITY-1`, avec le même patron que SECURITY-2 (classification fail-closed, réutilisation de `sanitizeSandboxedHtml.js`/`SafeAttachmentPreview.jsx` déjà existants et génériques, wiring dans `conversationService.js`/les pages consommatrices). Ce risque n'est pas nouveau — il préexistait déjà avant ce mandat, dans un système jamais audité jusqu'ici ; ce n'est pas une régression introduite par SECURITY-2.

### 3. Autres `window.open`/`createObjectURL` trouvés dans `client/` — sans rapport, vérifiés non pertinents

Grep exhaustif (`ChatWidget.jsx`, `JsonLd.jsx`, `HotelInvoiceDeliveryPanel.jsx`, `FinancialDocumentsFolder.jsx`, `PropertyForm.jsx`, `DossierPanel.jsx`, `AccountPage.jsx`, `AdminProjectCreatePage.jsx`/`EditPage.jsx`, `PublicitesPage.jsx`, `GestionLocativePage.jsx`, services d'export CSV/PDF `exportMarketingService.js`/`litigeService.js`/`reportingService.js`/`actionLogService.js`/`gestionLocativeService.js`/`tenantPortalService.js`/`transactionService.js`, pages `communication`/`altcom`) : tous ces usages concernent soit des exports CSV/PDF générés côté serveur avec un `Content-Type` contrôlé et non arbitraire (jamais un contenu HTML/SVG arbitraire fourni par un tiers non fiable), soit des ouvertures de liens externes classiques (`window.open(url)` sur une URL, pas un Blob de contenu utilisateur), soit des popups de partage/réseaux sociaux. **Aucun ne traite une pièce jointe email/message provenant d'un expéditeur non fiable** — hors du modèle de menace de ce hotfix, non documentés plus en détail ici.

## Conclusion de l'audit de contournement

Pour le système `InternalMail` (périmètre exact de SECURITY-2) : **aucun bypass résiduel trouvé**. Un système structurellement analogue mais distinct (`Message`/`Conversation`, chat) présente un risque comparable, préexistant, non introduit par ce hotfix, documenté et recommandé pour un hotfix dédié séparé.
