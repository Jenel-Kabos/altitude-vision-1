# HZ-08 — Décision

## D. AUDIT CERTIFIÉ — DEFER

HZ-08 est une dette legacy LIVE, mais pas une vulnérabilité cross-tenant universelle : toute ressource attribuée à B est refusée à A, les ambiguïtés sont fail-closed et aucun client ne choisit directement un tenant ou un assignee à persister via ce helper. La faiblesse est limitée aux ressources `unresolved`, dont l'autorité tenant n'est pas démontrable.

La dette ne peut pas être fermée par une modification isolée du helper. La garde stricte casserait des cas historiques légitimes ; la suppression casserait des consommateurs LIVE ; le service de régularisation ne traite automatiquement que 67 ressources A déterministes, tandis que 309 B/D/F exigent revue ou réparation.

Prochain sprint nécessaire : `HZ08-LEGACY-DATA-AUTHORITY-REGULARIZATION-1`, après levée des préconditions de données et autorisation explicite. Il devra séparer : application contrôlée des A, décision humaine B, réparation D, politique F, puis dépréciation progressive des WRITE paths unresolved. Aucun de ces travaux n'est exécuté ici.

HZ-08 reste OPEN/DEFERRED P2. HZ-09 demeure ensuite ouvert. Un audit horizontal final est recommandé après traitement séparé de HZ-08 et HZ-09.

