# RBAC-5 — ÉTAT INITIAL

Branche : `main`. HEAD au démarrage : `63880f58ff41bd805b828d07603d878d55122d45` (inchangé depuis RBAC-1 — aucun commit créé par la séquence RBAC, tout le travail reste en working tree).

```
git log -5 --oneline
63880f5 Update Altimmo 38
51f581e Update Altimmo 37
88c99d7 Update Altimmo 36
3cd0f1c Update Altimmo 35
f4f6b40 Update Img
```

`git diff --stat` : 18 fichiers modifiés (+564/-43) — cumul RBAC-2/RBAC-3/RBAC-4, aucun commit intermédiaire.

`git diff --check` : exit 0.

`git status --short` : 63 lignes (18 modifiés + fichiers non suivis : nouveaux tests RBAC-2/3/4 et tous les documents `server/docs/HOTFIX_*`/`RBAC1_*`/`RBAC2_*`/`RBAC3_*`/`RBAC4_*`). Tout préservé, rien écrasé.

## Baseline héritée (ne pas refaire)

- **RBAC-1** : AUDIT CERTIFIÉ — cartographie initiale des rôles/groupes/capacités, duplications identifiées.
- **RBAC-2** : CERTIFIÉ VERT — `server/utils/iamArchitecture.js` canonique ; `STAFF_IMMO`/`ROLES_ALTIMMO`/`ROLES_GL`/`ROLES_LITIGES` dérivent de `CANONICAL_IMMO_STAFF_ROLES` ; `assertKnownCapability`/`getEffectiveCapabilities`/`ALL_CAPABILITIES`/`ADMIN_ONLY_CAPABILITIES` ajoutés ; `payments.reverse` corrigé (Admin/Collaborateur uniquement, test IAM-3 prouvant l'exclusion de GestionnaireImmobilier) ; route pilote `POST /property-asset/:id/transition` migrée vers `requireCapability('properties.update')` avec parité stricte (11 scénarios de rôle).
- **RBAC-3** : CERTIFIÉ VERT — payloads `createSendToken`/`sendGoogleAuthResponse`/`googleGetToken`/`/me` enrichis de `capabilities` ; helper canonique `can(capability)` dans `client/lib/context/AuthContext.jsx` ; pilote migré (`AdminDashboard.jsx`, `RoleDashboardOverview.jsx`) ; auto-guérison `/me` pour sessions anciennes ; 3 tests adversariaux prouvant que le backend ignore un rôle/des capacités forgées ; divergences `GestionLocativePage.jsx`/`TransactionsPage.jsx` caractérisées sans correction ; drift de redirection post-login Proprietaire identifié comme hors-RBAC.
- **RBAC-4** : CERTIFIÉ VERT (réserve device physique) — helper canonique `can(capability)` dans `altimmo-app/src/context/AuthContext.jsx` ; aucune surface staff mobile de production trouvée à migrer ; `staffCapabilities.js` mobile caractérisé comme code mort (zéro consommateur de production) mais **non supprimé** ; `canAdd` mobile volontairement non migré (aurait étendu l'accès à GestionnaireImmobilier).

## Périmètre RBAC-5

Nettoyage final : supprimer uniquement ce qui est prouvé mort ou réellement redondant (mappings rôle→capacités devenus inutiles, helpers concurrents, tests tautologiques), sans changer une seule permission métier, sans toucher aux systèmes spécialisés (tenant, ownership, `UserBusinessProfile`, `HotelStaffAssignment`, `financialAuthorizationService`, `PlatformOperator`), et sans exécuter les corrections/hotfixes déjà identifiés comme hors périmètre (`GestionLocativePage`/`TransactionsPage`/redirection post-login).

Aucune modification effectuée avant ce document. Aucun commit/push/déploiement.
