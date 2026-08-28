# HOTFIX-CONVERSATION-ACTIVE-ATTACHMENT-1 — MODÈLE DE MENACE

## Pourquoi le mécanisme d'exécution de SECURITY-2 ne se transpose pas ici

Le finding SECURITY-2 reposait sur une chaîne précise : un expéditeur externe (email) contrôle librement le `Content-Type` MIME déclaré dans les en-têtes SMTP → ce MIME est conservé tel quel jusqu'au moment où le navigateur fabrique un Blob (`URL.createObjectURL`) et l'ouvre (`window.open`) → si le MIME servi est `text/html`/`image/svg+xml`, le navigateur **interprète et exécute** les octets comme un document actif.

Pour `Conversation`/`Message`, la chaîne est différente à une étape critique : le **seul** point de création d'un attachment (`POST /api/messages`) passe par un `fileFilter` multer qui **rejette explicitement** toute déclaration `text/html`/`application/xhtml+xml`/`image/svg+xml` avant tout stockage. Le MIME qui finit par être stocké (`asset.mimeType`) — et donc celui que `downloadAttachment` sert dans l'en-tête `Content-Type` — ne peut donc **jamais** être l'un de ces trois MIME actifs pour un attachment créé par ce chemin.

## Vecteurs analysés

| Vecteur | Applicable ? | Raisonnement |
|---|---|---|
| Upload direct d'un fichier `.html` déclaré `text/html` | **Non** | Rejeté par `fileFilter`, confirmé par test (`messageAttachmentMimeFilter.test.js`) |
| Upload direct d'un fichier `.svg` déclaré `image/svg+xml` | **Non** | Idem |
| Upload d'un fichier HTML renommé avec une extension image (`evil.png`, octets HTML), MIME déclaré `image/png` | **Accepté par le filtre**, mais **n'exécute rien** | Le Blob final porte le type `image/png` (celui stocké, jamais réévalué) ; `window.open`/ancre `target=_blank` sur un Blob `image/png` déclenche une tentative de rendu **image**, pas une interprétation HTML — les octets HTML sont simplement des données binaires invalides pour un décodeur d'image, échec silencieux (icône cassée), aucune exécution de script |
| Upload d'un fichier PDF contenant des actions JavaScript embarquées (vecteur PDF.js spécifique, distinct du vecteur "Blob HTML") | Hors périmètre de ce mandat | Risque générique au format PDF, déjà classé "Faible" par `INBOX1_ATTACHMENT_MATRIX.md`, non aggravé par ce système, non traité ici (mandat §23 : préserver le comportement existant, pas construire de nouveau viewer/protection PDF) |
| Attachment "legacy" `url`-based servant du contenu distant `text/html` | **Non confirmé — théorique** | Aucun chemin de code vivant ne crée de tel enregistrement aujourd'hui (`_FLOW.md`) ; si des données historiques existent (non vérifiable hors DB de production, hors périmètre d'accès de ce mandat), le risque resterait réel pour ces enregistrements spécifiques uniquement |
| Contournement du `fileFilter` par un appel API direct (hors navigateur, ex. `curl`) déclarant un MIME mensonger mais autorisé | Accepté par le filtre (comme un vrai navigateur le ferait), **mêmes conclusions que le cas "renommé"** ci-dessus — aucune exécution possible, le MIME stocké reste celui de l'allowlist |
| Contournement du `fileFilter` par un appel déclarant directement `text/html` | **Non** | Rejeté, quel que soit le client (navigateur ou script), le filtre s'applique à la valeur déclarée indépendamment de son origine |
| `localStorage`/`parent.document`/`window.top`/popup depuis un attachment actif | **Non applicable** — aucun attachment actif ne peut exister par ce chemin, donc aucun contexte d'exécution n'est jamais atteint | — |

## Niveau de confiance dans le MIME déclaré par le client (mandat §17)

Le `fileFilter` fait confiance au `Content-Type` déclaré par le client pour la **décision d'acceptation/rejet**, jamais pour une garantie que les octets correspondent réellement au type déclaré — ce n'est **pas un antivirus**, ni une vérification par signature de fichier (magic bytes), et ce hotfix n'en ajoute pas (mandat §17 l'interdit explicitement). Ce que le filtre garantit réellement, et c'est suffisant pour fermer le vecteur d'exécution étudié : **le MIME finalement stocké et servi ne peut jamais être une valeur que le navigateur interprète comme un document actif exécutable** (`text/html`, `application/xhtml+xml`, `image/svg+xml`). C'est une garantie sur l'ENSEMBLE des valeurs possibles, pas sur l'exactitude de chaque fichier individuel — une nuance documentée ici pour éviter toute sur-interprétation ("le backend a validé que ce PNG est un vrai PNG" serait une affirmation fausse et non prouvée).

## Sévérité (mandat §13)

**P2 — risque résiduel non confirmé, limité aux données historiques potentielles (`url`-based, non vérifiées).** Aucun P0/P1 sur le chemin de création vivant. La classification P0 initialement suspectée par le mandat n'est pas retenue, sur preuve directe et non par supposition — conformément à l'esprit de ce hotfix ("revalider, ne pas supposer que la vulnérabilité est exactement identique").
