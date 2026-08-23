# HOTFIX-DASHBOARD-DARK-MODE-UI-1 — Audit

## Architecture réelle

Le layout `client/app/dashboard/layout.jsx` monte `AdminDashboard`, qui rend `.dashboard-shell`, `.dashboard-content` et `.dashboard-content-inner`. Toutes les routes dashboard passent donc dans le contrat CSS central `dashboard.css`.

Les composants récents utilisent `DashboardPage`, `DashboardCard`, `DashboardToolbar`, `DashboardTableContainer`, `DashboardState`, `DashboardTabs` et `DashboardKpiCard`. Les composants historiques utilisent des utilitaires Tailwind de palette claire. Le correctif progressif existant ne couvrait que `white`, quelques `gray`, les champs et les tableaux ; il ne couvrait pas les canvases `slate`, gradients, bordures `slate`, overlays, placeholders ni états sémantiques.

## Root causes prouvées

1. **A/E — contrat du shell incomplet** : les tokens existent mais pas tous les niveaux de surface/interaction.
2. **B/C — pages historiques** : fonds et textes clairs imposés localement.
3. **D — composants experts historiques** : coexistence de palettes `gray`, `slate` et hexadécimales.
4. **F partiel — propagation** : aucune panne de provider puisqu'il n'existe pas ; la source effective est la préférence OS. L'absence de support `.dark` rend néanmoins le système fragile pour une future bascule applicative.
5. **G — combinaison** : le rendu mixte vient de l'addition des quatre causes précédentes.

## Familles de routes découvertes

- Pilotage : racine, reporting, ERP, CRM, organisation, tenants, API platform.
- Immobilier : properties, sales, rentals, estimations, devis, visites, paiements, propriétaires, hébergements.
- Gestion locative : vue d'ensemble, baux, régularisation, locataires, paiements, préavis, maintenance, documents.
- Hôtellerie : établissements, hôtels et détails, chambres, catégories, tarifs, inventaire, staff, réservations, finance, ménage, maintenance.
- Modération : biens, hébergements, hôtellerie, avis.
- Communications : conversations, messages, emails, publicités, contact messages, notifications.
- Administration : utilisateurs, sessions, utilisateurs actifs, historique, litiges, documents, dossiers, transactions, événements, exports et marketing.

## Stratégie retenue

1. Étendre les tokens du shell pour former une hiérarchie complète.
2. Appliquer une couche de compatibilité limitée à `.dashboard-content-inner` pour les pages historiques.
3. Supporter la préférence OS et la classe `.dark` sans créer de second provider.
4. Tokeniser uniquement les styles inline qui ne peuvent pas bénéficier de la couche centrale.
5. Préserver les couleurs sémantiques et les accents métier.
