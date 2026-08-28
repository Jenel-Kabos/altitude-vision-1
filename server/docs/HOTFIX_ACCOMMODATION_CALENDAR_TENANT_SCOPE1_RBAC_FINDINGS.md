# Findings RBAC hors scope

## RBAC-FINDING-01 — candidat séparé

- Endpoint : `GET /api/accommodations/:id/availability-blocks`.
- Rôle/action : tout utilisateur authentifié peut lire les blocks, sans rôle staff ni ownership.
- Middleware actuel : `auth.protect` uniquement ; aucune restriction RBAC additionnelle.
- Impact potentiel : exposition de dates, raisons et métadonnées de blocage à un utilisateur connaissant l'ObjectId.
- Décision : laissé strictement inchangé afin de préserver `RBAC après = RBAC avant`.
- Recommandation : caractériser et décider séparément dans `HOTFIX-ACCOMMODATION-CALENDAR-RBAC-1`.

Ce finding n'est pas utilisé pour diminuer artificiellement les permissions dans ce sprint.
