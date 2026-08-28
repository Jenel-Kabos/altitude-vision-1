# ARCH-2M — Matrice des side effects

Le tableau porte sur les symboles importés, pas sur `protect` (qui met à jour `lastActivityAt` de façon non bloquante) ni sur les services financiers voisins du DomainReport Hotel.

| Edge | DB write | Email | Notification | Socket.IO | Cloudinary | Webhook | Finance |
|---|---|---|---|---|---|---|---|
| Accommodation → `accommodations` | NON | NON | NON | NON | NON | NON | Lectures HIGH : documents, allocations, refunds |
| Hotel → `hotels` | NON | NON | NON | NON | NON | NON | Lectures HIGH : allocations, refunds, soldes |

Les deux fonctions ne font que des `find`, `distinct`, `aggregate`, `countDocuments`, `populate` et `lean`.
