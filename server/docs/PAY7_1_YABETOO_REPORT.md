# PAY-7.1 : GO SOUS RÉSERVES

## Causes prouvées et correction

Le transport initial mélangeait les contrats CREATE et CONFIRM, confirmait sans corps, ne bornait pas les appels HTTP et exposait les visites aux créations concurrentes. CREATE envoie désormais uniquement montant XAF, description et metadata ; CONFIRM reçoit le `client_secret` retourné, les données MoMo et les champs d'identité optionnels. Les claims Mongo précèdent tout appel, les références sont uniques et persistées avant CONFIRM, et les timeouts deviennent explicitement ambigus sans retry aveugle. Le GET officiel est utilisé pour la reconciliation quand une référence existe. Le webhook existant reste inchangé et fail-closed.

## Réponses obligatoires

1. CREATE : `POST /v1/payment-intents`.
2. Payload : `amount`, `currency`; `description`, `metadata` optionnels.
3. CONFIRM : `POST /v1/payment-intents/:id/confirm`.
4. Payload : `client_secret` + `payment_method_data` MoMo ; identité/email optionnels.
5. Oui, `clientSecret` est requis.
6. Il vient de la réponse CREATE.
7. Non, il reste en mémoire pendant la requête.
8. Non, il ne peut pas être loggé.
9. Bearer secret côté serveur.
10. SDK : oui conceptuellement ; REST/header : **NON CONFIRMÉ**.
11. Aucun header inventé ; test REST provider non applicable.
12. Claim/index Mongo avant réseau.
13. Clé : provider + domaine + ressource + payeur + génération stable `v1`.
14. Un intent au plus.
15. Une opération logique et un appel CREATE au plus.
16. `create_unknown`, aucun retry automatique.
17. `confirm_unknown`, référence conservée, GET requis.
18. Non.
19. Oui, `GET /v1/payment-intents/:id` est listé officiellement.
20. Oui avec référence ; sans référence après fenêtre de crash/timeout CREATE : non automatique.
21. Les états/clés persistés empêchent une recréation aveugle.
22. Oui, HMAC-SHA256.
23. Oui, corps brut exact.
24. Oui, timestamp signé.
25. Oui, tolérance 300 s.
26. Oui, registre Mongo unique.
27. 503 fail-closed.
28. 401.
29. 200 duplicate, aucun second effet.
30. Un succès terminal ne régresse pas.
31. Fail-closed, jamais succès.
32. Ignoré : montant canonique serveur.
33. 403 avant provider.
34. Lookup local/ownership et unicité de référence.
35. Non dans les nouveaux chemins ; seul le code d'erreur est journalisé.
36. Oui : URL sandbox et clé locale au préfixe `sk_test_`; aucune valeur exposée.
37. Non : la sandbox a répondu par un refus d'authentification au CREATE (`provider_auth_failure`, 503 local, 878 ms).
38. Non exécuté, CREATE n'ayant fourni ni id ni clientSecret.
39. Non exécuté, aucune référence n'ayant été créée.
40. Oui, aucun appel production ni débit réel.
41. Oui, Financial Core intact.
42. Oui, PAY-6.1 intact.
43. MTN Direct intact ; MTN reste une valeur Yabetoo legacy.
44. Airtel Direct intact ; Airtel reste une valeur Yabetoo legacy.
45. Voir gates.
46. Voir gates.
47. Voir gates.
48. Voir gates.
49. Voir gates.
50. Voir gates.
51. Voir gates.
52. Service, deux contrôleurs, deux modèles, tests et sept documents PAY-7.1.
53. Aucun commit, push ou deploy.
54. **GO SOUS RÉSERVES** tant que CREATE/CONFIRM/STATUS sandbox réels ne sont pas prouvés.

## Limites

Le provider et MongoDB restent deux systèmes distribués : le crash après acceptation CREATE mais avant réception/persistance de l'id ne peut être supprimé sans idempotence REST/recherche par business key officiellement documentée. Le blocage local empêche toutefois toute duplication automatique. Le clientSecret non persisté réduit son exposition ; un crash entre persistance de l'id et CONFIRM exige une intervention, jamais une confirmation aveugle.

## Gates

| Gate | Résultat |
|---|---|
| Tests transport/authorization ciblés | 2 suites, 13/13 verts |
| Mongo Yabetoo concurrence/webhook | 2 suites, 4/4 verts |
| PAY-6.1 + Financial Core Mongo | 2 suites, 17/17 verts |
| Serveur unit complet | Vert, code de sortie 0 |
| Lint serveur | Vert, 0 erreur ; 106 avertissements préexistants |
| Sandbox CREATE | Échec d'authentification provider, aucun intent prouvé |
| Sandbox CONFIRM/STATUS | Non exécutés après échec CREATE |
| `git diff --check` | Vert |

La logique locale est certifiée par les gates exécutés, mais le critère sandbox obligatoire échoue. Le verdict reste donc **GO SOUS RÉSERVES**. Le secret webhook local demeure absent ; ce manque ne réduit pas la sécurité puisque la route renvoie 503.
