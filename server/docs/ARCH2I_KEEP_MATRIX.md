# ARCH-2I — Edges protégées

| Edge | Classification | Keep? | Reason |
|---|---|---|---|
| Contrat→Contrat | TENANT_GUARD | oui | scope tenant au paramètre |
| GestionDocument→Contrat | TENANT_GUARD | oui | document légal + tenant |
| GestionDocument→Paiement | TENANT_GUARD | oui | finance + tenant |
| Locataire→Locataire | TENANT_GUARD | oui | ressource locative tenant |
| Paiement→Paiement | TENANT_GUARD | oui | finance/tenant/operator |
| PlatformTenant→PlatformTenantDomain | PLATFORM_OPERATOR_GUARD | oui | frontière cross-tenant |
| Proprietaire→Proprietaire | TENANT_GUARD | oui | ressource et sous-ressources |
| RentalManagement→RentalManagement | OWNERSHIP_GUARD | oui | owner ou staff tenant |
| UserBusinessProfile→User | TENANT_GUARD | oui | cible IAM dans tenant acteur |

Les neuf imports sont toujours présents dans la baseline et aucune responsabilité n'a dérivé depuis ARCH-2G. Ils restent hors scope. Une future politique peut les formaliser comme exceptions architecturales explicites, sans les déplacer mécaniquement.
