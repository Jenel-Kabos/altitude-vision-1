# ARCH-2G — Testabilité

| Candidate | Existing tests | Mongo tests | Security tests | Missing characterization | Difficulty |
|---|---|---|---|---|---|
| Devis boundary | aucune suite route dédiée trouvée | non dédiée | auth staff non caractérisée ici | POST/GET/PATCH, erreurs, notification/email best effort | MODERATE |
| Estimation route boundary | normalisation, badge, laboratoire/valuation | partielle ailleurs | auth staff partielle | upload/Cloudinary, liste+mark viewed atomique, provider failures | HARD |
| Projet legacy | aucune trouvée | aucune | aucune | montage, modèle attendu, consommateurs, auth complète | HARD |
| Realisation legacy | aucune trouvée | aucune | aucune | décision de maintien, auth CRUD, contrat complet | HARD |
| Guards tenant/ownership | suites tenantCert, platformAdmin, rental, business-profile, contrats/paiements | oui | oui | aucune extraction recommandée | HARD/CRITICAL |

Devis exigera Mongo pour caractériser réellement la persistance et les transitions. Un Mongo « exhaustif » de tout le monolithe n'est pas requis : une suite ciblée HTTP+Mongo et des doubles pour les providers suffit.
