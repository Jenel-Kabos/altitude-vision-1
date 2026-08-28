# ARCH-2L — Matrice des cinq modèles

| Model | Query/aggregation | Purpose | Owner filter | Output contribution |
|---|---|---|---|---|
| `Property` | `find(...).distinct('_id')` | Résoudre les biens des owners | `{owner:{$in:scopeUserIds}}` si scope | IDs utilisés par les quatre domaines suivants |
| `RentalManagement` | `aggregate` match+group | Disponibilité, occupation, préavis | `{property:{$in:properties}}` si scope | `available`, `occupied`, `notices` |
| `Contrat` | `find(...).distinct('_id')` puis `aggregate` | IDs pour paiements ; baux actifs/à échéance | `{bien:{$in:properties}}` si scope | `activeContracts`, `expiringContracts` |
| `Paiement` | `aggregate` match+group | Loyers encaissés, impayés, pénalités | `{contrat:{$in:contractsInScope}}` si scope | `rentCollected`, `unpaidRent`, `penalties` |
| `RentalMaintenanceTicket` | `countDocuments` | Maintenance locative ouverte | `{property:{$in:properties}}` si scope | `maintenance` |

Les cinq modèles sont lus uniquement. Aucun modèle Locataire n'est interrogé par cette query.
