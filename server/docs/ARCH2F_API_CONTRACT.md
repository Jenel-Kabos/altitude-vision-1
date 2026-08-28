# ARCH-2F — Contrat API caractérisé

Endpoint unique : `GET /api/dashboard/stats`, protégé au niveau routeur par `protect` puis `restrictTo(...STAFF_ALL)`.

## Succès

HTTP 200, JSON exact :

```json
{
  "status": "success",
  "data": {
    "stats": {
      "Altimmo": 0,
      "MilaEvents": 0,
      "Altcom": 0,
      "Users": 0,
      "Owners": 0
    }
  }
}
```

Les cinq valeurs sont des nombres retournés par les compteurs ; sur une base vide elles valent `0`. Il n'y a ni date, ni tableau, ni `null`. L'ordre historique des clés est `Altimmo`, `MilaEvents`, `Altcom`, `Users`, `Owners`.

## Erreur de lecture

HTTP 500, JSON exact :

```json
{
  "status": "error",
  "message": "Erreur serveur lors du chargement des statistiques.",
  "error": "<error.message>"
}
```

La caractérisation avant extraction a passé 4/4 tests. Les mêmes tests repassent après extraction. Le service propage l'erreur ; seule la route conserve la traduction HTTP.

