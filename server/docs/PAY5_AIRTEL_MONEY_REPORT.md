# PAY-5 — Airtel Money Direct — Rapport final

## Verdict

**PAY-5 AIRTEL MONEY — BLOQUÉ AVANT IMPLÉMENTATION RÉSEAU / SANDBOX RÉEL NON CONFIRMÉ.**

La documentation officielle publique prouve le portail développeur Airtel Congo et l'existence générale d'API de collection Airtel Money, mais pas leur contrat technique. Le Swagger/documentation détaillée exige un compte développeur. Aucun credential ou document contractuel n'est présent dans le dépôt. Conformément à la règle absolue du mandat, aucun endpoint, header, token flow, statut ou callback n'a été inventé.

La seule correction de code PAY-5 rend le registre honnête et sûr : `airtel_direct` demeure non intégré, toutes ses capabilities réseau sont `false`, et tout statut Airtel échoue fermé au lieu d'utiliser la table fictive héritée de PAY-3.

## Réponses obligatoires

1. **Support officiel Congo-Brazzaville ?** Portail développeur Congo confirmé ; disponibilité contractuelle de Collection pour Altitude Vision : **NON CONFIRMÉE**.
2. **Source ?** `developers.airtel.cg`, Airtel Congo et communiqué officiel Airtel Africa.
3. **API exacte ?** **NON CONFIRMÉE** sans accès au produit/documentation du portail.
4. **Authentification ?** **NON CONFIRMÉE**.
5. **Variables env ?** Aucune créée ; noms officiels **NON CONFIRMÉS**.
6. **Currency ?** Service local en FCFA/XAF ; valeur exigée par l'API Collection **NON CONFIRMÉE**.
7. **Country code API ?** **NON CONFIRMÉ**.
8. **MSISDN API ?** **NON CONFIRMÉ**.
9. **Endpoint initiation ?** **NON CONFIRMÉ**.
10. **Endpoint status inquiry ?** **NON CONFIRMÉ**.
11. **Statuts réels ?** **NON CONFIRMÉS** ; anciens statuts supposés retirés.
12. **Normalisation ?** Aucune ; toute valeur → `FINANCIAL_PROVIDER_STATUS_UNKNOWN`.
13. **Callback ?** **NON CONFIRMÉ**.
14. **Authenticité callback ?** **NON CONFIRMÉE**.
15. **Confirmation directe par callback ?** Non autorisée par l'architecture cible ; actuellement aucune route.
16. **Source de vérité finale ?** Devra être une status inquiry Airtel authentifiée ; disponibilité **NON CONFIRMÉE**.
17. **Idempotence ?** Financial Core/PAY-4 disponibles pour réutilisation, mais aucune opération Airtel créée.
18. **Après timeout ?** Future règle imposée : conserver pending/unknown et interroger ; non implémentée faute de contrat.
19. **Double débit ?** Impossible actuellement car initiation désactivée ; futur bridge devra réserver la référence avant réseau et ne jamais rappeler sur rejeu.
20. **FinancialPayment réutilisé ?** Architecture prévue oui ; aucun paiement Airtel créé aujourd'hui.
21. **PaymentAllocation réutilisée ?** Prévue via Financial Core ; non exercée par Airtel.
22. **Ledger réutilisé ?** Prévu via services canoniques ; non exercé par Airtel.
23. **Nouveau modèle ?** Non.
24. **Registry actif ?** Entrée présente, intégration inactive.
25. **Capabilities actives ?** Aucune capability réseau ; refund également false.
26. **MTN non régressé ?** Oui dans les tests ciblés.
27. **Yabetoo indépendant ?** Oui, inchangé.
28. **Manuel indépendant ?** Oui, inchangé.
29. **Callback forgé peut payer ?** Non : aucune route/capability Airtel.
30. **Montant forgeable ?** Aucune route Airtel. Futur bridge devra reprendre la validation serveur PAY-4.
31. **Statut forgeable ?** Non ; tout statut Airtel est actuellement rejeté.
32. **Changement provider pendant pending ?** Toujours interdit par le registre.
33. **Secrets backend uniquement ?** Aucun secret Airtel n'existe ; future exigence backend-only.
34. **Logs masqués ?** Aucun log Airtel/MSISDN/token créé.
35. **Sandbox réel ?** Non, aucun credential.
36. **Production ?** Non, aucun appel ni débit.
37. **Tests ?** Registre PAY-5 + PAY-3/PAY-4/Financial ciblés.
38. **Gates ?** Voir tableau.
39. **Fichiers modifiés ?** Registre, test registry et cinq documents PAY-5.
40. **Verdict ?** Bloqué avant implémentation réseau ; pas de fausse certification.

## Gates

| Gate | Résultat |
|---|---|
| PAY-5 registry ciblé + PAY-3/PAY-4/Financial ciblés | 88/88, 7 suites |
| Financial Core Mongo + F2.2 + F2.3 | 20/20, 3 suites |
| Suite serveur complète | 1439/1439, 125 suites |
| Lint serveur | Vert, 0 erreur ; 106 avertissements préexistants |
| `git diff --check` | Vert |
| Sandbox Airtel | NON CONFIRMÉ — credentials absents |
| Production Airtel | Non testée, conformément au mandat |

## Conditions de reprise

Fournir depuis le portail officiel Airtel Congo : documentation/OpenAPI du produit Collection, pays/devise activés, contrat MSISDN, auth et durée token, endpoints initiation/inquiry, schémas de réponses, liste exhaustive des statuts, règles d'idempotence/référence, timeout/retry et mécanisme d'authenticité callback. Fournir ensuite des credentials sandbox dédiés. Après seulement, implémenter transport, adapter, bridge Financial Core, routes et tests adversariaux.

Aucun commit, push, déploiement, credential ou appel réel n'a été effectué.
