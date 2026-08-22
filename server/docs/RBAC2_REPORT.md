# RBAC-2 — BACKEND CANONICAL CAPABILITY ENGINE

**Verdict : RBAC-2 : CERTIFIÉ VERT.**

Aucune nouvelle architecture IAM créée. `iamArchitecture.js` consolidé comme source canonique des capacités staff globales, avec une validation anti-typo qui a immédiatement prouvé sa valeur en révélant un bug de configuration réel (`payments.reverse`, jamais déclarée). Les 4 alias `STAFF_IMMO`/`ROLES_ALTIMMO`/`ROLES_GL`/`ROLES_LITIGES` dérivent désormais d'une unique constante. Une route pilote migrée avec parité stricte prouvée par test (10 rôles + 1 rôle inconnu). Tenant, ownership, HotelStaffAssignment, financialAuthorizationService, PlatformOperator, business profiles : tous intacts, aucun fichier les concernant modifié.

## Réponses aux 47 questions du mandat

1. **`iamArchitecture.js` est-il réellement la meilleure source canonique ?** Oui — voir `RBAC2_IAM_BASELINE_MATRIX.md` §Verdict : déjà branché réellement sur 10 domaines, sémantiquement une simple projection additive n'empiétant sur aucun système spécialisé, structure triviale à étendre.
2. **Combien de capacités existaient avant ?** 32 chaînes de capacité distinctes réellement exigées par au moins une route (`properties.update`, `rental.manage`, etc.), mais dont **1 seule (`payments.reverse`) n'était déclarée dans aucun rôle** — un bug de configuration latent.
3. **Combien après ?** 32 (aucune capacité nouvelle inventée — `payments.reverse` existait déjà comme exigence de route, seulement absente du registre).
4. **Quelles nouvelles capacités ont été ajoutées ?** Aucune capacité *métier* nouvelle. Un registre `ADMIN_ONLY_CAPABILITIES = ['payments.reverse']` a été ajouté pour rendre cette capacité préexistante reconnaissable par la validation.
5. **Pourquoi ?** Pour que `assertKnownCapability` (mandat §32) puisse distinguer "capacité valide réservée à Admin/Collaborateur" d'une réelle faute de frappe, sans pour autant l'accorder à un rôle staff nommé (voir Q10/§Découverte).
6. **Mapping rôle→capabilities centralisé ?** Oui — `RBAC2_ROLE_CAPABILITY_MATRIX.md`, dérivé exactement de `DEFAULT_CAPABILITIES`.
7. **Admin conserve-t-il exactement ses droits ?** Oui — toujours `['*']`, jamais modifié, jamais remplacé par une liste explicite (mandat §12 — le wildcard existant n'a pas été touché).
8. **Collaborateur ?** Oui — toujours `['legacy.full']`, inchangé.
9. **Secretaire ?** Oui — 9 capacités, aucune ajoutée ni retirée.
10. **GestionnaireImmobilier ?** Oui — 19 capacités, aucune ajoutée ni retirée. **Une tentative d'ajout (`payments.reverse`) a été explorée puis explicitement annulée après avoir prouvé qu'elle contredisait un test de sécurité existant** ("IAM-3") — voir `RBAC2_SECURITY_MATRIX.md` pour la transparence complète de cet aller-retour.
11. **CommunityManager ?** Oui — 6 capacités, inchangé.
12. **Communicant ?** Oui — 3 capacités, inchangé.
13. **Client inchangé ?** Oui — `['client.self']`, inchangé.
14. **Proprietaire inchangé ?** Oui — `['properties.own', 'accommodation.own']`, inchangé.
15. **User legacy inchangé ?** Oui — `['client.self']`, inchangé.
16. **Prestataire inchangé ?** Oui — `['provider.self']`, inchangé.
17. **Quels aliases ont été dédupliqués ?** `STAFF_IMMO`, `ROLES_ALTIMMO`, `ROLES_GL`, `ROLES_LITIGES` — désormais 4 références strictement identiques à une constante unique `CANONICAL_IMMO_STAFF_ROLES`.
18. **STAFF_IMMO ?** Alias de `CANONICAL_IMMO_STAFF_ROLES`.
19. **ROLES_ALTIMMO ?** Idem.
20. **ROLES_GL ?** Idem.
21. **ROLES_LITIGES ?** Idem.
22. **Combien de routes migrées vers requireCapability ?** 1 (`POST /api/property-asset/:id/transition`), délibérément limité (mandat §26).
23. **Pourquoi ces routes ?** Voir `RBAC2_MIGRATION_MATRIX.md` §Pourquoi cette route — faible risque, déjà dans le groupe dupliqué identifié par RBAC-1, tests déjà existants, aucune complexité financière/hôtelière/plateforme.
24. **Parité avant/après prouvée ?** Oui — 37/37 tests identiques avant et après migration, incluant une matrice de 11 scénarios de rôle (10 rôles nommés + 1 rôle inconnu).
25. **Une permission a-t-elle été élargie ?** Non, sur aucune route touchée.
26. **Une permission a-t-elle été réduite ?** Non.
27. **Tenant guards intacts ?** Oui — aucun fichier tenant modifié (`tenantContext.js`, `tenantContextService.js`, `tenantResourceAttributionService.js` absents de `git diff`).
28. **Ownership intact ?** Oui — `propertyAssetController.js`, `propertyAssetLifecycleService.js` non modifiés.
29. **PlatformOperator intact ?** Oui — aucun fichier touché.
30. **HotelStaffAssignment intact ?** Oui — aucun fichier touché.
31. **financialAuthorizationService intact ?** Oui — aucun fichier touché ; le seul contact indirect (`payments.reverse`, flux Gestion Locative `Paiement`/`RentalPaymentReceipt`) est hors du Financial Core hôtelier.
32. **BusinessProfiles intacts ?** Oui — `UserBusinessProfile.js`, `userBusinessProfileService.js`, `businessProfileConstants.js` non modifiés.
33. **Frontend Web modifié ?** Non — aucun fichier `client/` touché par RBAC-2 (le seul fichier `client/` en `git status` provient du sprint précédent, HOTFIX-WEB-GOOGLE-AUTH-1).
34. **Mobile modifié ?** Non — aucun fichier `altimmo-app/` touché ; la copie mobile inutilisée de `staffCapabilities.js` reste intacte, non supprimée.
35. **`/me` modifié ?** Non — `authController.createSendToken` non touché, payload de connexion identique à avant.
36. **Payload capabilities exposé ?** Non — `getEffectiveCapabilities(role)` existe (pure fonction, testée) mais n'est appelée par aucune route ni aucun contrôleur. Préparé, non exposé, conformément au mandat §35/§36.
37. **Tests IAM ?** `iamArchitecture.test.js` étendu à 19 tests (8 préexistants + 11 nouveaux : registre, validation, `getEffectiveCapabilities`, rôle/capacité inconnus, correctif `payments.reverse`).
38. **Tests routes ?** `propertyAssetRoutes.mongo.integration.test.js` étendu à 37 tests (26 préexistants + 11 nouveaux : matrice de rôles complète + rôle inconnu).
39. **Tests tenant ?** `tenantScopeAudit1PropertyPortfolio.mongo.integration.test.js`, `tenantCert2.adversarial.mongo.integration.test.js` rejoués sans modification — verts.
40. **Server unit ?** 128/128 suites, 1473/1473 tests verts.
41. **Mongo ?** Suites ciblées toutes vertes (voir Q39), **et runner Mongo exhaustif (`npm run test:mongo`) exécuté intégralement jusqu'au bout : 97/97 suites, 974/974 tests verts, exit code 0.** Aucune régression détectée sur l'ensemble du domaine Mongo (hôtellerie, financier, tenant, gestion locative, propriétés, réservations, verrous d'inventaire, etc.), malgré le périmètre volontairement restreint des fichiers réellement modifiés par ce sprint.
42. **Lint ?** 0 erreur (106 warnings, baseline inchangée).
43. **`git diff --check` ?** exit 0.
44. **Fichiers modifiés ?** `server/utils/roles.js`, `server/utils/iamArchitecture.js`, `server/middleware/capabilityMiddleware.js`, `server/routes/propertyAssetRoutes.js`, `server/__tests__/iamArchitecture.test.js`, `server/__tests__/propertyAssetRoutes.mongo.integration.test.js`. Créés : `server/__tests__/rolesAliasParity.test.js` + les 7 documents `server/docs/RBAC2_*.md`. **Aucun fichier `client/`, `altimmo-app/`, ni aucun fichier hors de ce périmètre.**
45. **Commit/push/deploy ?** Aucun.
46. **Dette restante ?** (a) Web/Mobile non migrés (RBAC-3/RBAC-4, volontairement hors périmètre). (b) 3 alias `STAFF_DOC`/`ROLES_DOCS`/`ROLES_PAIEMENTS` (même valeur, non nommés dans le mandat) non dédupliqués — candidat RBAC-5. (c) Incohérence de nommage `payment.status` (singulier) vs `payments.*` (pluriel) — non corrigée, aucune preuve de bug. (d) `CANCEL_ROLES` dans `paiementController.js` est désormais du code mort prouvé pour `GestionnaireImmobilier` (jamais atteint) — non supprimé, hors périmètre (mandat interdit de modifier les règles métier). (e) `requireCapabilityForStaff` (variante bypass non-staff) non auditée en détail — hors du périmètre de la route pilote choisie. (f) ~79 autres checks de rôle backend directs restent non migrés, intentionnellement (mandat §26).
47. **Verdict ?** **CERTIFIÉ VERT.** Tous les critères de sortie du mandat (§65) sont remplis : aucune nouvelle architecture IAM, `iamArchitecture.js` consolidé, mapping staff canonique documenté, alias `STAFF_IMMO`/`ROLES_ALTIMMO`/`ROLES_GL`/`ROLES_LITIGES` dédupliqués avec test anti-drift, route pilote migrée avec parité stricte prouvée, aucune permission élargie/réduite involontairement (le seul aller-retour, `payments.reverse`, a été détecté et corrigé avant la fin du sprint grâce aux tests existants), tenant/ownership/systèmes spécialisés intacts, suite unit complète (128/128, 1473/1473) et suite Mongo exhaustive (97/97, 974/974) toutes deux vertes.

## Roadmap proposée (non démarrée)

- **RBAC-3** → Web consomme les capacités backend (remplacer `client/lib/utils/staffCapabilities.js`, déjà réellement utilisé par `AdminDashboard.jsx`/`RoleDashboardOverview.jsx`, par un appel à un futur payload `/me` exposant `getEffectiveCapabilities`).
- **RBAC-4** → Mobile consomme les capacités backend (après résolution préalable de la convention de casse identifiée par RBAC-1 ; la copie mobile de `staffCapabilities.js`, déjà morte, serait le premier fichier concerné).
- **RBAC-5** → Suppression des constantes/checks legacy devenus réellement inutiles : dédoublonnage `STAFF_DOC`/`ROLES_DOCS`/`ROLES_PAIEMENTS`, nettoyage de `CANCEL_ROLES` (code mort prouvé), correction de la convention `payment.status`, investigation des rôles `User`/`Prestataire` (LEGACY DORMANT selon RBAC-1) auprès des comptes réels avant toute décision.

## STOP

Conformément au mandat : `User.role`, `Client`, `Proprietaire`, `UserBusinessProfile`, `HotelStaffAssignment`, `financialAuthorizationService`, `PlatformOperator` non supprimés ni modifiés. Aucune migration Web/Mobile complète. Aucune règle métier changée. Aucun tenant, aucun ownership modifié. Aucune migration Mongo. Aucun compte réel touché. Aucun commit/push/déploiement. RBAC-3 n'a pas été démarré automatiquement. En attente de validation utilisateur — notamment sur la confirmation finale du runner Mongo exhaustif.
