# SECURITY-CLOSURE-P1-WAVE-1 — Backlog figé (source de vérité)

## Écart de comptage constaté et corrigé (transparence, §7 du mandat précédent)

`SECURITY_CLOSURE_P0_WAVE1_P1_BACKLOG.md` annonce « les 9 P1 » en prose, mais son propre tableau liste **10 IDs distincts** (`RA-04, RA-06, RA-07, RA-08, RA-10, RA-11, RA-12, RA-13, RA-14, RA-15`), tous confirmés `CONFIRMED GAP` avec sévérité `P1` (ou `P1/P0 partiel` pour RA-14) dans `TENANT_SCOPE_HORIZONTAL_CLOSURE_REAUDIT1_FINDING_MATRIX.md`. C'est une erreur de comptage dans le résumé en prose du sprint précédent (10 lignes de tableau, décrites comme « 9 »), pas une invention de nouveau finding par ce sprint-ci. Conformément à la règle « ne pas inventer les 9 P1 » mais aussi à l'exigence de fidélité à la source de vérité (le tableau, pas la prose), ce sprint fige et traite les **10 findings réellement présents** dans le tableau source. Chaque lot ci-dessous cite sa ligne exacte du `FINDING_MATRIX` d'origine — aucun finding n'est ajouté au-delà de ce qui y figure déjà.

## Backlog figé (FREEZE — aucun 11ᵉ finding ne sera ajouté sans justification exceptionnelle documentée dans `_NEW_BLOCKERS.md`)

| Lot | Finding ID | Severity | Domain | Routes | Root Cause | Existing Proof |
|---|---|---|---|---|---|---|
| P1-A | RA-04 | P1 | Finance/GL | `GET /api/contrats` | Filtre sans tenant, `:id` protégé mais pas la liste | Confirmé par lecture directe |
| P1-B | RA-06 | P1 | Visites | `getAllVisites/getAllPayments/updateVisite/updatePaiementVisite/getUnreadCount` | `Visite.tenant` existe, jamais utilisé | Confirmé par 2 agents indépendants |
| P1-C | RA-07 | P1 | Litiges/Signalements | `litigeController.*`, `signalementController.*` | `filter={}` pour le staff, même en lecture unitaire | Confirmé par lecture de code |
| P1-D | RA-08 | P1 | Candidatures | `realEstateApplicationController.list/getOne/review/accept/reject/downloadAttachment` | Aucune dimension tenant | Confirmé par lecture de code |
| P1-E | RA-10 | P1 (dans ce backlog) | Accommodation | `PUT /api/accommodations/admin/:propertyId` (`updateFull`) | Aucun `assertAccommodationAccessible` | Confirmé par lecture de code |
| P1-F | RA-11 | P1 (dans ce backlog) | Property (Sprint A) | `PUT /api/admin/properties/{sales,rentals}/:id` (`updateFull`) | Ownership propriétaire OK, tenant staff absent | Confirmé par lecture de code |
| P1-G | RA-12 | P1 | Property | `POST /api/properties/:id/transition` | Aucun `assertReadAccess` | Confirmé par lecture de code |
| P1-H | RA-13 | P1 | Hotel | `hotelStaffAssignmentController` get/update/suspend/reactivate/revoke | `assignmentId` non recroisé avec `hotelId` | Confirmé par lecture de code |
| P1-I | RA-14 | P1 (lecture) / P0 partiel (mutations) | Transactions | `transactionController.*`, `paiementTransactionController.*` | Aucune awareness tenant | Confirmé par 2 agents indépendants |
| P1-J | RA-15 | P1 | Locataire/Proprietaire | `locataireController.getAll/listDossiers/getDossier` + invitations, `proprietaireController.getAll` | Listes non scopées, `:id` protégé | Confirmé par 2 agents indépendants |

**Total figé : 10 findings.**

## Regroupements appliqués (§13 : même domaine + même root cause + même boundary + même mécanisme)

- **P1-C** bundle `litigeController` et `signalementController` : même root cause (`filter={}` pour le staff), même absence totale de dimension tenant y compris en lecture unitaire, même mécanisme de correction attendu (scope par relation `Property` liée). Déjà bundlés comme un seul ID dans le re-audit source.
- **P1-F** bundle `salePropertyController.updateFull` et `rentalPropertyController.updateFull` : code dupliqué du même Sprint A, même root cause exacte (ownership Proprietaire déjà vérifié, tenant staff jamais vérifié), même modèle `Property`, même mécanisme de correction.
- **P1-I** bundle `transactionController` et `paiementTransactionController` : même modèle `Transaction`/`PaiementTransaction`, même root cause (aucune awareness tenant), même domaine fonctionnel.
- Aucun autre regroupement artificiel n'a été fait — P1-A (Contrat) et P1-J (Locataire/Proprietaire) restent séparés malgré leur proximité fonctionnelle (Gestion Locative) car ce sont des modèles et des routeurs distincts avec des `router.param` distincts.

## Hors périmètre strict de cette vague

RA-16 (Devis, à clarifier produit), RA-17 (Dashboard KPI), RA-18 (composant de RA-10, déjà couvert par le fix P1-E), RA-19 (rentalMaintenanceController.list), RA-20/RA-21 (dettes de cohérence Messaging), RA-22 (écart PO/produit) — tous P2/P3, non corrigés. HZ-08, HZ-09, errorMiddleware, dette `controller→controller`/`route→model` — statuts inchangés, non touchés.
