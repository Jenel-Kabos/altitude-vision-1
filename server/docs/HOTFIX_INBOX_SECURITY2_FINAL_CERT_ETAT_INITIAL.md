# HOTFIX-INBOX-SECURITY-2 — FINAL CERTIFICATION — ÉTAT INITIAL

## Baseline git

- Branche : `main`
- HEAD : `a04055f62952c782b92aeef2f100824a17a5f645` ("Update Altimmo 40") — inchangé depuis l'implémentation de SECURITY-2.
- `git status --short` : travail parallèle déjà documenté (`ARCH2*`, `INBOX_PRO1`), mes hotfix non commités (`SECURITY-1` sur `emailRoutes.js`, `SECURITY-2` sur les 6 fichiers `client/` déjà listés, `HOTFIX-MOB-ADD-PROPERTY-BEDROOMS-1` sur 1 fichier de test mobile). Aucun écrasement, aucun `git stash`/`reset` effectué.
- `git diff --check` : propre.

## Implémentation SECURITY-2 confirmée présente (fichiers de production)

| Fichier | État | Rôle |
|---|---|---|
| `client/lib/utils/sanitizeSandboxedHtml.js` | Présent, non modifié cette session (jusqu'au point 3 ci-dessous) | Primitive DOMPurify partagée |
| `client/lib/utils/attachmentSecurity.js` | Présent — **modifié cette session** (micro-correction, voir §3) | Classification fail-closed HTML/SVG |
| `client/lib/components/messaging/SafeAttachmentPreview.jsx` | Présent, non modifié | Modal d'aperçu sandboxé |
| `client/lib/components/messaging/AttachmentStrip.jsx` | Présent, non modifié | Routage Voir/Télécharger par classification |
| `client/lib/components/messaging/SafeHtmlEmailViewer.jsx` | Présent, non modifié | Refactorisation (sanitize extrait), comportement identique |
| `client/lib/services/messageService.js` | Présent, non modifié | `fetchInternalMailAttachmentContent`/`downloadInternalMailAttachment` ajoutés |

## Réserve précédente à lever ou maintenir

`HOTFIX_INBOX_SECURITY2_REPORT.md` (verdict précédent) : **GO SOUS RÉSERVES** — réserve unique et explicite : "aucune validation en navigateur réel n'a pu être faite dans cet environnement". Cette certification a pour unique objet de traiter cette réserve précisément, sans élargir le périmètre.

## Documents lus avant toute action

`INBOX1_SECURITY_MATRIX.md`, `INBOX1_ATTACHMENT_MATRIX.md`, `HOTFIX_INBOX_SECURITY1_REPORT.md`, `HOTFIX_INBOX_SECURITY2_ETAT_INITIAL.md`, `_THREAT_MODEL.md`, `_BEHAVIOR_CONTRACT.md`, `_SECURITY_MATRIX.md`, `_REPORT.md` (tous relus intégralement, contrats confirmés inchangés depuis leur rédaction).

## Découverte en cours de certification — micro-correction appliquée

L'audit de classification par cas adversariaux (mandat §8-9/§26-29) a révélé un vecteur d'évasion réel non couvert par la version initiale de `attachmentSecurity.js` : un nom de fichier `evil.html?x=1` ou `evil.svg#frag` (le nom de fichier est déclaré librement par l'expéditeur dans l'en-tête MIME, jamais une URL) n'était **pas** détecté comme actif, car le pattern d'extension exigeait que le nom se termine strictement par `.html`/`.svg`. Une correction minimale (`stripQueryOrFragment`, retire tout suffixe `?...`/`#...` avant de tester l'extension) a été appliquée, caractérisée par un test rouge avant correction (3/19 échecs) puis vert après (19/19) — voir `HOTFIX_INBOX_SECURITY2_ADVERSARIAL_MATRIX.md` et `client/lib/__tests__/attachmentSecurity.test.js`. Aucune règle métier modifiée, correction strictement locale à la fonction de classification déjà possédée par ce hotfix.

## Découverte hors périmètre — documentée, non traitée ici

`client/lib/services/conversationService.js::openConversationAttachment` (système `Message`/`Conversation`, utilisé par `MessagesPage.jsx`/`StaffInboxPage.jsx`) présente un mécanisme structurellement analogue à la faille originale de SECURITY-2 (Blob brut + ancre `target="_blank"`, aucune classification MIME/extension), mais sur un système **distinct** de `InternalMail`. Voir `HOTFIX_INBOX_SECURITY2_BYPASS_AUDIT.md` — documenté comme `SECURITY FINDING DISCOVERED`, hors périmètre de ce mandat, recommandation de hotfix dédié, aucune modification apportée ici (mandat §45 : ne pas transformer cette certification en chantier de sécurité général).
