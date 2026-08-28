# ARCH-2L — Contrat comportemental

| Scénario caractérisé avant production | Invariant |
|---|---|
| Owner A complet / Owner B contaminant | Seules les données A contribuent |
| Plusieurs owners | Union exacte des owners fournis |
| PlatformOperator/global sans scope | Toutes les données contribuent |
| Owner valide sans donnée | Objet `kpis` complet à zéro, sans `_id` |
| Données partielles | Données présentes + fallbacks exacts ; `_id:null` historique conservé si agrégation non vide |
| Erreur Property | Même objet Error rejeté, aucun fallback |

KPI verrouillés : available, occupied, notices, activeContracts, expiringContracts, rentCollected, unpaidRent, penalties, maintenance. Aucun tableau, null, pagination ou ordre métier n'est ajouté. `locationReport` continue d'ajouter seulement `domain:'location'` et `periodSupported:false`.

Caractérisation avant extraction : 5/5 tests Mongo dédiés, 9/9 Dashboard et 13/13 Reporting, soit 27/27. Le test global PlatformOperator a été ajouté au même contrat et est rejoué après extraction.
