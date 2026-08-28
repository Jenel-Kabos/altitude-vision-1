# HZ-08 — Finding original

## Texte source

`HOTFIX_TENANT_SCOPE_HORIZONTAL_AUDIT1_FINDING_MATRIX.md` :

> HZ-08 | ressources historiques avec `assertResourceTenantOrUnattributed` | ambiguïté de ressources inattribuables | staff tenant | attribution stricte impossible | unresolved est volontairement toléré | P2

`HOTFIX_TENANT_SCOPE_HORIZONTAL_REAUDIT2_OPEN_FINDINGS.md` précise :

> Le helper `assertResourceTenantOrUnattributed` est toujours vivant et largement utilisé. Il refuse une attribution prouvée à un autre tenant, mais tolère volontairement une ressource historique impossible à attribuer. Risque dépendant des données, pas une route unique ni un nouvel exploit statique universel. Une régularisation/migration dédiée reste nécessaire.

## Sens exact

HZ-08 ne désigne ni `assignedTo`, ni une attribution de collaborateur. Il désigne une décision d'autorisation transversale : `resolveResourceTenant()` tente d'attribuer une ressource à un `PlatformTenant`; `assertResourceTenantOrUnattributed()` refuse `ambiguous` et `resolved` vers un autre tenant, mais autorise `unresolved`.

Le qualificatif legacy vient des documents antérieurs à `PlatformTenant` : champs tenant absents/non peuplés, contrats avec adresse libre sans `bien`, utilisateurs sans `OrgMembership`, relations manquantes ou orphelines. Le pattern est P2 car l'exploitabilité dépend de la forme des données et d'un ObjectId connu, derrière authentification/capacités ; ce n'est pas un GET global universel.

