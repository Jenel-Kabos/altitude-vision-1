# Sprint DOC-MOBILE-1 — Rapport final

## Résultat

Le coffre documentaire personnel natif est disponible dans le profil Mobile. Il agrège les documents personnels déjà exposés par la Gestion locative, les hébergements indépendants et l'hôtellerie, sans créer d'endpoint ni de règle métier. Recherche, catégories, tri, pagination d'affichage, détail, prévisualisation/téléchargement et partage sécurisé sont connectés.

## Audit initial et cartographie

L'audit préalable complet est consigné dans `server/docs/DOC_MOBILE_1_AUDIT.md`. Il cartographie les modèles, APIs, écrans Web/Mobile, contrôles RBAC, téléchargements, notifications et destinations NAV-CORE.

Sources retenues :

- Gestion locative : `GET /api/tenant-portal/documents` et téléchargement locataire existant.
- Accommodation : réservations personnelles et `FinancialDocument`/PDF DOC-EVO existants.
- Hôtel : réservations voyageur/propriétaire et document financier de réservation existant.
- Navigation : registre partagé `shared/navigation/registry.json` et SDK NAV-CORE.

Le centre `/api/documents`, les dossiers administratifs, les brouillons et les pièces sans relation personnelle prouvée restent volontairement exclus du Mobile.

## Décisions d'architecture et éléments réutilisés

- Une façade Mobile agrège les APIs existantes et ne normalise que les métadonnées de présentation. Elle ne calcule aucun montant, statut financier ou droit métier.
- Les absences légitimes de domaine (403/404) sont isolées afin qu'un utilisateur sans portail locataire conserve ses documents Accommodation/Hôtel.
- Le cache mémoire de trois minutes contient uniquement les métadonnées. Hors connexion, la consultation de cette liste est en lecture seule ; aucune écriture ni conservation persistante de fichier protégé.
- Les fichiers passent par les routes authentifiées existantes et le cache temporaire du système. Aucune URL Cloudinary n'est remise au client.
- Les composants, thèmes et conventions existants (`PageHeader`, `Card`, skeletons, états vides, FileSystem, Sharing, pull-to-refresh) sont réutilisés.

## Nouveaux composants et workflows connectés

- `MyDocumentsScreen` : recherche, catégories, tri, pagination par 20, skeleton, erreurs, état vide, pull-to-refresh, bannière offline et grille tablette.
- `PersonalDocumentDetailScreen` : métadonnées, lignes financières renvoyées par le serveur, statut, montant, paiement et action sécurisée de consultation/partage.
- `personalDocumentService` : agrégation, normalisation, cache lecture seule, résolution des identifiants NAV et ouverture sécurisée.
- Workflow locatif : liste personnelle → détail → proxy authentifié → partage natif.
- Workflow Accommodation/Hôtel : réservation personnelle → document existant → PDF DOC-EVO authentifié → partage natif.

## Impacts Backend, Web et Mobile

Backend : durcissement du téléchargement locataire en streaming proxy ; extension du lecteur financier au voyageur exact d'une réservation hôtel ; navigation documentaire personnelle ajoutée au registre partagé. Les opérations de génération, édition et livraison restent staff-only.

Web : aucun écran ni comportement fonctionnel modifié. Le Web continue d'utiliser le registre NAV partagé et reste la référence fonctionnelle.

Mobile : ajout du coffre et de son détail dans la stack Profil, entrée « Mes documents », agrégation des sources existantes et remplacement de l'ouverture Cloudinary directe du portail locataire.

## Sécurité et RBAC

- Le portail locataire résout toujours le locataire depuis `req.user.id`.
- Le proxy valide une URL HTTP(S), masque l'URL amont, répond `private, no-store`, `nosniff` et journalise sans divulguer l'URL.
- Un document hôtel n'est lisible par un voyageur que si `HotelReservation.subjectId`, l'établissement et `guestUser` correspondent exactement.
- Le contrôle Accommodation existant demeure inchangé : voyageur/propriétaire concerné ou staff.
- La possession d'un identifiant arbitraire ne suffit pas ; les tests Mongo couvrent le voyageur hôtel autorisé et l'utilisateur tiers refusé.
- Aucun endpoint administratif générique n'est exposé au Mobile.

## Navigation NAV-CORE et notifications

Deux destinations partagées ont été ajoutées : `MY_DOCUMENTS` (`mes-documents`) et `MY_DOCUMENT_DETAILS` (`mes-documents/:id`). Les écrans, deep links et ouvertures depuis notifications passent exclusivement par le SDK et le registre. Les notifications `tenant_document_added` et `tenant_receipt_added` ciblent directement `MY_DOCUMENT_DETAILS`; aucun mapping local spécifique n'a été ajouté.

## Documents couverts

- Gestion locative : bail, quittance, préavis, mise en demeure et états des lieux présents dans le portail personnel.
- Accommodation : factures et données de paiement déjà matérialisées par Financial Core/DOC-EVO.
- Hôtel : facture de réservation et PDF lorsqu'ils existent.

Les pièces génériques `Document`, certaines factures de transaction et les reçus sans artefact personnel ne sont pas inventés ni exposés faute d'API personnelle existante.

## Résultats des tests réellement exécutés

- Backend Unit : **104 suites, 1 212 tests réussis**.
- Backend Mongo : **49 suites, 402 tests réussis**.
- Mobile Jest/validation complète : **succès** ; syntaxe de 154 fichiers, TypeScript, ESLint et Jest réussis (24 suites, 227 tests).
- Web Vitest : **75 fichiers, 503 tests réussis**.
- Playwright desktop/mobile : **34 tests réussis**, durée 9,5 minutes.
- Expo Doctor : **18 contrôles sur 18 réussis**.
- Export Android Expo : **succès**, 1 967 modules, bundle Hermes 6,45 Mo.
- TypeScript Mobile : **succès**.
- ESLint serveur : **0 erreur**, 109 avertissements historiques.
- ESLint client : **0 erreur**, 267 avertissements historiques.
- ESLint mobile : **0 erreur** ; avertissements historiques uniquement.
- Build Next.js : **succès**, 134 pages générées.
- `git diff --check` : **succès**, aucune erreur d'espace ou conflit.

Incidents de lancement sans résultat réutilisé : le premier Backend Unit a rencontré l'interdiction de port Supertest du sandbox, puis a été relancé intégralement hors sandbox ; une option Jest invalide a été passée une première fois à Vitest, puis la commande correcte a été exécutée intégralement ; Expo Doctor a été interrompu dans le sandbox faute de réseau, puis relancé intégralement avec accès réseau. Seuls les résultats frais et complets figurent ci-dessus.

## Risques résiduels et dettes restantes

- Il n'existe pas d'API personnelle unique : le coffre effectue plusieurs lectures et dépend de la disponibilité indépendante de chaque domaine.
- Les propriétaires ne disposent pas encore d'une API personnelle de liste de tous leurs documents locatifs ; en créer une dépassait l'interdiction de nouvel endpoint.
- Les factures génériques et pièces d'identité du centre administratif ne sont pas exposables sûrement avec les APIs actuelles.
- Une facture peut exister avant son artefact PDF ; le Mobile affiche alors l'état serveur mais ne fabrique aucun document.
- Le partage natif utilise un fichier temporaire dans le cache OS ; son cycle de purge dépend du système.

## Fichiers créés pour DOC-MOBILE-1

- `server/docs/DOC_MOBILE_1_AUDIT.md`
- `server/docs/DOC_MOBILE_1_REPORT.md`
- `altimmo-app/src/services/personalDocumentService.js`
- `altimmo-app/src/services/__tests__/personalDocumentService.test.js`
- `altimmo-app/src/screens/Documents/MyDocumentsScreen.jsx`
- `altimmo-app/src/screens/Documents/PersonalDocumentDetailScreen.jsx`

## Fichiers modifiés pour DOC-MOBILE-1

- `server/controllers/rentalDocumentController.js`
- `server/controllers/tenantPortalController.js`
- `server/controllers/financialController.js`
- `server/services/navigationService.js`
- `shared/navigation/registry.json`
- `server/__tests__/navigationRegistry.test.js`
- `server/__tests__/financialAccommodationDocumentsListing.mongo.integration.test.js`
- `altimmo-app/src/services/tenantPortalService.js`
- `altimmo-app/src/services/__tests__/tenantPortalService.test.js`
- `altimmo-app/src/screens/TenantPortal/TenantPortalScreen.jsx`
- `altimmo-app/src/navigation/navigationSdk.js`
- `altimmo-app/src/navigation/__tests__/navigationSdk.test.js`
- `altimmo-app/src/navigation/stacks/ProfilStack.jsx`
- `altimmo-app/src/screens/Profil/ProfilScreen.jsx`

## Confirmation de conformité

- Aucun commit effectué.
- Aucun push effectué.
- Aucune migration destructive.
- Aucune suppression de données.
- Aucun endpoint recréé ou ajouté.
