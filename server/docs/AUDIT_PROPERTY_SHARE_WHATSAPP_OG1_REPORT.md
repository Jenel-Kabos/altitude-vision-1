# AUDIT-PROPERTY-SHARE-WHATSAPP-OG-1 — Rapport

**Verdict : A. ROOT CAUSE CONFIRMED — MOBILE SHARES WRONG CANONICAL URL**
**Audit strictement en lecture seule. Aucun fix appliqué. Aucune mutation Mongo. Aucun commit, push ou déploiement.**

## 0. Baseline (§3 du mandat)

- Branche `main`. HEAD : `4cc40f85e6cdc5a8da469be8f9e3bc795750a1e5` (a avancé depuis le mandat précédent — `36080a7` → `4cc40f8`, commit `Update Altimmo 45`, effectué par l'utilisateur entre les deux sessions, hors de mon contrôle).
- `git status --short` : **vide**. `git diff --check` : **vide**. Worktree parfaitement propre au démarrage — aucun résidu à documenter, aucun hotfix préexistant en cours (favoris, Dashboard Dark Form Contrast, hotfixes Home mobile) n'était en état modifié à ce stade, tous déjà committés par l'utilisateur.
- Aucune action destructive exécutée. Rien écrasé.

## 1. Trace du partage mobile (§4)

Fichier : `altimmo-app/src/screens/Annonces/DetailAnnonceScreen.jsx`.

```js
const partagerBien = useCallback(async () => {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  const webLink = `https://altitudevision.agency/annonces/${annonce?._id}`;
  try {
    await Share.share({
      title:   title,
      message: `${title}${addressText ? '\n' + addressText : ''}\n${fmt(prix)} FCFA\n\n${webLink}`,
      url:     webLink,
    });
    api.post(`/properties/${annonce?._id}/share`).catch(() => {});
  } catch { /* annulé */ }
}, [annonce?._id, title, addressText, prix]);
```

Chaîne exacte : bouton partage (`Ionicons name="share-social-outline"`, ligne ~1054-1058) → `onPress={partagerBien}` → construction de `webLink` → `Share.share()` (API React Native native) → texte + URL envoyés à WhatsApp. Aucun helper/service intermédiaire — l'URL est construite **inline, en dur**, directement dans l'écran.

## 2. URL construite (§5)

```
https://altitudevision.agency/annonces/${annonce._id}
```

`annonce` provient de `fetchAnnonceDetail()` (`propertyMapper.js`), qui pour `resourceType: 'property'` appelle `GET /properties/:id` — `annonce._id` est donc bien un **`Property._id`** (jamais un `Accommodation._id` séparé), conformément à la convention déjà établie dans ce mandat précédent (un item hébergement est toujours un `Property` avec `accommodationType` attaché).

## 3. Identifiant du cas réel (§6)

Vérification read-only via l'API publique (aucune mutation) :

```
GET https://altitude-vision.onrender.com/api/properties/6a911186cbe20b4c495d6591
→ HTTP 200, resource trouvée, title="VILLA MEUBLEE AU PLATEAU DE 15 ANS", status="hebergement"

GET https://altitude-vision.onrender.com/api/accommodations/public/6a911186cbe20b4c495d6591
→ HTTP 404 "Hébergement introuvable."
```

**Confirmé : `6a911186cbe20b4c495d6591` est un `Property._id` valide et réel, pas un `Accommodation._id`.** L'ID utilisé par le mobile est correct au niveau ressource.

## 4. Publication / visibilité (§20)

Champs lus sur la réponse `GET /properties/:id` : `statusAdmin: "Validée"`, `availability: "Disponible"`, `isPublished: true`, `owner` présent, `tenant` présent. **La ressource est publiquement visible et correctement validée** — ce n'est pas un problème de visibilité métier.

## 5. Matrice Property vs Accommodation (§17)

| Élément | ID |
|---|---|
| Item mobile (`annonce._id`) | `6a911186cbe20b4c495d6591` |
| Property | `6a911186cbe20b4c495d6591` (confirmé, HTTP 200) |
| Accommodation (séparé) | N/A — aucun document `Accommodation` distinct pour cet ID (`/accommodations/public/:id` → 404) |
| Support Property | Sans objet — le concept de « support Property » distinct d'un Accommodation ne s'applique pas ici : le bien est directement un `Property` avec `accommodationType: "villa_meublee"` attaché |
| URL partagée | `https://altitudevision.agency/annonces/6a911186cbe20b4c495d6591` |
| Route web attendue | `https://altitudevision.agency/immobilier/property/6a911186cbe20b4c495d6591` (voir §7) |

## 6. Route web réelle (§7)

Recherche exhaustive dans `client/app/` : **aucune route `app/annonces/[id]/page.jsx` n'existe et n'a jamais existé** dans ce projet. Les routes réellement présentes pour l'immobilier :

```
app/immobilier/property/[propertyId]/page.jsx   ← détail d'un bien (route canonique réelle)
app/immobilier/hotels/[hotelId]/page.jsx        ← détail d'un hôtel
app/immobilier/annonces/page.jsx                ← LISTE des annonces (pas un détail, pas de [id])
app/properties/edit/[id]/page.jsx               ← édition (dashboard, protégé)
app/[...slug]/page.jsx                          ← catch-all racine
```

`app/immobilier/property/[propertyId]/page.jsx` est un fichier complet et fonctionnel : `generateMetadata()` avec titre/description/image dynamiques, JSON-LD (`RealEstateListing`, `BreadcrumbList`, et `VacationRental` pour le cas hébergement), appel `GET /properties/:id` avec `revalidate: 60`.

## 7. Test direct de l'URL production (§8, §16)

```
curl -A "Mozilla/5.0" https://altitudevision.agency/annonces/6a911186cbe20b4c495d6591
→ HTTP 308 → redirige vers https://www.altitudevision.agency/annonces/6a911186cbe20b4c495d6591
→ HTTP 200, x-matched-path: /[...slug]
```

Le domaine sans `www` redirige (308, normal, Vercel) vers `www.altitudevision.agency`. Aucune redirection Netlify/rewrite anormale détectée. **Hébergement réel : Vercel** (en-tête `server: Vercel`, `x-vercel-id`) — à noter que le guide du projet (CLAUDE.md) mentionne Netlify comme hébergeur frontend ; l'observation directe en production montre Vercel. Ceci est documenté ici pour mémoire, sans investigation supplémentaire (hors périmètre de ce mandat).

**Point clé** : `x-matched-path: /[...slug]` — Next.js a matché la requête sur le **catch-all racine**, pas sur une route dédiée `/annonces/[id]` (qui n'existe pas).

## 8. HTML SSR — contenu exact (§9, §10)

```html
<title>Page introuvable | Altitude-Vision</title>
<meta name="description" content="Altitude-Vision — Immobilier, Événementiel et Communication à Brazzaville."/>
<link rel="canonical" href="https://altitudevision.agency"/>
<meta property="og:title" content="Page introuvable | Altitude-Vision"/>
<meta property="og:description" content="Altitude-Vision — Immobilier, Événementiel et Communication à Brazzaville."/>
<meta property="og:url" content="https://altitudevision.agency"/>
<meta property="og:type" content="website"/>
<meta name="twitter:card" content="summary_large_image"/>
<meta name="twitter:title" content="Page introuvable | Altitude-Vision"/>
```

**Réponse à la question critique (§10) : OUI**, « Page introuvable | Altitude-Vision » est **littéralement présent dans le HTML servi côté serveur**, avant toute exécution JavaScript. Ce n'est donc **pas** un problème de rendu côté client, ni un problème spécifique à WhatsApp — le serveur lui-même sert ces métadonnées à **n'importe quel client**, humain ou crawler.

## 9. Code exact produisant ce titre (§14, §26)

`client/app/[...slug]/page.jsx` — fichier intégral :

```jsx
import { buildMetadata } from '@/lib/seo';
import NotFoundPage from "@/lib/pages/NotFoundPage";

export const metadata = buildMetadata({ title: 'Page introuvable', noIndex: true });

export default function Page() {
  return <NotFoundPage />;
}
```

Ce composant **ignore totalement `params.slug`** — `metadata` est une constante statique au niveau module (pas une fonction `generateMetadata`), donc strictement identique quel que soit le chemin qui matche ce catch-all. N'importe quelle URL ne correspondant à aucune route Next.js déclarée (dont `/annonces/<n'importe-quoi>`) produit exactement ce même HTML.

## 10. User-Agent crawler (§11)

```
UA "WhatsApp/2.23.20.0 A" sur /annonces/<id>            → même HTML, "Page introuvable"
UA "facebookexternalhit/1.1" sur /immobilier/property/<id> → HTML correct, bon titre
```

**Le comportement est strictement identique quel que soit le User-Agent** — confirme que ce n'est ni un blocage anti-bot, ni un comportement spécifique WhatsApp : c'est le SSR lui-même qui sert des métadonnées différentes selon la **route**, pas selon le visiteur.

## 11. generateMetadata de la route réelle (§12, §13)

`app/immobilier/property/[propertyId]/page.jsx` :
```js
export async function generateMetadata({ params }) {
  const { propertyId } = await params;
  const property = await getProperty(propertyId);
  if (!property) return buildMetadata({ title: 'Bien immobilier — Altimmo', url: `/immobilier/property/${propertyId}` });
  return buildMetadata({
    title:       `${property.title} — ${property.type || 'Bien'} à ${city}`,
    description: `...`,
    image:       property.images?.[0],
    url:         `/immobilier/property/${propertyId}`,
  });
}
```
`getProperty()` appelle `GET ${NEXT_PUBLIC_API_URL}/properties/:id` avec `next: { revalidate: 60 }`. **`generateMetadata` et le composant `Page()` (rendu réel) utilisent exactement la même fonction `getProperty()`** — même source, aucune divergence entre metadata et contenu affiché.

## 12. Preuve que la route réelle fonctionne parfaitement (§8, §21, §22)

Test direct, sans authentification, sur la **vraie** route canonique, pour le bien exact du bug :

```
curl -A "Mozilla/5.0" https://www.altitudevision.agency/immobilier/property/6a911186cbe20b4c495d6591
→ HTTP 200, x-matched-path: /immobilier/property/[propertyId]

<title>VILLA MEUBLEE AU PLATEAU DE 15 ANS — Villa à Brazzaville | Altitude-Vision</title>
<link rel="canonical" href="https://altitudevision.agency/immobilier/property/6a911186cbe20b4c495d6591"/>
<meta property="og:title" content="VILLA MEUBLEE AU PLATEAU DE 15 ANS — Villa à Brazzaville | Altitude-Vision"/>
<meta property="og:url" content="https://altitudevision.agency/immobilier/property/6a911186cbe20b4c495d6591"/>
<meta property="og:image" content="https://res.cloudinary.com/dop8vzm5z/image/upload/v1787892102/altitude-vision/properties/tinlup06iblskcgzjjqq.jpg"/>
<meta property="og:image:width" content="1200"/>
<meta property="og:image:height" content="630"/>
```

`og:image` : URL **absolue**, **HTTPS**, Cloudinary (hébergement d'image existant et fiable du projet), avec `width`/`height` explicites (1200×630, format standard OG). Aucune correction nécessaire côté image/metadata — tout est déjà correct sur la vraie route.

## 13. Comparaison Hébergement vs Vente/Location (§25, §26) — exclusion du cas ACCOMMODATION-SPECIFIC

| Cas | Route testée | HTTP | Title | og:title | og:image |
|---|---|---:|---|---|---|
| Hébergement (bien du bug, `.../annonces/<id>`) | `/annonces/6a911186cbe20b4c495d6591` | 200 | "Page introuvable \| Altitude-Vision" | idem (générique) | absent |
| Hébergement, **route correcte** | `/immobilier/property/6a911186cbe20b4c495d6591` | 200 | "VILLA MEUBLEE AU PLATEAU DE 15 ANS — Villa à Brazzaville \| Altitude-Vision" | idem | Cloudinary, absolue, 1200×630 |
| Vente (`PARCELLE A VENDRE`), `.../annonces/<id>` | `/annonces/6a89f9bcbbb632e80e727ec4` | 200 | "Page introuvable \| Altitude-Vision" | idem (générique) | absent |
| Vente, **route correcte** | `/immobilier/property/6a89f9bcbbb632e80e727ec4` | 200 | "PARCELLE A VENDRE — Parcelle à Brazzaville \| Altitude-Vision" | idem | Cloudinary, absolue |

**Conclusion de la comparaison : le bug affecte `/annonces/<id>` pour TOUTE ressource, hébergement ou vente/location indifféremment. Ce n'est donc PAS un bug spécifique aux hébergements/accommodations** (hypothèse du §2 du mandat explicitement écartée par la preuve) — c'est un **GLOBAL ROUTE BUG**, causé uniquement par le fait que le mobile construit une URL vers une route qui n'a jamais existé côté Next.js.

## 14. Le web est-il lui-même cohérent ? (contrôle croisé)

Recherche exhaustive : `grep -rn "annonces/\${" client altimmo-app` → **aucune occurrence dans `client/`**, uniquement dans `altimmo-app/src/screens/Annonces/DetailAnnonceScreen.jsx`. Le bouton de partage **web** (`PropertyDetailPage.jsx::handleShare`, ligne 832-845) utilise `navigator.share({ url: window.location.href })` — c'est-à-dire l'URL réelle de la page courante (`/immobilier/property/:id`, puisque c'est la route sur laquelle l'utilisateur se trouve déjà). **Le web ne contient aucune construction d'URL fausse** — le bug est strictement localisé au partage mobile.

## 15. Cache WhatsApp (§23) — explicitement écarté

Condition du mandat pour retenir le cache comme cause : HTML actuel correct + OG actuel correct + URL accessible + crawler obtient les bonnes metadata, **mais** WhatsApp affiche encore l'ancien aperçu. **Cette condition n'est pas remplie** : le HTML actuel de l'URL réellement partagée (`/annonces/<id>`) est **incorrect à la source**, servi identiquement à tout crawler. **Le cache WhatsApp n'est PAS la root cause** — il ne fait qu'refléter fidèlement un contenu déjà faux.

## 16. Tests existants et trous de couverture (§29)

- `client/lib/__tests__/PropertyDetailPage.test.jsx` — teste le composant client `PropertyDetailPage`, pas la route Next.js `app/immobilier/property/[propertyId]/page.jsx` ni son `generateMetadata`.
- Aucun test ne couvre `app/[...slug]/page.jsx`.
- Aucun test ne couvre `generateMetadata` d'une route de détail (Property, hôtel, ou autre).
- **Aucun test mobile n'existe pour `partagerBien`/la construction de `webLink`** dans `DetailAnnonceScreen.jsx` — recherche confirmée vide (`altimmo-app/src/**/__tests__` ne contient aucun fichier référençant `Share.share`, `partagerBien`, ou `webLink`).

C'est ce dernier trou qui a permis à cette URL fausse d'exister sans jamais être détectée par la suite de tests (443/443 mobile tests passants, aucun ne couvrant ce chemin).

## 17. Réponses aux questions obligatoires (54)

1. HEAD : `4cc40f85e6cdc5a8da469be8f9e3bc795750a1e5`. 2. Worktree initial : propre (`git status --short` vide). 3. Changements existants préservés ? **Oui** — rien n'était en cours de modification au démarrage, rien touché pendant l'audit.

4. Handler mobile de partage : `partagerBien` (`altimmo-app/src/screens/Annonces/DetailAnnonceScreen.jsx`, `useCallback` déclaré ligne 339, appelé via `onPress={partagerBien}` sur le bouton partage). 5. Fonction qui construit l'URL : construction **inline**, pas de fonction séparée — `const webLink = \`https://altitudevision.agency/annonces/${annonce?._id}\`` (ligne 341). 6. URL exacte construite pour le cas réel : `https://altitudevision.agency/annonces/6a911186cbe20b4c495d6591`.

7. ID utilisé : `annonce._id`, provenant de `GET /properties/:id` (via `fetchAnnonceDetail`). 8. Cet ID correspond à quoi : un **`Property._id`** réel et valide (confirmé HTTP 200 sur `/api/properties/:id`).

9. Property ID : `6a911186cbe20b4c495d6591` (= l'ID partagé, confirmé). 10. Accommodation ID : **N/A** — aucun document `Accommodation` séparé pour ce bien (`/accommodations/public/:id` → 404). 11. Support Property ID : sans objet, concept non applicable ici.

12. Route Next.js canonique réelle pour le détail d'un bien : **`app/immobilier/property/[propertyId]/page.jsx`**.

13. `/annonces/[id]` existe-t-elle ? **NON** — aucun fichier de route correspondant n'existe dans `client/app/`. 14. Si oui, quel resolver : sans objet (n'existe pas) — la requête est absorbée par le catch-all racine `app/[...slug]/page.jsx`, qui ne résout rien du tout (métadonnées statiques, ignore les params).

15. URL production (`/annonces/<id>`) HTTP status : **200** (le catch-all répond 200, il ne renvoie pas une vraie 404 HTTP). 16. Redirect : uniquement le 308 apex→www, normal et sans rapport avec le bug. 17. URL finale après redirect : `https://www.altitudevision.agency/annonces/6a911186cbe20b4c495d6591`, toujours résolue par le catch-all.

18. HTML initial `<title>` : `Page introuvable | Altitude-Vision`. 19. `meta description` : `Altitude-Vision — Immobilier, Événementiel et Communication à Brazzaville.` (générique, site-wide). 20. `canonical` : `https://altitudevision.agency` (la racine du site, pas l'URL demandée). 21. `og:title` : identique au `<title>`. 22. `og:description` : identique à la meta description générique. 23. `og:image` : **absent** sur cette route fausse. 24. `og:url` : `https://altitudevision.agency` (racine, pas l'URL réelle demandée).

25. « Page introuvable » réellement dans le HTML SSR ? **OUI**, confirmé par `curl` brut (sans JS). 26. Code exact : `client/app/[...slug]/page.jsx`, `metadata` statique (`buildMetadata({ title: 'Page introuvable', noIndex: true })`), composant `<NotFoundPage />`.

27. `generateMetadata` existe-t-il (sur la vraie route) ? **Oui**, dans `app/immobilier/property/[propertyId]/page.jsx`. 28. Résout-il correctement le bien ? **Oui**, confirmé : `getProperty(propertyId)` → `GET /properties/:id` → titre/image dynamiques corrects, testé en production pour 2 biens distincts (hébergement et vente).

29. API SSR appelée (route réelle) : `GET ${NEXT_PUBLIC_API_URL}/properties/:id` (`next: { revalidate: 60 }`). 30. Status : **200**. 31. Ressource trouvée : **Oui**, pour les deux biens testés.

32. Le bien est-il publiquement visible ? **Oui** — `statusAdmin: "Validée"`, `availability: "Disponible"`, `isPublished: true`, accessible sans authentification (tous les tests `curl` de cet audit étaient non authentifiés).

33. Cas hébergement spécifique ? **NON** — confirmé écarté par la comparaison directe avec un bien vente (§13) : le bug touche `/annonces/<id>` pour n'importe quel type de bien. 34. Une annonce vente/location fonctionne-t-elle (sur la bonne route) ? **Oui**, testé et confirmé (`PARCELLE A VENDRE`).

35. Route canonique correcte à partager pour ce bien : **`https://altitudevision.agency/immobilier/property/6a911186cbe20b4c495d6591`** (et, plus généralement, `https://altitudevision.agency/immobilier/property/<propertyId>` pour tout bien, hébergement inclus — un `Property` avec `accommodationType` reste servi par cette même route, comme démontré).

36. URL mobile actuelle incorrecte ? **OUI.** 37. Metadata web (sur la vraie route) incorrectes ? **NON** — elles sont correctes ; c'est l'URL utilisée par le mobile qui pointe vers une route inexistante.

38. `og:image` publique et valide (sur la vraie route) ? **Oui** — Cloudinary HTTPS, `image/jpeg` implicite par l'extension, dimensions déclarées 1200×630. 39. URL absolue ? **Oui**, confirmé (`https://res.cloudinary.com/...`).

40. Cache WhatsApp root cause ? **NON** — explicitement écarté (§15), condition du mandat pour le retenir non remplie.

41. Root cause exacte : le bouton de partage mobile (`DetailAnnonceScreen.jsx::partagerBien`) construit une URL vers `https://altitudevision.agency/annonces/${id}`, un chemin qui **n'a jamais existé** dans l'application Next.js. Cette URL est absorbée par le catch-all racine `app/[...slug]/page.jsx`, dont les métadonnées sont **statiques** (ignorent totalement les segments de route), produisant systématiquement « Page introuvable | Altitude-Vision » — pour ce bien, pour tout autre bien, hébergement ou non, et quel que soit le visiteur/crawler. La route correcte et déjà pleinement fonctionnelle existe : `app/immobilier/property/[propertyId]/page.jsx`.

42. Catégorie : **MOBILE SHARE URL**.

43. Fix minimal recommandé (non appliqué, pour un futur mandat) : dans `DetailAnnonceScreen.jsx::partagerBien`, remplacer `https://altitudevision.agency/annonces/${annonce?._id}` par `https://altitudevision.agency/immobilier/property/${annonce?._id}`. Aucune autre modification n'est nécessaire — la route cible, son `generateMetadata`, son image OG et sa visibilité publique sont déjà tous corrects et déjà en production.

44. Mobile devra être modifié ? **Oui** (la seule chose à corriger). 45. Web devra être modifié ? **Non** — la route et ses metadata sont déjà correctes. 46. Backend devra être modifié ? **Non** — `GET /properties/:id` fonctionne, renvoie les bonnes données, la visibilité publique est déjà correcte.

47. Tests RED nécessaires (pour le futur hotfix) : un test mobile prouvant que `partagerBien`/l'URL construite pointe vers `/immobilier/property/:id` et non `/annonces/:id` — actuellement inexistant (trou de couverture confirmé, §16).

48. Code modifié ? **NON**, confirmé par `git status --short` vide en fin d'audit. 49. Mongo muté ? **NON** — tous les accès ont été des `GET` publics en lecture seule via `curl`. 50. Commit ? **NON.** 51. Push ? **NON.** 52. Deploy ? **NON.**

53. `git diff --check` : vide, propre, aucune modification.

54. **Verdict final : A. ROOT CAUSE CONFIRMED — MOBILE SHARES WRONG CANONICAL URL.**

## Non-régression

Aucun fichier modifié pendant cet audit — `git status --short` et `git diff --check` vides du début à la fin. Aucune suite de tests à rejouer.
