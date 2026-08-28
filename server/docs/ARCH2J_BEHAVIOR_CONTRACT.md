# ARCH-2J — Contrat de comportement

| Scenario | Before | Expected after | Sensitive dimension |
|---|---|---|---|
| Collections vides | tous KPI à 0, recent vide | identique | valeurs par défaut |
| Vente et location présentes | seules les ventes comptées | identique | discriminant `status` |
| Parcelle publiée | incluse sans filtre de type physique | identique | Parcelle |
| Validée mais non publiée | total/active oui, published non, draft oui | identique | publication |
| Publication valide | `Validée+isPublished+Disponible+Altimmo` | identique | prédicat public |
| scopeUserIds absent | toutes les ventes | identique | vue globale |
| scopeUserIds fourni | owner dans `$in` | identique | ownership/org scope |
| visites futures actives | comptées | identique | date/statut |
| transactions vente | offres, montants, commissions | identique | finance read-only |
| transactions récentes réussies | tri date desc, limite 5, propriété peuplée | identique | sort/projection |
| rôle non autorisé endpoint | 403 avant query | identique | IAM |
| erreur query | propagée au handler, réponse 500 | identique | erreur |

Avant extraction : 4 suites, 40/40 tests verts. Après extraction : mêmes 4 suites, 40/40 vertes.
