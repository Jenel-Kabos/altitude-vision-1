# Certification Sprint C/D.1.1

Date d'audit : 27 juillet 2026. Branche : `fix/admin-accommodation-form`.

## Portée et état initial confirmé

| Écart | État avant C/D.1.1 | Correction | Preuve principale |
|---|---|---|---|
| Réservation publique Mobile | Écran dépendant d'identifiants techniques | Parcours guidé recherche → succès, clé stable au retry | `HotelBookingScreen.jsx`, test dédié Mobile |
| Calendrier Web | Vue période sans recherche/filtres complets | Semaine/mois, plage, filtres combinés, recherche et actions | `HotelInventoryCalendarPage.jsx`, test dédié Web |
| Reconstruction | Garde `Set` locale à une instance | Lock MongoDB atomique, TTL, heartbeat et owner token | `InventoryOperationLock`, test Replica Set |
| Opérations | Plusieurs mutations multidocuments indépendantes | Transactions ménage, inspection, maintenance, Room/inventaire | services opérationnels et E2E MongoDB |
| Tests réels | Concurrence et cycle final partiels | Tests lock et scénario métier complet sur Replica Set | tests `*.mongo.integration.test.js` |
| Recette manuelle | Aucune preuve | Procédure définie ; exécution indisponible dans cet environnement | section « Recette » ci-dessous |

## Parcours Mobile public

Le client charge une page limitée d'hôtels via `GET /hotels/public`, puis le
détail et les catégories via `GET /hotels/public/:id`. L'utilisateur choisit
l'hôtel, les dates, le nombre de chambres et d'occupants, une catégorie
disponible puis un tarif actif. Aucun identifiant technique n'est éditable.
Le résumé utilise les montants serveur et la création conserve le même
`reservationRequestId` après une erreur incertaine. Une nouvelle clé n'est
créée qu'après abandon explicite ou nouvelle réservation.

Limites métier documentées : le quartier n'est pas exposé par l'API publique
actuelle ; aucune règle de prépaiement ou taxe additionnelle n'existe dans le
modèle `RatePlan`, donc l'interface n'en invente pas.

## Calendrier Web

La requête est bornée à la plage visible et annulée lors d'un changement de
plage. Les vues semaine/mois, catégorie, étage, statut, affectation, arrivées,
départs, non-affectées, hors service, stop-sell, stock bloqué et la recherche
multichamp sont combinables. Les actions d'inventaire utilisent les endpoints
protégés existants ; les actions de réservation délèguent au panneau commun.
Texte, icônes, légende, titres accessibles et focus clavier évitent une
dépendance exclusive à la couleur.

## Verrou distribué et reconstruction

La clé est limitée à l'hôtel, la catégorie et la plage. MongoDB garantit une
acquisition unique. Le document contient un token propriétaire non retourné,
une expiration de cinq minutes et un heartbeat. Une libération n'aboutit que
pour le propriétaire courant ; un lock expiré peut être repris. Une collision
renvoie `INVENTORY_REBUILD_IN_PROGRESS`. Le test réel couvre même scope,
hôtels distincts, expiration, récupération, heartbeat et owner mismatch.

## Transactions et transitions

- Fin de ménage : tâche terminée et `Room cleaning → inspection` dans une
  transaction ; l'échec de transition annule la tâche.
- Inspection : création, décision, chambre et bloc physique sont regroupés.
  Une inspection ne rend jamais une chambre disponible avec un ticket ouvert.
- Maintenance bloquante : ticket, `Room → out_of_service`, bloc physique et
  marquage des réservations affectées sont atomiques. La résolution conserve
  la chambre indisponible ; seule une inspection réussie la remet disponible.
- Changement en séjour : ancienne chambre vers nettoyage, tâche corrective,
  nouvelle chambre occupée et levée du marqueur de réaffectation sont atomiques.
- Les notifications sont envoyées après commit et dédupliquées en base.

## Tests et scénario complet

Le scénario MongoDB crée deux chambres réservées, vérifie le retry idempotent,
confirme, auto-affecte, change avant arrivée, effectue le check-in, ouvre une
maintenance urgente en séjour, réaffecte, termine le ménage, rejette puis
approuve les inspections, réalise un départ anticipé, termine les ménages de
sortie et vérifie inventaire, bloc physique, historique d'affectation et clés
de notification. Aucun modèle MongoDB n'est mocké dans ce scénario.

## Recette manuelle

| Plateforme | Résultat du 27/07/2026 | Preuve/raison |
|---|---|---|
| Chrome desktop/tablette/mobile | Non exécutée | navigateur intégré `iab` indisponible |
| Android | Non exécutée | `adb devices -l` : aucun appareil connecté |
| iOS | Non exécutée | outil Xcode `simctl` absent |
| TalkBack/VoiceOver/zoom 200 % | Non exécutée matériellement | dépend des surfaces ci-dessus |

Procédure à rejouer avant certification 100 % : démarrer Web/API avec une base
de recette, exécuter réservation publique et retry réseau, puis toutes les
actions calendrier en clair/sombre aux largeurs 1440, 768 et 390 px. Sur
Android et iOS, rejouer recherche, réservation, double appui, timeout/retry,
retour arrière, mise en arrière-plan, parcours propriétaire et opérations,
avec grande police, clavier, faible connexion et lecteur d'écran.

## Statut de certification

> Supplanté par `SPRINT_CD12_FINAL_CERTIFICATION.md`, qui applique le
> référentiel officiel C01–C36 / D01–D31 fourni après cette passe.

Les contrôles automatisés ciblés C/D.1.1 sont verts. La certification 100 %
n'est pas prononcée tant que les recettes Web/Android/iOS obligatoires ne sont
pas exécutées et que la gate backend complète n'est pas verte dans un passage
unique. Les identifiants détaillés C01–C36 et D01–D31 ne sont pas définis dans
les spécifications ou le dépôt disponibles : une matrice ligne par ligne ne
peut donc pas être produite honnêtement sans leur référentiel source.
