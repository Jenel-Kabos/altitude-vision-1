# HOTFIX-RBAC-GESTION-LOCATIVE-ACCESS-1 — RAPPORT

**Verdict : CERTIFIÉ VERT.**

L'audit a montré que la divergence caractérisée par RBAC-3 n'était pas une simple exclusion de `Collaborateur` : la variable unique `canManage` de `GestionLocativePage.jsx` gatait en réalité **trois contrats backend distincts**. Deux corrections ont été nécessaires, dans les deux sens : `Collaborateur` était exclu à tort de la création/édition de Contrat et du CRUD Propriétaire/Locataire (le backend l'autorisait déjà) ; `GestionnaireImmobilier` était inclus à tort dans la suppression de Contrat (le backend la refuse, `adminOnly`) — une divergence opposée non détectée par RBAC-3, découverte pendant cet audit. Les deux corrections sont strictement frontend ; aucune règle backend n'a changé.

## Réponses aux 60 questions du mandat

1. **Quelle était exactement la divergence RBAC-3 ?** `canManage = isAdmin || role === 'GestionnaireImmobilier'` excluait `Collaborateur` de l'édition/suppression de biens gérés et de la création de mandat, alors que le backend l'autorisait via `STAFF_IMMO`/`rental.manage`.
2. **Quel fichier frontend était concerné ?** `client/lib/pages/dashboard/GestionLocativePage.jsx`.
3. **Quel check frontend était utilisé ?** `const canManage = isAdmin || user?.role === 'GestionnaireImmobilier';` (une seule variable pour plusieurs actions).
4. **Quels rôles frontend étaient autorisés ?** Admin, GestionnaireImmobilier uniquement.
5. **Quels rôles backend étaient autorisés ?** Selon l'action : {Admin, GestionnaireImmobilier} (onboarding/désactivation), {Admin, GestionnaireImmobilier, Collaborateur} (Contrat create/edit, Propriétaire+biens CRUD, Locataire CRUD), {Admin} seul (Contrat delete).
6. **Quelle capability backend était impliquée ?** `leases.manage` (Contrat), `tenants.manage` (Locataire) ; Propriétaire+biens utilisent `restrictTo(...STAFF_IMMO)` directement, sans capability nommée.
7. **Cette capability correspond-elle exactement au workflow ?** Oui pour Contrat/Locataire (capacités déjà déclarées et exactement dimensionnées) ; pour Propriétaire, aucune capability n'existe (`STAFF_IMMO` en rôle direct) — non créée, mandat §22 respecté (pas de nouvelle capability sans preuve stricte de nécessité, un rôle-liste local suffit et mirrore déjà `STAFF_IMMO`).
8. **Quels endpoints sont consommés par GestionLocativePage ?** Voir `HOTFIX_RBAC_GESTION_LOCATIVE_ACCESS1_ENDPOINT_MATRIX.md` — Propriétaires, Locataires, Contrats, Rental-management (onboarding/désactivation/actions), Paiements, Documents, Maintenance, Properties portfolio.
9. **Ont-ils tous le même contrat ?** Non — trois populations distinctes (voir Q5).
10. **Sinon, pourquoi ?** Onboarding/désactivation sont des actions structurantes (créer/retirer un mandat de gestion) volontairement réservées à Admin/GestionnaireImmobilier ; suppression de Contrat est une action destructrice réservée à Admin seul ; le reste (CRUD courant) suit le contrat staff immobilier standard incluant Collaborateur.
11. **Qui doit voir le menu Gestion Locative ?** Tout rôle possédant au moins une capacité du domaine (déjà correct, capacité-based, non modifié) : Admin, Collaborateur (tout), GestionnaireImmobilier (tout), Secretaire (sous-ensemble documents/paiements/lecture).
12. **Qui doit accéder directement à la page ?** Les 6 rôles staff du gate dashboard générique (`ALLOWED_ROLES`), inchangé — CommunityManager/Communicant peuvent charger la coquille mais aucune donnée (403 backend sur tout appel).
13. **Admin ?** ALLOWED partout, inchangé.
14. **Collaborateur ?** ALLOWED sur Contrat create/edit + Propriétaire/Locataire CRUD (corrigé) ; DENIED sur onboarding/désactivation/suppression Contrat (inchangé).
15. **GestionnaireImmobilier ?** ALLOWED partout sauf suppression de Contrat (corrigé, désormais DENIED côté UI comme le backend l'exige déjà).
16. **Secretaire ?** DENIED sur toute mutation GL (inchangé, jamais eu ce droit).
17. **CommunityManager ?** DENIED (inchangé).
18. **Communicant ?** DENIED (inchangé).
19. **Proprietaire ?** DENIED — espace propriétaire séparé, jamais ce dashboard staff (inchangé).
20. **Client ?** DENIED, hors dashboard staff (inchangé).
21. **User legacy ?** DENIED, hors dashboard staff (inchangé).
22. **Prestataire ?** DENIED, hors dashboard staff (inchangé).
23. **Quelle preuve établit ce contrat ?** Lecture directe et citée (fichier:ligne) des middlewares réellement appliqués aux endpoints réellement appelés par cette page — `proprietaireRoutes.js`, `locataireRoutes.js`, `contratRoutes.js`, `rentalManagementRoutes.js` — aucun fichier backend modifié depuis, contrat non ambigu.
24. **Le frontend était-il trop restrictif ?** Oui, sur Contrat create/edit + Propriétaire/Locataire CRUD pour `Collaborateur`.
25. **Trop permissif ?** Oui, sur la suppression de Contrat pour `GestionnaireImmobilier` (bouton menant à un 403 garanti).
26. **Le backend était-il trop restrictif ?** Non — aucune preuve trouvée.
27. **Trop permissif ?** Non — aucune preuve trouvée.
28. **Quel côté a été corrigé ?** Frontend uniquement (mandat §33 : backend déjà correct dans les deux cas).
29. **`can()` est-il utilisé ?** Non — ce fichier n'utilisait déjà aucun `can()` avant ce hotfix (100% checks de rôle, y compris `canDoc` préexistant) ; la correction introduit `canManageStaffImmo`, une liste de rôles locale mirrorant `STAFF_IMMO` par valeur, cohérente avec le patron déjà en usage (`canDoc`) plutôt que de fragmenter en plusieurs `can('leases.manage')`/`can('tenants.manage')` différents pour des actions à résultat de rôle identique.
30. **Une nouvelle capability a-t-elle été créée ?** Non.
31. **Pourquoi ?** Le contrat Propriétaire n'a pas d'équivalent capability (`restrictTo(...STAFF_IMMO)` direct) ; créer une capability uniquement pour uniformiser l'accès aurait été une expansion IAM non justifiée par ce hotfix (mandat §22).
32. **Un mapping role→capabilities a-t-il été recréé ?** Non — `canManageStaffImmo` est une expression booléenne unique pour un seul groupe d'actions, pas une structure `{role: [capabilities]}` généralisée (mandat §35 respecté).
33. **Tenant intact ?** Oui — `assertProprietaireInScope`, `assertLocataireInScope`, `router.param('id')`, `requireTenantScope` non modifiés.
34. **Ownership intact ?** Oui — mêmes gardes, non modifiées.
35. **PlatformOperator intact ?** Oui — non concerné, non modifié.
36. **BusinessProfiles intacts ?** Oui — non concernés, non modifiés.
37. **Paiements locatifs intacts ?** Oui — `canDoc` (gérant l'accès paiements/documents dans ce même fichier) non modifié.
38. **Documents intacts ?** Oui — idem.
39. **Maintenance intacte ?** Oui — non concernée par `canManage`/`canManageStaffImmo`, lecture seule dans cette page, non modifiée.
40. **Litiges intacts ?** Oui — domaine non touché par ce hotfix.
41. **Google auth intact ?** Oui — non concerné.
42. **Post-login routing intact ?** Oui — `HOTFIX-AUTH-POSTLOGIN-ROUTING-1` non rouvert, aucun fichier concerné modifié.
43. **Mobile intact ?** Oui — `altimmo-app/` non touché.
44. **Financial Core intact ?** Oui — non concerné.
45. **Tests frontend ciblés ?** Oui — `client/lib/__tests__/GestionLocativeAccess.test.jsx` (nouveau, 12 tests, caractérisation rouge puis parité verte).
46. **Tests backend ciblés ?** Oui, par prudence bien qu'aucun fichier backend modifié — `iamArchitecture.test.js`, `rolesAliasParity.test.js` : 2/2 suites, 25/25 tests verts.
47. **Tests GL ?** Aucune suite `GL-B2`/`GL-B3`/`GL-B3.1` backend n'était affectée (aucun fichier backend modifié) ; non rejouées spécifiquement, le périmètre modifié étant strictement frontend.
48. **Tests tenant ?** Non rejoués spécifiquement — aucun fichier tenant backend modifié, les tests Mongo tenant existants (`tenantCert2.gl.adversarial.mongo.integration.test.js` et similaires) restent valides tels quels.
49. **Backend complet ?** Non requis — aucun fichier backend exécutable modifié (mandat §57 : "si non modifié, rejouer uniquement les tests auth pertinents en précaution" — fait, voir Q46).
50. **Client complet ?** Oui — 96/96 fichiers, 677/677 tests.
51. **Mongo ?** Non requis — aucune autorisation backend modifiée.
52. **Lint ?** 0 erreur (267 warnings, baseline inchangée).
53. **Build Next ?** Vert (`npm run build:next`).
54. **`git diff --check` ?** exit 0.
55. **Fichiers modifiés ?** 1 fichier de production — `client/lib/pages/dashboard/GestionLocativePage.jsx`. Créé : `client/lib/__tests__/GestionLocativeAccess.test.jsx`, et 6 documents `server/docs/HOTFIX_RBAC_GESTION_LOCATIVE_ACCESS1_*.md`.
56. **Commit ?** Aucun.
57. **Push ?** Aucun.
58. **Deploy ?** Aucun.
59. **Dette restante ?** (a) `CommunityManager`/`Communicant` peuvent charger la coquille de la page sans y voir de données (gate dashboard générique large, pas de fuite, non corrigé — hors périmètre de ce hotfix). (b) `checkPermission` (fonction jamais appelée) et le `canManage` mort dans `ContratDetailModal` restent du code mort préexistant, non nettoyés (candidat futur type RBAC-5). (c) `client/lib/utils/staffRoles.js` (`isStaffImmo`/`isStaffDocs`) reste un candidat de migration future non exécuté par ce hotfix, sans lien avec la divergence corrigée ici.
60. **Verdict ?** **CERTIFIÉ VERT.** Tous les critères du mandat §69 sont remplis : divergence reproduite (test rouge avant fix), contrat métier prouvé par lecture directe du backend non modifié, frontend et backend désormais intentionnellement alignés sur les trois populations réelles, aucun élargissement silencieux (chaque changement correspond exactement à ce que le backend autorisait déjà), GestionnaireImmobilier et Secretaire correctement traités, Client/Proprietaire ne gagnent aucun accès, tenant/ownership intacts, capacités backend restent la source canonique, aucun mapping role→capabilities recréé, tests ciblés et suites pertinentes verts, build vert, `git diff --check` vert.

## STOP

Conformément au mandat : aucune permission backend modifiée, `GestionnaireImmobilier`/`Secretaire`/`Collaborateur` traités selon preuve, `Client`/`Proprietaire` sans accès staff supplémentaire, tenant/ownership/PlatformOperator/BusinessProfiles/Financial Core/Google auth/post-login routing/mobile intacts. Aucun commit/push/déploiement. `HOTFIX-RBAC-TRANSACTIONS-ACCESS-1` non démarré. En attente de validation utilisateur.
