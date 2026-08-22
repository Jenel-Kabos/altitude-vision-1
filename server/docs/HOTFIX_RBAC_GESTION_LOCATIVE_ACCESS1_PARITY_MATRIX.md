# HOTFIX-RBAC-GESTION-LOCATIVE-ACCESS-1 — MATRICE DE PARITÉ (APRÈS CORRECTION)

| Role | Menu | Page | APIs principales (Contrat/Propriétaire/Locataire — mutation) | Onboarding/désactivation mandat | Contrat delete | Tenant | Verdict |
|---|---|---|---|---|---|---|---|
| Admin | ALLOWED (tout) | ALLOWED | ALLOWED | ALLOWED | ALLOWED | Scope tenant appliqué (`requireTenantScope`/`assertResourceTenantOrUnattributed`) | **PARITÉ** |
| Collaborateur | ALLOWED (tout, `legacy.full`) | ALLOWED | **ALLOWED (corrigé)** | DENIED (inchangé, volontaire) | DENIED | Scope tenant appliqué | **PARITÉ** |
| GestionnaireImmobilier | ALLOWED (capacités déclarées) | ALLOWED | ALLOWED | ALLOWED | **DENIED (corrigé)** | Scope tenant appliqué | **PARITÉ** |
| Secretaire | CONDITIONAL (Baux/Locataires/Paiements/Documents visibles, pas Vue d'ensemble/Préavis/Maintenance) | ALLOWED (lecture uniquement) | DENIED | DENIED | DENIED | N/A (lecture) | **PARITÉ** (inchangé, déjà correct) |
| CommunityManager | Aucune entrée de menu GL | ALLOWED à charger la coquille (gate dashboard générique), toutes les données refusées en 403 | DENIED | DENIED | DENIED | N/A | **PARITÉ FONCTIONNELLE** — aucune fuite possible, dette mineure documentée (gate de layout large, hors périmètre) |
| Communicant | Idem CommunityManager | Idem | DENIED | DENIED | DENIED | N/A | **PARITÉ FONCTIONNELLE**, même dette mineure |
| Proprietaire/Client/User/Prestataire | N/A | N/A (hors `ALLOWED_ROLES` du dashboard) | DENIED | DENIED | DENIED | N/A | **PARITÉ** (inchangé) |

## Preuve de non-régression sur ce qui était déjà correct

- Onboarding/désactivation de mandat : comportement **strictement identique** avant/après (variable `canManage` non modifiée, testé explicitement — `Admin`/`GestionnaireImmobilier` voient toujours le bouton, `Collaborateur` ne le voit toujours pas).
- Menu Secretaire/CommunityManager/Communicant : capacités inchangées, `AdminDashboard.jsx`/`dashboardProfiles.js` non modifiés par ce hotfix.
- `checkPermission` (fonction déclarée mais jamais appelée dans le fichier) et `canManage` de `ContratDetailModal` (variable déclarée mais jamais utilisée dans ce sous-composant) : code mort préexistant, non touché — hors périmètre de ce hotfix (candidat futur pour un nettoyage de type RBAC-5, non exécuté ici).
