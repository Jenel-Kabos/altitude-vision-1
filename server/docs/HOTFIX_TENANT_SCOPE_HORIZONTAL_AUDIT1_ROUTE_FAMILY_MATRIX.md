# Matrice des familles de routes

| Famille | Préfixes montés principaux | Auth | Résolution tenant dominante | PlatformOperator / ownership | Risque |
|---|---|---|---|---|---|
| Property | `/api/properties`, sale/rental/property-asset | public/optional/protect | mix inline + `requireTenantScope` | owner direct ; opérateur sélectionné sur actions | P0 listes staff/modération |
| Rental | proprietaires, locataires, contrats, paiements, rental-* | protect + capacités | canonical/inline attribution | owner/locataire spécifiques | Safe majoritaire |
| Hotel | `/api/hotels`, housekeeping, inspections, maintenance | protect | attach non bloquant + domain scope | manager/assignments | P0 listes Admin |
| Accommodation | `/api/accommodations` | protect après public | checks inline par ressource | createdBy/owner | P0 listes + calendrier |
| Finance | `/api/financial`, `/api/paiements`, providers | protect + capacités | attach + financial authorization / attribution | opérateur capacités explicites, owner read | Safe majoritaire |
| Documents | documents, gestion-docs, rental-documents, dossiers | protect + capacité | `requireTenantScope` ou `router.param` attribution | owner/tenant selon document | Safe majoritaire |
| CRM | `/api/crm`, automation | protect + staff | `requireTenantScope` | scoped uniquement | Safe |
| Messaging | conversations, messages, internal-mails, emails | protect | attach optionnel + participant/tenant guards | ownership participant | Safe observé, drift P2 |
| Users | users, business profiles, platform tenants/operators | protect + Admin | `requireTenantScope`/param guards | opérateur contrôlé | Safe majoritaire |
| Transactions | `/api/transactions` | protect/RBAC | property/actor relations | ownership/domain guards | Aucun P0 démontré |
| Payments | paiements/financial/providers | mixed callback/protect | attribution ou provider signature | capacités | Aucun P0 additionnel démontré |
| Visits | `/api/visites` | protect/ownership | property/participants | client/staff contract | Aucun P0 démontré |
| Estimation | `/api/estimation` | mixed | ownership/workflow | pas de tenant global prouvé | P2 à caractériser séparément |
| Devis | `/api/devis` | protect/RBAC | application boundary et ownership | rôle/owner | Aucun P0 démontré |
| Dashboard | dashboard + dashboard-analytics | protect | canonical depuis hotfix certifié | opérateur global/scopé explicite | Safe |
| Reports | `/api/reporting`, `/api/erp`, export | Direction/Admin | canonical | global uniquement reporting opérateur | Safe |
| Other | organization, marketing, public API, audit, notifications | variable | canonical/API-key tenant/attribution | capacités explicites | Safe majoritaire |

Toutes ces familles sont montées dans `server/server.js`. « Safe majoritaire » ne signifie pas certification de chaque feature non tenant-aware ; il signifie qu'aucun chemin cross-tenant comparable n'a été démontré dans l'analyse ciblée de cette famille.
