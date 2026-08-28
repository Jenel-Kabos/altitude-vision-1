# HZ-06 — Non-régression

- HZ-01, HZ-02, HZ-03, HZ-04, HZ-05 et HZ-07 : cluster 123/123 vert avec HZ-06.
- Hotel public, owner, accès manager/assignment, publication, modération, catégories, chambres, inventaire, réservations et finance : 429/429 verts.
- Le guard canonique n’exige un tenant que pour les rôles staff ; Client/Proprietaire ne reçoivent aucun nouveau droit et leurs contrats ne sont pas resserrés par le filtre Admin.
- Les trois GET restent sans écriture ; états Hotel et Property identiques avant/après.
- Aucun code HZ-01→HZ-05/HZ-07 n’a été modifié pour HZ-06.
