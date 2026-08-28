# ARCH-2G — Classification

| Edge | Classes présentes | Preuve et conclusion |
|---|---|---|
| Contrat | TENANT_GUARD | `router.param`, résolution tenant et assertion ressource : KEEP. |
| Devis | QUERY_LOGIC, MUTATION_ORCHESTRATION | Trois handlers métier inline : vraie dette extractible. |
| Estimation | QUERY_LOGIC, MUTATION_ORCHESTRATION | Upload, normalisation, lecture qui écrit, notifications : dette réelle mais risquée. |
| GestionDocument→Contrat | TENANT_GUARD | `guardParam` protège opérations documentaires/légales : KEEP. |
| GestionDocument→Paiement | TENANT_GUARD | même guard sur ressource financière : KEEP. |
| Locataire | TENANT_GUARD | assertion explicite sur GET/PUT/DELETE : KEEP. |
| Paiement | TENANT_GUARD | guard commun à toutes les opérations par id : KEEP. |
| PlatformTenantDomain | PLATFORM_OPERATOR_GUARD | tenant chargé avant `assertOwnTenantOrPlatformOperator` : KEEP. |
| Proprietaire | TENANT_GUARD | protège ressource et sous-ressources : KEEP. |
| Projet | LEGACY_UNKNOWN | modèle absent, route non montée : audit de cycle de vie requis. |
| Realisation | QUERY_LOGIC, RESOURCE_EXISTENCE_GUARD, MUTATION_ORCHESTRATION | CRUD non monté et non authentifié : design/lifecycle dédié. |
| RentalManagement | OWNERSHIP_GUARD | owner direct ou staff tenant : KEEP. |
| User | TENANT_GUARD | cible IAM contrainte au tenant acteur : KEEP. |

Aucun usage n'est principalement `APPLICATION_LOGIC`, `AUTHORIZATION_GUARD` ou `TECHNICAL_LOOKUP`; les décisions voisines sont mieux décrites par les classes plus précises ci-dessus.
