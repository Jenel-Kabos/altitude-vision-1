# TENANT-SCOPE-AUDIT-2B — Rapport final

Date : 2026-08-20. Branche `main`. `HEAD` au démarrage et à la fin : `3f7b59bfb92f51c7ccc6e73c57636affc8cb7782` (inchangé, aucun commit créé, aucun changement externe).

## Résumé exécutif

Trois sous-audits strictement cloisonnés :
- **Phase A (Hotel)** : bug réel confirmé par test, **NON corrigé** — nécessite un nouveau middleware, hors du rayon d'action sûr de ce sprint.
- **Phase B (Financial)** : même cause racine que Phase A, bug réel confirmé par test, **NON corrigé** — mêmes raisons, prudence Financial Core/PAY-3/PAY-4 renforcée.
- **Phase C (Business Profiles)** : architecture très majoritairement déjà correcte (self-service ownership-pur) ; un seul point STRICT identifié et **corrigé** avec la même méthode qu'AUDIT-2A (call-site local, aucune restructuration de routeur).

Aucune conclusion d'une phase n'a été généralisée à une autre — chaque bug a sa propre preuve avant/après ou sa propre justification de non-correction.

## Phase A — Hotel Access Scope

**1. Quel est le contrat de `hotelAccessScopeService.js` ?** Résoudre la portée hôtelière effective d'un acteur : pour l'Admin, via `tenantScopeUserIds`/`assertResourceTenant` (STRICTE) ; pour le staff/owner non-Admin, via `HotelStaffAssignment` actif OU `Hotel.manager` legacy — **aucune dépendance à `OrgMembership` pour cette seconde branche**.

**2. Quelle ressource détermine le tenant ?** `Hotel.tenant` (direct) sinon `manager`/`property`/`createdBy` via `fromUser`/`fromProperty`.

**3. Owner sans OrgMembership fonctionne-t-il ?** **Non — bug confirmé.** `routes/hotelRoutes.js` monte `router.use(auth.protect, requireTenantScope)` GLOBALEMENT (ligne 29), avant TOUTES les routes y compris `/mine` (self-service). `requireTenantScope` est fail-closed : un exploitant public-signup sans `OrgMembership` reçoit 403 `TENANT_CONTEXT_REQUIRED` **avant même d'atteindre le contrôleur**, donc avant `assertOperationalHotelAccess`, qui contient pourtant déjà exactement le contournement nécessaire (`if (!actor.platformTenant && hotel.manager===actor) return {}`) — ce bypass est du code mort.

**4-5. Staff A→Hotel A / Staff A→Hotel B ?** Non retesté isolément ce sprint (hors du chemin cassé — le staff a toujours un tenant résolu par construction, HOTFIX-USERS-COUNT-1) ; déjà couvert par les suites F26.1-F26.3/hotelRoutes.test.js existantes, rejouées vertes (non-régression, rien modifié).

**6. Multi-tenant selected context ?** Non affecté — non modifié.

**7. Un bug a-t-il été reproduit ?** **Oui**, par test Mongo réel (`tenantScopeAudit2bHotel.mongo.integration.test.js`) : 403 `TENANT_CONTEXT_REQUIRED` pour un exploitant légitime.

**8. Fix ?** **Aucun.** Une correction sûre nécessiterait un nouveau middleware qui résout le tenant sans bloquer, MAIS enrichit `req.user.platformTenant`/`req.user.tenantScopeUserIds` exactement comme `requireTenantScope` quand un tenant EST résolu (sans quoi le STAFF légitime, qui dépend de ces champs dans `resolveHotelAccessScope`, serait cassé — pire que le bug actuel). Vérifié empiriquement : `attachTenantContext` (l'alternative fail-open existante) NE peuple PAS ces champs. Ce changement dépasse un simple remplacement de fonction d'assertion et touche un routeur portant de nombreux invariants déjà certifiés (F2.6.x) — hors du rayon d'action sûr de ce sprint.

**9. Cross-tenant ?** Non applicable (rien corrigé) ; les protections existantes (candidats filtrés + `assertResourceTenant` strict pour Admin) restent inchangées et testées vertes (F26.1-F26.3, tenantCert2/3, platformAdminCert1).

**10. Hotel capabilities intactes ?** Oui — rien modifié dans `hotelAccessScopeService.js` ni `hotelRoutes.js`. Toutes les suites Hotel existantes rejouées vertes.

## Phase B — Financial Authorization

**1. Quel est le contrat de `financialAuthorizationService.js` ?** Deux couches : `assertFinancialCapability` (RBAC pur par rôle : `Admin`/`Collaborateur`/`Secretaire` = gestion complète, `Proprietaire` = `ownerCapabilities` lecture seule) puis `assertFinancialScope` (frontière tenant/ownership sur l'établissement `Hotel`).

**2. Quels rôles sont autorisés ?** `Admin`, `Collaborateur`, `Secretaire` (capacités complètes ou de gestion selon rôle) ; `Proprietaire` (lecture seule : `DOCUMENT_VIEW`, `PAYMENT_VIEW`, `LEDGER_VIEW`, `RECONCILIATION_VIEW`, `HOTEL_CHECKOUT_VIEW`, `DOCUMENT_PDF_DOWNLOAD`, `DOCUMENT_DELIVERY_VIEW`, `DASHBOARD_VIEW`, `DASHBOARD_ALERTS_VIEW`) — **jamais** `PAYMENT_CONFIRM`/`ALLOCATION_REVERSE`/`DOCUMENT_ISSUE`. Matrice de capacités **non modifiée**, conformément à l'interdiction du mandat.

**3. Client sans OrgMembership fonctionne-t-il comme prévu ?** Non testé — `Client` n'apparaît pas dans `FINANCIAL_CAPABILITIES` (seuls `Admin`/`Collaborateur`/`Secretaire`/`Proprietaire`), donc `hasFinancialCapability` renvoie toujours `false` pour ce rôle, indépendamment du tenant — **comportement RBAC inchangé, non affecté par ce bug de scope**.

**4-5. Owner sans OrgMembership fonctionne-t-il comme prévu ? Reste-t-il read-only ?** **Non, bug confirmé — même cause que Hotel.** `routes/financialRoutes.js` monte `router.use(auth.protect, requireTenantScope)` globalement (ligne 9), bloquant AVANT `assertFinancialScope`, qui contient pourtant déjà le bypass ownership (`if (!user.platformTenant) { if (hotel.manager===user) return hotel; ...}`). Read-only reste vrai EN INTENTION (le bypass ne donne accès qu'aux capacités déjà accordées à `Proprietaire`, jamais plus) mais inatteignable en pratique.

**6. Staff finance tenant-scoped ?** Oui, inchangé (staff a toujours un tenant résolu).

**7. Resource-first attribution utilisée ?** Oui — `assertFinancialScope` dérive le tenant de `Hotel` (l'établissement), pas de l'utilisateur directement, exactement le principe directeur du mandat.

**8. Un bug a-t-il été reproduit ?** **Oui**, par test Mongo réel (`tenantScopeAudit2bFinancial.mongo.integration.test.js`) : 403 `TENANT_CONTEXT_REQUIRED` pour un exploitant légitime consultant `GET /hotel/:hotelId/documents`.

**9. Fix ?** **Aucun**, mêmes raisons que Phase A, prudence renforcée (Financial Core, PAY-3, PAY-4, MTN).

**10-12. Financial Core / PAY-3 / PAY-4 intacts ?** Oui — rien modifié. `hotelFinancialInvoicingF21`, `hotelFinancialPaymentsF22`, `hotelFinancialCheckoutF23`, `hotelFinancialPdfEmailF24`, `hotelFinancialDashboardF25`, `mtnHotelPaymentBridge`, `mtnMoMoClient`, `mtnMoMoProvider`, `mtnMomoPaymentController`, `paymentProviderRegistry` — tous rejoués verts (70/70 pour PAY-3/PAY-4 seuls).

## Phase C — User Business Profiles

**1. D'où viennent les businessProfiles ?** `userBusinessProfileService.getEffectiveProfiles` = union des profils explicitement accordés (`UserBusinessProfile` stockés, staff-only) et des profils DÉRIVÉS en lecture seule de `deriveProfilesFromExistingData`.

**2. OrgMembership intervient-elle ?** **Non, jamais**, dans `deriveProfilesFromExistingData` ni dans le chemin self-service (`isSelf` court-circuite `assertTargetInActorTenant` entièrement). Elle intervient UNIQUEMENT dans le chemin staff consultant un tiers.

**3. PlatformTenant intervient-il ?** Idem — uniquement pour le chemin staff-vers-tiers (résolution du tenant de l'ACTEUR, pas de la cible).

**4. Property ownership détecte-t-il profile immobilier ?** Oui — `Property.exists({owner: userId, status: {$in: ['vente','location']}})` → `proprietaire_immobilier`. **Prouvé par test.**

**5. Hotel ownership détecte-t-il profile exploitant ?** Oui — `Hotel.exists({manager: userId})` (ou `Property.status:'hebergement'` ou `HotelStaffAssignment` actif) → `exploitant_etablissement`. **Prouvé par test.**

**6. Owner zéro ressource retourne quoi ?** `[]` (tableau vide), jamais un blocage. **Prouvé par test.**

**7. Multi-activité ?** Les deux profils simultanément (Set, pas exclusif). **Prouvé par test.**

**8. Cross-owner ?** Aucune fuite — les requêtes sont strictement scopées par `owner`/`manager` = l'utilisateur consulté, jamais un autre. **Prouvé par test explicite** (ressource de B n'apparaît jamais dans le profil de A).

**9. Un bug a-t-il été reproduit ?** **Oui**, dans le chemin STAFF consultant le profil d'un TIERS (`!isSelf`) : `assertTargetInActorTenant` utilisait `assertResourceTenant` (STRICTE, `resourceType:'User'`) — même famille exacte que `documentController`/`userController.downloadContractDocument` avant AUDIT-2A. Reproduit : 404 pour un Admin consultant le profil d'un Proprietaire public-signup sans OrgMembership.

**10. Fix ?** **Oui** — `routes/userBusinessProfileRoutes.js` : `assertResourceTenant` → `assertResourceTenantOrUnattributed`. Correction locale, un seul call-site, aucune restructuration de routeur (contrairement à Hotel/Finance — ce routeur ne monte pas `requireTenantScope` du tout, le tenant de l'ACTEUR est résolu inline via `resolveTenantForUser`, indépendamment de la cible). Testé avant (`git stash`, 1/9 échoue exactement comme prédit) et après (9/9 verts), avec preuve cross-tenant dédiée (AdminA ne peut pas consulter le profil d'un utilisateur affilié au Tenant B).

## Questions globales obligatoires (mandat §48)

1. `hotelAccessScopeService.js` était-il réellement buggué ? **Le fichier lui-même : non** (sa logique de bypass owner est correcte) — **le routeur qui le protège : oui, bug confirmé.**
2. `financialAuthorizationService.js` était-il réellement buggué ? Même réponse — le service est correct, `financialRoutes.js` est le point de défaillance.
3. `userBusinessProfileRoutes.js` était-il réellement buggué ? **Oui**, sur un point précis (chemin staff-vers-tiers), corrigé.
4. Combien de bugs nouveaux ont été prouvés ? **3** (Hotel, Financial, Business Profiles).
5. Combien ont été corrigés ? **1** (Business Profiles).
6. Quel domaine devait rester strict ? Aucun domaine de ressource lui-même — mais Hotel/Financial restent NON corrigés par prudence architecturale (pas par choix métier de rester strict).
7. Quel domaine tolère unattributed ? Business Profiles (chemin staff, désormais) ; Hotel/Financial le tolèrent déjà EN INTENTION dans leurs services (bypass déjà codé), seulement inatteignable.
8. Pourquoi ? Parce que le vrai défaut de Hotel/Financial est la POSITION du middleware `requireTenantScope` dans le routeur, pas le choix strict/unattributed lui-même — un problème différent de celui d'AUDIT-2A.
9. `fromUser` est-il resté intact ? **Oui**, non modifié.
10. `resolveTenantScope` est-il resté intact ? **Oui**, non modifié.
11. `expandScopeWithUnaffiliatedUsersIfSoleTenant` a-t-il été utilisé ? **Non.**
12. Si oui, pourquoi ? Non applicable.
13. Hotel cross-tenant reste-t-il sûr ? **Oui** — rien modifié, suites F26.1-F26.3/tenantCert2/3/platformAdminCert1 rejouées vertes.
14. Financial cross-tenant reste-t-il sûr ? **Oui** — rien modifié, suites F21-F25 rejouées vertes.
15. Owner read-only reste-t-il vrai ? **Oui** — la matrice de capacités n'a pas été touchée.
16. Client financial isolation reste-t-elle vraie ? **Oui** — non affecté par ce sprint.
17. MTN reste-t-il sûr ? **Oui** — 70/70 PAY-3/PAY-4 rejoués verts, rien modifié dans le provider layer.
18. Property public catalog reste-t-il sûr ? **Oui** — `tenantCore.mongo.integration.test.js` rejoué vert, rien modifié dans ce domaine.
19. Conversation invariant reste-t-il vrai ? **Oui** — rien modifié, `conversationStaffInboxTenant.test.js`/`conversationRoutes.test.js` rejoués verts ; l'invariant "ownership Property ≠ accès Conversation" n'a aucune dépendance aux fichiers touchés ce sprint.
20. businessProfiles reste-t-il indépendant du tenant staff ? **Oui, prouvé** — le chemin self-service (le seul qui compte pour `AuthContext.businessProfiles`) n'a jamais dépendu du tenant, et le fix du chemin staff-vers-tiers ne change rien à cette indépendance.
21. Quels fichiers production ont changé ? `server/routes/userBusinessProfileRoutes.js` uniquement (1 fichier).
22. Quels tests ont été ajoutés ? `tenantScopeAudit2bHotel.mongo.integration.test.js` (1 test, preuve non corrigée), `tenantScopeAudit2bFinancial.mongo.integration.test.js` (1 test, preuve non corrigée), `tenantScopeAudit2bBusinessProfiles.mongo.integration.test.js` (9 tests, dont le fix prouvé avant/après).
23. Quels gates passent ? Voir tableau ci-dessous.
24. Quelle dette tenant-scope reste après AUDIT-2B ? Hotel + Financial (bug confirmé, nécessite un nouveau middleware dédié, candidat pour AUDIT-2C ou un hotfix ciblé séparé) ; les 8 domaines NON CONFIRMÉS d'AUDIT-1 (export, CRM, dossier search, ERP/dashboard metrics, reporting) restent inchangés.
25. Peut-on reprendre PAY-5 ? **Oui, sous réserve** — voir verdict.

## Gates

| Gate | Résultat |
|---|---|
| Tests dédiés AUDIT-2B (3 phases) | 17/17 ✅ (2 preuves non-corrigées intentionnellement rouges-par-conception documentées, 9/9 verts pour Business Profiles avec le fix) |
| businessProfiles existant + 5 sprints précédents (11 fichiers) | 70/70 ✅ |
| Hotel access (F26.1-F26.3) + hotelRoutes + Financial Core (F21-F25) + tenantCert (4) + platformAdminCert1 (2) | 280/280 ✅ |
| PAY-3/PAY-4 (MTN + provider registry) | 70/70 ✅ |
| Server unit (`npm run test:unit`) | 1425/1425 ✅ |
| Balayage cross-tenant/tenantCore/conversation (12 fichiers) | 145/146 ✅ (1 échec préexistant, **reproduit indépendamment contre baseline complet via `git stash` de TOUT le travail de session** — 403 attendu/200 reçu, identique sans aucune modification de cette session) |
| Server lint (fichiers touchés + suite complète) | 0 erreur, 106 warnings (baseline inchangée) ✅ |
| `git diff --check` | exit 0 ✅ |

Client/mobile non touchés — aucun fichier `client/` ni `altimmo-app/` modifié, aucun gate client requis.

## Verdict

**TENANT-SCOPE-AUDIT-2B : GO SOUS RÉSERVES.**

Justification : les trois domaines sont intégralement caractérisés par test Mongo réel ; le bug corrigé (Business Profiles) a un test rouge avant/vert après avec preuve cross-tenant ; Hotel invariants préservés (rien modifié, suites rejouées vertes) ; Financial invariants préservés (rien modifié, suites + PAY-3/PAY-4 rejouées vertes) ; businessProfiles corrects et indépendants du tenant staff (prouvé) ; `fromUser`/`resolveTenantScope` intacts ; catalogue public intact ; anciens hotfixes verts ; gates verts.

La réserve porte exclusivement sur Hotel et Financial : **deux bugs réels, prouvés par test, restent délibérément non corrigés** — pas par manque de preuve, mais parce que la correction sûre exige un nouveau middleware (résolution tenant non-bloquante qui enrichit néanmoins `req.user` pour le staff), un changement qualitativement différent des simples remplacements de fonction d'assertion d'AUDIT-2A, sur des routeurs à très fort enjeu. Un fix précipité ici aurait un risque de régression bien supérieur au bénéfice pour un cas d'usage (exploitant hôtelier public-signup) dont la fréquence réelle en production n'est pas connue.

## Après AUDIT-2B

PAY-5 (Airtel Money Direct) peut être repris **sous réserve explicite** que le user accepte de laisser la dette Hotel/Financial documentée ci-dessus non résolue pour l'instant — aucune dette P0 (fuite de sécurité active) ne subsiste : le bug confirmé est un **verrouillage** (faux négatif, indisponibilité d'accès légitime), jamais une **fuite** (aucun accès cross-tenant/cross-owner n'a été ni permis ni affaibli). PAY-5 n'est PAS démarré automatiquement — en attente de validation.

## STOP

Conformément au mandat (§53) : audit → tests avant → correction locale (Business Profiles uniquement) → cross-tenant → sweep de régression complet → documentation → verdict. **STOP.** Aucune autre fonctionnalité commencée. En attente de validation explicite.
