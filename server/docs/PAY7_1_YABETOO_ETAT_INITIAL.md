# PAY-7.1 — État initial Yabetoo

Audit du 2026-08-21, avant correction. Le client appelle l'API Altimmo avec téléphone/opérateur. Le serveur dérive ressource, payeur et montant. Pour une transaction, il créait un `PaiementTransaction`, appelait CREATE avec données MoMo, appelait CONFIRM sans corps, puis persistait la référence. Pour une visite, il appelait CREATE puis CONFIRM avant toute écriture locale. Le polling faisait GET sur l'intent ; seul l'immobilier recevait le webhook.

Défauts prouvés : contrat CREATE/CONFIRM divergent, aucune protection visite contre le double clic, fenêtre distribuée sans état explicite, timeout Axios non borné, erreurs brutes potentiellement journalisées. L'index partiel immobilier réduisait la concurrence sans traiter l'incertitude distante. Le webhook immobilier était déjà fail-closed : raw body, HMAC-SHA256, timestamp 300 s, comparaison constante et registre de déduplication.

Variables lues : `YABETOO_SECRET_KEY`, `YABETOO_API_URL`, `YABETOO_WEBHOOK_SECRET`. La clé locale est de type sandbox (préfixe seulement vérifié, valeur jamais reproduite). Le secret webhook local est absent. `YABETOO_API_KEY` et `YABETOO_SECRET` ne sont pas consommées. Le test distant final a rejeté l'authentification au CREATE ; la validité effective du credential est donc négative pour l'environnement observé.

Limite irréductible : MongoDB et Yabetoo ne forment pas une transaction atomique. Un crash après acceptation CREATE et avant réception/persistance de l'id reste non réconciliable automatiquement sans idempotence REST ou recherche par clé métier officiellement documentée.
