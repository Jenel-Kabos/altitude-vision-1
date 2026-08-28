# Contrat comportemental

| Scenario | Before | After |
|---|---|---|
| Admin A/B | 200, tenant propre | identique |
| staff sans tenant | 200 global | 403 fail-closed |
| PO global | 200 global légitime | identique |
| PO scoped A/B | 200 tenant sélectionné | identique |
| Proprietaire | 200 owner-only | identique |
| Client/autre authentifié | 200 guest-only | identique |
| anonymous | 401 | identique |
| tenant valide sans data | 200, liste vide | identique |
| filtered list | filtres status/accommodation | identique |
| pagination | page/limit/total/totalPages | identique |
| sort/populate | createdAt desc + relations historiques | identique |

La réponse légitime reste `{status:'success', data:{reservations,total,page,totalPages}}`. Aucun lookup/aggregation ni effet de bord n'existe sur ce chemin.
