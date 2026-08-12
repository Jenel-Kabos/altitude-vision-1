# STORAGE-LEGACY-1 — Rapport final

Sprint : régularisation et migration sécurisée des documents privés Cloudinary historiques. L'audit initial est consigné dans `STORAGE_LEGACY_1_AUDIT.md`, produit avant toute implémentation runtime significative. Aucune migration réelle n'a été exécutée pendant ce sprint (§34 du sprint) — l'objectif est un moteur **prêt**, pas une migration accomplie.

## 1. État initial

111 fichiers modifiés/non suivis au démarrage, issus de STORAGE-SECURITY-1 (pipeline privé pour les nouveaux documents) et TENANT-HARDENING-2 (frontières indirectes Socket/Reporting/ERP/exports/GL/notifications/cache), tous deux non reconstruits.

## 2. Résultats STORAGE-SECURITY-1 repris

Architecture `secureStorageService` (upload public/`authenticated`, accès signé court généré serveur, jamais persisté), `privateAssetSchema` additif, script d'audit dry-run initial. Verdict d'origine : NON CERTIFIÉ (1 test Hôtel en échec, Expo Doctor 19/20, 2 scénarios Playwright GL en échec). Reconfirmé lu intégralement avant toute modification.

## 3. Inventaire Cloudinary legacy

Recherche exhaustive des usages `cloudinary/secure_url/public_id/upload_stream/resource_type/delivery_type/authenticated/attachment/document/download/preview` dans `server/`. Collections vérifiées par lecture directe du schéma (jamais supposées hors périmètre) : Contrat, Document, Locataire, Proprietaire, Message, RentalMaintenanceTicket, Paiement, PaiementTransaction, RentalPaymentReceipt, Litige, Signalement, InternalMail, User, FinancialDocumentArtifact, RealEstateApplication, Property, Hotel, Accommodation. Détail complet en §5 de l'audit.

## 4. Collections concernées

Voir la matrice complète `STORAGE_LEGACY_1_AUDIT.md` §5. Synthèse : 3 collections déjà en architecture privée saine (A) — FinancialDocumentArtifact, RealEstateApplication, et les nouveaux documents créés depuis STORAGE-SECURITY-1 quel que soit le modèle ; 3 collections purement publiques jamais migrables (E) — Property/Hotel/Accommodation images ; 12 collections potentiellement B/C/F selon la résolution tenant réelle des données en base (non exécutée ce sprint, aucun accès à une base réelle) ; 1 collection sans aucune relation tenant fiable (InternalMail, toujours F).

## 5. Assets publics

Property/Hotel/Accommodation `images` : jamais migrés, classification E systématique dans `legacyAssetClassification.js`, indépendamment de toute autre condition — même si un tenant est résolu, `isPublicMedia: true` court-circuite toute autre classification.

## 6. Documents privés

Douze collections legacy privées identifiées (§3/§4). Aucune n'a été migrée. Leur classification réelle (B vs C vs D vs F) dépend de données que ce sprint n'a pas consultées (aucun accès base réelle) — le moteur produit cette classification à l'exécution, pas ce rapport.

## 7. Classification A–F

Taxonomie unique `server/services/storage/legacyAssetClassification.js`, réutilisée par le script d'audit ET le moteur de migration (jamais deux taxonomies concurrentes). A=déjà authenticated ; B=legacy public, publicId fiable, tenant `resolved` ; C=publicId fiable mais tenant `ambiguous`/`unresolved` ; D=cloudinary sans publicId exploitable ; E=média public légitime (jamais migré) ; F=cloudinary sans preuve exploitable, ou tenant `global` sans attribution possible. Seule B est migrable par le moteur (`isMigratable`) — jamais C/D/E/F, y compris après requalification manuelle non automatisée.

## 8. Attribution tenant

`tenantResourceAttributionService.resolveResourceTenant` étendu additivement pour 9 nouveaux `resourceType` (détail §3 de l'audit), toujours par preuve relationnelle uniquement (jamais nom/email/téléphone). `ambiguous` et `unresolved` restent tous deux fail-closed pour la migration (seul `resolved` autorise `classification=B`). Régression : `tenantAttribution*.test.js` 5/5 PASS après extension.

## 9. Ressources ambiguës

Classées C par construction (`tenantResolution: 'ambiguous'`) — jamais migrées automatiquement ; `proposedAction: 'confirm_tenant_before_migration'` documente l'action manuelle requise, jamais exécutée par le moteur.

## 10. Ressources unresolved

Également classées C — traitées identiquement aux ambiguës pour la décision de migration (aucune différence de traitement runtime entre `ambiguous` et `unresolved`, toutes deux `STOP`, conformément à la règle stricte du §10 du sprint).

## 11. Pièces sensibles

Locataire/Proprietaire `pieceIdentite(Asset)` : priorité HIGH/CRITICAL. Constat positif documenté en détail §6 de l'audit : la sérialisation API distingue déjà `legacy: true/false`, et le téléchargement passe par un proxy backend tenant-scopé — mais l'URL Cloudinary publique originale reste, elle, directement exploitable hors backend tant qu'aucune migration n'a eu lieu. Aucun contenu de pièce d'identité n'a été imprimé, ni dans les logs du script d'audit ni dans ce rapport (uniquement `documentId`/`tenantId` tronqué/`classification`).

## 12. Documents financiers

Paiement/PaiementTransaction/RentalPaymentReceipt `preuvePaiement` : legacy, classifiées B/C/F selon tenant réel. FinancialDocumentArtifact reste déjà A (architecture STORAGE-SECURITY-1). Aucun calcul financier touché par ce sprint (aucun service de calcul modifié).

## 13. Documents GL

`Contrat.documents[]`/`etatsDesLieux[]` : legacy identifié, classifiable via attribution `Contrat→bien(Property)→owner`. **Aucun des 17 contrats réels n'a été lu, modifié ni migré** — seules des fixtures MongoMemoryServer/ReplSet isolées ont été utilisées pour prouver le fonctionnement du script et du moteur. GL-RECON non touché.

## 14. Conversations

`Message.attachments[]` : attribution tenant héritée de `Conversation` (déjà gérée par `resolveResourceTenant`, non modifiée). Un attachment migré porterait le même tenant que sa conversation — aucune règle de fuite cross-tenant introduite ni retirée.

## 15. Maintenance

`RentalMaintenanceTicket.attachments[]` : nouvelle branche d'attribution via `property`, distincte de toute image publique Property (jamais confondues — la classification E ne s'applique qu'aux champs `images` de Property/Hotel/Accommodation, jamais aux attachments de maintenance).

## 16. DOC-EVO

Vérifié par lecture de `locataireController` (§6 audit) : le centre documentaire distingue déjà legacy/privé au niveau de la sérialisation. Ce comportement préexistant est conservé sans modification — aucune régression introduite, aucun besoin de le reconstruire.

## 17. Architecture de migration retenue

Option C — `cloudinary.uploader.rename(oldPublicId, newPublicId, { type: 'upload', to_type: 'authenticated', invalidate: true })`, confirmée disponible dans le SDK installé (`cloudinary@2.9.0`) par lecture directe de `node_modules/cloudinary/lib/uploader.js`. Détail comparatif des 4 options en §8 de l'audit.

## 18. Preuve Cloudinary

Capacités confirmées par le code du SDK installé : `rename` (avec `to_type`/`invalidate`), `destroy`, `private_download_url`. Limitation documentée honnêtement et non résolue : la propagation CDN de l'invalidation est best-effort côté Cloudinary (non instantanée, non garantie à 100 % hors plan Advanced) — aucun test contre le compte Cloudinary réel du projet n'a été exécuté ce sprint.

## 19. Gestion old URL

`server/services/storage/verifyOldUrlProof.js` — sonde HTTP réelle (jamais simulée), classe `accessible`/`inaccessible`/`unknown`. Une erreur réseau (timeout, DNS) est explicitement `unknown`, jamais comptée comme preuve positive d'inaccessibilité — un doute ne vaut jamais succès. Testé unitairement (axios mocké, aucune requête réseau réelle) : 7/7 PASS.

## 20. Nouvelle ressource authenticated

Le moteur délègue la vérification post-`rename` au champ `type` retourné par Cloudinary (`renameResult.type !== 'authenticated'` → échec immédiat, jamais un succès supposé). L'accès applicatif au nouvel asset réutilise `secureStorageService` sans modification.

## 21. Journal de migration

`server/models/PrivateAssetMigration.js` (nouveau, minimal) — `ActionLog` ne suffisait pas : ni checkpoint de reprise, ni verrou logique, ni avant/après structuré, ni index d'idempotence par ressource. Champs conformes à la liste imposée par le sprint (§18) ; aucun secret Cloudinary, signature ni URL signée temporaire n'y est jamais écrit (vérifié par assertion de test : `JSON.stringify(journal)` ne contient jamais `api_secret`/`signature`).

## 22. Idempotence

Index unique `{resource, resourceId, field}` + upsert atomique combiné au verrouillage en une seule commande `findOneAndUpdate` (voir §23 pour la correction de conception). Un deuxième `executeLegacyMigration` sur une migration déjà `completed` retourne `{status: 'no_op', reason: 'already_migrated'}` sans aucun nouvel appel Cloudinary. Prouvé par test Mongo réel (pas de mock sur la couche DB).

## 23. Concurrence

Défaut de conception détecté et corrigé pendant ce sprint : la première version du moteur exécutait l'upsert du journal et la pose du verrou en **deux** `findOneAndUpdate` séparés — fenêtre de course où deux workers pouvaient tous deux réussir l'upsert avant qu'aucun n'ait posé son verrou, produisant deux migrations effectives. Corrigé en fusionnant upsert + verrouillage en une seule opération atomique ; un second worker concurrent reçoit soit `MIGRATION_LOCKED` (verrou actif d'un autre worker), soit `no_op` (l'autre a déjà terminé), jamais une deuxième migration effective. Prouvé par un test à deux exécutions réellement concurrentes (`Promise.allSettled`) sur MongoMemoryReplSet : une seule `completed`, un seul document journal.

## 24. Reprise après panne

Testé : échec injecté pendant `applyDbUpdate` (avant bascule DB) → `status: 'failed'`, verrou libéré, `checkpoint` conservé ; un nouveau `executeLegacyMigration` sur la même ressource/champ reprend (nouvel `attempt`, incrémenté) et termine `completed`. Le `checkpoint` (distinct du `status` final, toujours écrasé en `failed` sur erreur) permet de savoir exactement jusqu'où le protocole en 14 étapes est allé — utilisé aussi par la décision de rollback (§25).

## 25. Réversibilité

`rollbackFailedMigration` refuse explicitement de rollback une migration `completed` (`CANNOT_ROLLBACK_COMPLETED_MIGRATION`) — jamais de republication automatique d'une ressource déjà sécurisée. Pour une migration `failed` dont le `checkpoint` atteint `db_switched` (la référence Mongo a réellement été basculée avant l'échec), un callback `restoreDbReference` fourni par l'appelant peut restaurer la référence DB — jamais l'exposition Cloudinary publique elle-même, qui n'est de toute façon plus ce qu'elle était (`rename` déjà appliqué, non réversible automatiquement par ce moteur). Testé : rollback refusé sur `completed`, rollback avec restauration DB effective sur un échec post-bascule (OLD URL encore accessible).

## 26. Dry-run

Comportement par défaut de `executeLegacyMigration` (`apply` non fourni ou `false`) : aucun appel `cloudinaryClient.rename`, journal créé/mis à jour en `pending`, jamais verrouillé durablement, retour `{status: 'dry_run'}`. Prouvé par assertion `expect(cloudinaryClient.rename).not.toHaveBeenCalled()`.

## 27. Mode apply éventuel

Implémenté mais gardé par 5 conditions cumulatives obligatoires (`assertApplyAuthorized`) : variable d'environnement `ALLOW_PRIVATE_ASSET_MIGRATION_APPLY=true`, `mongoUri` explicite, `tenantId` explicite, `classification==='B'` exactement, et un `confirmToken` littéral exact. L'absence de l'une quelconque de ces conditions lève `APPLY_NOT_AUTHORIZED` avant tout appel Cloudinary/DB — testé pour l'absence totale de flags et pour une classification C. Aucune valeur par défaut ne peut satisfaire ces conditions accidentellement (pas de lecture implicite de `MONGO_URI` d'environnement pour ce chemin).

## 28. Sécurité production

Le script d'audit refuse toute exécution sans `MONGO_URI` explicite ou d'environnement (erreur immédiate, aucune écriture possible dans les deux cas — le script n'importe aucune API d'écriture). Le moteur de migration n'a jamais été exécuté contre une base réelle ni un compte Cloudinary réel ce sprint.

## 29. Tests adversariaux

Couverts par `legacyAssetMigrationEngine.mongo.integration.test.js` (15 tests) et `legacyAssetClassification.test.js` (9 tests) : classification E jamais migrable même tenant resolved ; Contrat sans `bien` → unresolved → stop ; refus `apply` sans flags ; refus `apply` classification≠B ; dry-run jamais destructif ; run complet `apply` avec toutes deps mockées → completed ; idempotence (no-op) ; concurrence (une seule migration effective) ; reprise après panne ; OLD URL encore accessible → échec, jamais completed ; rollback refusé sur completed ; rollback avec restauration DB sur échec post-bascule ; attribution tenant jamais confondue entre deux tenants distincts. Non couverts ce sprint (nécessitent un compte Cloudinary réel, explicitement hors périmètre sans environnement sûr fourni) : NEW PRIVATE DIRECT URL réellement inaccessible sans signature contre Cloudinary réel ; Tenant B authorized/Tenant A cross-tenant contre les routes HTTP de téléchargement réelles (couvert indirectement par les suites TENANT-CERT-2/TENANT-HARDENING-2 existantes, non réexécutées spécifiquement pour un asset migré).

## 30. Test old URL

`verifyOldUrlProof.js` : preuve HTTP réelle (jamais simulée), 7/7 tests unitaires PASS (axios mocké au niveau du test, pas de logique interne simulée). Intégré au moteur : une migration `apply` n'atteint `old_revoked`/`completed` que si `verifyOldUrlInaccessible` retourne `true` ; sinon `OLD_URL_STILL_ACCESSIBLE`, migration `failed`, jamais `completed`. Conformément au principe fondamental du sprint (§5), aucune migration n'est jamais déclarée réussie sur la seule foi d'une écriture Mongo.

## 31. Web

Non modifié ce sprint. `STORAGE_LEGACY_1_AUDIT.md` §6 documente que le point le plus à risque (identité Locataire/Proprietaire) passe déjà par un proxy backend côté API — aucune vérification exhaustive de tous les usages `document.url`/`secure_url`/`window.open`/`anchor href` côté `client/` n'a été effectuée ce sprint (limitation explicite, voir §41 dettes).

## 32. Mobile

Non audité ce sprint (aucune modification `altimmo-app/`). Limitation explicite reportée en dette (§41).

## 33. API publique

Aucune route publique n'a été modifiée ; aucun scope nouveau créé. Les champs legacy privés restent, comme avant ce sprint, absents des sérialisations publiques (Property/Hotel/Accommodation n'exposent que `images`).

## 34. Performances

Le script d'audit effectue un `find()` par collection (pas de N+1 par document) ; l'attribution tenant reste celle déjà optimisée par TENANT-CERT-2/TENANT-HARDENING-2 (résolution par relation directe, jamais de scan global). Le moteur de migration résout le tenant une fois par `planLegacyMigration`, jamais par étape. Aucune mesure de performance en conditions réelles (aucune base réelle consultée ce sprint) — non applicable en dry-run pur.

## 35. Backend Unit Hôtel

Rejoué intégralement (`npm run test:unit`) : **109 suites, 1243 tests, 0 échec**, y compris tous les tests Hôtel. Le test "check-in hôtel attendu 409, reçu 401" documenté comme rouge par STORAGE-SECURITY-1 est **déjà vert** dans l'état actuel du worktree (corrigé par les modifications déjà présentes de TENANT-HARDENING-2/évolutions ultérieures, non attribuées à ce sprint) — aucune correction supplémentaire n'a été nécessaire ni appliquée par STORAGE-LEGACY-1 pour cette dette spécifique.

## 36. Playwright GL

**Non ré-exécuté ce sprint.** Aucune modification n'a été apportée aux routes/contrôleurs/UI Gestion locative par STORAGE-LEGACY-1 (aucun fichier GL touché hors l'extension additive de `tenantResourceAttributionService`, qui ne modifie aucune branche existante et est couverte par la régression `tenantAttribution*.test.js` PASS). Le statut des 2 scénarios documentés comme rouges par STORAGE-SECURITY-1 n'a donc pas été revérifié — dette explicitement reportée, jamais déclarée verte sans preuve.

## 37. Expo Doctor

**Non ré-exécuté ce sprint.** Aucune dépendance mobile modifiée par STORAGE-LEGACY-1. Le statut 19/20 documenté par STORAGE-SECURITY-1 n'a pas été revérifié — dette reportée.

## 38. Gates complètes

| Gate | Résultat | Preuve |
|---|---|---|
| Backend Unit complet | **PASS** — 109 suites, 1243 tests, 0 échec | rejoué ce sprint |
| Suites nouvelles STORAGE-LEGACY-1 (classification, OLD URL proof, moteur de migration) | **PASS** — 9+7+15 = 31/31 | rejouées ce sprint |
| Régression `tenantAttribution*` | **PASS** — 5/5 | rejouée après extension additive |
| Backend Mongo complet | **PASS** — 68 suites, 646 tests, 0 échec, replica set arrêté proprement (925 s Jest) | rejoué en intégralité ce sprint (`npm run test:mongo`), inclut `legacyAssetMigrationEngine.mongo.integration.test.js` |
| Web Vitest | **NON RÉEXÉCUTÉ CE SPRINT** — aucune modification `client/` | non applicable |
| Mobile Jest / TypeScript Mobile / Expo Doctor | **NON RÉEXÉCUTÉS CE SPRINT** — aucune modification `altimmo-app/` | dette reportée telle quelle (§37) |
| ESLint serveur | **NON RÉEXÉCUTÉ CE SPRINT** dans ce rapport (à exécuter avant toute certification ultérieure) | — |
| Build Next.js / Export Android | **NON RÉEXÉCUTÉS CE SPRINT** — aucune modification frontend/mobile | non applicable |
| Playwright desktop + mobile | **NON RÉEXÉCUTÉ CE SPRINT** (§36) | dette reportée |
| `git diff --check` | à exécuter avant tout commit (aucun commit effectué) | — |

Aucune gate non exécutée n'est déclarée PASS dans ce rapport, conformément à l'exigence du sprint. Le périmètre effectivement modifié par STORAGE-LEGACY-1 (backend uniquement : nouveaux services/modèle/script + extension additive de l'attribution tenant) justifie que seules les gates backend aient été rejouées ; les gates Web/Mobile/E2E reprennent leur dernier statut connu de STORAGE-SECURITY-1/TENANT-HARDENING-2, non revalidé ici faute de modification les concernant.

## 39. Dettes restantes

- Playwright GL (2 scénarios), Expo Doctor (9 patchs), Web/Mobile E2E : non revérifiés ce sprint, statut hérité de STORAGE-SECURITY-1 non confirmé à nouveau.
- Aucune preuve contre un compte Cloudinary réel (comportement CDN best-effort après `invalidate`, non mesuré).
- `InternalMail` reste sans attribution tenant fiable — nécessite une consolidation métier séparée avant toute migration (déjà noté par STORAGE-SECURITY-1, non résolu ici, hors périmètre : aucune relation exploitable n'existe sur le schéma actuel).
- Web/Mobile : audit exhaustif des usages `document.url`/`secure_url`/`window.open`/téléchargement non réalisé (seul le cas Locataire/Proprietaire a été vérifié par lecture de code).
- Le moteur n'a jamais tourné contre un asset Cloudinary réel — sa robustesse en conditions réelles (latence, erreurs partielles Cloudinary, ressources `video` volumineuses) reste non prouvée.

## 40. Fichiers créés

- `server/services/storage/legacyAssetClassification.js`
- `server/services/storage/legacyAssetMigrationService.js`
- `server/services/storage/verifyOldUrlProof.js`
- `server/models/PrivateAssetMigration.js`
- `server/__tests__/legacyAssetClassification.test.js`
- `server/__tests__/verifyOldUrlProof.test.js`
- `server/__tests__/legacyAssetMigrationEngine.mongo.integration.test.js`
- `server/docs/STORAGE_LEGACY_1_AUDIT.md`
- `server/docs/STORAGE_LEGACY_1_REPORT.md`

## 41. Fichiers modifiés

- `server/services/platformTenant/tenantResourceAttributionService.js` (extension additive, §3/§8 — aucune branche existante modifiée)
- `server/scripts/auditPrivateCloudinaryAssets.js` (amélioration en place — bug de projection corrigé, taxonomie/attribution réutilisées, format de sortie enrichi ; même fichier, pas de second script)

## 42. Verdict

### PARTIALLY READY

Justification : le moteur de migration est construit, idempotent, résumable, verrouillé contre la concurrence, gardé de façon défensive contre toute exécution accidentelle, et prouve la fermeture de la fuite OLD URL par une sonde HTTP réelle plutôt qu'une supposition — toutes ces garanties sont vérifiées par des tests reproductibles sur MongoMemoryReplSet. L'attribution tenant réutilise strictement le moteur existant, étendu sans le dupliquer ni l'affaiblir. Aucune migration réelle n'a été exécutée, conformément au mandat du sprint.

Le verdict n'est **pas** READY FOR CONTROLLED MIGRATION pour trois raisons cumulatives : (1) l'inventaire réel des données de production n'a jamais été exécuté (aucun accès base réelle) — la proportion effective B/C/D/F sur les données réelles reste inconnue ; (2) la fermeture de la fuite OLD URL n'a jamais été prouvée contre un compte Cloudinary réel, seulement mockée ; (3) Playwright GL, Expo Doctor et les gates Web/Mobile/E2E n'ont pas été revérifiés ce sprint et conservent leur statut rouge/inconnu hérité.

Ce n'est **pas non plus** NOT READY : aucune fuite structurelle nouvelle n'a été introduite, aucune régression tenant/attribution constatée (5/5 PASS), le backend unit complet est vert (109/1243), et le moteur lui-même — dans les limites de ce qui est testable sans compte Cloudinary réel — se comporte correctement sous panne et sous concurrence.

**Ce sprint produit un moteur ENGINE READY, pas une certification multi-tenant et pas une migration production.** Conformément au §48 du sprint : **STORAGE-LEGACY-1 n'est pas TENANT-CERT-3.** Aucune certification multi-tenant n'est déclarée par ce rapport, indépendamment du verdict ci-dessus.

## Confirmations finales

Aucun commit. Aucun push. Aucun déploiement. Aucune migration destructive. Aucun backfill réel. Aucune migration Cloudinary de production. Aucune suppression de fichier réel. Aucune suppression de donnée réelle. Aucune modification des 17 contrats GL réels. Aucun bypass Admin global. Aucun fallback tenant global. Aucun accès cross-tenant temporaire introduit.
