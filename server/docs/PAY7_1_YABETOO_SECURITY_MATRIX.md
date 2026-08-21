# PAY-7.1 — Matrice sécurité Yabetoo

| Contrôle | Résultat |
|---|---|
| Bearer | serveur seulement, configuration fail-closed |
| clientSecret | mémoire seulement, jamais réponse/log/persistance |
| logs | code/taxonomie uniquement ; pas de payload Axios ni credential |
| montant | dérivé du modèle, entier positif ; montant client ignoré |
| propriétaire | transaction/visite contrôlée avant provider |
| référence | lookup local + ownership ; index unique provider |
| webhook secret absent | 503, fail-closed |
| signature absente/invalide | 401 |
| timestamp expiré | 401, fenêtre 300 s |
| raw body absent | 400 |
| replay | registre unique `FinancialProviderEvent` |
| out-of-order | succès terminal ne régresse pas |
| statut inconnu | jamais succès |
| MSISDN | présence seulement ; aucune normalisation nationale inventée |
| production | aucun appel ni débit effectué |
