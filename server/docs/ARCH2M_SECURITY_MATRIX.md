# ARCH-2M — Matrice sécurité

| Edge | Auth | Tenant | Ownership | PlatformOperator | Finance | Sensitivity |
|---|---|---|---|---|---|---|
| Accommodation → `accommodations` | Extérieure : `protect`, rôles Altimmo + Propriétaire | YES : filtre `Accommodation.tenant` si fourni ; null = global | YES : Property.owner/createdBy vérifiés avant sélection Dashboard | YES : Reporting non scopé = global | Documents, allocations, refunds, balances read-only | HIGH |
| Hotel → `hotels` | Extérieure : `protect`, rôles Altimmo + Propriétaire ; scopes hôtel transitifs | YES : `actor.platformTenant`, tenant attribution et hôtels accessibles | YES : manager, createdBy, Property et assignments | YES : Admin Reporting non scopé = global | Allocations, refunds, balances + dashboard financier voisin | CRITICAL |

## IAM/RBAC

- Dashboard : `getModuleAnalytics` applique `ROLES_ALTIMMO` + `Proprietaire` pour Hotel/Accommodation ; aucun `requireCapability` sur cette route.
- Reporting : `protect`, `restrictTo(Admin, GestionnaireImmobilier)` et `requireTenantScopeAllowPlatformWide` ; le mode global est réservé au PlatformOperator reconnu.
- Hotel : `listAccessibleHotels` utilise HotelStaffAssignment et manager legacy, sans capability précise pour ce listing ; le dashboard financier voisin utilise son authorization service.
- Accommodation : ownership et same-tenant sont contrôlés dans le handler pour une sélection précise.

## NEW BUSINESS/SECURITY FINDING

La route Dashboard Analytics ne monte aucun middleware de tenant. En conséquence statiquement démontrée, un Admin reçu par `protect` n'a pas de `platformTenant` injecté et tombe sur les fallbacks globaux des deux helpers. La confidentialité cross-tenant et financière est donc **CRITICAL**. Le résultat adversarial runtime exact demeure **NON CONFIRMÉ**, mais le chemin de code est complet et vivant. Un hotfix séparé doit caractériser puis fermer ce scope ; ARCH-2M ne le modifie pas.
