# Décisions requises de la Direction

1. Régulariser le verrouillage Billing GitHub, puis autoriser la relance des trois workflows de la PR #32.
2. Faire examiner la PR brouillon ; ne la passer en ready et ne la fusionner qu'après CI réellement exécutée et revue humaine.
3. Confirmer dans Render le SHA, la branche, le root directory et les commandes actuellement déployés. Les routes sont présentes, mais le SHA public est inconnu.
4. Décider si une nouvelle opération backend est encore nécessaire ; si oui, l'autoriser séparément avec provider simulé et flags fermés.
5. Examiner la preview Vercel/Netlify lorsqu'elle est terminée, puis choisir une fenêtre de déploiement web distincte.
6. Choisir entre build mobile interne `1.0.2` recommandé et OTA compatible `1.0.1`; autoriser séparément build, OTA ou soumission Store.
7. Maintenir DeepSeek public fermé. Toute campagne LIVE, dépense ou changement de budget nécessite une autorisation distincte.

Recommandation opérationnelle : lever d'abord le blocage GitHub, obtenir des checks verts, examiner les previews et confirmer le SHA Render. La PR peut ensuite être revue ; aucune fusion ni production ne doit intervenir avant ces trois preuves.
