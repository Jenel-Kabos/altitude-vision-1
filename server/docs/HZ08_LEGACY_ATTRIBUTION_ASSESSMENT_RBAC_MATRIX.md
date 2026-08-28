# HZ-08 — Matrice RBAC

| Entrypoint | Role | Allowed? | Tenant required? | Attribution capability |
|---|---|---:|---:|---|
| Contrats/GL/documents GL | Admin, staff selon capability | Oui | généralement oui/résolu | cible par ObjectId ; unresolved toléré |
| RentalManagement staff | staff GL avec capability | Oui | oui (`requireTenantScope`) | cible par ObjectId |
| RentalManagement owner | Proprietaire owner | Oui | non | ownership direct avant garde tenant |
| Proprietaire/Locataire | staff autorisé ; self selon route | Oui | staff oui | cible par ObjectId |
| Document | staff avec `documents.read/manage`; delete Admin | Oui | contexte route | cible Document |
| UserBusinessProfile | self lecture ; staff ; mutation Admin | selon action | staff oui | cible User |
| Property/maintenance | staff ou owner selon action | Oui | staff | cible Property |
| Accommodation/Reservation | staff ; owner/guest selon action | Oui | staff, PO global autorisé sur guards dédiés | cible ressource |
| Conversation/Message | staff ou participant | Oui | staff si contexte actif | participant/ownership reste distinct |
| Client | seulement self/participant/guest prévus | limité | non | aucun pouvoir staff |
| PlatformOperator global | selon garde spécifique | légitime si explicitement permis | non | plateforme seulement là où encodé |
| PlatformOperator scoped | mêmes capacités que le tenant sélectionné | oui | tenant sélectionné | mismatch refusé, unresolved toléré |

Le helper ne modifie pas le RBAC : il intervient après authentification/capability sur les chemins étudiés. Il ne valide pas l'ownership ; chaque domaine doit conserver son garde owner/participant/guest séparé.

