# ARCH-2D1 — Matrice des clusters

| Cluster | Edges | Responsibility | Risk | Test coverage | Candidate |
|---|---:|---|---|---|---|
| Publication mobile Accommodation→Property | 1 | Construction et publication transactionnelle d'un bien | Élevé : Property, transaction et provider | Couverture existante, mais surface sensible | Non |
| Échéancier de bail | 1 | Construction et insertion des mensualités impayées | Moyen, mais surface étroite et sans IAM/tenant/HTTP | Caractérisation dédiée + suites rental | Oui |
| Analytics/reporting | 4 | Agrégats Accommodation, Hotel, vente et location | Élevé et transversal : tenant, Hotel, finance, présentation | Suites reporting existantes, caractérisation multi-domaines requise | Futur |

Trois clusters réels ont été identifiés. Le gain numérique du reporting n'a pas prévalu sur son risque transversal.
