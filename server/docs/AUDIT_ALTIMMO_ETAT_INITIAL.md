# AUDIT ALTIMMO — ÉTAT INITIAL

Date : 2026-08-13  
Branche : `main`  
HEAD initial : `5a87cb4307d09ed7d10681dcdeaa7bd7f14c6ebc` (`Update Altimmo 19`)

## Architecture trouvée

Altimmo n'est pas un module isolé : il s'appuie sur `Property` comme bien/annonce physique, puis sur des agrégats spécialisés. Le flux public canonique est `page Next/React` → `client/lib/services/propertyService.js` → Axios centralisé → `/api/altimmo/search` ou `/api/properties` → route Express → auth optionnelle → `propertyController.runPropertySearch` / `propertyFilterService` → `Property` et, pour l'hébergement, `Accommodation` → MongoDB.

Les domaines spécialisés existants sont : vente (`RealEstateReservation`, `Transaction`, `PaiementTransaction`, finalisation financière), location (`RentalManagement`, `Contrat`, `Locataire`, `Paiement`), patrimoine (`propertyAsset*`), visite (`Visite` + workflow/automation), documents (`Document`, documents de bail privés et noyau financier), messagerie (`Conversation`, `Message`) et notifications.

## Modèles trouvés

- Bien/annonce : `Property`; `Accommodation` reste une source distincte pour les séjours.
- Propriété métier : `Property.owner` référence un `User`; la fiche métier `Proprietaire` est distincte et peut optionnellement référencer un `User`. `Proprietaire.biensPropres` est un legacy embarqué importable vers `Property` avec identifiant stable.
- Location : `RentalManagement` porte occupation/publication/mandat; `Contrat` porte la vérité contractuelle; `Locataire` porte le dossier et un lien utilisateur explicite; `Paiement` porte les échéances locatives.
- Vente : `Transaction` porte le dossier de transaction issu d'une réservation; `PaiementTransaction` porte les encaissements; la finalisation est idempotente et garde l'état antérieur du bien.
- Visites : `Visite` contient encore un ancien `statut` et un nouveau `status` plus détaillé, avec snapshots, frais, consentements et historique.
- Finance transverse : `FinancialDocument`, `FinancialPayment`, `PaymentAllocation`, `FinancialLedgerEntry`, volontairement séparés des modèles legacy/location.
- Documents privés : `privateAssetSchema` et endpoints contrôlés; les sérialiseurs de `Proprietaire`, `Locataire` et `Contrat` masquent URL/asset permanents.

## Routes trouvées

- Public : `GET /api/properties`, `/latest`, `/:id`, `/recommended`, `GET /api/altimmo/search`.
- Property owner/staff : création/update/delete, mes biens, portfolio, modération, recommandation.
- Admin legacy : `/api/admin/properties*`; une seconde déclaration `adminPropertyRoutes.js` existe mais n'est pas montée dans `server.js`.
- Vente : `/api/sale-properties`, `/api/transactions`, `/api/real-estate-applications`.
- Location : `/api/rental-properties`, `/api/rental-management`, `/api/contrats`, `/api/locataires`, `/api/proprietaires`, `/api/paiements`, lifecycle/régularisation/maintenance.
- Documents : `/api/documents`, `/api/gestion-docs`, `/api/rental-documents`, `/api/dossiers`, `/api/financial`.
- Relation client : `/api/visites`, `/api/conversations`, `/api/messages`, `/api/notifications`.

## Pages frontend trouvées

- Deux familles publiques compatibles existent sous `/altimmo/*` et `/immobilier/*`, avec pages annonce, détail, achat, location, séjour et services.
- Parcours personnels : favoris, visites, paiements, espace locataire, messages, activation du portail.
- Staff : propriétés, modération, propriétaires, locataires, baux, paiements, préavis, maintenance, documents, transactions et dossiers immobiliers.
- Une page legacy active existe sous `/admin/properties` et monte `AdminPropertyList`, distincte du dashboard canonique.

## Services trouvés

`propertyService`, `propertyFilterService`, `salePropertyService`, `rentalPropertyService`, `rentalManagement*`, `rentalLease*`, `propertyTransactionService`, `realEstateTransactionFinalizationService`, `visiteWorkflowService`, `visiteAutomationService`, `tenantPortalService`, `propertyAsset*`, `rentalMaintenanceService`, services documentaires/financiers et notification.

## Connexions frontend/backend

- Recherche publique canonique : raccordée et normalisée (`offerType`, `propertyType`, `city`, prix, pagination).
- Le header de sélection tenant est émis par Axios; sa correction CORS est un changement antérieur au présent sprint.
- `AdminPropertyList` actif appelle bien un endpoint existant pour la lecture, mais interprète la réponse enveloppée comme un tableau brut. Il appelle ensuite `PUT /properties/:id/approve`, endpoint inexistant, et utilise l'ancien booléen `isApproved` au lieu de `statusAdmin`.
- `ModerationPage` legacy appelle aussi une URL de modération non canonique, mais n'est pas monté. `PropertyModerationPage` monté utilise la route canonique.
- `CompleteTransactionModal` appelle une route inexistante, mais aucun composant ne l'importe actuellement; la vraie finalisation exige une `Transaction` et passe par `/api/transactions/:id/finalize`.

## Règles métier réellement implémentées

- Une annonce publique exige `availability=Disponible`, `statusAdmin=Validée`, `isPublished=true`, `pole=Altimmo`.
- Le détail public applique les mêmes contraintes; owner et Admin du tenant ont un accès privilégié contrôlé.
- La modération change `statusAdmin`, mais la validation ne force pas actuellement `isPublished=true`; le message affirme pourtant « visible », ce qui peut être faux.
- Un propriétaire ne peut modifier que son bien; les champs sensibles/cycles sont filtrés et une modification repasse en modération.
- Un bien avec historique transactionnel/contractuel ne peut être supprimé par la route owner; il doit être archivé.
- Une transaction active par bien et un contrat ouvert par bien/type sont protégés par indexes uniques partiels.
- Une location active synchronise `RentalManagement`, `Contrat` et l'occupation via les services existants; GL-B2/GL-B3 ne doivent pas être recréés.

## Duplications

- Trois surfaces de modération Property : routes `/api/properties/admin`, routes `/api/admin`, et `adminPropertyRoutes.js` non monté.
- Deux écrans staff : `PropertyModerationPage` canonique et `AdminPropertyList` legacy actif sur une autre URL.
- Champs location legacy encore présents dans `Property` et champs canoniques dans `RentalManagement`, explicitement conservés pour compatibilité.
- `Visite.statut` legacy et `Visite.status` workflow moderne coexistent.
- Deux familles d'URL publiques `/altimmo` et `/immobilier` restent à caractériser (alias SEO versus duplication réelle).

## Bugs confirmés

1. **P1 — page `/admin/properties` cassée** : forme de réponse erronée, état legacy `isApproved`, méthode/route de validation inexistante.
2. **P1/P2 — validation et publication divergentes** : `updatePropertyStatus(validate)` laisse `isPublished` inchangé mais notifie que le bien est visible. Une création propriétaire initialise `isPublished=false`; une validation seule peut donc produire `Validée + non publiée`, invisible au public.
3. **P2 — pagination publique tous types** : le post-filtre hébergement intervient après pagination et après le count, donc `total` peut être surévalué et une page sous-remplie.
4. **P3 — sitemap `limit=500`** : la requête de production identifiée vient de `client/app/sitemap.js`, pas d'une page utilisateur. Elle est légitime fonctionnellement pour collecter les IDs, mais non paginée et plafonnée arbitrairement; au-delà de 500 éléments, le sitemap devient incomplet.
5. **P3/P4 — code mort** : `CompleteTransactionModal`, `ModerationPage` et `adminPropertyRoutes.js` exposent des contrats obsolètes sans consommateur/montage démontré.

## Problème `/api/properties` → 0 résultat

Le filtre observé correspond exactement à la règle publique implémentée; `APIFeatures` ne l'invente pas. Le dernier contrôle production en lecture seule réalisé avant ce sprint comptait `properties: 0` après le reset autorisé : dans cet état, `total=0` est factuellement correct et ne justifie pas de retirer un filtre. Une nouvelle lecture seule sera faite avant le rapport final; aucune migration n'est indiquée à ce stade.

## Risques

- Confusion « validé » versus « publié » et notification trompeuse.
- Surface legacy `/admin/properties` accessible mais non fonctionnelle.
- Plusieurs vocabulaires de statuts et plusieurs systèmes financiers rendent toute fusion/refonte dangereuse.
- Potentiel IDOR à auditer endpoint par endpoint malgré les protections tenant déjà étendues.
- Upload/rollback Cloudinary et liens de notifications à vérifier systématiquement.

## Dette technique

- Routes et composants legacy non supprimables sans décision de compatibilité.
- Pagination mixte Property/Accommodation imparfaite.
- Sitemap non paginé.
- Double vocabulaire visite et paiement conservé pour données historiques.
- `propertyController.js.bak` est un artefact source à comparer puis traiter séparément.

## Priorités

- **P0** : aucun défaut critique confirmé à ce stade; audit IDOR/mass-assignment/document privé en cours.
- **P1** : réparer ou rediriger `/admin/properties`; aligner validation/publication selon la règle existante démontrable.
- **P2** : vérifier transitions visite/location/vente, notification recipients/links, puis corriger les incohérences prouvées.
- **P3** : pagination sitemap et recherche mixte; UX/SEO/états d'erreur.
- **P4** : consolidation documentée des surfaces legacy, sans suppression pendant ce sprint sans preuve de non-consommation externe.
