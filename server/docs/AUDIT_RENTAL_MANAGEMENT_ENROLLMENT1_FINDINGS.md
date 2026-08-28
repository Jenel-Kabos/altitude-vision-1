# AUDIT-RENTAL-MANAGEMENT-ENROLLMENT-1 — Findings

## RM-F01 — P2 — `Biens inscrits` ne mesure pas l'inscription en gestion

Le compteur agrège les `Property status:'location'` d'un propriétaire externe, même sans dossier `RentalManagement` activé. Le test `rentalManagementBiensInscritsStat.mongo.integration.test.js` impose explicitement `3 inscrits / 1 géré`, dont une Property sans aucun RM.

Impact : l'utilisateur interprète une annonce comme un enrôlement GL qui n'a jamais eu lieu. C'est la cause directe du `1 / 0` observé.

## RM-F02 — P2 — Catalogue Property confondu avec portefeuille locatif

La source de `biensInscrits` est le catalogue Property, tandis que tous les états opérationnels principaux viennent du portefeuille RM activé. Posséder le rôle `Proprietaire` suffit à faire entrer une annonce de location dans ce KPI, sans action d'onboarding.

## RM-F03 — P2 — Sémantique `inscrit / géré` incompatible avec l'UX actuelle

Le code possède bien deux ensembles techniques, mais « inscrit » signifie aujourd'hui « annonce locative externe non retirée » et « géré » signifie « RM activé ». Aucune transition `inscrit → géré` n'est portée par le premier ensemble : une Property apparaît dès sa création. La distinction peut être utile sous des libellés catalogue/candidats, mais pas comme preuve d'inscription GL.

## RM-F08 — P3 — Libellé trompeur

Si la métrique catalogue est volontairement conservée, le libellé doit exprimer sa source réelle, par exemple « Annonces locatives propriétaires ». Sous « Gestion locative », « Biens inscrits » implique une action métier inexistante.

## RM-F09 — P2 — `Contrats actifs` inclut les ventes

`GestionLocativePage` calcule `contrats.filter(c => c.statut==='actif').length` sans `c.type==='location'`. La route contrats est tenant-scoped, mais retourne location et vente. Le KPI GL peut donc être gonflé par un contrat de vente actif.

## RM-F10 — P1 — Maintenance overview non filtrée par tenant pour le staff

La vue d'ensemble appelle `GET /rental-maintenance` sans `propertyId`. Dans `rentalMaintenanceController.list`, la restriction aux Property de l'utilisateur n'est appliquée qu'aux non-staff; la query staff reste `{}`. `requireTenantScope` résout le tenant mais le contrôleur ne l'utilise pas pour cette liste. Le compteur peut mélanger les tickets de plusieurs tenants.

Ce finding reste strictement limité à la source du compteur Maintenance de cette page; aucun audit horizontal n'a été mené.

## Findings non créés

- RM-F04 : non démontré — `vacant` exige un RM activé.
- RM-F05 : non démontré pour le header — `published` exige un RM activé et désigne la publication locative.
- RM-F06 : non démontré sur le flux courant — le backend active le RM avant de créer un bail. Il existe seulement une compatibilité legacy documentée.
- RM-F07 : non démontré — un onboarding explicite UI + API existe déjà.

## Correctif minimal recommandé, non implémenté

1. Décider la sémantique officielle : si « inscrit » signifie enrôlé GL, le dériver de `RentalManagement.managementActivated:true`; éviter alors le doublon avec « géré » en donnant à ce dernier une définition plus stricte réellement démontrable (par exemple dossier actif/opérationnel), ou supprimer l'un des deux KPI.
2. Si la métrique Property reste utile, la renommer en métrique de catalogue et la sortir de la sémantique d'enrôlement.
3. Conserver et réutiliser le CTA/API existants; ne créer ni modèle Mandat ni second workflow.
4. Filtrer `Contrats actifs` sur `type==='location'`.
5. Scope tenant de la liste maintenance staff par les Property autorisées.
6. Ajouter des tests RED→GREEN sur : annonce seule exclue du futur KPI d'enrôlement, activation incluse, vente exclue, contrat actif vente exclu, tickets maintenance tenant A/B isolés.

Migration : aucune migration de schéma n'est nécessaire pour le correctif de compteur. Un backfill n'est pas requis pour les annonces normales. Les contrats historiques sans RM doivent rester traités par la réconciliation existante, après inventaire contrôlé et jamais automatiquement pendant ce correctif.

