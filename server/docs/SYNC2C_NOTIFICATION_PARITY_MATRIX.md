# SYNC-2C — Matrice de parité notifications finale

| Domaine | Type | Backend | Web | Mobile | Deep-link | Realtime | Cold start | Verdict |
|---|---|---|---|---|---|---|---|---|
| PMS — réservation (voyageur) | `hotel_reservation_confirmed/rejected/cancelled/expired` | ✅ | ✅ | ✅ | ✅ (déjà présent, `HOTEL_RESERVATIONS`) | — | ✅ | Parité déjà atteinte |
| PMS — réservation (voyageur) | `hotel_reservation_created/checked_in/checked_out/modified` | ✅ | ✅ (implicite) | ✅ | ✅ (gap fermé, `HOTEL_RESERVATIONS`) | — | ✅ | Gap fermé |
| PMS — réservation (propriétaire) | `hotel_reservation_pending` | ✅ | ✅ (`/mes-hotels/reservations`) | ✅ | ✅ (gap fermé, `HOTEL_OPERATIONS`, nouveau) | ✅ (`reservation.*`) | ✅ | Gap fermé |
| PMS — housekeeping | `housekeeping_task_created/assigned/completed` | ✅ | ✅ | ✅ | ✅ (gap fermé, `HOUSEKEEPING`, nouveau) | ✅ (`housekeeping.*`) | ✅ | Gap fermé |
| PMS — inspection | `room_inspection_failed`, `room_returned_to_service` | ✅ | ✅ (réutilise la page housekeeping) | ✅ | ✅ (gap fermé, réutilise `HOUSEKEEPING`) | ✅ (`inspection.*`) | ✅ | Gap fermé |
| PMS — maintenance hôtelière | `maintenance_ticket_created/assigned/resolved` | ✅ | ✅ | ✅ | ✅ (gap fermé, `HOTEL_MAINTENANCE`, nouveau) | ✅ (`maintenance.*`) | ✅ | Gap fermé |
| PMS — finance | `hotel_financial_draft_failed` | ✅ | ✅ (Admin) | ❌ (volontaire) | ❌ (volontaire, jamais mappé) | — | — | Web/Admin-only, documenté |
| Client — visites | `visite_*` (12 types) | ✅ | ✅ | ✅ | ✅ (déjà présent, `VISITS`) | ✅ (`visite:*`) | ✅ | Parité déjà atteinte |
| Client — messages | `new_message/new_staff_message/message_staff` | ✅ | ✅ | ✅ | ✅ (déjà présent, enrichissement conversation) | ✅ (room conversation) | ✅ | Parité déjà atteinte, source unifiée (bug corrigé) |
| Client — transactions | `transaction_*/payment_*` | ✅ | ✅ | ✅ | ✅ (déjà présent, `PAYMENTS`) | — | ✅ | Parité déjà atteinte |
| Client — candidatures | `real_estate_application_*/reservation_*` | ✅ | ✅ | ✅ | ✅ (déjà présent, `APPLICATIONS`) | — | ✅ | Parité déjà atteinte |
| Propriétaire — annonce | `bien_valide/bien_rejete/nouveau_signalement` | ✅ | ✅ | ✅ | ✅ (déjà présent, fallback légitime) | — | ✅ | Parité déjà atteinte |
| GL — locataire | `tenant_*` (portail natif) | ✅ | ✅ | ✅ | ✅ (déjà présent, `TENANT_PORTAL`/`TENANT_MAINTENANCE`/etc.) | — | ✅ | Parité déjà atteinte |
| GL — propriétaire | `rental_*` | ✅ | ✅ | ✅ | ✅ (déjà présent, `MesAnnonces`) | ✅ (`rental:*`) | ✅ | Parité déjà atteinte |
| GL — contrat/devis | `contrat_*/quote_*/loyer_*` | ✅ | ✅ | ❌ (`null` volontaire, aucun écran contrat/devis natif) | ❌ | — | — | Web-only, dette préexistante non traitée (hors périmètre SYNC-2C, aucun écran mobile équivalent) |
| Documents | `tenant_document_added/tenant_receipt_added` | ✅ | ✅ | ✅ | ✅ (déjà présent, `MY_DOCUMENT_DETAILS`) | — | ✅ | Parité déjà atteinte |
| Compte | `account_verified/account_suspended` | ✅ | ✅ | ✅ | ✅ (déjà présent, `Profil`) | ✅ (nettoyage central SYNC-2A) | ✅ | Parité déjà atteinte |
| Accommodation | `accommodation_reservation_*/payment_*` | ✅ | ✅ | ✅ | ✅ (déjà présent, `ACCOMMODATION_RESERVATION_DETAILS`) | — | ✅ | Parité déjà atteinte |

## Notes de lecture

- « Gap fermé » = destination ajoutée à `shared/navigation/registry.json` **et** mapping `type → destination` ajouté dans `server/services/navigationService.js`, vérifiés par tests serveur ET mobile.
- Toutes les lignes « Realtime » renvoient au canal `hotel:<id>` (`hospitality:updated`) pour le PMS opérationnel, ou aux rooms `user`/`conversation` existantes pour le reste — jamais fusionnés (mandat §25-26).
- `contrat_*/quote_*/loyer_*` restent des `null` volontaires côté `TYPE_TO_SCREEN` — **aucun écran mobile de contrat/devis n'existe** (ni avant ni après ce sprint) ; créer une destination sans écran cible violerait le mandat §33 (« ne jamais créer un écran uniquement pour satisfaire un deep-link »). Documenté comme dette SYNC-2D, pas silencieusement ignoré.
