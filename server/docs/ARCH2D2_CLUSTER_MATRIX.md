# ARCH-2D2 — Clusters restants

| Cluster | Edges | Domain | Responsibility | Risk | Tests | Candidate |
|---|---:|---|---|---|---|---|
| Property mobile publication input | 1 | Property / Accommodation | Mapper et valider un payload JSON déjà uploadé | Faible : helper pur, sans I/O | Unitaires existants + caractérisation dédiée + intégration publication | Oui |
| Dashboard analytics | 4 | Reporting multi-domaines | Requêtes et agrégats Accommodation, Hotel, vente, location | Élevé : tenant, Hotel, finance, nombreuses collections | Bonne couverture, mais caractérisation transversale requise | Non pour ce sprint |

Deux clusters restent. Le helper Property est indépendant de `runPropertySearch` et de l'orchestration transactionnelle de publication.
