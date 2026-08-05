# Sprint GL-MOBILE-1 — Rapport d'implémentation

## Résultat

Le portail locataire Web est porté en écran natif mobile. Le mobile consomme les API existantes du portail locataire et n'embarque aucun calcul métier de gestion locative. Les valeurs financières, échéances, statuts, jours restants et règles d'éligibilité restent produits par le backend.

## Architecture et sécurité

- Backend conservé comme source de vérité : `tenantPortalService` résout le locataire à partir de l'utilisateur authentifié et filtre les baux, paiements, documents, préavis et tickets associés.
- Aucun identifiant de locataire fourni par le client n'est utilisé pour élargir le périmètre d'accès.
- Le DTO bail expose les informations GL-LIFE utiles en lecture, mais exclut explicitement les URL de documents d'états des lieux.
- Le téléchargement d'un document reste contrôlé par l'endpoint authentifié existant. Le mode `format=json` fournit seulement, après autorisation, l'URL et le nom nécessaires au téléchargement natif ; le comportement de redirection Web est inchangé.
- Aucune nouvelle collection, migration ou règle métier n'a été ajoutée.

## Parcours natifs livrés

1. Tableau de bord : bail actif, bien, propriétaire, agence, période, prochaine échéance, solde, cycle de vie, caution et alertes.
2. Bail : conditions, historique du cycle, avenants, renouvellements, états des lieux et historique de caution.
3. Paiements : synthèse, échéancier paginé, références, statuts et restes calculés côté serveur.
4. Documents : liste autorisée, ouverture et téléchargement/partage natif après contrôle serveur.
5. Préavis : statut, dates, historique et état des lieux de sortie.
6. Maintenance : tickets, planification, statuts et création avec catégorie, description et jusqu'à cinq photos.

L'écran fournit chargement squelette, erreurs et états vides, rafraîchissement par glissement, pagination, mise en page téléphone/tablette et libellés d'accessibilité.

## Hors ligne

Les lectures réussies sont conservées trois minutes dans le cache mobile existant. En cas d'erreur réseau, une copie disponible peut être affichée en lecture seule. Les mutations ne sont jamais mises en file ni simulées : activation, création de ticket et ajout de photos sont désactivés hors ligne.

## Navigation et notifications

Le registre NAV-CORE contient six destinations canoniques : portail, bail, paiements, documents, préavis et maintenance. Elles convergent vers `Profil > TenantPortal` avec une section déclarative. Les deep/universal links utilisent `espace-locataire/...`. Les types de notification locataire sont résolus côté serveur par ce registre ; aucun nouveau mapping local par type de notification n'a été ajouté aux écrans.

## API réutilisée

`/api/tenant-portal/dashboard`, `/me`, `/lease`, `/leases`, `/payments`, `/documents`, `/documents/:id/download`, `/notice`, `/maintenance`, `/link-status`, `/activate` et `/request-link`.

## Validation

- Backend ciblé : 2 suites, 18 tests réussis.
- Mobile ciblé : 3 suites, 20 tests réussis.
- Backend unitaires : 104 suites, 1 210 tests réussis.
- Backend MongoDB/Replica Set : 49 suites, 400 tests réussis.
- Web Vitest : 75 fichiers, 503 tests réussis.
- Web Playwright : 34 tests réussis sur les profils desktop et mobile.
- Mobile Jest : 22 suites, 219 tests réussis.
- Mobile : syntaxe (145 fichiers), TypeScript et export Android réussis.
- Expo Doctor : 18/18 contrôles réussis.
- Next.js : build de production réussi, 134 pages générées.
- ESLint Backend, Web et Mobile : aucune erreur ; avertissements historiques maintenus.
- `git diff --check` : réussi.

## Risques et dette connue

- Le cache est volontairement mémoire et court : il ne constitue pas un stockage documentaire durable après redémarrage de l'application.
- Le projet reste sur son Expo SDK actuel ; le sprint n'autorise ni ne nécessite une montée de version.
- La présentation mobile centralise les six domaines dans un écran natif unique pour conserver une navigation stable ; une extraction en sous-écrans pourra être faite ultérieurement sans changer les contrats API.
- Les avertissements ESLint préexistants du dépôt ne sont pas traités par ce sprint.

## Fichiers du sprint

### Créés

- `server/docs/GL_MOBILE_1_AUDIT.md`
- `server/docs/GL_MOBILE_1_REPORT.md`
- `altimmo-app/src/screens/TenantPortal/TenantPortalScreen.jsx`
- `altimmo-app/src/services/tenantPortalService.js`
- `altimmo-app/src/services/__tests__/tenantPortalService.test.js`

### Modifiés

- `server/services/tenantPortalService.js`
- `server/controllers/tenantPortalController.js`
- `server/services/navigationService.js`
- `server/__tests__/tenantPortalService.test.js`
- `server/__tests__/navigationRegistry.test.js`
- `shared/navigation/registry.json`
- `altimmo-app/src/navigation/navigationSdk.js`
- `altimmo-app/src/navigation/stacks/ProfilStack.jsx`
- `altimmo-app/src/navigation/__tests__/navigationSdk.test.js`
- `altimmo-app/src/screens/Profil/ProfilScreen.jsx`

## Garanties d'intervention

Aucun commit, push, déploiement, migration, suppression de données ou modification destructive n'a été effectué. Les changements NAV-CORE et MOB-GAP déjà présents dans l'arbre de travail ont été conservés.
