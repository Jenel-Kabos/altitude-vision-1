# ARCH-2A — Matrice de sécurité

| Surface | Impact ARCH-2A | Preuve |
|---|---|---|
| Tenant / isolation | Inchangé | Aucun middleware, modèle ou scope tenant modifié. |
| IAM / RBAC | Inchangé | `iamArchitecture`, rôles, auth et capability middleware intacts. |
| Ownership | Inchangé | Aucune règle métier ou autorisation modifiée. |
| PlatformOperator | Inchangé | Aucun rôle ou contrôle d'accès modifié. |
| Autorisations financières | Inchangé | Finance et ses adapters intacts. |
| Données de production | Aucun accès | Analyse statique locale des fichiers uniquement. |
| Providers externes | Aucun appel | Checker sans réseau, API ni credentials. |
| MongoDB | Non requis | Tests du checker sur fixtures temporaires et graphe de fichiers. |
| Frontend / mobile | Inchangés | Aucun fichier client ou `altimmo-app` modifié. |

Le checker ajoute un contrôle de structure ; il ne s'exécute pas dans le runtime applicatif et ne change aucun comportement de sécurité.
