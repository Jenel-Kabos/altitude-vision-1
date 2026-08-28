# ARCH-2B — Matrice de sécurité

| Surface | Résultat |
|---|---|
| Tenant | `platformTenantId` conservé dans le payload ; aucune résolution ou portée modifiée. |
| Isolation | Un événement tenant A est transmis tel quel ; aucun registre par tenant ni fallback vers B. |
| IAM / RBAC | Routes, contrôleurs, middleware et permissions inchangés. |
| PlatformOperator | Inchangé. |
| Ownership | Inchangé. |
| Finance / Hotel / Property / User | Modèles et règles métier intacts. |
| Notification persistée | Modèle, destinataire, contenu, statut et déduplication inchangés. |
| Socket.IO / push / webhook | Code et ordre existants inchangés ; aucun double dispatch ajouté. |
| Données de production | Aucun accès ou script de migration. |
| Provider / réseau | Aucun nouveau provider ou appel. |

Le port transporte uniquement le payload historique minimal ; aucun document Mongoose complet ni PII supplémentaire n'est ajouté.
