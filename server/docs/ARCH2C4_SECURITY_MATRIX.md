# ARCH-2C4 — Matrice sécurité

| Invariant | Statut/preuve |
|---|---|
| vente/location/Parcelle | statuts explicitement testés, type non utilisé comme statut |
| publication/modération | aucun prédicat public déplacé; statusAdmin identique |
| tenant/cross-tenant/ownership | absents du helper; 130 tests Mongo ciblés verts |
| IAM/capability/rôles/PlatformOperator | aucun fichier/règle modifié; tests adversariaux ciblés verts |
| businessProfiles/finance | intacts |
| Hotel/Accommodation | controllers testés, contrat HTTP intact |
| side effects | upload Cloudinary identique |
| données production | aucune migration, aucune mutation exécutée |
| frontend/mobile | intacts |
