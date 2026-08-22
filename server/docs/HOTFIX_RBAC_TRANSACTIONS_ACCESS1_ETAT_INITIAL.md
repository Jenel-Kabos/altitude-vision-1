# HOTFIX-RBAC-TRANSACTIONS-ACCESS-1 — ÉTAT INITIAL

Branche : `main`. HEAD au démarrage : `63880f58ff41bd805b828d07603d878d55122d45` (inchangé depuis le début de la séquence RBAC — aucun commit créé, tout le travail reste en working tree).

`git diff --stat` : 26 fichiers modifiés (+633/-205), cumul RBAC-2→RBAC-5 + HOTFIX-AUTH-POSTLOGIN-ROUTING-1 + HOTFIX-RBAC-GESTION-LOCATIVE-ACCESS-1, aucun commit intermédiaire.

`git diff --check` : exit 0.

`git status --short` : 91 lignes. Tout préservé, rien écrasé.

## Baseline héritée (ne pas rouvrir)

Séquence RBAC-1→RBAC-5 terminée et certifiée. `HOTFIX-AUTH-POSTLOGIN-ROUTING-1` et `HOTFIX-RBAC-GESTION-LOCATIVE-ACCESS-1` certifiés verts. Architecture à préserver : `User.role` → `iamArchitecture.js` → `getEffectiveCapabilities()` → payload auth → `can(capability)` Web/Mobile. Tenant, ownership, `businessProfiles`, `HotelStaffAssignment`, `financialAuthorizationService`, `PlatformOperator` restent des systèmes spécialisés distincts.

RBAC-3 (`RBAC3_SECURITY_MATRIX.md`) avait caractérisé, sans corriger :
`TransactionsPage.jsx` — `const isAdmin = ['Admin', 'Collaborateur'].includes(user?.role);` (ligne ~331 au moment de RBAC-3) exclut `GestionnaireImmobilier`, alors que toutes les routes réellement appelées (`GET /transactions`, `finalize`, `cancel`, etc.) utilisent `restrictTo(...STAFF_DOC)` = `['Admin','Secretaire','Collaborateur']` côté backend — RBAC-3 avait qualifié cette divergence de **cosmétique** (le backend exclut déjà `GestionnaireImmobilier` indépendamment sur toutes les routes observées à l'époque, donc pas de risque de sécurité), mais avait aussi noté en aparté un mismatch inverse : le bouton de validation de virement est visible à `Collaborateur` (gated par la même variable `isAdmin`) alors que la route réelle `PATCH /:txId/paiements/:pId/valider` est `adminOnly` (Admin seul) — UX trompeuse sans risque, non corrigée. RBAC-5 a re-confirmé ces deux constats sans les corriger, faute de contrat produit validé, et a recommandé ce hotfix.

Conformément au principe établi par `HOTFIX-RBAC-GESTION-LOCATIVE-ACCESS-1` (un seul flag frontend peut cacher plusieurs contrats backend distincts), ce hotfix va caractériser **chaque action** de `TransactionsPage.jsx` séparément, sans supposer que la seule variable `isAdmin` déjà notée par RBAC-3 est la totalité du problème.

## Périmètre de ce hotfix

Déterminer le contrat métier réel de chaque action de `TransactionsPage.jsx` (lecture, complétion, validation, statut, commission, payout, document, paiement, annulation) et aligner frontend/backend/capability sur ce contrat prouvé — sans élargissement silencieux, sans nouvelle capability sauf preuve stricte, sans toucher tenant/ownership/PlatformOperator/businessProfiles/financialAuthorizationService/Google auth/routing post-login/mobile/Gestion Locative/Hôtel/Inbox.

Aucune modification effectuée avant ce document. Aucun commit/push/déploiement.
