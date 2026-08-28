# Carte des frontières de sécurité

| Famille | Auth | Role/capability | Tenant resolution | Tenant authorization | Ownership | Query |
|---|---|---|---|---|---|---|
| Dashboard Analytics | `protect` | contrôleur | `requireTenantScopeForAnalytics` | scope IDs/tenant | Proprietaire | bornée avant agrégat |
| CRM/Marketing | `protect` | staff | `requireTenantScope` | tenant direct | sans objet | tenant dans chaque service |
| Rental/Documents/Users | `protect` | capacités/Admin | canonical ou param inline | attribution/scope IDs | owner selon endpoint | bornée/indirecte |
| Hotel opérationnel | `protect` | capacités hôtel | attach non bloquant | `resolveHotelAccessScope` | manager/assignment | IDs hôtel autorisés |
| Finance hôtel | `protect` | capacités financières | attach non bloquant | `assertFinancialScope` | manager owner read | establishment autorisé |
| Messaging | `protect` | route ponctuelle | attach optionnel | attribution si tenant | participants | conversation/message ciblés |
| Reporting | `protect` | Direction | allow-platform-wide canonique | source opérateur vérifiée | sans objet | tenant ou global légitime |
| AccommodationReservation — transitions | `protect` | rôle inline | **absente** | **absente** | owner OU rôle staff | `findById` puis mutation |
| Accommodation calendrier | `protect` | rôle inline/aucun | **absente** | **absente** | owner OU rôle staff ; aucune sur listBlocks | IDs client puis lecture/mutation |
| Listes Admin Property/Accommodation/Hotel | `protect`/optional | rôle | absente ou attach ignoré | **absente dans query** | sans objet | `{}`/filtre métier global |
| HotelReservation admin list/pending | `protect` | `ROLES_ALTIMMO` | attach seulement | **tenant ignoré** | sans objet | query globale |

Le drift horizontal principal est l'existence simultanée de middleware canonique, de résolution inline, de guards domaine et de branches historiques « Admin = global ». Ce dernier concept n'est pas équivalent au vrai PlatformOperator global.
