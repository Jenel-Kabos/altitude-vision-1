# ARCH-2M — Matrice de priorité

| Candidate | Debt type | Gain | Risk | Blast Radius | Testability | Priority |
|---|---|---|---|---|---|---:|
| Dashboard Analytics tenant scope | NEW SECURITY FINDING | Isolation cross-tenant ; compteurs inchangés | CRITICAL | HIGH | MEDIUM-HIGH | 1 |
| Projet dead route | Lifecycle/dead code | Réduction de dette statique après preuve | LOW-MEDIUM | LOW runtime | HIGH | 2 |
| Realisation dead route | Lifecycle/dead code | Réduction de dette statique après preuve data | MEDIUM | LOW runtime | MEDIUM | 3 |
| `runPropertySearch` | controller→controller vivant | 1→0 | HIGH | HIGH | MEDIUM | 4 |
| Accommodation → `accommodations` | service→controller vivant | 2→1 | HIGH | HIGH | MEDIUM | 5 |
| Estimation | route→model/orchestration vivante | 12→11 | HIGH | HIGH | LOW-MEDIUM | 6 |
| Hotel → `hotels` | service→controller vivant | 2→1 | CRITICAL | CRITICAL | LOW-MEDIUM | 7 |

Ni Accommodation ni Hotel n'est clairement plus sûre que `runPropertySearch`. Le cleanup dead-code est plus borné après audit lifecycle, mais le finding de tenant vivant prévaut. Estimation reste risquée et n'est pas promue. La décision ARCH-2I d'arrêter route→model demeure intacte : les dead routes constituent un chantier lifecycle, pas une reprise mécanique des 12 edges.
