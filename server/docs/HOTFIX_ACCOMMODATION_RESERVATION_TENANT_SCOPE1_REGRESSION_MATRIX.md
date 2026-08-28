# Matrice de régression

| Action | Autorisé avant | Autorisé après | Cross-tenant avant | Cross-tenant après | Parité effets |
|---|---|---|---|---|---|
| Confirm | oui | oui (Mongo) | statiquement permis | 404 | facture/locks autorisés conservés |
| Cancel | oui | oui (Mongo) | statiquement permis | 404 | suppression locks autorisée conservée |
| Check-in | oui | oui (Mongo) | statiquement permis | 404 | timestamps conservés |
| Check-out | oui | oui (Mongo) | statiquement permis | 404 | timestamps conservés |
| No-show | oui | oui (Mongo) | statiquement permis | 404 | suppression locks autorisée conservée |

