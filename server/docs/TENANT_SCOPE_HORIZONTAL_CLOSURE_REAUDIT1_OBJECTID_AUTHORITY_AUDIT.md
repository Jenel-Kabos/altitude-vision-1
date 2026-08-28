# TENANT-SCOPE-HORIZONTAL-CLOSURE-REAUDIT-1 — Audit IDOR / autorité par ObjectId

Recherche exhaustive de tout handler `findById(req.params.id)` / `findOne({_id})` / `findByIdAndUpdate` / `findByIdAndDelete` / `findOneAndUpdate` / `findOneAndDelete` dans `server/controllers/*.js`, avec vérification de la présence d'une autorité (tenant et/ou ownership/participant/staff) avant lecture/mutation.

## Pattern dominant observé

La campagne Tenant Scope a, dans chaque domaine touché, appliqué son correctif au niveau du **handler nommé par le hotfix** (souvent via un `router.param('id', ...)` centralisé pour toutes les routes `:id` d'un même fichier de routes). Ce re-audit a cherché systématiquement les **endpoints frères non couverts par ce `router.param`** — soit parce qu'ils vivent dans un fichier de routes différent opérant sur le même modèle (RA-05 : `rentalLeaseLifecycleRoutes.js` vs `contratRoutes.js`), soit parce qu'ils contournent le paramètre `:id` en prenant l'identifiant depuis le corps de la requête (RA-03 : `encaisser-multiple`), soit parce que le fichier concerné n'a simplement jamais reçu ce traitement (RA-06 à RA-09, RA-13 à RA-15).

## Findings IDOR confirmés (renvoi à `_FINDING_MATRIX.md` pour le détail complet)

- **RA-01** — `sendMessage` : `Conversation.findById(conversationId)` sans autorité.
- **RA-03** — `encaisserMultiple` : `Paiement.find({_id: {$in: paiementIds}})` avec `contrat` non vérifié contre le tenant.
- **RA-05** — `rentalLeaseLifecycleController.*` : chaque export résout `Contrat`/`RentalManagement` par `:id` sans jamais passer par un garde tenant.
- **RA-09** — `adminController.approveProperty/rejectProperty/deleteProperty` : `Property.findById`/`findByIdAndDelete` sans aucune autorité.
- **RA-10** — `accommodationController.updateFull` : `Property.findById(req.params.propertyId)` sans `assertAccommodationAccessible`.
- **RA-11** — `salePropertyController.updateFull`/`rentalPropertyController.updateFull` : ownership vérifié pour Proprietaire seulement, jamais pour le staff.
- **RA-12** — `propertyAssetController.transition` : aucun appel à `assertReadAccess`, contrairement à ses 5 handlers GET.
- **RA-13** — `hotelStaffAssignmentController.*` : `HotelStaffAssignment.findById(assignmentId)` jamais recroisé avec le `hotelId` de l'URL déjà autorisé.

## Findings SAFE marquants sur ce même axe (contre-exemples démontrant que le pattern correct existe et est appliqué ailleurs)

- `propertyController.updateProperty/deleteProperty` → `assertPropertyTenantAccess` avant toute mutation.
- `accommodationController.update/submit/reviewDecision/deactivate/reactivate/duplicate/remove` → `assertAccommodationAccessible`.
- `hotelController.updateFull/submit/reviewDecision/...` → `assertHotelAccess` → `assertOperationalHotelAccess`.
- `roomCategoryController`/`roomController`/`roomAssignmentController` → dérivent toujours `hotelId` de la ressource chargée (`category.hotel`, jamais d'un paramètre d'URL indépendant) avant `assertOperationalHotelAccess` — c'est le contre-modèle exact de RA-13.
- `rentalManagementController.*` → `router.param('id')` centralisé avec `assertResourceTenantOrUnattributed`.
- `paiementController.getOne/update/delete/marquerPaye/listReceipts/cancelReceipt` → `router.param('id')` centralisé (seuls `getAll/getStats/getAlertes/encaisserMultiple` y échappent, cf. RA-02/RA-03).
- `contratController.getOne/update/delete/getPaiements/createPaiement` → même garde (seul `getAll` y échappe, cf. RA-04).
- `locataireController`/`proprietaireController` `:id` → `assertLocataireInScope`/`assertProprietaireInScope` (seules les listes/dossiers y échappent, cf. RA-15).
- `financialController.*` → `assertCan*` → `assertFinancialScope`/`assertResourceTenant` systématique.
- `rentalDocumentController.download` → relation réelle (owner du bien / locataire du contrat / staff tenant) vérifiée avant tout accès.

## Conclusion de cet axe

Le pattern IDOR classique (ressource chargée par ObjectId puis lue/mutée sans autorité) n'est **pas** un problème générique et systématique du code — c'est un problème de **couverture incomplète** du correctif déjà connu et déjà appliqué avec succès ailleurs. Chaque finding confirmé ci-dessus a un contre-exemple SAFE dans le même fichier ou le même domaine, ce qui exclut l'hypothèse d'une architecture fondamentalement non sécurisable et pointe vers un besoin de généraliser le pattern existant aux endpoints oubliés.
