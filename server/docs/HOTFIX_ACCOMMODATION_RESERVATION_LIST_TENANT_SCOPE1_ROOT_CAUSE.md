# Cause racine

Dans `list`, `const query = {}` est créé avant la branche RBAC. Pour un rôle reconnu par `isStaff`, `resolveTenantForUser(...)` pouvait retourner `null`; le code n'ajoutait `query.tenant` que dans `if (tenant?._id)`. L'absence de tenant conservait donc `{}` et produisait `Reservation.find({})`/`countDocuments({})` : fail-open global.

Un staff classique atteignait ce chemin parce que la route n'avait que `auth.protect`. Le PlatformOperator global est différent : sa source signée `platform_operator_unscoped` prouve un mode plateforme légitime, reconnu par le middleware canonique. La correction ajoute uniquement ce middleware à la route GET ; aucun filtre ad hoc, controller, mutation ou modèle n'est modifié.
