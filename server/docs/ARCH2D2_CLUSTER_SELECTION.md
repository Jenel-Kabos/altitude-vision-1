# ARCH-2D2 — Sélection

Le cluster **Property mobile publication input** est retenu, limité au seul symbole `buildMobilePropertyData`.

La fonction est un helper pur : deux inputs explicites (`body`, `ownerId`), un objet en sortie, validations synchrones avec erreurs 400, aucune DB, notification, transaction, requête Express ou provider. L'abstraction canonique `propertyPublicationInputService.js`, créée par ARCH-2C4 pour les autres entrées de publication, existe déjà ; elle est donc réutilisée.

Le service d'orchestration `mobileAccommodationPublicationService` n'est pas déplacé ni modifié hors import. Le cluster reporting attend : ses quatre fonctions traversent tenant, Hotel, Property, transactions, paiements et documents financiers. Le supprimer en bloc pour améliorer le chiffre serait contraire au mandat.
