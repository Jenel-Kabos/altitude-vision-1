# PAY-1 — État initial

Date : 2026-08-19. Branche `main`.

## 1. Baseline Git

```
git status --short (extrait pertinent, hérité des sprints UI-MOB de cette même session, non lié à PAY-1)
 M altimmo-app/... (7 fichiers UI-MOB-5/5.1/6/7)
 M client/lib/components/layout/Footer.jsx
 D client/public/images/Logo_Altitude1.png
?? server/docs/UI_MOB*.md, HOTFIX_WEB_FOOTER_LOGO1_REPORT.md (rapports des sprints précédents)
git branch --show-current → main
git rev-parse HEAD → 29044699d25df30d1fffbbadf11fefc9cd6f9cac
git diff --check → exit 0
```

Aucune modification préexistante ne touche `server/models`, `server/routes`, `server/controllers` ou `server/services` liés au paiement — le périmètre PAY-1 démarre sur un backend financier strictement inchangé depuis le dernier sprint financier connu (F2.6).

## 2. Rapports financiers lus

Aucun fichier nommé littéralement `F0`/`F1`/`F1.1`/`Pré-F2.1`/`F2.1` — les sprints financiers réels sous `server/docs/` sont nommés :

- `FINANCIAL_CORE_ARCHITECTURE.md` — spécification F0 (architecture, sans code)
- `FINANCIAL_CORE_IMPLEMENTATION.md` — F1 + durcissement F1.1 (noyau hôtel, MongoDB réel, réconciliation)
- `FINANCIAL_CORE_MONGODB_INTEGRATION.md`, `FINANCIAL_CORE_RECONCILIATION.md` — détails F1.1
- `HOTEL_FINANCIAL_INVOICING_F2_1.md` — F2.1, facturation hôtelière
- `HOTEL_FINANCIAL_PAYMENTS_F2_2.md` — F2.2, encaissements hôteliers manuels + allocation
- `HOTEL_FINANCIAL_CHECKOUT_F2_3.md` — F2.3, blocage financier du check-out
- `HOTEL_FINANCIAL_PDF_EMAIL_F2_4.md` — F2.4, PDF/email de facture
- `HOTEL_FINANCIAL_DASHBOARD_F2_5.md` — F2.5, dashboard financier hôtelier (lecture seule)
- `HOTEL_STAFF_ACCESS_F2_6.md` — F2.6, rattachement Staff→Hôtel (RBAC)
- `HOTEL_FINANCIAL_AUTHORIZATION_AND_CHECKOUT_POLICY.md` — politique d'autorisation
- `server/docs/adr/ADR-FIN-001` à `007` — les sept décisions Accepted de F0
- `PROPERTY_TRANSACTION_ARCHITECTURE.md` — séparation Vente/Location (Sprint A, hors finance mais touche `Transaction`)

Tous lus intégralement pour ce sprint. Conformément au mandat (§1 : « ne te fie pas seulement aux rapports historiques »), chaque affirmation de ces rapports a été revalidée contre le code réel (modèles, routes, contrôleurs) via lecture directe et agents de recherche dédiés — voir `PAY1_ARCHITECTURE_REPORT.md` pour les écarts constatés.

## 3. Méthode

Recherche exhaustive (grep + lecture de fichiers) sur `server/models`, `server/routes`, `server/controllers`, `server/services`, `server/constants`, `.env.example`, `client/`, `altimmo-app/`, pour chaque système de paiement mentionné dans le mandat. Trois investigations déléguées en parallèle (modèles Mongoose, routes/contrôleurs/sécurité webhook, mentions providers + UI web/mobile), chaque résultat revérifié manuellement sur les points critiques (webhook CinetPay notamment, lu intégralement et testé par caractérisation).

Aucun appel externe réel (MTN, Airtel, CinetPay production, carte réelle, virement réel, email/SMS réel) n'a été effectué. Aucune migration, aucun modèle nouveau, aucune route nouvelle créée. Un seul fichier de test de caractérisation ajouté (`server/__tests__/cinetpayWebhookCharacterization.test.js`), aucune logique métier modifiée.

Voir `PAY1_ARCHITECTURE_REPORT.md` pour l'analyse complète, `PAY1_PAYMENT_METHOD_MATRIX.md` et `PAY1_DOMAIN_MATRIX.md` pour les matrices de synthèse.
