# INBOX-2 — MATRICE DES PIÈCES JOINTES

Aucun changement de comportement de preview/téléchargement/sécurité — SECURITY-2 reste l'autorité canonique (`attachmentSecurity.js`, non modifié). Seule colonne affectée par ce sprint : **Icône** (nouvelle classification présentationnelle, `attachmentPresentation.js`).

| Type | Icône avant | Icône après (INBOX-2) | Preview | Download | Security |
|---|---|---|---|---|---|
| HTML/HTM | `FileText` (générique) | `FileText` (catégorie `UNKNOWN`/`TEXT` selon MIME — reste générique, cohérent : contenu actif, jamais une icône "rassurante" dédiée) | Sanitizé + sandboxé (SECURITY-2), inchangé | `<a download>` forcé, inchangé | **Inchangée — CERTIFIÉE VERTE (SECURITY-2)** |
| SVG | `FileText` | `FileText` (non classé `IMAGE` — un SVG reste du contenu actif, jamais assimilé à une image passive, mandat §24) | Sanitizé + sandboxé, inchangé | `<a download>` forcé, inchangé | **Inchangée — CERTIFIÉE VERTE** |
| CSS | `FileText` | `FileText` | Aucune preview texte sûre existante → comportement historique (téléchargement via chemin sûr existant), inchangé (mandat §26 : préférer download si aucune preview texte sûre) | Inchangé | Inchangée — jamais injecté dans le dashboard |
| TXT | `FileText` | `FileText` (catégorie `TEXT`) | Inchangé | Inchangé | Inchangée |
| CSV | `FileText` | `FileSpreadsheet` (catégorie `OFFICE_SHEET`) | Inchangé (aucun moteur tableur ajouté, mandat §28) | Inchangé | Inchangée |
| JSON | `FileText` | `FileText` (catégorie `TEXT`) | Inchangé | Inchangé | Inchangée |
| JPEG/PNG/WebP/GIF | `ImageIcon` | `ImageIcon` (catégorie `IMAGE`) | Inchangé | Inchangé | Inchangée |
| PDF | `FileText` | `FileType` (catégorie `PDF`, icône dédiée) | Inchangé (visualiseur natif navigateur, aucun viewer PDF ajouté, mandat §32) | Inchangé | Inchangée |
| DOC/DOCX | `FileText` | `FileText` (catégorie `OFFICE_WORD` — aucune icône Word dédiée distincte trouvée dans lucide-react au-delà de `FileText`, choix documenté) | Inchangé (aucun moteur Office ajouté, mandat §30) | Inchangé | Inchangée |
| XLS/XLSX | `FileText` | `FileSpreadsheet` (catégorie `OFFICE_SHEET`) | Inchangé (aucun moteur Excel ajouté, mandat §29) | Inchangé | Inchangée |
| PPT/PPTX | `FileText` | `FileType` (catégorie `OFFICE_SLIDE`) | Inchangé (aucun moteur PowerPoint ajouté, mandat §31) | Inchangé | Inchangée |
| ZIP/RAR/7z | `FileText` | `FileArchive` (catégorie `ARCHIVE`) | Inchangé — téléchargement uniquement, jamais d'extraction navigateur (mandat §34) | Inchangé | Inchangée |
| Audio (MP3/WAV/AAC...) | `FileText` | `FileAudio` (catégorie `AUDIO`) | Inchangé — aucun lecteur `<audio>` ajouté (mandat §33 : amélioration légère seulement si sûre avec les données existantes ; non fait ici, hors périmètre strict de ce tour) | Inchangé | Inchangée |
| Vidéo (MP4/MOV/WebM...) | `FileText` | `FileVideo` (catégorie `VIDEO`) | Inchangé | Inchangé | Inchangée |
| Inconnu | `FileText` | `FileText` (catégorie `UNKNOWN`) | Fallback professionnel déjà existant : nom, taille, téléchargement — jamais d'écran cassé | Inchangé | Inchangée |

## Object URL cleanup (mandat §53)

Vérifié — inchangé depuis SECURITY-2 : `previewInternalMailAttachment`/`downloadInternalMailAttachment` révoquent l'URL après 60s (`URL.revokeObjectURL`), `fetchInternalMailAttachmentContent` ne crée pas de Blob URL persistante (lecture texte directe). Aucune fuite introduite par ce sprint (aucun nouveau `createObjectURL`).

## Gros fichiers (mandat §54)

Aucun changement — le mécanisme existant ne télécharge le contenu complet d'une pièce jointe qu'au clic explicite sur "Voir"/"Télécharger" (jamais en préchargement de la liste), inchangé par ce sprint. Aucune limite de taille explicite n'existe côté frontend pour la préview active (`fetchInternalMailAttachmentContent`) — limite déjà documentée comme non confirmée dans `INBOX1_SECURITY_MATRIX.md` ("fichier surdimensionné"), non traitée ici (hors périmètre, pas de régression introduite).
