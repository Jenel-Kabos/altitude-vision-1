# ARCH-2B — Matrice des arêtes du cycle initial

Le cycle narratif ARCH-1 comportait huit étapes ; la SCC réelle contenait les douze arêtes suivantes.

| From | To | Import | Usage réel | Nature / retour / erreur | Nécessaire ? | Candidat à casser |
|---|---|---|---|---|---|---|
| `notificationService:193` | `crmAutomationEngine` | `require()` dynamique | `handleEvent(payload)` après persistance | Orchestration CRM, fire-and-forget, retour ignoré, erreur avalée | Oui, automatisations conservées | **Oui : arête inverse infrastructure → application** |
| `crmAutomationEngine:22` | `crmAutomationActions` | `require()` statique | `ACTION_HANDLERS[actionId]` | Registre métier, handler attendu séquentiellement | Oui | Non |
| `crmAutomationActions:8` | `crmService` | `require()` statique | `createActivity`, `setOpportunityOutcome` | Écriture CRM attendue, retour utilisé | Oui | Non |
| `crmAutomationActions:18` | `marketingCampaignService` | `require()` statique | `deliverToChannel` | Diffusion marketing attendue, résultat utilisé | Oui | Non |
| `crmAutomationActions:9` | `notificationService` | `require()` statique | `notify` | Side effect déclaré par règle, attendu | Oui | Non : direction application → infrastructure correcte |
| `crmService:25` | `notificationService` | `require()` statique | `notify` sur création/étape/outcome/activité | Best-effort (`await … .catch`), résultat ignoré | Oui | Possible mais toucherait quatre workflows |
| `marketingCampaignService:12` | `marketingSegmentService` | `require()` statique | `resolveSegment` | Lecture de l'audience, résultat requis | Oui | Non |
| `marketingCampaignService:15` | `notificationService` | `require()` statique | `notify` pour canal push | Envoi attendu et awaited | Oui | Non |
| `marketingSegmentService:11` | `crmCockpitService` | `require()` statique | `clientsSansSuivi`, `prospectsInactifs` | Lecture comportementale, résultat requis | Oui | Non |
| `marketingSegmentService:12` | `crmScoreService` | `require()` statique | `computeCustomerScore` | Lecture score, résultat requis | Oui | Non |
| `crmCockpitService:13` | `crmService` | `require()` statique | `getActivities` | Lecture cockpit, résultat requis | Oui | Non |
| `crmScoreService:15` | `crmService` | `require()` statique | `getCustomer360` | Lecture dossier 360, résultat requis | Oui | Non |

L'arête choisie est la seule arête infrastructure → orchestration applicative. Elle est post-persistance, sans valeur de retour observable, best-effort et son échec n'annule pas la notification. Les onze autres arêtes portent des lectures ou actions métier explicites, ou suivent la direction application → infrastructure.
