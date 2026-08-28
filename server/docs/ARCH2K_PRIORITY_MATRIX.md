# ARCH-2K — Matrice de priorité

| Candidate | Debt type | Gain | Risk | Blast radius | Testability | Priority |
|---|---|---|---|---|---|---|
| Location → `rentals` | Frontière service→controller active read-only | 3→2 | MEDIUM | MEDIUM | MEDIUM-HIGH | 1 |
| `runPropertySearch` | Frontière controller→controller / query publique | 1→0 | HIGH | HIGH | MEDIUM | 3 |
| Estimation route→model | Orchestration applicative vivante | 12→11 | HIGH | HIGH | LOW-MEDIUM | 4 |
| Accommodation → `accommodations` | Frontière service→controller finance/tenant | 3→2 | HIGH | HIGH | MEDIUM | 5 |
| Realisation route | Dead route/lifecycle | 12→11 si retrait dédié | MEDIUM avant preuve data | LOW runtime | MEDIUM | 2 ex aequo, audit lifecycle |
| Projet route | Dead route + modèle absent | 12→11 si retrait dédié | LOW-MEDIUM | LOW runtime | HIGH pour non-montage | 2 ex aequo, audit lifecycle |
| Hotel → `hotels` | Frontière service→controller sécurité/finance | 3→2 | CRITICAL | CRITICAL | LOW-MEDIUM | 6 |

Location reste clairement plus sûre que `runPropertySearch` : une seule agrégation read-only, pas de pagination multi-collection/publication staff. Elle est aussi plus sûre qu'Estimation, qui écrit, upload, notifie et envoie des emails. Les dead routes ont un gain runtime faible ; leur cleanup doit être un sprint lifecycle distinct après preuve historique/données, pas une extraction architecturale.
