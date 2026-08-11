# TENANT-ATTRIBUTION-1 — Audit initial

Date : 2026-08-10. Périmètre : attribution tenant des ressources legacy critiques. Cet audit est documentaire et read-only ; aucun backfill n'a été exécuté.

## Méthode et invariants

Les preuves admises sont exclusivement les champs tenant existants et les relations Mongo réelles jusqu'à `PlatformTenant` via `OrgMembership`. `User.role === 'Admin'` n'est jamais une preuve. Plusieurs preuves vers plusieurs tenants donnent `ambiguous`; aucune preuve sûre donne `unresolved`; ces deux états sont refusés sur une route tenant-scopée.

## Matrice des modèles

| Collection | Tenant direct avant | Relation dérivable | Chaîne retenue | Ambiguïté | Legacy | Écriture future sécurisable | Backfill dry-run |
|---|---:|---|---|---:|---:|---:|---:|
| Document | non | oui | createdBy/client → membership; relatedProperty/entity Property → owner; entity Hotel/Accommodation | oui | oui | oui | oui |
| Conversation | non | oui | participants → memberships; relatedProperty → owner | oui | oui | oui | oui |
| Message | non | oui | conversation → attribution; sinon sender/receiver → memberships | oui | oui | oui | oui |
| FinancialDocument | non | oui | establishment Hotel/Accommodation/Property → attribution | oui | oui | oui | oui |
| FinancialPayment | non | oui | établissement → attribution | oui | oui | oui | oui |
| PaymentAllocation | non | oui | établissement, puis objets financiers lors des créations | oui | oui | oui | oui |
| Hotel | non | oui | manager/createdBy → membership; property → owner | oui | oui | oui | oui |
| HotelReservation | non | oui | hotel → attribution | oui | oui | oui | oui |
| HotelStaffAssignment | non | oui | hotel → attribution; user reste une permission objet | oui | oui | oui | oui |
| Room | non | oui | hotel → attribution | oui | oui | oui | oui |
| RentalManagement | non | oui | property → owner; owner/manager → memberships | oui | oui | oui | oui |
| Contrat | non | partiel | bien → Property.owner | oui | 17 historiques connus sans lien fiable | oui si `bien` validé | partiel |
| Paiement | non | partiel | contrat → bien → owner | oui | oui | oui | partiel |
| Accommodation | non | oui | property → owner; hotel → attribution; createdBy → membership | oui | oui | oui | oui |
| AccommodationReservation | non | oui | accommodation + owner + createdBy | oui | oui | oui | oui |
| ActionLog | oui (`tenant`) | oui | contexte de journalisation | faible | nullable | déjà | oui |
| Notification | oui (`platformTenant`) | oui | contexte/recipient | oui | nullable | déjà | oui |

## Surfaces de fuite constatées avant correction

- `documentController`: `findById` et liste sans frontière tenant.
- `conversationController`: tout rôle staff pouvait ouvrir tout ObjectId; messages et staff inbox n'étaient pas tenant-scopés.
- `financialAuthorizationService` et `hotelAccessScopeService`: bypass global explicite pour `role === 'Admin'`, y compris listes et dashboard.

## Décisions

- Une couche unique `tenantResourceAttributionService` fournit un résultat standard `{status, tenantId, proof, confidence}` et un guard fail-closed.
- Les permissions métier existantes restent nécessaires après la frontière tenant.
- Des champs `tenant` nullable/indexés sont justifiés sur les agrégats critiques et les réservations futures. Ils ne déclenchent ni migration ni valeur globale par défaut.
- Les relations contradictoires ne sont pas masquées par un champ calculé. Pour le legacy sans tenant direct, toutes les preuves sont fusionnées.
- Le script `auditTenantAttribution.js` exige une URI explicite en lecture seule et ne possède aucun mode apply.

## Limites et dettes identifiées

- Les 17 contrats historiques sans `bien` fiable demeurent non attribuables; aucune attribution ne doit être inventée.
- Les routes GL et Accommodation qui ne traversent pas encore un middleware tenant doivent être migrées surface par surface lors d'une campagne ultérieure; le résolveur est prêt mais ce sprint corrige en priorité les trois frontières prouvées.
- Les sockets rejoignant des rooms ailleurs que dans les contrôleurs HTTP doivent faire l'objet de la prochaine campagne TENANT-CERT complète.
- Les anciens workflows internes sans contexte tenant peuvent encore produire une réservation nullable si leur établissement legacy est lui-même non attribuable. Les workflows HTTP tenant-validés rejettent une relation incohérente.
