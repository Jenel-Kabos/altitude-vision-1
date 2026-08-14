# IAM-3 — RAPPORT DES PERMISSIONS MÉTIER DU STAFF

Date : 2026-08-14  
Branche/HEAD : `main` / `c523b3118549da770bc761d5e7b93de8deb58605`  
Périmètre : serveur et client web; aucune migration Mongo réelle, aucun changement JWT/tenant/ownership.

## 1. Résumé exécutif

IAM-3 introduit un guard backend de capabilities et sépare réellement READ/MANAGE sur les domaines staff prioritaires. Les P1 démontrés sont corrigés : Secrétaire ne gère plus la GL, Gestionnaire ne gère plus documents/paiements, Community Manager ne gère plus immobilier/visites. Admin et Collaborateur legacy restent complets. Tenant, ownership, ABAC et invariants continuent de s'appliquer après le contrôle d'identité.

## 2. Architecture avant

Des tableaux de rôles (`STAFF_DOC`, `ROLES_GL`, `ROLES_ALTIMMO`, etc.) protégeaient simultanément GET et mutations. La projection IAM-2 documentait les capacités mais n'était pas appliquée par le backend. La sidebar recopiait les rôles.

## 3. Architecture après

Chaîne effective sur les routes migrées : `protect → tenant éventuel → requireCapability → resource scope/controller → action`. `requireCapabilityForStaff` préserve les routes self-service propriétaire tout en restreignant le staff. Aucun wildcard ne court-circuite les autres couches.

## 4. Capabilities

Source backend étendue : `server/utils/iamArchitecture.js`; middleware : `server/middleware/capabilityMiddleware.js`. Admin=`*`, Collaborateur=`legacy.full`. Le client possède une projection compatible réservée à la navigation; elle n'est jamais une source de sécurité.

## 5. Admin

Admin passe explicitement documents, paiements, GL, visites, maintenance, Altcom et événements grâce à `*`. Les guards tenant, scopes hôtel/propriété et règles financières restent obligatoires.

## 6. Secrétaire

READ : `/api/documents/**`, GET `/api/gestion-docs/contrat/:id`, GET `/api/paiements/**`, GET `/api/contrats/**`, GET `/api/locataires/**` nécessaires au workflow. MANAGE : POST/PATCH documents et gestion-docs, mutations `/api/paiements/**`, création de paiement imbriquée au contrat. Interdit : mutations GL, locataires/baux, visites, maintenance, Altcom/events, utilisateurs.

## 7. Gestionnaire immobilier

READ : rental-management/stats/détail/history, contrats, locataires, visites, maintenance GL, biens/propriétaires existants. MANAGE : rental-management, locataires, baux, visites, maintenance, préavis, occupation. Interdit : centre documentaire général, génération documentaire générale, mutations paiement, Altcom/events et utilisateurs. `payment.status` est projeté, mais aucun nouvel endpoint financier transversal n'a été créé.

## 8. Community Manager

READ/MANAGE : Altcom et Mila Events; médias associés via les routes d'upload événements. Interdit : immobilier/hébergement administratif, GL, contrats/locataires, documents privés, paiements, visites et maintenance. La sidebar reflète cette séparation.

## 9. Documents

`/api/documents` sépare `documents.read` et `documents.manage`; DELETE reste Admin. `/api/gestion-docs` sépare GET et génération/envoi. `/api/rental-documents` conserve son contrôle privé/ownership existant et n'est pas élargi par la capability générale.

## 10. Paiements

`/api/paiements` sépare `payments.read` pour listes, stats, alertes, preuve et reçus; `payments.manage` pour pénalités, encaissements, mise à jour et marquage payé; `payments.reverse` pour l'annulation sensible, réservée à Admin dans la matrice actuelle. DELETE reste Admin. `Paiement`, `PaiementTransaction` et `FinancialPayment` n'ont pas été fusionnés.

## 11. Gestion locative

`/api/rental-management` applique `rental.read/manage`; les transitions d'occupation, maintenance et préavis exigent leurs capacités spécialisées. L'onboarding et la désactivation conservent leurs règles Admin/Gestionnaire existantes.

## 12. Visites

GET staff exige `visits.read`; PATCH staff exige `visits.manage`. Les routes client et propriétaire restent distinctes et conservent leurs contrôles. Secrétaire et Community Manager ne peuvent plus contourner le menu par appel direct aux endpoints staff.

## 13. Maintenance

`/api/rental-maintenance` applique `maintenance.read/manage` uniquement lorsqu'il s'agit d'un rôle staff; le self-service propriétaire reste contrôlé par ownership. La maintenance hôtelière conserve son ABAC par établissement et n'a pas été remplacée par le RBAC global.

## 14. Préavis

Les mutations `start-notice`, `acknowledge-notice` et `cancel-notice` exigent `notice.manage`. Leur scope tenant/ressource reste celui de `RentalManagement`.

## 15. Altcom

GET projets exige `altcom.read`; PATCH/DELETE exige `altcom.manage`. La soumission publique initiale reste publique conformément au contrat existant.

## 16. Mila Events

La consultation reste publique. Les uploads et CRUD protégés exigent `events.manage`, puis la fenêtre d'écriture existante. Admin, Collaborateur legacy et Community Manager sont autorisés.

## 17. Tenant

AUTH-1.1 est intact. Les `requireTenantScope`, `router.param` et assertions `assertResourceTenant*` existantes sont conservées. La capability ne choisit jamais un tenant et n'accorde jamais un accès cross-tenant.

## 18. Frontend

La navigation staff utilise `hasStaffCapability` sur documents, paiements, GL, baux, locataires, visites, maintenance, préavis, Altcom et événements. Les groupes immobiliers legacy ont aussi été resserrés. L'alignement de tous les boutons internes de chaque page est **NON CONFIRMÉ** : le backend protège néanmoins les appels directs.

## 19. Backend

Le backend applique réellement les capabilities sur les routeurs Documents, gestion-docs, Paiements, RentalManagement, Contrats, Locataires, Visites, RentalMaintenance, Altcom et Events. Les contrats URL/payload/réponse ne changent pas.

## 20. Bugs trouvés

- P1 Secrétaire : accès mutation GL/préavis;
- P1 Gestionnaire : gestion documentaire générale et annulation de reçu;
- P1 Community Manager : mutations visites et création administrative immobilier/hébergement;
- P2 mêmes guards GET/mutation;
- P3 sidebar dupliquée et trop large;
- P4 groupes legacy encore utilisés hors domaines migrés.

## 21. Bugs corrigés

Les trois P1 ci-dessus sont corrigés côté API et navigation. Un effet de bord de statut (404 avant capability sur une route GL appelée par un Propriétaire) a été ramené à 403 sans divulguer l'existence de la ressource.

## 22. Tests

- ciblés IAM-3 et non-régressions : 8 suites serveur / 184 tests;
- appels API directs capabilities : Secrétaire, Gestionnaire, Community Manager, Admin;
- serveur complet : 116 suites / 1 319 tests;
- client complet : 79 fichiers / 533 tests;
- Mongo ciblé IAM/tenant/recherche : 3 suites / 55 tests passés;
- owner/client : property, accommodation, maintenance, tenant portal et GL couverts dans les suites vertes.

## 23. Gates

- lint serveur : PASS, 0 erreur, 110 avertissements existants;
- lint client : PASS, 0 erreur, 269 avertissements existants;
- build Next : PASS, 142 routes;
- health : PASS, 28/28, aucune connexion à une base réelle;
- verify serveur/client : PASS;
- unit serveur/client : PASS;
- Mongo mémoire complet : **ÉCHEC**, 81/82 suites et 860/861 tests; l'unique échec `altimmoSearch.mongo.integration.test.js` a observé une propriété résiduelle d'une autre suite. Relancé isolément avec les suites IAM/tenant touchées : PASS 3/3 suites, 55/55 tests. L'échec complet est donc documenté comme fuite d'isolation inter-suite, pas masqué comme PASS.

Les commandes racine `ci` et `release-check` exécutent aussi syntax/lint/types/tests/doctor/export mobile. Elles n'ont pas été lancées car IAM-3 est explicitement serveur + client web; leurs gates serveur/client constitutives ont été exécutées directement. Aucun deploy n'a été déclenché.

## 24. Dette restante

Migrer progressivement les surfaces secondaires encore fondées sur groupes legacy (`dossiers`, CRM, reporting, marketing automation, certaines routes financières/hôtelières), auditer tous les boutons internes et supprimer à terme la projection frontend dupliquée via un manifeste généré/partagé. Une séparation exhaustive de toutes les dizaines de routes du dépôt est **NON CONFIRMÉE** et relève des phases suivantes.

## 25. Risques

`Collaborateur` conserve volontairement un accès legacy complet. Les capacités restent dérivées du rôle, sans délégation persistée par utilisateur. Toute nouvelle route doit ajouter capability et scope, faute de quoi la dette RBAC réapparaîtra.

## 26. État Git

Travail commencé sur `main` au HEAD `c523b3118549da770bc761d5e7b93de8deb58605`, avec IAM-2 non commité conservé. Aucun commit, push, merge, rebase, migration réelle ou déploiement. Les contrôles Git finaux sont consignés à la fin du sprint.

### Réponses à la condition de fin

- Routes lisibles/modifiables par rôle : listées aux sections 6–8 et détaillées par domaine 9–16.
- Admin pleinement opérationnel : **OUI**, tests directs et suite complète.
- Lecture/mutation séparées : **OUI sur les domaines IAM-3 migrés**; exhaustive dépôt : **NON CONFIRMÉE**.
- Backend applique les capabilities : **OUI** sur les routeurs listés section 19.
- Frontend reflète les capabilities : navigation principale **OUI**; tous boutons internes **NON CONFIRMÉ**.
- Contournement par API : refus 403 testé sur les domaines migrés; toutes routes historiques : **NON CONFIRMÉ**.
- Tenant intact : **OUI**, tests unitaires/transverses et Mongo isolé une fois achevé.
- Régression propriétaires/clients : **aucune dans les suites couvertes**; exhaustivité fonctionnelle manuelle : **NON CONFIRMÉE**.
