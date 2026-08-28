# État initial

- Branche `main`, HEAD `a04055f62952c782b92aeef2f100824a17a5f645`; worktree déjà fortement modifié par des travaux antérieurs.
- Baseline architecture : 471 fichiers, 1528 edges, service→controller 2, controller→controller 1, route→model 12/11, cycles 0, imports non résolus 0, nouvelles violations 0.
- Les cinq routes vivantes étaient protégées par authentification seulement. `transition()` chargeait par ObjectId et `canManage()` accordait tout rôle staff, sans comparaison de tenant.
- Le finding horizontal statique est revalidé. La reproduction rouge runtime antérieure au patch n'a pas été capturée dans un run archivé : elle reste donc `NON CONFIRMÉE` au sens strict du protocole.

