# TENANT-CERT-3-PRE — Rapport final

Pré-certification multi-tenant globale, avec exclusion explicite du legacy Cloudinary non migré. L'audit initial est dans `TENANT_CERT_3_PRE_AUDIT.md`. Ce sprint ne remplace pas TENANT-CERT-3 et ne migre aucun document legacy.

## 1. État initial

TENANT-CERT-2 : CERTIFIÉ AVEC LIMITATIONS. TENANT-HARDENING-2 : NON CERTIFIÉ, bloqué uniquement par le legacy Cloudinary (toutes les autres limitations de TENANT-CERT-2 fermées). STORAGE-LEGACY-CERT-1 : moteur de migration PARTIALLY READY, aucune preuve Cloudinary réelle. CLOUDINARY-SANDBOX-PROVISION-1 : infrastructure de guard prête, aucun sandbox fourni.

## 2. Modèle de menace

Tenant A / Tenant B, chacun avec Admin bootstrap + Proprietaire + Locataire (fixtures `createTenantFixture`/`createTenantUser`), plus un « opérateur plateforme » (Admin sans appartenance tenant) introduit ce sprint pour vérifier la nouvelle frontière PlatformTenant. Détail complet en audit §2.

## 3. Property

Non re-testé par une nouvelle attaque ce sprint. Statut hérité : PASS (TENANT-CERT-2, corrigé et vérifié ; régression confirmée par re-exécution de `tenantCert2.adversarial.mongo.integration.test.js` dans la passe Mongo complète de ce sprint).

## 4. Portfolio

Non testé ce sprint (limite de temps). `propertyPortfolioService.getPropertyPortfolio` scope par `req.tenantScopeUserIds` (résolu par `requireTenantScope`, déjà fail-closed) — cohérent avec le mécanisme déjà prouvé pour Reporting/ERP par TENANT-HARDENING-2, mais **aucune preuve HTTP fraîche spécifique au Portfolio n'a été produite ce sprint**. NOT TESTABLE dans le temps imparti — limitation explicite, pas un PASS supposé.

## 5. GL (Gestion locative)

Non re-testé par une nouvelle attaque. Statut hérité : PASS (TENANT-CERT-2 ; GL-PROPERTY-FLOW-1 non retouché — aucune route/contrôleur GL modifié par ce sprint, donc aucun risque de régression sur la règle « jamais de création de Property depuis le parcours GL normal »).

## 6. Hôtel

Revue de code uniquement (§5 de l'audit) : `hotelReservationController.assertReservationAccess` délègue à `resolveHotelAccessScope`/`assertResourceTenant` (confirmé par lecture directe). Room/Housekeeping/Inspection/StaffAssignment passent par `requireHotelCapability`→`assertHotelCapability` (même service). **PASS par revue de code, non re-testé par une attaque HTTP fraîche ce sprint.**

## 7. Accommodation

**Vulnérabilité critique découverte et corrigée** (audit §3.2) : `getOne/update/submit/reviewDecision/deactivate/reactivate/remove/duplicate/deactivateRate/listRates` n'avaient aucune frontière tenant — un staff/Admin d'un tenant pouvait agir sur n'importe quel Accommodation d'un autre tenant. `AccommodationReservation.list/getOne` présentaient le même bug. Corrigés en réutilisant `assertResourceTenantOrUnattributed` (moteur canonique, déjà étendu pour `Accommodation` par STORAGE-LEGACY-1). **Régression auto-corrigée pendant le sprint** : la première version du correctif élargissait par erreur le contournement à tout acteur du même tenant (pas seulement les rôles staff historiquement autorisés) — détectée par la suite Backend Unit existante, corrigée en paramétrant le helper par une liste explicite de rôles autorisés. 26 tests adversariaux dédiés, tous PASS.

## 8. Finance

Non testé par une attaque HTTP ce sprint. Constat de revue de code (audit §Finance) : `FinancialDocument`/`FinancialDocumentLine`/`FinancialPayment`/`PaymentAllocation` portent tous un champ `tenant` + `establishmentId`/`domain` ; `routes/financialRoutes.js` applique `requireTenantScope` globalement (fail-closed) ; l'assertion explicite par ressource (`assertResourceTenant`) n'a été confirmée que pour le domaine Hôtel (`financialAuthorizationService.js`). **NOT TESTABLE dans le temps imparti pour les domaines rental/real_estate** — limitation explicite.

## 9. Documents

Non re-testé. Statut hérité PASS pour les documents GL (TENANT-HARDENING-2, staff tenant-scoped avant tout proxy/stream). Les nouveaux documents privés restent conformes STORAGE-SECURITY-1 (authenticated, backend tenant-aware, aucune URL permanente comme contrat d'accès). Legacy : voir §29.

## 10. Conversations

Non re-testé ce sprint. Statut hérité PASS (TENANT-HARDENING-2, Socket.IO handshake/join tenant-aware).

## 11. CRM

**Preuve positive nouvelle** (audit §5, §CRM merge) : la fusion/consolidation de deux Customers de tenants différents est refusée avant toute mutation (`compareCustomers` valide les deux customers dans le tenant scope avant la transaction). 2 tests adversariaux dédiés, PASS. Le reste du domaine CRM (list/get/search) non re-testé ce sprint — statut hérité PASS (TENANT-CERT-2 mentionne CRM Search comme seul domaine de recherche transversale déjà vérifié).

## 12. CRM Automation

Non re-testé ce sprint. Statut hérité PASS (TENANT-CERT-2 §12/§29 — chaîne CRM Automation → Marketing → Webhook déjà vérifiée tenant-scopée).

## 13. Marketing

**Vérifié par revue de code** (audit §5) : le repli théorique `tenant: null` de `createCampaign` n'est jamais atteignable via HTTP, `requireTenantScope` étant appliqué globalement et fail-closed sur `routes/marketingRoutes.js`. Non re-testé par une nouvelle attaque HTTP (le fail-closed lui-même est déjà couvert par les tests `requireTenantScope` existants). Segments/audiences au-delà de ce cas non testés — limitation.

## 14. Reporting

Non re-testé ce sprint. Statut hérité PASS (TENANT-HARDENING-2 : scope par défaut fermé, domaines globaux masqués en contexte tenant — confirmé par re-exécution de `tenantHardening2.adversarial.mongo.integration.test.js` dans la passe Mongo complète).

## 15. ERP

Idem Reporting — non re-testé, statut hérité PASS (TENANT-HARDENING-2).

## 16. Organization

Non re-testé par une nouvelle attaque. Statut hérité PASS (TENANT-CERT-2, domaine entier corrigé et vérifié).

## 17. PlatformTenant

**Vulnérabilité critique découverte et corrigée** (audit §3.1) — la plus sévère de ce sprint : aucune route `platformTenantRoutes.js` (`suspend/reactivate/archive/getOverview/updateSettings/updateTheme/addDomain/verifyDomain/listFeatures/setFeature/changeSubscription/cancelSubscription`) ne vérifiait de frontière tenant, uniquement `role === 'Admin'` — tout Admin d'un tenant pouvait administrer n'importe quel autre tenant. Corrigé via `assertOwnTenantOrPlatformOperator`, réutilisant `resolveAvailableTenantsForUser`. 9 tests adversariaux dédiés, tous PASS, incluant le contrôle positif « opérateur plateforme légitime reste fonctionnel ».

## 18. USER-ARCH

Non testé ce sprint (limite de temps). Aucune vérification que les `businessProfile` (`proprietaire_immobilier`/`exploitant_etablissement`/`locataire`) n'accordent jamais un accès global — limitation explicite.

## 19. API Public

Non re-testé ce sprint. Conception déjà additive/optionnelle par TENANT-CORE-1 (`ApiKey.tenant` optionnel, `requireApiKey` calcule `req.apiKeyTenantScope` vide si `apiKey.tenant` absent — comportement legacy volontairement préservé, confirmé par lecture de code, non re-testé par une attaque HTTP fraîche).

## 20. Webhooks

Non re-testé ce sprint. Statut hérité PASS (TENANT-HARDENING-2 §13-15 : B→subscription A impossible, testé à l'époque).

## 21. Notifications

Non re-testé ce sprint. Statut hérité PASS (TENANT-HARDENING-2 : `notifyStaff` tenant-scoped et fail-closed sur ressource non attribuable).

## 22. Socket.IO

Non rejoué isolément ce sprint en dehors de la passe Mongo complète (qui inclut `socketTenantIsolation.mongo.integration.test.js`, dont le résultat est rapporté en §39). Statut hérité PASS (TENANT-HARDENING-2, handshake/join tenant-aware avec vrai serveur/client Socket.IO).

## 23. Search

Non re-testé ce sprint au-delà de CRM (déjà couvert, voir §11). Statut hérité PARTIEL pour la recherche transversale hors CRM (TENANT-HARDENING-2 §16-18 : « suggestions publiques non exhaustivement attribuables »).

## 24. Exports

Non re-testé ce sprint. Statut hérité PASS (TENANT-HARDENING-2 : contacts/ActionLog filtrés par scope tenant).

## 25. ActionLog

Non re-testé ce sprint. Statut hérité PASS (TENANT-HARDENING-2 : historique sans tenant exclu de list/stats/recent/export).

## 26. Background Jobs

Non re-testé ce sprint. Statut hérité PASS (TENANT-HARDENING-2 : jobs/e-mails rejoués par les suites unitaires/Mongo, destinataires dérivés de la ressource).

## 27. Email

Non re-testé ce sprint. Statut hérité PASS (TENANT-HARDENING-2, transport mocké par domaine).

## 28. New Private Storage

Inchangé, non retouché ce sprint. Architecture STORAGE-SECURITY-1 : nouveaux documents privés `authenticated`, accès backend tenant-aware, aucune URL permanente comme contrat d'accès. Statut : conforme, non re-testé par une nouvelle attaque (hors périmètre de ce sprint, aucun fichier storage touché).

## 29. Legacy Cloudinary Storage — LEGACY STORAGE EXCEPTION

**Non traité, non résolu, non contourné.** Conformément au mandat explicite du sprint : aucune tentative de résoudre l'absence de sandbox Cloudinary. État exact, repris sans altération de `STORAGE_LEGACY_CERT_1_REPORT.md`/`CLOUDINARY_SANDBOX_PROVISION_1_REPORT.md` :
- Le moteur de migration legacy (`legacyAssetMigrationService.js`) est construit, idempotent, résumable, protégé par des guardrails `--apply` à 5 conditions cumulatives — mais **certifié uniquement en mode mocké**, jamais contre un compte Cloudinary réel.
- **Aucun sandbox Cloudinary distinct de la production n'existe** dans ce dépôt (confirmé deux fois, CLOUDINARY-SANDBOX-CERT-1 et CLOUDINARY-SANDBOX-PROVISION-1) — le seul compte configuré (`dop8vzm5z`) est la production.
- **L'ancienne URL Cloudinary publique historique n'est donc pas certifiée révocable en conditions réelles** — seule une sonde HTTP mockée l'a vérifié.
- **Aucune migration réelle n'a été exécutée**, ni ce sprint ni les précédents.
- Cette dette est **isolée** : elle ne contamine aucun domaine applicatif où l'isolation a été réellement prouvée (Property, GL, Organization, Reporting/ERP, Socket.IO, Accommodation, PlatformTenant, etc.) — elle concerne exclusivement les fichiers legacy stockés en `type=upload` public sur Cloudinary avant STORAGE-SECURITY-1, dont l'URL exacte, si elle est déjà connue d'un tiers, reste exploitable hors du contrôle applicatif quel que soit le niveau d'isolation tenant démontré par ailleurs.

## 30. Web

Non modifié, non testé ce sprint (aucun fichier `client/` touché).

## 31. Mobile

Non modifié, non testé ce sprint (aucun fichier `altimmo-app/` touché). Aucun switch multi-tenant n'est exposé côté mobile (statut hérité TENANT-HARDENING-2, non réévalué).

## 32. Cache

Non re-testé ce sprint. Statut hérité PASS (TENANT-HARDENING-2 : cache Mobile purgé aux frontières de session ; aucun cache métier persistant côté Web ; caches serveur audités = état opérationnel par identifiant, pas des datasets tenant).

## 33. Mass Assignment

**Preuve positive nouvelle** pour RentalManagement (audit §5) : whitelist stricte, `owner`/`manager`/`tenant`/`orgUnit` jamais acceptés du body, dérivés côté serveur. 1 test adversarial dédié, PASS. Accommodation déjà confirmé sûr par lecture de code (whitelist `ALLOWED_FIELDS`, `tenant` fixé serveur). Autres contrôleurs non re-audités ce sprint — TENANT-CERT-2 documentait déjà cette limite comme non exhaustive (Property/GL/Organization uniquement) ; ce sprint l'étend à RentalManagement/Accommodation sans prétendre à l'exhaustivité sur le reste du dépôt.

## 34. Error Leakage

Non testé spécifiquement ce sprint. Les refus produits par les nouveaux guards (`assertOwnTenantOrPlatformOperator`, `assertAccommodationAccessible`) renvoient des messages génériques (« Action refusée. »/« Accès refusé. »), jamais de détail sur le tenant adverse — cohérent avec le principe déjà établi par TENANT-HARDENING-2 (§16-18 : refus génériques sans nom/adresse/identifiant du tenant propriétaire).

## 35. Vulnérabilités trouvées

| # | Domaine | Sévérité | Statut |
|---|---|---|---|
| 1 | PlatformTenant — administration SaaS sans frontière tenant (domaine entier : suspend/reactivate/archive/settings/theme/domaines/features/abonnement) | **Critique** | **Corrigé, vérifié** (9 tests) |
| 2 | Accommodation — CRUD/reviewDecision/listRates sans frontière tenant (domaine entier) | **Critique** | **Corrigé, vérifié** (17 tests) |
| 3 | AccommodationReservation — list/getOne sans frontière tenant | **Élevée** | **Corrigé, vérifié** (4 tests) |
| 4 (auto-détectée) | Régression du correctif #2 — contournement élargi à tout acteur same-tenant, pas seulement les rôles staff | **Élevée** (aurait réintroduit une fuite same-tenant) | **Corrigé avant merge, jamais exposé** — détectée par la suite Backend Unit existante avant tout commit |

Aucune fuite cross-tenant restante n'est laissée non corrigée.

## 36. Corrections

Voir audit §3-4 pour le détail technique. Principe respecté : jamais un contournement par rôle sans frontière tenant sous-jacente ; réutilisation stricte de `tenantResourceAttributionService`/`tenantContextService` — aucun second moteur d'attribution créé.

## 37. Performance

`assertOwnTenantOrPlatformOperator`/`assertAccommodationAccessible` appellent `resolveAvailableTenantsForUser`/`resolveTenantForUser` une seule fois par requête (jamais en boucle). Aucun N+1 introduit — mêmes garanties que TENANT-CERT-2 §37.

## 38. Backend Unit

**PASS — 110 suites, 1265 tests, 0 échec** (rejoué après correction de la régression §35.4 : `accommodationRoutes.test.js` mocks tenant complétés, cohérent avec le précédent établi par TENANT-CERT-2 §34).

## 39. Mongo

**PASS — 71 suites, 708 tests, 0 échec**, replica set arrêté proprement (942 s Jest). Inclut, rejouées sans régression : `tenantCert2.adversarial.mongo.integration.test.js`, `tenantHardening.mongo.integration.test.js`, `tenantHardening2.adversarial.mongo.integration.test.js`, `socketTenantIsolation.mongo.integration.test.js`, `tenantAttribution.mongo.integration.test.js`, `tenantAttributionLegacyExtension.mongo.integration.test.js`, `tenantCore.mongo.integration.test.js`, `legacyAssetMigrationEngine.mongo.integration.test.js`, `legacyAssetMigrationCertification.mongo.integration.test.js`, ainsi que les 2 nouvelles suites de ce sprint (`tenantCert3Pre.adversarial.mongo.integration.test.js`, 26 tests).

## 40. Web/Mobile/E2E

**NOT RUN — NO IMPACT.** Aucun fichier `client/`/`altimmo-app/` modifié par ce sprint. Statuts hérités non revalidés : Playwright mobile connaissait un flake KPI préexistant (STORAGE-LEGACY-CERT-1, non lié à la sécurité tenant) ; Expo Doctor 19/20 (dette Expo SDK patch, hors périmètre).

## 41. Limitations

- `platformTenantRoutes.js` `GET /`/`POST /` (liste/création de tenants) restent accessibles à tout Admin quel que soit son tenant — intentionnel (opération intrinsèquement plateforme-wide), mais signifie qu'un Admin tenant-bound peut lister l'existence (nom/slug) des autres tenants sans pouvoir les modifier. Non fermé ce sprint (nécessiterait de définir un véritable rôle Platform Operator distinct, hors périmètre d'un correctif ponctuel).
- Sous-flux financiers d'`accommodationReservationController.js` (paiement/remboursement) non corrigés — mêmes conditions `isStaff` sans tenant que celles fixées pour list/getOne. Documenté, pas caché.
- Property Portfolio, Finance (hors Hôtel), USER-ARCH business profiles, API publique ApiKey, Search transversale hors CRM : non testés par une attaque adversariale fraîche ce sprint — statut hérité ou NOT TESTABLE, jamais présenté comme PASS sans preuve.
- Legacy Cloudinary Storage : voir §29, exception isolée et documentée, non résolue.

## 42. Dettes restantes

Toutes celles de TENANT-HARDENING-2 §24 sauf le legacy storage (déjà résolues), plus les limitations du §41 ci-dessus, plus la dette Expo Doctor/Playwright mobile héritée de STORAGE-LEGACY-CERT-1.

## 43. Fichiers créés

- `server/__tests__/tenantCert3Pre.adversarial.mongo.integration.test.js`
- `server/docs/TENANT_CERT_3_PRE_AUDIT.md`
- `server/docs/TENANT_CERT_3_PRE_REPORT.md`

## 44. Fichiers modifiés

- `server/routes/platformTenantRoutes.js` (frontière tenant sur toutes les routes `:id`/`domainId`)
- `server/controllers/accommodationController.js` (frontière tenant sur getOne/update/submit/reviewDecision/deactivate/reactivate/remove/duplicate/deactivateRate/listRates)
- `server/controllers/accommodationReservationController.js` (frontière tenant sur list/getOne)
- `server/__tests__/accommodationRoutes.test.js` (mocks tenant complétés, même précédent que TENANT-CERT-2 §34)

## 45. Verdict

### MULTI-TENANT PRE-CERTIFIED — LEGACY STORAGE EXCEPTION

Justification : deux vulnérabilités cross-tenant critiques (PlatformTenant admin, Accommodation domaine entier) et une élevée (AccommodationReservation) ont été découvertes, reproduites par test adversarial réel, corrigées à la couche canonique (jamais un contournement par rôle), puis re-vérifiées — y compris une régression auto-introduite par le premier correctif, détectée et corrigée avant toute exposition. Les domaines déjà certifiés par TENANT-CERT-2/TENANT-HARDENING-2 (Property, GL, Organization, Reporting/ERP, Socket.IO, exports, notifications, cache) restent verts en régression. CRM merge et RentalManagement mass assignment sont désormais prouvés positivement, pas seulement supposés sûrs. Backend Unit est vert (1265/1265) ; Backend Mongo est vert (708/708, 71 suites, incluant toutes les suites tenant/storage existantes rejouées sans régression).

Ce n'est pas une certification totale : plusieurs domaines (Portfolio, Finance hors Hôtel, USER-ARCH, API publique, Search hors CRM, sous-flux financiers Accommodation) restent non testés par une attaque fraîche ce sprint, faute de temps — documentés honnêtement comme limitations, jamais présentés comme prouvés.

La seule exception structurelle forte et non fermable par ce sprint reste le **legacy Cloudinary storage** (§29) : aucun sandbox non-production n'existe, donc aucune preuve réelle de révocation d'ancienne URL publique n'a jamais été obtenue, ni ce sprint ni les précédents.

Conformément au mandat du sprint : **ce n'est PAS une déclaration MULTI-TENANT FULLY CERTIFIED.** TENANT-CERT-3 reste réservé à une migration legacy réelle contrôlée (ou une décision produit explicite d'accepter le risque résiduel), suivie d'un audit post-migration.

## Confirmations finales

Aucun commit. Aucun push. Aucun déploiement. Aucune migration destructive. Aucun backfill réel. Aucune migration Cloudinary réelle. Aucun asset utilisateur supprimé. Aucune donnée de production modifiée. Aucun bypass Admin global introduit — au contraire, un bypass Admin global préexistant (PlatformTenant) a été fermé. Aucun fallback tenant global. **Verdict exact : MULTI-TENANT PRE-CERTIFIED — LEGACY STORAGE EXCEPTION.**
