# ARCH-2C4 — Contrat de parité

Le test `propertyPublicationInputBoundary.test.js` a été exécuté sur les exports historiques avant modification : 7/7 vert. Le même test importe ensuite `propertyPublicationInputService` : 7/7 vert. Valeurs, erreurs 422, adresse, GeoJSON, arrays, montants, upload, `owner`, `type`, `status`, `statusAdmin`, defaults et Parcelle sont identiques.

Aucun filtre/query Mongo n'appartient au symbole extrait. Le contrat HTTP reste détenu par les controllers inchangés.
