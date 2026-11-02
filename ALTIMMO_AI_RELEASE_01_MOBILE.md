# Livraison mobile

L’application Expo existante n’est pas reconstruite autour d’un nouvel agent.

- La carte `AssistantEntryCard` est toujours visible dans le parcours principal des annonces.
- Quand le service est fermé : titre « Assistant immobilier IA », action « Découvrir ».
- Quand le service est disponible : action « Discuter avec l’assistant » et affinage des filtres conservé.
- L’écran désactivé expose désormais la présentation, le statut et les limites au lieu d’un simple refus.
- Le gate, le streaming, la mémoire, l’annulation, la réinitialisation et les fiches existants ne sont pas modifiés.

Le projet réel utilise Expo SDK 57 (`expo ~57.0.26`). La consigne locale demandait aussi la lecture de la référence Expo 56, effectuée avant modification. Aucun nouveau module natif n’a été ajouté.

Lint : zéro erreur (129 avertissements préexistants). TypeScript : succès. Tests assistant : 26/26.

Aucun appareil/émulateur ADB disponible : pas de nouvelle capture Android ni de preuve native dans cette mission. iOS reste non certifié. Une livraison Store nécessite une autorisation et une validation device séparées.
