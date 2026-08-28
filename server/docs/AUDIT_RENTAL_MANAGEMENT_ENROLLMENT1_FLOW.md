# AUDIT-RENTAL-MANAGEMENT-ENROLLMENT-1 — Flux

## Modèle courant

```text
Property (bien physique + socle de l'annonce Altimmo)
  ├─ vente       → aucun RentalManagement automatique
  └─ location
       ├─ flux annonce POST /api/rental-properties
       │    └─ RentalManagement créé comme satellite de fiche
       │       managementActivated=false
       ├─ action explicite « Ajouter un bien à la gestion locative »
       │    UI GestionLocativePage
       │    → getRentalOnboardingOptions()
       │    → POST /api/rental-management/onboarding
       │    → rentalManagementController.onboard
       │    → rentalAssetOnboardingService.activateExisting
       │    → upsert RentalManagement, managementActivated=true, active=true
       └─ création explicite d'un bail
            POST /api/contrats
            → contratController.create
            → ensureRentalManagementActive AVANT Contrat.create
            → RentalManagement managementActivated=true, active=true
            → Contrat → Locataire → échéances Paiement
```

`Property` est la représentation persistante du bien physique et sert aussi de socle commun à l'annonce. Les champs `status`, `statusAdmin`, `isPublished`, `availability`, prix, adresse et médias portent sa projection commerciale. Le modèle conserve des champs locatifs historiques pour compatibilité.

`RentalManagement` est le satellite locatif unique par `Property` (`property` unique). Il combine actuellement deux responsabilités : fiche spécifique de location et dossier opérationnel de gestion. `managementActivated` sépare la simple fiche (`false`) du portefeuille pris en gestion (`true`). Il porte occupation, disponibilité, publication locative, bail/locataire actifs, maintenance sommaire et historique.

## Entrées en gestion démontrées

1. CTA existant « Ajouter un bien à la gestion locative » / « Activer en gestion locative » : activation canonique d'un Property existant.
2. `POST /api/rental-management` : ancienne API d'activation explicite, toujours présente.
3. Création d'un contrat de location : activation implicite mais effectuée avant l'insertion du bail ; le contrat constitue l'action métier explicite.
4. Import historique `Proprietaire.biensPropres[]` : crée un Property interne puis un RentalManagement actif.
5. Réconciliation historique : peut reconstruire/réactiver le dossier pour des baux legacy ; ce n'est pas un flux utilisateur normal.

La création générique d'une `Property` ne crée pas elle-même de dossier opérationnel. Le nouveau flux de création d'annonce locative crée toutefois un satellite `RentalManagement` avec `managementActivated:false`; il reste exclu des listes et statistiques opérationnelles.

## Lecture du dashboard

```text
GET /api/rental-management/stats
  ├─ propertyIds = Property.owner dans le scope tenant
  ├─ biensInscrits = Property(location, non retirée, owner role Proprietaire)
  ├─ total/vacant/published/maintenance = RentalManagement
  │    avec managementActivated=true et property dans propertyIds
  └─ impayés/partiels/alertes contrats = Contrat(location) des propertyIds
       → Paiement

GET /api/rental-management
  └─ onglet Biens gérés = RentalManagement managementActivated=true
       et owner dans le scope tenant (page par défaut : 25)
```

La valeur observée `1 Bien inscrit / 0 Biens gérés` est donc la combinaison attendue par le code actuel lorsqu'il existe exactement une `Property status:'location'`, non retirée, appartenant à un `User role:'Proprietaire'`, sans `RentalManagement.managementActivated:true`.

## Nouveau contrat

Le formulaire charge jusqu'à 1000 `Property` du portefeuille global et ne filtre pas la liste sur les dossiers déjà activés. Pour une location, le backend vérifie type et disponibilité puis appelle `ensureRentalManagementActive` avant `Contrat.create`. Un contrat de location créé via l'API courante ne peut donc pas rester sans RentalManagement actif. Des contrats historiques sans dossier sont néanmoins explicitement reconnus par les tests et le service de réconciliation.

