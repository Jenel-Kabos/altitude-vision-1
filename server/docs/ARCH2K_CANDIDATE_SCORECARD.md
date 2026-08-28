# ARCH-2K — Scorecard des candidates

| Candidate | Architectural gain | Cohesion | Security risk | Business risk | Blast radius | Testability | Verdict |
|---|---|---|---|---|---|---|---|
| Accommodation query boundary | 3→2 réel | HIGH | HIGH | HIGH | HIGH | MEDIUM | DEFER |
| Hotel occupancy/report query boundary | 3→2 réel | MEDIUM | CRITICAL | HIGH | CRITICAL | LOW-MEDIUM | KEEP |
| Rental report query boundary | 3→2 réel | HIGH | MEDIUM | MEDIUM | MEDIUM | MEDIUM-HIGH | RECOMMEND |

La candidate Location est la plus simple, la plus cohésive, la moins risquée et la plus facilement caractérisable. Hotel est la plus risquée. Accommodation dispose de quelques tests directs de sécurité supplémentaires, mais Location offre le meilleur contrat de query isolable. Aucun dead code parmi les trois.
