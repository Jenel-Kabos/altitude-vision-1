# HZ-04 — Reproduction runtime

Suite réelle : `accommodationAdminListsTenantScope.mongo.integration.test.js`, vrai routeur Express/Supertest, vrai MongoMemory replica set.

| Endpoint | Actor | Tenant | Expected secure behavior | Pre-fix actual | Vulnerable |
|---|---|---|---|---|---:|
| admin/list | Admin A | A | A1+A2 | A1+A2+B1+B2, total 4 | oui |
| pending | Admin A | A | A_PENDING | A_PENDING+B_PENDING | oui |
| admin/list | Admin B | B | B1+B2 | A1+A2+B1+B2, total 4 | oui |
| pending | Admin B | B | B_PENDING | A_PENDING+B_PENDING | oui |
| les deux | chaque rôle RBAC | aucun | 403 | 200 global | oui |
| les deux | PO global | global | global | global | non |
| les deux | PO scoped A/B | A/B | tenant uniquement | global | oui |

Rouge obtenu : 9 échecs, 8 succès. Données A et B présentes ; contenu et `total` de la liste admin fuyaient. `pending` n'a pas de count/pagination. Populate ne créait pas la fuite : il exposait le Property associé à chaque Accommodation déjà indûment sélectionnée. Pas d'aggregation, `$lookup` ou `$facet`.

