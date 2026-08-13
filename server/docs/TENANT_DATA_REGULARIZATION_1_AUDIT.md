# TENANT-DATA-REGULARIZATION-1 — Audit de l'existant (avant modification de code)

Date : 2026-08-13
Dépôt : `/Users/apple/Documents/GitHub/altitude-vision-1`

## 1. Mécanisme d'attribution existant

`server/services/platformTenant/tenantResourceAttributionService.js` (introduit par TENANT-ATTRIBUTION-1, étendu par STORAGE-LEGACY-1) est le **seul** moteur d'attribution du dépôt. Il expose `resolveResourceTenant`, `assertResourceTenant`, `assertResourceTenantOrUnattributed`, `mergeProofs`. Fail-closed par construction : `mergeProofs` ne renvoie `resolved` que si exactement un tenant distinct émerge de toutes les preuves fournies ; toute preuve concurrente renvoie `ambiguous`, jamais un choix arbitraire.

Avant ce sprint, le moteur couvrait ~24 types de ressources (User, Property, Hotel, Accommodation, HotelReservation, AccommodationReservation, Room, HotelStaffAssignment, RentalManagement, Contrat, Paiement, Conversation, Message, Document, FinancialDocument/FinancialPayment/PaymentAllocation, FinancialDocumentArtifact, RentalMaintenanceTicket, RentalPaymentReceipt, RealEstateApplication, Litige, Signalement, Locataire, Proprietaire, PaiementTransaction).

Un script d'audit read-only existait déjà : `server/scripts/auditTenantAttribution.js` (TENANT-ATTRIBUTION-1). Il utilise une taxonomie A–F **différente et incompatible** avec celle exigée par ce sprint (son A signifie « porte déjà un champ tenant », alors que ce sprint exige que A signifie « preuve déterministe certaine », que le champ soit déjà peuplé ou non). Ce script existant n'a **pas** été modifié — le modifier aurait changé rétroactivement le sens d'une classification déjà citée dans un rapport antérieur. Un nouveau script, `server/scripts/auditTenantLegacyData.js`, a été créé séparément pour porter la taxonomie de CE sprint.

## 2. Documents de sprints précédents consultés

- **TENANT_CERT_3_FINAL** : certifie la couche applicative multi-tenant (hors exception Cloudinary legacy). Règle centrale : aucun second moteur d'attribution, `role === 'Admin'` n'est jamais une preuve globale.
- **PLATFORM-ADMIN-1/CERT-1/BOOTSTRAP-1/BOOTSTRAP-EXEC-1** : identité PlatformOperator canonique, désormais activée réellement (`altitudevision`, tenant « Altitude Vision », un seul opérateur actif).
- **TENANT-ATTRIBUTION-1** : a créé le moteur d'attribution et ajouté le champ `tenant` (nullable, sans défaut global) à Document/Conversation/Message/Hotel/HotelReservation/Accommodation/AccommodationReservation/FinancialDocument/FinancialPayment/PaymentAllocation — aucune donnée existante réécrite à l'époque.
- **TENANT-REGRESSION-1** : sprint de réparation de fixtures uniquement, aucun fichier applicatif modifié ; a introduit `__tests__/helpers/tenantAwareFixture.js`, réutilisé dans ce sprint.
- **GL-RECON-UX-1** : centre `/dashboard/gestion-locative/regularisation`, modèle `RentalContractReconciliation` (journal append-only), confirme que les 17 contrats historiques ont tous `bien: null` — fait vérifié à nouveau et confirmé exact par cet audit (§5).
- **GL-PROPERTY-FLOW-1** : règle « un bien géré n'est jamais créé/publié automatiquement » — `rentalAssetOnboardingService.activateExisting` exige `mode:'existing'` ; seule `reconstructHistoricalManagedProperty` (via le centre de régularisation) peut créer une Property depuis GL, toujours `isPublished:false`.
- **PROPERTY-PORTFOLIO-1** : « Tous les biens » est une projection calculée (Property/Accommodation/Hotel dédupliqués), jamais une collection indépendante — confirmé inchangé.
- **STORAGE-LEGACY-1/CERT-1** : taxonomie A–F **distincte**, portant sur le stockage Cloudinary (jamais confondue avec l'attribution tenant de ce sprint — deux problèmes séparés, rapportés séparément, voir §15 du rapport final).

## 3. Cartographie des collections réellement présentes

108 fichiers de modèles recensés dans `server/models/`. Vérifiés champ par champ (lecture directe des schémas, jamais supposés) : voir le tableau complet du rapport final §4. Points notables :
- `Property`, `Proprietaire`, `Locataire`, `RentalManagement`, `Contrat`, `Paiement`, `RentalMaintenanceTicket`, `Litige`, `Signalement`, `Visite`, `Transaction`, `PaiementTransaction` **n'ont aucun champ `tenant` direct** — leur attribution est entièrement relationnelle.
- `Conversation`, `Message`, `Document`, `FinancialDocument`, `FinancialPayment`, `PaymentAllocation`, `Hotel`, `HotelReservation`, `Accommodation`, `AccommodationReservation`, `CrmCustomer`, `CrmOpportunity`, `CrmActivity`, `CrmAutomationRule`, `CrmAutomationRun`, `MarketingCampaign`, `MarketingSend`, `MarketingTemplate` portent un champ `tenant` (ou `platformTenant` pour `Notification`).
- `RentalMaintenanceTicket.tenant` est un piège de nommage : il référence un **Locataire**, jamais un `PlatformTenant` — déjà signalé dans l'en-tête de `PlatformTenant.js`, revérifié ici.
- Aucun modèle nommé exactement `FinancialJournalEntry` n'existe ; le modèle réel est `FinancialLedgerEntry.js` (append-only, toute mutation post-création lève `FINANCIAL_LEDGER_APPEND_ONLY`).

## 4. Extension additive du moteur (ce sprint)

`resolveResourceTenant` a été étendu — jamais dupliqué — pour couvrir : `Transaction`, `Visite`, `CrmCustomer`, `CrmOpportunity`, `CrmActivity`, `CrmAutomationRule`, `CrmAutomationRun`, `MarketingCampaign`, `MarketingSend`, `MarketingTemplate`, `FinancialDocumentLine`, `FinancialLedgerEntry`, `Notification`. Vérifié sans régression : 74 tests existants (`tenantAttribution`, `tenantAttributionLegacyExtension`, `tenantCert2.adversarial`, `platformAdminCert1.vulnerabilities`) toujours verts après l'extension, plus 1265/1265 Backend Unit.

## 5. Trois limitations réelles du moteur canonique découvertes par test adversarial

Toutes trois documentées, testées, et compensées **uniquement au niveau du nouvel outil d'audit** (`auditTenantLegacyData.js`) — le comportement d'autorisation runtime (`assertResourceTenant`/`assertResourceTenantOrUnattributed`, utilisé par les routes HTTP) n'a **jamais** été modifié et reste fail-closed exactement comme avant :

1. **Ambiguïté imbriquée non remontée** — `mergeProofs` ne compte que les preuves `resolved` au niveau qu'on lui passe ; une ambiguïté détectée dans une branche imbriquée (ex. `Locataire` relié à 2 `Contrat` de tenants différents via `fromContractsReferencing`) redescend à `unresolved` plutôt que `ambiguous`. Aucune faille d'autorisation (le comportement runtime reste fail-closed), mais aurait faussé la précision de CET audit (C silencieusement compté comme F) sans compensation — implémentée en relisant les identifiants `→membership→<id>` réellement présents dans le tableau de preuves aplati.
2. **Existence non vérifiée** — `fromUser` vérifie l'existence d'un `OrgMembership`, jamais l'existence du `User` référencé lui-même. Un `owner`/`participant` pointant vers un compte supprimé produit exactement la même preuve (`→no_tenant`) qu'un compte réel sans tenant — compensé par une vérification d'existence supplémentaire, en lecture seule, propre à l'audit.
3. **Champ optionnel absent confondu avec référence cassée** — `fromProperty(null)` (champ jamais renseigné, ex. `Document.relatedProperty`) produit un marqueur `label:null→missing`, indiscernable syntaxiquement d'une vraie référence cassée (`label:<id réel>→missing`) sans un test plus précis sur le format exact de la chaîne de preuve — compensé par une regex exigeant un ObjectId de 24 caractères hexadécimaux avant `→missing`.

Ces trois limitations ont chacune été démontrées par un test adversarial dédié AVANT correction (test rouge), puis vérifiées corrigées (test vert) — jamais supposées ni corrigées sans preuve.

## 6. Conclusion de l'audit préalable

Aucune reconstruction du moteur d'attribution n'était nécessaire ni n'a été effectuée. Le travail de ce sprint a consisté à (a) élargir sa couverture de types de ressources de façon additive, (b) construire un outil d'audit séparé implémentant la taxonomie A–F propre à ce sprint par-dessus le moteur existant, (c) découvrir et compenser — au niveau de l'audit uniquement, jamais du runtime — trois limitations réelles de fidélité du moteur, révélées uniquement par test adversarial contre des données contradictoires construites délibérément.
