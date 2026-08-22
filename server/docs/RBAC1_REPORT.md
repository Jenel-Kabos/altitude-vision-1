# RBAC-1 — AUDIT CANONIQUE DES RÔLES, GROUPES ET CAPACITÉS

**Verdict : RBAC-1 : AUDIT CERTIFIÉ.**

Backend, Web et Mobile audités exhaustivement (grep + lecture directe, aucune modification). Rôles inventoriés, duplications identifiées avec preuves file:ligne, 5 systèmes de capacités distincts découverts et cartographiés, tenant/ownership/business profile documentés, drifts classés par sévérité avec preuve, roadmap proposée sans exécution.

## Découverte architecturale principale

Le codebase ne possède pas un mais **5 systèmes d'autorisation/capacités parallèles et non unifiés** : `User.role` + `server/utils/roles.js` (RBAC global historique, dominant), `UserBusinessProfile` (profils métier cumulables, dérivés), `HotelStaffAssignment` (capacités scopées à un hôtel), `financialAuthorizationService` (capacités financières dérivées du rôle), `PlatformOperator` (capacités transversales plateforme), plus **`server/utils/iamArchitecture.js`** — une 6e couche de capacités génériques (`properties.read`, `rental.manage`, `documents.manage`...), déjà **réellement câblée** via `requireCapability(...)` sur 10 fichiers de routes, et **manuellement dupliquée 2 fois** (web `staffCapabilities.js`, mobile `staffCapabilities.js` — cette dernière copie n'étant jamais consommée). C'est la fondation la plus mature vers laquelle centraliser en RBAC-2, plutôt que d'inventer un système supplémentaire.

## Réponses aux 32 questions du mandat

1. **Combien de rôles globaux existent réellement ?** 10 (`User.js` enum).
2. **Combien sont actifs ?** 8 — Admin, Collaborateur, Secretaire, GestionnaireImmobilier, CommunityManager, Communicant, Proprietaire, Client.
3. **Combien sont legacy (dormants) ?** 2 — User, Prestataire (assignables, aucun gate fonctionnel dédié trouvé au-delà d'étiquettes CRM/export).
4. **Quelles listes sont dupliquées backend/web/mobile ?** Voir `RBAC1_DUPLICATION_MATRIX.md` — la plus critique : `DEFAULT_CAPABILITIES`/`CAPABILITIES_BY_ROLE` (3 copies manuelles identiques en valeur, backend/web/mobile) ; `STAFF_ALL` (8 redéfinitions web indépendantes) ; `STAFF_IMMO`/`ROLES_ALTIMMO`/`ROLES_GL`/`ROLES_LITIGES` (4 alias de même valeur, **au sein même du backend**).
5. **Combien de checks role directs backend ?** De l'ordre de **80+ occurrences** distinctes (restrictTo + inline), réparties sur ~60 fichiers (routes/controllers/services/middleware) — voir inventaire complet livré par l'agent backend, non reproduit intégralement ici par souci de longueur.
6. **Combien web ?** De l'ordre de **60+ occurrences** (hooks AuthContext, gardes de page, filtres de menu, redirecteurs) sur ~25 fichiers.
7. **Combien mobile ?** Beaucoup moins dense — de l'ordre de **25 occurrences** sur ~10 fichiers (mobile a nettement moins d'écrans staff que web).
8. **Quels groupes sont canoniques ?** `server/utils/roles.js` (`STAFF_ALL`, `STAFF_IMMO`, `STAFF_DOC`, `STAFF_CM`, `STAFF_COMM`, `ROLES_*`) côté backend ; `client/lib/utils/staffRoles.js` (`isStaffImmo`, `isStaffDocs`) côté web, mais partiellement adopté seulement (6 consommateurs corrects contre 6+ redéfinitions inline parallèles).
9. **Quels groupes sont dupliqués ?** Voir Q4 — quasiment tous les groupes backend ont au moins une redéfinition web indépendante ; le backend lui-même duplique 4 constantes de valeur identique sous des noms différents.
10. **Quels drifts réels existent ?** Classés en détail dans `RBAC1_DUPLICATION_MATRIX.md` — les plus significatifs : (a) `MessagesPage.jsx` STAFF_ROLES tronqué (P2) ; (b) `GestionLocativePage.jsx`/`TransactionsPage.jsx` divergent chacun de `isStaffImmo` dans une direction différente (P1) ; (c) 3 résolveurs de destination post-authentification donnant des URLs différentes pour `Proprietaire` selon le point d'entrée (P1) ; (d) `estimationRoutes.js:24` plus restrictif qu'`ROLES_ESTIMATION` importé dans le même fichier (P1) ; (e) menu "Emails" web plus restrictif que ce que le backend autoriserait (P2, pas une fuite).
11. **Quels domaines utilisent capabilities ?** Gestion Locative, Visites, Documents, Événements, Altcom, Maintenance, Contrats, Paiements (via `iamArchitecture.js`) ; Hôtellerie opérationnelle (via `hotelAccessConstants.js`) ; Financier (via `financialAuthorizationService.js`) ; Administration plateforme (via `platformOperatorConstants.js`).
12. **Quels domaines utilisent uniquement roles ?** Property/Sales/Rentals (CRUD de base), Modération, CRM, Litiges, Estimations/Devis, Conversations, Administration (org/users) — aucun `requireCapability` trouvé sur ces routes.
13. **Quels domaines utilisent tenant + role ?** La quasi-totalité des domaines staff (Property, Documents, Gestion Locative, Accommodation, Conversations, CRM, ERP, API publique) via `assertResourceTenantOrUnattributed`/`requireTenantScope`. Exception documentée explicitement dans le code : Organisation (org units/memberships) — rôle seul, aucune frontière tenant.
14. **Quels utilisent ownership ?** Property (`owner`), Hotel (`manager`), Accommodation (`owner`/guest), Locataire/Contrat (match tenant/owner dans les adaptateurs dossier), MtnMomo (`payer.userId`), InternalMail (plusieurs `isOwner`, non détaillés en profondeur dans ce sprint).
15. **Quels utilisent businessProfiles ?** Web : `Header.jsx` (nav owner), `OwnerDashboard.jsx` (contexte actif patrimoine/établissement), `ClientOverview.jsx`, `OwnerContextLanding.jsx`. Mobile : `ProfilScreen.jsx` uniquement. Backend : dérivation en lecture seule (`deriveProfilesFromExistingData`), jamais lu directement comme gate dans un contrôleur métier (le gate réel reste `Property.owner`/`Hotel.manager`/`HotelStaffAssignment`, dont `businessProfiles` n'est qu'une projection).
16. **Client et Proprietaire sont-ils encore nécessaires comme rôles ?** **Oui, aujourd'hui.** Des dizaines de contrôleurs comparent directement `req.user.role === 'Proprietaire'` (SaleProperty, RentalProperty, AccommodationReservation, RentalManagement, Visite, dashboardAnalytics...) plutôt que de dériver depuis `UserBusinessProfile.proprietaire_immobilier` — supprimer ce rôle casserait ces gates sans un chantier de migration dédié (RBAC-3+).
17. **Où sont-ils réellement nécessaires ?** Partout où l'identité "je suis un particulier propriétaire/client, pas un membre du staff" doit être distinguée avant même de savoir s'il possède un bien (le rôle précède la relation de possession — un `Proprietaire` fraîchement inscrit sans bien encore publié doit déjà être traité différemment d'un `Client`, cas déjà rencontré dans le sprint `HOTFIX-MOB-PROFILE-MY-PROPERTIES-LINK-1` de cette session).
18. **Collaborateur est-il encore utilisé ?** Oui, activement — assignable via `UsersPanel.jsx`, présent dans 22 fichiers backend, avec un périmètre effectif **plus large** que les rôles spécialisés (accès de facto à presque tous les groupes staff simultanément) — documenté comme "legacy" dans le code mais fonctionnellement le rôle staff le plus puissant après Admin.
19. **Prestataire ?** LEGACY DORMANT — assignable, mais aucun gate fonctionnel trouvé au-delà d'un tag CRM.
20. **User ?** LEGACY DORMANT — assignable, mais aucun gate fonctionnel trouvé au-delà d'un filtre d'export CSV groupé avec Client/Proprietaire.
21. **HotelStaffAssignment est-il correctement utilisé ?** Oui — confirmé par plusieurs commentaires explicites dans le code remplaçant d'anciens checks de rôle global par une vérification `HotelStaffAssignment` scopée (rooms, housekeeping, maintenance, room assignment). C'est le sous-système le plus mature et le mieux isolé du codebase.
22. **Quelle API fournit actuellement l'identité au frontend ?** `authController.createSendToken` → `{_id, name, email, role, phone, photo, isEmailVerified}`. Aucune capacité, aucun `businessProfiles`, aucun contexte tenant dans cette réponse — chacun est récupéré séparément par des appels ultérieurs.
23. **Peut-elle fournir des capabilities plus tard ?** Oui, conceptuellement — voir proposition de payload `/me` en fin de rapport, non implémentée.
24. **Quel serait le coût de migration Web ?** Modéré-à-élevé : ~25 fichiers à faire converger vers `isStaffImmo`/`isStaffDocs`/une future fonction `hasCapability` unifiée, plus la résolution des 2 drifts P1 identifiés (Gestion Locative, résolveurs post-auth) avant toute migration pour ne pas fossiliser un comportement déjà incohérent.
25. **Mobile ?** Plus faible en volume (peu d'écrans staff) mais nécessite de résoudre la double convention de casse (`role.toLowerCase()` vs comparaison capitalisée) avant toute consommation de capacités partagées avec le web.
26. **Backend ?** Le plus faible coût relatif — la fondation (`iamArchitecture.js`) existe déjà et est déjà branchée sur 10 domaines ; il s'agit surtout d'étendre sa couverture aux domaines encore role-only (Property, Modération, CRM, Litiges, Estimations) et de fusionner les 4 alias internes de `roles.js`.
27. **Quels tests manquent ?** Voir `RBAC1_TEST_COVERAGE_MATRIX.md` — aucun test anti-drift entre les 3 copies de capacités, aucun test anti-drift entre les alias internes de `roles.js`, aucun test de cohérence menu-web ↔ route-backend, couverture mobile quasi nulle.
28. **Y a-t-il un P0 ?** **Non.** Aucune fuite de sécurité ni escalade de privilège prouvée dans cet audit — tous les drifts identifiés sont soit des restrictions plus strictes côté frontend (jamais dangereuses), soit des incohérences UX/navigation, jamais un cas où le frontend autoriserait quelque chose que le backend refuserait dangereusement moins.
29. **Y a-t-il un P1 ?** **Oui, 4** : (a) `GestionLocativePage.jsx`/`TransactionsPage.jsx` divergent chacun de `isStaffImmo` dans une direction différente ; (b) 3 résolveurs de destination post-authentification donnant des URLs différentes pour `Proprietaire` ; (c) `estimationRoutes.js:24` plus restrictif que l'import `ROLES_ESTIMATION` du même fichier ; (d) le quartet `['Admin','Collaborateur','GestionnaireImmobilier','CommunityManager']` redéfini indépendamment dans 6 fichiers backend sans jamais avoir reçu de constante canonique propre.
30. **Fichiers modifiés ?** **Aucun fichier de code.** Uniquement les 8 documents listés en §Livrables, tous nouveaux (`server/docs/RBAC1_*.md`).
31. **Git ?** Aucun `git add`/`commit`/`push`/`deploy`. `git diff --check` exit 0 (vérifié après création des documents).
32. **Verdict ?** **RBAC-1 : AUDIT CERTIFIÉ.**

## Classement des risques (mandat §31)

| Sévérité | Findings |
|---|---|
| **P0** | Aucun |
| **P1** | 4 (voir Q29) — incohérences fortes, jamais des fuites de sécurité |
| **P2** | ~6 (MessagesPage STAFF_ROLES tronqué, menu Emails plus restrictif que le backend, MarketingDashboardPage exclut Collaborateur, convention de casse mobile vs web/backend, groupe `['Admin','GestionnaireImmobilier']` incohérent entre 4 fichiers, `['Admin','Collaborateur','GestionnaireImmobilier','CommunityManager']` non canonisé) |
| **P3** | ~8 (duplications internes `roles.js`, `RoleProtectedRoute.jsx` mort, `navigationSdk.canAccessDestination` mort, `checkPropertyOwnership` mort mais testé, libellés accentués cosmétiques, code React-Router legacy mort, trio `['Admin','Collaborateur','Secretaire']` redondant sans divergence de valeur) |

## Proposition de payload `/me` futur (conceptuel, non implémenté)

```json
{
  "user": { "id": "...", "role": "GestionnaireImmobilier", "businessProfiles": ["proprietaire_immobilier"] },
  "capabilities": ["properties.read", "properties.manage", "rental.manage", "..."],
  "tenantContext": { "tenantId": "...", "scopeUserIds": ["..."] }
}
```

Backend calcule les capacités effectives (fusion `iamArchitecture.js` + `HotelStaffAssignment` + `financialAuthorizationService` + `PlatformOperator` selon contexte), transmises pour l'UX uniquement — **le backend continue TOUJOURS de refaire l'autorisation réelle à chaque requête**, jamais une confiance aveugle au payload côté client. Rien de ceci n'a été implémenté dans RBAC-1.

## Roadmap proposée (non démarrée)

- **RBAC-2** → Backend devient la source canonique explicite : fusionner les 4 alias internes de `roles.js` (`STAFF_IMMO`/`ROLES_ALTIMMO`/`ROLES_GL`/`ROLES_LITIGES` → une seule constante), étendre `iamArchitecture.js`/`requireCapability` aux domaines encore role-only (Property, Modération, CRM, Litiges, Estimations), résoudre les 4 P1 identifiés avec preuve et test de caractérisation avant correction, exposer le nouveau payload `/me` proposé ci-dessus (additif, sans casser le contrat actuel).
- **RBAC-3** → Migration Web vers consommation de `capabilities` (remplacer progressivement les ~25 fichiers de checks de rôle inline par `hasCapability(...)`, en commençant par les zones déjà partiellement migrées `isStaffImmo`/`isStaffDocs`).
- **RBAC-4** → Migration Mobile (résoudre d'abord la convention de casse, puis adopter le même modèle de capacités que le web une fois stabilisé).
- **RBAC-5** → Suppression des constantes/checks legacy devenus morts une fois la migration complète : `RoleProtectedRoute.jsx`, `navigationSdk.canAccessDestination`, `checkPropertyOwnership`, la copie mobile jamais consommée de `staffCapabilities.js`, et statuer sur le sort réel de `User`/`Prestataire` (rôles LEGACY DORMANT) après investigation des comptes existants réels.

## STOP

Conformément au mandat : aucun rôle renommé/supprimé, aucun `restrictTo` modifié, aucune permission changée, aucun menu changé, aucune migration Mongo, aucun compte réel touché, aucun commit/push/déploiement. RBAC-2 n'a pas été démarré automatiquement. En attente de validation utilisateur.
