# Sprint GL-RECON-1 — Audit initial

## Règle et ordre de l'audit

Audit réalisé avant toute modification fonctionnelle. La lecture de la base configurée a été exécutée en mode strictement `dry-run`; aucune écriture n'a été effectuée.

Invariant cible : `Property location valide → RentalManagement actif et managementActivated → Contrat locatif ouvert`. Un bien reste sous gestion après la clôture d'un bail et peut recevoir des contrats successifs, mais jamais deux contrats ouverts simultanément.

## Cartographie du modèle existant

- `Property` représente le bien physique. Pour un bail, `status` doit être `location`; `availability` décrit sa disponibilité et `assetCycle` son cycle patrimonial GL-ASSET.
- `RentalManagement` est unique par `property`. `managementActivated` distingue une annonce simple d'un bien réellement pris en gestion; `active`, `occupancyStatus`, `availabilityStatus`, `activeLease` et `currentTenant` portent l'état opérationnel.
- `Contrat` référence `bien`, `locataire` et `proprietaire`. Les contrats ouverts sont `en_attente` ou `actif`; un index partiel unique protège les nouvelles créations concurrentes par bien et type.
- `Paiement` référence obligatoirement un `Contrat`; documents/quittances et dossier DOC-EVO sont dérivés de cette relation.
- `Locataire` et `Proprietaire` restent les référentiels des participants. `Property.owner` référence un `User`, alors que `Contrat.proprietaire` référence un `Proprietaire`; aucune équivalence ne doit être devinée par une réconciliation.
- `ActionLog` accepte le module `GestionLocative` et permet de conserver l'ancien/nouvel état sérialisé.

## Services et protections existants

- `rentalManagementLeaseSyncService.syncLeaseOccupation` active/crée le `RentalManagement`, puis réutilise `rentalListingSyncService.markPropertyRented` pour synchroniser occupation, disponibilité, annonce, notifications et cycle GL-ASSET.
- `contratController.create` invoque déjà cette synchronisation après la création d'un bail, mais crée le `Contrat` avant la prise en gestion. Une erreur de synchronisation peut donc laisser un contrat créé sans invariant garanti.
- Le contrôleur autorise actuellement une création manuelle sur tout `Property location` disponible, même si aucun `RentalManagement` n'existe; l'activation est implicite après insertion.
- `rentalLeaseLifecycleService` est l'unique machine d'état du bail.
- Les adaptateurs Dossier/Documents lisent `Contrat`, `RentalManagement` et `Paiement`; aucune copie n'est nécessaire.
- La synchronisation existante journalise `workflowHistory` et notifie, mais l'ancien service de réconciliation ne crée aucun `ActionLog`.

## Moteur historique existant et écarts

`rentalManagementReconciliationService` et la CLI `reconcile-rental-management.js` existent depuis GL-ARCH-1.1. Ils offrent déjà scan, plan, dry-run par défaut et apply explicite. Leur périmètre est cependant limité aux seuls contrats `statut: actif` et à cinq états : cohérent, Property absent, type Property incorrect, RentalManagement absent/inactif, occupation divergente.

Éléments manquants pour GL-RECON-1 :

- contrats `en_attente` pourtant ouverts;
- doubles contrats ouverts sur un même Property;
- Property vendu, retiré, archivé ou de mauvais type;
- `RentalManagement.active=false`;
- références locataire/propriétaire absentes;
- paiements orphelins ou rattachés au mauvais périmètre;
- matrice complète Contrat → Property → RentalManagement → Occupation → Paiements → État;
- compteurs conflits/doublons/ignorés et vérification post-apply;
- revalidation de chaque action immédiatement avant écriture;
- journal `ActionLog` avec ancien/nouvel état;
- verrou préalable à la création future du contrat.

## Web, cockpit, statistiques, dossiers et documents

- Gestion Locative liste séparément `/rental-management` et `/contrats`; ses KPI agrègent `RentalManagement.managementActivated=true` et les contrats/paiements.
- Property Cockpit et Dossier reconstruisent leurs sections depuis les modèles existants.
- Documents Gestion locative proviennent de `Contrat.documents[]`; aucun document ne doit être déplacé ou dupliqué.
- Les tableaux de bord seront cohérents automatiquement si `RentalManagement`, `Property` et `Contrat` sont synchronisés par les services officiels.
- Aucun nouvel écran Web n'est requis : le moteur reste une opération contrôlée de maintenance, hors route HTTP.

## Mobile

Les écrans Mobile consomment les mêmes sources backend et NAV-CORE. Aucune incohérence spécifique Mobile n'a été identifiée; aucune modification Mobile n'est prévue.

## Cartographie réelle initiale — 5 août 2026

Lecture agrégée de la base configurée :

- 17 contrats au total, tous de type `location`, tous `actif`.
- 17 contrats ouverts.
- 8 `Property`, dont 4 de type `location` (1 `Loué`, 3 `Disponible`).
- 1 `RentalManagement`, actif et `managementActivated=true`.
- 0 `Paiement`.
- 34 `Locataire`.
- 2 `Proprietaire`.

Le dry-run historique classe les 17 contrats `ANOMALY_NO_PROPERTY_REFERENCE`. Aucun ne référence un `Property`; ils sont donc tous non réparables automatiquement. Résultat initial : 0 cohérent, 0 réparable, 17 anomalies, 0 modification planifiée.

Cette base contient vraisemblablement des contrats de partenariat/hébergement historiques enregistrés avec `type=location`, et non des baux immobiliers complets. Sans référence `bien`, il est interdit de leur associer arbitrairement l'un des 8 Property ou de créer un RentalManagement.

## Classification initiale

- Cas A — valide avec gestion active : 0 selon le scan disponible.
- Cas B — Property valide, RentalManagement absent : 0.
- Cas C — Property inexistant/référence absente : 17 (référence absente).
- Cas D — doubles contrats ouverts par Property : 0 détectable, puisque les 17 références Property sont absentes.
- Cas E — contrat ouvert sur bien vendu/archivé/retiré : 0 détectable.
- Cas F — RentalManagement inactif : 0.
- Paiements incohérents : 0 document Paiement présent.

## Architecture retenue après audit

1. Étendre le moteur existant plutôt qu'en créer un second.
2. Scanner tous les contrats locatifs ouverts et charger en lots les Property, RentalManagement, Paiements, Locataire et Proprietaire.
3. Bloquer l'apply pour tout groupe conflictuel ou toute relation absente; ne planifier que les cas dont le Property location, le propriétaire, le locataire et l'unicité du bail sont prouvés.
4. Revalider l'action juste avant l'apply, puis réutiliser `syncLeaseOccupation` et enregistrer un `ActionLog` complet.
5. Rejouer automatiquement le diagnostic après l'apply.
6. Garantir les créations futures en activant/validant le RentalManagement avant l'insertion du Contrat, sans dupliquer la synchronisation d'occupation existante.
7. Ne modifier ni Web ni Mobile en l'absence d'incohérence de présentation propre à ces clients.

## Risques avant réalisation

- Les 17 anomalies réelles sont non réparables sans décision humaine reliant explicitement chaque contrat à un Property; aucune modification de ces données ne sera tentée.
- Les notifications de la synchronisation existante peuvent être émises lors d'un apply réel; l'apply doit rester explicitement autorisé et protégé en production.
- MongoDB standalone ne garantit pas une transaction multi-document; la revalidation et l'idempotence réduisent le risque mais ne remplacent pas une sauvegarde opérateur.
- L'index unique actuel ne protège que les nouveaux documents qui possèdent une référence `bien`; les contrats legacy sans `bien` resteront signalés.
