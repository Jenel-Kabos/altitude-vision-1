# RBAC-ACCOMMODATION-AVAILABILITY-BLOCKS-1 — Matrice RBAC après correctif

| Actor | Resource | GET | CREATE | UPDATE | DELETE | Reason |
|---|---|---|---|---|---|---|
| Unauthenticated | toute | 401 | 401 | N/A | 401 | `auth.protect`, inchangé |
| Client | non lié | **403** (corrigé) | 403 (inchangé) | N/A | 403 (inchangé) | Aucune preuve de contrat justifiant l'accès Client |
| Proprietaire (owner) | sa propre Accommodation | 200 (préservé) | 201 (inchangé) | N/A | 204 (inchangé) | Ownership prouvé (`property.owner === user.id`) |
| Proprietaire (non-owner) | Accommodation d'un tiers | **403** (corrigé) | 403 (inchangé) | N/A | 403 (inchangé) | Pas de lien d'ownership |
| Admin (tenant correct) | Accommodation de son tenant | 200 (préservé) | 201 (inchangé) | N/A | 204 (inchangé) | `isStaff` |
| Collaborateur (tenant correct) | Accommodation de son tenant | 200 (préservé) | 201 (inchangé) | N/A | 204 (inchangé) | `isStaff` |
| GestionnaireImmobilier (tenant correct) | Accommodation de son tenant | 200 (par symétrie, `isStaff`) | 201 (inchangé) | N/A | 204 (inchangé) | `isStaff` |
| CommunityManager (tenant correct) | Accommodation de son tenant | 200 (par symétrie, `isStaff`) | 201 (inchangé) | N/A | 204 (inchangé) | `isStaff` |
| Secretaire / Communicant (staff, autre périmètre) | Accommodation, même tenant | **403** (corrigé) | 403 (inchangé) | N/A | 403 (inchangé) | Hors `isStaff` local à ce contrôleur |
| Staff (tout rôle) sans tenant résolu | toute | 403 (déjà correct, HZ-02) | 403 (déjà correct) | N/A | 403 (déjà correct) | Garde routeur `requireTenantScopeForStaffAllowPlatformWide` |
| PlatformOperator (non scopé) | toute (rôle sous-jacent Admin) | 200 (préservé, `isStaff`) | 201 (inchangé) | N/A | 204 (inchangé) | Contrat HZ-02 préservé |
| PlatformOperator (scopé A) | Accommodation A | 200 (préservé) | 201 (inchangé) | N/A | 204 (inchangé) | Contrat HZ-02 préservé |

`UPDATE` : N/A — aucun endpoint `PATCH`/`PUT` sur `AccommodationAvailabilityBlock` n'existe dans le code (confirmé, `grep` sur `routes/accommodationRoutes.js`).

## Preuve de non-élargissement

Aucune case marquée "préservé"/"inchangé" n'a changé de valeur entre avant et après — confirmé par les 9 tests déjà verts avant tout correctif dans `accommodationAvailabilityBlocksRbac.mongo.integration.test.js`, restés verts après. Seules les 3 cases marquées "corrigé" ont changé, de `200` (fuite) vers `403` (refus).
