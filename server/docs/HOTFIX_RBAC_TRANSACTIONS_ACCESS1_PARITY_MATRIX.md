# HOTFIX-RBAC-TRANSACTIONS-ACCESS-1 — MATRICE DE PARITÉ (APRÈS CORRECTION)

| Role | Menu | Page read | Finaliser/Annuler | Valider/rejeter virement | Tenant | Verdict |
|---|---|---|---|---|---|---|
| Admin | N/A (aucune entrée de menu, lien direct uniquement) | ALLOWED (liste complète + stats) | ALLOWED | ALLOWED | N/A (non tenant-scoped) | **PARITÉ** |
| Collaborateur | N/A | ALLOWED (liste complète + stats) | ALLOWED | **DENIED (corrigé)** | N/A | **PARITÉ** |
| Secretaire | N/A | **ALLOWED (corrigé — liste complète + stats)** | **ALLOWED (corrigé)** | DENIED | N/A | **PARITÉ** |
| GestionnaireImmobilier | N/A | DENIED (liste complète) — bascule sur "Mes transactions" (vide, voir dette) | DENIED | DENIED | N/A | **PARITÉ FONCTIONNELLE** — aucune fuite, UX dead-end documentée |
| CommunityManager | N/A | Idem GestionnaireImmobilier | DENIED | DENIED | N/A | **PARITÉ FONCTIONNELLE**, même dette |
| Communicant | N/A | Idem | DENIED | DENIED | N/A | **PARITÉ FONCTIONNELLE**, même dette |
| Proprietaire/Client | N/A (hors `ALLOWED_ROLES` du dashboard) | N/A | N/A | N/A | N/A | **PARITÉ** (inchangé) |

## Preuve de non-régression sur ce qui était déjà correct

- Lecture ciblée par ID (détail/paiements/justificatif) : comportement backend `isOwner || isStaff` déjà correct, aucun gate frontend ajouté ou retiré — testé implicitement (aucun test n'a dû changer sur ce point).
- `GestionnaireImmobilier`/`CommunityManager`/`Communicant` exclus de la lecture liste/stats et de finaliser/annuler : comportement **strictement identique** avant/après (c'est l'exclusion que RBAC-3 avait déjà qualifiée de correcte pour `GestionnaireImmobilier` — confirmée, non touchée).
- `payments.reverse`/Gestion Locative/Financial Core/tenant/PlatformOperator : non concernés, non modifiés, régression vérifiée sur `payments.reverse` (35/35 tests verts, voir `HOTFIX_RBAC_TRANSACTIONS_ACCESS1_SECURITY_MATRIX.md`).
