# UI-WEB-FOOTER-1 — État initial

Date : 2026-08-18. Branche `main`.

## 1. Baseline Git

```
git status --short   → (vide)
git branch --show-current → main
git rev-parse HEAD    → 413308ea54b9160173b8bfa3ddb295a9f8f02426
git diff --check      → exit 0
git diff --stat        → (vide)
```
`HEAD` a changé depuis la clôture d'UX-OWNER-4 (deux commits externes successifs, tous deux intitulés « Update Altimmo 29 », auteur `Altitudevision <altitudevis3n@gmail.com>`) — même schéma déjà documenté à répétition dans les sprints précédents. Aucun `git add`/`commit`/`push` exécuté par cette session.

**Note** : aucune image de maquette de référence n'a été reçue avec ce mandat — la spécification textuelle très détaillée (§1 du mandat) est utilisée comme référence de conception à la place.

## 2. Composant Footer réel identifié

`find . -iname "*footer*"` → **un seul résultat** : `client/lib/components/layout/Footer.jsx` (332 lignes). Aucun footer legacy, aucune duplication. Monté par `client/app/ClientLayout.jsx` (ligne 5, 38), lui-même monté par `client/app/layout.jsx` (racine) — s'affiche donc sur toutes les pages publiques, à l'exclusion de `/dashboard`, `/admin`, `/mes-biens`, `/mes-hotels`, `/mes-hebergements`, `/mon-espace-proprietaire` (déjà exclus par UX-OWNER-1, vérifié intact).

## 3. Audit du footer actuel

- **Fond** : clair (`#F8F8F8`), pas premium/sombre — écart majeur avec la référence.
- **Structure** : déjà 4 zones (Marque, Nos Pôles, Informations, Contact) — pas de refonte structurelle nécessaire, seulement un enrichissement.
- **Nos Pôles** (`LINKS_POLES`) : Altimmo (`/immobilier`), Mila Events (`/evenementiel`), Altcom (`/communication`), Ma Commission (`/trouve-ta-commission`) — 4 routes réelles, déjà correctes.
- **Informations** (`LINKS_INFO`) : Contact, Actualités, Mentions légales, Signaler un problème — **manque « Confidentialité »**, dont la route existe réellement (`/politique-confidentialite`, vérifié `find app -maxdepth 1 -type d`) mais n'est pas liée.
- **Réseaux sociaux** : Facebook, Instagram, WhatsApp — URLs réelles vérifiées (`facebook.com/profile.php?id=61558493665509`, `instagram.com/immoaltitudevision`, `wa.me/242068002151`). **Aucun LinkedIn réel** (recherché exhaustivement — seule une mention textuelle générique dans une page de service Altcom, jamais une URL de compte réel) — confirmé à ne pas ajouter.
- **Contact** : adresse (Rue Mfoa n°24, Poto-Poto, Derrière Canal Olympia, Brazzaville, Congo), email (`contact@altitudevision.agency`), téléphone (`+242 06 800 21 51`) — cohérents avec `AltimmoContact.jsx` (même téléphone).
- **Horaires** : absents du footer actuel. Trouvés réels ailleurs dans le projet (`AltimmoContact.jsx` lignes 34-37) : Lundi-Vendredi 8h-18h, Samedi 9h-14h, Dimanche Fermé — utilisés ici comme horaires généraux de l'agence (mêmes coordonnées que le footer). `MilaContact.jsx` affiche des horaires légèrement différents (8h30-17h30 / 9h-12h) propres au pôle événementiel — un footer global ne peut refléter qu'un seul jeu d'horaires ; celui d'Altimmo est retenu car il correspond au même téléphone/adresse déjà utilisés dans le footer (choix documenté, pas une invention).
- **Newsletter** : absente. `grep` exhaustif (`client/lib/services`, `server/routes`, `server/controllers`) : **aucun endpoint, service ou formulaire newsletter n'existe dans le projet**. Conforme mandat §15 : le bloc ne sera pas créé.
- **Bottom bar** : copyright + « Fait avec ♥ amour à Brazzaville » déjà présents. **Aucun lien** Plan du site / Accessibilité / Conditions générales.
- **Routes non disponibles vérifiées** (`find app -maxdepth 1 -type d`) : `/faq`, `/plan-du-site`, `/accessibilite`, `/conditions-generales` (ou CGU/CGV) — **aucune n'existe**. Conforme mandat §12/§16 : ne pas les inventer, les omettre du footer plutôt que créer des `href="#"`.
- **Accessibilité actuelle** : déjà soignée (contrastes déjà corrigés dans une passe antérieure, `role="heading" aria-level="3"`, zones tactiles 44px, `aria-label` sur réseaux sociaux) — à préserver/reproduire dans la nouvelle version, pas à recommencer de zéro.
- **Responsive actuel** : grid CSS déjà responsive (4 → 2 → 1 colonnes via media queries dans un `<style>` inline) — le mécanisme est correct, seule l'esthétique doit changer.

## 4. Design system réel réutilisable (vérifié dans le code, pas supposé)

- **Fond sombre premium déjà utilisé ailleurs sur le site public** : `#0A0C0F` (`WhyChooseUs.jsx`, section dédiée de la page d'accueil), quasi-identique à `rgba(9,11,14,0.97)` du `Header.jsx` — **même teinte « anthracite premium »**, jamais une nouvelle couleur à inventer.
- **Texte clair sur fond sombre** : `#E8E4DC` (titres/labels), `rgba(232,228,220,0.45)` (corps de texte atténué) — déjà les tokens utilisés par `WhyChooseUs.jsx` sur fond `#0A0C0F`.
- **Or/accent** : `#C8960C` (`GOLD`, déjà une constante nommée dans `Header.jsx`).
- **Bleu secondaire** : `#2E7BB5` (déjà utilisé par `Header.jsx`/`Footer.jsx` actuel/`OwnerDashboard.jsx` — le bleu réel du projet, pas `#185FA5` mentionné dans un guide plus ancien mais non retrouvé dans le code actif).
- **Typographie** : `'Cinzel', 'Cormorant Garamond', Georgia, serif` pour le wordmark (`Header.jsx:109`, « Altitude·Vision » avec point médian doré), `'DM Sans', sans-serif` pour tout le reste — déjà la convention exacte du site, à répliquer à l'identique dans le footer (même wordmark, même baseline « Agence Immobilière »).
- **Icônes** : `lucide-react` (déjà utilisé partout, y compris le footer actuel) + `react-icons/fa` (déjà utilisé par le footer actuel pour Facebook/Instagram/WhatsApp) — aucune nouvelle dépendance nécessaire.

## 5. Contenu de confiance (3 blocs) — validé, pas inventé

Aucune occurrence exacte de « Accompagnement personnalisé » / « Transparence & confiance » / « Rapidité & efficacité » trouvée ailleurs. En revanche, `client/lib/components/WhyChooseUs.jsx` (section réelle de la page d'accueil) contient des promesses **déjà publiées et validées**, sémantiquement très proches :
- « Approche Sur Mesure » — *chaque client reçoit une stratégie personnalisée adaptée à ses besoins et son budget* ≈ Accompagnement personnalisé.
- « Transparence Totale » — *Tarifs clairs, contrats détaillés, suivi régulier. Nous construisons une relation de confiance durable* ≈ Transparence & confiance.
- « Réactivité Totale » — *Nous répondons à chaque demande sous 24h* ≈ Rapidité & efficacité.

Ces 3 promesses (sur les 6 déjà publiées) seront reprises dans le footer avec un libellé raccourci proche de celui du mandat, mais un contenu fidèle à ce qui est déjà validé ailleurs sur le site — jamais une nouvelle promesse commerciale.

## 6. Plan d'implémentation

1. Réécrire `Footer.jsx` en conservant sa structure (4 colonnes + bottom bar), même mécanisme responsive, mêmes routes/coordonnées/réseaux sociaux réels, en changeant uniquement le fond (sombre `#0A0C0F`), les couleurs de texte, en ajoutant le wordmark complet + 3 blocs de confiance + horaires réels + le lien Confidentialité manquant. Aucun newsletter, aucune route fictive.
2. Vérifier dans un vrai navigateur (desktop/tablet/mobile) sur plusieurs pages publiques + confirmer absence sur les dashboards.
3. Tests ciblés (liens réels, réseaux sociaux, absence sur dashboard).
4. Gates (lint, tests, build).
5. Rapport final.

Aucune modification backend, aucune modification mobile prévue.
