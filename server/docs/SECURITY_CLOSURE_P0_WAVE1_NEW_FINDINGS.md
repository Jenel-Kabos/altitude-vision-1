# SECURITY-CLOSURE-P0-WAVE-1 — Findings découverts fortuitement (non corrigés)

Conformément au mandat (§3) : tout nouveau P0 découvert directement sur le chemin nécessaire à l'un des 5 correctifs doit être documenté ici, sans étendre automatiquement le sprint.

## `adminController.js` — `adminStatus` n'est pas un champ du schéma `Property`

En corrigeant P0-E, la reproduction rouge a révélé que `approveProperty`/`rejectProperty` (`property.adminStatus = 'approved'|'rejected'`) et `getPendingProperties` (`Property.find({adminStatus: 'pending'})`) opèrent sur un champ **qui n'existe pas** dans `models/Property.js` (seul `statusAdmin` existe, avec des valeurs différentes : `'En attente'`, `'Validée'`, etc.). Par le comportement par défaut de Mongoose (`strict: true`), toute affectation à `adminStatus` est silencieusement ignorée à la sauvegarde — `getPendingProperties` retourne donc toujours un tableau vide, et `approveProperty`/`rejectProperty` ne modifient jamais réellement la propriété en base, indépendamment de toute question de tenant.

**Ce n'est pas un problème de sécurité** (aucun accès ni mutation non autorisée n'en résulte — l'endpoint est simplement fonctionnellement inerte sur ce champ précis) et **n'est pas l'un des 5 P0 de ce sprint**. Non corrigé, conformément à la règle de scope strict (§3, §30). Documenté ici pour un futur ticket produit/qualité — probablement un candidat à la suppression complète de ce chemin legacy plutôt qu'à sa réparation, étant donné que `propertyController.js` fournit déjà l'équivalent fonctionnel correct via `statusAdmin`.

## Aucun autre nouveau P0 découvert

Les 4 autres lots (P0-A, P0-B, P0-C, P0-D) n'ont révélé aucun problème additionnel au-delà de ce qui était déjà documenté dans `TENANT_SCOPE_HORIZONTAL_CLOSURE_REAUDIT1_FINDING_MATRIX.md`.
