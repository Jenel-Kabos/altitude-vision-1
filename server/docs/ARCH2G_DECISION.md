# ARCH-2G — Décision

## NEXT RECOMMENDED SPRINT: ARCH-2H — DEVIS ROUTE APPLICATION BOUNDARY

- Scope : les trois handlers de `devisRoutes.js` (POST `/`, GET `/`, PATCH `/:id`) et l'unique edge `devisRoutes.js → Devis.js`.
- Cible : extraire une abstraction étroite `devisApplicationService` (ou contrôleur + service applicatif), sans façade générique.
- Gain attendu : `route→model 13 → 12`; autres compteurs stables.
- Risque : **MEDIUM**, principalement mutations, contrat HTTP et effets email/notification best effort.
- Pourquoi : responsabilité cohérente, aucune frontière tenant/ownership/PlatformOperator, aucune finance, aucun Cloudinary, un seul modèle.
- Non-objectifs : modifier les règles/statuts, providers, schéma, sécurité, API, frontend/mobile, routes Estimation ou legacy.
- Gates : caractérisation HTTP+Mongo POST/GET/PATCH, auth/404/validation, transitions et attribution staff, ordre/populate, providers en succès/échec; tests complets, lint, architecture PASS, diff-check.
- STOP : tout écart de statut/body/side-effect, découverte d'un scope tenant implicite ou nécessité d'une façade transverse.

Le sprint n'est pas exécuté par ARCH-2G.
