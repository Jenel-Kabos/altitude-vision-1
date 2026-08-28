# RELEASE-CONSOLIDATION-SECURITY-1 — Plan de commits proposé

Construit à partir du diff réel (pas d'un gabarit générique). Objectif : des commits atomiques, compréhensibles, qui n'entremêlent jamais la sécurité tenant, le refactor d'architecture (ARCH2) et les hotfixs métier indépendants.

**Ce plan est une proposition. Aucun `git add`/`git commit` n'a été exécuté — le staging reste entièrement soumis à validation humaine (§42-43 du mandat).**

| # | Message proposé | Objet | Fichiers (représentatifs) | Tests inclus | Dépendance |
|---|---|---|---|---|---|
| 1 | `security(p0-wave): close cross-tenant messaging, payment, lease-lifecycle and legacy-property authority gaps` | SECURITY-CLOSURE-P0-WAVE-1 (5 findings) | `messageController.js`, `paiementController.js`, `paiementRoutes.js`, `rentalLeaseLifecycleController.js`, `rentalLeaseLifecycleRoutes.js`, `adminController.js`, `adminRoutes.js` | `securityClosureP0Wave*.mongo.integration.test.js` (4 fichiers) | Aucune |
| 2 | `security(p1-wave): close 10 remaining cross-tenant resource-authority gaps` | SECURITY-CLOSURE-P1-WAVE-1 (10 findings) | `contratController.js`+routes, `locataireController.js`/`proprietaireController.js`+routes, `visiteController.js`+routes, `litigeController.js`/`signalementController.js`+routes, `realEstateApplicationController.js`+routes, `accommodationController.js`, `salePropertyController.js`/`rentalPropertyController.js`, `propertyAssetController.js`, `hotelStaffAssignmentController.js`, `transactionController.js`/`paiementTransactionController.js`+routes | `securityClosureP1Wave*.mongo.integration.test.js` (10 fichiers) + les 5 fichiers de test unitaires corrigés pour régression (`rentalDossiersRoutes`, `visiteRoutes`, `salePropertyRoutes`, `rentalPropertyRoutes`, `transactionFinalizationGuard`) | Commit 1 (même famille de correctifs, cohérence de lecture) |
| 3 | `security(final-closure): fix contract-create and reservation cancel/read cross-tenant bypass (FCA1-01, FCA1-02)` | SECURITY-FINAL-CLOSURE-BLOCKERS-HOTFIX-1 | `contratController.js` (fonction `assertPropertyTenantAccess`), `realEstateApplicationController.js` (application du helper existant à `getReservation`/`cancelReservation`), `realEstateApplicationRoutes.js` | `contratCreateTenantAuthority.mongo.integration.test.js`, `realEstateReservationTenantAuthority.mongo.integration.test.js` | Commits 1-2 (mêmes fichiers touchés une seconde fois) |
| 4 | `refactor(arch2): extract business logic from controllers into dedicated services` | Refactor architectural indépendant (ARCH2) | ~25 contrôleurs/routes (require-swap mécanique), 11 nouveaux fichiers `services/*`, `scripts/check-architecture.js`, `architecture/baseline.json`+`checker.js`, `server/package.json` (script `architecture:check`), `scripts/local-ci.js` | Tests unitaires ARCH2 associés (`architectureBoundaries.test.js`, `dashboardKpiQueryService*.test.js`, `messageSerializer.test.js`, `notificationObservationPort.test.js`, `documentStreamingService.test.js`, `unaffiliatedUserScopeService.test.js`, `propertyPublicationInputBoundary.test.js`, `mobilePropertyPublicationInputBoundary.test.js`, `rentalPaymentScheduleBoundary.test.js`, `rentalReportQueryBoundary.mongo.integration.test.js`, `devisRouteApplicationBoundary*.test.js`) | Aucune (orthogonal à la sécurité) |
| 5a | `fix(zoho): add IMAP seen/checkpoint cursor independent of \Seen flag` | Hotfix métier indépendant | `services/zohoImapService.js`, `models/ImapSyncCheckpoint.js` | `zohoImapService.test.js` | Aucune |
| 5b | `fix(accommodation): auto-submit newly created accommodation for visibility` | Hotfix métier indépendant | `services/accommodationService.js` | `accommodationCreatedVisibility.mongo.integration.test.js` | Aucune |
| 5c | `feat(dashboard): compact search/filter toolbar for accommodations management` | UX (non sécurité) | `client/lib/pages/dashboard/ManageAccommodationsPage.jsx` | `ManageAccommodationsPage.test.jsx` (tests UX ajoutés) | Aucune |
| 5d | `fix(publicites): fail fast when Cloudinary env vars are missing` | Hotfix métier indépendant | `client/lib/services/publiciteService.js` | `publiciteService.test.js` | Aucune |
| 5e | `fix(mobile): refetch recommended properties on pull-to-refresh` | Hotfix métier indépendant | `altimmo-app/src/screens/Annonces/ListeAnnoncesScreen.jsx` | `ListeAnnoncesScreenRecommended.test.jsx` | Aucune |
| 5f | `feat(messaging): secure attachment preview/download in conversations and internal mail` | Feature sécurité messagerie (déjà certifiée dans les hotfixs INBOX_SECURITY1/2, HOTFIX_CONVERSATION_ACTIVE_ATTACHMENT1) | `client/lib/components/messaging/AttachmentStrip.jsx`, `SafeAttachmentPreview.jsx`, `SafeHtmlEmailViewer.jsx`, `client/lib/utils/attachmentPresentation.js`/`attachmentSecurity.js`/`sanitizeSandboxedHtml.js`, `client/lib/services/messageService.js` | `AttachmentStripSecurity.test.jsx`, `attachmentSecurity.test.js`, `attachmentPresentation.test.js` | Aucune |
| 6 | `chore: ignore local Android build artifacts (apk/aab)` | Hygiène release (ce mandat) | `.gitignore` | Aucun | Aucune — à committer en 1er, avant tout `git add` massif, pour éviter d'inclure accidentellement l'APK |
| 7 | `docs: archive full security-campaign and architecture-refactor audit trail` | Documentation | `server/docs/*.md` (556 fichiers) | Aucun | **Décision humaine requise (voir ci-dessous)** |

## Décision requise avant le commit 7 (§46 du mandat)

Le volume documentaire (556 fichiers `.md`) est réel et légitime — chaque mandat de cette campagne a produit sa propre trace d'audit exigée par le processus. Mais le mandat demande explicitement de ne pas décider seul si ce volume doit être versionné dans Git :

- **Option A — tout committer dans `server/docs/`** : préserve l'historique complet et vérifiable de toute la campagne directement dans le dépôt (traçabilité maximale, mais alourdit chaque `git clone`/`git log` de façon permanente).
- **Option B — committer seulement les rapports finaux** (`*_REPORT.md`, `*_DECISION.md`, `*_GATE_MATRIX.md` de chaque mandat, soit ~40-50 fichiers) et déplacer le reste vers une archive hors-dépôt (wiki, dossier partagé, export zip).
- **Option C — ne rien committer de `server/docs/`** et conserver ces fichiers uniquement en local/archive externe.

**Aucune option n'a été choisie par ce mandat — décision humaine explicite requise avant d'exécuter le commit 7.**

## Ordre d'application recommandé

Commits 6 → 1 → 2 → 3 → 4 → 5a-5f (indépendants entre eux, ordre libre) → 7 (après décision humaine). Chaque commit de 1 à 5f, pris isolément, laisse le build/les tests dans un état vert (vérifié : aucune inter-dépendance cassante entre les 5 groupes).
