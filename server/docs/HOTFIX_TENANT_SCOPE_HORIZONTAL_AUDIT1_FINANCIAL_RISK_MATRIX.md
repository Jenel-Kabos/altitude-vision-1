# Matrice de risque financier

| Endpoint | Models | Tenant boundary | Financial data | Cross-tenant risk |
|---|---|---|---|---|
| Accommodation reservation transitions | AccommodationReservation, NightLock, FinancialDocument indirect | absente avant `transition` | total, pricing snapshot, facture à confirmation | CRITICAL / P0 |
| Accommodation reservation calendar | Reservation, Block, NightLock | absente | total et paymentStatus exposés par calendar | HIGH / P0 |
| Accommodation admin lists | Accommodation, Property, RatePlan | absente dans collection | tarifs actifs | HIGH / P0 |
| Hotel reservation admin lists | HotelReservation, Hotel, RoomCategory | tenant attaché mais ignoré | séjour/référence ; finance indirecte | CRITICAL / P0 |
| Hotel admin lists | Hotel, Property, catégories | Admin sans IDs scopés | inventaire commercial | HIGH / P0 |
| Property pending/staff list | Property, Accommodation/Hotel populate | absente | prix, données propriétaire | HIGH / P0 |
| `/api/financial/hotel/*` | FinancialDocument/Payment/Allocation/Ledger | `assertFinancialScope` | documents, paiements, soldes | LOW résiduel / safe pattern |
| `/api/paiements` | Paiement/Contrat | attribution param + capacité | loyers, pénalités, reçus | LOW résiduel / safe pattern |
| Dashboard Analytics | multiples modèles finance | resolver canonical | agrégats | certifié safe |
| Reporting | multiples | global opérateur explicite ou tenant | agrégats | global légitime contrôlé |

Les transitions Accommodation peuvent déclencher l'émission d'une facture après une mutation cross-tenant ; elles dominent donc les listes en lecture dans la priorité.
