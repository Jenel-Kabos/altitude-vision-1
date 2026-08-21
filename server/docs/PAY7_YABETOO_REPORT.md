# PAY-7 — Yabetoo International — Rapport final

## Verdict

**PAY-7 — YABETOO INTERNATIONAL : GO SOUS RÉSERVES — BLOCKED / SECURITY HARDENING REQUIRED.**

L'audit est complet au niveau du repository et de la documentation publique officielle. La convergence Financial Core est volontairement stoppée : canoniser ou étendre le transport actuel créerait un faux sentiment de sécurité alors que la confirmation codée diverge du contrat officiel actuel, que les visites ne sont pas idempotentes et que les timeouts peuvent laisser un résultat distant inconnu.

## Réponses aux 39 questions obligatoires

1. Yabetoo est utilisé pour les transactions immobilières vente/location et les paiements de visite.
2. Endpoints : transaction initiation, polling et webhook ; visite initiation et polling (détails dans la matrice domaine).
3. Modèles : `PaiementTransaction` + `Transaction`, et champs embarqués de `Visite` ; `FinancialProviderEvent` déduplique le webhook immobilier.
4. Domaines : vente, location listing, visites. Hôtel, réservation et gestion locative : aucun branchement.
5. Source de vérité : `PaiementTransaction` pour le paiement immobilier avec agrégat `Transaction`; `Visite` pour les visites.
6. Auth provider : Bearer secret key côté serveur.
7. Initiation : création d'un Payment Intent puis confirmation ; la confirmation codée est divergente de la documentation officielle actuelle.
8. Callback : webhook public uniquement pour l'immobilier ; aucun callback visite.
9. Oui, le callback immobilier est authentifié par HMAC-SHA256, timestamp et raw body, puis dédupliqué. Il échoue fermé sans secret.
10. Une inquiry `GET /payment-intents/:id` est codée ; son contrat réel n'a pas été validé en sandbox pendant PAY-7.
11. Statuts effectivement traités : `succeeded`, `failed`; `pending` est implicite. `cancelled` est seulement dans le registre. Exhaustivité : NON CONFIRMÉE.
12. Le registre normalise et échoue fermé ; les contrôleurs legacy ne l'utilisent pas et maintiennent leurs vocabulaires propres.
13. Idempotence : webhook oui ; initiation immobilière partielle via index Mongo ; visite non.
14. Immobilier : le second paiement local ouvert est bloqué. Visite : oui, un double clic peut créer deux intents.
15. Non. Un timeout peut survenir après acceptation distante sans référence locale exploitable.
16. Oui, le montant est calculé côté serveur dans les deux domaines.
17. Oui pour le propriétaire client de la ressource ; tests existants couvrent notamment le polling transaction.
18. NON CERTIFIÉ : le rôle staff donne un accès transaction sans filtre tenant explicite dans ces handlers.
19. Non, aucun `FinancialPayment` Yabetoo aujourd'hui.
20. Aucun domaine ne doit migrer avant durcissement. Après certification, hôtel/flux futurs pourront utiliser un adaptateur Core ; le legacy sera traité domaine par domaine.
21. Vente/location et visites restent legacy pendant PAY-7.
22. Non, aucun miroir Core n'est créé.
23. Oui au niveau documenté ci-dessus, mais `Transaction` et `Visite.visitFeeStatus` créent des agrégats parallèles à réconcilier.
24. Non pour Yabetoo.
25. Non pour Yabetoo.
26. Non ; le receipt PAY-6.1 n'est pas applicable tant qu'il n'y a pas de convergence Core.
27. Oui au niveau du diff PAY-7 : MTN n'est pas modifié ; gate ci-dessous.
28. Oui, Airtel Direct reste fail-closed. L'option Airtel de l'agrégateur Yabetoo est distincte et legacy.
29. Oui au niveau du diff PAY-7 : manual n'est pas modifié ; gate ci-dessous.
30. Vente : code non modifié ; comportement legacy caractérisé, mais réseau réel NON CERTIFIÉ.
31. Location : même verdict.
32. Visites : code non modifié, donc pas de régression introduite ; flux existant classé fragile/non certifié.
33. Résultats des tests : voir Gates.
34. Mongo : voir Gates ; aucun schéma/index PAY-7 ajouté.
35. Lint : voir Gates.
36. `git diff --check` : voir Gates.
37. Fichiers PAY-7 modifiés : uniquement les six documents `server/docs/PAY7_YABETOO_*.md`.
38. Dette : contrat API, sandbox, idempotence visite/provider, timeout/inquiry, tenant staff, réconciliation, statuts legacy, secrets/runtime, logging structuré.
39. Verdict : **GO SOUS RÉSERVES — BLOCKED / SECURITY HARDENING REQUIRED**.

## Décisions d'architecture

- `scope: international` reste une classification stratégique. La documentation publique actuelle ne prouve que Congo-Brazzaville, MTN/Airtel et XAF : aucune communication « Afrique internationale » ne doit être faite comme couverture effective.
- `integratedWithFinancialCore: false` reste exact.
- Aucun `YabetooPayment`, ledger, allocation, reçu ou source miroir n'est créé.
- Aucun fallback automatique depuis un état pending/processing.
- Aucun adaptateur canonique n'est créé tant que son transport sous-jacent ne peut pas satisfaire le contrat officiel et les tests sandbox. Cette exception applique explicitement PAY-7 §62.
- Aucun changement frontend/mobile : le contrat HTTP local n'est pas modifié.

## Plan de déblocage minimal

1. Obtenir de Yabetoo la spécification/version contractuelle applicable au compte et confirmer l'endpoint de confirmation.
2. Valider sandbox : create retourne `id` + `clientSecret`, confirm avec MoMo, inquiry et webhooks signés.
3. Refactorer sans duplication en transport + adaptateur, avec timeout borné, erreurs normalisées, références masquées et clé d'idempotence officielle.
4. Rendre l'initiation visite atomique et récupérable après timeout ; ajouter un statut unknown/processing et une réconciliation.
5. Ajouter les tests adversariaux Mongo/concurrence et seulement ensuite envisager un bridge Financial Core par domaine.

## Sources officielles consultées

- Documentation Yabetoo : Authentication, Create/Confirm Payment Intent, Webhooks, Currency, Development/Idempotency, FAQ et sandbox testing, consultées le 2026-08-21.
- Toute couverture autre que Congo-Brazzaville/XAF/MTN/Airtel, tout barème de frais et toute API de refund restent **NON CONFIRMÉS**.

## Gates

| Gate | Résultat |
|---|---|
| PAY-7/PAY-3/PAY-4/PAY-5/PAY-6.1/visites ciblés | Vert : 13 suites, 153 tests |
| Serveur unit complet | Vert : 126 suites, 1 449 tests |
| Mongo/Replica Set exhaustif | 94/95 suites, 938/939 tests ; un timeout à 180 s hors PAY-7 dans `tenantScopeAudit1RentalManagement` |
| Rejeu isolé du timeout Mongo | Vert : 1 suite, 5 tests, 20,464 s |
| Legacy webhook Yabetoo Mongo | Vert dans la campagne exhaustive |
| Financial Core, F2.2, F2.3, PAY-6.1 | Verts dans les campagnes ciblée/Mongo, hors timeout sans lien ci-dessus |
| Lint serveur | Vert : 0 erreur, 106 avertissements préexistants |
| Sandbox/API Yabetoo réelle | **NON EXÉCUTÉE / BLOQUANTE** |
| `git diff --check` | Vert ; deux avertissements CRLF préexistants, aucune erreur |

La campagne Mongo exhaustive n'est pas déclarée intégralement verte : elle a subi un timeout de charge sur une suite de gestion locative, puis Jest a signalé le serveur Supertest encore ouvert. Le même fichier a réussi isolément (5/5), ce qui caractérise une instabilité de campagne et non une régression PAY-7. Aucun verdict vert n'est néanmoins émis sans validation sandbox et sans correction des vulnérabilités structurelles ci-dessus.

Aucun commit, push ou déploiement n'a été effectué. PAY-8 n'est pas commencé.
