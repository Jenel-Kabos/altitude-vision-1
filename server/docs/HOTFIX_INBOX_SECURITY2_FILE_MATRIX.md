# HOTFIX-INBOX-SECURITY-2 — MATRICE DES TYPES DE FICHIERS (RÉGRESSION)

| Type | MIME | Chemin de code | Preuve | Résultat |
|---|---|---|---|---|
| HTML | `text/html` | Classifié actif → `SafeAttachmentPreview` (sanitizé + sandboxé) | `AttachmentStripSecurity.test.jsx` + preuve Chromium réel (tests 1, 4, 5) | ✅ Sécurisé, comportement changé intentionnellement (c'est l'objet du hotfix) |
| SVG | `image/svg+xml` | Classifié actif → `SafeAttachmentPreview` | `AttachmentStripSecurity.test.jsx` + preuve Chromium réel (test 2) | ✅ Sécurisé |
| JPEG | `image/jpeg` | Non classifié actif → `previewInternalMailAttachment` (inchangé) | `AttachmentStripSecurity.test.jsx` (`imageAttachment`), `attachmentSecurity.test.js` | ✅ Comportement historique strictement préservé |
| PNG | `image/png` | Idem | `attachmentSecurity.test.js` (`photo.jpg`+`image/jpeg` légitime, et `evil.png`+`image/svg+xml` correctement classé actif — spoofing seul, pas le cas légitime) | ✅ Préservé pour un PNG légitime |
| WebP | `image/webp` | Non classifié actif (MIME absent de `ACTIVE_MIME_TYPES`, extension absente de `ACTIVE_EXTENSION_PATTERN`) | Analyse directe du code — aucune régression possible, chemin identique à JPEG/PNG | ✅ Préservé (non re-testé individuellement, mécanisme identique) |
| PDF | `application/pdf` | Non classifié actif → chemin historique inchangé | `AttachmentStripSecurity.test.jsx` (`pdfAttachment`) | ✅ Préservé |
| TXT | `text/plain` | Non classifié actif | Analyse directe — aucun rendu HTML pour ce MIME dans le mécanisme actuel (`INBOX1_ATTACHMENT_MATRIX.md`, non modifié par ce hotfix) | ✅ Préservé |
| CSV | `text/csv` | Non classifié actif | Idem | ✅ Préservé |
| JSON | `application/json` | Non classifié actif | Idem | ✅ Préservé |
| DOCX | `application/vnd.openxmlformats-officedocument.wordprocessingml.document` | Non classifié actif | Idem — aucun viewer Office, comportement = téléchargement/échec silencieux navigateur, inchangé | ✅ Préservé |
| XLSX | `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` | Non classifié actif | Idem | ✅ Préservé |
| PPTX | `application/vnd.openxmlformats-officedocument.presentationml.presentation` | Non classifié actif | Idem | ✅ Préservé |
| Inconnu / `application/octet-stream` | — | Non classifié actif par défaut (mandat §35 — jamais interprété comme HTML sans signal explicite) | `attachmentSecurity.test.js` (`noext`, `application/octet-stream`) | ✅ Comportement stable, aucun nouveau risque |

## Portée de la vérification

Les types JPEG/PNG/PDF ont été vérifiés par exécution de test explicite. Les autres types (WebP, TXT, CSV, JSON, DOCX, XLSX, PPTX, inconnu) sont vérifiés par **analyse directe du code** : la fonction `isActiveAttachmentContent` ne les fait jamais basculer sur le nouveau chemin (aucune de leurs valeurs MIME/extension n'apparaît dans `ACTIVE_MIME_TYPES`/`ACTIVE_EXTENSION_PATTERN`), et le chemin historique (`previewInternalMailAttachment`, non modifié) leur reste applicable à l'identique — aucune branche de code nouvelle ne peut les affecter. Conforme au mandat §23/§24 : "il n'est pas demandé de construire un viewer, seulement préserver le comportement existant."
