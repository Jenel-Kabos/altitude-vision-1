# TENANT-SCOPE-HORIZONTAL-FINAL-AUDIT-1 — Matrice des frontières de sécurité

| Surface | Auth | RBAC | Tenant | Ownership | Global autorisé ? | Risque |
|---|---|---|---|---|---|---|
| `GET/POST /api/accommodations/admin/*`, `/status/pending` | JWT | ROLES_ALTIMMO | `requireTenantScopeForStaffAllowPlatformWide` | N/A | PlatformOperator non-scopé (legitimé) | **Faible — HZ-04 certifié, revérifié vert (137/137 cluster)** |
| `GET /api/hotels/admin/*` | JWT | ROLES_ALTIMMO | `attachTenantScopeIfResolvable` + garde métier `hotelAccessScopeService` | Hotel.manager | PlatformOperator | **Faible — HZ-06 certifié, revérifié vert** |
| `GET /api/hotel-reservations/admin/*` | JWT | Staff hôtel | `attachTenantContext` + garde métier | Hotel lié | PlatformOperator | **Faible — HZ-05 certifié, revérifié vert** |
| `GET /api/properties/status/pending`, moderation | JWT | Staff modération | filtre `classicPropertyModerationFilter` | N/A | — | **Faible — HZ-07 certifié, revérifié vert** |
| `GET /api/accommodation-reservations/*` | JWT | Staff/Owner | garde par route | Reservation.guest / Property.owner | — | **Faible — HZ-01/HZ-03 certifiés, revérifié vert** |
| `POST /api/dev-portal/keys*`, `/keys/:id/revoke`, `/rotate` | JWT | Admin | `requireTenantScope` (fail-closed strict) | N/A | Non (toujours tenant-scopé) | **Faible — audité en détail ce sprint, filtre `{_id, status:'active', tenant}` empêche toute action cross-tenant même par ObjectId deviné** |
| `GET /api/conversations/staff-inbox` | JWT | `restrictTo(ALL_STAFF)` **seul** | **AUCUNE garde de résolution** (`attachTenantContext`, ne bloque jamais) | N/A | Non prévu, mais **de facto accessible** si tenant ambigu | **🔴 P0 — HF-FINAL-01** |
| `GET/DELETE/PATCH /api/conversations/:id*` | JWT | `restrictTo` implicite via `isStaff` dans `assertConversationAccess` | Frontière tenant **contournée** si `req.platformTenant` absent | Participant OU staff (staff seul suffit si tenant ambigu) | Non prévu, mais **de facto accessible** | **🔴 P0 — HF-FINAL-01** |
| `POST /api/messages` (chemin `conversationId`) | JWT | staff/participant | Frontière tenant **contournée** si tenant ambigu | — | Non prévu, mais **de facto possible** | **🔴 P0 — HF-FINAL-01 (écriture)** |
| `GET /api/messages/:conversationId/attachments/:id` (`downloadAttachment`) | JWT | staff+tenant exact OU participant | `staffAllowed` exige `req.platformTenant` ET correspondance exacte | Participant | Non | **Faible — vérifié CLEAN, garde correcte y compris en cas d'ambiguïté** |
| `GET /api/dashboard-analytics/*` | JWT | Staff/Direction | `requireTenantScopeForAnalytics` (fail-closed, `allowPlatformWide` pour PlatformOperator explicite) | N/A | PlatformOperator explicitement scopé | **Faible — garde router-level fail-closed confirmée par lecture** |
| `GET /api/reporting/*` | JWT | DIRECTION | `requireTenantScopeAllowPlatformWide` | N/A | PlatformOperator non-scopé légitime (reporting exécutif, cas documenté comme natif) | **Faible — comportement intentionnel et documenté (tenantContext.js:88-95)** |
| `GET /api/financial/*` | JWT | Mixte | `attachTenantScopeIfResolvable` (ne bloque jamais au niveau routeur — dépend des gardes métier internes) | Variable | — | **NON CONFIRMÉ à la même profondeur — non ré-audité ligne par ligne ce sprint (voir §Finance du rapport)** |
| Domaines listés "non ré-audités" (`transactions`, `sync`, `estimation`, `devis`, `litiges`, `signalements`, `facebook-posts`, `rental-documents`, `dossiers`, `rental-lease-lifecycle`, `rental-contract-regularization`) | JWT (majoritairement `protect` simple) | Variable | Non vérifié à la même profondeur | Non vérifié | — | **UNKNOWN — non ré-audité, ni confirmé propre ni confirmé vulnérable** |

## Légende risque

🔴 P0/P1 confirmé · **Faible** = certifié par preuve directe (HZ précédent revérifié, ou audit neuf de ce sprint) · **UNKNOWN** = non audité à une profondeur suffisante pour trancher, honnêtement déclaré non confirmé plutôt que supposé sûr.
