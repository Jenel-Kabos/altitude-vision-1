# ARCH-2L — Analyse de l'edge

## Avant

`locationReport.js` importait `rentals` depuis `dashboardAnalyticsController.js`. Le DomainReport avait un call site ; le controller utilisait aussi la même fonction dans `getModuleAnalytics`, soit deux call sites fonctionnels.

Signature historique : `async rentals({ scopeUserIds = null } = {})`. Entrée : Set/tableau d'identifiants owners ou `null`. Sortie : `{kpis}`. Exceptions Mongo/ObjectId propagées sans mapping. Aucune dépendance `req/res/next/status/json/headers/cookies`.

La recherche explicite de `save/create/insert/update/findOneAndUpdate/delete/bulkWrite/session` dans la fonction ne trouve aucune mutation. Aucun email, notification, Socket.IO, Cloudinary, webhook, audit log, provider ou écriture financière.

## Ordre historique verrouillé

1. calcul `now`, `soon=now+30×86400000` ;
2. Set→tableau puis chaque ID→`new mongoose.Types.ObjectId(String(id))` si scope truthy ;
3. query Property séquentielle si scope ;
4. construction des filtres ;
5. query Contrat séquentielle si scope ;
6. `Promise.all` de quatre opérations : RentalManagement, Contrat, Paiement, RentalMaintenanceTicket ;
7. spread des fallbacks dans `{kpis}`.

Une erreur des deux pré-requêtes empêche les quatre agrégations. Une erreur d'une branche du `Promise.all` rejette l'ensemble. Cet ordre est inchangé.

## Après

Owner canonique : `services/reporting/rentalReportQueryService.js`, symbole `getRentalReportData`. Le code de query a été déplacé textuellement. Le controller conserve son handler HTTP et référence le nouvel owner dans sa table de handlers. Le DomainReport importe directement le même owner. L'ancien helper/export `rentals` est supprimé, sans duplication.
