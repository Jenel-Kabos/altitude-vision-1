# Sprint DOC-MOBILE-1 — Audit initial

## Périmètre et règle d'audit

Audit réalisé avant toute modification fonctionnelle. Le centre documentaire administratif Web reste hors périmètre Mobile. Le coffre natif doit être une projection personnelle des sources métier existantes, jamais une nouvelle collection ni une seconde logique documentaire.

## Cartographie des sources documentaires

### Gestion locative

- Source principale : `Contrat.documents[]` (`bail`, `quittance`, `mise_en_demeure`, `preavis`, `etat_entree`, `etat_sortie`).
- États des lieux complémentaires : `Contrat.etatsDesLieux[].documentUrl`.
- Pièces d'identité : `Document` classé automatiquement par les workflows Locataire/Propriétaire avec `visibility=tenant|owner`, plus la référence source `pieceIdentite`.
- Reçus de paiement : `RentalPaymentReceipt`; les quittances visibles sont matérialisées dans `Contrat.documents[]` lorsque le workflow les génère.
- API personnelle existante : `GET /api/tenant-portal/documents`, résolue exclusivement depuis `req.user.id`, jamais depuis un identifiant locataire fourni par le client.
- Accès fichier existant : `GET /api/tenant-portal/documents/:documentId/download` et proxy `GET /api/rental-documents/:documentId/download`.

### Hébergements indépendants

- Facture : `FinancialDocument` de domaine `real_estate`, établissement `Accommodation`, sujet `AccommodationReservation`.
- Paiements et reçus fonctionnels : `FinancialPayment` exposé par la synthèse financière de la réservation.
- APIs existantes : liste/détail des réservations, `financial-summary`, `GET /api/financial/documents/:id`, statut PDF et téléchargement PDF sécurisé.
- RBAC existant ACC-MOBILE-1 : voyageur, propriétaire concerné ou staff ; relation exacte réservation/document vérifiée.

### Hôtel

- Facture : `FinancialDocument` de domaine `hotel`, sujet `HotelReservation`.
- API personnelle existante : `GET /api/hotel-reservations/mine`.
- API documentaire existante : `GET /api/financial/hotel/reservations/:reservationId/document`, puis endpoints génériques document/PDF.
- Écart : la lecture documentaire est actuellement limitée aux capacités staff/hôtel, alors que le voyageur peut lire sa propre réservation. Le contrôle participant doit être étendu sur ces endpoints existants, sans en créer de nouveau.

### Candidatures et transactions immobilières

- Pièces de candidature : `RealEstateApplication.attachments`, protégées par `GET /api/real-estate-applications/:id/attachments/:attachmentId` et le RBAC de la candidature.
- Facture de finalisation immobilière : modèle `Document`, rattaché à la transaction ; le centre global `/api/documents` est strictement administratif.
- Écart : aucune API personnelle existante ne fournit aujourd'hui une projection sûre de toutes les factures génériques `Document`. Elles ne doivent donc pas être exposées artificiellement par le Mobile.

## Téléchargements et sécurité

- Le proxy `rentalDocumentController` authentifie, vérifie staff/propriétaire/locataire sur le bail, masque URL Cloudinary et `publicId`, journalise l'accès et répond avec `private, no-store`.
- Le portail locataire vérifie bien la relation utilisateur/locataire, mais son mode JSON renvoie encore l'URL amont ; le Mobile l'utilise ensuite directement. C'est un écart avec l'exigence de proxy sécurisé.
- Les PDFs financiers sont servis depuis le stockage DOC-EVO avec Bearer, hash vérifié, ledger d'accès et `private, no-store`.
- Les pièces d'identité du modèle `Document` ne doivent jamais transiter par `/api/documents`, réservé au centre administratif.
- Aucun fichier sécurisé ne doit être conservé dans le cache offline persistant. Seules les métadonnées peuvent l'être ; un fichier temporaire de partage doit rester dans le cache OS.

## RBAC observé

- Centre documentaire global `/api/documents` : rôles staff document uniquement.
- Contrats `/api/contrats` : staff immobilier/secrétariat uniquement.
- Portail locataire : compte User explicitement rattaché à un `Locataire`; résolution serveur depuis l'identité authentifiée.
- Document locatif : staff documentaire, propriétaire réel du bien ou locataire réel du bail.
- Accommodation : voyageur/propriétaire réels ou staff.
- Hôtel : réservation lisible par son voyageur, mais documents financiers encore staff-only avant correction.
- Candidature : demandeur ou staff selon le contrôleur existant ; pièce téléchargée par identifiants imbriqués validés.

## Web de référence

- `DocumentsPage` : centre global administratif, taxonomie Pôle/Service/Catégorie, recherche et dossiers. Ne doit pas être porté sur Mobile.
- `RentalDocumentsPage` : agrégation de `Contrat.documents[]`, pièces d'identité classées et téléchargement sécurisé.
- `DossierPanel` et adaptateurs `dossier/*` : projections métier et timelines, réservées aux routes staff actuelles.
- `FinancialDocumentsFolder` et panneau hôtelier : conventions de facture, statut, lignes et PDF.
- `TenantPortalPage` : projection personnelle locataire déjà transposée partiellement sur Mobile.

## Mobile existant

- `TenantPortalScreen` contient déjà une section Documents avec pagination, preview, téléchargement, cache de métadonnées et offline lecture seule.
- `AccommodationReservationDetailScreen` sait consulter et télécharger une facture DOC-EVO.
- `HotelReservationDetailScreen` ne présente aucun document financier.
- FileSystem et Sharing sont installés ; les services API authentifiés et le cache de lecture sont réutilisables.
- NAV-CORE contient `TENANT_DOCUMENTS`, mais aucune destination personnelle générique `MY_DOCUMENTS` ni destination de document précis.
- Les notifications utilisent déjà le SDK NAV partagé.

## Éléments manquants

- Écran autonome `Mes documents`, accessible à tous les utilisateurs authentifiés.
- Agrégation Mobile des seules sources personnelles disponibles : locatif, Accommodation et hôtel.
- Catégorisation normalisée, recherche, filtres et tri uniquement sur les métadonnées retournées.
- Consultation/téléchargement/partage via URL API authentifiée, sans URL Cloudinary directe.
- Accès voyageur aux documents financiers de sa réservation hôtel.
- Destinations NAV-CORE du coffre et d'un document précis ; ouverture depuis notification et retour de stack correct.
- Tests de non-divulgation par identifiant arbitraire pour locatif, Accommodation et hôtel.

## Éléments réutilisables

- Endpoints de liste et de téléchargement existants ; aucun endpoint supplémentaire nécessaire.
- Contrôles métier du portail locataire, des réservations et du Financial Core.
- Service de cache, FileSystem, Sharing, composants `PageHeader`, `Card`, `Skeleton`, `EmptyState`, thèmes et patterns responsive.
- Registre et SDK NAV-CORE.
- Modèles et classifications documentaires existants.

## Architecture retenue après audit

1. Créer une façade Mobile qui agrège les APIs existantes, tolère l'absence légitime d'un portail/domaine et normalise uniquement les métadonnées d'affichage.
2. Étendre les endpoints existants, sans nouvelle route :
   - le portail locataire renvoie un chemin de téléchargement authentifié et stream le contenu au lieu d'exposer l'URL amont ;
   - le Financial Core reconnaît le voyageur de la réservation hôtel comme lecteur de sa facture/PDF.
3. Ajouter `MY_DOCUMENTS` et `MY_DOCUMENT_DETAILS` au registre NAV-CORE ; tous les appels de navigation et notifications passent par ces IDs.
4. Ne pas exposer les documents internes, brouillons administratifs, livraisons, ledgers, pièces sans relation personnelle prouvée ni documents génériques staff.
5. Cache offline limité aux listes/métadonnées ; preview, téléchargement et partage exigent une connexion et utilisent un fichier temporaire.

## Risques identifiés avant réalisation

- Les domaines n'ont pas un endpoint personnel unifié : l'agrégation Mobile nécessite plusieurs lectures, avec gestion indépendante des erreurs 403/404.
- Les factures hôtel ne sont pas toujours émises ou dotées d'un PDF ; l'interface doit distinguer métadonnée disponible et artefact téléchargeable.
- Les propriétaires n'ont pas de portail personnel de documents locatifs listant leurs baux via une API existante ; sans nouvel endpoint, seuls leurs documents accessibles via les autres parcours peuvent être affichés.
- Les reçus locatifs détaillés n'ont pas tous un artefact partageable ; aucune représentation PDF ne doit être inventée.
