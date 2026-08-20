# PAY-3 — État initial

Date : 2026-08-19. Branche `main`.

## 1. Baseline Git

```
git status --short → (vide, worktree propre)
git branch --show-current → main
git rev-parse HEAD → bfdd67c8f8293c690640fab799b2aae062196d7a
git diff --check → exit 0
```

**HEAD a de nouveau avancé extérieurement** depuis la fin de PAY-2 (`f1bb85cda6d63a86ef6afc288b8893d61b0a96cb` → `bfdd67c8f8293c690640fab799b2aae062196d7a`, commit `bfdd67c "Update Altimmo 31"`, auteur `Altitudevision <altitudevis3n@gmail.com>`). Confirmé par `git show --stat HEAD` : ce commit correspond exactement au travail produit par PAY-2 (dépréciation CinetPay — `cinetpayController.js`, `paiementRoutes.js`, tests, rapports `PAY2_*`). Comme pour PAY-1→PAY-2, ce commit n'a pas été créé par cette session — aucun `git commit` n'a été exécuté ici. Worktree propre, aucun travail perdu.

## 2. Rapports lus

`PAY1_ARCHITECTURE_REPORT.md`, `PAY1_PAYMENT_METHOD_MATRIX.md`, `PAY1_DOMAIN_MATRIX.md`, `PAY2_CINETPAY_DEPRECATION_REPORT.md` — relus intégralement (rédigés lors des sprints précédents de cette même conversation). Rapports F1/F1.1/F2.x (`FINANCIAL_CORE_ARCHITECTURE.md`, `FINANCIAL_CORE_IMPLEMENTATION.md`, `HOTEL_FINANCIAL_PAYMENTS_F2_2.md`) déjà lus intégralement en PAY-1, revalidés ponctuellement contre le code réel où pertinent pour ce sprint (voir §4 du rapport final).

## 3. Décision produit rappelée

Cible : MTN MoMo et Airtel Money **directs** (national), manuel déjà fonctionnel (espèces/virement/chèque), Yabetoo repositionné comme complément international selon corridors réellement supportés (plus le défaut national), carte via futur PSP. CinetPay déprécié (PAY-2). Ce sprint construit l'architecture commune permettant à tous ces moyens d'entrer dans le Financial Core existant, sans nouveau moteur parallèle.

## 4. Plan

1. Auditer précisément `FinancialPayment`/`PaymentAllocation`/`FinancialDocument`/`FinancialLedgerEntry` contre les invariants requis (provider, providerPaymentId, method, currency, amount, status, index, idempotence).
2. Confirmer que la séparation method/provider existe déjà (ou l'ajouter si elle manque) sans casser les enums existants.
3. Concevoir un registre de providers (`paymentProviderRegistry`) avec un contrat commun à capacités variables — scaffolding uniquement pour MTN/Airtel/Carte (aucun secret, aucun appel réseau), délégation réelle pour les providers déjà fonctionnels (manuel).
4. Vérifier permissions/mass-assignment sur les routes de paiement manuel existantes (F2.2) plutôt que d'en recréer.
5. Documenter (sans coder) : repositionnement Yabetoo, convergence future loyer/vente, routing national, fallback interdit sur pending/unknown.
6. Tests ciblés (séparation method/provider, mass assignment, doublon provider payment, registre, readiness hôtel, providers historiques préservés).
7. Quatre documents de sortie (`PAY3_UNIFIED_PAYMENT_ARCHITECTURE_ETAT_INITIAL.md`, `PAY3_PAYMENT_PROVIDER_MATRIX.md`, `PAY3_MANUAL_PAYMENT_MATRIX.md`, `PAY3_UNIFIED_PAYMENT_ARCHITECTURE_REPORT.md`).

Aucun appel externe réel (MTN, Airtel, Yabetoo, carte). Aucune route webhook vide créée. Aucune migration des domaines loyer/vente.
