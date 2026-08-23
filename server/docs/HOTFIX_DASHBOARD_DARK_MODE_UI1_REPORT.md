# HOTFIX-DASHBOARD-DARK-MODE-UI-1 — Rapport final

## Verdict

**GO SOUS RÉSERVES — validation visuelle réelle requise.**

Le contrat de thème du dashboard est corrigé de façon systémique et les tests ciblés sont verts. La certification complète n'est pas prononcée : le navigateur intégré n'était pas disponible et la suite frontend complète contient quatre échecs provenant exclusivement des deux fichiers hôtellerie déjà modifiés avant ce hotfix.

## Problèmes prouvés

- Palette sombre centralisée mais limitée à `prefers-color-scheme`.
- Couche de compatibilité historique incomplète : absence de `slate`, gradients, bordures, placeholders, focus, disabled et surfaces sémantiques.
- Visites, Devis et Estimations imposaient chacun un canvas clair dans le shell sombre.
- Visites contenait en plus plusieurs surfaces/textes inline hexadécimaux échappant au thème.
- 125 composants dashboard sur 132 contiennent au moins une couleur utilitaire ou directe : le défaut est transversal.

## Corrections systémiques

- Hiérarchie de tokens enrichie : fond, surface, surface solide, surface douce, surface surélevée, input, texte, muted, faint, focus, bordure et ombres.
- Compatibilité centralisée des palettes historiques `gray` et `slate` sous `.dashboard-content-inner`.
- Normalisation centrale des canvases gradient, bordures, champs, placeholders, focus, disabled, tableaux et skeletons.
- Variantes sombres sémantiques conservant les accents information, warning, erreur et succès.
- Support additif de `.dark .dashboard-shell` en plus de la préférence OS, sans introduire de ThemeProvider concurrent.

## Correction locale nécessaire

Les styles inline de `VisitesPage` ont été reliés aux tokens existants. Aucun comportement de visite, appel de service, statut ou action n'a changé.

## Sécurité et métier

- Aucun backend modifié.
- Aucun contrat API, route, permission, rôle, capability ou tenant scope modifié.
- Aucun workflow immobilier, hôtelier, locatif, paiement ou modération modifié.
- `SafeHtmlEmailViewer` et son sandbox n'ont pas été modifiés.
- Navigation et structure des actions préservées par les tests ciblés.

## Pages couvertes statiquement

Toutes les routes réelles sous `client/app/dashboard/**` ont été inventoriées. La correction centrale s'applique au shell commun, notamment dashboard, properties, sales, rentals, estimations, devis, visites, gestion locative, hôtellerie, modération, communications et administration.

## Validation visuelle

Le navigateur intégré était indisponible et le serveur local ne pouvait pas ouvrir le port 3000 dans le sandbox courant. Aucune affirmation de certification visuelle n'est donc faite. Restent à contrôler réellement en Light/Dark et desktop/laptop/tablet : dashboard, properties, sales, rentals, estimations, devis, visites, une page GL, une page Hôtel, une page Modération et Inbox.

## Gates

| Gate | Résultat |
|---|---|
| Tests ciblés thème et composants partagés | **57/57 verts**, 6 fichiers |
| Suite frontend complète | **693/697 verts** ; 4 échecs externes dans `ManageAccommodationsPage`/`ManageHotelsPage` |
| Lint frontend | **0 erreur**, 267 avertissements existants dans le worktree courant |
| Build Next production | **Vert**, code 0 |
| Validation navigateur | Bloquée : navigateur intégré indisponible |
| `git diff --check` | **Vert** |

## Changements externes préservés

`ManageAccommodationsPage.jsx` et `ManageHotelsPage.jsx` étaient déjà modifiés au démarrage (environ 621 insertions nettes). Le hotfix n'a écrit dans aucun de ces fichiers. Les quatre échecs complets correspondent à des tests devenus incompatibles avec ces modifications externes : loading/alert/liens opérationnels côté hébergement et archivage côté hôtel.

## Dette restante

- Effectuer la validation visuelle réelle multi-résolution.
- Résoudre dans le sprint propriétaire les quatre tests hôtellerie externes.
- À terme, expliciter la stratégie Tailwind `darkMode` et un éventuel contrôle utilisateur unique ; ce hotfix n'introduit volontairement pas un second système de thème.

Aucun commit, push, déploiement ou changement de données n'a été effectué.
