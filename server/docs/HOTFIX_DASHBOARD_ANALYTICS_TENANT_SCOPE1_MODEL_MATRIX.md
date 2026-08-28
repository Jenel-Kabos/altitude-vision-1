# Matrice des modèles Dashboard Analytics

| Endpoint | Model | Read/Write | Champ/scope tenant | Filtre après fix | Sensibilité |
|---|---|---|---|---|---|
| sales | Property | Read | owner indirect | owner ∈ `tenantScopeUserIds` | HIGH |
| sales | Transaction | Read | property indirect | property ∈ IDs scopés | HIGH |
| sales | Visite | Read | property indirect | property ∈ IDs scopés | MEDIUM |
| rentals | Property | Read | owner indirect | owner ∈ `tenantScopeUserIds` | HIGH |
| rentals | RentalManagement | Read | property indirect | property ∈ IDs scopés | MEDIUM |
| rentals | Contrat | Read | bien/property indirect | bien ∈ IDs scopés | HIGH |
| rentals | Paiement | Read | contrat indirect | contrat ∈ contrats scopés | CRITICAL |
| rentals | RentalMaintenanceTicket | Read | property indirect | property ∈ IDs scopés | MEDIUM |
| accommodations | Accommodation | Read | `tenant` direct | `tenant = platformTenant`, ou ID owned self-service | HIGH |
| accommodations | Property | Read | via Accommodation.property | `$lookup` après `$match` Accommodation | MEDIUM |
| accommodations | AccommodationReservation | Read | accommodation indirect | accommodation ∈ IDs publiés scopés | HIGH |
| accommodations | AccommodationNightLock | Read | accommodation indirect | accommodation ∈ IDs publiés scopés | LOW |
| accommodations | FinancialDocument | Read | establishment indirect | establishmentId ∈ IDs scopés | CRITICAL |
| accommodations | PaymentAllocation | Read | establishment indirect | establishmentId ∈ IDs scopés | CRITICAL |
| accommodations | FinancialRefund | Read | establishment indirect | establishmentId ∈ IDs scopés | CRITICAL |
| hotels | Hotel | Read | `tenant` direct | tenant via acteur enrichi/IDs accessibles | HIGH |
| hotels | Property | Read | via Hotel.property | populate sur hôtels déjà scopés | MEDIUM |
| hotels | Room | Read | hotel indirect | hotel ∈ IDs scopés | MEDIUM |
| hotels | HotelReservation | Read | hotel indirect | hotel ∈ IDs scopés | HIGH |
| hotels | HousekeepingTask | Read | hotel indirect | hotel ∈ IDs scopés | LOW |
| hotels | MaintenanceTicket | Read | hotel indirect | hotel ∈ IDs scopés | LOW |
| hotels | PaymentAllocation | Read | establishment indirect | establishmentId ∈ IDs scopés | CRITICAL |
| hotels | FinancialRefund | Read | establishment indirect | establishmentId ∈ IDs scopés | CRITICAL |
| hotels | FinancialDocument | Read | establishment indirect | establishmentId ∈ IDs scopés | CRITICAL |

Toutes les opérations sont des lectures. Le `$lookup` Accommodation→Property et le populate Hotel→Property ne peuvent élargir le tenant : leur collection racine est filtrée avant la relation et les agrégats descendants utilisent uniquement ses IDs.
