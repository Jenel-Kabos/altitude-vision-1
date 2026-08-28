# HZ-04 — Matrice sécurité finale

| Actor | Scope | Endpoint | Expected | Prouvé |
|---|---|---|---|---:|
| Admin A | A | admin list | A only + total A | oui |
| Admin A | A | pending | A soumis only | oui |
| Admin B | B | admin list | B only + total B | oui |
| Admin B | B | pending | B soumis only | oui |
| Admin/Gestionnaire/Collaborateur | none | both | 403 | oui |
| PO | global | both | global | oui |
| PO | A | both | A only | oui |
| PO | B | both | B only | oui |
| Proprietaire/Client | none | both | 403 RBAC | oui |
| anonymous | none | both | 401 | oui |

Side effects prouvés : snapshot `Accommodation` strictement identique avant/après les deux lectures ; aucune écriture Reservation, Calendar, Block, finance, notification, email, webhook ou provider n'est appelée par ce chemin.

