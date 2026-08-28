NEXT ARCHITECTURAL PRIORITY:
ROUTE→MODEL — PILOTE DASHBOARD KPI (`dashboardRoutes.js`)

WHY NOW:
Quatre edges read-only sont concentrées dans un endpoint, sans tenant, ownership, IAM spécifique, provider ni mutation. Une extraction locale vers un query/service KPI explicite réduirait la fuite DB de la route avec un blast radius minimal et un contrat API simple à caractériser.

WHY NOT REPORTING:
Les quatre edges cachent quatre query domains, 15+ modèles, finance et scope Hotel/tenant. Un service unique deviendrait un God Object ; une extraction par domaine demande un sprint transversal dédié.

WHY NOT ROUTE→MODEL:
Le programme complet n'est pas recommandé en bloc. Ne traiter que le cluster dashboard ; les neuf guards tenant/ownership sont des middlewares de sécurité potentiellement légitimes et ne doivent pas être déplacés mécaniquement.

WHY NOT PROPERTY FACADE:
Une façade globale centraliserait trop de responsabilités et risquerait publication, modération, tenant et ownership. Préférer plus tard des application/query services par use case.

WHY NOT RUNPROPERTYSEARCH:
Le prédicat public, la pagination et le post-filtre Accommodation restent sensibles. La couverture doit être complétée avant extraction.

NEXT SPRINT:
ARCH-2F — DASHBOARD KPI ROUTE BOUNDARY. Caractériser `/api/dashboard/stats`, extraire uniquement la lecture des cinq KPI vers un owner explicite, conserver auth/HTTP dans la route, viser route→model 17→13, cycles/new/stale à 0.
