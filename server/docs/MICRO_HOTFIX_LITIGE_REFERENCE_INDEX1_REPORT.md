# MICRO-HOTFIX-LITIGE-REFERENCE-INDEX-1 — Rapport final

## Verdict

**GO SOUS RÉSERVES — défaut Litige corrigé et prouvé, runner Mongo exhaustif toujours non vert.**

## Cause racine

`Litige.reference` était optionnelle dans le schéma mais portait un index unique simple. Mongo indexait alors plusieurs champs absents ou explicitement `null` sous la même clé `null`. L'API nominale génère toujours une référence, mais les ressources historiques et les tests d'attribution créent légitimement des Litige sans référence.

La différence isolé/complet venait du harness : `autoIndex:false` et aucune synchronisation Litige dans la suite isolée, donc 14/14 sans index réel. Le runner partage une base séquentielle, nettoie les documents mais conserve les index ; dès qu'une suite antérieure avait matérialisé `reference_1`, deux créations sans référence dans la suite d'attribution déclenchaient `E11000`. Ce n'est ni du parallélisme Jest (`--runInBand`) ni une race démontrée.

## Correction

L'index est désormais explicitement unique uniquement lorsque `reference` est une chaîne : `partialFilterExpression: { reference: { $type: 'string' } }`. Aucun `default:null`, aucune génération de référence et aucun contrôleur n'ont été modifiés. Un test Mongo synchronise l'index et prouve absent, `null` et vrai doublon.

## Réponses obligatoires

1. `tenantAttributionLegacyExtension.mongo.integration.test.js`.
2. `E11000 duplicate key`, collection `litiges`, index `reference_1`, clé `{ reference: null }`.
3. `reference_1`.
4. Oui.
5. Non.
6. Non.
7. Oui pour les données/flows legacy et d'attribution ; l'API nominale en génère une.
8. Oui.
9. Avant synchronisation isolée, l'index était absent ; dans le runner partagé, l'index réel correspondait au schéma simple défectueux.
10. Contamination de documents : non, le cleanup les efface. État d'index partagé entre suites : oui.
11. Non démontrée.
12. Non : runner en `--runInBand`.
13. Contrat du modèle de production incohérent, rendu intermittent par le harness.
14. Index unique partiel limité au type BSON string.
15. Il accepte uniquement les formes legacy dépourvues de clé métier et n'affaiblit pas les chaînes réelles.
16. Oui, doublon réel rejeté en code 11000.
17. Oui, deux absents et deux `null` acceptés.
18. Oui : suites Litige ciblées 15/15.
19. Non : le runner exact termine encore avec exit code 1 ; l'identité du dernier échec est NON CONFIRMÉE car la sortie terminal a été tronquée.
20. Zéro run complet vert ; les répétitions 2/3 n'ont pas été lancées après l'échec du run 1 et sa durée importante.
21. Oui : sélection Litige/tenant/Conversations 71/71 verte.
22. Non au sens strict : le runner exhaustif reste rouge.
23. `models/Litige.js`, nouveau test et trois documents de ce micro-hotfix.
24. `litigeReferenceIndex.mongo.integration.test.js`.
25. Vert, 0 erreur et 106 avertissements préexistants.
26. Vert.
27. GO SOUS RÉSERVES.

## Gates

- Test index + attribution Litige : 15/15 verts.
- Litige, régularisation tenant et Conversations : 71/71 verts.
- Suite unitaire serveur : 126/126 suites, 1 447/1 447 tests verts.
- Runner Mongo exhaustif, run 1 : exit code 1 ; aucun verdict vert possible.
- Runs exhaustifs 2 et 3 : non exécutés, condition de répétition déjà non satisfaite.
- Lint : 0 erreur, 106 avertissements.
- `git diff --check` : vert.

## Réserve opérationnelle

Une base existante possédant l'ancien `reference_1` doit remplacer cet index par le nouvel index partiel via une migration contrôlée ; aucune opération de production ni migration destructive n'a été réalisée ici.

## Re-certification finale — 2026-08-21

**MICRO-HOTFIX-LITIGE-REFERENCE-INDEX-1 : CERTIFIÉ VERT.** Le runner Mongo capturé passe à 95/95 suites et 939/939 tests. Deux répétitions ciblées passent chacune à 56/56. L'unicité textuelle, les valeurs absentes/null et les options de l'index restent couvertes. La réserve de test est levée ; la migration contrôlée de l'index sur toute base existante demeure une étape opérationnelle distincte, non exécutée ici.
