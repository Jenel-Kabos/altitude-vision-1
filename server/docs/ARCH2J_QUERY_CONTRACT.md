# ARCH-2J — Contrat query

1. Normaliser un `Set` en tableau, puis chaque id en `mongoose.Types.ObjectId`.
2. `propertyFilter = { status: 'vente', owner: {$in: ids} }` si scope, sinon `{status:'vente'}`.
3. `Property.find(propertyFilter).distinct('_id')` avant les quatre lectures parallèles.
4. `Property.aggregate` : total, published, drafts, sold, active. Published exige exactement `statusAdmin='Validée'`, `isPublished=true`, `availability='Disponible'`, `pole='Altimmo'`.
5. `Visite.countDocuments` : property dans ids, `scheduledStartAt >= now`, statut hors `Terminée/Annulée`.
6. `Transaction.aggregate` : `transactionType='vente'`, property dans ids ; pending `En cours/Paiement en attente`, montants et commission seulement `Réussie`.
7. `Transaction.find` : vente + Réussie + ids, tri `transactionDate:-1`, limite 5, projection existante, populate `property.title`, lean.

Aucune pagination externe, aucun filtre période, aucun changement d'ordre, de pipeline, de projection ou de parallélisation.
