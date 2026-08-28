# ARCH-2G — Matrice KEEP

| Edge | Keep now? | Reason | Revisit condition |
|---|---|---|---|
| Contrat | oui | KEEP — TENANT BOUNDARY | policy tenant canonique prouvée équivalente |
| Devis | non, candidat | logique applicative cohérente inline | sprint ARCH-2H caractérisé |
| Estimation | oui | KEEP — LOW VALUE / HIGH RISK | providers et read-write caractérisés |
| GestionDoc→Contrat | oui | KEEP — TENANT BOUNDARY | design légal/tenant dédié |
| GestionDoc→Paiement | oui | KEEP — TENANT BOUNDARY | design finance/tenant dédié |
| Locataire | oui | KEEP — TENANT BOUNDARY | policy location commune prouvée |
| Paiement | oui | KEEP — TENANT BOUNDARY | refactor financier dédié |
| PlatformTenantDomain | oui | KEEP — PLATFORM OPERATOR BOUNDARY | policy operator formalisée/testée |
| Proprietaire | oui | KEEP — TENANT BOUNDARY | policy location commune prouvée |
| Projet | oui | KEEP — NEEDS DEDICATED DESIGN | décision supprimer/restaurer/monter |
| Realisation | oui | KEEP — NEEDS DEDICATED DESIGN | décision lifecycle + auth |
| RentalManagement | oui | KEEP — OWNERSHIP BOUNDARY | policy owner/tenant canonique |
| User | oui | KEEP — TENANT BOUNDARY | policy IAM cross-tenant canonique |

Les neuf guards pourraient devenir des exceptions architecturales documentées après validation formelle de leur rôle; aucune allowlist/baseline n'est changée ici.
