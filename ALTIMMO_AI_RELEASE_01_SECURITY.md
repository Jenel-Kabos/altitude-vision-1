# Sécurité et confidentialité

- Aucun secret ajouté, lu ou affiché.
- Aucun accès direct MongoDB depuis l’agent ou les interfaces.
- Aucun appel DeepSeek réel et aucune dépense.
- Aucune donnée privée ajoutée à la présentation.
- Aucune capacité de paiement, réservation, notification ou modification d’annonce.
- Les annonces restent fournies par les outils serveur et la projection publique existante.
- La découverte publique n’importe aucun service de conversation.

La mémoire conversationnelle actuelle reste locale au processus. Une mémoire partagée exigerait une décision de conservation/confidentialité avant toute production multi-instance ; elle n’est pas introduite ici.

Le SSE n’est certifié que par les tests locaux existants. Le backend advisor absent de Render empêche toute affirmation de compatibilité proxy en production.

Avant ouverture réelle : analyse juridique et confidentialité, durée de conservation, politique d’effacement, audit des journaux, validation des données transmises au fournisseur et plafond budgétaire approuvé.
