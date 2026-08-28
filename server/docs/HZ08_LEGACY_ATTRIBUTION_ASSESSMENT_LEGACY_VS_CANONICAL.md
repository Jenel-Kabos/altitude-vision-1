# HZ-08 — Legacy versus canonique

| Aspect | Legacy | Canonique actuel |
|---|---|---|
| Donnée | tenant absent/null ou relation historique insuffisante | champ tenant direct ou preuve relationnelle déterministe |
| Autorisation | `assertResourceTenantOrUnattributed` autorise unresolved | `assertResourceTenant` exige resolved exact |
| Compatibilité read | nécessaire pour anciennes ressources/self-service | strict pour ressources entièrement attribuées |
| Write | certaines routes LIVE peuvent encore muter une ressource unresolved | nouveaux flows dérivent/posent le tenant côté serveur selon domaine |
| Régularisation | audit A–F | manifest transactionnel uniquement pour A déterministe |

L'audit réel déjà documenté a trouvé 376 ressources : A=67, B=50, C=0, D=43, E=0, F=216. Le dry-run a préparé 67 candidats déterministes (Property 2, RentalManagement 1, Visite 2, Conversation 9, Message 50, Document 1, Hotel 1, Accommodation 1) avec `writes=0`. L'apply réel n'a pas été autorisé et reste bloqué/documenté.

Le legacy READ demeure nécessaire pour B/D/F tant qu'une décision humaine ou une réparation relationnelle n'existe pas. Le legacy WRITE est une dette distincte : le remplacer uniformément par la garde stricte casserait les contrats libres, les propriétaires sans OrgMembership et les conversations génériques.

Le service canonique existe et est réutilisable, mais il ne peut inventer le tenant d'une ressource B/D/F. Aucune migration de schéma n'est requise pour les types exécutables portant déjà un champ tenant ; des décisions de données et éventuellement des évolutions ciblées par modèle restent nécessaires.

