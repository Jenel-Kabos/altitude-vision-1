# ARCH-2J — Clusters reporting

| Edge | Reporting? | Immobilier? | Cross-domain? | Finance? | Tenant? | Candidate? |
|---|---|---|---|---|---|---|
| Accommodation→controller | oui | immobilier/hébergement | oui | oui | oui | non |
| Hotel→controller | oui | hôtel | oui | oui | oui + membership | non |
| Immobilier→controller | oui | vente Property | limité à Property/Visite/Transaction | lecture de montants Transaction | scope owner IDs | oui |
| Location→controller | oui | gestion locative | oui | oui | scope owner IDs | non |

Les quatre edges forment un cluster technique reporting, pas une responsabilité unique. Aucun `ReportingService` générique n'est créé.
