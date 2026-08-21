# PAY-7 — Matrice sécurité Yabetoo

| Risque | Vente/location | Visites | Preuve / verdict |
|---|---|---|---|
| Callback forgé | Protégé | Sans callback | HMAC-SHA256, timestamp ±300 s, raw body exact, comparaison constante ; secret absent localement => fail-closed 503 |
| Callback répété | Protégé | Sans callback | `FinancialProviderEvent` + transition atomique ; succès non rétrogradé |
| Status forgery client | Protégé | Protégé | le client ne fournit pas le statut ; inquiry serveur ou webhook signé |
| Amount forgery | Protégé | Protégé | montant repris de `Transaction.finalAmount` ou calculé depuis le bien ; champ client ignoré |
| Provider/status mass assignment | Ignoré par l'initiation | Ignoré par l'initiation | seuls `phone`, `operator`, noms sont extraits ; opérateur allowlist MTN/AIRTEL |
| Cross-user | Protégé | Protégé | ownership vérifié avant initiation/polling |
| Cross-tenant | **Partiel / NON CERTIFIÉ** | **Partiel / NON CERTIFIÉ** | staff global autorisé par rôle sur transaction ; aucune contrainte tenant explicite dans ces handlers |
| Double clic | Index Mongo bloque une seconde tentative ouverte par transaction/méthode | **Vulnérable** | visite appelle le provider avant toute réservation atomique et peut créer plusieurs intents |
| Timeout création/confirmation | **Non sûr** | **Non sûr** | aucun timeout explicite/idempotency key ; résultat distant accepté mais local non relié possible |
| Double confirmation | API locale bloquée après paiement ouvert ; retry distant non maîtrisé | Possible par double initiation | contrat provider actuel divergent et non testé |
| Statut inconnu | Fail-closed | Fail-closed en réponse | aucun succès par défaut ; le legacy ne persiste pas un état `unknown` explicite |
| Secret leakage | Secret côté serveur | Secret côté serveur | aucune valeur dans client/mobile ; ne jamais logger header/token/clientSecret |
| Notifications indues | Après succès signé/inquiry | Après inquiry `succeeded` | pas de notification succès à l'initiation |
| Double source | Deux modèles liés mais pas Financial Core | champs parallèles `visitFeeStatus`/`paiementStatus` | dette de cohérence ; aucun miroir Core ajouté |

## Test adversarial requis avant réactivation/convergence

Le futur durcissement doit prouver : confirmation conforme avec `clientSecret`, idempotency key provider, double initiation concurrente visite, timeout après acceptation, inquiry de récupération, cross-tenant staff, statut inconnu, double confirmation, payload massif et secret webhook par environnement. Une assertion verte qui simule uniquement l'ancien transport ne certifierait pas l'API réelle.
