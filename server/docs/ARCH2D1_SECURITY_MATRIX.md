# ARCH-2D1 — Matrice sécurité et invariants

| Invariant | Preuve / résultat |
|---|---|
| Tenant | Non lu par le helper ; inchangé |
| Ownership | Non lu ; inchangé |
| IAM / RBAC | Aucun rôle/capability lu ou modifié |
| PlatformOperator | Non concerné ; inchangé |
| Finance | Même création d'échéances `impayé`; aucune confirmation, écriture ledger, reversal ou payout |
| Hotel | Non concerné |
| Property | Non concerné ; `runPropertySearch` intact |
| CRM / Notification | Aucun import ajouté ; cycles restent à 0 |
| Production | Aucune mutation, migration ou donnée réelle |
| Providers | Aucun appel externe |
| API | Routes, statuts, payloads et traduction d'erreurs inchangés |

La fonction ne reçoit ni `req`, ni `res`, ni `next`. Les contrôles HTTP restent intégralement dans le controller.
