# TENANT-CERT-1 — Rapport final

## Verdict final

**TENANT-CERT-1 NON CERTIFIÉ.**

La question « Tenant A peut-il agir sur Tenant B par une route critique ? » reçoit actuellement **oui** sur Documents, Conversations et Finance/Hôtel pour un acteur Admin. Le verdict CERTIFIÉ est donc interdit.

## 1–4. Surface, routes, collections et matrice

L'audit détaillé est dans `TENANT_CERT_1_AUDIT.md`. Collections caractérisées : PlatformTenant, OrgUnit, OrgMembership, Document, Conversation, Message, Hotel. Les autres collections demandées ont été cartographiées par leurs routes/guards mais ne disposent pas toutes d'une fixture tenant adverse complète; cela suffit aussi à interdire la certification.

| Opération | A→A | A→B |
|---|---:|---:|
| Property Portfolio READ/LIST | autorisé | invisible |
| Document READ/LIST | autorisé | **autorisé — fuite** |
| Conversation READ par staff | autorisé | **autorisé — fuite** |
| Finance Hotel scope par Admin | autorisé | **autorisé — fuite** |
| CRM/Marketing/Automation | autorisé | refusé/invisible |
| API publique/Webhook | autorisé selon clé | refusé/invisible |

## 5–6. Fuites et corrections

Fuites documentées ci-dessus. Aucune correction applicative risquée n'a été appliquée : les collections concernées n'ont pas toutes une attribution tenant canonique et le brief interdit d'inventer un tenant ou d'effectuer un backfill réel. Le correctif exige une décision d'attribution legacy, puis des guards communs fondés sur cette preuve.

## 7–12. Domaines critiques

- Finance : guards objet hors Admin, bypass Admin global non conforme.
- Documents : CRUD global après authentification; non conforme.
- Conversations : participant protégé pour clients, mais staff global; non conforme.
- GL : ownership partiel, routes staff sans contexte tenant; non certifié.
- Hôtel : capacités/assignments robustes hors Admin, Admin global; non conforme.
- Accommodation : ownership propriétaire robuste, actions/listes staff non tenant-scopées; non certifié.

## 13–19. Search, export et chaînes transverses

Search/export Documents et dashboards Finance ne sont pas tenant-scopés de manière démontrable. User AB, fail-closed de résolution, API publique, Automation et Webhooks disposent de preuves antérieures, mais elles ne compensent pas les fuites critiques restantes.

## 20. Performances

Aucune requête ni index de production n'a été ajouté. La future correction devra privilégier tenant direct indexé lorsque la preuve existe et dérivation groupée `$in` pour le legacy, sans N+1.

## 21. Tests réellement exécutés

| Gate fraîche | Résultat |
|---|---|
| TENANT-CERT caractérisation Mongo | PASS — 1 suite, 3 preuves de fuite, 17,092 s |
| Backend Unit complet | **FAIL — 104/105 suites, 1 216/1 217 tests**; scénario Hôtel tiers attendu 403, reçu 200 |
| Test Hôtel fautif relancé seul | PASS — 35/35, 5,513 s; pollution de mocks/order-dependence probable, gate complète non requalifiée |
| Backend Mongo complet | PASS — 63 suites, 582 tests, 656,424 s |
| Web Vitest complet | PASS — 76 fichiers, 510 tests, 32,87 s |
| Mobile validate | PASS — syntaxe 156 fichiers, ESLint 0 erreur/82 avertissements, TypeScript, Jest 24 suites/227 tests |
| ESLint serveur | PASS — 0 erreur, 124 avertissements |
| ESLint client | PASS — 0 erreur, 268 avertissements |
| Expo Doctor | PASS — 20/20 après relance réseau autorisée |
| Next.js build | PASS — 142 pages, compilation 21,0 s |
| Export Android | PASS — 2 240 modules, 54 assets, bundle 6,6 MB |
| Playwright desktop complet | **FAIL — 16/17**, centre opérationnel Hôtel non visible |
| Scénario desktop fautif relancé seul | PASS — 1/1, 1,3 min; gate complète non requalifiée |
| Playwright mobile complet | PASS — 17/17, 5,7 min |
| git diff --check | PASS — contrôle final |

L'absence initiale de réseau a fait échouer le téléchargement `expo-doctor`; la relance avec accès réseau a passé 20/20. Aucun résultat échoué n'est présenté comme PASS du seul fait qu'une relance isolée a réussi.

## 22–23. Risques et dettes

- fuite inter-tenant Admin sur Documents, Conversations et Finance/Hôtel;
- collections legacy sans tenant canonique;
- listes, recherches, exports et dashboards staff globalisés;
- absence d'identité Super Admin plateforme distincte;
- matrice adverse complète GL/Accommodation restant à construire après décision d'attribution.

## 24–25. Fichiers

Créés :

- `server/__tests__/tenantCert.audit.mongo.integration.test.js`;
- `server/docs/TENANT_CERT_1_AUDIT.md`;
- `server/docs/TENANT_CERT_1_REPORT.md`.

Aucun fichier métier n'a été modifié par TENANT-CERT-1; les fichiers TENANT-CONTEXT-1 non commités ont été préservés.

## 26. Confirmation

Aucun commit, push, déploiement, migration destructive, suppression de données réelles, backfill réel ou écriture production n'a été effectué.
