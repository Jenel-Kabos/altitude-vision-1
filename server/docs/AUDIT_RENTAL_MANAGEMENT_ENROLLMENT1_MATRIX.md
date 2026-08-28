# AUDIT-RENTAL-MANAGEMENT-ENROLLMENT-1 — Matrice

## Compteurs

| Indicateur | Source actuelle exacte | Filtres déterminants | Exige RM activé ? | Appréciation |
|---|---|---|---|---|
| Biens inscrits | `Property.aggregate` dans `rentalManagementController.stats` | `_id ∈ propertyIds tenant`, `status=location`, `availability!=Retiré`, owner présent, lookup User puis `role=Proprietaire` | Non | Catalogue locatif, pas enrôlement GL |
| Biens gérés | `RentalManagement.aggregate.total` | `managementActivated=true`, `property ∈ propertyIds tenant` | Oui | Source canonique du portefeuille activé |
| Onglet Biens gérés | `GET /rental-management` | par défaut `managementActivated=true`, owner dans scope tenant | Oui | Même concept, mais badge UI = longueur de la page chargée (25 par défaut) |
| Vacants | même agrégation RM | RM activé + `occupancyStatus=vacant` | Oui | Une annonce seule ne compte pas |
| Publiés | même agrégation RM | RM activé + `publicationStatus=publie` | Oui | Publication du dossier locatif, pas directement `Property.isPublished` |
| Maintenance (header) | même agrégation RM | RM activé + `availabilityStatus=maintenance` | Oui | État opérationnel GL |
| Impayés | `Paiement.countDocuments` | contrat dans les contrats `type=location` des Property tenant + statut `impayé/en_retard` | Indirectement non | Les nouveaux contrats activent RM; des contrats legacy sans RM peuvent néanmoins compter |
| Contrats actifs (header) | calcul client sur `getContrats()` | `statut=actif`, sans filtre `type=location` | Non | Inclut aussi les ventes actives : incohérent pour ce KPI GL |
| Contrats ≤ fenêtre | `Contrat.countDocuments` | contrat location tenant, `statut=actif`, fin dans fenêtre | Non direct | Cohérent pour location, legacy possible |
| Contrats expirés | `Contrat.countDocuments` | contrat location tenant, expiré ou actif avec date passée | Non direct | Cohérent pour location, legacy possible |
| Maintenance ouverte (vue d'ensemble) | `GET /rental-maintenance`, filtrage client des statuts ouverts | aucun `propertyId` envoyé | Non | Pour le staff, la query backend est vide : scope tenant non appliqué à la liste |

## Scénarios

| Scénario | Comportement actuel | Cohérence avec règles proposées |
|---|---|---|
| A. Vente publiée, sans RM | Exclue de `biensInscrits` et des KPI RM | Cohérent |
| B. Location publiée, sans RM activé | `biensInscrits +1`; aucun impact sur géré/vacant/publié GL/maintenance | Contradiction sur le seul label/compteur inscrit |
| C. Property + RM non activé | `biensInscrits +1` si owner Proprietaire; géré = 0 | Le code traite « inscrit » comme catalogue, pas pré-enrôlement |
| D. Property + RM activé sans bail | inscrit +1, géré +1, vacant selon `occupancyStatus` (défaut `vacant`) | Cohérent |
| E. Property + RM activé + bail actif | inscrit +1, géré +1, occupé/contrat actif après synchronisation | Cohérent, sauf compteur UI contrats actifs qui inclut aussi les ventes |

## Règles RM-01 à RM-06

| Règle | Verdict | Preuve synthétique |
|---|---|---|
| RM-01 | Confirmé par architecture opérationnelle, contredit par le KPI `biensInscrits` | annonce seule : RM absent/non activé, mais Property comptée |
| RM-02 | Confirmé par architecture | CTA/API d'onboarding et `managementActivated` existent |
| RM-03 | Contredit partiellement par code actuel | `biensInscrits` vient du catalogue; impayés/alertes dérivent des contrats et non du RM |
| RM-04 | Confirmé par architecture | annonce locative avec RM non activé couverte par tests |
| RM-05 | Confirmé pour le KPI inscrit | `status=vente` exclu; une activation GL normale refuse la vente |
| RM-06 | Confirmé pour KPI RM principaux, contredit par deux lectures périphériques | vacant/publié/maintenance header exigent RM; contrats actifs et maintenance overview ont un scope plus large |

## Tenant scope limité à cet écran

- `stats`, liste RM, contrats, paiements, locataires et propriétaires dérivent leur périmètre des Property dont l'owner appartient au scope tenant.
- Le header `RentalManagement.stats` est tenant-scoped via `propertyIds`.
- Exception démontrée : `rentalMaintenanceController.list`, pour un staff sans `propertyId`, laisse la query vide malgré `requireTenantScope`; la vue d'ensemble consomme précisément ce chemin.

