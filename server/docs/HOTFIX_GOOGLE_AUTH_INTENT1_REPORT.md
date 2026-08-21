# HOTFIX-GOOGLE-AUTH-INTENT-1 — Rapport final

## Verdict

**GO SOUS RÉSERVES — NON CERTIFIÉ VERT.**

La séparation métier est implémentée et couverte localement. Le Samsung est connecté, mais la validation réelle ne peut pas exercer le nouveau backend tant qu'il n'est pas déployé ; le mandat interdit précisément tout déploiement. Aucun résultat device n'est donc inventé.

## Correction

- Le mobile traduit uniquement les surfaces fermées `Login` et `Signup` en `intent: login|signup`.
- Le backend valide toute intention explicite avant la vérification Google.
- `login` + compte absent retourne 404 `ACCOUNT_NOT_FOUND`, sans création ni JWT.
- `signup` + compte existant retourne 409 `ACCOUNT_ALREADY_EXISTS`, sans liaison, création ni JWT.
- Les branches historiques Login existant et Signup absent conservent leurs réponses 200/201 et leurs sessions.
- L'absence d'intention garde temporairement le contrat Web NextAuth login-or-create pour éviter une rupture non atomique.

## Réponses obligatoires

1. **Même endpoint ?** Oui, mobile Login et Signup utilisaient `/api/auth/google`.
2. **Intention connue avant ?** Non.
3. **Pourquoi Signup reconnectait ?** Le backend exécutait `User.findOne(email)`, puis Login/link si trouvé, sans connaître la surface.
4. **Nouveau contrat ?** Champ fermé `intent: login|signup`, avec 404/409 métiers.
5. **Validation ?** Oui ; autre valeur → 400 `INVALID_AUTH_INTENT` avant Google.
6. **Login existant ?** Oui, 200 + JWT en test.
7. **Login absent crée ?** Non ; 404 `ACCOUNT_NOT_FOUND`.
8. **Signup absent crée ?** Oui, exactement un User puis 201 + JWT en test séquentiel.
9. **Signup existant crée une session ?** Non.
10. **Code Signup existant ?** 409 `ACCOUNT_ALREADY_EXISTS`.
11. **Rejeu Signup ?** Le test séquentiel crée une fois puis retourne 409. L'index unique email protège aussi la persistance ; un test Mongo concurrent n'a pas été jugé nécessaire pour ce hotfix de branchement.
12. **Liaison email/password affectée ?** Préservée pour Login et fallback legacy ; Signup conflict ne lie jamais silencieusement.
13. **Google sub utilisé ?** Oui, conservé dans `googleId`; la recherche initiale reste par email, politique existante inchangée.
14. **`email_verified` ?** Toujours strictement requis.
15. **Rôle sécurisé ?** Oui ; `Admin` forgé est ignoré et devient `Client`, vérifié par test.
16. **OrgMembership ?** Inchangé, aucune création ajoutée.
17. **Web non régressé ?** Le payload sans intention conserve le comportement historique et est testé. La séparation Web Login/Register reste une migration ultérieure explicite.
18. **Mobile Login Samsung ?** Nouveau contrat non testé contre backend déployé : **NON CONFIRMÉ**.
19. **Mobile Signup existing Samsung ?** **NON CONFIRMÉ**, backend non déployé.
20. **Mobile Signup new Samsung ?** Non testé ; aucun compte de production inutile créé.
21. **Token loggé ?** Non ; seulement longueurs/étapes déjà sûres.
22. **Tests ?** 13 ciblés backend, 26 ciblés mobile ; suites complètes vertes.
23. **Gates ?** Voir tableau.
24. **Fichiers modifiés par ce hotfix ?** Contrôleur backend, helper Google mobile, AuthContext, deux suites de tests et trois documents.
25. **Git ?** Aucun add, commit, push, deploy ou reset.
26. **Verdict ?** GO SOUS RÉSERVES faute de preuve device sur le backend corrigé.

## Gates

| Gate | Résultat |
|---|---|
| Backend Google ciblé | 13/13 verts |
| Backend unit complet | 1438/1438, 125 suites |
| Backend lint | 0 erreur, 106 avertissements préexistants |
| Mobile Google/Auth ciblé | 26/26 verts |
| Mobile complet | 402/402, 46 suites |
| Mobile lint | 0 erreur, 106 avertissements |
| TypeScript | Vert |
| Android export `--clear` | Vert, bundle généré |
| Samsung ADB | Présent : `SM_S918B` |
| Samsung avec backend corrigé | Non testable sans déploiement |
| `git diff --check` | Vert |

## Réserve et validation finale

Après mise à disposition autorisée du backend corrigé, tester sur Samsung : Login avec compte existant → session ; Signup avec ce même compte → message de conflit et aucune session ; si un compte de test légitime existe, Login absent → aucun compte et Signup absent → un seul compte. Le verdict pourra alors devenir CERTIFIÉ VERT.
