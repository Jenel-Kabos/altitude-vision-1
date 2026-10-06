# C2.9 — Single Organizational State Invariant — Audit transversal

Le brief C2.9 fourni par l'utilisateur est la spécification métier autoritative. Ce document fige l'audit transversal unique préalable aux corrections.

## États canoniques

- `INDEPENDENT` : aucune `OrgMembership` active avec `roleInUnit=owner` et `businessRole=Admin` ne résout un `PlatformTenant` actif/trial.
- `ORGANIZATION_OWNER` : exactement une relation owner/Admin active résout exactement un tenant actif/trial. Le résultat porte son `tenantId`.
- `AMBIGUOUS` : plusieurs relations owner actives, relation owner active non-Admin, racine non résolue ou tenant non exploitable. Aucun tenant n'est choisi.

Ni `createdBy`, ni `User.role`, ni `PlatformOperator`, ni une membership ordinaire, ni un header/body ne produit l'ownership.

## Matrice des chemins

| PATH | CURRENT_BEHAVIOR | RISK | CORRECTION | FINAL_STATUS ATTENDU |
|---|---|---|---|---|
| `POST /api/properties` Web owner | middleware refuse tout owner d'organisation; controller force `null` hors contexte | ne converge pas vers T; contrat C2.9 absent | resolver canonique + tenant serveur | SAFE |
| `POST /api/properties/mobile` | même refus; builder omet tenant | idem | même resolver/middleware | SAFE |
| `POST /api/properties/portfolio` | tenant sélectionné injecté; owner = caller | owner canonique d'un autre tenant pourrait créer un conflit | resolver avec contexte tenant canonique | SAFE |
| Vente/Location complètes | `Property.create(propertyData)` sans garde centrale | peut omettre T selon contrôleur | résoudre avant le write dans l'orchestrateur | SAFE |
| Accommodation complète | tenant dérivé de `actingUser.platformTenant` | contexte acteur peut diverger de l'owner réel | résoudre pour `propertyData.owner` | SAFE |
| Publication mobile Hotel | Hotel force une organisation; transaction existante | ownership doit rester canonique | réutiliser resolver, sans fallback créé par PlatformOperator | SAFE |
| Duplication Accommodation | Property clonée sans tenant, Accommodation reçoit un tenant | crée directement un hybride | conserver/prover la provenance de la Property source | SAFE |
| Duplication Hotel | Property clonée sans tenant, Hotel/Accommodation reçoivent T | crée directement un hybride | Property clonée dans le tenant canonique/source | SAFE |
| Approbation/provisioning organisation | transition transactionnelle de tous les actifs éligibles via classifier C2 | chemin canonique; blockers couverts selon contrats C2 existants | réutiliser, ajouter gate de cohérence | SAFE |
| Onboarding reconstruction locative | tenant pris sur l'acteur | peut attribuer le bien d'un owner à l'organisation de l'acteur | resolver owner + contexte, conflit explicite | SAFE |
| Import `Proprietaire.biensPropres` | tenant pris sur l'acteur staff | même conflit | resolver owner + contexte | SAFE |
| Generic Property update Web/mobile | `tenant`, opérateurs Mongo et chemins pointés exclus | protégé PA-04B0 | aucune modification | SAFE |
| Modération/admin Property | ne change que publication/statut métier | aucun changement de provenance | aucune modification | SAFE |
| Finalisation transaction | disponibilité/publication seulement | aucun changement de provenance | aucune modification | SAFE |
| Régularisation C2.8M | CAS exact `tenant:null → T`, allowlist et autorité dédiées | workflow explicitement autorisé, non exécuté ici | conserver inchangé | LEGACY_ONLY |
| Scripts legacy/migration | scripts dédiés hors routes normales | mutation explicite seulement | aucun lancement; documenter | LEGACY_ONLY |
| Reads/projections/reporting | lecture seule | aucun write | aucune modification | READ_ONLY |

## Causes racines groupées

1. Absence d'un resolver owner-state réutilisable : la preuve owner est recopiée entre middleware, provisioning et discovery.
2. Attribution locale au contexte de l'acteur plutôt qu'à l'owner canonique sur des workflows secondaires.
3. Clones de Property omettant `tenant` alors que leurs satellites reçoivent T.
4. Détection de l'hybride disponible en discovery C2.8M mais pas comme gate permanent réutilisable.

## Invariants d'implémentation

- Le resolver ne mute rien.
- Une création peut recevoir T uniquement depuis l'ownership canonique de l'owner ou un contexte tenant déjà autorisé et compatible.
- Un owner ambigu ou un conflit autre-tenant échoue avant `Property.create`.
- Un hybride legacy est détecté, jamais réparé par C2.9.
- Le provisioning C2 reste l'unique migration automatique de création d'organisation.
- La régularisation C2.8M reste l'unique réparation du cas Mila Events et n'est pas exécutée.
