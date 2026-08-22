# HOTFIX-RBAC-GESTION-LOCATIVE-ACCESS-1 — ÉTAT INITIAL

Branche : `main`. HEAD au démarrage : `63880f58ff41bd805b828d07603d878d55122d45` (inchangé depuis le début de la séquence RBAC — aucun commit créé, tout le travail reste en working tree).

`git diff --stat` : 25 fichiers modifiés (+609/-195), cumul RBAC-2→RBAC-5 + HOTFIX-AUTH-POSTLOGIN-ROUTING-1, aucun commit intermédiaire.

`git diff --check` : exit 0.

`git status --short` : 83 lignes (25 modifiés/supprimés + fichiers non suivis des sprints précédents). Tout préservé, rien écrasé.

## Baseline héritée (ne pas rouvrir)

Séquence RBAC-1→RBAC-5 terminée et certifiée. `HOTFIX-AUTH-POSTLOGIN-ROUTING-1` certifié vert. Architecture à préserver : `User.role` → `iamArchitecture.js` → `getEffectiveCapabilities()` → payload auth → `can(capability)` Web/Mobile. Tenant, ownership, `UserBusinessProfile`, `HotelStaffAssignment`, `financialAuthorizationService`, `PlatformOperator` restent des systèmes spécialisés distincts.

RBAC-3 (`RBAC3_SECURITY_MATRIX.md`) avait caractérisé, sans corriger :
`GestionLocativePage.jsx` — `canManage = isAdmin || user?.role === 'GestionnaireImmobilier'` (lignes 1308, 1737) exclut `Collaborateur`, alors que le backend (`STAFF_IMMO`/`rental.manage`, qui incluent `Collaborateur` via son joker `legacy.full`) autoriserait ce rôle sur l'édition/suppression de biens gérés et la création/mise à jour de mandat. RBAC-3 avait qualifié cet écart de **réel** (pas cosmétique) pour ces actions spécifiquement, tout en notant que la désactivation de mandat (`POST /rental-management/:id/deactivate`, `restrictTo('Admin','GestionnaireImmobilier')`) était elle cohérente avec le frontend (Collaborateur exclu des deux côtés). RBAC-5 (`RBAC5_CLEANUP_MATRIX.md`) a re-confirmé cette caractérisation sans la corriger, faute de contrat produit validé, et a recommandé ce hotfix.

## Périmètre de ce hotfix

Déterminer le contrat métier réel de qui doit accéder à la Gestion Locative (menu, page, chaque famille d'endpoints du workflow), puis aligner frontend/backend sur ce contrat prouvé — sans élargissement silencieux, sans nouvelle capability sauf preuve stricte de nécessité, sans toucher tenant/ownership/PlatformOperator/businessProfiles/Google auth/routing post-login/mobile/Financial Core/Inbox/Hôtel.

Aucune modification effectuée avant ce document. Aucun commit/push/déploiement.
