# HOTFIX-RBAC-GESTION-LOCATIVE-ACCESS-1 — CONTRAT MÉTIER

## Méthode

Le contrat n'est pas déduit "au jugé" : il est extrait du **backend déjà en production**, qui est la source d'autorité (RBAC-1→5). Le backend applique aujourd'hui, sans ambiguïté et sans avoir été modifié par ce hotfix, trois populations différentes selon l'action précise (voir `HOTFIX_RBAC_GESTION_LOCATIVE_ACCESS1_ENDPOINT_MATRIX.md`). Le contrat retenu ici est donc : **le frontend doit refléter exactement ces trois populations backend déjà existantes**, ni plus, ni moins — aucune permission backend n'est changée par ce hotfix.

## Contrat par rôle et par famille d'action

| Rôle | Onboarding / désactivation mandat | Création/édition Contrat, CRUD Propriétaire+biens, CRUD Locataire | Suppression Contrat | Menu "Gestion locative" |
|---|---|---|---|---|
| Admin | ALLOWED | ALLOWED | ALLOWED | ALLOWED (tout) |
| Collaborateur | DENIED | **ALLOWED** (corrigé — était DENIED côté frontend, backend l'autorisait déjà) | DENIED | ALLOWED (tout, via `legacy.full`) |
| GestionnaireImmobilier | ALLOWED | ALLOWED | **DENIED** (corrigé — était visible côté frontend, backend refusait déjà) | ALLOWED (capacités déclarées) |
| Secretaire | DENIED | DENIED | DENIED | CONDITIONAL — voit Baux/Locataires/Paiements/Documents (capacités `leases.read`/`tenants.read`/`payments.*`/`documents.*`), ne voit pas Vue d'ensemble/Préavis/Maintenance (pas de `rental.read`/`maintenance.*`/`notice.*`) |
| CommunityManager | DENIED | DENIED | DENIED | Aucune capacité GL déclarée → aucune entrée de menu visible, mais peut atteindre l'URL directement (gate dashboard générique `ALLOWED_ROLES`) et voir une page vide/en erreur sur les appels API (backend refuse, comportement déjà correct par construction) |
| Communicant | DENIED | DENIED | DENIED | Idem CommunityManager, sauf `visits.read` (non pertinent pour GL) |
| Proprietaire | DENIED (espace propriétaire séparé) | DENIED | DENIED | N/A — hors `ALLOWED_ROLES` du dashboard staff, jamais concerné |
| Client | DENIED | DENIED | DENIED | N/A |
| User (legacy) | DENIED | DENIED | DENIED | N/A |
| Prestataire | DENIED | DENIED | DENIED | N/A |

## Justification par rôle

- **Admin** : joker `*`, aucune ambiguïté, contrat déjà correct des deux côtés, non modifié.
- **Collaborateur** : `DEFAULT_CAPABILITIES.Collaborateur = ['legacy.full']`, qui `getEffectiveCapabilities` développe en `ALL_CAPABILITIES` — il possède donc `leases.manage`, `tenants.manage`, et est dans `STAFF_IMMO`. Le backend l'autorise déjà sur la création/édition de Contrat et le CRUD Propriétaire/Locataire. Aucune preuve backend ne le distingue de `GestionnaireImmobilier` sur CES actions précises. Il reste en revanche explicitement exclu de l'onboarding/désactivation de mandat (`restrictTo('Admin','GestionnaireImmobilier')`, sans `Collaborateur`) — une restriction **délibérée et spécifique à ces deux actions**, distincte du reste du domaine GL, non remise en cause ici (mandat : ne pas élargir silencieusement).
- **GestionnaireImmobilier** : rôle central du domaine, capacités `properties.*`, `tenants.*`, `rental.*`, `leases.*`, `maintenance.*`, `notice.*`, `occupancy.*` — mais **pas** `payments.reverse` ni de droit de suppression de Contrat, qui reste `adminOnly` par choix backend explicite (protection déjà documentée sur les suppressions sensibles, cohérent avec `payments.reverse` réservé à Admin/Collaborateur ailleurs dans le système — ici Collaborateur n'est pas non plus concerné, la suppression de Contrat est strictement Admin).
- **Secretaire** : ses capacités (`documents.*`, `payments.*`, `clients.read`, `owners.read`, `tenants.read`, `leases.read`, `properties.read`) sont **toutes en lecture ou sur des sous-domaines documentaires/paiements**, jamais `tenants.manage`/`leases.manage`/`rental.*`. Le contrat backend confirme qu'elle n'a jamais eu de droit de mutation sur Propriétaire/Locataire/Contrat/RentalManagement — seulement sur Documents et Paiements (déjà géré par la variable `canDoc`, non touchée par ce hotfix). Le menu reflète déjà correctement cette frontière (capacités par lien), aucune correction nécessaire ici.
- **CommunityManager/Communicant** : aucune capacité GL déclarée (`altcom.*`/`events.*`/`media.*` pour CM ; `messages.*`/`visits.read` pour Communicant) — confirmé par `iamArchitecture.js`, mandat §18 respecté ("staff ≠ accès à tous les domaines"). Ils peuvent atteindre l'URL `/dashboard/gestion-locative` (gate dashboard générique large), mais tous les appels API échouent en 403 — comportement déjà correct, non un bug de ce hotfix (voir section "Hors périmètre" ci-dessous).
- **Proprietaire/Client/User/Prestataire** : hors `ALLOWED_ROLES` du layout dashboard, jamais concernés — profils métier externes, non staff (mandat §23-25).

## Ce qui N'A PAS pu être prouvé et reste volontairement inchangé (fail-closed)

Le fait que `CommunityManager`/`Communicant` puissent physiquement charger la coquille de `/dashboard/gestion-locative` (sans y voir de données, toutes leurs requêtes API étant refusées) est un **constat**, pas une divergence de sécurité prouvée — aucune fuite de donnée n'est possible (backend fail-closed sur chaque endpoint). Resserrer le gate générique du layout dashboard pour cette page spécifique serait un changement d'UX plus large touchant potentiellement d'autres pages partageant le même layout, hors du périmètre strict de ce hotfix (qui porte sur `canManage`/`canDoc`, pas sur le gate de layout). **Non corrigé — documenté comme dette mineure, GO tel quel sur ce point précis.**

## Verdict du contrat

Le contrat métier **est prouvé** pour les deux divergences identifiées (Collaborateur trop restreint, GestionnaireImmobilier trop permissif sur la suppression de Contrat) — preuve directe par lecture du code backend déjà en production, jamais modifié, jamais ambigu. **Correction autorisée, côté frontend uniquement** (mandat §33 : backend correct, frontend incorrect → corriger le frontend seulement).
