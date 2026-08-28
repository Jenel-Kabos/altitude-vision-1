# Matrice sécurité finale

| Actor | Tenant | Expected list |
|---|---|---|
| Admin A | A | A1/A2 uniquement |
| Admin B | B | B1/B2 uniquement |
| Collaborateur/GestionnaireImmobilier/CommunityManager sans tenant | aucun | 403, aucune donnée |
| PlatformOperator global | global | A+B, contrat légitime |
| PlatformOperator scoped A | A | A seulement |
| PlatformOperator scoped B | B | B seulement |
| Proprietaire | N/A | `owner=self` uniquement |
| Client | N/A | `guest=self` uniquement |
| autre rôle authentifié | N/A | scope guest historique |
| anonymous | N/A | 401 |
| tenant valide sans réservation | tenant valide | 200 liste vide |

Tenant sélectionné inaccessible/invalide : 403 par la primitive canonique. Aucun tenant fourni par le client n'est accepté sans validation serveur.
