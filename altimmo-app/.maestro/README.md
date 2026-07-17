# Scénarios Maestro

Ces scénarios nécessitent un build de développement/preview, un simulateur ou appareil,
et des comptes de test dédiés. Ils ne sont pas exécutés par la validation statique.

Variables requises, injectées dans le shell et jamais commitées:
`TEST_EMAIL`, `TEST_PASSWORD`, `OWNER_TEST_EMAIL`, `OWNER_TEST_PASSWORD`.

Exécution prévue: `maestro test .maestro`. Les sélecteurs devront être stabilisés
avec des `testID` après le premier build preview disponible.
