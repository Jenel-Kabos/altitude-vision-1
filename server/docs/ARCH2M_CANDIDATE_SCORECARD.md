# ARCH-2M — Scorecard candidats

| Candidate | Gain | Cohesion | Security Risk | Business Risk | Blast Radius | Testability | Verdict |
|---|---|---|---|---|---|---|---|
| Accommodation → `accommodations` | LOW (2→1 seulement) | HIGH | HIGH | HIGH | HIGH | MEDIUM | DEFER |
| Hotel → `hotels` | LOW (2→1 seulement) | MEDIUM | CRITICAL | CRITICAL | CRITICAL | LOW-MEDIUM | KEEP |

Accommodation est la plus simple, la plus cohésive, la mieux testée et le meilleur ratio des deux. Ce ratio reste insuffisant : quatre domaines, tenant/ownership et agrégats financiers pour une seule unité de compteur. Hotel porte en plus IAM hôtel, PlatformOperator, finance et un contrat volontairement asymétrique entre occupation globale et finance scopée.
