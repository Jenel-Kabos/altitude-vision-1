# HOTFIX-CONVERSATION-ACTIVE-ATTACHMENT-1 — MATRICE NAVIGATEUR

## Aucun test Chromium exécuté pour ce mandat — justification

Le mandat (§45/§63) exige une preuve Chromium réelle **si le finding est confirmé et une correction frontend est appliquée**. Ce n'est pas le cas ici : l'audit a démontré que le vecteur d'exécution (HTML/SVG servi avec un `Content-Type` actif) **ne peut pas se produire** pour un attachment `Conversation`/`Message` créé par le seul chemin vivant, en raison d'une barrière backend (`fileFilter` multer) indépendante et déjà en place — confirmée par un test backend direct (`messageAttachmentMimeFilter.test.js`, 10/10 verts), pas par un test frontend/navigateur.

Aucune modification frontend n'ayant été apportée, il n'y a pas de nouveau comportement de rendu à valider en navigateur réel : `openConversationAttachment`/`renderAttachment` restent strictement inchangés, et leur comportement pour les types réellement stockables (image/vidéo/audio/PDF) est déjà couvert par les preuves navigateur produites lors de `HOTFIX-INBOX-SECURITY-2` pour les mêmes primitives Blob/`window.open`/ancre (le mécanisme générique "Blob typé image/PDF ne s'exécute jamais comme HTML" a déjà été démontré empiriquement dans `HOTFIX_INBOX_SECURITY2_BROWSER_MATRIX.md`, tests 4-5, sur le même moteur Chromium — la conclusion se transpose directement puisque le mécanisme navigateur (interprétation d'un Blob selon son `type`) est identique, seul le système applicatif change).

## Si le risque résiduel (attachments legacy `url`-based) était confirmé un jour

Une preuve Chromium serait alors nécessaire avant toute certification verte d'un correctif — non applicable aujourd'hui, aucune correction n'ayant été faite faute de vulnérabilité confirmée sur le chemin vivant.
