# RBAC-ACCOMMODATION-AVAILABILITY-BLOCKS-1 — Non-régression

## Fichiers de production modifiés (1)

- `server/controllers/accommodationReservationController.js` — ajout d'une seule vérification (`isStaff(req.user) || String(accommodation.property?.owner) === String(req.user.id)`) dans `listBlocks`, identique à celle déjà utilisée par `calendar`/`deleteBlock` dans le même fichier. **Aucune autre fonction modifiée.**

Aucun autre fichier de production touché — ni route, ni modèle, ni service (le service `createBlock` n'a pas été modifié, il avait déjà la bonne garde), ni frontend, ni mobile.

## Findings explicitement non touchés (confirmé par `git status`)

- `messageController.getMessages` — non modifié.
- `errorMiddleware.js` — non modifié.
- HZ-08 (`assertResourceTenantOrUnattributed`, ressources legacy) — non modifié.
- HZ-09 (`resolveTenantForUser`) — non modifié.
- `routes/conversationRoutes.js`, `routes/messageRoutes.js` (HF-FINAL-01) — non touchés, revérifiés verts (24/24).

## Preuves de non-régression

| Suite | Résultat |
|---|---|
| `accommodationAvailabilityBlocksRbac.mongo.integration.test.js` (nouvelle, permanente) | 12/12 PASS |
| `accommodationCalendarTenantScope.mongo.integration.test.js` (HZ-02, existante) | 15/15 PASS, sans adaptation |
| Accommodation ciblé (11 fichiers : calendar, admin, created-visibility, reservation, reservation-tenant, public-detail, reservation-list, financial-documents, mobile-publication ×2) | 11 suites / 146 tests — PASS |
| Cluster HZ-01→HZ-07 + HF-FINAL-01 (9 fichiers) | 9 suites / 161 tests — PASS (137 HZ + 24 Messaging) |
| Backend complet (`npm run test:unit`) | 141 suites / 1579 tests — PASS, identique |
| Architecture (`npm run architecture:check`) | Identique avant/après — 472 fichiers, 1531 edges, 0 cycle, 0 unresolved, PASS |
| Lint | 0 erreur, 108 warnings pré-existants, aucun nouveau, aucun sur les fichiers modifiés |
| `git diff --check` | Propre sur les fichiers de ce mandat |

## Frontend / Mobile / Schéma

- Frontend : non modifié. Payload `GET .../availability-blocks` strictement identique pour tout acteur toujours autorisé (voir `_SIDE_EFFECT_MATRIX.md`) — aucune adaptation de `AccommodationReservationsPanel.jsx` nécessaire.
- Mobile : non modifié (aucun consommateur trouvé).
- Schéma/migration : aucun changement.
