# ARCH-2B — État initial

## Baseline

- Branche : `main`
- HEAD : `a04055f62952c782b92aeef2f100824a17a5f645` (`Update Altimmo 40`)
- Les changements ARCH-2A certifiés étaient présents mais non commités ; ils ont été conservés.
- `git diff --check` était vert avant ARCH-2B.
- Les livrables ARCH-1 demandés restent absents du tree ; les quatre documents ARCH-2A pertinents ont été lus intégralement.

## Reproduction

Avant correction, `npm run architecture:check` analysait 461 fichiers et 1 508 arêtes, puis affichait un cycle fort connu de huit nœuds :

`crmAutomationActions → crmAutomationEngine → crmCockpitService → crmScoreService → crmService → marketingCampaignService → marketingSegmentService → notificationService`

Le moteur d'analyse a révélé 12 arêtes réelles au sein de cette composante fortement connexe. L'arête `notificationService.js:193 → crmAutomationEngine.js` utilisait déjà un `require()` différé, mais restait une dépendance réelle et fermait toutes les boucles.

## Contrôle de réduction

Après remplacement de cette arête, avant toute modification du baseline, le checker a trouvé zéro cycle et a échoué sur `ARCH-CYCLE-001: Stale cycle baseline detected`. Cette étape prouve que le cycle a été supprimé du graphe plutôt que renommé ou allowlisté.
