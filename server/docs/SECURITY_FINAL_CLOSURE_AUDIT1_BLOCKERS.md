# SECURITY-FINAL-CLOSURE-AUDIT-1 — Blockers confirmés

**2 blockers P0/P1 confirmés par reproduction runtime. NON CORRIGÉS (mandat strictement read-only).**

---

## BLOCKER-1 — `POST /api/contrats` : création de bail cross-tenant sans frontière

- **ID** : FCA1-01
- **Severity** : P0 (financier — génère un échéancier de paiement réel et active la Gestion Locative sur un bien d'un autre tenant)
- **Domain** : Contrat / Gestion Locative
- **Route** : `POST /api/contrats` (`server/routes/contratRoutes.js:59`, `manageLeases = [auth.protect, requireCapability('leases.manage')]`)
- **Actor** : tout staff possédant la capability `leases.manage` (ex : `GestionnaireImmobilier`, `Admin`, `Collaborateur`), membre du Tenant A, sans aucune appartenance au Tenant B.
- **Root cause** : `contratController.create` (`server/controllers/contratController.js:60-140`) charge la `Property` cible via `Property.findById(req.body.bien)` et vérifie uniquement son `status`/`availability`/`reservationLock` — **aucun appel à `assertResourceTenantOrUnattributed` ni à toute autre vérification tenant**. Les routes `:id` du même fichier (`getOne`/`update`/`delete`/`getPaiements`/`createPaiement`) sont protégées par `router.param('id', …)` (TENANT-CERT-2), mais `POST /` ne passe jamais par ce `router.param` puisqu'elle ne porte pas de `:id` — elle a été oubliée par le correctif RA-04 (qui n'a couvert que `GET /`, la liste).
- **Reproduction runtime** : test temporaire exécuté (Mongo réel), supprimé après capture. Admin du Tenant A envoie `POST /api/contrats` avec `bien` = ObjectId d'une Property appartenant au Tenant B → **201 Created**, `Contrat` bien persisté en base (`Contrat.findOne({bien: propertyB._id})` retourne un document), échéancier de paiement généré (`generatePaiements`), Gestion Locative activée sur le bien du Tenant B (`ensureRentalManagementActive`).
- **Blast radius** : uniquement `POST /` dans ce fichier — tous les autres endpoints (`:id`) sont couverts par `router.param`. Vérifié explicitement (`grep router.param` + lecture de `contratRoutes.js` ligne par ligne).
- **Canonical authority manquante** : le même helper déjà utilisé par `router.param('id', …)` de ce fichier — `assertResourceTenantOrUnattributed({resourceType: 'Property', resource: property, tenantId})` — appliqué sur la `Property` chargée AVANT la création du `Contrat`.
- **Hotfix recommandé** : `HOTFIX-CONTRAT-CREATE-TENANT-AUTHORITY-1` — ajouter la vérification tenant sur `property` dans `contratController.create`, juste après le chargement de la `Property` et avant toute écriture (respecte le pattern §22 du mandat : authority avant side effect).

---

## BLOCKER-2 — `GET/POST /api/real-estate-applications/reservations/:id[/cancel]` : aucune frontière tenant, contrairement aux siblings `Application`

- **ID** : FCA1-02
- **Severity** : P0 (staff d'un tenant quelconque peut lire ET annuler — libérant le bien réservé — une réservation immobilière d'un autre tenant)
- **Domain** : RealEstateApplication / RealEstateReservation
- **Routes** : `GET /api/real-estate-applications/reservations/:id`, `POST /api/real-estate-applications/reservations/:id/cancel` (`server/routes/realEstateApplicationRoutes.js:14-15`) — montées **sans** `requireTenantScopeForStaffOrPlatformOperator`, contrairement aux routes sœurs `GET /:id`, `POST /:id/review|accept|reject` (lignes 19-22) qui l'ont toutes.
- **Actor** : tout utilisateur dont le rôle est dans `STAFF_IMMO`, de n'importe quel tenant.
- **Root cause** : `realEstateApplicationController.getReservation`/`cancelReservation` (lignes 154-166) accordent l'accès via `isStaff(req.user)` sans jamais appeler `assertApplicationTenantAccessIfStaff` (le helper introduit précisément pour RA-08 et déjà utilisé par tous les handlers `Application` sœurs de ce même fichier : `getOne`, `review`, `accept`, `reject`, `downloadAttachment`) ni aucune autre vérification tenant, alors même que `Reservation.application` est disponible et peuplé.
- **Reproduction runtime** : test temporaire exécuté (Mongo réel), supprimé après capture. Admin du Tenant A (sans appartenance au Tenant B) : `GET .../reservations/:id` sur une réservation du Tenant B → **200** (lecture complète, y compris `property.owner`) ; `POST .../reservations/:id/cancel` → **200**, `workflow.releaseReservation` exécuté, `Reservation.status` passe réellement de `active` à `cancelled` en base (vérifié par relecture post-requête), notifications envoyées au client et au propriétaire du Tenant B.
- **Blast radius** : limité aux 2 routes `reservations/:id[/cancel]` de ce fichier. Les autres endpoints `Application` du même fichier sont couverts (`assertApplicationTenantAccessIfStaff` appelé systématiquement). `uploadAttachments`/`deleteAttachment`/`withdraw` sont correctement restreints à l'identité du candidat (pas de dimension tenant applicable).
- **Canonical authority manquante** : `assertApplicationTenantAccessIfStaff(req, res, reservation.application, isStaff(req.user))` — même helper déjà existant dans ce fichier, appliqué sur `reservation.application` (peuplé) avant d'autoriser lecture/annulation.
- **Hotfix recommandé** : `HOTFIX-REALESTATE-RESERVATION-TENANT-AUTHORITY-1` — appliquer le helper existant `assertApplicationTenantAccessIfStaff` à `getReservation` et `cancelReservation`, avant toute lecture/action (§22 : authority avant side effect — `cancelReservation` doit être bloqué AVANT `workflow.releaseReservation`).

---

## Aucun autre blocker confirmé

La recherche adversariale (Partie B) a couvert : siblings list/detail/create/update/delete/bulk/stats/export/download/approve-reject/assignment sur Contrat, Locataire/Proprietaire, Visite, Litige/Signalement, RealEstateApplication, Accommodation, Hotel/HotelReservation/HotelStaffAssignment, SaleProperty/RentalProperty, PropertyAsset, Transaction/PaiementTransaction, Paiement/RentalLeaseLifecycle/AdminController legacy, Messaging/Conversation, ainsi que les patterns ObjectId direct, body-IDs bulk, global-fallback, list-vs-detail, legacy duplicates, stats/reporting globales. Aucun troisième candidat crédible n'a été détecté avec un niveau de preuve suffisant (§50) au-delà des deux ci-dessus. Conformément au §55, la recherche horizontale s'arrête ici — pas de chasse supplémentaire une fois deux blockers confirmés.

Domaine Estimation (`estimationController.js`) inspecté (pattern body-IDs bulk `compareEstimations`) : confirmé **hors périmètre tenant** — c'est un outil de laboratoire d'évaluation interne à l'agence, sans dimension multi-tenant dans son modèle de données (`Estimation` n'a pas de champ tenant, accès restreint par rôle `ROLES_ESTIMATION` uniquement) ; non traité comme une vulnérabilité.
