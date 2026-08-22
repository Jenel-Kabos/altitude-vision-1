# RBAC-5 — AUTHORIZATION LEGACY CLEANUP & ANTI-DRIFT

**Verdict : RBAC-5 : CERTIFIÉ VERT.**

Les deux vraies duplications de mapping rôle→capacités (`staffCapabilities.js` Web et Mobile) sont **supprimées**, prouvées mortes en production avant suppression, avec leur couverture de test préservée (migrée vers une fixture locale pour le Web) ou retirée avec le code qu'elle testait exclusivement (Mobile). Un second groupe de duplication déjà identifié par RBAC-2 mais laissé hors périmètre (`STAFF_DOC`/`ROLES_PAIEMENTS`/`ROLES_DOCS`) a été déduplique selon le même patron que RBAC-2, avec un verrou anti-drift dédié. Aucune permission métier n'a changé : aucune capacité ajoutée ou supprimée, `payments.reverse` intact, aucun check `restrictTo` converti mécaniquement, aucune identité métier externe touchée, aucun système spécialisé modifié. Les divergences et le drift déjà caractérisés par RBAC-3/RBAC-4 restent volontairement non corrigés.

## Réponses aux 70 questions du mandat

1. **`staffCapabilities` Web était-il réellement mort ?** Oui — grep exhaustif (imports directs, dynamiques, barrels) : zéro consommateur de production, seulement 2 références de test.
2. **A-t-il été supprimé ?** Oui.
3. **Quels consumers avaient déjà migré ?** `AdminDashboard.jsx` et `RoleDashboardOverview.jsx`, migrés en RBAC-3 vers `can()`.
4. **`staffCapabilities` Mobile était-il réellement mort ?** Oui — re-prouvé (RBAC-4 l'avait déjà établi, re-vérifié ici par un grep exhaustif indépendant) : zéro consommateur de production, une mention en commentaire non fonctionnelle, un seul test.
5. **A-t-il été supprimé ?** Oui.
6. **Son ancien test a-t-il été supprimé/remplacé ?** Supprimé (Web et Mobile) — il ne testait que le mapping lui-même, aucune couverture comportementale d'écran perdue. Le seul test qui utilisait `staffCapabilities.js` Web comme *donnée de fixture* pour tester un autre module (`dashboardProfiles.test.js`) a été migré vers une fixture locale inline, jamais supprimé.
7. **Existe-t-il encore un mapping role→capabilities dans `client/` ?** Non.
8. **Dans mobile ?** Non.
9. **Dans backend hors source canonique ?** Non — `iamArchitecture.js` reste l'unique source ; les alias de rôles (`STAFF_IMMO`, `STAFF_DOC`, etc.) sont des listes de rôles pour `restrictTo`, pas un second mapping capacité.
10. **Combien de role checks Web restent ?** ~14 fichiers avec des patterns représentatifs recensés (hors les deux déjà migrés et les deux déjà caractérisés RBAC-3) — voir `RBAC5_ROLE_CHECK_CLASSIFICATION.md`.
11. **Combien sont AUTHORIZATION ?** ~9 patterns/fichiers distincts (`isStaffImmo`, `isStaffDocs`, listes de rôles locales dans des pages de gestion Altcom/Events/Accommodations/Properties).
12. **Combien BUSINESS_IDENTITY ?** 1 (`ManageHotelsPage.jsx`, libellé/scope de formulaire selon Proprietaire).
13. **Combien PRESENTATION ?** 1 sous-ensemble (`DashboardHome.jsx`, mélangé avec de l'autorisation, non démêlé).
14. **Combien ROUTING ?** 1 (`HistoriquePage.jsx`, redirection non-admin).
15. **Combien OWNERSHIP ?** 0 recensé côté Web dans cet échantillon (l'ownership Web est généralement déléguée au backend, pas re-vérifiée en frontend).
16. **Combien TENANT ?** 0 recensé côté Web.
17. **Combien resource-scoped ?** 0 recensé côté Web (le scope hôtel/tenant reste une préoccupation backend).
18. **Combien réellement morts ?** 2 fichiers entiers (les deux `staffCapabilities.js`), supprimés. Aucun check de rôle individuel supplémentaire prouvé mort côté Web/Mobile au-delà de ces deux fichiers.
19. **Combien ont été migrés ?** 0 nouveau check migré dans ce sprint (les 2 migrations Web datent de RBAC-3) — RBAC-5 a supprimé du code mort et déduplique une donnée, mais n'a converti aucun `restrictTo`/check de rôle supplémentaire.
20. **Combien de backend `restrictTo` restent ?** ~118 sites (+ ~23 checks inline `req.user.role === 'X'`).
21. **Pourquoi ?** Mandat §26-28 : conversion mécanique interdite ; chaque migration exige capacité déjà existante + sens exact correspondant + parité prouvée + tenant/ownership intacts + tests de caractérisation — un travail par route, pas un sprint de masse.
22. **Des routes supplémentaires ont-elles été migrées ?** Non — la seule route capacité-gated pilote reste `POST /property-asset/:id/transition` (RBAC-2).
23. **Parité exacte prouvée ?** Oui, là où une modification a eu lieu (dédup `CANONICAL_DOC_STAFF_ROLES`) : `.includes()`/spread insensibles à l'ordre, aucun test n'affirmant un ordre précis, 128/128 + 7/7 suites Mongo ciblées vertes.
24. **Une capability a-t-elle été ajoutée ?** Non.
25. **Supprimée ?** Non — y compris les 8 capacités déclarées mais non consommées par aucun point d'application (`clients.read`, `owners.read`, `properties.create`, `occupancy.read`, `media.read`, `media.manage`, `messages.read`, `messages.manage`), volontairement conservées car leur déclaration constitue le contrat du rôle, pas du code mort (voir `RBAC5_CAPABILITY_USAGE_MATRIX.md`).
26. **Pourquoi ?** RBAC-5 n'est ni un sprint d'expansion ni de rétraction du modèle IAM (mandat §28, §76).
27. **`payments.reverse` intact ?** Oui — `ADMIN_ONLY_CAPABILITIES`, route `paiementRoutes.js`, non modifiés.
28. **GestionnaireImmobilier toujours refusé sur reversal ?** Oui — `requireCapability('payments.reverse')` continue de l'exclure (pas dans ses capacités déclarées) ; `CANCEL_ROLES` interne conservé tel quel (défense en profondeur documentée, non modifiée).
29. **`assertKnownCapability` intact ?** Oui, fichier non modifié, `iamArchitecture.test.js` (128/128 unit) toujours vert.
30. **`CANONICAL_IMMO_STAFF_ROLES` intact ?** Oui, non modifié.
31. **Aliases conservés ou supprimés ?** Conservés — `STAFF_IMMO`/`ROLES_ALTIMMO`/`ROLES_GL`/`ROLES_LITIGES` (RBAC-2, re-vérifiés) et `STAFF_DOC`/`ROLES_PAIEMENTS`/`ROLES_DOCS` (dédupliqués en RBAC-5, noms conservés).
32. **Pourquoi ?** Chaque nom exprime une sémantique de domaine distincte et a des consommateurs actifs dans des fichiers différents (mandat §29) — supprimer un nom pour réduire des lignes est explicitement interdit.
33. **Client intact ?** Oui — aucun check `role === 'Client'` supprimé ou modifié.
34. **Proprietaire intact ?** Oui — idem, y compris `canAdd` mobile, les checks `isProprietaire` Web/Mobile, `ManageHotelsPage.jsx`.
35. **BusinessProfiles intacts ?** Oui — `UserBusinessProfile.js`, `userBusinessProfileService.js`, `businessProfileConstants.js` non modifiés.
36. **Mes biens mobile intact ?** Oui — `ProfilScreen.jsx` non modifié.
37. **`canAdd` intact ?** Oui — non migré, conservé tel quel (mandat §38).
38. **`GestionLocativePage` divergence intacte/corrigée ?** Intacte — non corrigée.
39. **Pourquoi ?** Contrat produit ambigu (RBAC-3), aucune validation supplémentaire obtenue dans ce sprint ; mandat §35 interdit la correction sans preuve de contrat.
40. **`TransactionsPage` divergence intacte/corrigée ?** Intacte — non corrigée.
41. **Pourquoi ?** Même raison (mandat §36) ; de plus cosmétique côté sécurité (backend exclut déjà GestionnaireImmobilier indépendamment, RBAC-3).
42. **Post-login Proprietaire untouched ?** Oui — aucun fichier de résolution de redirection touché ; recommandation `HOTFIX-AUTH-POSTLOGIN-ROUTING-1` maintenue, non exécutée.
43. **Tenant intact ?** Oui — aucun fichier tenant modifié.
44. **Ownership intact ?** Oui — aucun fichier d'ownership modifié.
45. **HotelStaffAssignment intact ?** Oui — non modifié.
46. **financialAuthorizationService intact ?** Oui — non modifié.
47. **PlatformOperator intact ?** Oui — non modifié.
48. **Web `can()` intact ?** Oui — `client/lib/context/AuthContext.jsx` non modifié par RBAC-5 (seules ses dépendances mortes voisines ont été retirées).
49. **Mobile `can()` intact ?** Oui — `altimmo-app/src/context/AuthContext.jsx` non modifié sur le helper `can` lui-même (seul un commentaire dans un fichier tiers, `HotelHousekeepingScreen.jsx`, a été reformulé).
50. **Auth payload capabilities intact ?** Oui — `authController.js`, `userController.js` non modifiés par RBAC-5.
51. **Google Web intact ?** Oui — `route.js` non modifié.
52. **Google Mobile intact ?** Oui — `googleSignIn.js`, `AuthContext.loginWithGoogle` non modifiés.
53. **Tests ciblés ?** Oui — `rolesAliasParity.test.js` (6/6), 7 suites Mongo document/paiement/GL ciblées (63/63 tests).
54. **Server complet ?** Oui — 128/128 suites, 1476/1476 tests.
55. **Mongo ?** Suites ciblées vertes (voir Q53) ; suite Mongo exhaustive non rejouée intégralement (aucun fichier backend touché en dehors du groupe documents/paiements/GL, déjà couvert par les suites ciblées) — recommandé par prudence avant tout déploiement, comme en RBAC-3.
56. **Client complet ?** Oui — 94/94 fichiers, 651/651 tests.
57. **Mobile complet ?** Oui — 48/48 suites, 422/422 tests.
58. **Lints ?** Serveur 0 erreur (106 warnings, baseline inchangée) ; Client 0 erreur (267 warnings, baseline inchangée) ; Mobile 0 erreur (111 warnings, baseline inchangée).
59. **Types ?** Mobile `tsc --noEmit` : 0 erreur.
60. **Next build ?** Vert (`npm run build:next`).
61. **Expo export ?** Vert (`npx expo export --platform android`).
62. **`git diff --check` ?** exit 0.
63. **Fichiers supprimés ?** 4 — `client/lib/utils/staffCapabilities.js`, `client/lib/__tests__/staffCapabilities.test.js`, `altimmo-app/src/utils/staffCapabilities.js`, `altimmo-app/src/utils/__tests__/staffCapabilities.test.js`.
64. **Fichiers modifiés ?** 24 au total pour la séquence RBAC-2→5 cumulée ; RBAC-5 spécifiquement : `altimmo-app/src/context/AuthContext.jsx` (RBAC-4, non retouché ce sprint), `altimmo-app/src/screens/Hotels/HotelHousekeepingScreen.jsx`, `client/lib/__tests__/dashboardProfiles.test.js`, `client/lib/__tests__/AdminDashboardDomains.test.jsx`/`DashboardResponsiveNavigation.test.jsx` (RBAC-4, non retouchés ce sprint), `server/utils/roles.js`, `server/__tests__/rolesAliasParity.test.js`. Créés : 7 documents `server/docs/RBAC5_*.md`.
65. **Lignes supprimées ?** ~184 lignes (24 fichiers cumulés RBAC-2→5) dont 84 lignes issues des 4 fichiers supprimés par RBAC-5 ; non utilisé comme indicateur de succès (mandat §67).
66. **Commit ?** Aucun.
67. **Push ?** Aucun.
68. **Deploy ?** Aucun.
69. **Dette RBAC restante ?** Voir section dédiée ci-dessous.
70. **Verdict final ?** **CERTIFIÉ VERT.**

## Dette RBAC restante (documentée, non exécutée)

- ~118 `restrictTo(...)` backend + ~23 checks inline, classifiés mais non convertis (`RBAC5_ROLE_CHECK_CLASSIFICATION.md`).
- ~9 patterns `AUTHORIZATION_STAFF` Web non migrés (`isStaffImmo`, `isStaffDocs`, listes de rôles locales dans des pages de gestion non pilotes).
- `canAdd` mobile — candidat nécessitant une décision produit avant conversion.
- `GestionLocativePage.jsx`/`TransactionsPage.jsx` — divergences caractérisées, non corrigées.
- Résolveurs de redirection post-login Proprietaire — drift UX indépendant, hors RBAC.
- 8 capacités déclarées mais non consommées par aucun point d'application — contrat du rôle à clarifier produit, pas un bug.
- `CANCEL_ROLES`/`payment.status` — incohérences mineures déjà notées RBAC-2, non corrigées faute de preuve de bug.
- Suite Mongo exhaustive non rejouée intégralement dans ce sprint (suites ciblées suffisantes au périmètre modifié).

## SUPPRIMÉ / MIGRÉ / CONSERVÉ VOLONTAIREMENT / HORS SCOPE

- **SUPPRIMÉ** : `staffCapabilities.js` Web + test, `staffCapabilities.js` Mobile + test.
- **MIGRÉ** : import de `dashboardProfiles.test.js` (vers fixture locale) ; `STAFF_DOC`/`ROLES_PAIEMENTS`/`ROLES_DOCS` (vers alias de `CANONICAL_DOC_STAFF_ROLES`).
- **CONSERVÉ VOLONTAIREMENT** : tous les alias de rôles restants, `CANCEL_ROLES`, `payment.status`, les 8 capacités non consommées, ~118 `restrictTo`, ~9 patterns Web `AUTHORIZATION_STAFF`, `canAdd` mobile.
- **HORS SCOPE** : `GestionLocativePage.jsx`/`TransactionsPage.jsx` (recommandations `HOTFIX-RBAC-GESTION-LOCATIVE-ACCESS-1`/`HOTFIX-RBAC-TRANSACTIONS-ACCESS-1` à valider séparément), redirection post-login Proprietaire (`HOTFIX-AUTH-POSTLOGIN-ROUTING-1`).

## Séquence RBAC — statut

RBAC-1 (AUDIT CERTIFIÉ) → RBAC-2 (CERTIFIÉ VERT) → RBAC-3 (CERTIFIÉ VERT) → RBAC-4 (CERTIFIÉ VERT, réserve device) → **RBAC-5 (CERTIFIÉ VERT)**. Conformément au mandat §77, cette séquence est considérée **TERMINÉE** — aucun RBAC-6 n'est proposé automatiquement.

## Anomalies métier restantes méritant des hotfixes indépendants (évaluées, non exécutées)

1. **`HOTFIX-AUTH-POSTLOGIN-ROUTING-1`** — unifier les deux résolveurs de redirection post-login Proprietaire (`postAuthDestination.js`/`resolveOwnerDestination` vs `google-redirect/page.jsx` hardcodé).
2. **`HOTFIX-RBAC-GESTION-LOCATIVE-ACCESS-1`** (candidat, à valider) — clarifier si `Collaborateur` doit avoir accès à l'édition/suppression de biens gérés et à la création de mandat sur `GestionLocativePage.jsx`, actuellement bloqué côté UI alors que le backend l'autoriserait.
3. **`HOTFIX-RBAC-TRANSACTIONS-ACCESS-1`** (candidat, à valider) — clarifier si `GestionnaireImmobilier` doit avoir accès à `TransactionsPage.jsx`, actuellement exclu des deux côtés (cosmétique, pas un risque de sécurité, mais un écart d'expérience potentiellement non voulu).

## STOP

Conformément au mandat : aucune permission métier modifiée, aucun rôle supprimé, `Client`/`Proprietaire`/`UserBusinessProfile` intacts, tenant/ownership/HotelStaffAssignment/financialAuthorizationService/PlatformOperator intacts, `payments.reverse` intact, `can()` Web et Mobile intacts, payload `capabilities` intact, tests/lints/builds pertinents verts, `git diff --check` vert. Aucun commit/push/déploiement. La séquence RBAC-1→RBAC-5 est terminée. En attente de validation utilisateur.
