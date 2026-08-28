# ARCH-2G — Comparaison des quick wins

| Candidate | Edges removable | Gain | Cohesion | Security risk | Business risk | Testability | Recommendation |
|---|---:|---|---|---|---|---|---|
| Devis application boundary | 1 | MEDIUM | HIGH | LOW | MEDIUM | MODERATE | **RECOMMEND** |
| Estimation request/inbox boundary | 1 | MEDIUM | MEDIUM | MEDIUM | HIGH | HARD | DEFER |
| Projet legacy cleanup | 1 | LOW | LOW | HIGH/unknown | unknown | LOW | DEFER — lifecycle audit |
| Realisation CRUD boundary | 1 | LOW | HIGH | HIGH/unknown | unknown | LOW | DEFER — lifecycle/security audit |
| Guards tenant/ownership/operator | jusqu'à 9 artificiellement | LOW | LOW | CRITICAL | CRITICAL | HARD | KEEP |

Tous les candidats ne retirent qu'une edge. Devis gagne par cohésion fonctionnelle, absence de tenant/ownership/finance/Cloudinary et abstraction étroite. Il n'est pas read-only et doit donc être précédé de caractérisation.
