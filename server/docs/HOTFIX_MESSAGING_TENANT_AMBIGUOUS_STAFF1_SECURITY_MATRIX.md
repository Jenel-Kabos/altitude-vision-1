# HOTFIX-MESSAGING-TENANT-AMBIGUOUS-STAFF-1 — Matrice de sécurité

| Acteur | LIST | DETAIL (même tenant) | DETAIL (autre tenant) | DELETE (même tenant) | DELETE (autre tenant) | SEND (même tenant) | SEND (autre tenant) | Statut |
|---|---|---|---|---|---|---|---|---|
| Staff mono-tenant A | A uniquement | 200 | 500* | Historique (200) | 500* | Historique (201) | 500* | ✅ Vert |
| Staff mono-tenant B | B uniquement | 200 | 500* | Historique | 500* | Historique | 500* | ✅ Vert |
| Staff multi (A+B), **sans en-tête** | **403** | **403** | **403** | **403**, DB intacte | **403**, DB intacte | **403**, aucun message | **403**, aucun message | ✅ Vert (corrigé) |
| Staff multi + en-tête A | A uniquement | 200 (A) | 500*/403 selon B | Historique sur A | refusé sur B | Historique sur A | refusé sur B | ✅ Vert |
| Staff multi + en-tête B | B uniquement | (symétrique) | | | | | | ✅ Vert |
| Staff multi + en-tête invalide (tenant C, aucune adhésion) | **403** | **403** | **403** | **403** | **403** | **403** | **403** | ✅ Vert |
| Staff **sans aucune adhésion** | **403** | **403** | **403** | **403** | **403** | **403** | **403** | ✅ Vert (corrigé — même précondition que multi-tenant : tenant non résolu) |
| PlatformOperator global (aucune sélection) | **403** | **403** | **403** | **403** | **403** | **403** | **403** | ✅ Vert (corrigé — aligné sur `/count/unread`, messaging n'a jamais eu de mode plateforme natif) |
| PlatformOperator scopé A | A uniquement | 200 (A) | refusé (B) | Historique sur A | refusé sur B | Historique sur A | refusé sur B | ✅ Vert |
| PlatformOperator scopé B | B uniquement | (symétrique) | | | | | | ✅ Vert |
| Client (participant conversation A) | N/A (`my-inbox`/`/`) | 200 sur sa conversation | N/A (pas de tenant, isolation par participant uniquement) | Historique sur sa conversation | N/A | Historique | N/A | ✅ Vert, **inchangé** |
| Proprietaire | Idem Client | | | | | | | ✅ Vert, **inchangé** |

`*` = comportement pré-existant hors périmètre (500 au lieu de 404 attendu, défaut de sérialisation d'erreur `errorMiddleware.js`, voir `_ROOT_CAUSE.md`) — le refus lui-même est réel et confirmé, aucune fuite cross-tenant dans ces cas.

## Verdict

Toutes les cases auparavant marquées "🔴 fuite confirmée" (staff multi/sans adhésion/PlatformOperator non scopé, colonnes LIST/DETAIL/DELETE/SEND) sont désormais **403, zéro effet de bord**, prouvé par tests Mongo réels. Aucune case précédemment verte n'est devenue rouge.
