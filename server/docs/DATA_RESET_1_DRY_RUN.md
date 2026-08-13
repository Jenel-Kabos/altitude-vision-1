# DATA-RESET-1 — Dry-run Phase 1

Date : 2026-08-13  
Statut : **WAITING FOR HUMAN DESTRUCTIVE RESET AUTHORIZATION**

## Manifeste figé

- Database : `altitudevision`
- ResetId : `data-reset-1-20260813`
- Hash revalidé : `e675ec0df7301effde02ddf71a4fc5768976c5cdb0344247bd5283439d0012b1`
- Collections : 104
- Documents : 718
- Collections préservées : aucune
- Stratégie : `DROP_DATABASE_THEN_RECREATE_MODEL_INDEXES_AND_BOOTSTRAP_MINIMUM`
- Dry-run : `writes=0`

## Collections non vides

| Collection | Current | Action | Final expected |
|---|---:|---|---:|
| actionlogs | 169 | reset + nouveaux logs bootstrap | dépend du bootstrap |
| notifications | 163 | reset | 0 |
| messages | 106 | reset | 0 |
| locataires | 34 | reset | 0 |
| roominventories | 32 | reset | 0 |
| internalmails | 31 | reset | 0 |
| conversations | 23 | reset | 0 |
| rateplans | 22 | reset | 0 |
| contrats | 17 | reset | 0 |
| facebookposts | 14 | reset legacy | 0 |
| likes | 13 | reset | 0 |
| users | 11 | reset + nouvel Admin | 1 |
| visites | 9 | reset | 0 |
| quoterequests | 8 | reset | 0 |
| roomcategories | 8 | reset | 0 |
| properties | 7 | reset | 0 |
| contactmessages | 6 | reset | 0 |
| documents | 5 | reset | 0 |
| accommodations | 4 | reset | 0 |
| estimations | 4 | reset | 0 |
| comments | 3 | reset | 0 |
| devis | 3 | reset | 0 |
| hotels | 3 | reset | 0 |
| altcomprojects | 2 | reset | 0 |
| emails | 2 | reset | 0 |
| proprietaires | 2 | reset | 0 |
| publicites | 2 | reset | 0 |
| reviews | 2 | reset | 0 |
| companyemails | 1 | reset | 0 |
| counters | 1 | reset infrastructure | 0 |
| litiges | 1 | reset | 0 |
| orgmemberships | 1 | reset + bootstrap | 1 |
| orgunits | 1 | reset + bootstrap | 1 |
| platformoperators | 1 | reset + bootstrap | 1 |
| platformtenants | 1 | reset + bootstrap | 1 |
| platformtenantsettings | 1 | reset + bootstrap | 1 |
| platformtenantsubscriptions | 1 | reset + bootstrap | 1 |
| platformtenantthemes | 1 | reset + bootstrap | 1 |
| portfolioitems | 1 | reset | 0 |
| rentalmanagements | 1 | reset | 0 |
| signalements | 1 | reset | 0 |

Les 58 autres collections sont déjà à zéro et seront néanmoins recréées depuis les modèles actuels. Le manifeste JSON contient leur tableau exact et les définitions d'index attendues.

## État final et indexes

État minimal : 1 User Admin, 1 PlatformTenant Altitude Vision, 1 root OrgUnit, 1 membership owner, 1 PlatformOperator actif, 1 Settings, 1 Theme, 1 Subscription ; toutes les données métier à zéro. L'index CRM sera créé directement dans sa forme NEW partielle ; CRM-INDEX-MIGRATION-1 devient inutile après le reset.

## Tests jetables

Cycle legacy → drop → indexes critiques → bootstrap → smoke CRM : PASS. Second reset : état minimal identique, aucun doublon. Crash après drop : état vide détecté `RESET_DONE / BOOTSTRAP_PENDING`, puis recovery validée. Résultat : 1 suite, 3/3 tests en 25.839 s.

## Confirmations

**NO REAL DOCUMENT WRITE** · cinq collections vides ont été auto-créées involontairement puis laissées intactes · **CLOUDINARY NO CHANGE** · **ORPHANED CLOUDINARY ASSETS MAY REMAIN** · **NO COMMIT/PUSH/DEPLOY**.
