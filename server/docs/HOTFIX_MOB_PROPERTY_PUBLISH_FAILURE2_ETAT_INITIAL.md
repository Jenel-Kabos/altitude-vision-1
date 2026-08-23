# HOTFIX-MOB-PROPERTY-PUBLISH-FAILURE-2 — ÉTAT INITIAL

Branche : `main`. HEAD au démarrage : `91b40eeaa1418077823161334dfe80258ab987d3` ("Update Altimmo 39").

**Constat important** : HEAD a avancé depuis les hotfix/sprints RBAC précédents de cette session (qui étaient tous non commités sur `63880f58...`). Un commit `91b40ee "Update Altimmo 39"` est apparu entre-temps — vraisemblablement le résultat d'une validation/commit externe à cette conversation. Les 127 documents `server/docs/RBAC*.md`/`HOTFIX_*.md` produits durant cette session sont toujours présents sur le disque, donc aucun travail n'a été perdu.

`git status --short` au démarrage de CE hotfix montre un travail en cours **non lié à cette session** :
```
 M client/app/dashboard/dashboard.css
 M client/lib/pages/dashboard/ManageAccommodationsPage.jsx
 M client/lib/pages/dashboard/ManageHotelsPage.jsx
 M client/lib/pages/dashboard/VisitesPage.jsx
?? client/lib/__tests__/DashboardDarkModeContract.test.jsx
?? server/docs/HOTFIX_DASHBOARD_DARK_MODE_UI1_*.md (7 fichiers)
```

Cela correspond à un chantier `HOTFIX-DASHBOARD-DARK-MODE-UI-1` visiblement en cours dans une autre session/processus (le fichier ouvert dans l'IDE au moment de ce mandat, `ManageHotelsPage.jsx`, en fait partie). **Ce travail n'est pas touché par ce hotfix** — préservé intégralement, conformément à la règle de sécurité git (ne jamais écraser un travail en cours découvert dans le répertoire).

`git diff --check` : exit 0.

## Périmètre de CE hotfix

Diagnostiquer l'échec réel de publication d'un bien depuis `altimmo-app/` (mobile), sans toucher `client/`/`server/` sauf preuve stricte de nécessité backend, sans revenir sur `HOTFIX-MOB-ADD-PROPERTY-1` (type Parcelle, axios Cloudinary), sans modifier RBAC ni la modération Admin.

Aucune modification effectuée avant ce document. Aucun commit/push/déploiement — et en particulier, aucune action ne sera prise sur les fichiers Dark Mode non liés à ce mandat.
