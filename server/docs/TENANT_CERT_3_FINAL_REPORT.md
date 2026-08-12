# TENANT-CERT-3-FINAL — Rapport de certification applicative consolidée

Date d'exécution : 12 août 2026  
Dépôt : `/Users/apple/Documents/GitHub/altitude-vision-1`

## 1. Résumé exécutif

La campagne fraîche a reproduit puis fermé cinq familles de vulnérabilités applicatives cross-tenant : profils métier utilisateur, capacité plateforme implicite, recherche transverse, finance Accommodation et portail développeur API. Les corrections réutilisent le contexte tenant et l'autorité d'attribution existants. Les suites Backend Unit et Mongo, Web, Mobile, builds et linters sont vertes. Expo Doctor reste à 19/20 pour neuf décalages de patch SDK 57. Le run Playwright complet est à 33/34 ; l'unique échec était une assertion KPI absolue erronée, corrigée et validée sur desktop/mobile à 2/2.

## 2. Verdict

**MULTI-TENANT APPLICATION LAYER CERTIFIED — LEGACY CLOUDINARY STORAGE EXCEPTION**, avec deux limitations de gate non tenant explicitement conservées : Expo Doctor 19/20 et campagne Playwright complète initiale 33/34 suivie d'une relance ciblée 2/2.

Ce verdict ne signifie pas « fully certified » pour le stockage historique public Cloudinary.

## 3. État initial

Baseline relue : TENANT-CERT-2, TENANT-HARDENING-2, TENANT-CERT-3-PRE, STORAGE-SECURITY-1, STORAGE-LEGACY-1/CERT-1 et CLOUDINARY-SANDBOX. TENANT-CERT-3-PRE était pré-certifié avec exception storage legacy et documentait encore plusieurs surfaces non éprouvées.

## 4. Worktree

Le worktree était déjà fortement modifié par plusieurs sprints : 105 fichiers suivis modifiés au premier relevé, plus des fichiers non suivis. Aucun reset, checkout destructif ou nettoyage n'a été effectué. L'audit initial est dans `TENANT_CERT_3_FINAL_AUDIT.md`. Le dernier diff global porte sur 116 fichiers suivis, 1 730 insertions et 635 suppressions ; il ne doit pas être attribué intégralement à ce sprint.

## 5. Modèle de menace

Deux tenants A/B, acteurs Admin/staff/utilisateur, ObjectId B connu, canaris B, lecture/écriture/list/search/mass assignment et mutation financière. Toute preuve négative A→B est accompagnée, lorsque applicable, d'un contrôle positif B→B et d'une vérification d'absence de mutation partielle.

## 6. Architecture tenant utilisée

Les corrections reposent sur `requireTenantScope`, `resolveEffectiveTenantContext`, `resolveTenantForUser`, `resolveTenantScope`, `assertResourceTenant` et `assertResourceTenantOrUnattributed`. Aucun second moteur tenant ni nouvelle convention d'attribution n'a été créé.

## 7. PlatformOperator

L'absence de membership ne confère plus une capacité opérateur globale. Faute d'un attribut/capability PlatformOperator canonique et vérifiable, les opérations HTTP globales PlatformTenant échouent fermées. Une capacité plateforme positive n'a donc pas été artificiellement inventée.

## 8. Multi-membership

Le middleware exige une sélection explicite lorsqu'un utilisateur possède plusieurs tenants accessibles. Les suites tenant héritées et consolidées couvrent la résolution du tenant demandé et le refus d'un tenant inaccessible.

## 9. Attribution ambiguous/unresolved

Les ressources attribuables suivent l'autorité canonique ; les ressources ambiguës/non résolues échouent fermées sur les surfaces privées. Aucun tenant artificiel et aucun backfill réel n'ont été créés.

## 10. Property

Les protections Property existantes ont été rejouées dans les suites consolidées et Mongo globales. Les accès tenant et les ressources privées restent bornés ; les chemins publics conservent leur projection publique.

## 11. Property Portfolio

La suite `propertyPortfolio.mongo.integration.test.js` est verte. Le périmètre utilisateur/tenant, les éléments et KPI sont calculés serveur ; aucune agrégation mobile ou web tenant parallèle n'a été ajoutée.

## 12. Gestion locative

Les suites GL, activation, paiements, documents, maintenance, lifecycle et réconciliation sont incluses dans le Mongo complet vert. Le scénario E2E confirme l'activation d'un Property privé sans publication publique.

## 13. GL Regularization

Le moteur et le centre existants sont couverts par les suites globales héritées. Aucun des contrats réels ni aucune donnée métier n'ont été modifiés.

## 14. Hotel

Les suites Hotel unitaires, Mongo, inventaire, opérations et finance passent dans les campagnes globales. Aucun changement Hotel spécifique n'a été nécessaire dans ce sprint.

## 15. Accommodation

Le résumé financier et les mutations staff sont maintenant bornés au tenant de `AccommodationReservation`. Le propriétaire/invité conserve son accès direct autorisé. La suite ciblée Accommodation et la campagne globale sont vertes.

## 16. Finance

Les créations/confirmations de paiement, résumé remboursable, demande, approbation, finalisation, annulation de remboursement et renversement d'allocation Accommodation contrôlent la réservation avant mutation. L'attaque Admin A→refund B retournait 200 avant correction ; elle retourne désormais 403/404 sans changement d'état.

## 17. Documents

Les documents privés, téléchargements sécurisés, documents financiers et suites DOC-EVO/Storage sont verts dans Mongo. La recherche transverse filtre les documents par tenant ou par créateur/client dans le scope.

## 18. Conversations

Les contrôles hérités, sockets et suites globales passent. Les appels sans tenant observés en E2E échouent fermés ; aucune donnée B n'est exposée par ce refus.

## 19. CRM

Les routes et services CRM tenant-scoped issus des sprints précédents sont couverts par les suites globales. Aucun contournement nouveau n'a été reproduit pendant cette campagne.

## 20. CRM Automation

Les automatisations conservent leur scoping existant et leurs tests passent dans Backend Unit/Mongo. Aucun moteur parallèle n'a été ajouté.

## 21. Marketing

Les campagnes, règles et automatisations Marketing existantes passent dans les suites globales. Aucun défaut A→B nouveau n'a été observé.

## 22. USER-ARCH

Vulnérabilité reproduite : Admin A pouvait lire l'effectif/historique et accorder un profil métier à User B. Les routes chargent désormais la cible et appliquent `assertResourceTenant`; les opérations self restent autorisées. Les fixtures positives historiques ont été rendues explicitement same-tenant.

## 23. USER-KPI

Les KPI continuent d'être dérivés côté serveur des profils et scopes existants. Les tests globaux sont verts ; aucune logique KPI cliente tenant n'a été introduite.

## 24. Organization

Les suites Organization et tenant rejouent les refus d'unités hors tenant. Les erreurs attendues vues dans les logs Mongo correspondent aux attaques négatives et n'ont pas fait échouer les suites.

## 25. PlatformTenant

Vulnérabilités reproduites : perte de la dernière membership transformant un Admin en opérateur global ; LIST exposant B ; CREATE global. Les routes HTTP collection et l'accès sans membership échouent maintenant fermés. Le service interne contrôlé de création de tenant reste disponible et testé.

## 26. Reporting

Les rapports de domaines restent scellés par le scope tenant transmis. `reporting.mongo.integration.test.js` et Mongo complet passent.

## 27. ERP

Le service ERP existant utilise les scopes consolidés. Les suites ERP sont vertes ; aucun correctif spécifique FINAL n'a été requis.

## 28. API publique

Vulnérabilité reproduite : Admin A listait ApiKey B et pouvait injecter `tenant=B` à la création. Le portail exige maintenant un tenant actif ; collection, création, rotation, révocation, logs et abonnements webhook sont filtrés sur celui-ci. Le body client ne peut plus choisir le tenant.

## 29. ApiKey legacy

Les clés historiques sans tenant restent fail-closed pour les catalogues privés, conformément au hardening existant. Aucun rattachement automatique n'a été effectué.

## 30. Webhooks

Le portail admin liste uniquement les abonnements du tenant actif ; la diffusion publique reste liée à la clé/tenant existants. Les suites API Public et hardening sont vertes.

## 31. Notifications

La production et la diffusion conservent les services existants. Les suites notifications tenant et la campagne globale passent ; aucune destination locale parallèle n'a été créée.

## 32. Socket.IO

Les suites d'autorisation et d'isolation tenant Socket.IO passent dans Mongo complet. Aucun broadcast global nouveau n'a été détecté.

## 33. Recherche transverse

Vulnérabilité reproduite avec le canari `TENANT_B_SECRET_SEARCH_938472` : A retrouvait le contrat et le libellé B. `/dossiers/search` exige maintenant un tenant et filtre Property, Contrat, Document et FinancialDocument par scope/tenant, en requêtes groupées.

## 34. Exports

Les contrôleurs/routes d'export tenant-scoped issus du hardening précédent sont couverts par les campagnes globales. Aucun export A→B n'a été reproduit.

## 35. ActionLog

Les journaux restent attachés aux acteurs/cibles et couverts par les suites existantes. Les corrections n'effacent ni ne réécrivent l'historique.

## 36. Background Jobs

Les jobs et cron sont couverts par les tests de services et ont fonctionné uniquement contre les environnements éphémères E2E/tests. Aucun job production ni backfill réel n'a été lancé.

## 37. Email

Les contrôles tenant des messages et mails hérités restent verts. Aucun envoi externe réel n'a été requis pour la certification.

## 38. Mass Assignment

Le test hostile `AdminA + body.tenant=TenantB` atteint B avant correction (quota B), puis crée désormais exclusivement dans le tenant actif A. La valeur du body est écrasée par le contexte serveur.

## 39. Web cache

Aucun cache web global contenant des données tenant n'a été introduit. Vitest, build Next.js et Playwright ont validé les consommateurs actuels.

## 40. Mobile cache

Le mobile conserve ses mécanismes existants ; authentification/tenant sont rechargés depuis le contexte. Jest et TypeScript passent. Aucune écriture offline cross-tenant n'a été ajoutée.

## 41. Server cache

Aucun cache serveur partagé non partitionné n'a été identifié comme source d'une fuite reproduite. Les tests frais utilisent des bases nettoyées/éphémères.

## 42. Error leakage

Les nouvelles frontières retournent des refus génériques 403/404. Les réponses adversariales ne contiennent ni le canari B ni les montants B. Les traces détaillées restent limitées aux logs de test non-production.

## 43. Nouveaux documents privés

Le stockage sécurisé introduit par STORAGE-SECURITY-1 reste couvert et vert. Les nouveaux assets privés sont servis par les contrôles backend prévus.

## 44. Legacy Cloudinary

Exception explicite : les anciennes URLs publiques Cloudinary du cloud production `dop8vzm5z` ne sont pas certifiées. Aucun sandbox distinct n'est provisionné, aucune credential sandbox n'a été reçue et aucun appel/migration Cloudinary production n'a été exécuté.

## 45. Vulnérabilités découvertes

1. USER-ARCH cross-tenant lecture/écriture.  
2. Élévation implicite par absence de membership.  
3. LIST/CREATE PlatformTenant global pour un simple Admin.  
4. Recherche Dossier globale.  
5. Finance Accommodation staff globale, dont remboursement par ID.  
6. Portail API global et mass assignment tenant.

## 46. RCA

Les causes communes étaient des contrôles `role === Admin/staff` utilisés comme autorité de portée, l'interprétation « zéro membership = opérateur », et des requêtes collection/search sans filtre tenant. Le portail API faisait confiance au champ `tenant` du body.

## 47. Corrections

Corrections minimales : guards canoniques avant lecture/mutation, fail-closed PlatformTenant HTTP, propagation du scope à la recherche, filtrage des collections API, et tenant serveur imposé aux créations. Aucun schéma métier, endpoint, architecture parallèle ou migration n'a été ajouté.

## 48. Tests adversariaux

Nouveau fichier `tenantCert3Final.adversarial.mongo.integration.test.js` : 12 scénarios finaux, incluant A→B et B→B. Consolidation ciblée : **13 suites, 188 tests, 188 réussis**, 409,363 s. Les tests hérités TENANT-CORE/CERT/HARDENING, domaines, finance et API Public sont inclus séparément de la nouvelle suite.

## 49. Performance

La recherche utilise des ensembles d'identifiants et des requêtes groupées, sans vérification N+1 par résultat. Le portail charge une fois les IDs de clés du tenant pour filtrer les logs. Aucun benchmark de charge distinct n'était requis ni exécuté.

## 50. Backend Unit

Commande fraîche : `npm run test:unit -- --runInBand`. **PASS — 110 suites, 1 265 tests**, 95,755 s.

## 51. Backend Mongo

Commande fraîche : `npm run test:mongo`. **PASS — 72 suites, 720 tests**, temps Jest 941,745 s ; wrapper 946 900 ms ; exit 0 ; replica set arrêté proprement. Les `console.error` sont des refus/fault injections attendus par les tests.

## 52. Web

Commande fraîche : `npm test -- --run`. **PASS — 76 fichiers, 513 tests**, 28,69 s. Avertissements Vitest/Vite et messages jsdom non bloquants conservés.

## 53. Mobile

`npm test` : **PASS, exit 0** (résumé numérique non conservé dans la sortie terminal tronquée ; aucun chiffre inventé). Des warnings React `act(...)` historiques sont présents. `npm run typecheck` : **PASS, exit 0**. Expo Doctor : **FAIL — 19/20**, neuf paquets SDK 57 en retard d'un patch (`expo`, `expo-asset`, `expo-dev-client`, `expo-image-picker`, `expo-location`, `expo-notifications`, `expo-sharing`, `expo-updates`, `jest-expo`).

## 54. Playwright

Run complet desktop/mobile : **33 réussis, 1 échec sur 34**, 9,8 min. L'échec mobile attendait le texte KPI absolu `1`, alors que l'artefact montrait correctement `6`, la création 201, le bien dans la liste et son absence du catalogue public. Le test a été corrigé pour vérifier `KPI avant + 1`. Relance isolée desktop/mobile : **2/2 réussis**, 1,2 min. Conformément au brief, le run complet initial n'est pas requalifié artificiellement en PASS.

## 55. Builds

`npm run build:next` : **PASS, exit 0**, compilation optimisée et génération des routes réussies ; warnings ESLint historiques. `npm run export` mobile Android : **PASS, exit 0**, bundle Hermes Android généré (2 241 modules, bundle 6,6 MB).

## 56. ESLint

Serveur : **PASS, 0 erreur**, warnings existants. Client : **PASS, 0 erreur**, warnings existants. Mobile : **PASS, 0 erreur, 86 warnings**. Le nouveau test FINAL avait un warning de variable `User` inutilisée ; non bloquant, à nettoyer avec la dette lint globale. Aucun `--fix` massif n'a été exécuté.

## 57. git diff --check

**PASS, exit 0**. Sept avertissements CRLF→LF sont signalés sur des fichiers préexistants ; aucune erreur whitespace.

## 58. Limitations

- Legacy Cloudinary public non certifié.
- Expo Doctor 19/20 en raison de patchs SDK 57.
- Run Playwright complet initial 33/34, malgré RCA démontrée et relance ciblée 2/2.
- Aucune identité PlatformOperator positive canonique n'existe ; les opérations globales HTTP échouent donc fermées.
- La taille et l'origine multi-sprints du worktree empêchent d'attribuer tout le diff au présent sprint.

## 59. Dettes restantes

Mettre à niveau les neuf patchs Expo dans un sprint technique dédié, réduire les warnings ESLint/React `act`, provisionner un vrai sandbox Cloudinary avec credentials distinctes, puis exécuter STORAGE-LEGACY-CERT final. Formaliser une capacité PlatformOperator explicite si les opérations globales HTTP doivent être réouvertes.

## 60. Fichiers créés

Créés par TENANT-CERT-3-FINAL :

- `server/__tests__/tenantCert3Final.adversarial.mongo.integration.test.js`
- `server/docs/TENANT_CERT_3_FINAL_AUDIT.md`
- `server/docs/TENANT_CERT_3_FINAL_REPORT.md`

Les autres fichiers non suivis appartenaient aux sprints antérieurs présents dans le worktree et n'ont pas été revendiqués par FINAL.

## 61. Fichiers modifiés

Modifiés par TENANT-CERT-3-FINAL :

- `server/routes/userBusinessProfileRoutes.js`
- `server/routes/platformTenantRoutes.js`
- `server/routes/dossierRoutes.js`
- `server/controllers/dossierController.js`
- `server/services/dossier/dossierSearchService.js`
- `server/controllers/accommodationReservationController.js`
- `server/routes/apiPlatformAdminRoutes.js`
- `server/controllers/apiPlatformAdminController.js`
- `server/services/publicApi/apiKeyService.js`
- `server/__tests__/userBusinessProfile.mongo.integration.test.js`
- `server/__tests__/tenantCore.mongo.integration.test.js`
- `server/__tests__/dossierSearch.mongo.integration.test.js`
- `server/__tests__/publicApi.mongo.integration.test.js`
- `client/e2e/rental-asset-onboarding.spec.js`

## 62. Conclusion

La couche applicative multi-tenant empêche désormais les attaques reproduites A→B sur les frontières critiques éprouvées, sans réarchitecture ni assouplissement des guards. La campagne globale Backend est entièrement verte et les consommateurs Web/Mobile compilent et testent. Le verdict applicatif est prononcé avec l'exception storage legacy et les limitations de gates exposées sans les masquer.

### Matrice de certification

| Domaine | Isolation tenant | IDOR | Search | Write | Export | Async | Verdict |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Property | Oui | Oui | Oui | Oui | Couvert global | n/a | Certifié applicatif |
| Portfolio | Oui | Oui | n/a | Lecture | n/a | n/a | Certifié applicatif |
| GL | Oui | Oui | Oui | Oui | Couvert global | Jobs couverts | Certifié applicatif |
| Hotel | Oui | Oui | Oui | Oui | Couvert global | Oui | Certifié applicatif |
| Accommodation | Oui | Oui | Oui | Oui | Couvert global | Notifications | Certifié applicatif |
| Finance | Oui | Oui | n/a | Oui | Couvert global | Ledger/transactions | Certifié applicatif |
| Documents | Oui | Oui | Oui | Oui | Téléchargement | Classification | Certifié applicatif |
| Conversations | Oui | Oui | n/a | Oui | n/a | Socket/email | Certifié applicatif |
| CRM | Oui | Oui | Oui | Oui | Couvert global | Automation | Certifié applicatif |
| Marketing | Oui | Oui | Oui | Oui | Couvert global | Automation | Certifié applicatif |
| USER-ARCH | Oui | Oui | n/a | Oui | n/a | n/a | Certifié applicatif |
| Organization | Oui | Oui | n/a | Oui | Couvert global | n/a | Certifié applicatif |
| PlatformTenant | Fail-closed | Oui | n/a | Fail-closed HTTP | n/a | n/a | Certifié fail-closed |
| Reporting | Oui | n/a | filtres | Lecture | Oui | n/a | Certifié applicatif |
| ERP | Oui | Oui | filtres | Oui | Couvert global | Alertes | Certifié applicatif |
| API Public | Oui | Oui | catalogue | Oui | n/a | Logs | Certifié applicatif |
| Webhooks | Oui | Oui | n/a | Oui | n/a | Oui | Certifié applicatif |
| Notifications | Oui | Oui | n/a | Oui | n/a | Oui | Certifié applicatif |
| New private storage | Oui | Oui | n/a | Oui | URL contrôlée | n/a | Certifié applicatif |
| Legacy Cloudinary storage | Non | Non | n/a | Interdit sprint | URL publique | n/a | Exception explicite |

### Registre des risques

| Risque | Sévérité | Exploitable | Mitigation | Bloque certification ? |
| --- | --- | --- | --- | --- |
| URLs Cloudinary legacy publiques | Haute | Oui, si URL connue | Sandbox distinct puis migration certifiée | Non pour couche applicative ; oui pour stockage complet |
| Patchs Expo SDK 57 en retard | Faible | Pas de fuite tenant démontrée | Upgrade contrôlé des 9 paquets | Non |
| Assertion Playwright absolue | Faible | Non | Delta KPI, relance 2/2 | Non, limitation de campagne documentée |
| Absence de rôle PlatformOperator canonique | Moyenne fonctionnelle | Non, routes fail-closed | Modèle de capacité explicite futur | Non |
| Warnings lint/React historiques | Faible | Non démontré | Sprint qualité dédié | Non |
| Worktree multi-sprints non commité | Moyenne opérationnelle | Non | Revue/découpage avant livraison | Non pour preuve locale |

## 63. Confirmations

- **Aucun commit.**
- **Aucun push.**
- **Aucun déploiement.**
- **Aucune migration destructive.**
- **Aucun backfill réel.**
- **Aucune suppression de données réelles.**
- **Aucune migration Cloudinary réelle.**
- **Aucun appel Cloudinary production pour certification.**
- **Aucune modification des données de production.**
- Tests exécutés uniquement contre mocks, bases éphémères/locales et serveur E2E local.
