# TENANT-CERT-2 — Audit adversarial de l'isolation multi-tenant

Sprint de certification finale. Ce document couvre l'audit statique (Phase 1
du sprint) : cartographie réelle de ce qui protège quoi, AVANT toute
correction. Le verdict et les preuves d'attaque/correction sont dans
`TENANT_CERT_2_REPORT.md`.

## 1. Méthode d'audit

Recherche systématique des consommateurs réels de la frontière tenant
(`req.platformTenant`, `req.tenantScopeUserIds`, `requireTenantScope`,
`assertResourceTenant`) dans `routes/`, `controllers/`, `services/` — puis
vérification, pour chaque route mutante/lecture-sensible identifiée, que le
contrôleur qui la sert **consomme réellement** cette frontière et pas
seulement qu'un middleware d'authentification/rôle est présent.

Constat méthodologique central : la présence de `requireTenantScope` sur un
routeur **ne garantit rien par elle-même** — elle prouve seulement qu'un
tenant a été résolu pour l'acteur. Rien n'empêche un contrôleur de charger
et modifier une ressource d'un AUTRE tenant si ce contrôleur ne consulte
jamais `req.platformTenant`/`req.tenantScopeUserIds`. C'est exactement le
type de faux positif que ce sprint devait détecter.

## 2. Couche canonique déjà existante (héritée de TENANT-CORE-1 /
   TENANT-CONTEXT-1 / TENANT-ATTRIBUTION-1 / TENANT-HARDENING-1)

- `services/platformTenant/tenantContextService.js` — résolution
  d'identité → tenant : `resolveTenantForUser`, `resolveEffectiveTenantContext`,
  `resolveAvailableTenantsForUser`, `resolveLegacyTenantForUser`,
  `resolveTenantScope`, `resolveRootOrgUnitId`. Fail-closed vérifié par
  `tenantHardening.mongo.integration.test.js` : multi-appartenance non
  résolue implicitement, tenant suspendu/archivé exclu, appartenance
  suspendue/révoquée exclue, legacy fallback borné (créateur du seul
  PlatformTenant existant, zéro membership, antériorité prouvée).
- `services/platformTenant/tenantResourceAttributionService.js` —
  résolution ressource → tenant (`resolveResourceTenant`/
  `assertResourceTenant`), supportant nativement Property, Hotel,
  Accommodation, HotelReservation, AccommodationReservation, Room,
  HotelStaffAssignment, RentalManagement, Contrat, Paiement, Conversation,
  Message, Document, FinancialDocument/Payment/Allocation. Fail-closed :
  `ambiguous`/`unresolved` → refus (404, jamais un accès élargi).
- `middleware/tenantContext.js` — `attachTenantContext` (non bloquant) et
  `requireTenantScope` (bloquant, lit `X-Platform-Tenant-Id`, résout via
  `resolveEffectiveTenantContext`, attache `req.platformTenant`/
  `req.tenantScopeUserIds`).
- `services/platformTenant/tenantQuotaService.js` — quotas par tenant.
- Modèles déjà tenant-scopés en base (champ `tenant` direct) : `CrmCustomer`,
  `CrmOpportunity`, `CrmActivity`, `CrmAutomationRule`, `CrmAutomationRun`,
  `MarketingCampaign`, `MarketingTemplate`, `Hotel`, `Accommodation`,
  `Conversation`, `Message`, `Document`, `FinancialDocument`, `ActionLog`,
  `WebhookSubscription`, `ApiKey` (optionnel).
- Modèles **jamais** tagués `tenant` directement (scoping uniquement dérivé
  via `owner`/`manager`/relation) : `Property`, `RentalManagement`,
  `Contrat`, `Paiement`.

## 3. Cartographie réelle — qui consomme la frontière tenant (avant correction)

| Routeur | `requireTenantScope` monté ? | Contrôleur consomme réellement `req.platformTenant`/`assertResourceTenant` ? | Verdict avant correction |
|---|---|---|---|
| `hotelRoutes.js` | Oui (global) | Oui — via `hotelAccessScopeService.assertOperationalHotelAccess`/`resolveHotelAccessScope`, qui appelle `assertResourceTenant` | **Déjà correct** |
| `financialRoutes.js` | Oui | Oui — `financialAuthorizationService.assertFinancialScope` | **Déjà correct** |
| `documentRoutes.js` | Oui | Oui — `documentController.js` | **Déjà correct** |
| `conversationRoutes.js` / `messageRoutes.js` | Oui | Oui | **Déjà correct** |
| `crmRoutes.js` / `crmAutomationRoutes.js` | Oui | Oui | **Déjà correct** |
| `marketingRoutes.js` | Oui | Oui | **Déjà correct** |
| `actionLogRoutes.js` | — (filtre `req.platformTenant._id` direct) | Oui | **Déjà correct** |
| `propertyRoutes.js` | Seulement sur `/portfolio` | **NON** — `updateProperty`/`deleteProperty`/`updatePropertyStatus`/`adminDeleteProperty`/`setRecommande`/`getProperty` (vue privilégiée) reposaient uniquement sur `req.user.role === 'Admin'` | **FUITE CONFIRMÉE** |
| `rentalManagementRoutes.js` | **Absent** | **NON** — `getOne`/`update`/`deactivate`/`publish`/`mark-*`/`maintenance`/`notice`/`validate-exit`/`resolve` sans aucune vérification | **FUITE CONFIRMÉE** |
| `contratRoutes.js` | **Absent** | **NON** | **FUITE CONFIRMÉE** |
| `paiementRoutes.js` | **Absent** | **NON** | **FUITE CONFIRMÉE** |
| `organizationRoutes.js` | **Absent** | **NON** — `getTree`/`archiveOrgUnit`/`grantMembership`/`suspendMembership`/`revokeMembership`/`listUnits`/`getUserMemberships` acceptaient n'importe quel identifiant | **FUITE CONFIRMÉE** |
| `reportingRoutes.js` / `erpRoutes.js` | — (Admin only) | **NON** — `orgUnitId`/`tenantId` transmis tels quels depuis la requête, jamais validés contre les tenants réels de l'acteur | **FUITE CONFIRMÉE (§29 tenant explicite hostile)** |
| `publicApi/v1` (properties/hotels/accommodations) | — (clé API) | Oui — `ApiKey.tenant` + scope post-filtre (TENANT-HARDENING-1 : clé sans tenant fermée) | **Déjà correct** |
| `webhookDispatchService.js` | — | `WebhookSubscription.tenant` présent, événement filtré par `events[]` déjà whitelisté | **Déjà correct** (voir limites §6 du rapport) |

## 4. Pattern de bypass recherché explicitement (§8/§42 du brief)

Recherche de `role === 'Admin'` comme unique porte d'accès (jamais couplé à
une preuve tenant) :

- `propertyController.js` (updateProperty/deleteProperty/getProperty/
  updatePropertyStatus/adminDeleteProperty/setRecommande) : **confirmé,
  corrigé** (voir rapport §4).
- `hotelAccessScopeService.resolveOperationalHotelAccess`/
  `assertOperationalHotelAccess` : le `||` avec `actor.role === 'Admin'`
  apparaît **après** un appel à `assertResourceTenant` qui a déjà validé
  l'appartenance tenant — ce n'est PAS un bypass global, c'est
  `tenant boundary AND capacité`, conforme au principe §42. Confirmé par
  test positif+négatif dans `tenantCert2.adversarial...test.js`.
- `financialAuthorizationService.assertFinancialScope` : même construction
  (`if (!user.platformTenant) {...} else { assertResourceTenant(...); if
  (Admin || manager) return; }`) — conforme.
- `commentController.js`, `litigeController.js`,
  `accommodationReservationController.js` (remboursement),
  `altimmoSearchController.js`, `hotelController.js` (assignation
  `owner`/`req.body.owner`) : présence de `role === 'Admin'` relevée à
  l'audit mais **non exploitée pour une attaque cross-tenant reproductible**
  dans le temps imparti — signalée en dette (voir rapport §29 « Dettes »),
  jamais déclarée sûre sans preuve.
- `userController.js:282` (`target.role === 'Admin'`) : protège un compte
  Admin contre une rétrogradation, sémantique différente (pas un bypass
  tenant) — non retenue comme vulnérabilité.

## 5. Contrainte de conception découverte : données « non attribuables »

`Contrat`/`Paiement`/`RentalManagement` peuvent légitimement exister sans
aucune chaîne d'attribution tenant traçable (ex. `Contrat.bien` absent,
adresse en texte libre — schéma antérieur à `PlatformTenant`). Un test
« deny-by-default » naïf casse ces cas réels (confirmé par régression sur
6 suites Mongo existantes). Solution retenue : `assertResourceTenantOrUnattributed`
— une ressource dont l'attribution reste `unresolved` (aucun tenant nulle
part dans sa chaîne) n'a aucune frontière à faire respecter et reste
accessible (comportement inchangé) ; dès qu'une attribution `resolved`
existe, la frontière stricte s'applique normalement. `ambiguous` reste
toujours refusé. Voir rapport §30 pour la discussion du risque résiduel.

## 6. Domaines audités mais non ré-attaqués avec de nouveaux tests ce sprint

Déjà couverts par les suites adversariales antérieures (relancées avec
succès, voir rapport §9) : Hôtel, Finance, Documents, Conversations, CRM,
CRM Automation, Marketing, API publique, Quotas. Ce sprint n'a pas construit
de nouvelle attaque sur ces domaines au-delà de la ré-exécution de
`tenantHardening.mongo.integration.test.js`,
`tenantCert.audit.mongo.integration.test.js` et
`tenantAttribution.mongo.integration.test.js` — voir rapport §31 pour les
limites explicites.
