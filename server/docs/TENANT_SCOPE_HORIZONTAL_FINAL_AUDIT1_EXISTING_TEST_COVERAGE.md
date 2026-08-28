# TENANT-SCOPE-HORIZONTAL-FINAL-AUDIT-1 — Couverture de tests existante

## Matrice surface → test → scénario

| Surface | Fichier de test | Scénarios couverts | Scénarios manquants |
|---|---|---|---|
| Accommodation admin/pending (HZ-04) | `accommodationAdminListsTenantScope.mongo.integration.test.js` | Admin A/B isolation, `/admin/list`, `/status/pending` | — |
| Accommodation calendar/blocks (HZ-02) | `accommodationCalendarTenantScope.mongo.integration.test.js` | Isolation A/B sur blocks/calendar | — |
| AccommodationReservation (HZ-01/HZ-03) | `accommodationReservationListTenantScope.mongo.integration.test.js`, `accommodationReservationTenantScope.mongo.integration.test.js` | Mutations + liste | — |
| Hotel admin (HZ-06) | `hotelAdminListsTenantScope.mongo.integration.test.js` | Isolation A/B | — |
| HotelReservation (HZ-05) | `hotelReservationAdminListsTenantScope.mongo.integration.test.js` | Isolation A/B | — |
| Property moderation (HZ-07) | `propertyModerationTenantScope.mongo.integration.test.js` | Isolation A/B | — |
| Dashboard Analytics | `dashboardAnalyticsTenantScope.mongo.integration.test.js` | Isolation A/B sur agrégats | — |
| Dev Portal (API keys) | **Aucun test tenant-scope dédié trouvé** | — | **Gap** — le code est CLEAN par lecture directe (ce sprint), mais aucune régression future ne serait détectée automatiquement |
| Messaging (conversations/messages) | **Aucun test tenant-scope trouvé** (`grep -rl "tenant" __tests__/*conversation*` et `*message*` → aucun fichier `*TenantScope*` pour ce domaine) | — | **Gap majeur — c'est précisément l'angle mort qui a permis à HF-FINAL-01 de rester non détecté** |
| Rental classique (Contrat/Paiement/Locataire/Litige) | N/A (pas de champ tenant) | — | Hors périmètre tenant-scope, pas un gap |
| Finance (FinancialDocument/Payment/Allocation) | `financialAuthorizationService` a des tests unitaires (non tenant-scope dédiés confirmés ce sprint) | Capacité/rôle | **NON CONFIRMÉ** — pas vérifié avec la même rigueur que les domaines HZ |

## Constat principal

**Le gap de couverture de test le plus significatif est exactement le domaine où le nouveau P0 a été trouvé** : aucun test `*TenantScope*.mongo.integration.test.js` n'existe pour `conversationController.js`/`messageController.js`, alors que ce pattern de test est systématiquement utilisé pour tous les domaines HZ-01→HZ-07. Cette absence corrobore directement l'analyse du mandat : la campagne HZ a rigoureusement couvert Accommodation/Hotel/Property, mais Messaging n'a jamais fait partie de son périmètre nommé — un angle mort de couverture, pas une régression.

## Recommandation (non exécutée — hors périmètre read-only)

Un futur hotfix sur HF-FINAL-01 devrait s'accompagner d'un fichier `conversationMessagingTenantScope.mongo.integration.test.js` reproduisant exactement le scénario "staff multi-tenant sans header" sur `staff-inbox`/detail/delete/send, suivant le même patron que les 8 fichiers `*TenantScope*` déjà existants.
