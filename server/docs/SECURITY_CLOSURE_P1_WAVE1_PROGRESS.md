# SECURITY-CLOSURE-P1-WAVE-1 — Progression

| Finding | Red | Fix | Targeted | Side Effects | Status |
|---|---|---|---|---|---|
| P1-A (RA-04) | 2/3 échoués | `contratController.getAll` scopé via Property.owner→membership | 3/3 PASS | Vérifié (liste filtrée) | **CLOSED** |
| P1-J (RA-15) | 6/6 échoués | `locataireController`/`proprietaireController` listes scopées + garde `:id/dossier` ajouté | 6/6 PASS | Vérifié | **CLOSED** |
| P1-B (RA-06) | 6/7 échoués | `visiteController` scopé via Property.owner→membership | 7/7 PASS | Vérifié | **CLOSED** |
| P1-C (RA-07) | 7/8 échoués | `litigeController`/`signalementController` scopés via bienConcerné/property | 8/8 PASS | Vérifié | **CLOSED** |
| P1-D (RA-08) | 5/6 échoués | `realEstateApplicationController` : vérification tenant si accès via statut staff uniquement | 6/6 PASS | Vérifié (bug pré-existant sans rapport découvert et documenté, non corrigé) | **CLOSED** |
| P1-E (RA-10) | 1/2 échoué | `accommodationController.updateFull` : ajout `assertAccommodationAccessible` | 2/2 PASS | Vérifié | **CLOSED** |
| P1-F (RA-11) | 2/5 échoués | `salePropertyController`/`rentalPropertyController` : ajout garde tenant staff | 5/5 PASS | Vérifié | **CLOSED** |
| P1-G (RA-12) | 1/3 échoué | `propertyAssetController.transition` : ajout garde tenant (pas rôle, déjà couvert par la route) | 3/3 PASS | Vérifié | **CLOSED** |
| P1-H (RA-13) | 3/4 échoués | `hotelStaffAssignmentController` : ajout `assertAssignmentBelongsToHotel` | 4/4 PASS | Vérifié | **CLOSED** |
| P1-I (RA-14) | 4/7 échoués | `transactionController`/`paiementTransactionController` : scope tenant sur listes/stats/mutations | 7/7 PASS | Vérifié | **CLOSED** |

## Résultat final : 10/10 CLOSED

(Mise à jour au fil de l'eau — voir chaque document `_P1?_*.md` pour le détail complet par lot.)
