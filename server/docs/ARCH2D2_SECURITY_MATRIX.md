# ARCH-2D2 — Sécurité et invariants

| Invariant | Résultat |
|---|---|
| Tenant / PlatformOperator | Non lus par le helper ; inchangés |
| Ownership | `ownerId` recopié à l'identique ; aucun contrôle déplacé |
| IAM / businessProfiles | Non concernés ; inchangés |
| Finance | Mapping `honoraires`/`fraisVisite` strictement identique ; aucun paiement |
| Property | Payload identique ; publication, modération et `runPropertySearch` inchangés |
| Rental / Hotel | Non concernés |
| CRM / Notification | Aucun import ajouté ; graphe acyclique |
| Providers / production | Aucun I/O dans le helper, aucun appel réel ou mutation production |
| API | Le controller conserve req/res, statuts, payloads et traduction d'erreurs |

La responsabilité extraite ne reçoit ni `req`, ni `res`, ni `next`.
