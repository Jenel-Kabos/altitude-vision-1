# PAY-5 — Airtel Money — Matrice sécurité

| Risque | Protection actuelle | Test / preuve |
|---|---|---|
| Callback forgé | Aucune route Airtel publique ; capability webhook `false` | Registre fail-closed |
| Double débit | Aucune initiation Airtel possible ; futurs appels devront réutiliser l'idempotence Financial Core | Tests PAY-3/PAY-4 existants |
| Callback dupliqué | Sans objet tant que callback non implémenté | NON CONFIRMÉ pour futur contrat |
| Montant altéré | Aucune route Airtel ; le bridge futur devra reprendre le solde serveur PAY-4 | Architecture auditée |
| Statut forgé | Table Airtel vide ; toute valeur est rejetée | Test registry PAY-5 |
| Accès cross-owner | Aucune route Airtel ; futurs handlers devront réutiliser l'autorisation Financial Core | Tests sécurité PAY-4 existants |
| Fuite de secret | Aucun secret/variable/log Airtel créé | Recherche dépôt |
| Fallback provider | `assertFallbackAllowed` interdit pending/processing/succeeded | Tests registry existants |
| Faux affichage opérationnel | `integratedWithFinancialCore=false`, capabilities réseau `false` | Test registry PAY-5 |

Un callback Airtel futur ne pourra confirmer directement un paiement tant que son authenticité officielle n'est pas démontrée. Le modèle imposé sera callback-signal → status inquiry authentifiée → transition canonique atomique.
