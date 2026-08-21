# PAY-5 — Airtel Money — Matrice API

| Capability | Airtel officiel | Implémenté | Testé mock | Testé sandbox |
|---|---|---:|---:|---:|
| Authentication | Produit accessible après inscription ; mécanisme exact **NON CONFIRMÉ** | non | non | non |
| Collection/initiation | Collection annoncée par Airtel Africa ; contrat exact **NON CONFIRMÉ** | non | non | non |
| Status inquiry | **NON CONFIRMÉ** | non | non | non |
| Callback | **NON CONFIRMÉ** | non | non | non |
| Refund | **NON CONFIRMÉ** | non | non | non |
| Reconciliation | Dépend d'une status inquiry **NON CONFIRMÉE** | non | non | non |

## Paramètres techniques

| Élément | Résultat |
|---|---|
| Marché | Portail officiel `developers.airtel.cg` : Congo-Brazzaville confirmé au niveau portail |
| Collection marchande Congo | Produit générique annoncé ; activation/contrat pour l'application Altitude Vision **NON CONFIRMÉ** |
| Country code API | **NON CONFIRMÉ** (ne pas déduire `CG` sans contrat API) |
| Currency API | Usage local FCFA/XAF cohérent avec Airtel Congo ; valeur de payload API **NON CONFIRMÉE** |
| MSISDN API | **NON CONFIRMÉ** |
| Base URL / environnement | **NON CONFIRMÉ** |
| Auth/token | **NON CONFIRMÉ** |
| Endpoint initiation | **NON CONFIRMÉ** |
| Endpoint inquiry | **NON CONFIRMÉ** |
| Signature callback | **NON CONFIRMÉ** |

Variables `AIRTEL_*` : aucune créée, car leur nomenclature et leur sémantique ne sont pas officiellement confirmées.
