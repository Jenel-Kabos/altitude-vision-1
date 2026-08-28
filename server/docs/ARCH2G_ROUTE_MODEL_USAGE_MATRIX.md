# ARCH-2G — Matrice des usages

Un « usage » est une opération fonctionnelle distincte ; `new+save` et `findById+save` comptent chacune pour une opération. Total : **25 usages** (28 invocations JS si constructeur et `save` sont séparés).

| Edge | Endpoint | Model call | Input | Output | Decision made | Classe |
|---|---|---|---|---|---|---|
| Contrat | `param id` | findById | contratId | contrat | existe et appartient au tenant | TENANT_GUARD |
| Devis | POST `/` | create | body validé | devis | créer puis notifier | MUTATION_ORCHESTRATION |
| Devis | GET `/` | find/sort/populate | auth staff | liste | ordonner la file | QUERY_LOGIC |
| Devis | PATCH `/:id` | findById+save | statut/note | devis | transition et auteur | MUTATION_ORCHESTRATION |
| Estimation | POST `/` | create | payload normalisé/uploads | estimation | créer puis notifier | MUTATION_ORCHESTRATION |
| Estimation | GET `/` | find/page | query staff | page | sélectionner la file | QUERY_LOGIC |
| Estimation | GET `/` | updateMany | IDs lus | compteur modifié | marquer vus | MUTATION_ORCHESTRATION |
| Estimation | GET `/` | countDocuments | aucun | total | pagination | QUERY_LOGIC |
| GestionDoc→Contrat | `param contratId` | findById | id | contrat | existe + tenant | TENANT_GUARD |
| GestionDoc→Paiement | `param paiementId` | findById | id | paiement | existe + tenant | TENANT_GUARD |
| Locataire | middleware id | findById | id | locataire | autoriser dans tenant | TENANT_GUARD |
| Paiement | `param id` | findById | id | paiement | autoriser dans tenant | TENANT_GUARD |
| PlatformTenant | verify domain | findById/select/lean | domainId | tenant | opérateur ou tenant propre | PLATFORM_OPERATOR_GUARD |
| Proprietaire | middleware id | findById | id | propriétaire | autoriser dans tenant | TENANT_GUARD |
| Projet | GET `/` | find/sort | aucun | liste | lister | LEGACY_UNKNOWN |
| Projet | POST `/` | new+save | body | projet | créer | LEGACY_UNKNOWN |
| Projet | PUT `/:id` | findByIdAndUpdate | id/body | projet | modifier | LEGACY_UNKNOWN |
| Projet | DELETE `/:id` | findByIdAndDelete | id | projet | supprimer | LEGACY_UNKNOWN |
| Realisation | GET `/` | find/sort | aucun | liste | lister | QUERY_LOGIC |
| Realisation | GET `/:id` | findById | id | réalisation | retourner/404 | RESOURCE_EXISTENCE_GUARD |
| Realisation | POST `/` | new+save | body | réalisation | créer | MUTATION_ORCHESTRATION |
| Realisation | PUT `/:id` | findByIdAndUpdate | id/body | réalisation | modifier | MUTATION_ORCHESTRATION |
| Realisation | DELETE `/:id` | findByIdAndDelete | id | réalisation | supprimer | MUTATION_ORCHESTRATION |
| RentalManagement | `param id` | findById | id | mandat | owner ou tenant staff | OWNERSHIP_GUARD |
| UserBusinessProfile | target guard | findById/select/lean | userId | cible | cible dans tenant acteur | TENANT_GUARD |
