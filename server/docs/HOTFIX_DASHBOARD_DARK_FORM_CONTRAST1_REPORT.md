# HOTFIX-DASHBOARD-DARK-FORM-CONTRAST-1 — Rapport final

## Verdict

**D. HOTFIX NOT CERTIFIED.**

Le correctif partagé et sa régression ciblée sont verts, le lint, le build Next et l'architecture passent. La certification stricte reste néanmoins impossible : le navigateur intégré était indisponible pour la validation visuelle réelle, et la suite frontend complète échoue sur un test hôtelier hors périmètre, reproductible isolément. Aucune affirmation visuelle non prouvée n'est présentée comme acquise.

## Réponses obligatoires

1. **HEAD initial :** `36080a71eee31d417ba463391f6e7a2b9ddd3462`, branche `main`.
2. **Worktree initial :** modification mobile de `AdCarousel.jsx` et quatre fichiers mobiles/rapports non suivis préexistants. `git diff --check` était vert.
3. **Changements mobiles préservés :** oui, aucun fichier `altimmo-app/` n'a été modifié par ce hotfix.
4. **Cause exacte :** combinaison A/C/E. La règle globale de `app/globals.css`, `input:not(.input-style), textarea:not(.input-style), select:not(.input-style) { color: #1a1a1a; }`, possède une spécificité supérieure à la règle dashboard construite avec `:where(input, textarea, select)`. Elle pouvait donc imposer un texte sombre malgré `--db-text`. Les contrôles natifs date/heure n'avaient en outre aucun `color-scheme` lié au thème.
5. **Source partagée :** `client/app/dashboard/dashboard.css`, chargé par le layout dashboard et appliqué sous `.dashboard-content-inner`.
6. **Familles touchées :** tous les champs dashboard non `.input-style` dépendant du contrat partagé, notamment texte, number, search, textarea, select, date, time et datetime-local.
7. **Input :** corrigé par le contrat partagé.
8. **Textarea :** corrigé par le contrat partagé.
9. **Select :** select fermé et options couverts par les tokens dashboard ; validation visuelle native non confirmée.
10. **Date :** couleur tokenisée et `color-scheme` lié au thème ; validation visuelle non confirmée.
11. **Time :** idem.
12. **Datetime-local :** idem ; c'est le type utilisé par les deux champs de `/dashboard/visites`.
13. **Placeholder :** `--db-faint` renforcé par `!important`, opacité 1.
14. **Lieu du fix :** uniquement la frontière formulaire partagée de `client/app/dashboard/dashboard.css`.
15. **Tokens existants réutilisés :** oui : `--db-text`, `--db-faint`, `--db-muted`, `--db-surface-input`, `--db-surface-soft`, `--db-border`, `--db-focus`.
16. **Nouvelles couleurs arbitraires :** non.
17. **Mode sombre lisible :** contrat CSS prouvé ; validation visuelle réelle non confirmée.
18. **Mode clair intact :** contrat `color-scheme: light`, tokens clairs et build prouvés ; validation visuelle réelle non confirmée.
19. **`/dashboard/visites` validé visuellement :** non confirmé, navigateur intégré indisponible.
20. **Date lisible :** non confirmé visuellement.
21. **Heure lisible :** non confirmé visuellement.
22. **Champ “Point de rendez-vous” lisible :** non confirmé visuellement.
23. **Placeholder lisible :** contrat CSS testé, rendu visuel non confirmé.
24. **Focus lisible :** règle existante `outline: 2px solid var(--db-focus)` préservée ; rendu visuel non confirmé.
25. **Autres pages contrôlées :** inventaire statique partagé effectué ; smoke visuel bloqué.
26. **Pages/familles inventoriées :** Gestion locative/baux, hébergements, propriétaires, paiements, maintenance et documents, toutes rendues sous le même layout `.dashboard-content-inner` lorsqu'elles exposent des champs.
27. **Disabled/read-only :** contrat amélioré : opacité disabled `0.65`, curseur distinct, read-only sur `--db-muted` et `--db-surface-soft`. Visuel non confirmé.
28. **États erreur :** aucun sélecteur d'erreur n'a été remplacé ; bordures/classes métier préservées. Visuel non confirmé.
29. **RED → GREEN :** oui. RED : 1 suite, 6 tests, 1 échec sur l'absence du contrat formulaire complet. GREEN : 1 suite, 6/6 tests.
30. **Suite complète :** 105 fichiers, 760 tests ; 104 fichiers et 759 tests verts, 1 test hors périmètre en échec : `ManageHotelsPage — archive via le cycle de vie hôtelier`, où `deactivateHotel('HOTEL-1')` n'est pas appelé. L'échec se reproduit isolément (4/5 verts).
31. **Lint :** vert, 0 erreur et 267 avertissements existants.
32. **Build :** `npm run build:next` vert, compilation, contrôle des types et génération des routes réussis.
33. **Architecture :** verte, 473 fichiers, 1 574 edges, 0 nouvelle violation, 0 cycle connu.
34. **`git diff --check` :** vert.
35. **Backend modifié :** non, hors ajout du rapport demandé sous `server/docs/`.
36. **Mongo :** non.
37. **Mobile modifié par ce hotfix :** non.
38. **Fichiers exacts du hotfix :** `client/app/dashboard/dashboard.css`, `client/lib/__tests__/DashboardDarkModeContract.test.jsx`, `server/docs/HOTFIX_DASHBOARD_DARK_FORM_CONTRAST1_REPORT.md`.
39. **Commit :** non.
40. **Push :** non.
41. **Deploy :** non.
42. **Verdict final :** **D. HOTFIX NOT CERTIFIED**, uniquement à cause des gates stricts manquants/rouges décrits ci-dessus. Le correctif ciblé lui-même est GREEN.

## Correction appliquée

- Priorité explicite au token `--db-text` pour neutraliser la règle globale plus spécifique et les anciennes classes locales.
- Surface des champs basée sur `--db-surface-input`, distincte des cartes.
- Placeholder basé sur `--db-faint` avec priorité explicite.
- Options de select basées sur les mêmes tokens, sans palette arbitraire.
- `color-scheme: light` par défaut dans le dashboard, puis `dark` sous préférence OS sombre ou classe `.dark`, afin d'aligner les indicateurs natifs date/heure.
- Focus existant conservé ; disabled/read-only restent distinguables et lisibles.

## Validation restant nécessaire pour certification A

1. Rendre le navigateur réel disponible et ouvrir une session dashboard autorisée.
2. Vérifier `/dashboard/visites` en clair et sombre : deux datetime-local, point de rendez-vous, placeholder, focus et indicateurs natifs.
3. Vérifier au moins trois autres formulaires dashboard, notamment Gestion locative, Maintenance et Documents/Hébergements.
4. Résoudre ou caractériser officiellement le test préexistant `ManageHotelsPage.test.jsx`, puis rejouer la suite complète à 760/760.

Aucune dépendance, aucune modification métier, aucun backend fonctionnel, aucun MongoDB, aucun commit, push ou déploiement n'a été effectué.
