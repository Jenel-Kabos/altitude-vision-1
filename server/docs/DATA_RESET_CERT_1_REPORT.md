# DATA-RESET-CERT-1 — Rapport

Date: 2026-08-13

## 1. Executive Summary

La certification complète est interrompue au contrôle P0 : aucune rotation du mot de passe Admin bootstrap exposé n'est prouvée. Aucune opération destructive ni écriture en base n'a été réalisée.

## 2. DATA-RESET-1 Baseline

Baseline documentaire consultée : reset de 718 documents et 104 anciennes collections, puis bootstrap minimal et recréation de 103 collections Mongoose actuelles. Cette baseline n'a pas été recertifiée au-delà du contrôle P0 durant ce run.

## 3. Database

La lecture ciblée a utilisé la connexion configurée vers `altitudevision`. Le host et les credentials n'ont pas été affichés.

## 4. Collections

NON EXÉCUTÉ — arrêt P0 avant recomptage des 103 collections.

## 5. Counts

NON EXÉCUTÉ — les comptes de la baseline DATA-RESET-1 n'ont pas été redéclarés comme certifiés.

## 6. Residual Legacy Data

NON EXÉCUTÉ — arrêt P0.

## 7. Admin User

Lecture ciblée : compte trouvé, `role=Admin`, `status=Actif`, `tokenVersion=0`. Aucun champ secret n'a été lu ou affiché.

## 8. Password Exposure Incident

Le mot de passe bootstrap DATA-RESET-1 a été exposé dans une session terminal et reste considéré compromis.

## 9. Password Rotation

NON CERTIFIÉE. `passwordChangedAt` est absent, `tokenVersion` vaut `0`, et `updatedAt` est identique à `createdAt` (`2026-08-13T15:27:09.371Z`).

## 10. PlatformTenant

NON EXÉCUTÉ — arrêt P0.

## 11. OrgUnit

NON EXÉCUTÉ — arrêt P0.

## 12. OrgMembership

NON EXÉCUTÉ — arrêt P0.

## 13. PlatformOperator

NON EXÉCUTÉ — arrêt P0.

## 14. Settings

NON EXÉCUTÉ — arrêt P0.

## 15. Theme

NON EXÉCUTÉ — arrêt P0.

## 16. Subscription

NON EXÉCUTÉ — arrêt P0.

## 17. ActionLog

NON EXÉCUTÉ — arrêt P0.

## 18. Indexes

NON EXÉCUTÉ — arrêt P0.

## 19. CRM Index

NON EXÉCUTÉ durant cette certification. La baseline indique le nouvel index partiel ; aucune migration n'a été relancée.

## 20. Property

NON EXÉCUTÉ — arrêt P0.

## 21. Property Portfolio

NON EXÉCUTÉ — arrêt P0.

## 22. GL

NON EXÉCUTÉ — arrêt P0.

## 23. Hotel

NON EXÉCUTÉ — arrêt P0.

## 24. Accommodation

NON EXÉCUTÉ — arrêt P0.

## 25. Conversations

NON EXÉCUTÉ — arrêt P0.

## 26. CRM

NON EXÉCUTÉ — arrêt P0.

## 27. Marketing

NON EXÉCUTÉ — arrêt P0.

## 28. Finance

NON EXÉCUTÉ — arrêt P0.

## 29. Documents

NON EXÉCUTÉ — arrêt P0.

## 30. Organization

NON EXÉCUTÉ — arrêt P0.

## 31. Reporting

NON EXÉCUTÉ — arrêt P0.

## 32. ERP

NON EXÉCUTÉ — arrêt P0.

## 33. API Platform

NON EXÉCUTÉ — arrêt P0.

## 34. Empty States

NON EXÉCUTÉ — arrêt P0.

## 35. Tenant Resolution

NON EXÉCUTÉ — arrêt P0.

## 36. Tenant Selector

NON EXÉCUTÉ — arrêt P0.

## 37. Tenant Security

NON EXÉCUTÉ — arrêt P0.

## 38. Platform Admin Security

NON EXÉCUTÉ — arrêt P0.

## 39. Backend Unit

NON EXÉCUTÉ — arrêt P0.

## 40. Backend Mongo

NON EXÉCUTÉ — arrêt P0.

## 41. Web Vitest

NON EXÉCUTÉ — arrêt P0.

## 42. Next Build

NON EXÉCUTÉ — arrêt P0.

## 43. Playwright

NON EXÉCUTÉ — arrêt P0.

## 44. Mobile

NON EXÉCUTÉ — arrêt P0.

## 45. Health / Verify

NON EXÉCUTÉ — arrêt P0.

## 46. ESLint

NON EXÉCUTÉ — arrêt P0.

## 47. Log Redaction

La requête de preuve a projeté uniquement des métadonnées non secrètes. Aucun mot de passe, hash, URI Mongo complète ou jeton n'est reproduit dans les livrables.

## 48. Cloudinary

Aucun appel et aucun nettoyage. **LEGACY/ORPHANED CLOUDINARY ASSETS MAY STILL EXIST.**

## 49. Credentials

Aucun credential fournisseur n'a été modifié. `SEC-CREDENTIAL-ROTATION-1` reste distinct et ouvert.

## 50. Remaining Risks

- Le mot de passe bootstrap exposé n'est pas prouvé remplacé.
- L'ensemble des contrôles post-P0 reste à exécuter.
- Les credentials fournisseurs historiquement exposés restent hors périmètre de ce run.

## 51. Files Created

- `server/docs/DATA_RESET_CERT_1_AUDIT.md`
- `server/docs/DATA_RESET_CERT_1_REPORT.md`

## 52. Files Modified

Aucun fichier existant n'a été modifié par ce run. Le worktree antérieur a été préservé.

## 53. Real Data Operations

Une seule lecture MongoDB ciblée et projetée. Zéro écriture, zéro seed, zéro restauration legacy, zéro donnée métier créée.

## 54. Commands Executed

- `git status --short`
- `git diff --stat`
- `git diff --check`
- lectures des documents et du code d'authentification avec `sed`/`rg`
- lecture MongoDB ciblée du compte Admin, sans champ password/hash

## 55. Commands Not Executed

Login, envoi d'email, mutation de mot de passe, recomptage complet, audit legacy/index, appels API fonctionnels, suites unitaires/Mongo/Vitest/Playwright/Mobile, build, lint, health et verify : non exécutés en raison du STOP P0.

## 56. Final Verdict

**PARTIALLY CERTIFIED — PASSWORD ROTATION REQUIRED**

## 57. Exact Next Step

Le propriétaire du compte doit ouvrir l'interface Web normale, utiliser **Mot de passe oublié**, définir un nouveau mot de passe unique et ne pas le transmettre à Codex. Il doit ensuite confirmer uniquement que la rotation est terminée. La reprise commencera par une preuve en lecture seule (`passwordChangedAt` présent, `tokenVersion` incrémenté), sans afficher ni demander le nouveau mot de passe.

Confirmations : aucun commit, push, deploy, seed métier, retour de donnée legacy, appel/cleanup Cloudinary, changement de credential fournisseur ou secret affiché. Aucun test non exécuté n'est déclaré PASS.
