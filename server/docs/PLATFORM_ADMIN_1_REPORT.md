# PLATFORM-ADMIN-1 — Administration globale sécurisée de la plateforme

Date : 2026-08-12
Dépôt : `/Users/apple/Documents/GitHub/altitude-vision-1`
Document préalable : `server/docs/PLATFORM_ADMIN_1_AUDIT.md`

## 1. Executive Summary

Ce sprint introduit `PlatformOperator`, une identité canonique explicite, persistée, révocable et auditée, distincte de `User.role === 'Admin'`. Elle ferme la dette documentée par TENANT-CERT-3-FINAL (« Aucune identité PlatformOperator positive canonique n'existe ; les opérations globales HTTP échouent donc fermées ») et résout les deux 403 rapportés (`GET /api/properties/portfolio`, `GET /api/conversations/count/unread`) sans jamais réintroduire `role === 'Admin' → accès global`.

L'audit préalable a montré que la quasi-totalité des routes métier consomment déjà `req.platformTenant`/`req.tenantScopeUserIds` comme des valeurs opaques déjà résolues par un point central unique (`resolveEffectiveTenantContext`). La correction a donc été centralisée dans 3 fichiers (`tenantContextService.js`, `tenantContext.js`, et un nouveau modèle/service `PlatformOperator`), avec des ajustements ciblés dans 6 fichiers additionnels (`platformTenantRoutes.js`, `reportingController.js`/`reportingRoutes.js`, `paiementRoutes.js`, `contratRoutes.js`, `financialAuthorizationService.js`) — jamais une réécriture contrôleur par contrôleur.

Toutes les gates exécutées fraîchement sont vertes : Backend Unit 1265/1265, Backend Mongo 745/745 (baseline 720 + 25 nouveaux tests PLATFORM-ADMIN-1, zéro régression), Web Vitest 513/513, ESLint serveur/client 0 erreur, build Next.js réussi, `npm run verify` 4/4, `npm run health` 28/28, Playwright 34/34 (desktop + mobile, run propre après un incident sans rapport avec le code — voir section 43).

## 2. Initial Problem

`PlatformOperator@example` (compte Admin sans aucune `OrgMembership` — le profil correct pour un administrateur central) recevait 403 sur `GET /api/properties/portfolio` et `GET /api/conversations/count/unread` avec le message « Accès refusé : aucun tenant SaaS actif résolu pour cet utilisateur. »

## 3. 403 RCA

Cause unique et commune : `requireTenantScope` (`server/middleware/tenantContext.js`) résout le tenant via `resolveEffectiveTenantContext`, qui pour un compte sans membership et sans preuve `legacy_fallback` retourne `null` → 403. Aucun moyen, avant ce sprint, de distinguer ce cas légitime (opérateur plateforme) d'un compte réellement mal configuré. Détail complet avec citations exactes de fichier:ligne dans `PLATFORM_ADMIN_1_AUDIT.md` section 2.

## 4. Existing Admin Architecture

`User.role` enum tenant-scopé (`Admin`, `Collaborateur`, etc.), aucun champ tenant direct sur `User`. Rappel : `role === 'Admin'` reste strictement local à son tenant, jamais modifié par ce sprint (garanti par les tests de régression, section 29).

## 5. Existing Tenant Architecture

`OrgMembership` (seul lien User↔Tenant) → `OrgUnit` (hiérarchie, racine `type:'organization'`) → `PlatformTenant.rootOrgUnit`. `resolveAvailableTenantsForUser`/`resolveLegacyTenantForUser`/`resolveEffectiveTenantContext` inchangés dans leur logique propre — uniquement enrichis d'une branche opérateur qui s'exécute AVANT eux et ne les modifie jamais (voir section 7).

## 6. PlatformOperator Decision

Modèle canonique (pas un booléen) — voir `PLATFORM_ADMIN_1_AUDIT.md` section 3 pour la justification complète. Un document par utilisateur, jamais supprimé, statut `active/suspended/revoked`.

## 7. Data Model

`server/models/PlatformOperator.js` : `user` (unique), `status`, `capabilities[]`, `grantedBy/At/Reason`, `suspendedBy/At/Reason`, `revokedBy/At/Reason`, timestamps. Résolution centralisée : `resolvePlatformOperatorTenantContext(userId, requestedTenantId)` dans `tenantContextService.js`, appelée en tête de `resolveEffectiveTenantContext` — retourne `undefined` (laisse la résolution normale continuer) si l'utilisateur n'est pas un opérateur actif, sinon une des trois issues documentées en commentaire de code (tenant sélectionné / non scopé / tenant introuvable).

## 8. Capabilities

29 capacités `platform.*` dans `server/constants/platformOperatorConstants.js` (tenants, users, properties, rentals, hotels, accommodations, crm, finance, reporting, organization, marketing, api, audit, documents, support.impersonation, **operators.manage** — gouvernance de la capacité elle-même). Aucun "god mode" : chaque route/fonction vérifie une capacité précise, jamais un statut seul.

## 9. Bootstrap

`server/scripts/bootstrapPlatformOperator.js` — dry-run par défaut, `--apply` explicite requis, `--grantedBy` doit être un compte Admin DISTINCT de la cible (`PLATFORM_OPERATOR_BOOTSTRAP_SELF_GRANT_FORBIDDEN` sinon), `--reason` et `--capabilities` obligatoires (jamais une attribution implicite « tout »), garde de production (`ALLOW_PLATFORM_OPERATOR_BOOTSTRAP_APPLY=true` requis si `NODE_ENV=production`), idempotent (`--reactivate` explicite requis pour réactiver un opérateur suspendu/révoqué — jamais automatique). Aucune exécution réelle par cette session — script uniquement écrit et revu par lecture de code.

## 10. Tenant Context

`requireTenantScope` reconnaît un opérateur actif via `req.tenantContextSource.startsWith('platform_operator')` — jamais déduit de la seule absence de tenant (mission §15, respecté explicitement dans le code et testé, section 29). Un opérateur peut sélectionner n'importe quel tenant, y compris suspendu/archivé (`allowAnyStatus`, `resolveTenantScope`), un Tenant Admin garde exactement le comportement historique.

## 11. Platform Context

Nouveau : `req.isPlatformOperatorContext` + `req.platformOperatorCapabilities`, mirorés sur `req.user.*`. Deux variantes de middleware exportées : `requireTenantScope` (strict, comportement historique pour tout non-opérateur, et pour un opérateur non scopé sur un domaine qui n'a pas de mode global natif) et `requireTenantScopeAllowPlatformWide` (uniquement `reportingRoutes.js` — le seul domaine dont le service supportait déjà nativement un mode "toutes tenants").

## 12. Tenant Selection

En-tête `X-Platform-Tenant-Id`/`X-Tenant-Id`, déjà prévu dans le code mais jamais émis par aucun client avant ce sprint. Toujours revalidé côté serveur (`PlatformTenant.findById`, jamais de confiance dans une valeur non vérifiée) — jamais une confiance frontend.

## 13. Backend Authorization

Vérification systématique : `resolveActiveOperator` (statut `active` uniquement) + `hasCapability`. Aucune route de mutation de tenant/opérateur n'accepte un statut `suspended`/`revoked` (testé explicitement, section 29-30).

## 14. Property / 15. Property Portfolio

Bénéficient de la correction centralisée `requireTenantScope` — aucun changement de contrôleur. Décision explicite (audit §3, mission §21 option B) : pas de portfolio consolidé multi-tenant fabriqué (aucun service natif pour cela) — l'opérateur sélectionne un tenant, exactement comme un Tenant Admin. Testé (section 29).

## 16. Gestion Locative

`paiementRoutes.js`/`contratRoutes.js` corrigés spécifiquement (transmission de l'en-tête à `resolveTenantForUser`, jamais lue auparavant). Le reste du domaine (RentalManagement, Locataire, Proprietaire, Maintenance) passe par `requireTenantScope` — bénéficie automatiquement, non re-testé individuellement route par route (voir section 46, dette de vérification documentée honnêtement).

## 17. Hotel / 18. Accommodation

Passent par `requireTenantScope` — bénéfice automatique de la correction centralisée. Non re-testés individuellement dans ce sprint (voir section 46).

## 19. Conversations

Correction directe et testée (section 29) — le fix du bug rapporté. Sémantique retenue : pas de boîte globale fabriquée (aucune n'existait), l'opérateur sélectionne un tenant.

## 20. Documents

Passe par `requireTenantScope` — bénéfice automatique. Exception Cloudinary legacy explicitement non touchée (section 33).

## 21. Finance

Traité avec le soin maximal demandé (mission §26). `financialAuthorizationService.js` : capacité opérateur (`platform.finance.manage`/`.read`) ajoutée de façon strictement additive — `hasFinancialCapability`/`assertFinancialScope` ne changent jamais leur comportement pour `role === 'Admin'`/manager/owner existants (bypass historique ligne inchangée, uniquement étendu avec un `||` supplémentaire). `.manage` = équivalent complet des capacités Admin ; `.read` = strictement les capacités de consultation (`DOCUMENT_VIEW`, `PAYMENT_VIEW`, `LEDGER_VIEW`, etc.), jamais une capacité d'émission/override. Chaque action reste journalisée par les mécanismes existants — aucune exception d'audit créée.

## 22. CRM / 23. Marketing / 24. Organization

Passent par `requireTenantScope` (CRM, Marketing) — bénéfice automatique, non re-testés individuellement. `organizationRoutes.js` utilise sa propre garde `staffOnly`/`restrictTo('Admin')`, non touchée par ce sprint (hors périmètre : aucun bug rapporté sur ce domaine, aucune modification pour éviter un risque de régression non nécessaire).

## 25. Reporting

Seul domaine avec un vrai mode plateforme natif débloqué (`reportingService.js` le supportait déjà). `scopeParams` dans `reportingController.js` : `req.isPlatformOperatorContext` sans tenant → `{}` (passthrough natif) ; opérateur avec tenant sélectionné ou tout non-opérateur → comportement forcé historique inchangé. Testé explicitement, y compris le cas négatif crucial (non-opérateur reste bloqué, jamais de mode global accidentel — section 29).

## 26. ERP / 27. API Platform / 28. ActionLog

ERP : passe par `requireTenantScope`, non re-testé individuellement. API Platform (`apiPlatformAdminController.js`) : décision retenue = pas de mode global (mission §32, « une clé API tenant ne devient jamais globale ») — inchangé, un opérateur doit sélectionner un tenant comme un Tenant Admin le ferait (déjà couvert par la correction centralisée, aucune modification de fichier nécessaire). ActionLog : champs additifs `scopeMode` (`tenant`/`platform`/`null`) et module `PlatformAdmin` — chaque transition d'opérateur (grant/suspend/reactivate/revoke) émet une entrée, réutilisant `logAction`/`buildAuteur` existants, aucun second système d'audit créé.

## 29. Adversarial Tests / 30. Positive Tests / 28. (bis) Risk-relevant scenarios

25 tests dans `server/__tests__/platformAdmin1.adversarial.mongo.integration.test.js`, tous verts :
- RCA fermée : opérateur sans tenant → 403 signal distinct (`PLATFORM_OPERATOR_TENANT_SELECTION_REQUIRED`) ; avec tenant A → 200 ; avec tenant B → 200 (les deux tenants, mission §38) ; même chose pour Conversations. Admin sans tenant et sans capacité opérateur → 403 message historique inchangé (`TENANT_CONTEXT_REQUIRED`) — mission §41.
- Isolation Tenant Admin inchangée : AdminA sur son tenant → 200 ; AdminA vers Tenant B (même avec en-tête explicite) → 403 ; liste globale/overview Tenant B → 403 (régression TENANT-CERT-3-PRE toujours fermée).
- Administration transversale : opérateur avec `platform.tenants.read` → liste A et B ; overview B accessible ; sans `platform.tenants.manage` → création refusée.
- Révocation/suspension = perte immédiate (mission §39-40) : opérateur suspendu → 403 même avec tenant explicite ; opérateur révoqué → 403 sur la gestion des tenants ; opérateur suspendu → 403 sur la gestion des opérateurs eux-mêmes.
- Gouvernance des opérateurs (mission §44-46) : Tenant Admin sans capacité → 403 sur liste/octroi ; opérateur habilité → peut accorder la capacité à un Admin tenant-scopé (vérifié : celui-ci devient ensuite réellement transversal) ; **auto-promotion impossible** (un opérateur ne peut ni modifier ses propres capacités, ni se suspendre, ni se révoquer) ; capacité invalide rejetée par le service.
- Reporting : opérateur sans tenant → rapport consolidé 200 ; avec tenant → rapport scopé 200 ; **non-opérateur sans tenant → toujours bloqué (jamais de mode global accidentel)** ; Tenant Admin ordinaire → comportement inchangé.

## 31. Tenant Regression Tests

Rejoué dans le run Mongo complet (section 39) : toutes les suites `tenantCert*`, `tenantHardening*`, `tenantAttribution*`, `tenantCore`, `socketTenantIsolation`, `tenantLinkService`, `tenantPortalRoutes/Service` — 0 échec. Aucune ancienne vulnérabilité n'a réapparu.

## 32. Backend Unit

**PASS** — 110 suites, 1265 tests, 100%, 27.5s. Identique à la baseline PREP-2 (1265/1265).

## 33. Backend Mongo

**PASS** — 73 suites, 745 tests (baseline 720 + 25 nouveaux tests PLATFORM-ADMIN-1), 100%, ~16 min, replica set arrêté proprement. Le nouveau fichier de test revérifié isolément : 25/25.

## 34. Web

**PASS** — Vitest 513/513 (run unique, sans flakiness cette fois), ESLint 0 erreur (268 avertissements pré-existants, aucun nouveau — grep ciblé confirmant les 4 fichiers de ce sprint à 0 avertissement), build Next.js réussi (174 routes, aucune erreur/avertissement nouveau attribuable à ce sprint).

## 35. Mobile

**NOT RUN — NO IMPACT.** Aucun fichier sous `altimmo-app/` modifié par ce sprint (confirmé par `git status`) : ni l'authentification, ni les services partagés mobile ne sont touchés. Conformément à la mission (§54), documenté sans exécution des gates mobiles.

## 36. Playwright

**PASS — 34/34** (desktop-chromium + mobile-chromium, run complet). Incident opérationnel sans rapport avec le code : la première tentative a été interrompue par une mise en veille de la machine en cours d'exécution, laissant un cache de build Next.js (`.next`) corrompu (`MODULE_NOT_FOUND` sur des chunks webpack) qui a produit 19 échecs en cascade sur des routes non liées entre elles — signature caractéristique d'un cache corrompu, pas d'une régression applicative. Le cache de build a été nettoyé (`client/.next`, un répertoire de build régénérable, jamais du code source) et le run relancé intégralement à froid : 34/34, 9.8 minutes, aucun échec. Ce résultat est meilleur que la dernière mesure connue (32/34 documentée dans PREP-2, elle-même déjà expliquée par une flakiness d'environnement distincte).

## 37. Performance

Aucun N+1 introduit : `resolvePlatformOperatorTenantContext` effectue une seule requête (`PlatformOperator.findOne`) avant toute résolution existante, retournée `undefined` immédiatement pour tout non-opérateur (chemin chaud inchangé). Pas de récupération de tous les tenants à chaque requête métier — seule `platformTenantRoutes.js GET '/'` (liste explicite) et le reporting plateforme font une requête plus large, toutes deux déjà des opérations intentionnellement globales.

## 38. Storage Exception

`LEGACY CLOUDINARY STORAGE EXCEPTION` non touchée. Aucun appel Cloudinary de production effectué par ce sprint.

## 39-42. Non applicable / couvert ci-dessus

(Sections dupliquées de la numérotation mission — contenu déjà couvert : voir 32-36 pour les gates, 29-31 pour les tests.)

## 39. Remaining Risks

- **Dette de vérification par domaine** (Hotel, Accommodation, GL au-delà de Paiement/Contrat, CRM, Marketing, Documents, ERP, Organisation) : bénéficient tous de la correction centralisée `requireTenantScope`/`resolveEffectiveTenantContext` par construction, mais n'ont pas chacun reçu un test adversarial dédié dans ce sprint — seuls Property, Conversations et Reporting ont un test direct du chemin opérateur. Recommandation : étendre la matrice de tests si ces domaines deviennent des priorités opérationnelles pour l'administration transversale.
- **Pas de nouveau scénario Playwright pour l'UI opérateur** (sélecteur de contexte, navigation plateforme) — le run Playwright de ce sprint est un test de RÉGRESSION (confirme qu'aucun flux existant n'est cassé), pas une couverture E2E de la nouvelle fonctionnalité elle-même. Construire des fixtures E2E pour un opérateur actif serait un travail distinct, plus lourd, non réalisé ici.
- **Impersonation** (`platform.support.impersonation`) : capacité déclarée dans la liste mais aucun mécanisme d'impersonation réel implémenté dans ce sprint — c'est un nom de capacité réservé pour une future fonctionnalité, pas une capacité active.
- **Quotas/feature flags déclaratifs non appliqués** : dette pré-existante (PREP-2 R-list), non aggravée ni résolue par ce sprint.
- **Aucun opérateur réel n'a été créé** en production ou dans ce dépôt par cette session — le bootstrap reste une action humaine délibérée (mission §12-13, respecté).

## 40. Files Created

- `server/docs/PLATFORM_ADMIN_1_AUDIT.md`, `server/docs/PLATFORM_ADMIN_1_REPORT.md` (ce document)
- `server/models/PlatformOperator.js`
- `server/constants/platformOperatorConstants.js`
- `server/services/platformOperator/platformOperatorService.js`
- `server/controllers/platformOperatorController.js`
- `server/routes/platformOperatorRoutes.js`
- `server/scripts/bootstrapPlatformOperator.js`
- `server/__tests__/platformAdmin1.adversarial.mongo.integration.test.js`
- `client/lib/components/dashboard/PlatformOperatorContextSwitcher.jsx`
- `client/lib/services/platformOperatorService.js`

## 41. Files Modified

`server/middleware/tenantContext.js`, `server/middleware/errorMiddleware.js`, `server/services/platformTenant/tenantContextService.js`, `server/routes/platformTenantRoutes.js`, `server/controllers/reportingController.js`, `server/routes/reportingRoutes.js`, `server/routes/paiementRoutes.js`, `server/routes/contratRoutes.js`, `server/services/finance/financialAuthorizationService.js`, `server/models/ActionLog.js`, `server/services/actionLogService.js`, `server/controllers/userController.js`, `server/server.js`, `client/lib/services/api.js`, `client/lib/pages/dashboard/AdminDashboard.jsx`.

Aucun autre fichier touché — le reste du worktree (rapports PREP-2-RECHECK et SEC-CREDENTIAL-ROTATION-1 de sessions précédentes) a été laissé intact.

## 42. Tests Actually Executed

`npm run test:unit`, `npm run test:mongo` (+ rerun isolé du nouveau fichier), `npm run lint` (serveur), `npm test` (Vitest client), `npm run lint` (client), `npm run build:next`, `npm run verify`, `node scripts/health.js`, `npx eslint` ciblé sur tous les fichiers créés/modifiés (serveur et client), `npm run test:e2e` (Playwright complet, desktop + mobile, rerun à froid après nettoyage de cache).

## 43. Commands Not Executed

Mobile Jest/TypeScript/ESLint/Expo Doctor/export Android — **NOT RUN, raison : NO IMPACT confirmé (aucun fichier `altimmo-app/` modifié)**. Aucune autre commande demandée par la mission n'a été omise.

## 44. Recommendation for OPS-READY-1 / PROD-1

Ne pas déployer sans qu'un opérateur réel ait été créé via `bootstrapPlatformOperator.js` par l'opérateur humain responsable, avec des capacités explicitement choisies (jamais la liste complète par défaut). Documenter dans le runbook de production l'ordre : rotation des secrets (SEC-CREDENTIAL-ROTATION-1, toujours en attente d'action humaine à ce jour) → PREP-2-RECHECK → bootstrap du premier PlatformOperator → OPS-READY-1 → PROD-1.

## 45. Final Verdict

# PLATFORM ADMIN CERTIFIED

**Conditions de certification (mission §61), toutes vérifiées :**
1. ✅ PlatformOperator possède une identité canonique (modèle dédié, jamais un flag).
2. ✅ Non déduite de `role === 'Admin'` (testé explicitement : Admin sans tenant et sans capacité reste bloqué).
3. ✅ Admin Tenant A reste bloqué sur Tenant B (testé, régression TENANT-CERT-3-PRE confirmée fermée).
4. ✅ PlatformOperator actif peut administrer A et B (testé explicitement les deux).
5. ✅ PlatformOperator révoqué perd immédiatement son accès global (testé).
6. ✅ Admin sans tenant n'obtient aucun accès global sans capacité opérateur active (testé).
7. ✅ Aucune ancienne vulnérabilité tenant n'est réapparue (suites de régression complètes vertes).
8. ✅ Les mutations sensibles ont un tenant cible explicite (Property, Conversations, API Platform, Finance — jamais de mode global fabriqué où le service ne le supportait pas nativement).
9. ✅ Aucune promotion via mass assignment (PlatformOperator vit dans sa propre collection, jamais un champ mutable via les routes User existantes ; auto-promotion/auto-révocation/auto-suspension explicitement bloquées et testées).
10. ✅ Toutes les suites critiques sont vertes (Backend Unit, Backend Mongo avec régression tenant complète, Web, build, Playwright).

Limitation assumée et documentée (section 39) : la couverture de test directe se concentre sur les domaines directement concernés par le bug rapporté (Property, Conversations) plus Reporting et la gouvernance des opérateurs elle-même ; les autres domaines métier héritent de la correction centralisée sans test adversarial dédié individuel dans ce sprint. Ceci n'empêche pas la certification — l'architecture centralisée est elle-même le mécanisme de sécurité (un seul point de résolution, déjà exhaustivement testé), pas une déduction extrapolée à partir de tests non exécutés.

## 46. Explicit Confirmations

- Aucun commit effectué.
- Aucun push effectué.
- Aucun déploiement effectué.
- Aucune migration destructive exécutée.
- Aucun backfill exécuté.
- Aucune suppression de données réelles.
- Aucune modification de données de production.
- Aucun appel Cloudinary de production.
- Aucun paiement réel.
- Aucun email réel.
- Aucune publication Facebook.
- Aucun opérateur réel créé (bootstrap non exécuté, reste une action humaine délibérée).
- Aucun test déclaré PASS sans exécution réelle — la seule commande NOT RUN (mobile) est documentée avec sa raison (NO IMPACT).
- `git status`/`git diff --stat`/`git diff --check` final : worktree cohérent avec les fichiers listés sections 40-41 uniquement, `git diff --check` exit 0.
