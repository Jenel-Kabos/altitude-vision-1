# SECURITY-CLOSURE-P1-WAVE-1 — Nouveaux blockers (P0) découverts

Aucun nouveau P0 directement exploitable n'a été découvert pendant la correction des 10 P1 de ce sprint.

## Findings fortuits documentés (non corrigés, hors périmètre strict)

- **`adminController.js` (`property.adminStatus`)** — déjà documenté dans `SECURITY_CLOSURE_P0_WAVE1_NEW_FINDINGS.md` (bug fonctionnel préexistant, sans rapport avec le tenant, non corrigé).
- **`realEstateApplicationController.getOne` (populate cassant une comparaison `String(application.applicant)`)** — découvert en travaillant sur P1-D : `getOne` peuple `applicant` (`.populate('applicant', ...)`), rendant `String(application.applicant) !== String(req.user._id)` toujours vrai même pour le candidat légitime lui-même. Bug fonctionnel préexistant (confirmé par lecture du diff : la ligne de populate existait avant ce sprint), **pas un problème de sécurité** (il est plus restrictif, pas plus permissif — un candidat légitime pourrait être bloqué à tort sur son propre dossier via ce chemin précis, jamais l'inverse). Non corrigé, hors périmètre strict de RA-08 (qui concerne l'absence de frontière tenant pour le staff, pas ce bug de comparaison). Documenté ici pour un futur ticket qualité.

Ni l'un ni l'autre ne justifie un `BLOCKED` ou une extension du périmètre de ce sprint — tous deux sont soit déjà documentés, soit strictement moins permissifs que le comportement historique (jamais une nouvelle voie d'exploitation).
