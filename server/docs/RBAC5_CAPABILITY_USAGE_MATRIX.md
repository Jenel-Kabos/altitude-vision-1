# RBAC-5 — MATRICE D'USAGE DES CAPACITÉS

Pour chaque capacité déclarée dans `server/utils/iamArchitecture.js` (`ALL_CAPABILITIES`, 36 entrées) : combien de points d'application backend (`requireCapability`/`requireCapabilityForStaff`), combien de consommateurs Web (`AdminDashboard.jsx`/`dashboardProfiles.js`, seuls fichiers de production à référencer des chaînes `capability`), combien de consommateurs Mobile (aucun trouvé — RBAC-4 a établi qu'aucune UI mobile n'utilise `can()` en production), quels rôles la déclarent, verdict.

| Capability | Backend consumers | Web | Mobile | Rôles porteurs | Verdict |
|---|---:|---:|---:|---|---|
| `documents.read` | 3 | 1 | 0 | Secretaire | KEEP |
| `documents.manage` | 8 | 0 | 0 | Secretaire | KEEP |
| `payments.read` | 2 | 1 | 0 | Secretaire | KEEP |
| `payments.manage` | 2 | 0 | 0 | Secretaire | KEEP |
| `clients.read` | 0 | 0 | 0 | Secretaire | **KEEP — déclarée, non consommée (voir note)** |
| `owners.read` | 0 | 0 | 0 | Secretaire, GestionnaireImmobilier | **KEEP — déclarée, non consommée** |
| `tenants.read` | 2 | 1 | 0 | Secretaire, GestionnaireImmobilier | KEEP |
| `leases.read` | 2 | 1 | 0 | Secretaire, GestionnaireImmobilier | KEEP |
| `properties.read` | 2 | 0 | 0 | Secretaire, GestionnaireImmobilier | KEEP |
| `properties.create` | 0 | 0 | 0 | GestionnaireImmobilier | **KEEP — déclarée, non consommée** |
| `properties.update` | 1 (route pilote RBAC-2) | 0 | 0 | GestionnaireImmobilier | KEEP |
| `tenants.manage` | 1 | 0 | 0 | GestionnaireImmobilier | KEEP |
| `visits.read` | 3 | 1 | 0 | GestionnaireImmobilier, Communicant | KEEP |
| `visits.manage` | 2 | 0 | 0 | GestionnaireImmobilier | KEEP |
| `rental.read` | 4 | 1 | 0 | GestionnaireImmobilier | KEEP |
| `rental.manage` | 5 | 0 | 0 | GestionnaireImmobilier | KEEP |
| `leases.manage` | 1 | 0 | 0 | GestionnaireImmobilier | KEEP |
| `maintenance.read` | 2 | 1 | 0 | GestionnaireImmobilier | KEEP |
| `maintenance.manage` | 8 | 0 | 0 | GestionnaireImmobilier | KEEP |
| `notice.read` | 0 | 1 | 0 | GestionnaireImmobilier | KEEP — consommée côté Web uniquement |
| `notice.manage` | 3 | 0 | 0 | GestionnaireImmobilier | KEEP |
| `occupancy.read` | 0 | 0 | 0 | GestionnaireImmobilier | **KEEP — déclarée, non consommée** |
| `occupancy.manage` | 3 | 0 | 0 | GestionnaireImmobilier | KEEP |
| `payment.status` | 0 | 0 | 0 | GestionnaireImmobilier | **KEEP — déclarée, non consommée** (naming legacy `payment.status` singulier vs `payments.*` pluriel, incohérence déjà notée RBAC-2 §46c, aucun bug prouvé, non corrigée) |
| `altcom.read` | 2 | 1 | 0 | CommunityManager | KEEP |
| `altcom.manage` | 2 | 1 | 0 | CommunityManager | KEEP |
| `events.read` | 0 | 1 | 0 | CommunityManager | KEEP — consommée côté Web uniquement |
| `events.manage` | 1 | 0 | 0 | CommunityManager | KEEP |
| `media.read` | 0 | 0 | 0 | CommunityManager | **KEEP — déclarée, non consommée** |
| `media.manage` | 0 | 0 | 0 | CommunityManager | **KEEP — déclarée, non consommée** |
| `messages.read` | 0 | 0 | 0 | Communicant | **KEEP — déclarée, non consommée** |
| `messages.manage` | 0 | 0 | 0 | Communicant | **KEEP — déclarée, non consommée** |
| `properties.own` | 0 (mécanisme ownership séparé) | 0 | 0 | Proprietaire | KEEP — marqueur de portée, jamais gaté via `requireCapability` par conception (mandat §21, ownership orthogonal) |
| `accommodation.own` | 0 (idem) | 0 | 0 | Proprietaire | KEEP — idem |
| `client.self` | 0 (idem) | 0 | 0 | Client, User | KEEP — idem |
| `provider.self` | 0 (idem) | 0 | 0 | Prestataire | KEEP — idem |
| `payments.reverse` | 1 | 0 | 0 | *(aucun rôle nommé — `ADMIN_ONLY_CAPABILITIES`, accessible via `*`/`legacy.full` uniquement)* | KEEP — protection particulière (mandat §34), voir `RBAC5_SECURITY_MATRIX.md` |

## Note sur les 8 capacités "déclarées, non consommées"

`clients.read`, `owners.read`, `properties.create`, `occupancy.read`, `media.read`, `media.manage`, `messages.read`, `messages.manage` sont accordées à un rôle par `DEFAULT_CAPABILITIES` mais **n'ont aucun point d'application** — ni un `requireCapability(...)` backend, ni une entrée `capability:` dans `AdminDashboard.jsx`/`dashboardProfiles.js`, ni un usage mobile (le mobile n'a aucun consommateur `can()` de production, RBAC-4). Seules leurs occurrences dans des **fixtures de test** (`AdminDashboardDomains.test.jsx`, `dashboardProfiles.test.js`, tous deux réécrits en RBAC-5 pour ne plus dépendre du `staffCapabilities.js` supprimé) les mentionnent.

**Non supprimées.** Mandat §33 : une capacité n'est supprimable que si aucun consommateur backend/Web/Mobile **et** aucune documentation contractuelle **et** aucun test métier valide ne l'attend. Ici, le test métier "métier" n'existe pas (seules des fixtures techniques les citent), mais la déclaration elle-même dans `DEFAULT_CAPABILITIES` **est** le contrat — c'est l'affirmation que "tel rôle staff a droit à telle action", même si aucune route ne le vérifie encore explicitement. Supprimer la déclaration reviendrait à modifier silencieusement ce que le rôle est censé pouvoir faire (le jour où un développeur ajoute enfin la route `properties.create`, par exemple), ce que le mandat interdit strictement (§28 : RBAC-5 n'est pas un sprint d'expansion, mais pas non plus de rétraction, du modèle IAM). **Verdict : KEEP — CONTRACT UNCLEAR**, documenté pour une décision produit future plutôt que supprimé par prudence.
