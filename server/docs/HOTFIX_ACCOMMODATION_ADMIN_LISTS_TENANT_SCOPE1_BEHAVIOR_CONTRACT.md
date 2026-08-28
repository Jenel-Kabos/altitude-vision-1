# HZ-04 — Contrat comportemental

| Cas | Avant | Après |
|---|---|---|
| Admin A/B | global indu | tenant A/B seulement |
| staff RBAC sans tenant | 200 global indu | 403 fail-closed |
| PO global | global | global préservé |
| PO scoped | global indu | tenant sélectionné |
| Proprietaire/Client | 403 | 403 |
| tenant valide vide | 200 + liste vide | inchangé |
| admin/list filters | status/type/city/availability/search/flags | inchangés et combinés au tenant |
| pagination | page/limit/total | forme inchangée, total tenant-scoped |
| sort | recent/ancien/prix | inchangé |
| populate | Property sélection historique | inchangé |
| pending | `soumis`, independent only, submittedAt asc | inchangé + tenant |

Formes API inchangées : `{status,data:{accommodations,total,page,limit}}` pour admin/list et `{status,data:{accommodations}}` pour pending. Endpoints strictement read-only.

