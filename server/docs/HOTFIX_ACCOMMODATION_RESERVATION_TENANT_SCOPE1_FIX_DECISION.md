# Décision de correction

Cause : `canManage()` assimilait le rôle staff à une autorisation ressource globale après un `findById` non scopé.

Correction : réutiliser la factory canonique du contexte tenant via une politique générique staff/global-operator, uniquement sur les cinq routes ; charger ensuite la réservation avec `_id + tenant` dans le controller et transmettre ce document au service. Le même document est autorisé puis muté, ce qui évite un second lookup non borné et réduit le TOCTOU.

Alternatives rejetées : modifier le schéma, réécrire tout le service, filtrer après mutation, ou étendre la correction aux routes hors périmètre. Aucun changement de modèle ni de règle métier n'est nécessaire.

