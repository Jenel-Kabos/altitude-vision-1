# STORAGE-LEGACY-1 — Audit initial des documents privés Cloudinary historiques

Audit réalisé en lecture seule avant toute implémentation runtime significative, conformément au §50 du sprint. Sources relues intégralement avant toute modification : `STORAGE_SECURITY_1_AUDIT.md`, `STORAGE_SECURITY_1_REPORT.md`, `TENANT_HARDENING_2_AUDIT.md`, `TENANT_HARDENING_2_REPORT.md`. Le worktree contenait 111 fichiers modifiés/non suivis avant ce sprint (STORAGE-SECURITY-1 + TENANT-HARDENING-2, non reconstruits ni attribués à ce sprint).

## 1. Ce qui est repris tel quel (non reconstruit)

- La taxonomie deux-classes `PUBLIC_MEDIA`/`PRIVATE_DOCUMENT` de STORAGE-SECURITY-1 (`server/docs/STORAGE_SECURITY_1_AUDIT.md`) est étendue, jamais dupliquée : `legacyAssetClassification.js` (nouveau, §1 ci-dessous) ajoute `PRIVATE_ATTACHMENT`/`PRIVATE_OPERATIONAL_MEDIA`/`UNKNOWN` et la décision A–F demandée par ce sprint, en réutilisant les mêmes deux classes de base comme fondation.
- `secureStorageService.js`, `privateAssetSchema.js` : inchangés, réutilisés tels quels par le moteur de migration (le nouvel asset créé doit être indiscernable d'un nouvel upload privé natif).
- `tenantResourceAttributionService.js` : réutilisé et **étendu additivement** (aucune règle existante modifiée) — voir §3.
- `server/scripts/auditPrivateCloudinaryAssets.js` : amélioré en place (même fichier, §4), pas de second script.
- Reporting/ERP par défaut, Socket.IO, exports, GL liste/KPI, notifications, cache Mobile : déjà traités par TENANT-HARDENING-2, non retouchés ici sauf mention explicite (aucune n'a été nécessaire).

## 2. Bug découvert dans l'outil d'audit hérité de STORAGE-SECURITY-1

En testant `auditPrivateCloudinaryAssets.js` sur des fixtures MongoMemoryServer isolées (`Contrat.documents[].url` peuplé), l'outil hérité retournait **zéro résultat** pour toutes les collections dont le champ ciblé n'a pas `select: false` dans son schéma (c'est le cas de la quasi-totalité des champs listés : `Contrat.documents`, `Contrat.etatsDesLieux`, `Locataire.pieceIdentite`, `Message.attachments`, `Paiement.preuvePaiement`, etc. — seuls `User.contratPdfUrl/contratPdfAsset`, `FinancialDocumentArtifact.storageKey/storageVersion`, `RealEstateApplication.attachments` ont réellement `select:false`).

Cause : `Model.find({}).select(fields.map(f => \`+${f}\`).join(' '))` préfixe systématiquement `+` sur tous les champs. Mongoose interprète `+nomDeChamp` comme une inclusion forcée d'un champ normalement exclu — appliqué à un champ déjà inclus par défaut, Mongoose bascule la projection entière en mode "inclusion stricte" sur un chemin `+documents` inexistant, et ne retourne plus que `_id`. Preuve reproduite (MongoMemoryServer, aucune donnée réelle) :

```
.select('+documents +etatsDesLieux bien')  → { _id: ... }                         (documents absent)
.select('documents etatsDesLieux bien')    → { _id, documents: [...], ... }        (correct)
```

**Conséquence pratique** : l'audit STORAGE-SECURITY-1 exécuté avec ce script n'a très probablement inventorié que les collections où le champ ciblé est réellement `select:false` (User, FinancialDocumentArtifact, RealEstateApplication) — les documents legacy de `Contrat`, `Locataire`, `Proprietaire`, `Message`, `Paiement`, `PaiementTransaction`, `RentalPaymentReceipt`, `Litige`, `Signalement`, `InternalMail` n'ont probablement jamais été réellement énumérés par un run antérieur de cet outil, même si la matrice qualitative de `STORAGE_SECURITY_1_AUDIT.md` les identifie correctement par lecture de code.

**Correction appliquée** (§4) : le préfixe `+` n'est désormais posé que pour les champs dont `Model.schema.path(field)?.options?.select === false` est vrai ; sinon le nom de champ est utilisé tel quel. Vérifié par test manuel MongoMemoryServer (voir §9) : `Contrat.documents[].url` est maintenant correctement détecté et classifié.

## 3. Extension additive de `tenantResourceAttributionService`

`resolveResourceTenant` gérait déjà `User, Property, Hotel, Accommodation, HotelReservation, AccommodationReservation, Room, HotelStaffAssignment, RentalManagement, Contrat, Paiement, Conversation, Message, Document, FinancialDocument/FinancialPayment/PaymentAllocation`. Les `resourceType` suivants, nécessaires à l'inventaire legacy mais absents, ont été ajoutés **sans modifier aucune branche existante** :

| resourceType ajouté | Preuve relationnelle utilisée |
|---|---|
| `FinancialDocumentArtifact` | `domain` (`hotel`/`rental`/`real_estate`) → Hotel/RentalManagement/Property via `establishmentId` |
| `RentalMaintenanceTicket` | `property` |
| `RentalPaymentReceipt` | `contrat` → Property du contrat |
| `RealEstateApplication` | `property` |
| `Litige` | `bienConcerné` (Property) |
| `Signalement` | `property` |
| `Locataire` | Contrat(s) référençant `locataire` → Property (jamais nom/email/téléphone) |
| `Proprietaire` | `user` (si rattaché) **et** Contrat(s) référençant `proprietaire` → Property |
| `PaiementTransaction` | `transaction` → `Transaction.property` |

`InternalMail` n'a reçu aucune branche : aucune relation fiable (Property/Contrat/Hotel) n'existe sur ce modèle — confirmé par lecture du schéma (uniquement des références `User`). Il reste donc `unresolved` par la branche générique finale, cohérent avec la note de STORAGE-SECURITY-1 ("nécessite une consolidation métier séparée"). Aucun nom/email/téléphone n'a été utilisé comme preuve (interdit par §11 du sprint) ; `ambiguous`/`unresolved` restent toujours fail-closed (comportement hérité inchangé). Régression vérifiée : `tenantAttribution*.test.js` — 5/5 PASS après extension.

## 4. `auditPrivateCloudinaryAssets.js` — améliorations

- Bug `+champ` corrigé (§2).
- Réutilise `legacyAssetClassification.classifyLegacyAsset` (taxonomie unique) au lieu d'une classification dupliquée inline.
- Réutilise `resolveResourceTenant` pour peupler `tenantResolution`/`tenantId` (tronqué) par document, au lieu de l'absence totale d'attribution tenant du script précédent.
- Format de sortie aligné sur l'exemple exact du §12 du sprint : `classification, collection, documentId, field, assetClass, tenantResolution, tenantId, currentDeliveryType, publicId, legacyUrlPresent, proposedAction, confidence`, plus `sensitive` (Locataire/Proprietaire).
- Toujours strictement read-only : aucune API d'écriture Cloudinary/Mongo importée. `--mongo-uri` explicite accepté (§13) ; sinon repli sur `MONGO_URI` d'environnement — jamais d'exécution ambiguë silencieuse (erreur explicite si aucun des deux n'est fourni).
- Collections couvertes (fidèle à la liste imposée par le sprint) : Contrat (documents+etatsDesLieux), Document, Locataire, Proprietaire, Message, RentalMaintenanceTicket, Paiement, PaiementTransaction, RentalPaymentReceipt, Litige, Signalement, InternalMail, User (contratPdfUrl), FinancialDocumentArtifact, RealEstateApplication, plus Property/Hotel/Accommodation (`images`, marqués `publicMedia: true`, jamais migrables).

## 5. Matrice d'inventaire (par collection/champ)

| Collection | Champ | Type | Public légitime ? | Privé ? | URL stockée ? | publicId ? | deliveryType | Tenant direct ? | Tenant dérivable ? | Migration possible ? | Classe |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Property | images | image | Oui | Non | Oui | Oui (extrait) | upload | non | via owner | Jamais | PUBLIC_MEDIA (E) |
| Hotel | images | image | Oui | Non | Oui | Oui | upload | tenant direct | — | Jamais | PUBLIC_MEDIA (E) |
| Accommodation | images | image | Oui | Non | Oui | Oui | upload | tenant direct | — | Jamais | PUBLIC_MEDIA (E) |
| Contrat | documents[].url / .asset | raw PDF | Non | Oui | souvent | si présente | upload (legacy) / authenticated (nouveau) | non | via `bien` (Property.owner) | B si Property résolue, sinon C/F | PRIVATE_DOCUMENT |
| Contrat | etatsDesLieux[].documentUrl / .documentAsset | raw PDF | Non | Oui | souvent | si présente | upload/authenticated | non | via `bien` | B/C/F selon Property | PRIVATE_DOCUMENT |
| Document | content / privateAsset | mixte | Non | Oui | parfois | variable | variable | non | createdBy/client/relatedProperty/entity* | B/C/F | PRIVATE_DOCUMENT |
| Locataire | pieceIdentite / pieceIdentiteAsset | image/raw (IDENTITÉ) | Non | **Oui — sensible** | legacy oui | si présente | upload (legacy)/authenticated | non | via Contrat.locataire → Property | B/C/F, priorité HIGH/CRITICAL | PRIVATE_DOCUMENT (identity) |
| Proprietaire | pieceIdentite / pieceIdentiteAsset | image/raw (IDENTITÉ) | Non | **Oui — sensible** | legacy oui | si présente | upload (legacy)/authenticated | non | via `user` ou Contrat.proprietaire → Property | B/C/F, priorité HIGH/CRITICAL | PRIVATE_DOCUMENT (identity) |
| Message | attachments[] | image/video/raw | Non | Oui | oui | si présente | upload (legacy) | via Conversation.tenant | via participants/relatedProperty | B/C/F | PRIVATE_ATTACHMENT |
| RentalMaintenanceTicket | attachments[] | image | Non | Oui (opérationnel) | oui | si présente | upload (legacy) | non | via `property` | B/C/F | PRIVATE_OPERATIONAL_MEDIA |
| Paiement | preuvePaiement | image/raw | Non | Oui (financier) | oui | si présente | upload (legacy) | non | via `contrat` → Property | B/C/F | PRIVATE_DOCUMENT (financial) |
| PaiementTransaction | preuvePaiement | image/raw | Non | Oui (financier) | oui | si présente | upload (legacy) | non | via `transaction` → Property | B/C/F | PRIVATE_DOCUMENT (financial) |
| RentalPaymentReceipt | preuvePaiement | image/raw | Non | Oui (financier) | oui | si présente | upload (legacy) | non | via `contrat` → Property | B/C/F | PRIVATE_DOCUMENT (financial) |
| Litige | preuves[] | image/raw | Non | Oui | oui | si présente | upload (legacy) | non | via `bienConcerné` | B/C/F | PRIVATE_ATTACHMENT |
| Signalement | preuves[] | image/raw | Non | Oui | oui | si présente | upload (legacy) | non | via `property` | B/C/F | PRIVATE_ATTACHMENT |
| InternalMail | attachments[] | mixte | Non | Oui | oui | si présente | upload (legacy) | **aucune relation fiable** | aucune | **Toujours F — jamais migrable ce sprint** | UNKNOWN |
| User | contratPdfUrl / contratPdfAsset | raw PDF (mandat) | Non | Oui | legacy oui | si présente | upload (legacy)/authenticated | via `fromUser` | — | B/C/F | PRIVATE_DOCUMENT (administrative) |
| FinancialDocumentArtifact | storageKey | raw PDF | Non | Oui | non (déjà `storageKey` privé) | — | déjà privé | via `establishmentId`+`domain` | — | déjà A (architecture STORAGE-SECURITY-1 saine) | A |
| RealEstateApplication | attachments[] | image/raw | Non | Oui | non (déjà `storageKey` privé) | — | déjà privé | via `property` | — | déjà A | A |

Aucune collection n'a été supposée hors périmètre sans vérification de code (§6 du sprint) : le schéma de chaque modèle listé a été lu intégralement.

## 6. Pièces d'identité — priorité maximale (§27)

`Locataire.pieceIdentite`/`Proprietaire.pieceIdentite` sont les seules ressources dont l'exposition legacy est classée **HIGH/CRITICAL par défaut** dès qu'une URL Cloudinary publique historique est détectée, indépendamment du résultat d'attribution tenant. Constat positif : le contrôleur (`locataireController.serializeLocataire`/`downloadIdentityDocument`) **distingue déjà explicitement** legacy vs privé — `identityDocument.legacy: !hasPrivate` dans la réponse API, et le téléchargement passe par `streamRemoteDocument` (proxy backend) plutôt que de renvoyer l'URL brute au client. Ceci satisfait la contrainte du sprint DOC-EVO (§24 : *"un document non migré ne doit jamais être présenté comme sécurisé"*) au niveau applicatif — **mais ne ferme pas la fuite structurelle** : l'URL Cloudinary publique originale reste, elle, directement accessible à quiconque la connaît déjà (capture d'écran, lien partagé, cache), hors de tout contrôle du proxy. C'est exactement l'Option D décrite au §15 du sprint, explicitement insuffisante seule.

## 7. Preuve Cloudinary (§14) — ce qui est confirmé et ce qui ne l'est pas

SDK installé : `cloudinary@2.9.0` (`node_modules/cloudinary/lib/uploader.js`, vérifié directement, pas deviné).

**Confirmé par lecture du code du SDK installé :**
- `cloudinary.uploader.rename(from_public_id, to_public_id, callback, { type, to_type, invalidate, resource_type, overwrite })` — supporte bien `to_type` (changement de delivery type, ex. `upload` → `authenticated`) et `invalidate`.
- `cloudinary.uploader.destroy(public_id, callback, { type, invalidate })` — déjà utilisé par `secureStorageService.deletePrivateAsset`.
- `cloudinary.utils.private_download_url(...)` — déjà utilisé par `secureStorageService.generatePrivateAccess` pour les accès signés courts.

**Ce qui ne peut pas être confirmé depuis ce projet (documenté honnêtement plutôt que deviné) :**
- Le comportement réel du CDN Cloudinary après `invalidate: true` sur un `rename` — Cloudinary documente cette invalidation comme "best effort", non instantanée (jusqu'à ~10 minutes), et non garantie à 100 % sur tous les nœuds CDN hors plan Advanced. Aucun test contre le compte Cloudinary réel du projet n'a été exécuté ce sprint (aucun environnement explicitement sûr fourni) — cette limitation est donc réelle et non résolue par du code.
- Le comportement exact de `rename` sur des ressources `resource_type: video`/`raw` volumineuses (rate limits, temps de traitement) n'a pas été mesuré en conditions réelles.

## 8. Stratégie de migration retenue

Comparaison des quatre options du §15 :

- **Option A (re-upload + suppression ancienne)** : duplique la bande passante/stockage, transite le fichier par le serveur applicatif inutilement puisque Cloudinary héberge déjà l'octet-source.
- **Option B (copy + suppression ancienne)** : même limite, plus une fenêtre où deux ressources existent simultanément.
- **Option C — retenue : `rename` avec `to_type: 'authenticated'`, `invalidate: true`.** Ne duplique jamais le stockage, ne transite aucun octet par le serveur, et le changement de segment d'URL (`/upload/` → `/authenticated/`) rend l'ancienne URL structurellement invalide (404) **dès la bascule côté origine Cloudinary**, indépendamment de la propagation CDN. `invalidate: true` demande en plus la purge du cache CDN en best-effort. C'est la seule option qui ferme réellement la fuite décrite au §5 du sprint sans duplication ni fenêtre d'incohérence prolongée.
- **Option D (proxy backend seul, sans migration)** : déjà en place pour Locataire/Proprietaire (§6) — explicitement insuffisante seule, conservée uniquement comme couche applicative additionnelle, jamais comme preuve de fermeture de la fuite.

## 9. Preuve fonctionnelle (fixtures isolées, aucune donnée réelle)

- Script d'audit corrigé exécuté sur MongoMemoryServer avec fixtures `Contrat.documents[].url` + `Property.images` : classification correcte (`C` pour le Contrat sans membership tenant résolvable dans la fixture minimale, `E` pour l'image Property) — voir §2.
- Moteur de migration (`legacyAssetMigrationService`) testé sur MongoMemoryReplSet avec Cloudinary et vérification OLD URL **mockés** (aucun appel réseau/Cloudinary réel) : idempotence, verrouillage concurrent, reprise après panne, refus par défaut du mode `--apply`, réversibilité limitée aux runs non complétés — tous vérifiés par `server/__tests__/legacyAssetMigrationEngine.mongo.integration.test.js` (15/15 PASS).

## 10. Ce que cet audit NE couvre PAS

- Aucune exécution contre une base de données réelle (aucun `MONGO_URI` de production fourni, et le sprint l'interdit sans fourniture explicite).
- Aucun test contre un compte Cloudinary réel (comportement CDN best-effort documenté, non mesuré).
- Playwright/Expo Doctor : non ré-audités dans le cadre de cet audit initial (hors périmètre strict de l'inventaire Cloudinary) — traités séparément dans le rapport final.
