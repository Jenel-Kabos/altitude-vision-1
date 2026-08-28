# SECURITY-CLOSURE-P0-WAVE-1 — Backlog P1 (repris tel quel, non corrigé)

Conformément au mandat (§30) : les 9 P1 confirmés par `TENANT-SCOPE-HORIZONTAL-CLOSURE-REAUDIT-1` restent ouverts. Aucune nouvelle investigation générale n'a été menée. Liste reprise depuis `TENANT_SCOPE_HORIZONTAL_CLOSURE_REAUDIT1_FINDING_MATRIX.md`/`_DECISION.md` :

| ID | Surface | Sévérité |
|---|---|---|
| RA-04 | `GET /api/contrats` (liste) | P1 |
| RA-06 | `visiteController.*` (staff, tenant jamais utilisé) | P1 |
| RA-07 | `litigeController.*`, `signalementController.*` | P1 |
| RA-08 | `realEstateApplicationController.*` | P1 |
| RA-10 | `accommodationController.updateFull` | P1 |
| RA-11 | `salePropertyController.updateFull`/`rentalPropertyController.updateFull` (staff) | P1 |
| RA-12 | `propertyAssetController.transition` | P1 |
| RA-13 | `hotelStaffAssignmentController` (assignment non recroisé avec hotelId) | P1 |
| RA-14 | `transactionController.*`/`paiementTransactionController.*` | P1 (P0 partiel pour les mutations finalize/cancel/validerVirement) |
| RA-15 | `locataireController.getAll`/`proprietaireController.getAll` (listes) | P1 |

Findings P2/P3 également non touchés : RA-16 (Devis, à clarifier produit), RA-17 (Dashboard KPI globaux), RA-18 (composant de RA-10), RA-19 (rentalMaintenanceController.list), RA-20/RA-21 (dettes de cohérence Messaging), RA-22 (écart hypothèse PO/produit). Dettes historiques HZ-08/HZ-09/errorMiddleware/controller→controller : statuts inchangés (voir `_GATE_MATRIX.md`).

## Prochaine étape recommandée

`SECURITY-CLOSURE-P1-WAVE-1`, pour traiter ces 9 P1 dans une vague contrôlée équivalente, suivant la même trajectoire que ce sprint (RED → fix minimal → tests ciblés par lot → gates lourds une seule fois à la fin).
