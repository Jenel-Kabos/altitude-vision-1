# PAY-7 — Matrice de statuts Yabetoo

| Statut Yabetoo documenté/observé | Canonical `FinancialPayment` | Legacy immobilier | Legacy visite | Règle |
|---|---|---|---|---|
| `pending` | `pending` | conserver `En attente` | conserver `en_attente` | aucun succès, aucun fallback |
| `processing` | `processing` | actuellement laissé inchangé | actuellement laissé inchangé | reconnu par la documentation de troubleshooting mais absent du mapping actuel ; à ajouter seulement avec tests provider |
| `succeeded` | `succeeded` | `Payé` | `payé` | succès uniquement après réponse serveur ou webhook authentifié |
| `failed` | `failed` | `Échoué` | réponse `échoué`, mais impossible à persister dans l'enum actuel | terminal non réussi ; retry explicite seulement après preuve |
| `cancelled` | `cancelled` | mapping registre seulement | non représentable | ne pas inventer une transition legacy |
| `requires_action` / autre statut | aucun mapping prouvé | état local inchangé | état local inchangé | **fail-closed / unknown**, jamais succès |
| timeout réseau / réponse indéterminée | `pending` ou `processing` futur | paiement local ouvert, parfois sans référence | intent potentiellement créé mais référence non sauvée | résultat inconnu ; jamais `failed` automatique, inquiry obligatoire si référence disponible |

Le registre PAY-3 mappe actuellement `pending`, `succeeded`, `failed`, `cancelled` et rejette tout statut inconnu. Le code legacy ne passe toutefois pas systématiquement par ce normaliseur. Les statuts réels exhaustifs de l'API restent **NON CONFIRMÉS** sans réponses sandbox capturées.
