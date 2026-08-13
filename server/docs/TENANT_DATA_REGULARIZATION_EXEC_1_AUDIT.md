# TENANT-DATA-REGULARIZATION-EXEC-1 — Audit avant implémentation

Date : 2026-08-13  
Base cible : `altitudevision`  
Portée : Phase 1 uniquement, Catégorie A

## Conclusion

Le dépôt possède déjà un moteur canonique d'attribution fail-closed :
`services/platformTenant/tenantResourceAttributionService.js`. Il est réutilisé ; aucun second moteur d'attribution n'est créé. Le script read-only canonique est
`scripts/auditTenantLegacyData.js`. `ActionLog` est le journal append-only existant et sera utilisé comme checkpoint minimal, avec une clé unique par batch/ressource/opération.

Il n'existe aucun batch runner ni rollback tenant préexistant approprié. Les scripts bootstrap sont idempotents mais spécifiques au provisioning et ne doivent pas être détournés.

## Revalidation réelle strictement read-only

Commande : `auditTenantLegacyData.js --confirm-database=altitudevision --tenant=<tenant exact>`.

Résultat courant : 376 ressources ; A=67, B=50, C=0, D=43, E=0, F=216. Le diff avec la baseline est nul, y compris par collection. `writes=0`, `alreadyScoped=0`. La suite est donc autorisée ; aucun manifeste obsolète n'est utilisé.

## Graphe et types A

Les candidats A réels sont : Property (2), RentalManagement (1), Visite (2), Conversation (9), Message (50), Document (1), Hotel (1), Accommodation (1). L'ordre doit respecter les relations effectivement utilisées comme preuves : racines Property/Hotel, puis RentalManagement/Accommodation/Conversation, puis Visite/Message/Document selon leurs dépendances.

`Conversation`, `Message`, `Document`, `Hotel` et `Accommodation` ont déjà un champ tenant. `Property`, `RentalManagement` et `Visite` n'en avaient pas : un champ `tenant` nullable et indexé est requis pour rendre l'attribution persistante et visible par le runtime. Cet ajout est strictement additif et ne touche ni publication, ni prix, ni statut, ni propriétaire, ni stockage.

## Journal, concurrence et reprise

`ActionLog` sera enrichi d'une enveloppe structurée sans secrets. Une transaction Mongo associera l'update atomique du seul champ tenant à son journal. Le filtre compare `_id`, tenant attendu et fingerprint pertinent ; deux applies concurrents ne peuvent donc produire qu'une mutation. Le journal sert de checkpoint de reprise. Un rollback jetable restaure uniquement le tenant précédent et refuse toute divergence.

## Exclusions fermées

B/C/D/E/F sont refusées par le moteur d'exécution. Les 17 Contrat `bien:null`, les 6 utilisateurs fantômes et la Property cassée restent read-only. Aucun appel Cloudinary, aucune création de Property/RentalManagement, aucune modification financière, aucun credential, commit, push ou deploy.
