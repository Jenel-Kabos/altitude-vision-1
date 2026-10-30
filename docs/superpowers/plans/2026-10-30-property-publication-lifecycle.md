# Property Publication Lifecycle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Compléter le cycle de publication immobilier 03A avec retrait propriétaire immédiat, réactivation contrôlée et suspension Altimmo.

**Architecture:** `Property` porte un état additif et son historique; `CommercialPublicationRevision` reste l'unique version commerciale. Un service transactionnel applique les transitions et fournit le prédicat unique de commercialisabilité utilisé par les lectures publiques et les nouvelles démarches.

**Tech Stack:** Node.js, Express, Mongoose, Jest/Supertest, React/Next.js, Vitest.

**Spec:** `docs/superpowers/specs/2026-10-30-property-publication-lifecycle-design.md`

## Global Constraints

- Base exacte : `232d373938495d45866534b64177f6ab8fb6bd98`.
- Préserver JWT, Platform/Tenant, Finance/Location et 03A.
- Aucun paiement, commission, facture, reversement ou suppression de dossier.
- `platform.commercial.manage` reste la seule autorité de modération globale.
- Aucune migration, variable d'environnement, publication GitHub ou production.

## Review Focus

- Retrait concurrent à une approbation : le retrait gagne et l'approbation devient obsolète.
- Révision ancienne approuvée après une plus récente : aucune publication.
- Réactivation répétée : une seule révision pendante, jamais de publication automatique.
- Suspension administrative : aucune action propriétaire ne la lève.
- Données legacy sans `publicationLifecycleState` : visibilité antérieure préservée.

---

### Task 1: Modèle et service de cycle transactionnel

**Files:**
- Modify: `server/models/Property.js`
- Modify: `server/models/CommercialPublicationRevision.js`
- Create: `server/services/propertyPublicationLifecycleService.js`
- Test: `server/__tests__/propertyPublicationLifecycle03A1.mongo.integration.test.js`

**Interfaces:**
- Produces: `PUBLICATION_STATES`, `derivePublicationState(property)`, `isPropertyCommerciallyAvailable(property)`, `ownerWithdrawProperty(input)`, `ownerRequestReactivation(input)`, `adminSuspendProperty(input)`, `adminLiftSuspension(input)`.

- [ ] Écrire les tests RED des transitions, de l'historique, du fallback legacy et des six courses concurrentes.
- [ ] Exécuter la suite et confirmer les échecs fonctionnels attendus.
- [ ] Ajouter les champs additifs, le type de révision et le service transactionnel minimal.
- [ ] Exécuter la suite GREEN.
- [ ] Commit `feat(real-estate): add controlled property publication lifecycle`.

### Task 2: Routes propriétaire et modération

**Files:**
- Modify: `server/controllers/propertyController.js`
- Modify: `server/routes/propertyRoutes.js`
- Modify: `server/routes/adminPropertyRoutes.js`
- Modify: `server/routes/adminRoutes.js`
- Test: `server/__tests__/propertyPublicationLifecycleRoutes03A1.mongo.integration.test.js`

**Interfaces:**
- Consumes: service Task 1.
- Produces: `PATCH /api/properties/:id/lifecycle`, `POST /api/properties/:id/reactivation`, `POST /api/properties/:id/suspension-review`, actions admin `suspend` et `lift-suspension`.

- [ ] Écrire les tests RED d'autorité propriétaire, propriété étrangère, capacité plateforme et champs administratifs.
- [ ] Vérifier RED.
- [ ] Brancher contrôleurs/routes et notifications existantes, sans suppression.
- [ ] Vérifier GREEN.
- [ ] Commit `feat(real-estate): expose owner and Altimmo lifecycle actions`.

### Task 3: Modification, décision et exposition publique

**Files:**
- Modify: `server/services/commercialPublicationService.js`
- Modify: `server/controllers/propertyController.js`
- Modify: `server/services/publicApi/publicPropertyService.js`
- Modify: `server/services/realEstateApplicationService.js`
- Modify: `server/controllers/visiteController.js`
- Modify: `server/__tests__/propertyCommercialPublication.mongo.integration.test.js`
- Test: `server/__tests__/propertyCommercialAvailability03A1.mongo.integration.test.js`

**Interfaces:**
- Consumes: état et prédicat Task 1.
- Produces: retrait immédiat après modification, approbation conditionnelle de la seule révision courante, rejet sans fallback public, blocage des nouvelles démarches.

- [ ] Adapter d'abord les tests : modification publiée non publique, rejet non publié, réapprobation courante seulement, lectures directes/listes/refus visite et candidature.
- [ ] Vérifier RED.
- [ ] Implémenter les raccordements minimaux et les filtres cohérents.
- [ ] Vérifier GREEN et non-régression des dossiers existants.
- [ ] Commit `fix(real-estate): require fresh approval for every republication`.

### Task 4: Interface propriétaire et modération

**Files:**
- Modify: `client/lib/services/propertyService.js`
- Modify: `client/lib/pages/dashboard/OwnerPropertyManagement.jsx`
- Modify: `client/lib/pages/dashboard/PropertyModerationPage.jsx` ou `PropertyRegistry.jsx` selon le point de montage actif.
- Test: `client/lib/__tests__/PropertyPublicationLifecycle03A1.test.jsx`

**Interfaces:**
- Consumes: endpoints Task 2.
- Produces: actions Loué/Vendu/Indisponible/Retirer/Réactiver et Suspendre/Lever.

- [ ] Écrire les tests UI RED des actions visibles et des libellés d'état.
- [ ] Vérifier RED.
- [ ] Ajouter les appels de service et contrôles UI minimaux.
- [ ] Vérifier GREEN et ESLint ciblé.
- [ ] Commit `feat(real-estate): add listing lifecycle controls to dashboards`.

### Task 5: Certification et rapport

**Files:**
- Create: `/Users/apple/Documents/GitHub/altimmo-certification-evidence/GIT-INTEGRATION-03A-1/GIT_INTEGRATION_03A1_RESULT.md`

- [ ] Exécuter les suites ciblées groupes A-E, JWT/tenant, architecture, build client et scans d'exclusion.
- [ ] Vérifier diff, secrets, absence de PAY/KYC/IA/CRM et conservation des historiques.
- [ ] Effectuer la revue complète du diff et corriger les constats importants en TDD.
- [ ] Vérifier l'intégrité des dépôts protégés et rédiger le verdict avec les 13 réponses.
