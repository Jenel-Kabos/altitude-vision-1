# TENANT-HARDENING-1 — Audit initial

## Frontière observée

`PlatformTenant.rootOrgUnit` enveloppe une racine `OrgUnit`; les descendants et `OrgMembership` actifs alimentent `getScopeUserIds`. `UserBusinessProfile` qualifie l'identité et les références métier (`Property.owner`, `Hotel.manager`, etc.) restent les autorisations objet. Ces quatre dimensions sont orthogonales.

## Vulnérabilités confirmées avant écriture

1. `resolveTenantForUser()` utilisait le premier `OrgMembership.findOne()` actif : contexte arbitraire pour un utilisateur A+B.
2. CRM et Marketing étaient montés avec RBAC uniquement; listes, recherche, agrégations et mutations utilisaient des requêtes globales.
3. `CrmCustomer`, opportunités, activités, règles/runs d'automatisation, templates, campagnes, envois et désabonnements ne portaient aucun tenant exploitable.
4. Une clé API sans tenant recevait un scope `null`, interprété comme catalogue global.
5. Les webhooks étaient diffusés à tous les abonnements correspondant au type d'événement.
6. `ActionLog` ne portait ni tenant ni organisation; listes, statistiques et exports Admin étaient globaux.
7. Les quotas de souscription étaient déclaratifs uniquement.

## Matrice de classification

| Domaine / collections | Source avant sprint | Classe | Risque | Décision |
|---|---|---:|---:|---|
| PlatformTenant*, OrgUnit, OrgMembership | tenant/root explicites | A | faible | fondation canonique conservée |
| User, UserBusinessProfile | memberships indirects | B | moyen | scope par `getScopeUserIds` |
| CRM Customer/Opportunity/Activity/Consolidation | global / relations User | D | critique | `tenant` additif + routes obligatoires |
| CRM Automation Rule/Run | global | D | critique | `tenant` additif; propagation à poursuivre sur tous producteurs legacy |
| Marketing Template/Campaign/Send/Unsubscribe | global | D | critique | `tenant` additif et services scopés |
| ActionLog | auteur indirect | D | critique | tenant/organisation additifs, lecture/export scopés |
| API publique | `ApiKey.tenant` optionnel | A/F | critique | clé null fail-closed (catalogue vide) |
| WebhookSubscription | ApiKey indirecte | D | critique | tenant explicite, dispatch fail-closed |
| Reporting / ERP | `tenantId` alias `orgUnitId` | B | moyen | mécanisme existant conservé; KPI non honnêtes doivent rester null/unsupported |
| Property / RentalManagement | owner/manager | C | élevé | isolable via scope utilisateurs; couverture transversale complète restante |
| Contrat / Locataire / Proprietaire | bien/utilisateur | C | élevé | relation métier existante, aucun tenant inventé |
| Hotel / Reservation / StaffAssignment | manager/hotel/user | C | élevé | services d'accès objet existants à combiner au tenant |
| Accommodation / Reservation | property.owner/owner/guest | C | élevé | relation métier existante |
| Finance / Documents DOC-EVO | document source/createdBy/customer | C/F | élevé | certaines métriques non honnêtement scopables restent dette |
| Notification | recipient + tenant additif | B/D | élevé | champ `platformTenant` ajouté; producteurs doivent le propager |
| Conversation / Message | participants | C | élevé | isolation tenant exhaustive restante |
| Référentiels publics statiques | aucune donnée cliente | E | faible | volontairement globaux |

## Mobile

Le Mobile ne possède pas de sélecteur de tenant fiable. Aucun faux support n'a été ajouté. Tant qu'un utilisateur mobile multi-tenant ne choisit pas un contexte serveur validé, les routes durcies échouent fermées. Les caches existants restent une dette à partitionner par tenant avant exposition UX multi-tenant.

## Super-administration

Le rôle `Admin` ne prouve pas une capacité de super-administration plateforme distincte. Aucune exemption cross-tenant implicite n'a été ajoutée. Les routes SaaS historiques réservées Admin restent à refondre lorsque cette identité sera modélisée explicitement.

## Complément de reprise — frontières découvertes

L'audit de reprise a identifié deux frontières critiques supplémentaires :

1. le Property Portfolio staff agrégeait ses quatre sources sans scope tenant ;
2. CRM Automation conservait des champs tenant sur les modèles mais sélectionnait encore globalement règles, clients, opportunités et templates dans sa chaîne d'exécution.

Les deux ont été corrigées en fail-closed et couvertes avec Tenant A/Tenant B. La fixture Playwright a également été rendue représentative par création explicite d'un PlatformTenant, d'une racine OrgUnit et de memberships actifs.

## Limite formelle de l'audit

Les suites historiques Finance, Documents, Conversation, GL, Hotel et Accommodation sont vertes, mais elles ne constituent pas à elles seules la matrice adverse exhaustive demandée (READ/WRITE/SEARCH/EXPORT/AGGREGATE avec ObjectId B). Ces domaines restent donc classés « non certifiés globalement » jusqu'à ajout de preuves dédiées, même si aucune régression n'a été observée.
