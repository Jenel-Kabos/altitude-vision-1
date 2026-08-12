# TENANT-HARDENING-2 — Rapport final

Date de certification : 11 août 2026. L'audit initial est consigné dans `TENANT_HARDENING_2_AUDIT.md`. Les contrôles ont été réalisés sur le worktree courant, sans réutiliser un résultat antérieur.

## 1. Limitations TENANT-CERT-2 reprises

Les limites reprises étaient Socket.IO, stockage Cloudinary et URLs directes, exports, scopes par défaut Reporting/ERP, liste et KPI Gestion locative, notifications/jobs, caches et preuves transverses. L'audit a démontré des fuites réelles dans le staff inbox Socket.IO, Reporting/ERP sans paramètre, export contacts, liste/KPI GL, documents GL ouverts au staff d'un autre tenant, notifications staff globales et cache Mobile conservé entre deux sessions.

## 2. Socket.IO

Le handshake résout désormais un `platformTenantId` explicite avec le service canonique de contexte tenant. Un utilisateur multi-tenant sans contexte est refusé. `conversation:join` compare le tenant de la conversation au tenant actif avant d'autoriser participant ou staff. Le harness Socket.IO réel couvre A→A, A→B refusé, absence d'événement B et utilisateur AB dans les deux contextes. Un changement de tenant nécessite une nouvelle connexion et ne conserve donc aucune ancienne room.

## 3–4. Cloudinary et documents

Les assets d'annonces restent volontairement publics. Les routes backend de documents GL contrôlent maintenant le tenant du contrat avant tout proxy/stream pour le staff, avec contrôle positif B→B et attaque A→B.

Limitation critique : les documents historiquement téléversés via `secure_url` sont des ressources Cloudinary publiques permanentes. La preuve reproduit qu'un détenteur de l'URL exacte contourne entièrement le backend. La fermeture exige stockage privé/authenticated, remise d'URLs signées courtes et traitement des artefacts existants ; elle ne peut être accomplie honnêtement sans migration/backfill et stratégie de compatibilité. Les pièces jointes de conversation partageant ce mode de stockage sont concernées.

## 5. Exports

Les routes d'export exigent un tenant actif. L'export contacts filtre `User`, `Proprietaire` et `Locataire` par les utilisateurs du scope tenant. `ContactMessage` et `QuoteRequest`, non attribuables de façon fiable, sont exclus en contexte tenant plutôt que fusionnés globalement. Les exports Reporting héritent du scope courant obligatoire. ActionLog est testé par contenu et exclut logs B et entrées historiques sans tenant.

## 6–7. Reporting et ERP

L'absence de `tenantId` n'ouvre plus le dataset global : `requireTenantScope` impose le tenant courant. Un `tenantId` hostile est ignoré au profit du contexte validé ; un `orgUnitId` n'est accepté que sous la racine courante ; AB sans contexte échoue fermé. Les agrégations Immobilier, Location, Accommodation, Hôtel, CRM, Finance et Marketing reçoivent les IDs de scope/tenant. Les sources historiquement globales ou non attribuables (cockpit global, communication, événements, tendances marché, KPI utilisateurs globaux) sont masquées comme indisponibles en vue tenant.

## 8. Platform Admin

Aucune capacité Platform Admin transverse explicitement modélisée n'existe. `role === 'Admin'` ne donne donc jamais un accès global. Aucun bypass global n'a été ajouté.

## 9. Deep links

NAV-CORE reste uniquement un registre de destinations. Document, Conversation, Hotel, Property et CRM restent autorisés par leurs endpoints ; connaître un `entityId` adverse ne confère aucun accès. Aucun mapping d'autorisation n'a été ajouté à la navigation.

## 10–12. Caches Mobile, Web et serveur

Le cache mémoire Mobile est purgé lors d'une session invalide, login email, login Google et logout ; le test AuthContext contrôle la purge. L'application ne propose pas de switch tenant. Le Web n'a pas de cache métier tenant persistant ni de switch tenant. Les `Map` serveur auditées sont des états socket/opérationnels indexés par identifiant, pas des caches de datasets tenant.

## 13–15. Jobs, e-mails et webhooks

`notifyStaff` ne diffuse plus à tout le staff : il dérive le tenant d'un tenant explicite ou de l'entité canonique (Property, RentalManagement, Contrat, Hotel, réservations), résout une seule fois le scope puis cible uniquement les membres staff actifs. Une ressource non attribuable échoue fermée. Les fixtures historiques de notification ont été rendues tenant-aware, sans fallback global. Les jobs et e-mails existants ont été rejoués par les suites unitaires/Mongo ; les destinataires restent dérivés de la ressource. Le second pass webhook vérifie B→subscription A impossible, abonnement désactivé et signature HMAC.

## 16–18. ActionLog, recherche et erreurs

ActionLog tenant-scoped n'expose ni B ni les entrées sans tenant dans list/stats/recent/export. La recherche CRM et les recherches de domaines protégés héritent des scopes existants ; aucune fuite de marqueur B n'a été démontrée, mais l'exhaustivité de toutes les suggestions publiques reste partielle. Les refus utilisent des messages génériques (`ressource inaccessible`, `aucun tenant actif`) sans nom, adresse ou identifiant du tenant propriétaire.

## 19–20. Vulnérabilités et corrections

Corrections appliquées : tenant au handshake/join Socket.IO ; tenant courant obligatoire Reporting/ERP/exports/GL ; agrégations et exports filtrés ; contrôle tenant des documents GL ; notification staff tenant-scoped et fail-closed ; purge du cache Mobile ; adaptation additive des fixtures historiques. Aucune règle métier, endpoint ou moteur tenant n'a été recréé.

## 21. Tests adversariaux

`tenantHardening2.adversarial.mongo.integration.test.js` couvre Reporting/ERP, utilisateur AB sans contexte, liste GL, export contacts/ActionLog, webhook et notification staff. `socketTenantIsolation.mongo.integration.test.js` utilise un vrai serveur et un vrai client Socket.IO. Les tests documents couvrent positif B→B, refus A→B et démonstration structurelle de l'URL CDN publique.

## 22. Performances

Le tenant est résolu une fois par requête ou handshake. Les agrégations filtrent en base. Les exports calculent une seule fois le set des utilisateurs du tenant. `notifyStaff` résout une entité puis un scope, sans résolution par destinataire. Aucun N+1 ou cache tenant supplémentaire n'a été introduit.

## 23. Gates réellement exécutées

| Gate | Résultat frais |
|---|---|
| Backend Unit complet | PASS — 105 suites, 1 218 tests lors de la première passe ; régressions unitaires corrigées puis relance complète exit 0 |
| Backend Mongo complet | PASS — 67 suites, 630 tests, 0 échec ; replica set arrêté proprement (897,636 s Jest, 902,987 s runner) |
| Suites tenant / adversariales | PASS sur les suites ciblées et dans la passe Mongo complète |
| Web Vitest complet | PASS — 76 fichiers, 513 tests |
| Mobile Jest complet | PASS — 24 suites, 227 tests |
| TypeScript Mobile | PASS |
| Expo Doctor | FAIL — 19/20 checks ; neuf dépendances Expo SDK 57 en retard d'un patch |
| ESLint serveur | PASS — 0 erreur, 123 warnings historiques |
| ESLint client | PASS — 0 erreur, 268 warnings historiques |
| ESLint mobile | PASS — 0 erreur, 83 warnings historiques |
| Build Next.js | PASS — 142 pages générées |
| Export Android | PASS — bundle Android 2 240 modules, export `dist` |
| Playwright desktop + mobile complet | FAIL — 32/34 ; deux timeouts/UI non reproductibles ensuite |
| Playwright ciblé des deux échecs | PASS — 2/2 (desktop réservation, mobile onboarding GL) |
| git diff --check | PASS — aucune erreur d'espace ou marqueur de conflit |

## 24. Matrice finale et limitations restantes

| Frontière | Testée | Résultat | Limitation restante |
|---|---:|---|---|
| Socket.IO | oui | PASS | aucune fuite démontrée |
| Cloudinary public assets | oui | PASS | public par design |
| Cloudinary private docs | oui | FAIL | URL publique exacte exploitable hors backend |
| Documents backend | oui | PASS | confidentialité dépend du stockage sous-jacent |
| Exports | oui | PASS | sources sans attribution exclues |
| Reporting default | oui | PASS | domaines globaux masqués |
| ERP default | oui | PASS | cockpit global masqué |
| Background jobs | oui | PASS | ressource non attribuable : notification staff omise |
| Email | oui | PASS | transport mocké dans les tests de domaine |
| Webhooks | oui | PASS | aucune |
| Mobile cache | oui | PASS | pas de switch tenant natif |
| Web cache | oui | N/A | aucun cache métier persistant/switch tenant |
| Server cache | oui | N/A | aucun cache tenant de dataset |
| ActionLog | oui | PASS | historique sans tenant exclu |
| Search | oui | PARTIEL | suggestions publiques non exhaustivement attribuables |
| Deep links | oui | PASS | le backend reste l'autorité |

Dettes : migrer les documents privés Cloudinary vers un delivery authentifié ; aligner les neuf patchs Expo SDK 57 ; stabiliser les deux scénarios E2E sous charge ; modéliser une capacité Platform Admin si un reporting global devient nécessaire ; attribuer les sources historiques actuellement masquées.

## 25. Fichiers créés

- `server/__tests__/socketTenantIsolation.mongo.integration.test.js`
- `server/__tests__/tenantHardening2.adversarial.mongo.integration.test.js`
- `server/docs/TENANT_HARDENING_2_AUDIT.md`
- `server/docs/TENANT_HARDENING_2_REPORT.md`

## 26. Fichiers modifiés

- Mobile : `altimmo-app/src/context/AuthContext.jsx`, `altimmo-app/src/context/__tests__/AuthContext.test.jsx`.
- Routes : `server/routes/erpRoutes.js`, `exportRoutes.js`, `rentalManagementRoutes.js`, `reportingRoutes.js`.
- Contrôleurs : `dashboardAnalyticsController.js`, `erpController.js`, `exportController.js`, `rentalDocumentController.js`, `rentalManagementController.js`, `reportingController.js`.
- Services : `server/socket.js`, `notificationService.js`, `erp/erpService.js`, `reporting/reportingService.js` et les domaines Reporting `accommodationReport.js`, `crmReport.js`, `financeReport.js`, `immobilierReport.js`, `locationReport.js`, `marketingReport.js`.
- Tests : `erpCore.mongo.integration.test.js`, `propertyAssetRoutes.mongo.integration.test.js`, `propertyRoutes.test.js`, `rentalAssetOnboardingRoutes.test.js`, `rentalDocumentDownload.mongo.integration.test.js`, `rentalLeaseLifecycle.mongo.integration.test.js`, `rentalMaintenanceRoutes.test.js`, `rentalManagementActivation.test.js`, `rentalManagementBiensInscritsStat.mongo.integration.test.js`, `rentalManagementReconciliation.mongo.integration.test.js`, `reporting.mongo.integration.test.js`, `socketAuthorization.test.js`, `tenantCert2.adversarial.mongo.integration.test.js`.

## 27. Verdict

### MULTI-TENANT NON CERTIFIÉ

Le verdict est imposé par la règle du sprint : une URL privée reproductiblement accessible hors tenant subsiste via le stockage Cloudinary public. Expo Doctor reste également rouge. Les corrections ferment les fuites applicatives démontrées sur Socket.IO, exports, agrégations, GL, notifications et caches, mais elles ne permettent pas de prétendre à une isolation forte des fichiers privés existants.

Confirmations : aucun commit, aucun push, aucun déploiement, aucune migration destructive, aucun backfill réel, aucune suppression de données réelles et aucune écriture production.
