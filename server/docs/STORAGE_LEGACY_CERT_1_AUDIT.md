# STORAGE-LEGACY-CERT-1 — Audit de certification du moteur de migration

Lecture obligatoire effectuée avant toute modification : `STORAGE_LEGACY_1_AUDIT.md`, `STORAGE_LEGACY_1_REPORT.md`, `STORAGE_SECURITY_1_AUDIT.md`, `STORAGE_SECURITY_1_REPORT.md`, `TENANT_HARDENING_2_REPORT.md`.

## 1. Motifs exacts du verdict PARTIALLY READY (repris de `STORAGE_LEGACY_1_REPORT.md` §42, jamais reconstruits de mémoire)

1. **Aucun inventaire réel exécuté** : le script d'audit n'a jamais tourné contre une base de données de production — la proportion effective B/C/D/F sur les données réelles restait inconnue.
2. **Aucune preuve OLD URL contre un compte Cloudinary réel** : la fermeture de la fuite (rename → authenticated → ancienne URL 404) n'avait été prouvée que par des mocks (`cloudinaryClient.rename` simulé, `verifyOldUrlInaccessible` mocké), jamais contre le SDK Cloudinary réel.
3. **Playwright GL, Expo Doctor, gates Web/Mobile/E2E non revérifiés** ce sprint-là — statut hérité de STORAGE-SECURITY-1 non reconfirmé.

Deux dettes secondaires notées au §39 de ce même rapport, également reprises ici : `InternalMail` sans attribution tenant fiable (aucune relation exploitable sur le schéma), et absence de test contre un asset Cloudinary réel de tout type (`resource_type` non varié).

## 2. Ce que STORAGE-LEGACY-CERT-1 change réellement

- **Reste non résolu** : aucun compte Cloudinary de test distinct de la production n'existe dans ce dépôt (`server/.env` ne contient qu'un seul jeu d'identifiants Cloudinary, celui utilisé en production par Netlify/Render — confirmé par le guide du projet). Conformément à la Phase 5 du sprint, ce compte n'a **pas** été utilisé pour des tests réels, même non destructifs — le motif 2 ci-dessus reste donc non résolu et est documenté comme tel, jamais présenté comme résolu par un mock.
- **Résolu** : le motif 3 est reconfirmé point par point avec des données fraîches (§7 ci-dessous), au lieu de rester une inconnue.
- **Renforcé** : le moteur est désormais certifié sur les trois `resource_type` Cloudinary réellement utilisés par ce dépôt (`image`/`raw`/`video`, voir §4), avec une correction de bug réelle détectée pendant cette certification (§3).
- **Renforcé** : l'extension tenant de STORAGE-LEGACY-1 (9 `resourceType`) est désormais testée individuellement (`tenantAttributionLegacyExtension.mongo.integration.test.js`), pas seulement exercée indirectement.
- **Renforcé** : couverture explicite des cas contradictoires (preuve directe ≠ preuve relationnelle → `ambiguous`), de la protection des assets publics sous tentative forcée, et de la priorité pièces d'identité.

## 3. Bug détecté et corrigé pendant cette certification

`legacyAssetMigrationService.executeLegacyMigration` appelait `cloudinary.uploader.rename(..., { resource_type: deps.resourceKind || 'raw' })` — un défaut fixe à `'raw'` en l'absence d'override explicite. Or `config/cloudinary.js` (`CLOUDINARY_DEFAULTS.resource_type: 'auto'`) montre que **tous** les uploads legacy de ce dépôt utilisent `resource_type: 'auto'`, jamais un type fixe — Cloudinary résout et encode le type réel (`image`/`video`/`raw`) dans l'URL au moment de l'upload. Un défaut `'raw'` aurait fait échouer `rename` contre Cloudinary réel pour tout document `image`/`video` (photo de pièce d'identité, note vocale, etc. — précisément les cas HIGH/CRITICAL du §13). Corrigé : `resourceTypeFromUrl(url)` dérive désormais systématiquement le type réel depuis l'URL legacy observée ; `apply=true` sans type dérivable lève `CLOUDINARY_RESOURCE_KIND_UNKNOWN` **avant** tout appel Cloudinary, plutôt que de tenter un `rename` probablement voué à l'échec avec un type incorrect.

## 4. Cloudinary `resource_type` réellement utilisés (Phase 4)

Grep exhaustif de `resource_type` dans `server/controllers`, `server/services`, `server/config` : aucun contrôleur métier (Property, Proprietaire, GL, Message, Paiement, etc.) ne fixe explicitement `resource_type` à l'upload — tous héritent de `CLOUDINARY_DEFAULTS.resource_type: 'auto'` (`config/cloudinary.js`). Conséquence directe : les trois types réellement rencontrés dans les URLs legacy stockées sont `image` (photos, pièces d'identité), `raw` (PDF — quittances, contrats, factures), `video` (utilisé aussi pour l'audio, ex. notes vocales de messagerie — Cloudinary classe l'audio sous `video`). Aucun `auto` n'apparaît jamais dans une URL stockée (Cloudinary ne le permet pas en sortie). Le moteur est certifié pour ces trois types (§5).

## 5. Certification par resource_type (mocked — voir §7 pour le gap réel)

`legacyAssetMigrationCertification.mongo.integration.test.js`, `describe.each(['image','raw','video'])` : pour chacun, classification B correcte, `rename` appelé avec le `resource_type` réellement dérivé de l'URL (jamais un défaut), migration `completed` uniquement si `verifyOldUrlInaccessible` confirme la révocation, `failed` sinon (jamais `completed` sur la seule foi de l'appel `rename`). 6/6 tests PASS (2 par type × 3 types) + 1 test dédié au cas où le type est indérivable (URL non reconnaissable) → refus avant tout appel Cloudinary.

## 6. Cas contradictoires et protection des assets publics (Phases 11-12)

- Preuve directe (`resource.tenant`) pointant vers le Tenant B alors que la preuve relationnelle (Property réellement liée) pointe vers le Tenant A → `ambiguous`, migration refusée (`RentalMaintenanceTicket`, seul `resourceType` testé qui combine les deux preuves dans `mergeProofs`).
- `publicId`/`url` tous deux absents → classification D/F, jamais migrable.
- Ressource inexistante (`resource: null`) → `unresolved`, refus.
- Classification E (média public) → `assertApplyAuthorized` refuse l'exécution même avec `apply: true` et toutes les autres preuves fournies, car `classification !== 'B'` est une des 5 conditions cumulatives — testé directement contre le garde d'autorisation, pas seulement au niveau du plan.
- `Property.images` classifié E par construction (`isPublicMedia: true` court-circuite toute autre condition) — tentative forcée également refusée par le même garde.

## 7. Gap non résolu — preuve Cloudinary réelle

Aucun test de cette certification n'a appelé le SDK Cloudinary réel (`cloudinary.uploader.rename`/`destroy`, sonde HTTP contre une vraie URL `res.cloudinary.com`). Raison : le seul compte configuré dans ce dépôt est le compte de production (mêmes identifiants que Netlify/Render). La Phase 5 du sprint autorise explicitement le repli sur une certification simulée/mockée dans ce cas précis, à condition de documenter honnêtement que la preuve réelle reste partielle — ce qui est fait ici et repris au verdict. **Ce gap, à lui seul, exclut le verdict READY FOR CONTROLLED MIGRATION sans réserve.**

## 8. Priorité pièces d'identité (Phase 13)

`Locataire.pieceIdentite` testé dans les deux états : sans aucun `Contrat` rattaché → `unresolved` → refus (jamais migré sans preuve) ; rattaché à un `Contrat` dont la `Property` est tenant-resolved → `resolved` → `classification: B` → migratable. Aucune migration réelle exécutée sur une pièce d'identité, mockée ou non.

## 9. Attribution tenant — 9 types étendus, testés individuellement

`tenantAttributionLegacyExtension.mongo.integration.test.js`, 14 tests : `RentalMaintenanceTicket`, `RealEstateApplication`, `Litige`, `Signalement`, `RentalPaymentReceipt`, `FinancialDocumentArtifact` (3 domaines : hotel/real_estate/inconnu), `Proprietaire` (3 voies : via `user`, sans attribution, via `Contrat.proprietaire`), `PaiementTransaction`. Tous PASS. `InternalMail` reste volontairement non testé : aucune branche d'attribution n'existe pour ce type (confirmé §1, non résolu ce sprint, hors périmètre — nécessite une consolidation métier séparée sur le schéma lui-même).

## 10. Gates historiques (Phase 20) — état actuel vérifié, pas supposé

- **Backend Unit Hôtel** : rejoué (`npm run test:unit`), 109/109 suites, 1254 tests, 0 échec — **déjà vert**, aucune régression, aucune correction nécessaire ce sprint.
- **Expo Doctor** : rejoué (`npx expo-doctor`), **toujours 19/20** — mêmes 9 dépendances patch-behind (`expo`, `expo-asset`, `expo-dev-client`, `expo-image-picker`, `expo-location`, `expo-notifications`, `expo-sharing`, `expo-updates`, `jest-expo`). Dette inchangée, non traitée ce sprint (hors périmètre : aucune modification mobile n'est requise par la mission de certification du moteur backend).
- **Playwright GL** (`e2e/rental-asset-onboarding.spec.js`) : rejoué desktop + mobile. Desktop **PASS**. Mobile **FAIL**, mais sur une assertion différente de celle documentée par STORAGE-SECURITY-1 (« option Property absente ») — l'échec actuel porte sur un timeout d'affichage d'un compteur KPI (`getByText('1')`), cohérent avec la note de TENANT-HARDENING-2 (« deux timeouts/UI non reproductibles »). Le bug originel semble donc résolu ; une flakiness UI distincte, préexistante et non liée à ce sprint, subsiste.

## 11. Stratégie de certification retenue

Certification simulée/mockée systématique (moteur + Cloudinary + sonde HTTP), complétée par une vérification réelle du code source installé (SDK Cloudinary, `config/cloudinary.js`) plutôt qu'une supposition — c'est ce qui a permis de détecter le bug `resource_type` du §3. Aucune migration, upload, rename ou destroy réel n'a été exécuté contre Cloudinary à aucun moment de ce sprint.
