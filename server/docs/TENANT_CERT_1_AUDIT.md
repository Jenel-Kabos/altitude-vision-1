# TENANT-CERT-1 — Audit adversarial

## Conclusion d'audit

La plateforme n'est pas certifiable en l'état. Les protections historiques sont majoritairement des guards de rôle, participant, propriétaire, manager ou staff assignment. Elles ne distinguent pas systématiquement un Admin du Tenant A d'un Admin du Tenant B.

## Surface et guards observés

| Domaine | Source de portée actuelle | Lecture/écriture | Risque tenant démontré |
|---|---|---|---|
| Finance | Hotel.manager, assignments, capacités | guards centraux solides pour propriétaires/staff | `Admin` bypass global explicite |
| Document | createdBy/client/property présents mais non utilisés comme guard | listes et `findById*` globaux | READ/LIST/UPDATE/DELETE cross-tenant |
| Conversation | participant ou `ALL_STAFF` | participant sûr; tout staff bypass | thread/messages B accessibles au staff A |
| GL | Property.owner/RentalManagement relations, RBAC GL | guards propriétaire partiels; staff global | listes et mutations staff non tenant-scopées |
| Hôtel | manager/HotelStaffAssignment/capacités | très bonne isolation objet hors Admin | Admin global et listes admin globales |
| Accommodation | Property.owner pour propriétaires, RBAC staff | ownership hors staff | files/listes/actions staff globales |
| Property Portfolio | `requireTenantScope` + owner scope | tenant-scopé | couvert et sûr |
| CRM/Marketing/Automation | tenant direct + middleware | tenant-scopé | couvert par TENANT-HARDENING |
| API publique/Webhook | ApiKey tenant + événement tenant | fail-closed | couvert par TENANT-HARDENING |

## Routes critiques auditées

- Finance : toutes les routes de `financialRoutes`, dashboards, documents/PDF/email, paiements, allocations et ledger.
- Documents : liste, détail, création, modification et suppression de `documentRoutes`; téléchargements locatifs séparés.
- Conversations : staff inbox, inbox personnel, détail, messages, mark-read, delete et création.
- GL : onboarding, listes/stats, détail, lifecycle, maintenance, paiements, contrats, préavis et régularisation.
- Hôtel : portefeuille/admin/mine, rooms/categories/rates/inventory/assignments, réservations et opérations.
- Accommodation : admin/mine, CRUD, rates/blocks/calendar, réservations, paiements, remboursements et documents financiers.

## Fuites prouvées par Mongo réel

La suite `tenantCert.audit.mongo.integration.test.js` crée Tenant A et B avec des ObjectId distincts et prouve trois comportements interdits :

1. Admin A lit et liste un `Document` créé par Admin B malgré un header Tenant A.
2. Admin A lit par ObjectId une `Conversation` contenant uniquement des participants B.
3. Admin A passe `assertFinancialScope` sur Hotel B grâce au bypass global Admin.

Ces tests sont des tests de caractérisation : ils restent verts en affirmant le comportement vulnérable observé, afin que la preuve soit reproductible sans prétendre qu'il est acceptable.

## Blocage de correction sûre

`Document`, `Conversation`, `Message`, plusieurs collections GL et des artefacts Finance ne portent pas tous un tenant canonique. Certaines relations permettent une dérivation, d'autres sont polymorphes ou legacy. Ajouter seulement `requireTenantScope` viderait ou casserait les accès légitimes; conserver le bypass staff fuit entre tenants. Une correction sûre nécessite une règle d'attribution par collection et une procédure de régularisation des enregistrements non dérivables. Aucun tenant ne doit être inventé automatiquement.
