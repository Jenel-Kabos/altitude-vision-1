# TENANT-HARDENING-1 — Rapport final de reprise

## Verdict

Le durcissement est opérationnel et toutes les gates techniques demandées sont vertes. L'isolation est démontrée pour la résolution de tenant, CRM, Marketing, Automation CRM, API publique legacy, Webhooks, ActionLog et le Property Portfolio à quatre sources. La **certification exhaustive de toute la plateforme reste refusée** : Finance, Documents/DOC-EVO, Conversations et plusieurs écritures métier Property/GL/Hôtel/Accommodation ne disposent pas encore de la matrice adverse READ/WRITE/SEARCH/EXPORT/AGGREGATE exigée par le brief. Ce rapport ne confond pas absence de régression et preuve d'isolation.

## 1. État initial du worktree

Le worktree était déjà non propre et combinait TENANT-CORE-1, un TENANT-HARDENING partiel, PROPERTY-PORTFOLIO-1 certifié et plusieurs sprints antérieurs. Aucun changement préexistant n'a été écrasé, restauré ou commité.

## 2. Changements TENANT-HARDENING déjà présents avant reprise

La résolution explicite, les champs tenant additifs CRM/Marketing/ActionLog/Notification/API/Webhook, le scoping CRM/Marketing/ActionLog, le fail-closed API legacy, le service de quotas et le dry-run de réconciliation existaient déjà partiellement. La reprise a audité leur chaîne réelle et complété Portfolio, Automation et fixtures E2E.

## 3. Vulnérabilités cross-tenant trouvées

- `GET /api/properties/portfolio` agrégeait globalement quatre sources.
- Le moteur CRM Automation sélectionnait des règles globales; routes, runs et actions n'étaient pas systématiquement tenant-scopés.
- Des résolutions Customer, Opportunity et MarketingTemplate dans les actions étaient globales.
- Les notifications créées par plusieurs chemins CRM perdaient le tenant source.
- La fixture E2E ne modélisait aucun tenant, masquant le comportement des routes fail-closed.

## 4. Architecture finale

La chaîne canonique est `PlatformTenant → rootOrgUnit/descendants → OrgMembership actifs → scopeUserIds`. Le tenant explicite est validé par le serveur. Les autorisations objet historiques restent une seconde barrière. Aucun endpoint, modèle parallèle ou duplicata de Property Portfolio n'a été créé.

## 5. Résolution multi-tenant

Mono-tenant : résolution automatique. Multi-tenant : `X-Platform-Tenant-Id` obligatoire et membership validé. Tenant adverse, ambigu, suspendu/archivé, membership inactif ou unité inactive : échec fermé. Aucun « premier membership » arbitraire.

## 6. Isolation READ

CRM, Marketing, ActionLog, Automation et Portfolio ajoutent le tenant ou `scopeUserIds` à leurs lectures. Un scope vide retourne zéro donnée. Les clés API historiques sans tenant obtiennent un catalogue vide.

## 7. Isolation WRITE

Les mutations CRM/Marketing/Automation utilisent tenant + identifiant. Les actions Automation résolvent Customer, Opportunity et Template dans le tenant de l'événement. La couverture adverse exhaustive des écritures Finance/Documents/GL/Hôtel/Accommodation reste à produire.

## 8. IDOR

Les identifiants CRM/Marketing/Automation d'un autre tenant sont traités comme introuvables. Les tests utilisent de vrais ObjectId A/B. La preuve IDOR globale, modèle par modèle, n'est pas complète.

## 9. CRM

Customers, Opportunities, Activities et Consolidations portent un tenant additif et indexé. Listes, détail, recherche, timeline, agrégations et mutations durcies sont scopés. Les notifications CRM propagent `platformTenantId`.

## 10. Marketing

Templates, Campaigns, Sends et Unsubscribes sont tenant-scopés. Une campagne conserve son tenant; les audiences et activations de template adverses sont refusées.

## 11. Notifications

`Notification.platformTenant` reste additif/nullable pour le legacy. Les producteurs CRM modifiés transmettent le tenant. L'audit exhaustif de tous les producteurs historiques reste une dette; l'absence de contexte ne doit jamais produire une diffusion globale.

## 12. Automations

Les routes CRM Automation exigent le tenant. Rule et Run sont filtrés par tenant; un événement sans `platformTenantId` n'exécute rien. Un événement A sélectionne uniquement les règles A, crée uniquement un run A et résout ses dépendances dans A.

## 13. Webhooks

Les subscriptions conservent le tenant de la clé API. Le dispatch exige un tenant source et filtre les abonnements; sans tenant il échoue fermé.

## 14. Finance

Les ADR et modèles financiers n'ont pas été fusionnés ni modifiés. Les suites Mongo financières passent, mais aucune nouvelle matrice adverse couvrant FinancialDocument, FinancialPayment et PaymentAllocation A/B n'a été ajoutée : domaine non certifié globalement.

## 15. Documents

DOC-EVO et `Contrat.documents[]` sont préservés. Playwright couvre les parcours documentaires existants, pas une preuve d'isolation A/B complète. Domaine non certifié globalement.

## 16. Property Portfolio

La route staff exige désormais `requireTenantScope`; controller et service transmettent `scopeUserIds`. Property filtre `owner`, Accommodation filtre sa Property peuplée, Hotel filtre l'owner de sa Property. La déduplication physique reste inchangée. Le test adverse prouve uniquement ventes, locations, hébergements et hôtels A, aucun B, et `stats.total === items.length` avec compteurs par source exacts.

## 17. Reporting

Le scope organisationnel existant est conservé. Aucun KPI non supporté n'a été artificiellement présenté comme tenant-scopé. Les KPI indirects restent à certifier domaine par domaine.

## 18. ERP

L'alias tenant/orgUnit existant est conservé et sa suite Mongo adaptée passe. Cela prouve la non-régression, pas une couverture adverse exhaustive de chaque agrégat ERP.

## 19. API publique

Les clés tenant-scopées limitent Property/Hotel/Accommodation via les owners du scope. Une clé legacy `tenant:null` s'authentifie encore mais reçoit un scope vide : correction de sécurité volontairement restrictive. Rotation et Webhooks conservent le tenant.

## 20. Quotas

`tenantQuotaService` centralise la lecture de `PlatformTenantSubscription`; `null` signifie illimité et l'absence d'abonnement actif échoue fermée. Le dépassement bloque les créations concernées, jamais les lectures. L'intégration immédiate couvre notamment les API keys; l'extension systématique aux autres créations reste à terminer.

## 21. ActionLog

Tenant et organisation sont additifs. Listes, récents, statistiques et CSV sont filtrés. Aucun enum artificiel n'a été ajouté.

## 22. Admin plateforme

`role === Admin` n'accorde aucun bypass cross-tenant. Aucune identité Super Admin plateforme distincte n'existe aujourd'hui; aucune capacité globale implicite n'a été inventée.

## 23. Legacy / backfill

Tous les champs sont additifs et nullable. `tenantDataReconciliation.js` est dry-run uniquement, exige une URI explicite et ne propose aucun mode apply. Aucune donnée legacy n'a reçu un tenant supposé.

## 24. Web / Mobile

Aucun sélecteur tenant n'a été ajouté. Les utilisateurs multi-tenant doivent fournir un contexte validé côté serveur; sinon les routes durcies échouent fermées. Les dépendances Expo ont été alignées sur les patchs SDK 57 recommandés; aucun écran mobile n'a changé. Les caches mobiles devront être partitionnés avant une UX de changement de tenant.

## 25. Performances

Résolution groupée par `$in`, `distinct`, populate filtré et agrégations commençant par le tenant; aucun N+1 utilisateur n'a été ajouté. Les index composites tenant/identité, tenant/règle et tenant/famille sont utilisés. Le Portfolio conserve une requête par source et déduplique en mémoire le petit dataset staff.

## 26. Tests réellement exécutés

| Gate fraîche | Résultat |
|---|---|
| Backend Unit complet | PASS — 105 suites, 1 217 tests, 87,992 s |
| Backend Mongo complet | PASS — 62 suites, 576 tests, 642,778 s |
| Tenant + Portfolio + Automation + Marketing ciblés | PASS — 4 suites, 53 tests, 93,616 s |
| Route Property ciblée | PASS — 1 suite, 33 tests |
| Web Vitest complet | PASS — 76 fichiers, 510 tests, 27,25 s |
| Mobile Jest complet | PASS — 24 suites, 227 tests, 15,168 s |
| TypeScript Mobile | PASS |
| ESLint serveur | PASS — 0 erreur (avertissements existants) |
| ESLint client | PASS — 0 erreur, 268 avertissements |
| ESLint mobile | PASS — 0 erreur, 82 avertissements |
| Next.js build | PASS — compilation 22,7 s, 142 pages |
| Expo Doctor | PASS — 20/20 |
| Export Android | PASS — 2 240 modules, bundle 6,6 MB, 54 assets |
| Playwright desktop | PASS — 17/17, 5,3 min après correction fixture |
| Playwright mobile | PASS — 17/17, 6,1 min |
| git diff --check | PASS — contrôle final après rapport |

Incident démontré : la première exécution desktop a fait 16/17 car la fixture sans tenant recevait correctement 403 sur Portfolio. Après ajout d'un PlatformTenant/OrgMembership de test, relance complète 17/17. Un lancement Unit mal échappé a été interrompu, puis la commande canonique a réussi. Le premier Expo Doctor a reproduit 19/20; après mise à niveau des sept patchs Expo, relance 20/20.

## 27. Dettes restantes

- Matrices adverses exhaustives Finance, Documents, Conversations, GL, Hotel, Accommodation et réservations.
- Couverture DELETE/EXPORT/AGGREGATE A→B pour chaque domaine historique.
- Propagation auditée de `platformTenantId` par tous les producteurs legacy.
- Application centralisée de tous les quotas de création déclarés.
- Sélecteur Web/Mobile et partition/invalidation des caches si le changement de tenant devient exposé.
- Identité Super Admin plateforme explicite si ce besoin est confirmé.
- `npm audit` mobile signale 23 vulnérabilités (8 modérées, 15 élevées); aucun `--force` risqué n'a été appliqué.

## 28. Fichiers créés

- `server/__tests__/propertyPortfolio.mongo.integration.test.js`
- `server/__tests__/tenantHardening.mongo.integration.test.js`
- `server/controllers/propertyPortfolioController.js`
- `server/docs/PROPERTY_PORTFOLIO_1_AUDIT.md`
- `server/docs/PROPERTY_PORTFOLIO_1_REPORT.md`
- `server/docs/TENANT_HARDENING_1_AUDIT.md`
- `server/docs/TENANT_HARDENING_1_REPORT.md`
- `server/scripts/tenantDataReconciliation.js`
- `server/services/platformTenant/tenantQuotaService.js`
- `server/services/propertyPortfolioService.js`

## 29. Fichiers modifiés

- Mobile : `altimmo-app/package.json`, `altimmo-app/package-lock.json`.
- Web : `ManagePropertiesPage.jsx`, `propertyService.js`.
- Tests : CRM Automation, ERP Core, Marketing Automation, API publique.
- Controllers : ActionLog, CRM, CRM Automation, Marketing, Property Portfolio, Public Webhook.
- Middlewares/routes : tenant context, API auth/error; ActionLog, CRM, Automation, Marketing, Property.
- Models : ActionLog, ApiKey, CRM (6), Marketing (4), Notification, WebhookSubscription.
- Services : ActionLog, CRM/Automation, Hotel, Marketing, Notification, tenant context/quota, API key/Webhook, Property Portfolio.
- Fixture : `server/scripts/start-accommodation-e2e.js`.

La liste exacte et autoritative reste `git status --short`; les changements PROPERTY-PORTFOLIO-1 préexistants sont volontairement conservés.

## 30. Confirmation

Aucun commit, push, déploiement, backfill réel, migration destructive, suppression de données réelles ou modification automatique de production n'a été effectué. Aucun `.env` de production n'a été modifié. Le script de réconciliation n'a été exécuté contre aucune base réelle.
