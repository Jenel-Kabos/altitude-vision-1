# GL-RECON-UX-1 — Audit initial

Audit effectué avant toute modification fonctionnelle. La base configurée a uniquement été lue.

## État réel des 17 contrats

- 17/17 ont un `Locataire` référencé.
- 17/17 ont un `Proprietaire` référencé.
- 17/17 ont `adresseBien` et `villeBien`.
- 5/17 ont un `montantLoyer`.
- 2/17 ont `dateEntree` et `dateFinBail`.
- 0/17 ont un document dans `Contrat.documents[]`.
- 0/17 ont une référence `bien` vers un `Property`.

Conclusion : les dossiers contiennent assez d'indices pour une revue humaine, mais pas assez de preuves pour un rattachement automatique. Les suggestions doivent être explicables et non décisionnelles.

## Existant réutilisable

- Le moteur GL-RECON-1 fournit la classification, la matrice, les conflits et la vérification.
- `rentalAssetOnboardingService` sait activer un Property existant ou créer un Property interne avec son RentalManagement.
- `rentalManagementLeaseSyncService` centralise l'activation et la synchronisation d'occupation.
- `ActionLog` conserve acteur, cible et ancien/nouvel état.
- Le Web possède les composants Dashboard, les services Gestion locative et la navigation staff.
- Les documents restent dans `Contrat.documents[]` et sont ouverts via le proxy sécurisé existant.

## Manques

- Projection staff des dossiers à régulariser avec locataire, propriétaire, données du contrat et suggestions.
- Décisions explicites : rattacher, créer un bien interne, clôturer comme historique, signaler une anomalie.
- Registre append-only des décisions et instantanés nécessaires à une annulation contrôlée.
- Procédure de réversion Admin-only avec motif obligatoire.
- Écran Web dédié et lien réservé à Admin/Gestionnaire immobilier/Collaborateur legacy.

## Architecture retenue

1. Créer un registre `RentalContractReconciliation` séparé et append-only. Il ne remplace ni Contrat, ni Property, ni RentalManagement.
2. Exposer une API staff dédiée, sans réutiliser les routes CRUD générales pour les décisions sensibles.
3. Calculer des suggestions simples par propriétaire explicitement lié, ville/adresse normalisées et loyer proche; retourner les raisons et le score, sans auto-sélection.
4. Pour un rattachement, revalider le Property, l'absence de bail ouvert concurrent et la relation propriétaire, puis synchroniser via les services certifiés.
5. Pour une création, réutiliser `rentalAssetOnboardingService.createManaged`, puis rattacher et synchroniser.
6. Pour un classement historique, conserver le contrat, passer son statut à `résilié` et son cycle à `archive`, sans supprimer paiements ni documents.
7. Pour une anomalie, ne modifier aucune donnée métier.
8. Réversion Admin-only, motif obligatoire, refusée si l'état courant a divergé ou si le Property créé a reçu d'autres relations. Aucune suppression automatique du Property/RentalManagement créé.

## Risques

- Les contrats sans loyer/dates ne peuvent être occupés proprement sans complétion humaine; l'UI doit afficher les champs manquants.
- Un rattachement erroné affecte les KPI et notifications : confirmation explicite et revalidation serveur obligatoires.
- Une réversion destructrice du Property créé serait dangereuse; elle est exclue. La réversion détache/restaure le contrat seulement et laisse le bien sous gestion pour traitement contrôlé.
