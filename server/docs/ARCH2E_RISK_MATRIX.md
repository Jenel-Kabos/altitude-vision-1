# ARCH-2E — Matrice risque et priorité

Scores 1–5 ; priorité indicative = `(gain × testabilité) / (risque × coût)`.

| Candidate | Gain | Risk métier | Cost | Testability | Blast radius | Security risk | Score | Priority |
|---|---:|---:|---:|---:|---:|---:|---:|---|
| Reporting transversal | 4 | 4 | 4 | 3 | 5 | 4 | 0,75 | 3 |
| Route→Model, programme complet | 4 | 3 | 3 | 4 | 3 | 4 | 1,78 | 1 |
| Property Architecture globale | 5 | 5 | 5 | 2 | 5 | 5 | 0,40 | 4 |
| `runPropertySearch` | 3 | 4 | 3 | 3 | 3 | 2 | 0,75 | 2 ex æquo |
| Pilote `dashboardRoutes` seulement | 3 | 1 | 2 | 4 | 1 | 1 | 6,00 | **NEXT** |

Le score ne décide pas seul : le pilote dashboard gagne car il retire quatre fuites DB dans une unité cohérente, sans traverser tenant, IAM, mutation ou publication. Le plus grand gain théorique est Property, mais son risque produit/sécurité et son rayon d'explosion l'excluent.

Risques spécifiques : Reporting peut casser scopes Hotel/tenant et chiffres financiers ; route→model varie fortement selon cluster ; Property peut casser publication/modération/ownership ; Search peut exposer des annonces non publiées ou changer la pagination.
