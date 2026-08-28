# TENANT-SCOPE-HORIZONTAL-FINAL-AUDIT-1 — Matrice rôles / Admin A vs B

## Admin A / Admin B — surfaces certifiées (HZ-01→HZ-07, revérifiées vertes ce sprint)

| Domaine | LIST | DETAIL | CREATE | UPDATE | STATUS/APPROVE | DELETE | Résultat |
|---|---|---|---|---|---|---|---|
| Accommodation admin/pending | ✅ isolé | ✅ isolé | — | — | ✅ isolé | — | HZ-04 — 137/137 cluster vert |
| Accommodation calendar/blocks | ✅ isolé | ✅ isolé | ✅ isolé | ✅ isolé | — | ✅ isolé | HZ-02 — vert |
| AccommodationReservation | ✅ isolé | ✅ isolé | ✅ isolé | ✅ isolé | ✅ isolé | — | HZ-01/HZ-03 — vert |
| Hotel admin lists | ✅ isolé | ✅ isolé | — | — | — | — | HZ-06 — vert |
| HotelReservation admin/pending | ✅ isolé | ✅ isolé | — | — | ✅ isolé | — | HZ-05 — vert |
| Property moderation | ✅ isolé | ✅ isolé | — | — | ✅ isolé | — | HZ-07 — vert |
| Dashboard Analytics (accommodations/hotels/etc.) | ✅ isolé | N/A | N/A | N/A | N/A | N/A | Confirmé par `dashboardAnalyticsTenantScope.mongo.integration.test.js`, vert |

## Nouvelle surface auditée ce sprint — Dev Portal (API keys)

| Action | Admin A → clé de B ? | Résultat |
|---|---|---|
| LIST (`GET /keys`) | Non — filtré par `tenant: req.platformTenant._id` | Isolé |
| REVOKE (`POST /keys/:id/revoke`) | Non — `findOne({_id, status:'active', tenant})`, 404 si l'ID appartient à un autre tenant | Isolé |
| ROTATE (`POST /keys/:id/rotate`) | Non — même garde que revoke | Isolé |
| Call logs (`GET /call-logs?apiKeyId=`) | Non — `apiKeyId` validé contre l'ensemble des clés du tenant avant usage | Isolé |
| Webhook subscriptions | Non — filtré par tenant | Isolé |

**Verdict Dev Portal : CLEAN.**

## Nouvelle surface auditée ce sprint — Messaging (conversations/messages)

| Action | Staff mono-tenant A → ressource de B | Staff **multi-tenant (A+B), sans sélection** → ressource de B |
|---|---|---|
| LIST staff-inbox | ✅ isolé (tenant résolu, filtre appliqué) | 🔴 **NON isolé — HF-FINAL-01** (les deux tenants mélangés) |
| DETAIL conversation | ✅ isolé (`assertResourceTenantOrUnattributed` rejette) | 🔴 **NON isolé — accès direct par ObjectId réussit** |
| READ messages | ✅ isolé | 🔴 **NON isolé (même mécanisme que DETAIL)** |
| MARK READ | ✅ isolé | 🔴 **NON isolé (même mécanisme)** |
| DELETE conversation | ✅ isolé | 🔴 **NON isolé — suppression réelle confirmée en test** |
| SEND message (via conversationId) | ✅ isolé | 🔴 **NON isolé — écriture cross-tenant possible** |
| Download attachment | ✅ isolé | ✅ **isolé** (garde `staffAllowed` exige tenant résolu ET exact) |
| Count unread (`/count/unread`) | ✅ isolé | ✅ **isolé** (403 fail-closed, `requireTenantScopeForStaffOrPlatformOperator`) |

La colonne de droite est le cœur de HF-FINAL-01 : l'isolation Admin A/B **existe et fonctionne** dès qu'un tenant est résolu — la faille est spécifiquement le cas où le staff a une appartenance multi-tenant et n'en sélectionne aucun.

## PlatformOperator

- **Global (non scopé)** : confirmé légitime et documenté pour Reporting exécutif (`requireTenantScopeAllowPlatformWide`) et Dashboard Analytics (`requireTenantScopeForAnalytics`) — portée globale explicitement voulue, pas un contournement.
- **Scopé A** : `resolvePlatformOperatorTenantContext` résout le tenant demandé par ID seul (sans filtre de statut/appartenance, cas voulu pour administrer un tenant suspendu) — comportement inchangé, non retouché, cohérent avec PLATFORM_ADMIN_1_AUDIT.md déjà cité en commentaire source.
- **Aucun endpoint trouvé traitant PlatformOperator comme un Admin ordinaire sans distinction** dans les surfaces auditées ce sprint (Dev Portal, Messaging, Analytics, Reporting).

## Ownership (hors tenant)

- `Property.owner`, `Accommodation`/`createdBy`, `Hotel.manager` : déjà couverts par HZ-01→HZ-07, non re-remis en cause.
- `Conversation.participants` : c'est précisément le mécanisme d'ownership qui protège `getConversations`/`getMyInbox` même quand le filtre tenant est neutralisé — confirmé fonctionnel (ces deux endpoints restent sûrs même en cas d'ambiguïté tenant, car bornés indépendamment par `participants: req.user.id`). C'est `getStaffInbox` (délibérément sans borne participant, "boîte partagée") qui n'a **aucun** filet de sécurité de repli quand le tenant est absent.
