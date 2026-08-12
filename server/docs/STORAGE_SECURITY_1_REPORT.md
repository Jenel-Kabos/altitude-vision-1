# STORAGE-SECURITY-1 — Rapport d'implémentation et de certification

Date : 2026-08-11  
Périmètre : `server`, `client`, `altimmo-app`, lecture seule des données et aucune opération Cloudinary de production.

## 1. Architecture Cloudinary avant

Les médias publics et une grande partie des documents métier partageaient le delivery Cloudinary public `upload`. Les contrôles Auth, tenant et métier protégeaient les routes, mais une URL exacte déjà connue permettait encore d'atteindre directement contrats, identités, preuves, pièces jointes et documents administratifs. Deux domaines étaient déjà conformes : les artefacts financiers officiels et les dossiers de candidature immobilière utilisaient un `storageKey` privé.

## 2. Public assets

Les photos Property, Hotel et Accommodation, les publicités et les avatars explicitement publics restent classés `PUBLIC_MEDIA`. Leur upload et leur diffusion directe n'ont pas été rendus privés. Les parcours et builds Web/Mobile confirment leur compatibilité.

## 3. Private assets

Contrats, états des lieux, identités, factures/quittances, preuves de paiement, pièces jointes de conversation, preuves de maintenance, litiges, signalements, courriers internes et contrats d'inscription sont `PRIVATE_DOCUMENT`. Un `purpose` descriptif affine l'usage sans multiplier les taxonomies.

## 4. Risques trouvés

- URL Cloudinary permanente stockée et sérialisée ;
- ouverture directe par Web/Mobile ;
- upload public de fichiers privés ;
- modèles hétérogènes et parfois URL seule ;
- absence de route métier pour plusieurs familles ;
- URLs complètes susceptibles d'apparaître dans certains logs de rollback ;
- anciennes ressources toujours publiques chez Cloudinary malgré leur masquage applicatif.

## 5. URLs permanentes exposées

L'audit initial les a trouvées dans `Contrat`, `Document`, `Locataire`, `Proprietaire`, paiements, reçus, `Message`, maintenance, litiges/signalements, `InternalMail` et `User`. Les nouveaux objets privés ne prennent plus `secure_url` comme contrat d'accès. Les sérialiseurs retirent URL et publicId privés et retournent des endpoints métier. Les champs URL legacy sont conservés additivement, sans prétendre sécuriser leur delivery historique.

## 6. Stratégie choisie

Les nouveaux fichiers privés sont envoyés avec `type=authenticated`. Après Auth, résolution du tenant et permission métier, le serveur fabrique en mémoire un accès signé très court, récupère la ressource et la streame. L'URL signée n'est ni persistée, ni journalisée, ni remise au client. Ce choix protège original et dérivés, contrairement au simple delivery `private` qui ne suffit pas à cette frontière.

## 7. Service central storage

`secureStorageService` centralise `classifyAsset`, `uploadPublicAsset`, `uploadPrivateAsset`, normalisation des métadonnées, génération d'accès interne, stream, en-têtes de sécurité et suppression compensatoire. `privateAssetSchema` fournit les métadonnées additives communes : publicId, resourceType, deliveryType, classe, purpose, version, MIME, nom et taille.

## 8. Upload public

`uploadPublicAsset` conserve le delivery `upload` et retourne l'URL uniquement pour une ressource explicitement publique. Les contrôleurs d'annonces ne sont pas redirigés vers le coffre privé.

## 9. Upload private

Les nouvelles écritures des domaines Document/Contrat, identité, paiement, conversation, maintenance, litige/signalement, courrier interne, inscription, finance et candidature immobilière passent par le service central ou ses adaptateurs. La référence persistée est la métadonnée de stockage, pas une URL d'accès.

## 10. Signed access / stream

Il n'existe pas de route générique acceptant un publicId arbitraire. Chaque route charge d'abord l'entité métier et vérifie le demandeur. Le flux final renvoie le MIME connu, un nom neutralisé, `Content-Disposition`, `Cache-Control: private, no-store`, `Pragma: no-cache` et `X-Content-Type-Options: nosniff`. L'accès signé Cloudinary est interne et court.

## 11. DOC-EVO

Les architectures `Document`, `Contrat.documents[]` et `FinancialDocument` restent séparées. Preview et téléchargement continuent via leurs routes métier ; le centre documentaire reçoit `previewEndpoint`/`downloadEndpoint` et non une URL Cloudinary privée permanente.

## 12. Finance

Les artefacts financiers et candidatures déjà privées sont raccordés au service central. Les preuves de paiements, transactions et reçus reçoivent une référence privée et des routes autorisées. Aucune ADR financière ni aucun calcul n'a été modifié.

## 13. GL

Contrats, documents locatifs, états des lieux, paiements et maintenance utilisent le coffre. Les proxys legacy restent disponibles après contrôle métier afin de préserver GL, GL-RECON et le portail locataire.

## 14. Identity

Les pièces Locataire et Proprietaire sont uploadées en privé. Les CRUD ne sérialisent plus une URL permanente pour un nouvel asset. Les téléchargements Web et Tenant Portal passent par une route authentifiée et autorisée ; les champs chaîne historiques restent compatibles derrière le proxy.

## 15. Conversations

Les attachments de nouveaux messages sont privés. Le téléchargement exige l'appartenance au tenant puis la qualité de participant ou la permission staff de la conversation. La connaissance de conversationId, messageId, publicId ou ancienne URL ne permet pas de demander un nouvel accès à un document d'un autre tenant.

## 16. Maintenance

Les preuves de ticket, inspection et état des lieux sont privées par défaut, distinctes des photos d'annonce. Le schéma et les routes de maintenance exposent des endpoints sécurisés et maintiennent une lecture proxy des références historiques.

## 17. Mobile

`ChatScreen` n'ouvre plus `attachment.url`. `secureAttachmentService` télécharge avec le token depuis l'endpoint backend, stocke seulement un fichier temporaire local et utilise le partage natif. Les tests Jest complets et TypeScript Mobile passent ; l'export Android passe.

## 18. Web

Messages, Staff Inbox, Gestion locative, Documents locatifs, Transactions, Courrier interne et Litiges utilisent leurs endpoints backend. Aucun de ces composants n'ouvre désormais une URL Cloudinary permanente privée.

## 19. Legacy assets

Les documents déjà livrés publiquement restent hors certification : cacher leur URL dans une API ne révoque pas l'ancienne URL exacte. Aucun fichier historique n'a été modifié, copié, renommé ou supprimé durant ce sprint.

## 20. Script dry-run

`server/scripts/auditPrivateCloudinaryAssets.js` inspecte sans écriture les collections concernées et produit A (déjà privé), B/C (public avec référence exploitable/migrable), D (sans publicId fiable), E (public légitime) ou F (ambigu), avec collection, document, champ, classe, action proposée et confiance. Il n'exécute aucun apply.

## 21. Stratégie de migration legacy

Une procédure ultérieure devra, dossier par dossier : ré-uploader/copy en `authenticated`, vérifier contenu et métadonnées, basculer atomiquement la référence, vérifier le téléchargement autorisé, puis révoquer l'ancien asset public. La révocation ne devra intervenir qu'après validation et avec journal d'audit/rollback. Aucun backfill réel n'a été lancé.

## 22. Tests adversariaux

Les tests du service vérifient le delivery public, le delivery authenticated, l'absence d'URL permanente, l'expiration courte, les en-têtes du stream et la neutralisation des noms. Les tests de sérialisation couvrent identité, contrat, finance, conversation, maintenance et preuves, et interdisent URL/publicId privés dans le JSON. Les tests d'intégration document vérifient l'accès même tenant et le refus inter-tenant avant lecture Cloudinary.

## 23. Cloudinary direct URL test

Pour un nouvel asset, aucune URL publique permanente n'est produite ou stockée ; `deliveryType=authenticated` interdit le contrat d'accès public. La signature temporaire est exclusivement consommée côté serveur. Le test direct réel contre Cloudinary production n'a volontairement pas été effectué, l'écriture/production étant interdite. Les fixtures legacy sont classées comme non certifiées.

## 24. Performances

Le proxy ajoute un saut serveur et transfère les octets via l'API, coût accepté pour l'autorisation forte. Le stream évite la mise en mémoire applicative durable, les accès temporaires sont courts et aucun cache privé long n'est autorisé. Les images publiques gardent leur CDN direct.

## 25. Tests globaux réellement exécutés

| Gate | Résultat frais | Détail |
|---|---:|---|
| STORAGE-SECURITY-1 ciblé | PASS | 2 suites, 9 tests |
| Backend Unit complet | ÉCHEC | 105 suites passent, 1 échoue ; 1222 tests passent, 1 échoue : check-in hôtel attendu 409, reçu 401 |
| Backend Mongo complet final | PASS | 67 suites, 631 tests ; 842,403 s Jest, replica set arrêté proprement |
| Web Vitest complet | PASS | 76 fichiers, 513 tests |
| Mobile Jest complet | PASS | 24 suites, 227 tests |
| TypeScript Mobile | PASS | aucune erreur |
| Expo Doctor | ÉCHEC | 19/20 contrôles ; 9 dépendances Expo ont un patch de retard |
| ESLint serveur | PASS | 0 erreur, 128 avertissements |
| ESLint client | PASS | 0 erreur, 268 avertissements |
| ESLint mobile | PASS | 0 erreur, 86 avertissements |
| Next.js build | PASS | build production, 142 pages |
| Export Android | PASS | bundle généré, environ 6,6 MB |
| Playwright desktop/mobile | ÉCHEC | 32 passent, 2 échouent sur le même onboarding GL (option Property absente), une fois desktop et une fois mobile |
| `git diff --check` | PASS | aucune erreur d'espacement ; avertissements de normalisation CRLF uniquement |

Les erreurs Backend Unit, Expo Doctor et Playwright ne concernent pas directement le coffre, mais les critères imposent des gates globales critiques vertes : elles bloquent donc le PASS du sprint. La suite Mongo finale est verte sur l'état final corrigé.

## 26. Dettes restantes

- migrer et révoquer les URLs publiques legacy dans une opération contrôlée séparée ;
- corriger la fixture/contexte tenant du test unitaire hôtel ;
- corriger l'onboarding GL Playwright où le Property attendu n'est pas proposé ;
- aligner les neuf patchs Expo attendus, dans un sprint dépendances dédié ;
- ajouter des tests route-level dédiés à chaque nouveau proxy Litige/Signalement/InternalMail ;
- raccorder réellement les pièces jointes sortantes de courrier externe au transport Zoho ;
- prévoir le nettoyage différé d'un asset privé orphelin si la validation conversation échoue après upload.

## 27. Fichiers créés

- `altimmo-app/src/services/secureAttachmentService.js`
- `server/__tests__/privateAssetSerialization.test.js`
- `server/__tests__/secureStorageService.test.js`
- `server/docs/STORAGE_SECURITY_1_AUDIT.md`
- `server/docs/STORAGE_SECURITY_1_REPORT.md`
- `server/models/schemas/privateAssetSchema.js`
- `server/scripts/auditPrivateCloudinaryAssets.js`
- `server/services/storage/secureStorageService.js`

Les autres fichiers non suivis visibles dans le worktree (`TENANT_HARDENING_2_*` et leurs tests) préexistaient à ce sprint et ne sont pas attribués à STORAGE-SECURITY-1.

## 28. Fichiers modifiés

- Mobile : `altimmo-app/src/screens/Messagerie/ChatScreen.jsx`.
- Web pages : `MessagesPage.jsx`, `StaffInboxPage.jsx`, `GestionLocativePage.jsx`, `InternalMessagingPage.jsx`, `LitigesPage.jsx`, `RentalDocumentsPage.jsx`, `TransactionsPage.jsx`.
- Web services/tests : `conversationService.js`, `gestionLocativeService.js`, `litigeService.js`, `messageService.js`, `transactionService.js`, `RentalDocumentsPage.test.jsx`.
- Contrôleurs serveur : auth, conversation, document/DOC-EVO, courrier interne, litige, locataire, message, paiement/transaction, propriétaire, documents/maintenance GL, signalement, portail locataire et utilisateur.
- Modèles serveur : `Contrat`, `Document`, `InternalMail`, `Litige`, `Locataire`, `Message`, `Paiement`, `PaiementTransaction`, `Proprietaire`, `RentalMaintenanceTicket`, `RentalPaymentReceipt`, `Signalement`, `User`.
- Routes serveur : courrier interne, litige, locataire, message, paiements/transactions, propriétaire, maintenance/gestion locative, signalement, portail locataire, utilisateur.
- Services serveur : adaptateur dossier GL, notification, portail locataire, Zoho IMAP, `financialDocumentStorageService`, `realEstateApplicationStorageService`.
- Tests serveur ajustés : classification identité, paiements GL, téléchargement document locatif, maintenance, rollback Cloudinary et fixtures métier dépendantes.

Des changements TENANT-HARDENING-2 étaient déjà présents dans le même worktree (auth context, reporting, ERP, socket, portfolio et tests associés). Ils ont été conservés sans nettoyage ni attribution à ce sprint.

## 29. Verdict

**STORAGE-SECURITY-1 = NON CERTIFIÉ à ce stade.**

Le mécanisme des **nouveaux documents privés est implémenté et ses tests ciblés sont verts** : upload `authenticated`, aucune URL permanente comme contrat d'accès, Auth + tenant + permission métier avant stream, endpoints Web/Mobile et conservation des médias publics. Toutefois, les critères du sprint interdisent un PASS tant que les gates globales critiques ne sont pas toutes vertes ; Backend Unit, Expo Doctor et Playwright sont rouges. Les documents legacy publics restent explicitement non certifiés jusqu'à migration et révocation réelles.

Confirmations : **aucun commit ; aucun push ; aucun déploiement ; aucune migration destructive ; aucun backfill réel ; aucune suppression de données ; aucune migration Cloudinary production automatique ; aucune écriture de production.**
