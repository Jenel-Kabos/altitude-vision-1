// F-U1 — Garde append-only partagée (même contrat que FinancialLedgerEntry) :
// un document créé ne peut plus être modifié ni supprimé par l'API Mongoose.
// Utilisé pour les versions de mandat, les décisions d'autorisation et les
// approbations de remboursement, dont l'historique doit rester immuable.
module.exports = function appendOnlyPlugin(schema, { errorCode }) {
  const block = () => { throw new Error(errorCode); };
  schema.pre(['updateOne', 'updateMany', 'findOneAndUpdate', 'replaceOne', 'findOneAndReplace', 'deleteOne', 'deleteMany', 'findOneAndDelete'], block);
  schema.pre('bulkWrite', block);
  schema.pre('save', function blockPersistedMutation() {
    if (!this.isNew) block();
  });
};
