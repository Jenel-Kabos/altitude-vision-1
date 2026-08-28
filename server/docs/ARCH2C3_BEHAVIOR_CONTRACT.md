# ARCH-2C3 — Contrat de parité

| Branche | Avant | Après | Parité |
|---|---|---|---|
| input absent | `[]` si tenantCount ≠ 1 | identique | oui |
| doublons/types | `Set(map(String))` | identique | oui |
| tenantCount ≠ 1 | retour immédiat | identique | oui |
| tenantCount = 1 | mêmes distincts et même filtre User | identique | oui |
| résultat vide | scope initial uniquement | identique | oui |
| erreur | rejet, fallback dans caller | identique | oui |
| HTTP/tenant/ownership/IAM | indirect, inchangé | identique | oui |

Query conservée exactement : count des `PlatformTenant.status in [trial,active]`, distinct global de `OrgMembership.user` et `PlatformOperator.user`, puis User actif/non technique/non suspendu avec `_id $nin`.
