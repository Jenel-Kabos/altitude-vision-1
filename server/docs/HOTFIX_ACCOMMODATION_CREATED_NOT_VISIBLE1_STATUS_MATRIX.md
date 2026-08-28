# HOTFIX-ACCOMMODATION-CREATED-NOT-VISIBLE-1 — Matrice des statuts

## Cycle de vie `Accommodation.publicationStatus`

```
brouillon → (submit, gardé par evaluateReadiness) → soumis → (reviewDecision) → publie
                                                        ↓ reject
                                                     rejete → (update) → brouillon
publie → (suspend) → suspendu → (unsuspend) → publie
```

## Avant ce hotfix

| Point d'entrée création | `publicationStatus` résultant | Voie de sortie disponible |
|---|---|---|
| `POST /accommodations` (propriétaire self-service, `exports.create`) | `brouillon` | `/mes-hebergements` → bouton "Soumettre" → `POST /accommodations/:id/submit` |
| `POST /accommodations/admin` (staff, `exports.createFull`) | `brouillon` | **Aucune** — `/mes-hebergements` existe mais n'est jamais lié dans la sidebar staff |
| `POST /accommodations/mobile/full` (mobile, `createFullMobileAccommodation`) | `soumis` (auto-soumis dans la même transaction) | Modération, immédiatement |

## Après ce hotfix

| Point d'entrée création | `publicationStatus` résultant | Voie de sortie disponible |
|---|---|---|
| `POST /accommodations` (propriétaire self-service) | `brouillon` — **inchangé** | Identique — le propriétaire garde le contrôle explicite de la soumission |
| `POST /accommodations/admin` (staff) | `soumis` si `evaluateReadiness` passe, sinon `brouillon` (**inchangé** pour ce cas) | Modération, immédiatement si prêt — alignement avec le flux mobile |
| `POST /accommodations/mobile/full` (mobile) | `soumis` — **inchangé** | Identique |

## Pourquoi seul le point d'entrée staff (`createFull`) est modifié

- Le point d'entrée propriétaire (`exports.create`) a un contrat déjà prouvé et volontaire : `MyAccommodationsPage.jsx` affiche explicitement l'état "Brouillon" avec un bouton "Soumettre" dédié — c'est une étape de relecture intentionnelle avant engagement, non un bug. Le modifier serait une refonte non demandée par ce mandat.
- Le point d'entrée staff (`createFull`) n'a **aucune** UI de relecture équivalente exposée dans le tableau de bord admin (`ManageAccommodationsPage.jsx` ne montre que les hébergements déjà `publie`) — il s'agit d'un geste "ajout direct", structurellement identique au geste "publication mobile atomique" qui, lui, auto-soumet déjà. L'absence d'auto-soumission ici est l'anomalie, pas la règle.
