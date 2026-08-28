# ARCH-2E — Architecture Property

## Cartographie mesurée

- Route principale `propertyRoutes.js` : 18 endpoints.
- Surface Property nommée : 5 routeurs (`property`, `saleProperty`, `rentalProperty`, `propertyAsset`, `adminProperty`), 33 déclarations d'endpoints.
- Controllers nommés : 7 (`property`, mobile, sale, rental, asset, portfolio, public API), auxquels s'ajoutent Accommodation et Hotel pour les publications composites.
- Services nommés Property : environ 16, plus des services transversaux de dossier, finance, tenant, CRM et rental.
- Imports directs du modèle Property : 20 controllers, 23 services/middlewares et 1 route.
- `propertyController.js` : 1199 lignes et au moins 17 handlers/helpers exportés ; responsabilités recherche, CRUD, lecture publique, modération, recommandation, social, ownership et tenant.
- Dette stricte Property restante : une controller→controller (`runPropertySearch`), aucune service→controller après ARCH-2D2, une route→model indirectement liée au dashboard.

## État des responsabilités

- Publication input : partiellement centralisée dans `propertyPublicationInputService`; orchestration spécialisée répartie entre web/mobile, vente, location, Accommodation et Hotel.
- Recherche : normalisation partagée par `propertyFilterService`, mais query Property dans le controller ; hébergement possède `accommodationSearchService`.
- Modération : non centralisée ; Property, Accommodation et Hotel conservent des workflows distincts et volontairement spécialisés.
- Tenant/ownership : primitives canoniques existent, mais orchestration distribuée dans plusieurs controllers/services.
- Web/mobile : ils réutilisent désormais le même helper mobile canonique, mais pas un unique workflow backend pour tous les types d'annonce.

## Hypothèse Facade

Une façade Property globale n'est pas justifiée maintenant : elle agrégerait recherche, publication, modération, social, patrimoine et tenant en God Service. Le gain potentiel est fort, mais le blast radius et le risque produit sont maximaux.

Une couche applicative minimale pourrait être justifiée ultérieurement par cas d'usage, par exemple `PropertySearchQuery` ou orchestration de publication d'un type précis. Elle ne devrait jamais devenir `PropertyService.js` universel. Avant cela, il faut stabiliser les prédicats de visibilité et caractériser séparément Vente, Location et Hébergement.
