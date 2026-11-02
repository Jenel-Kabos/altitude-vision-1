# Décisions requises de la Direction

1. Autoriser ou non la création/push de la PR après rétablissement de la CI.
2. Choisir la fenêtre de déploiement web de la présentation publique.
3. Autoriser séparément le déploiement backend interne, avec coupe-circuit LLM actif.
4. Définir l’environnement, les comptes allowlistés et le plafond de la prochaine campagne DeepSeek.
5. Valider la politique de confidentialité, de conservation et d’effacement des conversations.
6. Choisir une mémoire partagée si plusieurs instances backend sont prévues.
7. Exiger un test SSE via le proxy/hébergeur réel avant test interne.
8. Planifier les certifications Android device et iOS avant publication.

## Recommandation

Autoriser d’abord une PR de **présentation publique uniquement**. Ne pas autoriser l’ouverture DeepSeek. Déployer ensuite le backend sur un environnement interne avec fournisseur simulé et coupe-circuit actif, puis certifier les comptes allowlistés. L’ouverture publique doit rester une décision ultérieure distincte.
