# Contrat de comportement préservé

| Acteur | Contrat après correction |
|---|---|
| Admin tenant A/B | Accès selon les rôles historiques, limité au tenant résolu |
| PlatformOperator global | Vue globale historique conservée |
| PlatformOperator scoped | Vue limitée au tenant sélectionné et autorisé |
| Staff sans tenant actif | 403 fail-closed |
| Proprietaire sans membership | Parcours self-service conservé ; accommodation exige toujours une sélection owned, sinon 422 |
| Rôle non autorisé | 403 historique |
| Anonyme | 401 historique |

Les schémas de réponse, clés, ordres, statuts métier, périodes, sommes, counts, moyennes, fallbacks et formules KPI sont inchangés. L'unique changement fonctionnel porte sur les données autorisées à entrer dans les agrégats. Aucun changement IAM, client web, mobile ou base de production.
