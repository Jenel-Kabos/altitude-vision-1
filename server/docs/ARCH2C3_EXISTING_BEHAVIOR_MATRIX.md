# ARCH-2C3 — Comportement existant

| Contexte réel | Résultat existant |
|---|---|
| 0 ou plusieurs tenants actifs/trial | scope entrant stringifié et dédupliqué, sans élargissement |
| exactement 1 tenant actif/trial | ajoute les users non affiliés éligibles |
| OrgMembership existant | user exclu des candidats ajoutés |
| PlatformOperator | user exclu des candidats ajoutés |
| compte technique/inactif/Suspendu/Banni/Supprimé | exclu par filtre Mongo |
| erreur DB | erreur propagée; chaque caller retombe sur le scope brut |
| Admin | les routes existantes l'autorisent en amont; helper neutre au rôle |
| autres rôles listés par le mandat | helper neutre; IAM amont inchangé |
| tenant A + tenant B | élargissement désactivé; aucune inférence cross-tenant |
| ownership propre/étrangère | non évaluée par ce helper; règles aval inchangées |
| PlatformOperator sans tenant sélectionné | refus/sélection requis en amont, inchangé |

Les cas forgés, user/ressource absents et codes HTTP restent traités par middleware/controllers; le helper ne reçoit ni acteur, ni tenantId, ni ressource.
