# PAY-7 — Matrice provider Yabetoo

| Capability | Existing | Secure / prouvé | Core integrated | Action |
|---|---:|---:|---:|---|
| Auth Bearer serveur | Oui | Oui en structure ; credentials effectifs de production NON CONFIRMÉS | Non | Conserver hors clients |
| Création d'intent | Oui | Non certifiée : payload diffère du contrat officiel actuel | Non | Aligner puis valider en sandbox |
| Confirmation | Oui | **Non** : route sans corps divergente de la documentation actuelle exigeant `client_secret` + MoMo | Non | Bloquer la convergence ; obtenir confirmation Yabetoo/version API |
| Status inquiry | Oui (`GET /payment-intents/:id`) | Contrat exact/réponse non validés en sandbox | Non | Valider avant reconciler |
| Webhook | Oui, immobilier seulement | HMAC/timestamp/raw body/déduplication prouvés en code et tests ; secret local absent | Non | Provisionner secret par environnement et test sandbox |
| Idempotence initiation immobilier | Partielle (index Mongo) | Protège les appels concurrents locaux, pas le résultat distant incertain | Non | Ajouter clé provider après validation du header officiel |
| Idempotence initiation visite | Non | Non | Non | Ajouter tentative atomique avant toute réactivation |
| Déduplication webhook | Oui | Oui via `FinancialProviderEvent` | Non | Conserver |
| Statuts normalisés | Registre seulement | Fail-closed pour inconnu ; legacy utilise deux vocabulaires parallèles | Non | Unifier lors d'une migration explicite |
| Reconciliation | Non | Non | Non | Préparer seulement après validation du status inquiry |
| Refund API | Non | Documentation publique : support manuel ; API NON CONFIRMÉE | Non | Rester `false`, ne rien simuler |
| Fees | Non modélisés | Barème/charge NON CONFIRMÉS | Non | Ne pas modifier les montants |
| Currency | XAF codé | XAF est la seule monnaie officiellement documentée | Non | Ne pas annoncer de FX/multi-devise |
| Pays/corridors | CG codé | Documentation publique actuelle : Congo-Brazzaville, MTN/Airtel | Non | Le scope `international` est une cible produit, pas une couverture prouvée |
| Adapter canonique | Non | Impossible à certifier sur transport divergent | Non | **Différé conformément à PAY-7 §62** |

## Registre PAY-3

L'entrée reste honnête sur le point essentiel : `scope: international` et `integratedWithFinancialCore: false`. Ses capacités décrivent l'existence de routes legacy, pas une certification du contrat actuel. Aucun basculement automatique depuis `pending/processing` n'existe. Airtel Direct reste fail-closed ; MTN Direct et manual restent inchangés.
