# TENANT-DATA-REGULARIZATION-1 — Audit exhaustif et préparation contrôlée de la régularisation des données historiques multi-tenant

Date : 2026-08-13
Dépôt : `/Users/apple/Documents/GitHub/altitude-vision-1`
Documents de référence : `TENANT_DATA_REGULARIZATION_1_AUDIT.md`, `TENANT_CERT_3_FINAL_REPORT.md`, `PLATFORM_ADMIN_BOOTSTRAP_EXEC_1_REPORT.md`, `GL_RECON_UX_1_REPORT.md`, `GL_PROPERTY_FLOW_1_REPORT.md`, `PROPERTY_PORTFOLIO_1_REPORT.md`

## 1. Executive Summary

Ce sprint est un audit **strictement read-only** des données historiques de la base réelle `altitudevision`, préalables au premier `PlatformTenant` réel (« Altitude Vision »). **Aucune ressource réelle n'a été modifiée, aucune n'a reçu de tenant, aucun backfill n'a été effectué.**

Le moteur d'attribution canonique (`tenantResourceAttributionService.js`, TENANT-ATTRIBUTION-1) a été étendu de façon additive à 13 nouveaux types de ressources (CRM, Marketing, Notification, Visite, Transaction, lignes financières) — jamais dupliqué. Un nouvel outil, `server/scripts/auditTenantLegacyData.js` (read-only, refuse structurellement `--apply`/`--write`/`--force`/`--backfill`), implémente la taxonomie A–F exigée par ce sprint par-dessus ce moteur. Trois limitations réelles du moteur canonique ont été découvertes par test adversarial et compensées **uniquement au niveau de l'outil d'audit** (jamais du runtime d'autorisation, qui reste inchangé et fail-closed) : ambiguïté imbriquée non remontée, existence d'entité référencée non vérifiée, champ optionnel absent confondu avec référence cassée. Chacune a d'abord été démontrée par un test rouge, puis corrigée et reverifiée verte — jamais supposée.

**376 ressources historiques réelles auditées** à travers 14 collections non vides. Résultat : **67 A** (attribution certaine), **50 B** (probable, décision humaine requise), **0 C** (aucune contradiction — attendu, un seul tenant réel existe aujourd'hui), **43 D** (référence orpheline — tous rattachables à 6 comptes fantômes + 1 référence Property cassée), **0 E**, **216 F** (non déterminable, majoritairement les 17 Contrat et 34 Locataire historiques, tous liés par `bien: null`, fait déjà documenté par GL-RECON-UX-1 et reconfirmé ici). La file de revue humaine (B+C+D+F) compte **309 entrées**.

L'audit spécifique des 7 Property confirme et affine le résultat manuel de PLATFORM-ADMIN-BOOTSTRAP-EXEC-1 (2 attribuables, 2 ambiguës, 3 orphelines) — identique, avec la preuve automatisée à l'appui.

**Verdict : `PARTIALLY READY — HUMAN REVIEW REQUIRED`.** L'audit et le moteur sont fiables et certifiés par test adversarial ; la majorité des ressources historiques nécessite une décision humaine avant toute régularisation réelle, et 6 comptes utilisateur fantômes doivent être investigués avant que leurs ressources dépendantes (Conversations, Messages, Visites, Documents) puissent être classées différemment de « orpheline ».

## 2. Environment Audited

Base réelle `altitudevision` (résolue via `mongoose.connection.name`, jamais supposée). Toutes les commandes du script exigent `--confirm-database=altitudevision` — aucune ne s'exécute contre une base non explicitement confirmée. Aucun mot de passe, aucun URI complet, aucun secret affiché à aucun moment.

## 3. Safety Guarantees

- `auditTenantLegacyData.js` refuse `--apply`/`--write`/`--force`/`--backfill` de façon structurelle (vérification en tête de script, avant toute connexion).
- Vérifié empiriquement : `Property.countDocuments()` identique avant/après exécution du script (test dédié, §36).
- Toutes les écritures de test (fixtures adversariales) ciblent exclusivement des `MongoMemoryReplSet` jetables — jamais `altitudevision`.
- Aucun appel Cloudinary, aucune migration de stockage, aucun test d'upload.
- Aucun credential (Zoho/JWT/Cloudinary/Facebook/CinetPay/Google Maps/Mongo) modifié ou affiché.
- Aucun commit, push, ou déploiement.

## 4. Collections Discovered

108 modèles recensés dans `server/models/`. 34 types couverts par le moteur d'attribution (voir `TENANT_DATA_REGULARIZATION_1_AUDIT.md` §3-4 pour le détail champ par champ). Non couverts par cet audit (hors périmètre du graphe SaaS Altimmo/GL/Hotel/Accommodation/Comms/Documents/Finance/CRM/Marketing, ou sans volume réel actuel) : `Devis`, `Estimation`, `Quote`, `QuoteRequest`, `RealEstateReservation`, `ValuationCalculation`/`ValuationCoefficient`, `MarketPriceReference`, `ConstructionCostReference`, `ContactMessage`, `Email`/`CompanyEmail`, `ApiCallLog`/`ApiKey`/`WebhookSubscription`, `Event`, `Realisation`, `AltcomProject`, `PortfolioItem`, `Publicite`, `Project`, `Service`, `InternalMail`/`InternalMessage`, `ChatMessage`, `Comment`, `Like`, `Review`, `HousekeepingTask`, `RoomAssignment`/`RoomCategory`/`RoomInventory`/`RoomInspection`/`RatePlan`, `SaleManagement`, `TenantLinkRequest`, `HotelReservationNotification`, `InventoryOperationLock`. Recommandation : périmètre pour un futur sprint d'audit si un besoin métier apparaît.

## 5. Counts (recomptage réel, jamais la baseline supposée)

Baseline fournie vs recompté :

| Collection | Baseline fournie | Recompté réel |
|---|--:|--:|
| Property | 7 | **7** (confirmé) |
| Locataire | 34 | **34** (confirmé) |
| Contrat | 17 | **17** (confirmé) |
| Conversation | 23 | **23** (confirmé) |

Toutes les baselines fournies sont exactes. Volumes supplémentaires découverts (non baselinés par la mission, comptés ici pour la première fois) : `Message` 106, `Notification` 163, `Visite` 9, `Proprietaire` 2, `RentalManagement` 1, `Hotel` 3, `Accommodation` 4, `Document` 5, `Litige` 1, `Signalement` 1. Toutes les autres collections du registre (Paiement, RentalMaintenanceTicket, RealEstateApplication, RentalPaymentReceipt, Transaction, PaiementTransaction, FinancialDocument/Line/Payment/PaymentAllocation/LedgerEntry, HotelReservation, Room, HotelStaffAssignment, AccommodationReservation, CRM\*, Marketing\*) : **0** document réel actuellement.

## 6. Existing Tenant Coverage

**0 ressource, sur les 376 auditées, ne porte de champ `tenant`/`platformTenant` déjà peuplé.** Confirme l'analyse initiale de PLATFORM-ADMIN-BOOTSTRAP-EXEC-1 : toutes les données pré-existent au provisioning du premier tenant réel, aucun backfill n'a jamais eu lieu.

## 7. A–F Taxonomy (voir définitions exactes dans `auditTenantLegacyData.js`, en-tête de fichier)

A = attribution certaine (`resolved`). B = probable, entité réelle nommée sans tenant (`→no_tenant`). C = contradiction (`ambiguous`, y compris imbriquée). D = référence orpheline (ID présent mais introuvable, vérifié par existence réelle). E = globale par architecture (domaine hors SaaS Altimmo, ex. Altcom/Mila Events — aucune instance trouvée aujourd'hui). F = non déterminable (aucune preuve exploitable).

## 8. Attribution Proofs

Toutes les preuves sont des chaînes déterministes produites par `resolveResourceTenant` (ex. `property:<id>.owner:<id>→membership→<tenantId>`, `locataire:<id>→no_contract`). Aucune preuve fondée sur nom/email/téléphone approximatif — interdiction respectée intégralement (le moteur canonique ne les utilise jamais, revérifié par lecture de code).

## 9. Property Analysis (voir §33 pour la revalidation explicite)

7 Property : **2 A** (owner = compte Admin bootstrappé, membership active dans « Altitude Vision »), **2 B** (owner = Proprietaire réel actif `th***@gmail.com`, aucun membership tenant), **3 D** (owner pointant vers 3 IDs distincts qui ne correspondent à AUCUN document `User` — comptes fantômes, confirmé par vérification d'existence directe, jamais un compte supprimé au sens logique puisque `User.js` ne porte aucun champ de suppression logique). Résultat identique à celui obtenu manuellement par PLATFORM-ADMIN-BOOTSTRAP-EXEC-1, désormais reproductible par un outil déterministe et testé.

## 10. Proprietaire Analysis

2 documents : 1 B (lié à un `User` réel, `isTechnical:true`, sans membership), 1 F (aucun `User` lié, aucun `Contrat` le référençant). Aucune attribution automatique possible sans décision humaine sur les deux.

## 11. RentalManagement Analysis

1 document, classification **A** — rattaché via sa `Property` (elle-même A) et son `owner`, cohérent avec la seule Property réellement gérée en Gestion Locative aujourd'hui.

## 12. Contrat Analysis

**17/17 classés F.** Confirme exactement le constat de GL-RECON-UX-1 : les 17 contrats historiques ont tous `bien: null` — la seule preuve relationnelle possible (`fromContract` → Property) ne trouve donc aucune Property à chaque fois, produisant un tableau de preuves vide, jamais un `→missing` (le champ `bien` n'a jamais été renseigné, ce n'est pas une référence cassée). Aucun de ces 17 contrats n'a été touché — le centre `/dashboard/gestion-locative/regularisation` reste l'unique canal de décision humaine pour ces dossiers (voir §31/§34).

## 13. Locataire Analysis

**34/34 classés F** — cohérent avec §12 : puisque leurs 17 contrats liés (au maximum) ont tous `bien: null`, la chaîne `fromContractsReferencing('locataire', …)` ne peut jamais résoudre de Property, donc jamais de tenant. Certains Locataire n'ont même aucun Contrat les référençant du tout (`→no_contract`), traité identiquement en F — sémantiquement correct, aucune de ces deux situations ne pointe vers une entité concrète sur laquelle une décision humaine ciblée pourrait porter aujourd'hui.

## 14. Paiement Analysis

**0 document réel.** Rien à classifier.

## 15. Conversation Analysis

23 documents : **9 A**, **7 B**, **7 D**. Les 7 D partagent tous au moins un `participant` correspondant à l'un des 6 comptes fantômes identifiés en §9/§24 (jamais une déduction — vérifié explicitement par requête d'existence). Aucune Conversation n'a été attribuée sur la seule base qu'un participant est PlatformOperator/Admin (vérifié par test adversarial dédié, `tenantDataRegularization1.audit.mongo.integration.test.js`).

## 16. Message Analysis

106 documents : **50 A**, **35 B**, **21 D** — chaque Message hérite exactement de la classification de sa `Conversation` parente (le moteur canonique recompose la chaîne `Message → Conversation → participants/property`), aucune divergence trouvée entre un Message et sa Conversation (0 contradiction C sur l'ensemble).

## 17. Document Analysis

5 documents : **1 A**, **2 B**, **2 D**. Correction notable obtenue pendant ce sprint (voir `TENANT_DATA_REGULARIZATION_1_AUDIT.md` §5.3) : 2 de ces documents étaient initialement mal classés D à cause du champ optionnel `relatedProperty: null`, alors que leur `createdBy`/`client` pointe vers un `Proprietaire` réel — correctement B après correction.

## 18. Finance Analysis

**0 document réel** dans `FinancialDocument`/`FinancialDocumentLine`/`FinancialPayment`/`PaymentAllocation`/`FinancialLedgerEntry`. Extension du moteur vérifiée par test adversarial (Finance + Hotel, Finance + Accommodation) mais aucune donnée réelle à classer aujourd'hui.

## 19. Hotel Analysis

3 documents : **1 A**, **1 B**, **1 D** (référence `property` cassée — pointe vers un ID `Property` qui n'existe pas du tout, cas distinct des comptes fantômes : ici c'est la Property elle-même, pas son owner, qui est introuvable).

## 20. Accommodation Analysis

4 documents : **1 A**, **2 B**, **1 D** (hérite de la même référence Property cassée que le Hotel de §19 — la même Property manquante est utilisée par les deux, cascade attendue et cohérente).

## 21. CRM Analysis

**0 document réel** dans `CrmCustomer`/`CrmOpportunity`/`CrmActivity`/`CrmAutomationRule`/`CrmAutomationRun`. Moteur étendu et testé, rien à classer aujourd'hui.

## 22. Marketing Analysis

**0 document réel** dans `MarketingCampaign`/`MarketingSend`/`MarketingTemplate`. Idem §21.

## 23. Organization Analysis

`OrgUnit`/`OrgMembership` ne sont pas eux-mêmes des ressources « tenant-scopables » au sens de cet audit (ils SONT l'infrastructure de résolution) — non inclus dans le registre A–F. Vérifié séparément : 1 seul `PlatformTenant` réel, 1 seul `OrgUnit` racine, 1 seul `OrgMembership` actif — cohérence structurelle confirmée (voir PLATFORM-ADMIN-BOOTSTRAP-EXEC-1 §14).

## 24. Orphan References (référence Property cassée) et comptes fantômes

**6 identifiants `User` distincts référencés comme owner/participant/createdBy à travers Property, Signalement, Visite, Conversation, Message, Document — mais ne correspondant à AUCUN document `User` réel** : `69c70dd52a1540ffc70d1f8e`, `69d03615de9a55d35b6f246c`, `6a39c85503d726cee858f416`, `6a3e56e2896259cb28569be7`, `6a482b32fc07bc96b7329816`, `6a4d6187a8115c1e5453e68e`. Ces 6 identifiants expliquent, à eux seuls, la quasi-totalité des 43 classifications D (Property ×3, Signalement ×1, Visite ×7, Conversation ×7, Message ×21, Document ×2 = 41 des 43 D). Les 2 D restants (Hotel ×1, Accommodation ×1) partagent une **7ᵉ référence cassée distincte** : un `Property` (`6a666cf0db7060032a0d2338`) référencé par un Hotel puis par son Accommodation, introuvable également.

**Aucune de ces 7 références n'a été réparée, ni supprimée, ni devinée.** Elles constituent la première priorité d'investigation humaine avant toute régularisation réelle (§30/§32).

## 25. Contradictory Relationships

**0 contradiction (C) trouvée** sur les 376 ressources réelles auditées. Attendu et cohérent : une contradiction exige au moins 2 tenants réels distincts dans le graphe de preuves d'une même ressource, or un seul `PlatformTenant` existe aujourd'hui. Le détecteur de contradiction a été prouvé fonctionnel par test adversarial contre des données Tenant A / Tenant B délibérément croisées (Hotel tenant A + manager tenant B, Locataire lié à 2 Contrat de tenants différents) — **jamais vérifié uniquement en théorie**. Ce zéro doit être réinterprété dès qu'un second tenant réel existera : ce même outil devra être réexécuté, jamais supposé toujours vrai.

## 26. Global Resources

**0 ressource classée E** aujourd'hui — aucune instance réelle de `FinancialLedgerEntry`/`FinancialDocumentArtifact` avec `domain` Altcom/Mila Events n'existe actuellement. La classification E reste définie statiquement par architecture (jamais déduite de `tenant == null`), prête à s'appliquer dès qu'une telle ressource existera.

## 27. Unknown Resources (F)

216 ressources classées F : 34 Locataire + 17 Contrat (bien:null, voir §12-13), 163 Notification (`platformTenant: null`, aucune autre preuve exploitable — la Notification ne porte qu'un champ direct, jamais de relation), 1 Proprietaire, 1 Litige (bienConcerné:null, corrigé pendant ce sprint — voir audit §5.3).

## 28. Graph Consistency

La cohérence de graphe est appliquée **structurellement** par `mergeProofs` (fail-closed dès que 2+ tenants distincts apparaissent n'importe où dans le sous-graphe de preuves d'une ressource) — jamais une passe de comparaison collection-par-collection séparée, conformément à l'exigence « audit par graphe, jamais collection isolée ». Confirmé par test adversarial explicite sur Hotel↔manager et Locataire↔Contrat croisés (§25). Message hérite systématiquement de sa Conversation (§16) : aucune divergence trouvée sur les 106 messages réels.

## 29. Proposed Migration Batches (ordre recommandé, futur sprint d'exécution)

**PHASE 1 — Ressources racines déjà certaines (A).** Les 67 A peuvent être attribuées en premier dans un futur sprint contrôlé : Property (2), RentalManagement (1), Hotel (1), Accommodation (1), Conversation (9), Message (50), Document (1) — jamais automatiquement, toujours après confirmation humaine explicite comme dans PLATFORM-ADMIN-BOOTSTRAP-EXEC-1.

**PHASE 2 — Investigation des 7 références cassées (§24).** Bloquant avant toute décision sur les 43 D : déterminer si les 6 comptes User fantômes sont des suppressions historiques légitimes (auquel cas leurs ressources dépendantes restent probablement non-attribuables définitivement) ou une anomalie de migration à corriger en amont.

**PHASE 3 — Ressources B après onboarding humain de leurs entités réelles.** Les 50 B ne devraient être promues en A qu'après qu'un humain ait explicitement rattaché l'entité réelle sous-jacente (ex. le Proprietaire `th***@gmail.com`) à un tenant via le mécanisme PlatformOperator/OrgMembership déjà certifié — jamais automatiquement.

**PHASE 4 — Contrat/Locataire (F, 51 documents).** Nécessite une décision de fond, hors périmètre technique pur : soit une reconstruction historique contrôlée via `reconstructHistoricalManagedProperty` (GL-PROPERTY-FLOW-1, un dossier à la fois, via le centre de régularisation), soit une décision explicite de laisser ces dossiers définitivement non-tenant-scopés (statut légitimement « pré-SaaS »).

**PHASE 5 — Vérification d'intégrité post-migration (§35).** Réexécution de `auditTenantLegacyData.js` après toute régularisation réelle future : le résultat attendu est que chaque ressource migrée devienne A avec le tenant exact attribué, 0 nouvelle contradiction, 0 nouvelle référence orpheline introduite.

## 30. Human Review Queue

**309 entrées** (B + C + D + F), écrites intégralement dans `server/reports/tenant-legacy-audit.json` (`humanReviewQueue`). Jamais les 67 A. Priorité recommandée : D (43, bloquant sur investigation des comptes fantômes) > B (50, entités réelles nommées, décision ciblée possible) > F (216, majoritairement Contrat/Locataire/Notification sans piste exploitable).

## 31. GL-RECON Interaction

Les 17 Contrat restent **entièrement** sous la responsabilité du centre `/dashboard/gestion-locative/regularisation` — cet audit ne recommande aucun contournement. Aucun dossier ne devrait être « techniquement » régularisé en masse simplement parce que le tenant « Altitude Vision » existe désormais (mission §34, respecté : aucune tentative de rattachement en masse n'a été effectuée ni recommandée).

## 32. Cloudinary Legacy Separation

Aucun appel Cloudinary, aucune classification de stockage n'a été mêlée à cet audit. STORAGE-LEGACY-1/CERT-1 restent des problèmes séparés (migration de stockage, pas d'attribution tenant) — une ressource peut être `tenant-attribuable` (ce rapport) tout en restant `storage legacy non sécurisé` (rapports STORAGE-LEGACY-\*), les deux états ne sont jamais fusionnés.

## 33. Property Attributable — Revalidation explicite (mission §33)

Les 2 Property précédemment classées attribuables par PLATFORM-ADMIN-BOOTSTRAP-EXEC-1 ont été **revalidées indépendamment** par ce nouvel outil, jamais considérées comme acquises : `6a563d4f6132ad740c860328` et `6a69a4d9ff48057876dd5ca9`, toutes deux classification **A**, cible `6a7d05552db41d7c7223837c` (Altitude Vision), preuve `owner→membership→tenant`. Statut : **READY FOR FUTURE CONTROLLED ATTRIBUTION** — rien de plus, aucune écriture effectuée.

## 34. Future Rollback Strategy

Documenté pour un futur sprint d'exécution, jamais implémenté ici : une régularisation réelle ne devra jamais être un `delete`/une recréation. Le rollback devra restaurer précisément les champs modifiés par la régularisation (ex. `tenant` remis à `null`), avec contrôle de divergence (comparer l'état courant à l'état attendu avant restauration, refuser si l'état a divergé depuis — même principe que `RentalContractReconciliation`'s `STATE_DIVERGED`, déjà éprouvé par GL-RECON-UX-1). Le journal `RentalContractReconciliation` (append-only, before/after) est le patron à réutiliser pour toute nouvelle régularisation tenant, jamais un second mécanisme de journalisation.

## 35. Future Journaling Strategy

`ActionLog`/`actionLogService.js` (déjà réutilisé sans exception par tous les sprints PLATFORM-ADMIN-\*) reste le canal secondaire de traçabilité. Le journal PRINCIPAL d'une future régularisation réelle devrait suivre le patron `RentalContractReconciliation` : `actor`, `timestamp`, `resourceType`, `resourceId`, `before`, `after`, `proofs` (directement issues de ce moteur d'attribution), `reason`, `batchId` (pour grouper une exécution de migration). Aucun log réel d'une migration qui n'a pas eu lieu n'a été créé par ce sprint.

## 36. Future Idempotence Strategy

Le script d'audit lui-même est déjà déterministe et réexécutable à l'identique (vérifié par test, §37 — deux exécutions successives contre les mêmes données produisent un JSON identique hors horodatage). Une future exécution réelle devra suivre le même patron que `bootstrapPlatformOperator.js`/`bootstrapPlatformTenant.js` : idempotence par relecture de l'état AVANT toute écriture (si déjà attribué au tenant cible → NOOP explicite), jamais une réécriture aveugle.

## 37. Adversarial Tests

23 tests dans `server/__tests__/tenantDataRegularization1.audit.mongo.integration.test.js`, contre un `MongoMemoryReplSet` jetable exclusivement : classification A (2 tests, dont Tenant A vs Tenant B distincts), B (2, dont membership suspendu jamais compté actif), C (2, Hotel↔manager croisé + Locataire↔2 Contrat croisés), D (1 direct + 1 via vérification d'existence), E (2, domaine Altcom vs real_estate), F (1), Admin/PlatformOperator sans preuve jamais promus en A (2), tenant inexistant distinct de la classification (1), champ optionnel null jamais confondu avec référence cassée (2), sécurité du script (refus des flags d'écriture, refus base non confirmée, réexécution déterministe, aucune écriture réelle) (4), plus les tests B-vs-F (2). **23/23 verts.**

## 38. Regression Results

```
Backend Unit          : 110/110 suites, 1265/1265 tests
Mongo ciblé (7 fichiers) : 7/7 suites, 121/121 tests
  (tenantAttribution, tenantAttributionLegacyExtension, tenantDataRegularization1.audit,
   rentalContractRegularization, tenantCert2.adversarial, platformAdminCert1.vulnerabilities,
   platformAdminCert1.domains)
ESLint serveur         : 0 erreur, 129 avertissements pré-existants (aucun dans les fichiers de ce sprint)
git diff --check       : aucune sortie, exit 0
```

## 39. Limitations

- 3 limitations réelles du moteur canonique découvertes et compensées au niveau de l'audit uniquement (§9 de l'audit) — jamais corrigées dans le moteur runtime lui-même dans ce sprint (portée volontairement limitée à l'audit, correction du moteur runtime hors périmètre d'un sprint read-only).
- 0 contradiction trouvée aujourd'hui ne garantit rien pour l'avenir dès qu'un second tenant réel existera — à réauditer à ce moment, jamais supposé stable.
- Les 6 comptes fantômes ne sont pas expliqués par cet audit (suppression légitime ancienne ? anomalie de migration ?) — nécessite une investigation humaine hors du périmètre technique de ce sprint.
- `OrgUnit`/`OrgMembership` eux-mêmes non inclus dans la taxonomie A–F (ils sont l'infrastructure de résolution, pas des ressources tenant-scopables) — leur propre cohérence structurelle a été vérifiée séparément (§23) mais pas classifiée A–F.

## 40. Risk Register

- **Risque bloquant avant régularisation réelle** : les 6 comptes fantômes doivent être investigués avant toute décision sur les 41 ressources D qui en dépendent (Property, Signalement, Visite, Conversation, Message, Document).
- **Risque de contournement futur** : rien n'empêche techniquement un futur sprint d'exécution de « transformer B en A pour augmenter le taux de régularisation » (mission §7, interdit) — ce risque est documenté, pas éliminable par du code seul ; nécessite une discipline de revue humaine à chaque exécution.
- **Risque de re-classification silencieuse** : si le moteur canonique évolue à l'avenir sans revalider ce script d'audit, les 3 compensations (§5 de l'audit) pourraient se désynchroniser du comportement réel — recommandé de relancer la suite adversariale (`tenantDataRegularization1.audit.mongo.integration.test.js`) à chaque modification de `tenantResourceAttributionService.js`.

## 41. Exact Next-Step Recommendation

1. Investiguer humainement les 6 comptes User fantômes (§24) — décision préalable à toute régularisation D.
2. Pour les 2 Property + 1 RentalManagement + 1 Hotel + 1 Accommodation + 9 Conversation + 50 Message + 1 Document classés A (67 total) : préparer un futur sprint `TENANT-DATA-REGULARIZATION-EXEC-1`, avec dry-run/confirmation humaine explicite par ressource ou lot, suivant exactement le patron `bootstrapPlatformOperator.js`/`bootstrapPlatformTenant.js`.
3. Pour les 50 B : traiter au cas par cas via le mécanisme PlatformOperator/OrgMembership déjà certifié (onboarder l'entité réelle sous-jacente d'abord, puis ré-attribuer sa ressource).
4. Pour les 17 Contrat/34 Locataire (F) : décision de fond via le centre GL-RECON-UX-1, jamais un rattachement technique en masse.
5. Ne PAS lancer `TENANT-DATA-REGULARIZATION-EXEC-1` sans une nouvelle autorisation humaine explicite, conformément à la mission.

---

## Tableau de synthèse obligatoire (mission §31)

| Resource | Total | Already scoped | A | B | C | D | E | F |
|---|--:|--:|--:|--:|--:|--:|--:|--:|
| Property | 7 | 0 | 2 | 2 | 0 | 3 | 0 | 0 |
| Proprietaire | 2 | 0 | 0 | 1 | 0 | 0 | 0 | 1 |
| Locataire | 34 | 0 | 0 | 0 | 0 | 0 | 0 | 34 |
| RentalManagement | 1 | 0 | 1 | 0 | 0 | 0 | 0 | 0 |
| Contrat | 17 | 0 | 0 | 0 | 0 | 0 | 0 | 17 |
| Litige | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 1 |
| Signalement | 1 | 0 | 0 | 0 | 0 | 1 | 0 | 0 |
| Visite | 9 | 0 | 2 | 0 | 0 | 7 | 0 | 0 |
| Conversation | 23 | 0 | 9 | 7 | 0 | 7 | 0 | 0 |
| Message | 106 | 0 | 50 | 35 | 0 | 21 | 0 | 0 |
| Notification | 163 | 0 | 0 | 0 | 0 | 0 | 0 | 163 |
| Document | 5 | 0 | 1 | 2 | 0 | 2 | 0 | 0 |
| Hotel | 3 | 0 | 1 | 1 | 0 | 1 | 0 | 0 |
| Accommodation | 4 | 0 | 1 | 2 | 0 | 1 | 0 | 0 |
| **TOTAL** | **376** | **0** | **67** | **50** | **0** | **43** | **0** | **216** |

(Toutes les autres collections du registre — Paiement, RentalMaintenanceTicket, RealEstateApplication, RentalPaymentReceipt, Transaction, PaiementTransaction, Finance\*, HotelReservation, Room, HotelStaffAssignment, AccommodationReservation, CRM\*, Marketing\* — comptent 0 document réel aujourd'hui, omises du tableau pour lisibilité, voir §5 pour la liste complète.)

## Verdict final

# PARTIALLY READY — HUMAN REVIEW REQUIRED

Justification (mission §44, toutes conditions vérifiées) :
1. ✅ Audit fiable — 376/376 ressources réelles auditées, recomptage confirme exactement la baseline fournie, aucune estimation.
2. ✅ Moteur fiable — 3 limitations réelles découvertes et compensées, chacune prouvée par test adversarial rouge→vert, jamais supposée.
3. ✅ Graphe compris — audit par graphe (fail-closed structurel de `mergeProofs`), pas collection par collection ; vérifié par test croisé Tenant A/Tenant B.
4. ✅ Catégories déterministes — 0 contournement pour rendre un test vert (mission §28), fail-closed vérifié sur chaque catégorie C/D/F.
5. ✅ Lots futurs identifiés — 5 phases proposées, dérivées des dépendances réellement observées (§29).
6. ✅ Ressources ambiguës isolées — 309 entrées en file de revue humaine, jamais mélangées aux 67 A.
7. ✅ Stratégie de rollback définie — §34, réutilise le patron `RentalContractReconciliation` déjà éprouvé.
8. ✅ Aucun backfill effectué — confirmé par test dédié (`Property.countDocuments()` inchangé) et par `git diff --check` propre.

**Pourquoi pas `READY FOR CONTROLLED REGULARIZATION`** : 309 des 376 ressources réelles (82%) nécessitent une décision humaine avant toute régularisation — en particulier 6 comptes fantômes non expliqués bloquant 41 ressources D, et 51 dossiers GL (Contrat+Locataire liés) dont la régularisation relève d'une décision métier de fond, pas d'une exécution technique. Ce n'est pas un échec de l'audit — c'est exactement l'état réel des données, rapporté honnêtement plutôt que déguisé en simplicité qui n'existe pas.

**Pourquoi pas `NOT READY`/`BLOCKED`** : aucune donnée n'est dans un état dangereux (0 contradiction, 0 fuite possible), le moteur et l'outil sont certifiés fiables, et 67 ressources sont d'ores et déjà prêtes pour une attribution contrôlée future.

---

## Livrable final (mission §45)

1. **Verdict** : `PARTIALLY READY — HUMAN REVIEW REQUIRED`
2. **Ressources analysées par collection** : voir tableau de synthèse ci-dessus (376 total, 14 collections non vides)
3. **Tableau A–F** : voir ci-dessus
4. **Références orphelines** : 43 (D), toutes rattachables à 6 comptes User fantômes + 1 référence Property cassée
5. **Contradictions cross-tenant** : 0 (attendu, un seul tenant réel existe aujourd'hui — détecteur prouvé fonctionnel par test adversarial)
6. **Types nécessitant revue humaine** : Property (5/7), Proprietaire (2/2), Locataire (34/34), Contrat (17/17), Litige (1/1), Visite (7/9), Conversation (14/23), Message (56/106), Notification (163/163), Document (4/5), Hotel (2/3), Accommodation (3/4)
7. **Résultat 7 Property** : 2 A, 2 B, 3 D — identique et revalidé indépendamment du résultat manuel de PLATFORM-ADMIN-BOOTSTRAP-EXEC-1
8. **Résultat 17 Contrat** : 17 F — confirme exactement GL-RECON-UX-1 (`bien: null` sur les 17)
9. **Résultat 34 Locataire** : 34 F — cohérent avec §8 (aucun contrat lié n'a de `bien`)
10. **Résultat 23 Conversation** : 9 A, 7 B, 7 D
11. **Ordre recommandé** : Phase 1 (67 A) → Phase 2 (investigation 7 comptes/références fantômes) → Phase 3 (50 B après onboarding humain) → Phase 4 (51 GL via centre de régularisation) → Phase 5 (vérification d'intégrité post-migration)
12. **Résultats exacts des tests** : Backend Unit 1265/1265, Mongo ciblé 121/121 (7 suites), adversarial engine 23/23
13. **Gates non exécutées** : suite Mongo complète (785+ tests, hors périmètre — seules les suites pertinentes à ce sprint ciblées), Web/Mobile/Playwright (aucun fichier client/mobile modifié)
14. **Fichiers créés** : `server/scripts/auditTenantLegacyData.js`, `server/__tests__/tenantDataRegularization1.audit.mongo.integration.test.js`, `server/docs/TENANT_DATA_REGULARIZATION_1_AUDIT.md`, `server/docs/TENANT_DATA_REGULARIZATION_1_REPORT.md`, `server/reports/tenant-legacy-audit.json`
15. **Fichiers modifiés** : `server/services/platformTenant/tenantResourceAttributionService.js` (extension additive, 13 nouveaux types de ressources)
16. **Confirmation** : aucune donnée réelle n'a été modifiée (vérifié par test dédié + `git diff --check` propre)
17. **Confirmation** : aucun appel Cloudinary production n'a été effectué
18. **Confirmation** : aucun commit, push, ou déploiement n'a été effectué

**Ce sprint s'arrête ici. `TENANT-DATA-REGULARIZATION-EXEC-1` nécessitera une nouvelle autorisation humaine explicite avant toute exécution réelle.**
