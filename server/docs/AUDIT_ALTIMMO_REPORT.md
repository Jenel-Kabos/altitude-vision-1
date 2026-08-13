# RAPPORT FINAL — SPRINT AUDIT ALTIMMO

Date : 2026-08-13  
Branche : `main`  
HEAD audité : `5a87cb4307d09ed7d10681dcdeaa7bd7f14c6ebc`

## 1. Résumé exécutif

L'audit a couvert le parcours immobilier public et staff, les modèles, contrats API, permissions, données, médias, notifications, Socket.IO, SEO et gates. Deux défauts prioritaires ont été corrigés : la page admin legacy cassée a été raccordée à la modération canonique; la validation d'un bien ne produit plus de fausse annonce de publication ni de diffusion inter-tenant. Les gates disponibles sont vertes. Aucun accès destructif, déploiement, commit, push ou appel Cloudinary réel n'a été effectué.

## 2. Architecture auditée

Zones inspectées : pages Next/React `/immobilier`, `/altimmo`, `/admin` et `/dashboard`; services Axios; routes/contrôleurs Express Property, vente, transactions, visites, propriétaires, locataires, gestion locative et documents; modèles Mongo/Mongoose associés; services tenant, notifications, Socket.IO, finance, patrimoine et médias. La cartographie détaillée figure dans `AUDIT_ALTIMMO_ETAT_INITIAL.md`.

## 3. Bugs trouvés

1. **P0 — diffusion de publication inter-tenant.** Symptôme : la validation d'un bien publié sélectionnait tous les utilisateurs actifs. Cause : `User.find` global après un contrôle tenant limité au bien. Impact : notification potentiellement envoyée hors tenant. Fichier : `propertyController.js`. Correction : résolution du scope tenant, filtre des destinataires et attribution `platformTenantId`. Test : contrôle exact du filtre et du tenant de notification.
2. **P1 — `/admin/properties` cassé.** Symptôme : lecture mal normalisée et validation vers `PUT /properties/:id/approve` inexistant. Cause : composant legacy fondé sur `isApproved`. Impact : modération impossible depuis cette URL. Fichier : `client/app/admin/properties/page.jsx`. Correction : montage du composant canonique `PropertyModerationPage`. Validation : lint, tests client et build Next.
3. **P1/P2 — validation confondue avec publication.** Symptôme : un bien `Validée + isPublished=false` était annoncé comme visible et diffusé. Cause : notification déclenchée sur la seule validation. Impact : message faux et événements prématurés. Correction : message conditionnel et broadcast uniquement si réellement publié. Test : absence de requête destinataires et de `notifyMany` pour un bien non publié.
4. **P2 restant — pagination mixte.** Le filtrage des `Accommodation` intervient après pagination/count des `Property`; une page peut être sous-remplie et le total surévalué. Une correction sûre exige une requête unifiée ou une pagination agrégée et n'a pas été improvisée.
5. **P3 restant — sitemap plafonné à 500.** `client/app/sitemap.js` demande 500 IDs sans parcourir les pages; le sitemap deviendra incomplet au-delà du seuil.
6. **P3/P4 — contrats legacy morts.** `AdminPropertyList`, `ModerationPage`, `CompleteTransactionModal` et `adminPropertyRoutes.js` contiennent des appels obsolètes mais ne sont plus montés/consommés dans les parcours canoniques audités.

## 4. Bugs corrigés

- **P0 :** destinataires de publication bornés au tenant validé.
- **P1 :** page admin raccordée au workflow canonique; distinction validation/publication rétablie.
- **P2 :** formulation propriétaire exacte et suppression de la diffusion prématurée.
- **P3 :** aucune correction risquée; limitations documentées.

## 5. Règles métier corrigées

Une annonce publique reste définie par `availability=Disponible`, `statusAdmin=Validée`, `isPublished=true`, `pole=Altimmo`. La validation administrative et la publication sont deux transitions distinctes : valider ne force pas la publication. Une diffusion `new_property` exige désormais les deux états et reste dans le tenant du bien.

## 6. Sécurité

Le contrôle du bien reste effectué via `assertResourceTenant`; le tenant résolu est désormais réutilisé pour limiter les destinataires. Les suites adversariales multi-tenant, permissions, documents privés et isolation passent. Aucun mass-assignment ou IDOR supplémentaire reproductible n'a été confirmé dans le périmètre inspecté.

## 7. Base de données

Les schémas et indexes Mongoose ont été inspectés et exercés par 82 suites Mongo/replica. Les contraintes uniques partielles protègent notamment transactions/contrats actifs et les écritures financières. Aucune migration n'est nécessaire pour les corrections livrées. Le dernier état production en lecture seule connu après reset contient zéro `Property`; le `total=0` public est donc cohérent. Aucune écriture production n'a été faite pendant ce sprint.

## 8. Frontend

`/admin/properties` rend maintenant `PropertyModerationPage`, déjà utilisé par `/dashboard/moderation/properties`. Les parcours publics, états loading/empty/error, filtres, permissions et navigations couverts par Vitest passent. Le build produit 142 pages statiques et conserve les aliases `/altimmo` et `/immobilier`.

## 9. Backend

`updatePropertyStatus` retourne le tenant validé, formule la notification selon `isPublished`, conditionne la diffusion au caractère public et requête uniquement les utilisateurs du scope tenant. Aucun nouveau modèle, endpoint ou système financier parallèle n'a été créé.

## 10. Connexions

Chaîne confirmée : Frontend Next/React ↔ Axios `/api` ↔ routes/contrôleurs Express ↔ services métier/tenant ↔ MongoDB. Cloudinary reste derrière les services d'assets et a été testé avec mocks/sandbox sans appel réel. Socket.IO et les notifications utilisent les événements existants; la diffusion corrigée porte désormais le tenant explicite.

## 11. Tests

- Ciblé Property : 1 suite, 35 tests, 0 échec.
- Ciblé recherche initial : 3 suites, 68 tests, 0 échec.
- Ciblé métiers Altimmo : 11 suites, 165 tests, 0 échec.
- Serveur unitaire complet : 114 suites, 1 279 tests, 0 échec, 121,495 s.
- Mongo/replica complet : 82 suites, 860 tests, 0 échec, 1 058,498 s; replica set arrêté proprement.
- Frontend complet : 76 fichiers, 513 tests, 0 échec, 32,02 s.

Les traces d'erreur des suites sont des scénarios négatifs/injections attendus (403, rollback, concurrence, upstream simulé), sans échec Jest/Vitest.

## 12. Gates qualité

- `server lint` : succès, 0 erreur, 129 warnings existants.
- `client lint` : succès, warnings existants (imports inutilisés et dépendances de hooks).
- `client build:next` : succès, 142 pages statiques générées.
- `server test:unit` : succès.
- `server test:mongo` : succès.
- `client test` : succès; avertissements de dépréciation Vite/Vitest, baseline-browser-mapping ancien et APIs JSDOM non implémentées.
- `git diff --check` : succès, aucune anomalie.
- Aucun script `health` ou `release-check` n'existe dans les packages; `verify` est équivalent aux lints exécutés et `ci` agrège les gates exécutées séparément.

## 13. Fichiers modifiés

- `client/app/admin/properties/page.jsx` : raccordement au composant canonique.
- `server/controllers/propertyController.js` : règle publication et isolation tenant des notifications.
- `server/__tests__/propertyRoutes.test.js` : deux régressions ciblées.
- `server/docs/AUDIT_ALTIMMO_ETAT_INITIAL.md` : état initial et cartographie.
- `server/docs/AUDIT_ALTIMMO_REPORT.md` : présent rapport final.

## 14. Dette technique restante

Pagination/count mixte Property/Accommodation; sitemap limité à 500; composants/routes legacy non montés; doubles vocabulaires historiques (`Visite`, location, finance); 129 warnings lint serveur et de nombreux warnings client; logs de tests très bruyants pour les erreurs attendues.

## 15. Risques production

- Avant mise en production, exécuter un smoke test authentifié de modération dans un environnement non productif avec deux tenants et vérifier les destinataires persistés.
- Au-delà de 500 annonces publiques, le sitemap est incomplet.
- La pagination mixte peut afficher un total supérieur aux résultats visibles.
- Aucun risque de migration ou de suppression de données introduit par ce patch.

## 16. Recommandations

- **Immédiat :** revue humaine du diff et smoke test bi-tenant de validation/publication.
- **Court terme :** unifier la pagination Property/Accommodation; paginer le sitemap; retirer les surfaces legacy après inventaire des liens externes; réduire les warnings de hooks.
- **Futur :** consolider les vocabulaires historiques par migrations versionnées, sans fusionner les noyaux financiers distincts.

## 17. Git

HEAD final identique à l'initial : `5a87cb4307d09ed7d10681dcdeaa7bd7f14c6ebc`.  
**AUCUN COMMIT. AUCUN PUSH.**  
Le worktree contient uniquement les cinq fichiers listés en section 13; aucun `node_modules`, build, log temporaire, secret ou migration accidentelle n'est suivi par ce diff.
