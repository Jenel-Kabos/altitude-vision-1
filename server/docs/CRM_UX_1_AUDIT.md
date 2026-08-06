# CRM-UX-1 — Audit préalable

## État CRM-CORE-1

Le socle existant est unique et correctement séparé des moteurs sources : `CrmCustomer` indexe les identités, `CrmOpportunity` porte le pipeline, `CrmActivity` porte les activités, `crmService` agrège Customer 360 et DOC-EVO fournit `buildTimeline`. Les notifications passent par `notificationService` et deux destinations NAV-CORE Web-only existent.

La base Atlas contient actuellement 0 Customer, 0 opportunité et 0 activité CRM. La consolidation de production n'a donc jamais été lancée; cet audit est strictement en lecture seule.

## Cartographie

- Modèles : `CrmCustomer`, `CrmOpportunity`, `CrmActivity`; audit source embarqué dans Customer.
- Services : synchronisation contrôlée, liste/recherche Customer, détail 360, création/transitions d'opportunités, création/mise à jour d'activités.
- Pipeline : huit étapes certifiées, historique append-only, transitions serveur; aucune dépendance drag-and-drop.
- Activités : tâches, rappels, rendez-vous, relances, notes et canaux, visibles seulement dans une fiche Customer.
- Notifications : `crm_activity_assigned` via le moteur canonique et `CRM_CUSTOMER_DETAILS`.
- Documents : références et timeline calculées via DOC-EVO; aucun stockage CRM.
- Web : `/dashboard/crm` liste les Customers et `/dashboard/crm/:id` affiche la fiche 360. Le pipeline est un Kanban visuel local avec transitions par sélecteur.
- Mobile : aucun écran/dashboard CRM lourd, aucune incohérence identifiée.

## Écarts précis

- Aucun cockpit ni KPI CRM serveur.
- Aucun pipeline global multi-Customer.
- La recherche est limitée aux Customers; aucun endpoint transverse.
- `merge_review` existe, mais aucun score, comparaison ou assistant de consolidation.
- L'audit embarqué ne suffit pas pour journaliser un avant/après complet de consolidation.
- Aucun agenda global Aujourd'hui/Semaine/Retard/À venir.
- Aucun résultat gagné/perdu sur les opportunités; ces KPI ne sont donc pas calculables sans enrichir le modèle existant.
- Les deux pages sont responsives mais concentrent trop de fonctions sans navigation interne opérationnelle.

## Architecture retenue

1. Étendre `crmService` : cockpit, pipeline global, recherche transverse, doublons, comparaison, consolidation et agenda. Le frontend n'interrogera aucune collection directement.
2. Enrichir `CrmOpportunity` avec un résultat `open|won|lost` afin que gagnées/perdues et durée de cycle reposent sur une donnée réelle, jamais déduite arbitrairement.
3. Ajouter un journal append-only `CrmConsolidation` contenant acteur, justification et snapshots. Il s'agit d'un journal d'audit, pas d'une seconde identité.
4. Consolider sans suppression : le gagnant récupère les références et relations; le perdant devient archivé avec `mergedInto`. Toutes les opportunités/activités sont réaffectées dans une transaction.
5. Le téléphone seul contribue au score de doublon mais ne permet jamais une fusion automatique. Toute consolidation reste une décision humaine explicite.
6. Conserver les transitions sécurisées existantes : aucun package drag-and-drop n'est installé et son ajout n'est pas justifié.
7. Ajouter des destinations NAV-CORE Web-only pour cockpit, pipeline, recherche, doublons et activités. Mobile reste hors périmètre.
