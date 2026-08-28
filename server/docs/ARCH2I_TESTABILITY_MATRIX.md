# ARCH-2I — Matrice de testabilité

| Candidate | Tests existants | Mongo | Auth/tenant | Consumers | Caractérisation future | Difficulté |
|---|---|---|---|---|---|---|
| Estimation | normalisation, badge, laboratoire, valuation | couverture modèle partielle | rôles laboratoire partiels ; tenant N/A | web public + dashboard ; mobile absent | POST multipart/honeypot/uploads/provider failures ; GET pagination+mark-viewed+errors | HIGH |
| Realisation | aucun direct/indirect trouvé | aucun | aucun ; tenant N/A actuel | aucun API web/mobile/backend trouvé | prouver 404 au montage actuel, décider conservation des données, puis contrat CRUD/auth si restauration | MEDIUM lifecycle, LOW couverture |
| Projet | aucun direct/indirect trouvé | impossible sans modèle | aucun | aucun consommateur attribuable à cette route | prouver non-montage/module absent ; décision retirer ou reconstruire, jamais tester CRUD fantôme | LOW |

Pour Estimation, Mongo ciblé est obligatoire, ainsi que doubles Cloudinary/email/notification et tests auth public/staff/refus. Aucun test tenant/ownership/PlatformOperator n'est requis selon le contrat actuel. Pour toute restauration des routes legacy, ces dimensions doivent être redéfinies avant les tests.
