# HOTFIX-DASHBOARD-DARK-MODE-UI-1 — État initial

## Baseline

- Branche : `main`.
- HEAD initial : `91b40ee` (`Update Altimmo 39`).
- Changements externes préexistants : `ManageAccommodationsPage.jsx` et `ManageHotelsPage.jsx` (621 insertions nettes environ). Ils sont hors hotfix et doivent être préservés.
- Aucun backend, contrat API, rôle, permission ou workflow n'est dans le périmètre.

## Système de thème observé

- Le dashboard possède un shell et des tokens CSS centralisés dans `client/app/dashboard/dashboard.css`.
- La palette sombre est activée uniquement par `@media (prefers-color-scheme: dark)`.
- Tailwind ne déclare pas explicitement `darkMode`; les variantes `dark:*` suivent donc le comportement par défaut de la version installée.
- Aucun `ThemeProvider`/`next-themes` ni bascule `.dark` applicative n'a été trouvé dans le dashboard.
- Les primitives `DashboardUI.jsx` utilisent correctement les classes sémantiques `dashboard-*`.
- Les pages historiques utilisent encore directement `bg-white`, `bg-gray-*`, `bg-slate-*`, `text-*`, bordures, dégradés et styles inline.

## Symptômes reproduits dans le code

- `VisitesPage` : canvas clair `from-slate-50 to-blue-50`, titre clair historique et styles inline hexadécimaux.
- `DevisPage` : même canvas clair et surfaces `bg-white`.
- `EstimationsPage` : canvas `bg-slate-50`, nombreuses surfaces `bg-white`/`bg-slate-*`, composants experts historiques imbriqués.
- Le shell sombre et les pages claires peuvent donc coexister dans le même rendu.

## Volumétrie

- Routes réelles sous `client/app/dashboard` : inventaire exhaustif effectué depuis le dépôt.
- Composants dashboard audités statiquement : 132.
- Composants contenant au moins une couleur utilitaire/directe : 125.

## Verdict initial

Root cause composite : tokens incomplets pour les pages historiques, activation sombre liée seulement au système, canvases locaux clairs et styles inline non tokenisés. Ce n'est pas un défaut métier ou RBAC.
