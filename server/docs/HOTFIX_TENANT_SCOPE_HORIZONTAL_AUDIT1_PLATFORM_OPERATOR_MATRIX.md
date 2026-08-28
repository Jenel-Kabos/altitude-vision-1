# Matrice PlatformOperator

| Family | Normal staff | Admin tenant | PlatformOperator global | PlatformOperator scoped |
|---|---|---|---|---|
| Dashboard Analytics | tenant obligatoire | tenant seulement | global explicite | tenant sélectionné |
| Reporting | tenant obligatoire | tenant seulement | global explicite | tenant sélectionné |
| CRM/Marketing/ERP/Documents/Users | tenant obligatoire | tenant seulement | sélection requise | tenant sélectionné |
| Hotel/Finance guarded operations | assignments/tenant | tenant/hôtel | pas de bypass implicite | tenant sélectionné + capacité |
| AccommodationReservation transitions/calendar | rôle seul sur branches staff | **devient global par rôle** | non distingué | sélection ignorée |
| Accommodation admin lists | rôle seul | global | non distingué | sélection ignorée |
| HotelReservation admin lists | rôle seul | global | non distingué | sélection ignorée |
| Hotel admin lists | non-Admin scoped par hôtels | global par rôle | non distingué | sélection ignorée pour Admin |
| Property pending/staff list | rôle seul | global | non distingué | sélection ignorée |

Le défaut commun est la confusion `Admin` avec « global ». Un PlatformOperator global est un contexte serveur reconnu, jamais un simple rôle Admin.
