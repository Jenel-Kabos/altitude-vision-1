# Reproduction runtime pré-fix

| Actor | Tenant | HTTP pré-fix | Contenu pré-fix | Après fix |
|---|---|---:|---|---|
| Admin | aucun | 200 | 4/4 : A1, A2, B1, B2 | 403, aucune data |
| Collaborateur | aucun | 200 | 4/4 : A1, A2, B1, B2 | 403, aucune data |
| GestionnaireImmobilier | aucun | 200 | 4/4 : A1, A2, B1, B2 | 403, aucune data |
| CommunityManager | aucun | 200 | 4/4 : A1, A2, B1, B2 | 403, aucune data |
| Admin A | A | 200 | A1/A2 seulement | identique |
| Admin B | B | 200 | B1/B2 seulement | identique |
| PO global | global | 200 | A1/A2/B1/B2 | identique |
| PO scoped A/B | A/B | 200 | tenant sélectionné seulement | identique |
| Proprietaire/Client | ownership/guest | 200 | ressources propres | identique |

Test rouge archivé dans `accommodationReservationListTenantScope.mongo.integration.test.js` : 4 failed, 11 passed avant correction. Mongo de test uniquement.
