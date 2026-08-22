# RBAC-2 — Matrice rôle → capacités (rôles staff actifs uniquement)

Dérivée exactement de `server/utils/iamArchitecture.js` `DEFAULT_CAPABILITIES` + `ADMIN_ONLY_CAPABILITIES` (RBAC-2). `Admin` et `Collaborateur` possèdent toute capacité via leurs jokers respectifs (`'*'`, `'legacy.full'`) — **aucune permission n'a changé pour ces deux rôles**, la colonne reflète le comportement déjà existant, jamais une extension de RBAC-2.

| Capability | Admin | Collaborateur | Secretaire | GestionnaireImmobilier | CommunityManager | Communicant |
|---|---:|---:|---:|---:|---:|---:|
| `documents.read` | ✓ | ✓ | ✓ | | | |
| `documents.manage` | ✓ | ✓ | ✓ | | | |
| `payments.read` | ✓ | ✓ | ✓ | | | |
| `payments.manage` | ✓ | ✓ | ✓ | | | |
| `payments.reverse` *(RBAC-2 — nouvellement déclaré dans le registre, jamais accordé à un rôle staff nommé)* | ✓ | ✓ | | | | |
| `clients.read` | ✓ | ✓ | ✓ | | | |
| `owners.read` | ✓ | ✓ | ✓ | ✓ | | |
| `tenants.read` | ✓ | ✓ | ✓ | ✓ | | |
| `tenants.manage` | ✓ | ✓ | | ✓ | | |
| `leases.read` | ✓ | ✓ | ✓ | ✓ | | |
| `leases.manage` | ✓ | ✓ | | ✓ | | |
| `properties.read` | ✓ | ✓ | ✓ | ✓ | | |
| `properties.create` | ✓ | ✓ | | ✓ | | |
| `properties.update` | ✓ | ✓ | | ✓ | | |
| `visits.read` | ✓ | ✓ | | ✓ | | ✓ |
| `visits.manage` | ✓ | ✓ | | ✓ | | |
| `rental.read` | ✓ | ✓ | | ✓ | | |
| `rental.manage` | ✓ | ✓ | | ✓ | | |
| `maintenance.read` | ✓ | ✓ | | ✓ | | |
| `maintenance.manage` | ✓ | ✓ | | ✓ | | |
| `notice.read` | ✓ | ✓ | | ✓ | | |
| `notice.manage` | ✓ | ✓ | | ✓ | | |
| `occupancy.read` | ✓ | ✓ | | ✓ | | |
| `occupancy.manage` | ✓ | ✓ | | ✓ | | |
| `payment.status` | ✓ | ✓ | | ✓ | | |
| `altcom.read` | ✓ | ✓ | | | ✓ | |
| `altcom.manage` | ✓ | ✓ | | | ✓ | |
| `events.read` | ✓ | ✓ | | | ✓ | |
| `events.manage` | ✓ | ✓ | | | ✓ | |
| `media.read` | ✓ | ✓ | | | ✓ | |
| `media.manage` | ✓ | ✓ | | | ✓ | |
| `messages.read` | ✓ | ✓ | | | | ✓ |
| `messages.manage` | ✓ | ✓ | | | | ✓ |

## Notes

- **32 capacités nommées** au total (hors jokers), dont **31 préexistantes** et **1 nouvellement enregistrée par RBAC-2** (`payments.reverse` — existait déjà comme exigence de route, jamais comme entrée du registre, voir `RBAC2_SECURITY_MATRIX.md`).
- **Aucune capacité n'a été retirée à aucun rôle.**
- `payment.status` (singulier) et `payments.*` (pluriel) coexistent comme convention de nommage incohérente préexistante (RBAC-1 ne l'avait pas relevé explicitement) — **non corrigée dans ce sprint** (aucune preuve que cette incohérence cause un bug ; documentée pour RBAC-5).
- Cette matrice ne couvre PAS les capacités `hotel.*` (`hotelAccessConstants.js`, scopées par établissement via `HotelStaffAssignment`, jamais par rôle global) ni `financial.*` (`financialAuthorizationService.js`, dérivées du rôle mais dans un fichier séparé, préservé intact) ni `platform.*` (`PlatformOperator`, transversal plateforme, préservé intact) — ces trois systèmes restent des dimensions spécialisées distinctes, conformément au principe architectural de RBAC-2.
