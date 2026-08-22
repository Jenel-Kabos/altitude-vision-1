# RBAC-2 — Matrice de nommage des capacités

## Convention auditée

`server/utils/iamArchitecture.js` utilise déjà, de façon cohérente sur 31 des 32 capacités, la convention `domaine.action` (`properties.read`, `rental.manage`, `documents.manage`, `visits.read`...) — la même convention que `hotelAccessConstants.js` (`hotel.reservation.create`) et `platformOperatorConstants.js` (`platform.tenants.manage`). **Une seule capacité préexistante dévie** : `payment.status` (singulier, sans action verbale claire — `status` n'est ni `read` ni `manage`). Non renommée par RBAC-2 (renommer casserait la route qui la consomme sans preuve qu'un bug en découle — hors périmètre, documenté pour RBAC-5).

**RBAC-2 n'a introduit aucune nouvelle convention.** `payments.reverse` (rendu visible au registre) suit exactement `domaine.action`, cohérent avec `payments.read`/`payments.manage` déjà existants.

## Table (mandat §43)

| Domaine | Action | Capability actuelle | Nouvelle ? | Justification |
|---|---|---|---|---|
| Property (patrimoine, transition de cycle de vie) | Modifier l'état d'un bien (transition) | `properties.update` | Non — déjà déclarée (`GestionnaireImmobilier`) | Réutilisée telle quelle pour la route pilote (`propertyAssetRoutes.js` `POST /:id/transition`) — résout exactement à `{Admin, GestionnaireImmobilier, Collaborateur}` = `STAFF_IMMO`, prouvé par test. Aucune capacité créée. |
| Paiements (Gestion Locative) | Annuler/inverser un encaissement | `payments.reverse` | **Techniquement oui pour le registre `ADMIN_ONLY_CAPABILITIES`, mais la chaîne de caractères elle-même existait déjà dans le code de route** (`paiementRoutes.js`, sprint antérieur non documenté dans RBAC-1) | La route l'exigeait déjà ; RBAC-2 ne fait que la rendre visible et validable dans le registre canonique, sans changer aucun accès réel (voir `RBAC2_SECURITY_MATRIX.md` pour la preuve de non-régression). |

## Capacités conceptuelles NON créées dans ce sprint (mandat §9/§44)

RBAC-1 avait esquissé des capacités conceptuelles pour les domaines encore role-only (Property CRUD de base, Modération, CRM, Litiges, Estimations/Devis, Conversations). **Aucune n'a été créée dans RBAC-2** — le mandat limite explicitement ce sprint à un socle staff global restreint et à une seule route pilote. Elles restent une proposition pour RBAC-2 (suite)/RBAC-3, à instancier domaine par domaine avec la même discipline de caractérisation avant/après que la route pilote de ce sprint.

## Anti-pattern évité (mandat §44)

Aucune capacité "fourre-tout" (`admin.all`, `everything.manage`) n'a été créée — le joker `'*'` d'Admin et `'legacy.full'` de Collaborateur, déjà existants, remplissent ce rôle de façon délibérée et documentée ; les ajouter comme capacités nommées aurait été redondant. Aucune micro-capacité superflue n'a été ajoutée non plus — `payments.reverse` correspond à une action réellement distincte (annulation, pas simple lecture/gestion) déjà exigée par le code.
