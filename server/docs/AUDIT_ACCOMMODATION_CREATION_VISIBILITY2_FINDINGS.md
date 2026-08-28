# AUDIT-ACCOMMODATION-CREATION-VISIBILITY-2 — Findings

## F-01 — P1 — Création et lectures n'utilisent pas la même frontière tenant

**Preuve.** `POST /accommodations/admin` n'installe pas `requireTenantScopeForStaffAllowPlatformWide`; les routes liste/pending et dashboard analytics l'installent. Ce middleware résout `req.platformTenant` et affecte `req.user.platformTenant`. Pourtant `createFullAccommodation` persiste l'Accommodation avec `actingUser.platformTenant || null`, et `buildBasePropertyData` ne persiste aucun tenant sur Property.

**Effet.** Dans le parcours courant, l'écriture peut produire un Accommodation `tenant:null` alors que les lectures sont contraintes au tenant Altitude Vision. C'est la chaîne causale la plus directe pour « création 201 + KPI hébergements 0 + file/liste vide ». La valeur exacte des documents de production reste **NON CONFIRMÉE** faute d'inspection Mongo production.

## F-02 — P1 fonctionnel — Le succès de persistance est présenté comme succès de visibilité

**Preuve.** Le formulaire exige seulement type, capacité adulte et image. `evaluateReadiness` exige en plus check-in/out et `bathrooms > 0`. Le backend accepte et retourne 201 une composition incomplète; le frontend ne lit ni `publicationStatus`, ni `missingFields`, affiche le toast puis ferme le formulaire.

**Effet.** Un document incomplet reste `brouillon`, invisible de la liste (`publie`) et de la modération (`soumis`). Un document prêt devient seulement `soumis`, donc n'est volontairement pas encore dans la liste principale.

## F-03 — P1 fonctionnel — Deux gates de publication ne sont pas alignés

**Preuve.** La création force le Property support à `statusAdmin: En attente`. Le hotfix auto-soumet seulement l'Accommodation. La validation `reviewDecision(validate)` publie l'Accommodation mais ne valide pas la Property. La liste principale exige les deux : Accommodation `publie` et Property `Validée`.

**Effet.** Même après validation Accommodation, le Property support peut continuer à masquer la ressource. Le test historique ne voit pas le défaut car sa fixture force `statusAdmin: Validée` avant la création.

## F-04 — P2 — « Biens Altimmo » compare un inventaire brut à un portefeuille éligible

**Preuve.** `getDashboardKpis` renvoie `Property.countDocuments()` sans filtre. `/properties/portfolio` applique publication, validation, visibilité, scope et déduplication. `/dashboard/hebergements` interroge une autre collection et d'autres statuts.

**Effet.** 4, 2 et 0 peuvent être simultanément cohérents avec le code tout en étant sémantiquement trompeurs pour l'utilisateur. La carte « Biens Altimmo » n'est ni tenant-scopée, ni limitée au pole Altimmo malgré son libellé.

## F-05 — Information — Aucun double comptage Accommodation + Property

Le compteur général ne fait ni union, ni agrégation, ni addition d'Accommodation : il compte seulement Property. La création a intentionnellement une ancre Property et un profil Accommodation 1:1. Une création standard ajoute donc +1 au compteur brut. Le delta apparent +2 nécessite deux Property supplémentaires ou un état de départ différent. Double soumission, double création ou identité de ces deux lignes : **NON CONFIRMÉ**.

## F-06 — P2 données — Régularisation probablement nécessaire

Les ressources persistées ne sont pas perdues : elles sont récupérables par identifiant/inspection DB, puis par rattachement tenant, complétion et modération. Des documents Property/Accommodation `tenant:null`, `brouillon`, `soumis` ou Property `En attente` peuvent déjà exister. Un backfill ciblé sera probablement nécessaire après inventaire et validation de l'autorité propriétaire; volume et critères exacts : **NON CONFIRMÉS**.

## Hotfix historique et version

- Le code `HOTFIX-ACCOMMODATION-CREATED-NOT-VISIBLE-1` existe toujours et est reachable par la route courante.
- Il fonctionne pour son périmètre étroit : readiness complète → `soumis`.
- Il ne promet ni publication immédiate, ni validation Property, ni attribution tenant.
- Les routes mobile et propriétaire sont parallèles, mais le dashboard ne les utilise pas.
- Aucune régression de l'auto-submit n'est démontrée; le défaut actuel révèle des gates non couverts par l'ancien test.
- La version réellement déployée en production est **NON CONFIRMÉE**. Le comportement observé reste compatible avec le HEAD, donc aucun mismatch de version n'est nécessaire pour l'expliquer.

## Plan minimal recommandé — sans exécution

1. Installer le tenant middleware canonique sur création/édition admin; passer explicitement le tenant résolu au service et le persister sur Property **et** Accommodation.
2. Aligner la validation frontend avec `evaluateReadiness`, ou rendre les brouillons staff découvrables; afficher le statut réellement retourné au lieu d'assimiler 201 à « visible ».
3. Unifier le gate Property/Accommodation lors de la décision de modération, selon la politique existante, sans auto-publier silencieusement.
4. Définir la sémantique de « Biens Altimmo » : appliquer scope/éligibilité identiques au portefeuille ou renommer explicitement la carte en inventaire brut.
5. Inventorier read-only les anciennes paires, puis préparer un backfill idempotent et audité séparément.

Tests RED→GREEN à ajouter : route réelle create→DB→pending/list/analytics avec tenant A; formulaire incomplet; validation des deux gates; absence cross-tenant; compteur global conforme à sa définition; assertion qu'une création indépendante ajoute une seule Property.

