# ARCH-2C4 — Matrice comportementale

| Scénario | Input | Avant | Après | Règle sensible |
|---|---|---|---|---|
| Vente | status caller `vente` | `status=vente` | identique | vente/location |
| Location | `location` | `status=location` | identique | vente/location |
| Hébergement | `hebergement` | `status=hebergement` | identique | séparation domaines |
| Parcelle | `type=Parcelle` | type copié, jamais discriminant transactionnel | identique | type physique |
| Modération initiale | tout payload | `statusAdmin=En attente` | identique | modération |
| Adresse multipart | champs plats | reconstruction + Brazzaville défaut | identique | payload |
| Nombre invalide | valeur non finie | erreur 422 | identique | HTTP indirect |
| Images | fichiers | mêmes options Cloudinary/ordre/filtrage | identique | side effect |
