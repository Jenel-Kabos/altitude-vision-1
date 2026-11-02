# Livraison web

## Changements

- Nouveau composant public sobre et responsive `AssistantPublicDiscovery`.
- Bloc de découverte sur l’accueil et la page immobilière Altimmo.
- Entrée unique « Assistant IA » dans le sous-menu Altimmo.
- Page `/immobilier/assistant` indexable avec métadonnées publiques et sitemap.
- Gate : présentation pour les visiteurs, IA-03 si activé, agent existant pour les comptes autorisés.

La page présente les capacités, quatre exemples, les sources et limites, sans fausse conversation ni bouton inutilisable. Les CTA conduisent aux annonces et à Altimmo.

## Vérifications

- Route locale vérifiée : `http://127.0.0.1:3501/immobilier/assistant`.
- Desktop contrôlé visuellement dans le navigateur intégré.
- Responsive couvert par la grille mobile-first et les tests ; une capture desktop pleine page est conservée.
- Build Next.js : succès, 157 pages générées, route assistant construite.
- Accessibilité : titres sémantiques, liens nommés, focus visible, statut explicite, aucun formulaire actif pour le public.
