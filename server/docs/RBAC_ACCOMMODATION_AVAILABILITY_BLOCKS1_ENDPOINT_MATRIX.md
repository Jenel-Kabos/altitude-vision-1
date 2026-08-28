# RBAC-ACCOMMODATION-AVAILABILITY-BLOCKS-1 — Inventaire des endpoints

Reconstruit par lecture directe de `routes/accommodationRoutes.js` (monté à `/api/accommodations` dans `server.js:450`) — pas depuis l'historique.

| Method | Endpoint | Mounted | Auth | RBAC (avant) | Tenant | Ownership (avant) | Handler | RBAC (après) |
|---|---|---|---|---|---|---|---|---|
| GET | `/api/accommodations/:id/availability-blocks` | LIVE | `auth.protect` | **Aucune** — tout rôle authentifié | `requireTenantScopeForStaffAllowPlatformWide` (HZ-02, inchangé) | **Aucune** | `listBlocks` | **🔧 Corrigé** : `isStaff(4 rôles) \|\| owner===user.id` |
| GET | `/api/accommodations/:id/reservation-calendar` | LIVE | `auth.protect` | `isStaff(4 rôles)` (dans le contrôleur) | idem (HZ-02) | `owner===user.id` (dans le contrôleur) | `calendar` | Inchangé — déjà correct, référence canonique |
| POST | `/api/accommodations/:id/availability-blocks` | LIVE | `auth.protect` | `isStaff(4 rôles)` (dans `service.createBlock`) | idem (HZ-02) | `owner===user.id` (dans `service.createBlock`) | `createBlock` | Inchangé — déjà correct |
| DELETE | `/api/accommodations/:id/availability-blocks/:blockId` | LIVE | `auth.protect` | `isStaff(4 rôles)` (dans le contrôleur) | idem (HZ-02) | `owner===user.id` (dans le contrôleur) | `deleteBlock` | Inchangé — déjà correct |
| GET | `/api/accommodations/:id/availability` | LIVE (montée **avant** `router.use(auth.protect)`) | **Aucune (publique)** | N/A — volontairement public | N/A | N/A | `availability` | Inchangé — volontairement public, expose uniquement `unavailableDates` dérivées de `NightLock` (pas le modèle `AvailabilityBlock`), voir `_EXISTING_CONTRACT.md` |

## Total

5 endpoints LIVE inventoriés sur cette ressource. **1 corrigé** (`GET .../availability-blocks`). Les 4 autres étaient déjà conformes au contrat déjà établi par `HOTFIX-ACCOMMODATION-CALENDAR-TENANT-SCOPE-1` (HZ-02) — non modifiés.

## `isStaff` local (réutilisé, jamais réinventé)

`controllers/accommodationReservationController.js:19` : `const isStaff = (user) => ['Admin', 'Collaborateur', 'GestionnaireImmobilier', 'CommunityManager'].includes(user?.role);` — déjà utilisé par `calendar`/`createBlock`/`deleteBlock`, désormais aussi par `listBlocks`. Distinct de `ALL_STAFF` (utilisé ailleurs dans le projet, ex. Messaging) — une liste plus étroite, spécifique à ce contrôleur, déjà en production, non modifiée par ce hotfix.
