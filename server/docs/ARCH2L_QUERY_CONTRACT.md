# ARCH-2L — Contrat exact de query

## Property

Query uniquement si `scopeUserIds` est truthy : `find({owner:{$in:ObjectId[]}}).distinct('_id')`. Aucun populate, tri, pagination ou projection autre que `distinct`. Scope absent : `properties=null`, mode global.

## RentalManagement

Pipeline : `$match {managementActivated:true, ...rentalFilter}` puis `$group {_id:null}`. Compteurs : `availabilityStatus==='disponible'`, `occupancyStatus==='occupe'`, `occupancyStatus==='preavis'`. Fallback exact si aucune row : les trois valeurs à 0. Une row réelle conserve historiquement `_id:null` dans `kpis`.

## Contrat

Pré-query `find(contractFilter).distinct('_id')` si scope, sans filtre `type`, afin de reproduire exactement le scope historique des paiements. Pipeline KPI : `$match {type:'location', ...contractFilter}` puis group. `activeContracts` si `statut==='actif'`. `expiringContracts` si actif et `dateFinBail >= now && <= now+30 jours`. Fallback : deux zéros.

## Paiement

Match `{contrat:{$in:contractsInScope}}` si scope, sinon `{}` global. `rentCollected=sum(ifNull(montantRecu,0))`. `unpaidRent` seulement pour `impayé|en_retard|partiel`, formule `max((ifNull(montantTotal,montant)-ifNull(montantRecu,0)),0)`. `penalties` si `penaliteAppliquee`, valeur `penaliteMontant`, sinon 0. Fallback : trois zéros.

## RentalMaintenanceTicket

`countDocuments` avec `status in RentalMaintenanceTicket.OPEN_RENTAL_MAINTENANCE_STATUSES` et filtre Property optionnel. Aucun fallback additionnel : le nombre retourné devient `maintenance`.

## Invariants communs

Pas de pagination, sorting, populate ou formatage. Deux pré-queries séquentielles, quatre opérations parallèles. Tous les filtres, statuts, dates, formules, fallbacks, propagation d'erreur et la présence conditionnelle historique de `_id:null` sont identiques avant/après.
