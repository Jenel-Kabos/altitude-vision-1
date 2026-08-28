# ARCH-2I — Résolution de l'edge legacy

## Trace

- Import : `routes/projetsRoutes.js:3 → ../models/Projet`.
- Usage : quatre opérations CRUD (`find`, constructeur+`save`, `findByIdAndUpdate`, `findByIdAndDelete`).
- Montage Express : aucun `require` ni `app.use` dans `server.js`; aucun routeur actif ne l'inclut.
- Modèle : `models/Projet.js` absent. Un `require` direct échouerait avec `MODULE_NOT_FOUND`.
- Endpoint : aucun préfixe runtime, donc aucun endpoint accessible.
- Consumers : aucune référence à `projetsRoutes`; le client possède des flux `/altcom/projects` actifs et un ancien écran appelant `/projects`, mais aucune preuve ne relie ce dernier à ce routeur non monté et au modèle absent.
- Tests/fixtures/Mongo : aucun test ou fixture direct identifié.
- Sécurité : aucun middleware dans le fichier ; aucune frontière active car le routeur est inaccessible.

## Classification finale

**DEAD_ROUTE.** L'import n'est pas mort à l'intérieur du fichier, mais le fichier entier est hors graphe runtime et non chargeable. Ce n'est ni un faux positif statique, ni une security boundary, ni une dette applicative vivante. Un micro-sprint de retrait pourra supprimer le routeur et son entrée de baseline après vérification historique ; ARCH-2I ne modifie rien.

`realisationsRoutes.js` partage le non-montage, mais son modèle et une collection historique existent : classification runtime `DEAD_ROUTE`, avec conservation des données jusqu'à une décision lifecycle dédiée.
