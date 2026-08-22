# RBAC-2 — Matrice de migration

| Route | Avant | Après | Capability | Parité rôles | Tenant intact | Verdict |
|---|---|---|---|---|---|---|
| `POST /api/property-asset/:id/transition` | `auth.restrictTo(...STAFF_IMMO)` = `restrictTo('Admin','GestionnaireImmobilier','Collaborateur')` | `requireCapability('properties.update')` | `properties.update` (préexistante, `GestionnaireImmobilier`) | **Stricte, prouvée par test** — 10 rôles testés individuellement (`Admin`, `GestionnaireImmobilier`, `Collaborateur` → 200 ; `Secretaire`, `CommunityManager`, `Communicant`, `Client`, `Proprietaire`, `User`, `Prestataire` → 403) + un rôle hors-enum → 403. Même matrice rejouée avant ET après migration, résultats identiques (37/37 les deux fois). | Oui — aucun middleware tenant sur cette route, ni avant ni après (le contrôleur `propertyAssetController.transition` gère lifecycle/ownership séparément, non touché) | ✅ Parité exacte |

## Pourquoi cette route et pas une autre (mandat §26/§27)

- **Déjà partiellement dans l'esprit `iamArchitecture`** : `STAFF_IMMO` est exactement le groupe que RBAC-1 a identifié comme dupliqué 4 fois (`STAFF_IMMO`/`ROLES_ALTIMMO`/`ROLES_GL`/`ROLES_LITIGES`) — migrer une route de ce groupe vers une capacité démontre concrètement la valeur de la consolidation, sans toucher au reste du groupe (les 3 autres alias restent utilisés tels quels ailleurs, inchangés).
- **Tests solides déjà existants** : `propertyAssetRoutes.mongo.integration.test.js` couvrait déjà le cas positif (Admin) et un cas négatif (Secretaire) — étendu à la matrice complète avant toute migration (caractérisation, mandat §28).
- **Sans risque financier élevé** : la transition de cycle de vie (`disponible`→`réservé`→`vendu` etc.) ne manipule aucun montant, aucun paiement, aucune allocation — `financialAuthorizationService` non concerné.
- **Sans complexité PlatformOperator** : route non tenant-scopée, pas de sélection multi-tenant impliquée.
- **Sans resource-scoping HotelStaffAssignment critique** : concerne `Property` (vente/location), jamais un `Hotel`.

## Ce qui N'A PAS été migré dans ce sprint (mandat §26 — limiter le périmètre)

Les ~79 autres checks de rôle backend directs identifiés par RBAC-1 (routes Modération, CRM, Litiges, Estimations, Administration, Financial, Hotels, Accommodation, Conversations...) **restent inchangés** — `restrictTo(...)` continue de fonctionner exactement comme avant sur toutes ces routes. Aucune régression n'est possible sur ces domaines puisqu'aucun fichier les concernant n'a été touché (vérifié par `git diff --stat`, voir `RBAC2_REPORT.md`).

## Découverte et correction en cours de route — `payments.reverse`

| Route | Avant RBAC-2 | Constat | Après correction | Preuve |
|---|---|---|---|---|
| `POST /api/paiements/:id/receipts/:receiptId/cancel` | `requireCapability('payments.reverse')` — capacité **jamais déclarée** dans `DEFAULT_CAPABILITIES` (bug de configuration silencieux datant d'un sprint antérieur, jamais documenté) | Effectivement accessible uniquement à `Admin`/`Collaborateur` (jokers), 403 pour tout autre rôle — **comportement correct par accident**, pas par conception explicite | `payments.reverse` enregistrée dans `ADMIN_ONLY_CAPABILITIES` (registre), toujours résolue uniquement pour `Admin`/`Collaborateur` — **comportement identique, désormais explicite et validé** | `__tests__/rentalPaymentReceiptsAndCancellation.mongo.integration.test.js` (10/10, y compris le test préexistant "IAM-3 : GestionnaireImmobilier ne peut pas annuler un encaissement", rejoué sans modification) + `__tests__/iamArchitecture.test.js` (nouveau test dédié) |

**Aucune permission n'a été élargie ni réduite sur cette route** — la correction rend explicite et protège contre la régression (via `assertKnownCapability`) un comportement qui n'existait auparavant que par l'absence accidentelle de déclaration. Voir `RBAC2_SECURITY_MATRIX.md` pour l'analyse complète de cet épisode, y compris la première tentative erronée et sa correction.
