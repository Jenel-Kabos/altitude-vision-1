# ARCH-2D1 — Contrat comportemental

| Scenario | Before | After | Parity |
|---|---|---|---|
| Date d'entrée absente | Retour `undefined`, aucune insertion | Identique | Oui |
| Date de fin absente | Retour `undefined`, aucune insertion | Identique | Oui |
| Loyer absent ou `0` | Retour `undefined`, aucune insertion | Identique | Oui |
| 15 janvier au 20 mars | Trois lignes janvier–mars incluses | Identique | Oui |
| Forme d'une ligne | `{ contrat, mois, annee, montant, statut: 'impayé' }` | Identique | Oui |
| Erreur `insertMany` | Rejet propagé sans traduction | Identique | Oui |

Inputs : `(contratId, dateEntree, dateFinBail, montantLoyer)`. Output : Promise résolue sans valeur. Side effect : un unique `Paiement.insertMany(rows)` quand la liste n'est pas vide. Aucun contrat HTTP direct ou indirect, provider externe, tenant, ownership ou IAM n'est impliqué.
