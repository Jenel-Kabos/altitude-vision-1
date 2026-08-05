# NAV-CORE-1 — Architecture et compatibilité

## Source de vérité

`shared/navigation/registry.json` est le registre canonique, versionné et indépendant des frameworks. `shared/navigation/index.js` fournit la résolution paramétrée, les deep links, les universal links et le contrôle d'accès. Les adaptateurs sont :

- Backend : `server/services/navigationService.js` ;
- Web : `client/lib/navigation/navigationSdk.js` ;
- Mobile : `altimmo-app/src/navigation/navigationSdk.js`.

Le Backend produit désormais le contrat `type + destination + entityType + entityId`. Il ajoute les valeurs résolues dans le document, le socket et le push Expo. Les champs historiques restent présents. Le Web et le Mobile lisent d'abord `destination`, puis les champs historiques afin de pouvoir ouvrir les notifications déjà stockées et celles émises par une ancienne version.

## Matrice des destinations

| Destination | Entité | Web | Mobile | Liens natifs | Auth/RBAC |
|---|---|---|---|---|---|
| PROPERTY_LIST / PROPERTY_DETAILS | property | annonces / fiche | liste / détail | oui | public |
| MY_PROPERTIES | property | mes biens | profil > annonces | oui | propriétaire/client |
| VISITS / OWNER_VISITS | visit | visites client/propriétaire | visites | oui | authentifié |
| PAYMENTS / PAYMENT_CANCEL | transaction | paiements | profil > transactions | oui | authentifié |
| APPLICATIONS / APPLICATION_DETAILS | realEstateApplication | dossiers | liste / détail | oui | authentifié |
| MESSAGES / CONVERSATION | conversation | messages | conversations / chat | oui | authentifié |
| PROFILE | user | profil | profil | oui | authentifié |
| HOTEL_RESERVATIONS | hotelReservation | réservations hôtel | réservations hôtel | oui | authentifié |
| ADMIN_VISITS | visit | dashboard visites | non disponible | non | staff autorisé |
| ADMIN_TRANSACTIONS | transaction | dashboard transactions | non disponible | non | staff autorisé |
| ADMIN_CONVERSATIONS | conversation | dashboard conversations | non disponible | non | staff autorisé |
| ADMIN_APPLICATIONS | realEstateApplication | dashboard dossiers | non disponible | non | staff autorisé |
| ADMIN_RENTALS | rentalManagement | gestion locative | non disponible | non | staff immobilier |
| LEASES | lease | baux | non disponible | non | staff immobilier |
| RENTAL_MAINTENANCE | maintenanceTicket | maintenance locative | non disponible | non | staff immobilier |
| ADMIN_NOTIFICATIONS | notification | notifications | notifications | oui | authentifié |

`mobileRoute: null` est volontaire pour les écrans de back-office absents de l'application. Aucun nom d'écran fictif n'est généré.

## Compatibilité

- Les redirections Next.js historiques `/altimmo`, `/mila-events` et `/altcom` ne sont pas modifiées.
- Les chemins mobiles existants `annonces`, `visites`, `messages`, `profil`, `paiement/success`, `paiement/cancel` et `dossiers-immobiliers` sont conservés.
- Android déclare tous les préfixes d'universal links présents dans le registre ; iOS et Expo utilisent le domaine et le schéma du registre.
- Les rôles sont des métadonnées de garde. Ils complètent les protections existantes des pages/API et ne les remplacent pas.
- Pour ajouter une destination : ajouter une entrée complète au registre, ajouter si nécessaire son association de type notification Backend, puis couvrir sa résolution Web/Mobile et son RBAC par un test.
