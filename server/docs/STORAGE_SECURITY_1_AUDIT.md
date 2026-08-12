# STORAGE-SECURITY-1 — Audit initial Cloudinary et diffusion documentaire

Date de l'audit : 2026-08-11. Cet état a été établi en lecture seule avant toute modification du sprint.

## Périmètre et méthode

Recherche exhaustive dans `server`, `client`, `altimmo-app` et `shared` des usages `cloudinary`, `upload_stream`, `uploader.upload`, `secure_url`, `resource_type`, `type`, `authenticated`, `private`, `signed`, `download`, `preview`, `attachment`, `folder` et `public_id`, puis lecture des modèles, contrôleurs, services et routes concernés. Le SDK installé est `cloudinary@2.9.0`.

La documentation Cloudinary confirme que le delivery `upload` est public par défaut, que `private` ne protège que l'original, et que `authenticated` protège l'original et les dérivés. La stratégie retenue pour les nouveaux fichiers privés est donc `type=authenticated`, génération exclusivement serveur d'un accès signé très court, récupération par le backend, puis stream après Auth + Tenant + autorisation métier. Aucune URL signée n'est persistée ni remise comme identifiant.

## Taxonomie retenue

Deux classes suffisent :

- `PUBLIC_MEDIA` : média explicitement destiné à une diffusion publique (photos Property, Hotel, Accommodation, publicité et éventuellement avatar public).
- `PRIVATE_DOCUMENT` : tout fichier métier ou personnel non destiné au public. Le champ `purpose` précise sans créer d'enums concurrents : `identity`, `lease`, `financial`, `conversation`, `maintenance`, `application` ou `administrative`.

Privé par défaut dès qu'un usage n'est pas explicitement public.

## Matrice initiale

| Usage | Fichiers principaux | Ressource | Classe | Mode avant sprint | URL stockée/exposée | Route backend | Tenant-aware | Risque initial |
|---|---|---|---|---|---|---|---|---|
| Photos Property | `propertyController`, mobile publication | image | PUBLIC_MEDIA | `upload` | oui/oui | non requise | attribution métier | acceptable |
| Photos Hotel | `hotelController`, `hotelService` | image | PUBLIC_MEDIA | `upload` | oui/oui | non requise | attribution métier | acceptable |
| Photos Accommodation | `accommodationController`, mobile | image | PUBLIC_MEDIA | `upload` | oui/oui | non requise | attribution métier | acceptable |
| Publicités/avatars | clients + auth/user controllers | image | PUBLIC_MEDIA | upload direct/public | oui/oui | non requise | variable | acceptable si média volontairement public |
| PDF financiers officiels | `financialDocumentStorageService`, `FinancialDocumentArtifact` | raw PDF | PRIVATE_DOCUMENT/financial | `authenticated` | clé/version seulement, non exposées | download métier streamé | oui | architecture sûre déjà présente |
| Pièces de candidatures immobilières | `realEstateApplicationStorageService`, `RealEstateApplication` | raw/image | PRIVATE_DOCUMENT/application | `authenticated` | storageKey `select:false` | routes métier streamées | oui | architecture sûre déjà présente |
| Contrat.documents / quittances / préavis / mises en demeure / EDL | `gestionDocumentController`, `Contrat` | raw PDF | PRIVATE_DOCUMENT/lease | `upload` public | `secure_url` stockée et parfois renvoyée/emailée | proxy GL partiel | contrôle applicatif oui | critique : URL exacte contourne l'application |
| Identité Locataire | `locataireController`, `Locataire`, `Document.content` | image/raw | PRIVATE_DOCUMENT/identity | `upload` public | URL dupliquée et renvoyée par CRUD/portail | aucune route dédiée | routes historiques insuffisamment scopées | critique |
| Identité Proprietaire | `proprietaireController`, `Proprietaire`, `Document.content` | image/raw | PRIVATE_DOCUMENT/identity | `upload` public | URL dupliquée et renvoyée | aucune route dédiée | routes historiques insuffisamment scopées | critique |
| Preuves Paiement GL | `paiementController`, `Paiement` | auto | PRIVATE_DOCUMENT/financial | `upload` public | URL + publicId exposés | aucune route dédiée | relation contrat côté écriture | critique |
| Preuves Paiement transaction | `paiementTransactionController`, `PaiementTransaction` | auto | PRIVATE_DOCUMENT/financial | `upload` public | URL + publicId exposés | aucune route dédiée | autorisation transaction | critique |
| Conversation attachments | `messageController`, `Message` | image/video/raw | PRIVATE_DOCUMENT/conversation | `upload` public | URL renvoyée à tous les clients | aucune route de fichier | conversation tenant-aware | critique |
| Maintenance locative | `tenantPortalController`, `RentalMaintenanceTicket` | image | PRIVATE_DOCUMENT/maintenance | `upload` public | URL renvoyée | aucune route de fichier | dossier locataire | critique |
| Litiges/signalements | contrôleurs dédiés | image/raw | PRIVATE_DOCUMENT/administrative | `upload` public | URL stockée/exposée | aucune route dédiée | hétérogène | élevé |
| Emails Zoho/InternalMail | `zohoImapService`, mail controllers | raw/auto ou disque | PRIVATE_DOCUMENT/administrative | public Cloudinary ou stockage local | URL/path stocké | hétérogène | hétérogène | élevé, nécessite consolidation métier séparée |
| Contrats d'inscription User | `authController`, `userController` | raw PDF | PRIVATE_DOCUMENT/administrative | `upload` public | `contratPdfUrl` stockée/envoyée | aucune route dédiée | utilisateur | critique |

## Modèles et métadonnées

- `FinancialDocumentArtifact` possède déjà `storageKey`/`storageVersion` non sélectionnés, MIME, taille et hash : conforme.
- `RealEstateApplication.attachments` possède un `storageKey` privé et n'expose que les métadonnées : conforme.
- `Contrat.documents[]` et `etatsDesLieux[]` ne possèdent que des URLs legacy : ajouter des métadonnées additives sans retirer `url`/`documentUrl`.
- `Message.attachments`, `RentalMaintenanceTicket.attachments`, `Paiement.preuvePaiement`, `PaiementTransaction.preuvePaiement`, `Locataire` et `Proprietaire` doivent recevoir une référence de stockage additive. Les champs URL restent pour lecture legacy mais ne doivent plus être le contrat d'accès ni être sérialisés pour un nouvel asset privé.
- `Document.content` mélange texte et URL. Il reste compatible mais doit pouvoir référencer la ressource privée canonique sans exposer une URL.

## Réponses API et clients

Les API GL/DOC-EVO ont déjà commencé à retourner des endpoints backend, mais plusieurs réponses CRUD sérialisent encore les champs URL bruts. Le Web ouvre directement des URLs dans Messages, Staff Inbox, Transactions, Gestion locative, Litiges et messagerie interne. Le Mobile rend directement `att.url` dans Chat. Les services de documents personnels Web/Mobile utilisent déjà les endpoints backend et sont réutilisables.

## Cache, logs et API publique

Les streams financiers/GL utilisent déjà `Cache-Control: private, no-store` et `nosniff`. Les nouveaux streams reprendront ces en-têtes. Les URLs signées ne devront jamais entrer dans un cache applicatif. Plusieurs rollbacks loggent actuellement une URL Cloudinary complète : ils devront journaliser un identifiant tronqué ou l'identifiant métier. L'API publique Property ne nécessite que les médias publics ; aucune justification n'existe pour exposer contrats, identités, factures, conversations ou preuves.

## Architecture cible

Une couche `secureStorageService` centralisera : classification, upload public, upload privé authenticated, normalisation des métadonnées, génération d'accès interne court, lecture privée, suppression compensatoire et sérialisation sûre. Les routes restent métier : aucun endpoint n'acceptera un `publicId` arbitraire. Le backend résout d'abord l'entité et son tenant/permission, puis lit le fichier privé et le streame avec des en-têtes `no-store`.

Les nouveaux assets privés ne conserveront pas `secure_url`. Les anciens champs URL restent intacts et utilisables uniquement derrière les proxys métier pour compatibilité ; ils seront classés par le script dry-run, sans migration, suppression ou appel Cloudinary d'écriture.

## Données legacy et verdict possible

Les assets legacy publics ne peuvent pas devenir privés par masquage d'API. Leur migration ultérieure devra copier/re-uploader en `authenticated`, vérifier la nouvelle ressource, basculer la référence, puis révoquer explicitement l'ancien asset public dans une procédure contrôlée. Ce sprint peut valider les nouveaux documents et les frontières applicatives, mais ne certifiera pas les URLs publiques historiques non migrées.
