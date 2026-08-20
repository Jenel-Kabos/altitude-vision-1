# PAY-3 — Architecture unifiée des paiements (automatique + manuel + international)

Date : 2026-08-19. Branche `main`, `HEAD bfdd67c8f8293c690640fab799b2aae062196d7a` (inchangé pendant tout le sprint).

## 1. Résumé

Le Financial Core (`FinancialPayment`→`PaymentAllocation`→`FinancialDocument`→`FinancialLedgerEntry`) sépare déjà `method` (enum réel) de `provider` (chaîne libre, défaut `'manual'`) — l'architecture demandée par le mandat existait donc déjà au niveau du schéma, jamais exploitée au-delà d'un seul provider. Ce sprint ajoute une couche fine et volontairement minimale : un registre de providers (`paymentProviderRegistry.js`) qui documente en code — pas seulement en prose — les capacités réelles de chaque provider cible (MTN direct, Airtel direct, Yabetoo, futur PSP carte), avec des adaptateurs automatiques explicitement non implémentés (`FINANCIAL_PROVIDER_NOT_IMPLEMENTED`, aucun appel réseau, aucun secret) et une délégation intacte vers le flux manuel déjà en production (F2.2). Aucun nouveau Financial Core, aucun nouveau modèle, aucune route webhook vide créée.

## 2. Git baseline

Voir `PAY3_UNIFIED_PAYMENT_ARCHITECTURE_ETAT_INITIAL.md` §1. `HEAD` avait de nouveau avancé extérieurement depuis PAY-2 (commit `bfdd67c`, non créé par cette session — documenté, aucun travail perdu). Inchangé pendant tout le sprint PAY-3.

## 3. Modèles

Aucun modèle modifié. Confirmé par audit direct (déjà détaillé en PAY-1, revalidé ici) :

- `FinancialPayment.provider` : `String, default: 'manual'`, **jamais un enum Mongoose** — accepte nativement n'importe quel identifiant de provider sans migration de schéma.
- `FinancialPayment.method` : enum fermé `FINANCIAL_PAYMENT_METHODS = ['cash','bank_transfer','card','mobile_money','cheque','credit','other']` (`financialConstants.js`) — inchangé, suffisant pour couvrir tous les moyens du mandat (`mobile_money` sert MTN/Airtel/Yabetoo, `card` sert le futur PSP).
- Index `{provider, providerPaymentId}` unique (partiel, `providerPaymentId` de type string) — **déjà l'exact mécanisme d'idempotence par provider externe** demandé au mandat §28. Aucun second mécanisme créé.
- `PaymentAllocation`/`FinancialDocument`/`FinancialLedgerEntry` : invariants (append-only, `businessOperationKey` unique, hooks bloquant toute mutation post-écriture du ledger) inchangés et suffisants — aucun provider ne peut les contourner puisqu'aucun provider n'écrit ailleurs que dans `FinancialPayment` avant allocation.

## 4. Financial Core — invariants vérifiés

| Invariant | État |
|---|---|
| `provider` séparé de `method` | ✅ déjà présent (schéma) |
| `providerPaymentId` indexé unique par provider | ✅ déjà présent |
| `currency`/`amountMinor` entiers sûrs, validés | ✅ déjà présent (`Number.isSafeInteger`) |
| `status` normalisé (`pending/processing/succeeded/failed/cancelled/partially_refunded/refunded`) | ✅ déjà présent, table de normalisation PAY-3 s'y conforme strictement (§9) |
| Allocations append-only, reversal jamais une suppression | ✅ déjà présent |
| Idempotence de requête (`businessOperationKey`/`Idempotency-Key`) | ✅ déjà présent |

Conclusion : **aucun changement de modèle n'était nécessaire.** Le travail de ce sprint est une couche de service, pas un changement de Financial Core.

## 5. Paiements manuels first-class

Confirmé par lecture directe de `financialPaymentService.js` (§10 de PAY-1, revérifié) : les paiements manuels (cash/bank_transfer/cheque) passent déjà par `FinancialPayment`, `manualValidation.status` (`pending/approved/rejected`), les mêmes capacités (`financial.payment.create`/`.confirm`/`.allocate`), le même ledger. **Ce n'est pas un chantier de ce sprint, c'est un constat d'audit** : le mandat §5 était déjà satisfait par le code F2.2 existant. Voir `PAY3_MANUAL_PAYMENT_MATRIX.md` pour le détail exact du workflow par méthode.

## 6. Cash

Qui enregistre : staff avec `financial.payment.create` (Admin, Collaborateur, Secretaire, manager d'hôtel rattaché). Qui confirme : capacité distincte `financial.payment.confirm`, mêmes rôles. Référence interne : non obligatoire pour `cash`/`other` (F2.2). Reçu : généré via le PDF de facture existant une fois la facture soldée, pas un reçu de caisse séparé — aucun système de caisse dédié trouvé (`Caisse`/`CashRegister` absent du dépôt, confirmé par grep). Audit : `payment.created`/`.confirmed` dans `FinancialLedgerEntry`. Reversal : via renversement d'allocation, jamais suppression du paiement. **Le client ne peut jamais enregistrer un encaissement cash** — `Client`/`User` absents de `FINANCIAL_CAPABILITIES`.

## 7. Bank transfer

Architecture cible du mandat (§7) déjà celle du code F2.2 : `staff crée → référence obligatoire → FinancialPayment pending → validation staff (financial.payment.confirm) → allocation → ledger`. **Écart identifié** : contrairement à `PaiementTransaction`/`Paiement` (vente/loyer), `FinancialPayment` n'a **aucun champ de preuve jointe** (pas de `proof`/`preuvePaiement`) — le staff saisit une référence textuelle uniquement. Une preuve envoyée par le client n'est jamais confondue avec une confirmation (il n'existe même pas de canal pour que le client la soumette côté hôtel) — le mandat §7 (« ne rends jamais un upload de preuve équivalent à un paiement confirmé ») est donc respecté par absence totale de ce canal côté hôtel, pas par une garde applicative dédiée. Documenté comme dette (§16).

## 8. Cheque

Identique à bank transfer (référence obligatoire, `pending→confirmed`). Usage réel en volume NON CONFIRMÉ (déjà noté en PAY-1) — support conservé tel quel, aucun investissement UX supplémentaire (mandat §8), aucun changement.

## 9. MTN Direct

`paymentProviderRegistry.js` déclare l'entrée `mtn_direct` : `scope: 'national'`, `methods: ['mobile_money']`, `capabilities: { initiate: true, statusQuery: true, webhook: true, refund: false, reconcile: true }`. `initiatePayment`/`getStatus`/`verifyCallback` lèvent systématiquement `FINANCIAL_PROVIDER_NOT_IMPLEMENTED` (HTTP 501), sans aucun appel réseau ni référence à un secret. `refund: false` reflète l'absence de preuve que MTN MoMo expose un remboursement programmatique (NON CONFIRMÉ, à valider avec la documentation officielle avant tout sprint d'implémentation — mandat §9 : « ne code aucun secret »). Table de normalisation de statut préparée (`pending/successful/failed/cancelled` → statuts réels `FinancialPayment`), non exercée par un appel réel.

## 10. Airtel Direct

Symétrique à MTN (§9), entrée `airtel_direct` du registre, mêmes capacités déclarées, même garde `FINANCIAL_PROVIDER_NOT_IMPLEMENTED`. Aucune supposition d'endpoint (mandat §10) — le registre ne contient qu'un contrat conceptuel (méthodes de la classe, jamais une URL ou un identifiant d'API réel).

## 11. Yabetoo

Repositionné dans le registre avec `scope: 'international'` (au lieu de national par défaut). **Point important, vérifié avec précision** : `integratedWithFinancialCore: false` — Yabetoo fonctionne réellement dans le dépôt (`server/services/yabetooService.js`, webhooks signés dans `paiementTransactionController.js`/`visiteController.js`), mais **jamais via `FinancialPayment`** ; il reste entièrement dans `PaiementTransaction`/`Visite`, les systèmes historiques vente/location/visites. `initiatePayment`/`getStatus`/`verifyCallback` du registre lèvent aussi `FINANCIAL_PROVIDER_NOT_IMPLEMENTED`, **spécifiquement qualifié `(Financial Core)`** dans le message, pour ne jamais laisser croire que Yabetoo lui-même est absent (il ne l'est pas — voir `PAY1_PAYMENT_METHOD_MATRIX.md`) alors que seule son intégration au Financial Core l'est. Convergence future : un `YabetooFinancialCoreAdapter` pourrait un jour appeler le `yabetooService` existant et écrire dans `FinancialPayment` au lieu de `PaiementTransaction` pour le domaine hôtel — non codé, car cela toucherait un domaine (immobilier/visites) hors du périmètre F2.2 actuel du Financial Core, décision produit à confirmer séparément.

## 12. Card

Entrée `card_psp` du registre : `scope: 'national_international'`, seul provider à déclarer `refund: true` (capacité, pas implémentation). Aucun PSP choisi (NON CONFIRMÉ en PAY-1 §44). **Aucun champ PAN/CVV nulle part dans le registre ni dans aucun modèle du dépôt** (vérifié par grep, confirmé absent comme en PAY-1). La cible documentée (mandat §12/§30/§31) — hosted checkout / tokenization / redirection PSP — est rappelée en commentaire dans le code, jamais un stub d'implémentation qui laisserait croire à une intégration réelle.

## 13. Provider registry

`server/services/finance/paymentProviderRegistry.js`, `server/constants/paymentProviderConstants.js` (nouveaux). Cinq entrées (`manual`, `mtn_direct`, `airtel_direct`, `yabetoo`, `card_psp`), chacune avec `scope`, `methods`, `integratedWithFinancialCore`, `capabilities` (booléens), `normalizeStatus`. `getProvider(key)`/`listProviders()`/`supportsRefund(key)` exposés. Aucun service financier existant dupliqué — le registre ne réimplémente ni `financialPaymentService`, ni `paymentAllocationService`, ni `financialLedgerService` : il les entoure conceptuellement pour un futur branchement.

## 14. Provider contract

Contrat commun conceptuel respecté avec capacités (mandat §14 : « tous les providers ne doivent pas implémenter artificiellement toutes les méthodes ») : `manual` n'a **pas** de `initiatePayment` du tout (`undefined`, pas une fonction qui échoue) — testé explicitement. Seul `card_psp` expose `refundPayment` (déclaré). Aucun provider n'expose de méthode que ses `capabilities` désactivent.

## 15. Payment method contract

`method`/`provider` déjà séparés (schéma existant, §3-4). `country` : NON AJOUTÉ — aucun champ équivalent n'existe sur `FinancialPayment` et aucun besoin immédiat n'a été démontré (XAF/CG est la seule réalité actuelle, confirmé PAY-1 §36) ; ajouté seulement dans `PAYMENT_PROVIDER_SCOPE` (national/international) au niveau du registre, pas du modèle — évite un champ de schéma prématuré (mandat §15 : « ne crée pas ces champs si des équivalents existent déjà », et ici aucun besoin réel ne justifie encore un champ `country`/`channel` par paiement individuel).

## 16. Status normalization

Table `STATUS_MAPS` dans le registre (§13), une entrée par provider, mappant exclusivement vers les 7 valeurs réelles de `FINANCIAL_PAYMENT_STATUSES` — jamais un nouvel enum. Testé pour chaque provider (`paymentProviderRegistry.test.js`) : statut reconnu → normalisation correcte ; statut inconnu → `FINANCIAL_PROVIDER_STATUS_UNKNOWN` explicite plutôt qu'une supposition silencieuse.

## 17. Fallback

`assertFallbackAllowed(fromStatus)` implémenté et testé : autorise uniquement depuis `failed`/`cancelled`, refuse depuis `pending`/`processing`/`succeeded` avec le code `FINANCIAL_FALLBACK_NOT_ALLOWED`. **Aucun fallback automatique n'est câblé** — cette fonction est une garde disponible pour un futur sprint qui implémenterait un vrai enchaînement MTN→Yabetoo, pas un mécanisme actif aujourd'hui (aucun code n'appelle encore un second provider après échec du premier).

## 18. Routing national

Non codé (mandat §18 : « ne code pas encore une détection opérateur fragile »). Le registre expose `scope: 'national'` pour `mtn_direct`/`airtel_direct` à titre documentaire ; le choix explicite du provider par le client (pas de détection par préfixe téléphonique) reste la recommandation, cohérente avec le pattern déjà utilisé par Yabetoo aujourd'hui (`operateur` choisi explicitement dans `PaiementScreen.jsx`, jamais déduit).

## 19. International

Yabetoo repositionné comme complémentaire (§11). Aucun corridor marqué PASS sans preuve (mandat §19) — aucune liste de corridors n'existe dans le code, `yabetooService.js` ne documente aucune couverture géographique explicite ; NON CONFIRMÉ, à obtenir de la documentation officielle Yabetoo avant toute annonce produit.

## 20. Manual validation permissions

Vérifié directement dans `financialAuthorizationService.js` (§29 de PAY-1, revalidé ici) :
- `Admin` : toutes capacités (`adminCapabilities`, wildcard implicite).
- `Collaborateur`/`Secretaire` : `managerCapabilities` — création, confirmation, allocation, reversal.
- `Proprietaire` : `ownerCapabilities` — **lecture seule** (`PAYMENT_VIEW`, pas `PAYMENT_CREATE`/`PAYMENT_CONFIRM`) — confirme exactement le mandat §20 (« Owner → consulter, pas s'auto-valider »).
- `Client`, `GestionnaireImmobilier` : absents de `FINANCIAL_CAPABILITIES` — zéro capacité financière hôtelière, refus fail-closed.

Déjà conforme, aucune modification IAM nécessaire ni effectuée.

## 21. Client cannot force

Prouvé par test (`financialPaymentMassAssignment.test.js`, 2 tests) : un appel à `createManualPayment` avec `data.status='succeeded'`, `data.provider='attacker_provider'`, `data.providerPaymentId`, `data.confirmedBy`/`manualValidation.approvedBy` arbitraires ne persiste **aucun** de ces champs — `provider` reste `'manual'`, `status` dérive uniquement de `data.confirmed===true` (jamais de `data.status`), `providerPaymentId` n'est même pas un champ lu par le service, `confirmedBy`/`approvedBy` sont toujours l'acteur serveur authentifié (`actor.id`), jamais une valeur du corps de requête.

## 22. Payment proof

Écart identifié (§7) : `FinancialPayment` n'a pas de champ de preuve. `Paiement`/`PaiementTransaction` (loyer/vente) utilisent déjà `privateAssetSchema` (Cloudinary privé, jamais d'exposition publique) — ce pipeline existe et devrait être réutilisé tel quel si un futur sprint ajoute la preuve au Financial Core, jamais un nouveau mécanisme d'upload.

## 23. Receipt

`FinancialDocument` (facture) génère déjà un PDF via `hotelInvoicePdfRenderer.js`/`financialDocumentArtifactService.js` (F2.4, non modifié). Aucun moteur PDF dupliqué par ce sprint — un futur reçu de paiement confirmé réutiliserait cette même chaîne.

## 24. Hôtel

`hotelCheckoutFinancialReadinessService` lit `FinancialPayment.status==='succeeded'` et les allocations actives, indépendamment du `provider` du paiement (le champ n'intervient dans aucune condition de l'évaluateur, confirmé par lecture du service en PAY-1 §18). **Conséquence directe et vérifiée** : un futur `FinancialPayment` avec `provider: 'mtn_direct'` et `status: 'succeeded'` alimenterait la readiness de check-out exactement comme un paiement manuel aujourd'hui — aucun changement à `hotelCheckoutFinancialReadinessService` ne serait nécessaire pour brancher un provider automatique. Confirmé par tests existants inchangés et toujours verts (`hotelFinancialCheckoutF23.mongo.integration.test.js`).

## 25. Location (loyer)

Convergence future documentée, non codée (mandat §25) : `Paiement` resterait la source de vérité de l'échéance, mais un futur adaptateur pourrait créer un `FinancialPayment` miroir (`domain: 'rental'`, déjà présent dans `FINANCIAL_DOMAINS`) lors de la confirmation d'un `RentalPaymentReceipt`, sans dupliquer la logique de pénalités/échéances (`rentalFinancialAutomationService`, propriétaire du domaine). Décision de sprint séparée, ADR-FIN-007 toujours la référence.

## 26. Vente

Même principe pour `PaiementTransaction` (mandat §26) : `domain: 'real_estate'` déjà présent dans `FINANCIAL_DOMAINS`. Un futur pont écrirait un `FinancialPayment` miroir lors de la confirmation d'un paiement Yabetoo/manuel de `PaiementTransaction`, sans toucher `Transaction.commission`/`finalizeTransaction`. Non codé, documentation seulement.

## 27. Audit log

Toute validation manuelle passe déjà par `appendFinancialLedgerEntry` (`payment.created`/`.confirmed`/`.allocated`/`.allocation_reversed`), avec acteur, montant, devise, horodatage serveur, référence — confirmé, aucun doublon avec `ActionLog` créé (le Financial Core a son propre journal dédié depuis F1, `ActionLog` reste pour les autres domaines, cohérent avec le constat PAY-1 §24).

## 28. Idempotence

`{provider, providerPaymentId}` unique pour tout provider externe (§3). Manuel : `businessOperationKey` (`{domain, establishmentId, businessOperationKey}` unique) — pas de `providerPaymentId` requis, cohérent avec le mandat §28 (« manual : pas forcément providerPaymentId »). Index partiel existant non modifié, non cassé (vérifié par test, §29 de ce rapport en réfère la preuve).

## 29. Réconciliation

`financialReconciliationService` (F1.1, existant) répare déjà les agrégats `amountAllocatedMinor`/`balanceMinor`/`paymentStatus`/`availableAmountMinor` en `scan→plan→apply→verify`, indépendamment du provider d'origine du paiement — aucune modification nécessaire pour qu'un futur `mtn_direct`/`airtel_direct` en bénéficie. `reconcile: true` déclaré dans le registre pour `mtn_direct`/`airtel_direct` documente l'intention (polling futur en cas de callback perdu) sans l'implémenter. `reconcile: false` pour `manual` (aucun polling externe nécessaire, conforme mandat §29) et pour `yabetoo` au niveau du registre Financial Core (puisqu'il n'y écrit pas encore — sa réconciliation réelle, si elle existe, resterait dans son système actuel, hors périmètre ici).

## 30. Webhook routes

**Aucune route créée** (mandat §30 : « ne crée pas des routes vides inutiles »). `verifyCallback` existe comme méthode du contrat au niveau du registre, jamais montée sur une route HTTP tant qu'aucune implémentation réelle n'existe derrière.

## 31. API manual payments

Déjà entièrement implémentée (F2.2, `/api/financial/payments/manual`, `/api/financial/hotel/payments`, `/confirm`, `/allocations`, `/allocations/:id/reverse`) — confirmé fonctionnelle et testée, aucun second workflow créé en parallèle (mandat §31).

## 32. Web UI future

Documentation seulement (mandat §32) : la cible d'un futur sélecteur de moyen de paiement web (MTN, Airtel, Carte, Virement, Espèces/staff, Chèque/staff) devrait interroger `listProviders()` pour n'afficher que les providers dont `capabilities.initiate===true` côté client final, et rediriger vers le back-office pour les providers manuels (`requiresManualValidation===true`). Aucune UI construite.

## 33. Mobile UI future

Même principe (mandat §33) : côté client mobile, seuls MTN/Airtel/Carte/Virement seraient pertinents (espèces/chèque restent back-office). Aucune UI construite, aucun écran mobile modifié.

## 34. Tests

19 nouveaux tests, tous verts :
- `paymentProviderRegistry.test.js` (17) : séparation method/provider, providers non implémentés sans appel réel, contrat à capacités variables, normalisation de statut, interdiction de fallback pending/succeeded, index unique déjà existant non dupliqué.
- `financialPaymentMassAssignment.test.js` (2) : aucun champ arbitraire (`status`, `provider`, `providerPaymentId`, `confirmedBy`, `manualValidation.approvedBy`) transmis par l'appelant n'est jamais persisté tel quel.

Non dupliqués (déjà couverts et vérifiés verts sans modification) : permissions manager/owner/collaborateur non rattaché (`financialSecurityHotelAdapter.test.js`), readiness hôtel avec paiement confirmé (`hotelFinancialCheckoutF23.mongo.integration.test.js`), providers historiques CinetPay/Yabetoo préservés (`cinetpayIsolation.test.js` de PAY-2, `legacyPaymentWebhook.mongo.integration.test.js`).

## 35. Gaps

1. Aucun champ de preuve (`proof`) sur `FinancialPayment` pour virement/chèque hôtel (§7/§22) — écart réel, non comblé.
2. Aucune caisse/registre cash dédié (§6) — les espèces restent une simple méthode parmi d'autres, sans contrôle de solde de caisse.
3. Séparation des pouvoirs création/confirmation non stricte au niveau des capacités par défaut (§6 matrice manuelle) — les mêmes rôles ont les deux capacités.
4. Aucun corridor Yabetoo documenté avec preuve (§19).

## 36. Bugs trouvés

Aucun nouveau bug de sécurité trouvé ce sprint (le seul identifié, CinetPay, a été fermé en PAY-2). Aucune régression introduite.

## 37. Architecture cible (confirmée, pas modifiée)

```
FINANCIAL CORE (inchangé)
FinancialPayment → PaymentAllocation → FinancialDocument → FinancialLedgerEntry
        │
   PAYMENT LAYER (nouveau, fin) — paymentProviderRegistry.js
        │
 ┌──────┼───────────────┐
 │      │               │
MANUAL  AUTOMATIQUE      INTERNATIONAL
(actif) (scaffolding)    (Yabetoo, actif ailleurs,
                          non branché au Core)
```

## 38. Provider adapters

`server/services/finance/paymentProviderRegistry.js` — voir §13. Prochaine étape (PAY-4/PAY-5) : remplacer `notImplemented(...)` par une implémentation réelle pour un seul provider à la fois, jamais tous en même temps, avec credentials sandbox et documentation officielle en main avant tout code.

## 39. Mobile Money roadmap

MTN/Airtel directs : scaffolding posé (registre), aucune implémentation. Prochaine étape : obtenir la documentation officielle et des credentials sandbox (mandat §51 : jamais d'appel réel sans cela) avant PAY-4/PAY-5.

## 40. Card roadmap

Aucun changement depuis PAY-1 §44 — PSP toujours non choisi, `card_psp` reste un contrat vide dans le registre.

## 41. Bank transfer roadmap

Fonctionnel (niveau A, manuel) pour l'hôtel comme pour les autres domaines. Ajout du champ de preuve (§7/§22/§35) recommandé comme prochaine amélioration incrémentale, pas un nouveau sprint entier.

## 42. Legacy migration strategy

Inchangée depuis ADR-FIN-007 (PAY-1 §46) — ce sprint n'a rien migré, seulement démontré (par lecture de code et test) que la convergence loyer/vente resterait possible sans dupliquer les moteurs de facture/allocation/solde/readiness/ledger/permissions, conformément à l'exigence centrale du mandat (règle finale de PAY-1 §60, rappelée par PAY-3 §1).

## 43. Risks

| Risque | Sévérité |
|---|---|
| Aucun champ de preuve pour virement/chèque hôtel (contrairement aux autres domaines) | P2 |
| Absence de séparation stricte création/confirmation manuelle | P3 (accepté, cohérent avec la taille actuelle des équipes) |
| Registre de providers non branché à aucune route réelle — reste un contrat mort tant qu'aucun sprint d'implémentation ne le consomme | P3 (attendu, scaffolding volontaire) |

## 44. Priorités P0/P1/P2/P3

- **P0** : aucun (le seul P0 connu, CinetPay, fermé en PAY-2).
- **P1** : aucun nouveau identifié ce sprint.
- **P2** : champ de preuve manquant sur `FinancialPayment` (virement/chèque hôtel).
- **P3** : séparation des pouvoirs création/confirmation ; branchement effectif du registre à un premier provider réel (sprint dédié).

## 45. Next sprint

- **PAY-4** — Implémentation MTN MoMo Direct (sandbox uniquement), en remplaçant l'entrée `mtn_direct` du registre par une implémentation réelle, une fois documentation officielle et credentials sandbox obtenus.
- **PAY-5** — Implémentation Airtel Money Direct (sandbox), même méthode.
- **PAY-6** — Ajout du champ de preuve sur `FinancialPayment` (réutilisation `privateAssetSchema`).
- **PAY-7** — Décision produit + design de la convergence loyer/vente vers `FinancialPayment` (domain `rental`/`real_estate` déjà prévus dans l'enum).
- **PAY-8** — PSP carte, une fois choisi contractuellement.

## 46. Verdict

**PAY-3 : CERTIFIÉ VERT.**

- Architecture provider-agnostic fonctionnelle : ✅ (registre testé, method/provider déjà séparés au niveau schéma).
- Manual payments intégrés comme first-class : ✅ (déjà le cas, audité et confirmé, pas construit ce sprint).
- Aucun nouveau Financial Core parallèle : ✅ (aucun modèle créé, registre posé au-dessus de l'existant).
- Permissions correctes : ✅ (owner lecture seule, client zéro capacité, vérifié par lecture directe de `financialAuthorizationService.js`).
- Mass assignment sécurisé : ✅ (prouvé par test).
- Historical providers préservés : ✅ (aucun modèle/enum historique touché).
- Tests/gates verts : ✅ (120/120 suites serveur, 1372/1372 tests, +2 suites/+19 tests net ; lint 0 erreur ; mongo pertinents verts).
- Aucune intégration externe réelle déclenchée : ✅ (aucun appel réseau possible, aucun secret référencé, tous les adaptateurs automatiques lèvent une erreur stable).

STOP conforme au mandat §38 — aucun sprint MTN/Airtel réel entamé.
