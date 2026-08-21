# PAY-7 — Matrice des domaines Yabetoo

| Domaine | Endpoint | Modèle / source actuelle | Provider | Statut | Callback | Financial Core ? | Verdict |
|---|---|---|---|---|---|---|---|
| Vente immobilière | `POST /api/transactions/:id/paiements/initier`; `GET /api/transactions/:id/paiements/verifier/:intentId`; `POST /api/transactions/paiements/webhook` | `PaiementTransaction` (paiement), `Transaction` (agrégat) | `yabetoo_momo` | `En attente`, `Payé`, `Échoué`, `Annulé`; agrégat parallèle | Webhook public HMAC + polling | Non | **KEEP LEGACY / BLOCKED** jusqu'au durcissement réseau ; aucune migration Core pendant PAY-7 |
| Location immobilière (listing) | mêmes endpoints transaction | mêmes modèles | `yabetoo_momo` | mêmes statuts | même webhook + polling | Non | **KEEP LEGACY / BLOCKED** |
| Paiement de visite | `POST /api/visites/:id/paiement/initier`; `GET /api/visites/paiement/verifier/:intentId` | champs embarqués de `Visite` | Yabetoo implicite | `non_requis`, `en_attente`, `payé`, `exempté` | Aucun ; polling client-déclenché | Non | **BLOCKED / SECURITY HARDENING REQUIRED** : double initiation et statut bloqué possibles |
| Hébergement / hôtel | aucun | Financial Core hôtel séparé | aucun | sans objet | aucun | Non pour Yabetoo | **NON BRANCHÉ** ; ne pas ajouter dans PAY-7 |
| Réservation hôtelière | aucun | modèles/Financial Core existants | aucun | sans objet | aucun | Non pour Yabetoo | **NON BRANCHÉ** |
| Gestion locative / loyers | aucun | Financial Core/gestion locative existants | aucun | sans objet | aucun | Non pour Yabetoo | **NON BRANCHÉ** |
| Autres domaines | aucun usage trouvé | aucun | aucun | sans objet | aucun | Non | **NON CONFIRMÉ au-delà de la recherche repository** |

## Stratégie de convergence

- Vente/location : le legacy reste la seule source de vérité jusqu'à validation sandbox et conception d'une migration explicite. Aucun miroir n'est créé.
- Visites : le schéma embarqué doit d'abord acquérir une identité de tentative, une idempotence atomique, un état `unknown/processing` et une réconciliation. Il ne doit pas être recopié aveuglément dans `FinancialPayment`.
- Hôtel : futur candidat naturel au Financial Core, mais explicitement hors périmètre tant que l'adaptateur n'est pas certifié.
