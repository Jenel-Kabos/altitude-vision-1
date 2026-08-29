# AUDIT-HOTEL-ESTABLISHMENT-CREATION-VISIBILITY-1 — Rapport final

## Verdict

**C. ROOT CAUSE CONFIRMED — MODERATION/STATUS WORKFLOW.**

L’établissement réel **MILA HOTEL** a bien été persisté, dans le bon tenant, avec son `Property`, son `Accommodation`, deux catégories et deux tarifs actifs. Il est complet et soumis à modération, mais pas encore publié : `Hotel.publicationStatus=soumis`, `Property.statusAdmin=En attente`, `Hotel.publishedAt=null`. Il appartient donc à la file **Modération Hôtellerie** et est volontairement exclu de `/dashboard/etablissements`, qui est un portefeuille réservé aux hôtels publiés, actifs et portés par une Property validée/disponible.

Il ne s’agit ni d’un échec de création, ni d’un défaut tenant, ni d’un filtre frontend, ni d’un cache. Le bouton final valide le formulaire et **soumet** l’établissement ; il ne réalise pas la validation administrative.

## Baseline

- Branche : `main`.
- HEAD : `a5cca0bf0a5d6dedbdb74f5c6c64e2d6a413dcbd`.
- Worktree initial : propre (`git status --short` vide).
- `git diff --check` initial : PASS.
- Les hotfixes Dashboard Dark Form Contrast, Favorites/Property Share, Ads/Recommended/AdCarousel et Dual-role Visits présents dans HEAD ont été préservés.
- Audit read-only : aucun code fonctionnel modifié, aucune mutation Mongo, aucune création de donnée, aucune migration, aucun commit/push/deploy.

## Matrice de preuve

| Étape | Résultat |
|---|---|
| Wizard final submit | `HotelCreationWizard.submit`, bouton « Créer et soumettre l'hôtel » |
| HTTP response | Requête historique non capturée : **NON CONFIRMÉ**. Contrat serveur : `201` pour une création, `200` seulement pour un retry idempotent |
| Created resource ID | Hotel `6a92b8a300a8fa25e13e7cc5` |
| Mongo document exists | **OUI**, ainsi que Property, Accommodation, 2 RoomCategory et 2 RatePlan |
| Tenant | `6a7de24e48d42c4c87f893dc`, **Altitude Vision** (`altitude-vision`) |
| Initial status | Hotel `status=actif`, `active=true`, `publicationStatus=soumis` |
| Moderation status | Pas de champ `moderationStatus`; source réelle : `publicationStatus=soumis` et Property `statusAdmin=En attente` |
| Active/approved state | Actif opérationnel oui ; approuvé/publié non. Aucun champ `isApproved` dans Hotel |
| Visible in moderation | **OUI**, la query exacte pending retourne l’ID cible |
| Validation transition | `soumis → publie`, Property `En attente → Validée`, `publishedAt` renseigné, Accommodation synchronisé vers `publie` |
| Listing endpoint | `GET /api/hotels/portfolio` |
| Returned by listing API | Query exacte : **NON**, zéro candidat dans le tenant |
| Frontend receives it | **NON**, puisque le portefeuille backend l’exclut avant sérialisation |
| Frontend renders it | **NON**, conséquence attendue de la réponse vide |
| Active KPI includes it | **NON**, `activeHotels=0` selon la même sémantique publié + Property validée |

## 1. Wizard réel et « Capacité générale »

La page `/dashboard/etablissements` rend `ManageHotelsPage.jsx`. « Ajouter un établissement » ouvre une modale contenant `HotelPropertyForm`; sans `hotelId`, celui-ci délègue à `HotelCreationWizard`.

Le wizard possède **9 étapes** réelles :

1. Informations générales ;
2. Localisation ;
3. Capacité générale ;
4. Catégories de chambres ;
5. Tarifs ;
6. Services ;
7. Politiques ;
8. Photos ;
9. Vérification.

`Capacité générale` ne contient aucun champ et ne modifie aucun state. Elle affiche seulement `getHotelCategoryTotals(form.roomCategories)`. Comme les catégories sont saisies à l’étape suivante, elle peut même afficher 0 chambre / 0 personne / 0 lit avant leur saisie. Elle ne déclenche ni calcul distinct, ni validation, ni transformation, ni persistance : le même `useMemo` calcule les totaux en permanence et `buildHotelPublicationPayload` les recalcule au submit.

**Verdict secondaire : C. MERGE — information utile, mais ne justifie pas une étape complète.** Elle est purement informative techniquement ; sa synthèse serait plus cohérente après les catégories ou dans Vérification. Aucun changement n’a été effectué.

## 2. Submit, payload et succès UI

Handler final : `HotelCreationWizard.submit`.

1. `validateHotelWizard(form)` contrôle tous les champs.
2. `buildHotelPublicationPayload(form)` produit le contrat métier.
3. Le navigateur construit un `FormData` avec `publicationRequestId`, `publicationPayload` JSON et les fichiers `images`.
4. Scope Admin réel de cette page : `createFullHotel(data)` → `POST /api/hotels/admin`.
5. Le contrôleur adapte ce multipart vers `createFullMobileAccommodation`, service transactionnel partagé.

Structure utile du payload réel :

- `publicationKind=hotel_establishment` et clé d’idempotence UUID ;
- `property` : titre, description, type `Commerce`, catégorie `hebergement`, prix minimum calculé, ville, arrondissement, rue, surface, coordonnées et photos ;
- `accommodation` : type, capacité calculée, check-in/out, règles et bloc `hotel` (nom, description, classement éventuel, téléphone, email/site éventuels, services, galerie) ;
- `roomCategories` : nom, code, type, quantité, capacités, lits, surface, équipements, ordre et tarifs par catégorie ;
- aucun tenant, owner, statut, `isActive` ou `isApproved` accepté depuis le formulaire.

Le tenant et les acteurs sont imposés côté serveur depuis `req.user`, jamais depuis le body. Le frontend considère le submit réussi lorsque la Promise HTTP résout ; il ne vérifie pas un statut publié ni la présence future dans le portefeuille. Le service Axios retourne `res.data.data`. Le toast interne annonce « créé et soumis », puis `ManageHotelsPage` annonce explicitement : « soumis à la Modération Hôtellerie. Il apparaîtra ici après validation. » Il peut donc afficher un succès légitime alors que l’hôtel n’est volontairement pas encore dans la liste.

Réponse serveur contractuelle : `status=success`, avec `property`, `accommodation`, `rate`, `hotel`, `roomCategories`, `categoryRates`, `idempotent`; HTTP `201` à la première création et `200` sur retry idempotent. Le statut HTTP exact de la requête utilisateur historique n’a pas été journalisé : **NON CONFIRMÉ**.

## 3. Persistance réelle, tenant et atomicité

Dernier document correspondant au test :

- Hotel `6a92b8a300a8fa25e13e7cc5`, `MILA HOTEL` ;
- Property `6a92b8a200a8fa25e13e7cc3` ;
- Accommodation `6a92b8a300a8fa25e13e7ccb` ;
- tenant commun Hotel/Accommodation : `6a7de24e48d42c4c87f893dc`, Altitude Vision ;
- manager, owner et createdBy : `6a7de24d48d42c4c87f893d5` ;
- création le 29 août 2026 vers 10:47 UTC ;
- Hotel : `soumis`, `actif`, `active=true`, `publishedAt=null`, `reviewedBy=null` ;
- Property : `status=hebergement`, `statusAdmin=En attente`, `availability=Disponible` ;
- Accommodation : `publicationStatus=soumis`, `active=true`, clé d’idempotence présente (longueur 36) ;
- 2 catégories actives : 10 + 3 unités ; total Hotel 13 chambres commerciales, capacité 26, 13 lits ;
- 2 tarifs publics actifs ;
- 0 document `Room` physique.

Le tenant est résolu par `attachTenantScopeIfResolvable`, qui enrichit `req.user.platformTenant`; le service écrit ce tenant sur Hotel et Accommodation. La valeur réelle correspond au tenant sélectionné Altitude Vision : **aucun tenant mismatch**.

La création Property + Hotel + Accommodation + RoomCategory + RatePlan + ActionLog et la soumission Accommodation sont réalisées dans une transaction Mongo. Un échec provoque un rollback ; les images Cloudinary déjà uploadées font l’objet d’un nettoyage best-effort. Aucun état Mongo partiel n’est démontré ici.

## 4. Workflow métier réellement implémenté

Le nouveau wizard ne crée pas un brouillon à compléter ultérieurement. Son service partagé écrit atomiquement :

`formulaire complet → Property En attente + Hotel soumis + Accommodation soumis + catégories + tarifs → Modération Hôtellerie → validation admin → Hotel publie + Property Validée + Accommodation publie → portefeuille`

La route historique `POST /api/hotels/:id/submit` existe pour les brouillons/rejets édités, mais n’est pas appelée par ce nouveau wizard complet : l’état `soumis` est posé pendant la création transactionnelle.

Modération obligatoire : **OUI**. `GET /api/hotels/status/pending` cherche :

```js
{ $or: [{ publicationStatus: 'soumis' }, { 'proposedVersion.status': 'pending' }], tenant }
```

La reproduction read-only retourne les deux créations récentes, dont la cible. Le frontend `HotelModerationPage` charge ce endpoint avec `getPendingHotels()` et n’applique par défaut aucun filtre d’exclusion (`Tous`). La présence visuelle dans une session navigateur de Modération n’a pas été capturée : la présence dans sa query exacte est confirmée.

Validation : `PATCH /api/hotels/:id/validate`, staff de modération, scope hôtel/tenant vérifié. Elle exige `publicationStatus=soumis` et une complétude 100 %. Pour la cible, informations, galerie, services, catégories et tarifs sont tous vrais. La transition atomique protégée écrit :

- Hotel `publicationStatus=publie`, `publishedAt=now`, `reviewedBy` et historique ;
- Property `statusAdmin=Validée`, `reviewedAt` ;
- Accommodation liée `publicationStatus=publie` via synchronisation.

Validation et activation sont des concepts distincts : `publicationStatus/publishedAt` portent l’approbation, tandis que `status=actif` et `active=true` portent l’exploitation. Dans ce cas l’hôtel est déjà actif mais non publié ; aucune seconde action d’activation n’est requise après validation. Le portefeuille exige simultanément les deux dimensions.

## 5. Portefeuille, filtres frontend et KPI

`ManageHotelsPage.load()` envoie à `getHotelPortfolio` :

- `search` seulement s’il n’est pas vide ;
- `city` seulement s’il n’est pas vide ;
- `starRating` seulement s’il n’est pas vide ;
- `sort=recent` ;
- `page=1`, `limit=12`.

Les champs vides sont retirés par `Object.fromEntries`; aucun filtre vide invalide n’est envoyé. Aucun filtre frontend post-réponse ne masque une carte : `data.hotels.map(...)` rend directement chaque résultat.

Le serveur impose, sans possibilité d’élargissement par query client :

```js
Hotel: publicationStatus='publie', status='actif', active != false, tenant courant
Property peuplée: statusAdmin='Validée', availability='Disponible'
```

La cible échoue exactement deux critères : Hotel `soumis` au lieu de `publie`, Property `En attente` au lieu de `Validée`. La query read-only du portefeuille retourne zéro ID. Elle n’atteint donc ni mapper ni state frontend. Search, ville, catégorie et tri ne causent pas la disparition.

Après création, `onSuccess` ferme la modale et appelle `load()`. Il n’y a pas de cache de données dans ce flux ; la requête est effectivement refaite mais retourne encore zéro tant que la modération n’a pas eu lieu. Un reload ne peut pas changer ce résultat. **Cache/state : exclus comme cause.**

Le KPI vient séparément de `GET /api/dashboard-analytics/hotels`, mais sa sémantique est compatible : il compte d’abord les hôtels `publie` dont la Property est `Validée` et `Disponible`, puis `activeHotels` retient `status=actif && active!==false`. La cible est absente et le résultat réel est 0, comme le portefeuille. Les catégories représentent 13 unités commerciales, mais les cartes « chambres disponibles/occupées » comptent uniquement les documents `Room` physiques actifs ; aucun n’existe encore, donc 0/0 est cohérent.

## 6. Catégories, chambres et validation minimale

Le wizard ne peut pas soumettre zéro catégorie : au moins une `RoomCategory`, quantité entière ≥ 1, capacité adulte ≥ 1, lits ≥ 1 et un tarif public positif par catégorie sont imposés côté frontend puis revalidés côté backend. Au moins un service et une photo sont également requis.

La cible possède bien deux catégories et deux tarifs. Les 13 « chambres » du wizard sont des `RoomCategory.unitsAvailable`, pas 13 documents `Room`. L’absence de chambres physiques n’empêche ni la soumission ni la validation administrative ; elle explique uniquement les KPI opérationnels de chambres à 0.

## 7. Tests existants et exécution

Couverture identifiée :

- wizard et validation : `hotelWizardValidation.test.js`, `hotelPublication.test.js` ;
- page portefeuille et message de modération : `ManageHotelsPage.test.jsx` ;
- modération UI : `HotelModerationPage.test.jsx` ;
- adaptateur Web et payload : `hotelWebPublicationController.unit.test.js`, `hotelPublicationPayloadValidation.test.js` ;
- création transactionnelle, idempotence, rollback, hôtel/catégories/tarifs : `mobileAccommodationPublicationService.mongo.integration.test.js` et route associée ;
- cycle submit/validate/reject/suspend et portefeuille non contournable : `hotelRoutes.test.js` ;
- tenant admin/pending/portfolio : `hotelAdminListsTenantScope.mongo.integration.test.js` ;
- KPI hôtels tenanté : `dashboardAnalyticsTenantScope.mongo.integration.test.js`.

Exécution ciblée backend : **3 suites, 42/42 tests verts**. Le premier lancement sandboxé a échoué sur `listen EPERM`; la relance autorisée hors sandbox est verte.

Exécution ciblée frontend : **3 fichiers verts et 1 fichier partiellement rouge, 13/14 tests verts**. Le seul échec est le test préexistant d’archivage de `ManageHotelsPage`, qui clique « Archiver » mais ne confirme pas le nouveau dialog ; `deactivateHotel` n’est donc jamais appelé. Les tests création/modération/wizard/payload utiles à cet audit sont verts. Aucun correctif n’a été tenté, conformément au mode read-only.

## Réponses obligatoires synthétiques

1. HEAD : `a5cca0bf0a5d6dedbdb74f5c6c64e2d6a413dcbd`.
2. Worktree initial : propre.
3. Préexistant préservé : oui.
4. Wizard : `HotelCreationWizard` dans `HotelPropertyForm.jsx`.
5. Étapes : 9.
6. Handler : `submit`.
7. POST : `/api/hotels/admin` pour cette page Admin (`/mine` en scope owner).
8. Payload : contrat `hotel_establishment` décrit ci-dessus.
9. HTTP historique : **NON CONFIRMÉ** ; contrat 201/200 idempotent.
10. Réponse : agrégat Property/Accommodation/Hotel/catégories/tarifs.
11. Hotel créé : `6a92b8a300a8fa25e13e7cc5`.
12. Document existe : oui.
13. Modèles : Property, Hotel, Accommodation, RoomCategory, RatePlan, ActionLog ; pas de Room physique créée.
14. Tenant : Altitude Vision, correct.
15. Owner/manager/createdBy : même compte Admin cible, ID indiqué plus haut.
16. Statut initial : Hotel `soumis`, `actif`, `active=true`.
17. Approved : non ; champ `isApproved` inexistant.
18. Active : oui, mais insuffisant sans publication.
19. Modération : `publicationStatus=soumis`, Property `En attente`.
20. Validation wizard : validation du formulaire + soumission, pas validation administrative.
21. Workflow : complet → soumis → modération → publié/validé → portefeuille.
22. Modération obligatoire : oui.
23. Présent en modération : oui dans la query exacte.
24. Validation : `PATCH /api/hotels/:id/validate`.
25. Transition : Hotel `soumis→publie`, Property `En attente→Validée`, Accommodation `→publie`.
26. Validation/activation : champs distincts ; validation suffit ici car actif est déjà vrai.
27. Listing : `GET /api/hotels/portfolio`.
28. Query : publié + actif + non désactivé + tenant, Property validée/disponible.
29. Inclusion : tous ces critères simultanément.
30. Cible dans réponse : non selon la query exacte ; réponse HTTP de la session historique **NON CONFIRMÉE**.
31. Exclusion : `soumis` et Property `En attente`.
32. Frontend : sans objet, il ne la reçoit pas.
33. Tenant mismatch : non.
34. Status mismatch : oui, attendu avant modération.
35. Approval mismatch : oui, attendu avant modération.
36. Activation mismatch : non.
37. Cache/state : non.
38. Filtre frontend : non.
39. Query backend : correcte selon le contrat portefeuille.
40. Product workflow : cause démontrée.
41. KPI : analytics hôtels, publié + Property validée/disponible puis actif.
42. KPI/liste : cohérents.
43. Catégories requises : oui ; Room physique non requise pour valider.
44. Soumission avec 0 chambre commerciale : non ; avec 0 document Room physique : oui.
45. Capacité générale modifie des données : non.
46. Calcul propre à l’étape : non ; elle affiche un total partagé.
47. Validation propre à l’étape : non.
48. Nécessité technique : non.
49. Capacité : **MERGE**.
50. Root cause : établissement correctement soumis, encore non modéré.
51. Catégorie : **STATUS + MODERATION + PRODUCT WORKFLOW** ; verdict principal C.
52. Fix minimal recommandé : aucun fix de données/listing. Si amélioration UX souhaitée, rediriger après succès vers Modération Hôtellerie ou afficher un lien/état « En attente de validation » ; fusionner la synthèse capacité avec Catégories/Vérification.
53. Frontend à modifier : seulement pour cette amélioration UX optionnelle.
54. Backend à modifier : non.
55. Migration Mongo : non.
56. Futurs RED : navigation/CTA post-submit vers pending, distinction unités commerciales/Room physiques, test de confirmation du dialog archive ; aucun RED de scope/listing à élargir.
57. Code fonctionnel modifié : non.
58. Mongo muté : non.
59. Commit : non.
60. Push : non.
61. Deploy : non.
62. `git diff --check` : PASS.
63. Verdict final : **C. ROOT CAUSE CONFIRMED — MODERATION/STATUS WORKFLOW**.

