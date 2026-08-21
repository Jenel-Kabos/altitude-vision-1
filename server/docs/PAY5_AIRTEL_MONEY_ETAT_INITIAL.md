# PAY-5 — Airtel Money Direct — État initial

## Baseline

- Branche : `main`
- HEAD : `15506a7b113742ad266cc5977ff06164b6c04994`
- `git diff --check` : vert.
- Worktree propre au démarrage de PAY-5.
- Aucun commit, push, déploiement, credential ou appel financier réel.

## Existant

Le Financial Core canonique repose sur `FinancialPayment`, `PaymentAllocation`, `FinancialDocument` et `FinancialLedgerEntry`. PAY-4 fournit déjà le découpage transport MTN → adapter → bridge hôtel → services financiers canoniques, avec idempotence métier et status inquiry avant confirmation.

`airtel_direct` existe dans les constantes et le registre. Avant PAY-5, il n'était pas intégré au Financial Core et ses trois opérations levaient `FINANCIAL_PROVIDER_NOT_IMPLEMENTED`. Malgré cela, ses capabilities étaient à tort annoncées actives et une table `pending/success/failed/cancelled` non sourcée existait.

Aucun fichier transport/adapter Airtel, aucune route Airtel, aucune variable `AIRTEL_*`, aucun credential sandbox et aucune spécification officielle Airtel n'existent dans le dépôt.

## Recherche officielle

- Le [portail développeur officiel Airtel Congo](https://developers.airtel.cg/home) confirme un portail API local et un parcours inscription → choix d'un produit → test → go-live.
- Le [communiqué officiel Airtel Africa](https://www.airtel.africa/assets/pdf/press-release/Airtel-Africa-Developer-Portal_ENGLISH.pdf) confirme que le portail propose des API de collection et de décaissement après inscription et enregistrement d'une application.
- Le [site Airtel Congo](https://www.airtel.cg/airtelmoney/howItWork) confirme Airtel Money au Congo, les paiements de biens/services et l'usage du franc CFA dans le service grand public.

La documentation technique détaillée est derrière authentification. Les endpoints, headers, auth, statuts, callback, format MSISDN API et devise de collection ne sont pas accessibles dans les sources officielles publiques examinées.

## Décision fail-closed

La règle « documentation officielle avant tout code réseau » interdit une implémentation basée sur des snippets communautaires. PAY-5 corrige donc seulement les déclarations mensongères du registre : capabilities Airtel à `false` et mapping de statut vide. L'intégration réseau reste bloquée jusqu'à fourniture de la documentation officielle et d'un sandbox.
