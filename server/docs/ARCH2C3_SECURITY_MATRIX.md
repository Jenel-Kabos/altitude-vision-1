# ARCH-2C3 — Matrice sécurité

| Invariant | Preuve | Statut |
|---|---|---|
| tenant/cross-tenant | garde `tenantCount === 1` inchangée; tests tenant ciblés | intact |
| ownership | aucune règle déplacée/modifiée | intact |
| IAM/rôles/capabilities | aucune lecture/écriture IAM dans le helper | intact |
| PlatformOperator | même exclusion par `distinct('user')`; tests adversariaux | intact |
| businessProfiles | aucun fichier touché | intact |
| HotelStaffAssignment | aucun fichier touché | intact |
| financialAuthorizationService | aucun fichier touché | intact |
| API et codes HTTP | routes/controllers et fallback conservés | intact |
| production data | lectures uniquement; aucune migration/backfill | intact |
| frontend/mobile | aucun fichier touché | intact |
