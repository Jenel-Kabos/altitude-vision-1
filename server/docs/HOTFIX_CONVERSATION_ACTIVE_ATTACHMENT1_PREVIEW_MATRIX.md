# HOTFIX-CONVERSATION-ACTIVE-ATTACHMENT-1 — MATRICE DES PREVIEWS

| Type demandé à l'upload | Résultat fileFilter | MIME stocké possible | Preview (`openConversationAttachment`, `download:false`) | Risque d'exécution |
|---|---|---|---|---|
| `image/jpeg` | Accepté | `image/jpeg` | Blob type image → tentative de rendu image (échec silencieux si octets invalides, jamais d'exécution) | Aucun |
| `image/png` | Accepté | `image/png` | Idem | Aucun |
| `image/webp` | Accepté | `image/webp` | Idem | Aucun |
| `application/pdf` | Accepté | `application/pdf` | Blob type PDF → visualiseur PDF natif du navigateur | Faible (identique à InternalMail/INBOX-1, hors périmètre d'aggravation) |
| `video/mp4`, `video/quicktime`, `video/x-msvideo`, `video/webm` | Accepté | idem | Blob type vidéo → tentative de lecture (aucun rendu `<video>` actuellement câblé côté UI, ouverture navigateur brute) | Aucun (pas de moteur HTML) |
| `audio/mpeg`, `audio/mp4`, `audio/aac`, `audio/wav`, `audio/webm`, `audio/x-m4a` | Accepté | idem | Idem, audio | Aucun |
| **`text/html`** | **Rejeté (400)**, confirmé par test | **Ne peut jamais être stocké via ce chemin** | N/A — jamais atteint | **Aucun** (barrière amont) |
| **`application/xhtml+xml`** | **Rejeté (400)** | **Jamais stocké** | N/A | **Aucun** |
| **`image/svg+xml`** | **Rejeté (400)** | **Jamais stocké** | N/A | **Aucun** |
| Fichier HTML renommé avec une extension/MIME autorisée (ex. `evil.png` déclaré `image/png`, octets HTML) | **Accepté** (le filtre ne vérifie que le `Content-Type` déclaré, jamais les octets) | `image/png` (mensonge stocké tel quel) | Blob de type `image/png` contenant des octets HTML → le navigateur tente un rendu **image**, échoue silencieusement (icône d'image cassée) — **le type déclaré du Blob pilote son interprétation, pas son contenu réel** | **Aucun** — confirmé par analyse (`_THREAT_MODEL.md`), le mécanisme d'exécution qui rendait InternalMail vulnérable (Content-Type servi = `text/html`) ne peut pas se produire ici |
| Attachment "legacy" `url`-based (`streamRemoteDocument`) | Non applicable (pas de fileFilter sur ce chemin) | **Non contraint** — dépend du serveur distant | Si un tel enregistrement existe et pointe vers une ressource servant `Content-Type: text/html`, le risque original se reproduirait | **Non confirmé** — aucun chemin de création vivant trouvé, existence de données historiques non vérifiable hors DB (mandat n'autorise pas d'accès production) |

## Différence structurelle avec `InternalMail` (rappel)

`InternalMail` n'a aucun filtre équivalent car son unique point d'ingestion est IMAP (expéditeur externe, MIME déclaré librement dans les en-têtes SMTP, jamais soumis à un `fileFilter` applicatif). C'est cette absence de filtre — pas une faille de sanitization du côté rendu — qui constituait le cœur du finding SECURITY-2. `Conversation`/`Message` a, par une décision de conception indépendante et préexistante (non liée à SECURITY-2), un filtre qui ferme structurellement cette classe de vulnérabilité à la source.
