# ARCH-2C2 — Matrice sécurité

| Surface | Résultat |
|---|---|
| Tenant | Inchangé; filtrage et assertions restent en amont |
| Ownership/participation | Inchangé |
| IAM/RBAC | Routes et middleware inchangés |
| PlatformOperator | Tests adversariaux ciblés rejoués |
| Unread | Queries, `isRead`, `readAt` et `unreadCount` inchangés |
| Socket.IO | Payload brut historique et nombre d'émissions inchangés |
| Notification | Appels et événements inchangés |
| Inbox | Inbox Pro/InternalMail hors périmètre et code inchangé |
| Attachments | Descripteurs, endpoints et capacités identiques |
| Champs User privés | Non chargés par les projections REST; tests explicites sur la forme populated sûre |
| Secrets storage | `asset`, URL, publicId/provider/version/deliveryType/resourceType non exposés |
| Production DB | Aucune mutation |
| Frontend/mobile | Lecture seule pour le contrat; aucun changement |
