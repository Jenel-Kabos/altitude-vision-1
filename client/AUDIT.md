# AUDIT FRONTEND — Altitude-Vision Client
**Date :** 2026-05-19  
**Périmètre :** `client/app/` (pages) + `client/lib/components/` (composants)  
**Framework :** Next.js 15 App Router + React 18 + Tailwind CSS 3

---

## Résumé Global

| Critère | Résultat |
|---------|----------|
| Pages avec métadonnées SEO | 70/70 (100%) ✅ |
| Pages avec "use client" non justifié | 2 (layouts dashboard et mes-biens) ⚠️ |
| Pages avec problème params async (Next.js 15) | 2 (reset-password, verify-email) ⚠️ |
| Pages avec route dupliquée | 1 (/home ~ /) ⚠️ |
| Composants avec "use client" manquant | 3 (ReviewCard, WhyChooseUs, CtaCommission) ❌ |
| Composants avec double "use client" | 8 (EventCard, PortfolioCard, PropertyCard, ServiceCard, DashboardSidebar, ContactAgencyButton, layout/DashboardLayout, layout/DashboardSidebar, Header) ⚠️ |
| Images sans alt descriptif | 1 (FacebookFeed — alt générique "Publication") ⚠️ |
| Composant legacy incompatible App Router | 1 (SEOHead.jsx — react-helmet-async) ❌ |
| Composants avec console.log de debug | 2 (PortfolioCard, PortfolioFormModal) ⚠️ |
| Composants avec bug structurel JSX | 1 (dashboard/DashboardSidebar — div manquante) ❌ |
| Composant Navbar.jsx utilisant React Router | 1 (legacy, non utilisé en production) ❌ |

---

## SECTION 1 — Pages (`app/`)

### Conventions de notation (pages)
- **Métadonnées** : `export const metadata` ou `export async function generateMetadata` présent/absent
- **"use client"** : présent / absent / justifié (hooks, événements) / non justifié
- **Images sans alt** : `<img>` ou `<Image>` avec `alt=""` ou sans attribut `alt`
- **Liens problématiques** : `href="#"`, `href=""`, `href={undefined}`
- **Score /10** : pénalités sur les problèmes trouvés

---

### `app/layout.jsx`
| Critère | Résultat |
|---------|----------|
| Métadonnées SEO | `export const metadata` présent ✅ |
| "use client" | Absent — composant serveur ✅ |
| Images sans alt | Aucune ✅ |
| Liens problématiques | Aucun ✅ |
| **Score** | **10/10** |

---

### `app/page.jsx` (route `/`)
| Critère | Résultat |
|---------|----------|
| Métadonnées SEO | `export const metadata` via `buildMetadata` ✅ |
| "use client" | Absent ✅ |
| Images sans alt | Aucune ✅ |
| Liens problématiques | Aucun ✅ |
| **Score** | **10/10** |

---

### `app/[...slug]/page.jsx`
| Critère | Résultat |
|---------|----------|
| Métadonnées SEO | `export const metadata` (noIndex) ✅ |
| "use client" | Absent ✅ |
| Images sans alt | Aucune ✅ |
| Liens problématiques | Aucun ✅ |
| **Score** | **10/10** |

---

### `app/actualites/page.jsx`
| Critère | Résultat |
|---------|----------|
| Métadonnées SEO | `export const metadata` ✅ |
| "use client" | Absent ✅ |
| Images sans alt | Aucune ✅ |
| Liens problématiques | Aucun ✅ |
| **Score** | **10/10** |

---

### `app/actualites/[slug]/page.jsx`
| Critère | Résultat |
|---------|----------|
| Métadonnées SEO | `export async function generateMetadata` ✅ |
| "use client" | Absent ✅ |
| Images sans alt | Aucune ✅ |
| Liens problématiques | Aucun ✅ |
| **Score** | **10/10** |

---

### `app/admin/messages/page.jsx`
| Critère | Résultat |
|---------|----------|
| Métadonnées SEO | `export const metadata` (noIndex) ✅ |
| "use client" | Absent ✅ |
| Images sans alt | Aucune ✅ |
| Liens problématiques | Aucun ✅ |
| **Score** | **10/10** |

---

### `app/admin/projets/page.jsx`
| Critère | Résultat |
|---------|----------|
| Métadonnées SEO | `export const metadata` (noIndex) ✅ |
| "use client" | Absent ✅ |
| Images sans alt | Aucune ✅ |
| Liens problématiques | Aucun ✅ |
| **Score** | **10/10** |

---

### `app/admin/properties/page.jsx`
| Critère | Résultat |
|---------|----------|
| Métadonnées SEO | `export const metadata` (noIndex) ✅ |
| "use client" | Absent ✅ |
| Images sans alt | Aucune ✅ |
| Liens problématiques | Aucun ✅ |
| **Score** | **10/10** |

---

### `app/admin/services/page.jsx`
| Critère | Résultat |
|---------|----------|
| Métadonnées SEO | `export const metadata` (noIndex) ✅ |
| "use client" | Absent ✅ |
| Images sans alt | Aucune ✅ |
| Liens problématiques | Aucun ✅ |
| **Score** | **10/10** |

---

### `app/altcom/page.jsx`
| Critère | Résultat |
|---------|----------|
| Métadonnées SEO | `export const metadata` ✅ |
| "use client" | Absent ✅ |
| Images sans alt | Aucune ✅ |
| Liens problématiques | Aucun ✅ |
| **Score** | **10/10** |

---

### `app/altcom/[...slug]/page.jsx`
| Critère | Résultat |
|---------|----------|
| Métadonnées SEO | `export const metadata` (noIndex) ✅ |
| "use client" | Absent ✅ |
| Images sans alt | Aucune ✅ |
| Liens problématiques | Aucun ✅ |
| **Score** | **10/10** |

---

### `app/altcom/[serviceSlug]/page.jsx`
| Critère | Résultat |
|---------|----------|
| Métadonnées SEO | `export async function generateMetadata` avec `await params` ✅ |
| "use client" | Absent ✅ |
| Images sans alt | Aucune ✅ |
| Liens problématiques | Aucun ✅ |
| **Score** | **10/10** |

---

### `app/altcom/annonces/page.jsx`
| Critère | Résultat |
|---------|----------|
| Métadonnées SEO | `export const metadata` ✅ |
| "use client" | Absent ✅ |
| Images sans alt | Aucune ✅ |
| Liens problématiques | Aucun ✅ |
| **Score** | **10/10** |

---

### `app/altcom/couverture-mediatique/page.jsx`
| Critère | Résultat |
|---------|----------|
| Métadonnées SEO | `export const metadata` ✅ |
| "use client" | Absent ✅ |
| Images sans alt | Aucune ✅ |
| Liens problématiques | Aucun ✅ |
| **Score** | **10/10** |

---

### `app/altcom/portfolio/[portfolioId]/page.jsx`
| Critère | Résultat |
|---------|----------|
| Métadonnées SEO | `export async function generateMetadata` ✅ |
| "use client" | Absent ✅ |
| Images sans alt | Aucune ✅ |
| Liens problématiques | Aucun ✅ |
| Problème | URL API hardcodée dans generateMetadata au lieu de `process.env.NEXT_PUBLIC_API_URL` ⚠️ |
| **Score** | **9/10** |

---

### `app/altcom/service/[serviceId]/page.jsx`
| Critère | Résultat |
|---------|----------|
| Métadonnées SEO | `export async function generateMetadata` ✅ |
| "use client" | Absent ✅ |
| Images sans alt | Aucune ✅ |
| Liens problématiques | Aucun ✅ |
| Problème | URL API hardcodée dans generateMetadata ⚠️ |
| **Score** | **9/10** |

---

### `app/altimmo/page.jsx`
| Critère | Résultat |
|---------|----------|
| Métadonnées SEO | `export const metadata` ✅ |
| "use client" | Absent ✅ |
| Images sans alt | Aucune ✅ |
| Liens problématiques | Aucun ✅ |
| **Score** | **10/10** |

---

### `app/altimmo/[...slug]/page.jsx`
| Critère | Résultat |
|---------|----------|
| Métadonnées SEO | `export const metadata` (noIndex) ✅ |
| "use client" | Absent ✅ |
| Images sans alt | Aucune ✅ |
| Liens problématiques | Aucun ✅ |
| **Score** | **10/10** |

---

### `app/altimmo/annonces/page.jsx`
| Critère | Résultat |
|---------|----------|
| Métadonnées SEO | `export const metadata` ✅ |
| "use client" | Absent ✅ |
| Images sans alt | Aucune ✅ |
| Liens problématiques | Aucun ✅ |
| **Score** | **10/10** |

---

### `app/altimmo/property/[propertyId]/page.jsx`
| Critère | Résultat |
|---------|----------|
| Métadonnées SEO | `export async function generateMetadata` ✅ |
| "use client" | Absent ✅ |
| Images sans alt | Aucune ✅ |
| Liens problématiques | Aucun ✅ |
| Problème | URL API hardcodée dans generateMetadata ⚠️ |
| **Score** | **9/10** |

---

### `app/altimmo/services/conseil-investissement/page.jsx`
| Critère | Résultat |
|---------|----------|
| Métadonnées SEO | `export const metadata` ✅ |
| "use client" | Absent ✅ |
| Images sans alt | Aucune ✅ |
| Liens problématiques | Aucun ✅ |
| **Score** | **10/10** |

---

### `app/altimmo/services/location-gestion/page.jsx`
| Critère | Résultat |
|---------|----------|
| Métadonnées SEO | `export const metadata` ✅ |
| "use client" | Absent ✅ |
| Images sans alt | Aucune ✅ |
| Liens problématiques | Aucun ✅ |
| **Score** | **10/10** |

---

### `app/altimmo/services/vente-de-biens/page.jsx`
| Critère | Résultat |
|---------|----------|
| Métadonnées SEO | `export const metadata` ✅ |
| "use client" | Absent ✅ |
| Images sans alt | Aucune ✅ |
| Liens problématiques | Aucun ✅ |
| **Score** | **10/10** |

---

### `app/avis/nouveau/page.jsx`
| Critère | Résultat |
|---------|----------|
| Métadonnées SEO | `export const metadata` (noIndex) ✅ |
| "use client" | Absent ✅ |
| Images sans alt | Aucune ✅ |
| Liens problématiques | Aucun ✅ |
| **Score** | **10/10** |

---

### `app/contact/page.jsx`
| Critère | Résultat |
|---------|----------|
| Métadonnées SEO | `export const metadata` ✅ |
| "use client" | Absent ✅ |
| Images sans alt | Aucune ✅ |
| Liens problématiques | Aucun ✅ |
| **Score** | **10/10** |

---

### `app/dashboard/layout.jsx`
| Critère | Résultat |
|---------|----------|
| Métadonnées SEO | N/A (layout) |
| "use client" | Présent mais **non justifié** dans le layout lui-même — délègue juste à `<AdminDashboard>` ⚠️ |
| Images sans alt | Aucune ✅ |
| Liens problématiques | Aucun ✅ |
| **Score** | **7/10** |

> **Problème** : `"use client"` devrait être dans `AdminDashboard`, pas dans le layout. Le layout server pourrait passer `children` à un composant client enfant.

---

### `app/dashboard/page.jsx`
| Critère | Résultat |
|---------|----------|
| Métadonnées SEO | `export const metadata` (noIndex) ✅ |
| "use client" | Absent ✅ |
| Images sans alt | Aucune ✅ |
| Liens problématiques | Aucun ✅ |
| **Score** | **10/10** |

---

### `app/dashboard/active-sessions/page.jsx`
| Critère | Résultat |
|---------|----------|
| Métadonnées SEO | `export const metadata` (noIndex) ✅ |
| "use client" | Absent ✅ |
| Images sans alt | Aucune ✅ |
| Liens problématiques | Aucun ✅ |
| **Score** | **10/10** |

---

### `app/dashboard/active-users/page.jsx`
| Critère | Résultat |
|---------|----------|
| Métadonnées SEO | `export const metadata` (noIndex) ✅ |
| "use client" | Absent ✅ |
| Images sans alt | Aucune ✅ |
| Liens problématiques | Aucun ✅ |
| **Score** | **10/10** |

---

### `app/dashboard/altcom/page.jsx`
| Critère | Résultat |
|---------|----------|
| Métadonnées SEO | `export const metadata` (noIndex) ✅ |
| "use client" | Absent ✅ |
| Images sans alt | Aucune ✅ |
| Liens problématiques | Aucun ✅ |
| **Score** | **10/10** |

---

### `app/dashboard/emails/page.jsx`
| Critère | Résultat |
|---------|----------|
| Métadonnées SEO | `export const metadata` (noIndex) ✅ |
| "use client" | Absent ✅ |
| Images sans alt | Aucune ✅ |
| Liens problématiques | Aucun ✅ |
| **Score** | **10/10** |

---

### `app/dashboard/events/page.jsx`
| Critère | Résultat |
|---------|----------|
| Métadonnées SEO | `export const metadata` (noIndex) ✅ |
| "use client" | Absent ✅ |
| Images sans alt | Aucune ✅ |
| Liens problématiques | Aucun ✅ |
| **Score** | **10/10** |

---

### `app/dashboard/messages/page.jsx`
| Critère | Résultat |
|---------|----------|
| Métadonnées SEO | `export const metadata` (noIndex) ✅ |
| "use client" | Absent ✅ |
| Images sans alt | Aucune ✅ |
| Liens problématiques | Aucun ✅ |
| **Score** | **10/10** |

---

### `app/dashboard/moderation/properties/page.jsx`
| Critère | Résultat |
|---------|----------|
| Métadonnées SEO | `export const metadata` (noIndex) ✅ |
| "use client" | Absent ✅ |
| Images sans alt | Aucune ✅ |
| Liens problématiques | Aucun ✅ |
| **Score** | **10/10** |

---

### `app/dashboard/moderation/reviews/page.jsx`
| Critère | Résultat |
|---------|----------|
| Métadonnées SEO | `export const metadata` (noIndex) ✅ |
| "use client" | Absent ✅ |
| Images sans alt | Aucune ✅ |
| Liens problématiques | Aucun ✅ |
| **Score** | **10/10** |

---

### `app/dashboard/my-properties/page.jsx`
| Critère | Résultat |
|---------|----------|
| Métadonnées SEO | `export const metadata` (noIndex) ✅ |
| "use client" | Absent ✅ |
| Images sans alt | Aucune ✅ |
| Liens problématiques | Aucun ✅ |
| **Score** | **10/10** |

---

### `app/dashboard/properties/page.jsx`
| Critère | Résultat |
|---------|----------|
| Métadonnées SEO | `export const metadata` (noIndex) ✅ |
| "use client" | Absent ✅ |
| Images sans alt | Aucune ✅ |
| Liens problématiques | Aucun ✅ |
| **Score** | **10/10** |

---

### `app/dashboard/properties/add/page.jsx`
| Critère | Résultat |
|---------|----------|
| Métadonnées SEO | `export const metadata` (noIndex) ✅ |
| "use client" | Absent ✅ |
| Images sans alt | Aucune ✅ |
| Liens problématiques | Aucun ✅ |
| **Score** | **10/10** |

---

### `app/dashboard/quotes/page.jsx`
| Critère | Résultat |
|---------|----------|
| Métadonnées SEO | `export const metadata` (noIndex) ✅ |
| "use client" | Absent ✅ |
| Images sans alt | Aucune ✅ |
| Liens problématiques | Aucun ✅ |
| **Score** | **10/10** |

---

### `app/dashboard/users/page.jsx`
| Critère | Résultat |
|---------|----------|
| Métadonnées SEO | `export const metadata` (noIndex) ✅ |
| "use client" | Absent ✅ |
| Images sans alt | Aucune ✅ |
| Liens problématiques | Aucun ✅ |
| **Score** | **10/10** |

---

### `app/favoris/page.jsx`
| Critère | Résultat |
|---------|----------|
| Métadonnées SEO | `export const metadata` (noIndex) ✅ |
| "use client" | Absent ✅ |
| Images sans alt | Aucune ✅ |
| Liens problématiques | Aucun ✅ |
| **Score** | **10/10** |

---

### `app/forgot-password/page.jsx`
| Critère | Résultat |
|---------|----------|
| Métadonnées SEO | `export const metadata` (noIndex) ✅ |
| "use client" | Absent ✅ |
| Images sans alt | Aucune ✅ |
| Liens problématiques | Aucun ✅ |
| **Score** | **10/10** |

---

### `app/home/page.jsx`
| Critère | Résultat |
|---------|----------|
| Métadonnées SEO | `export const metadata` ✅ |
| "use client" | Absent ✅ |
| Images sans alt | Aucune ✅ |
| Liens problématiques | Aucun ✅ |
| Problème | **Route dupliquée** : `/home` et `/` servent la même page d'accueil avec des composants différents (`HomePage` vs `HomePageNext`). Potentiel contenu dupliqué pour le SEO. ⚠️ |
| **Score** | **7/10** |

---

### `app/login/page.jsx`
| Critère | Résultat |
|---------|----------|
| Métadonnées SEO | `export const metadata` (noIndex) ✅ |
| "use client" | Absent ✅ |
| Images sans alt | Aucune ✅ |
| Liens problématiques | Aucun ✅ |
| **Score** | **10/10** |

---

### `app/mentions-legales/page.jsx`
| Critère | Résultat |
|---------|----------|
| Métadonnées SEO | `export const metadata` ✅ |
| "use client" | Absent ✅ |
| Images sans alt | Aucune ✅ |
| Liens problématiques | Aucun ✅ |
| **Score** | **10/10** |

---

### `app/mes-biens/layout.jsx`
| Critère | Résultat |
|---------|----------|
| Métadonnées SEO | N/A (layout) |
| "use client" | Présent mais **non justifié** dans le layout lui-même — délègue juste à `<OwnerDashboard>` ⚠️ |
| Images sans alt | Aucune ✅ |
| Liens problématiques | Aucun ✅ |
| **Score** | **7/10** |

---

### `app/mes-biens/page.jsx`
| Critère | Résultat |
|---------|----------|
| Métadonnées SEO | `export const metadata` (noIndex) ✅ |
| "use client" | Absent ✅ |
| Images sans alt | Aucune ✅ |
| Liens problématiques | Aucun ✅ |
| **Score** | **10/10** |

---

### `app/mes-biens/[...slug]/page.jsx`
| Critère | Résultat |
|---------|----------|
| Métadonnées SEO | `export const metadata` (noIndex) ✅ |
| "use client" | Absent ✅ |
| Images sans alt | Aucune ✅ |
| Liens problématiques | Aucun ✅ |
| **Score** | **10/10** |

---

### `app/mes-biens/securite/page.jsx`
| Critère | Résultat |
|---------|----------|
| Métadonnées SEO | `export const metadata` (noIndex) ✅ |
| "use client" | Absent ✅ |
| Images sans alt | Aucune ✅ |
| Liens problématiques | Aucun ✅ |
| **Score** | **10/10** |

---

### `app/messages/page.jsx`
| Critère | Résultat |
|---------|----------|
| Métadonnées SEO | `export const metadata` (noIndex) ✅ |
| "use client" | Absent ✅ |
| Images sans alt | Aucune ✅ |
| Liens problématiques | Aucun ✅ |
| **Score** | **10/10** |

---

### `app/mila-events/page.jsx`
| Critère | Résultat |
|---------|----------|
| Métadonnées SEO | `export const metadata` ✅ |
| "use client" | Absent ✅ |
| Images sans alt | Aucune ✅ |
| Liens problématiques | Aucun ✅ |
| **Score** | **10/10** |

---

### `app/mila-events/[...slug]/page.jsx`
| Critère | Résultat |
|---------|----------|
| Métadonnées SEO | `export const metadata` (noIndex) ✅ |
| "use client" | Absent ✅ |
| Images sans alt | Aucune ✅ |
| Liens problématiques | Aucun ✅ |
| **Score** | **10/10** |

---

### `app/mila-events/annonces/page.jsx`
| Critère | Résultat |
|---------|----------|
| Métadonnées SEO | `export const metadata` ✅ |
| "use client" | Absent ✅ |
| Images sans alt | Aucune ✅ |
| Liens problématiques | Aucun ✅ |
| **Score** | **10/10** |

---

### `app/mila-events/creer-projet/page.jsx`
| Critère | Résultat |
|---------|----------|
| Métadonnées SEO | `export const metadata` ✅ |
| "use client" | Absent ✅ |
| Images sans alt | Aucune ✅ |
| Liens problématiques | Aucun ✅ |
| **Score** | **10/10** |

---

### `app/mila-events/event/[eventId]/page.jsx`
| Critère | Résultat |
|---------|----------|
| Métadonnées SEO | `export async function generateMetadata` ✅ |
| "use client" | Absent ✅ |
| Images sans alt | Aucune ✅ |
| Liens problématiques | Aucun ✅ |
| Problème | URL API hardcodée dans generateMetadata ⚠️ |
| **Score** | **9/10** |

---

### `app/mon-compte/page.jsx`
| Critère | Résultat |
|---------|----------|
| Métadonnées SEO | `export const metadata` (noIndex) ✅ |
| "use client" | Absent ✅ |
| Images sans alt | Aucune ✅ |
| Liens problématiques | Aucun ✅ |
| **Score** | **10/10** |

---

### `app/profile/page.jsx`
| Critère | Résultat |
|---------|----------|
| Métadonnées SEO | `export const metadata` (noIndex) ✅ |
| "use client" | Absent ✅ |
| Images sans alt | Aucune ✅ |
| Liens problématiques | Aucun ✅ |
| **Score** | **10/10** |

---

### `app/properties/page.jsx`
| Critère | Résultat |
|---------|----------|
| Métadonnées SEO | `export const metadata` ✅ |
| "use client" | Absent ✅ |
| Images sans alt | Aucune ✅ |
| Liens problématiques | Aucun ✅ |
| **Score** | **10/10** |

---

### `app/properties/edit/[id]/page.jsx`
| Critère | Résultat |
|---------|----------|
| Métadonnées SEO | `export const metadata` (noIndex) ✅ |
| "use client" | Absent ✅ |
| Images sans alt | Aucune ✅ |
| Liens problématiques | Aucun ✅ |
| **Score** | **10/10** |

---

### `app/properties/list/page.jsx`
| Critère | Résultat |
|---------|----------|
| Métadonnées SEO | `export const metadata` ✅ |
| "use client" | Absent ✅ |
| Images sans alt | Aucune ✅ |
| Liens problématiques | Aucun ✅ |
| **Score** | **10/10** |

---

### `app/properties/submit/page.jsx`
| Critère | Résultat |
|---------|----------|
| Métadonnées SEO | `export const metadata` ✅ |
| "use client" | Absent ✅ |
| Images sans alt | Aucune ✅ |
| Liens problématiques | Aucun ✅ |
| **Score** | **10/10** |

---

### `app/register/page.jsx`
| Critère | Résultat |
|---------|----------|
| Métadonnées SEO | `export const metadata` (noIndex) ✅ |
| "use client" | Absent ✅ |
| Images sans alt | Aucune ✅ |
| Liens problématiques | Aucun ✅ |
| **Score** | **10/10** |

---

### `app/reset-password/[token]/page.jsx`
| Critère | Résultat |
|---------|----------|
| Métadonnées SEO | `export const metadata` (noIndex) ✅ |
| "use client" | Absent ✅ |
| Images sans alt | Aucune ✅ |
| Liens problématiques | Aucun ✅ |
| Problème | `params.token` accédé sans `await` — **incompatible Next.js 15** où `params` est une Promise ❌ |
| **Score** | **8/10** |

> **Correction** : `const { token } = await params;` (server component) ou passer `params` comme prop à un composant client.

---

### `app/trouve-ta-commission/page.jsx`
| Critère | Résultat |
|---------|----------|
| Métadonnées SEO | `export const metadata` ✅ |
| "use client" | Absent ✅ |
| Images sans alt | Aucune ✅ |
| Liens problématiques | Aucun ✅ |
| **Score** | **10/10** |

---

### `app/unauthorized/page.jsx`
| Critère | Résultat |
|---------|----------|
| Métadonnées SEO | `export const metadata` (noIndex) ✅ |
| "use client" | Absent ✅ |
| Images sans alt | Aucune ✅ |
| Liens problématiques | Aucun ✅ |
| **Score** | **10/10** |

---

### `app/verify-email-pending/page.jsx`
| Critère | Résultat |
|---------|----------|
| Métadonnées SEO | `export const metadata` (noIndex) ✅ |
| "use client" | Absent ✅ |
| Images sans alt | Aucune ✅ |
| Liens problématiques | Aucun ✅ |
| **Score** | **10/10** |

---

### `app/verify-email/[token]/page.jsx`
| Critère | Résultat |
|---------|----------|
| Métadonnées SEO | `export const metadata` (noIndex) ✅ |
| "use client" | Absent ✅ |
| Images sans alt | Aucune ✅ |
| Liens problématiques | Aucun ✅ |
| Problème | `params.token` accédé sans `await` — **incompatible Next.js 15** où `params` est une Promise ❌ |
| **Score** | **8/10** |

---

## SECTION 2 — Composants (`lib/components/`)

### Conventions de notation (composants)
- **"use client"** : présent/absent, justifié (hooks/événements) ou non justifié
- **Images sans alt** : `<img>` ou `<Image>` avec `alt=""` ou sans attribut `alt`
- **Liens problématiques** : `href="#"`, `href=""`, `href={undefined}`

---

### `AltcomProjectFormModal.jsx`
| Critère | Résultat |
|---------|----------|
| "use client" | Présent, justifié (useState, onChange, onSubmit) ✅ |
| Images sans alt | Aucune ✅ |
| Liens problématiques | Aucun ✅ |

---

### `AltimmoContact.jsx`
| Critère | Résultat |
|---------|----------|
| "use client" | Présent, justifié (useState, onSubmit) ✅ |
| Images sans alt | Aucune ✅ |
| Liens problématiques | `href="mailto:..."` et `href="tel:..."` ✅ |

---

### `ChatWidget.jsx`
| Critère | Résultat |
|---------|----------|
| "use client" | Présent, justifié (useState, useRef, useEffect, onClick) ✅ |
| Images sans alt | SVG WhatsApp décoratif sans alt — acceptable (aria-hidden) ✅ |
| Liens problématiques | Lien WhatsApp externe valide ✅ |

---

### `ContactModal.jsx`
| Critère | Résultat |
|---------|----------|
| "use client" | Présent, justifié (useState, onChange, onSubmit) ✅ |
| Images sans alt | Aucune ✅ |
| Liens problématiques | Aucun ✅ |

---

### `CtaCommission.jsx`
| Critère | Résultat |
|---------|----------|
| "use client" | **ABSENT** ❌ |
| Images sans alt | Aucune ✅ |
| Liens problématiques | `/trouve-ta-commission` ✅ et `/altimmo#contact` ✅ |

> **Problème critique** : `injectCtaStyles()` appelle `document.createElement` au moment du rendu. La garde `typeof document === 'undefined'` évite le crash SSR mais ne résout pas la mauvaise pratique. Ce composant devrait avoir `"use client"` ou utiliser un style module/Tailwind à la place.

---

### `EstimationForm.jsx`
| Critère | Résultat |
|---------|----------|
| "use client" | Présent, justifié (useState, onChange) ✅ |
| Images sans alt | Aucune ✅ |
| Liens problématiques | Aucun ✅ |

---

### `EventCard.jsx`
| Critère | Résultat |
|---------|----------|
| "use client" | **DOUBLE "use client"** aux lignes 1 et 3 ⚠️ — justifié (useRouter, onClick) |
| Images sans alt | `<img alt={displayEvent.title}>` ✅ |
| Liens problématiques | Aucun ✅ |

---

### `FacebookFeed.jsx`
| Critère | Résultat |
|---------|----------|
| "use client" | Présent, justifié (useState, useEffect) ✅ |
| Images sans alt | `<img alt="Publication">` — **alt générique non descriptif** ⚠️ |
| Liens problématiques | Aucun ✅ |

> **Correction** : Utiliser `alt={post.message?.substring(0, 80) || 'Publication Facebook'}` pour un alt dynamique et descriptif.

---

### `HeroSlider.jsx`
| Critère | Résultat |
|---------|----------|
| "use client" | Présent, justifié (useState, useEffect, useRef, useCallback, onClick) ✅ |
| Images sans alt | `<img alt={current.title.replace('\n', ' ')}>` ✅ |
| Liens problématiques | Aucun ✅ |

---

### `HeroSliderAlt.jsx`
| Critère | Résultat |
|---------|----------|
| "use client" | Présent, justifié ✅ |
| Images sans alt | `<img alt={s.alt}>` — alt défini dans les données des slides ✅ |
| Liens problématiques | Aucun ✅ |

---

### `HeroSliderAltcom.jsx`
| Critère | Résultat |
|---------|----------|
| "use client" | Présent, justifié ✅ |
| Images sans alt | `<img alt={s.alt}>` ✅ |
| Liens problématiques | Aucun ✅ |

---

### `HeroSliderMila.jsx`
| Critère | Résultat |
|---------|----------|
| "use client" | Présent, justifié ✅ |
| Images sans alt | `<img alt={s.alt}>` ✅ |
| Liens problématiques | Aucun ✅ |

---

### `HomeSlider.jsx`
| Critère | Résultat |
|---------|----------|
| "use client" | Présent, justifié (useState, useRef, useEffect, drag handlers) ✅ |
| Images sans alt | Aucune (délègue aux cartes enfants) ✅ |
| Liens problématiques | Aucun ✅ |

---

### `JsonLd.jsx`
| Critère | Résultat |
|---------|----------|
| "use client" | Absent — composant serveur pur ✅ |
| Images sans alt | Aucune ✅ |
| Liens problématiques | Aucun ✅ |

---

### `MilaContact.jsx`
| Critère | Résultat |
|---------|----------|
| "use client" | Présent, justifié (useState, onSubmit, onFocus, onBlur) ✅ |
| Images sans alt | Aucune ✅ |
| Liens problématiques | `href="mailto:..."` ✅ et `href="tel:..."` ✅ |

---

### `PortfolioCard.jsx`
| Critère | Résultat |
|---------|----------|
| "use client" | **DOUBLE "use client"** aux lignes 1 et 3 ⚠️ — justifié (useRouter, onClick) |
| Images sans alt | `<motion.img alt={item.title}>` ✅ |
| Liens problématiques | Aucun ✅ |

> **Problème** : Présence de `console.log` de debug dans le composant (devrait être retiré avant production).

---

### `PropertyCard.jsx`
| Critère | Résultat |
|---------|----------|
| "use client" | **DOUBLE "use client"** aux lignes 1 et 3 ⚠️ — justifié (useState) |
| Images sans alt | `<img alt={property.title}>` ✅ |
| Liens problématiques | Aucun — liens via Next.js `Link` ✅ |

---

### `ProtectedRoute.jsx` (lib/components/)
| Critère | Résultat |
|---------|----------|
| "use client" | Présent, justifié (useAuth/useContext, localStorage) ✅ |
| Images sans alt | Aucune ✅ |
| Liens problématiques | Aucun ✅ |

---

### `ReviewCard.jsx`
| Critère | Résultat |
|---------|----------|
| "use client" | **ABSENT** ❌ |
| Images sans alt | `<img alt={authorName}>` ✅ |
| Liens problématiques | Aucun ✅ |

> **Problème critique** : Utilise `motion` de framer-motion avec `whileHover`. Les composants `motion.*` de framer-motion nécessitent `"use client"`. Sans ce directive, le composant plantera lors du rendu en contexte serveur.

---

### `RoleProtectedRoute.jsx`
| Critère | Résultat |
|---------|----------|
| "use client" | Absent — composant purement fonctionnel sans hooks ✅ |
| Images sans alt | Aucune ✅ |
| Liens problématiques | Aucun ✅ |

---

### `SEOHead.jsx`
| Critère | Résultat |
|---------|----------|
| "use client" | **ABSENT** ❌ |
| Images sans alt | Aucune ✅ |
| Liens problématiques | Aucun ✅ |

> **Problème critique** : Utilise `Helmet` de `react-helmet-async`, une bibliothèque **incompatible avec Next.js App Router**. L'App Router gère les métadonnées via `export const metadata` et `generateMetadata`. `Helmet` nécessite un rendu côté client. Ce composant semble inutilisé (le projet utilise déjà l'API metadata), mais sa présence est trompeuse. **Recommandation : supprimer ce fichier**.

---

### `ServiceCard.jsx`
| Critère | Résultat |
|---------|----------|
| "use client" | **DOUBLE "use client"** aux lignes 1 et 3 ⚠️ — justifié (useRouter, onClick) |
| Images sans alt | Aucune ✅ |
| Liens problématiques | `href={/altcom/service/${service._id}}` ✅ |

---

### `StatsCounter.jsx`
| Critère | Résultat |
|---------|----------|
| "use client" | Présent, justifié (useState, useEffect, useRef, useInView) ✅ |
| Images sans alt | Aucune ✅ |
| Liens problématiques | Aucun ✅ |

---

### `Testimonials.jsx`
| Critère | Résultat |
|---------|----------|
| "use client" | Présent, justifié (useState, useEffect, useRef, useCallback, useRouter, useAuth) ✅ |
| Images sans alt | `<img alt={t.author?.name \|\| 'Client'}>` ✅ |
| Liens problématiques | Aucun ✅ |

---

### `WhyChooseUs.jsx`
| Critère | Résultat |
|---------|----------|
| "use client" | **ABSENT** ❌ |
| Images sans alt | Aucune ✅ |
| Liens problématiques | `href="/contact"` ✅ |

> **Problème critique** : Utilise `motion` de framer-motion. Sans `"use client"`, ce composant plantera en contexte serveur.

---

### `UI/LoadingSpinner.jsx`
| Critère | Résultat |
|---------|----------|
| "use client" | Absent — JSX pur ✅ |
| Images sans alt | Aucune ✅ |
| Liens problématiques | Aucun ✅ |

---

### `UI/StatusBadge.jsx`
| Critère | Résultat |
|---------|----------|
| "use client" | Absent — JSX pur ✅ |
| Images sans alt | Aucune ✅ |
| Liens problématiques | Aucun ✅ |

---

### `admin/CompleteTransactionModal.jsx`
| Critère | Résultat |
|---------|----------|
| "use client" | Présent, justifié (useState, onChange, onSubmit) ✅ |
| Images sans alt | Aucune ✅ |
| Liens problématiques | Aucun ✅ |

---

### `comments/CommentForm.jsx`
| Critère | Résultat |
|---------|----------|
| "use client" | Présent, justifié (useState, useAuth, onSubmit) ✅ |
| Images sans alt | `<img alt={user.name}>` ✅ |
| Liens problématiques | `href="/login"` ✅ |

---

### `comments/CommentItem.jsx`
| Critère | Résultat |
|---------|----------|
| "use client" | Présent, justifié (useState, useAuth, onClick) ✅ |
| Images sans alt | `<img alt={authorName}>` ✅ |
| Liens problématiques | Aucun ✅ |

---

### `comments/CommentList.jsx`
| Critère | Résultat |
|---------|----------|
| "use client" | Présent, justifié (useState, useEffect) ✅ |
| Images sans alt | Aucune ✅ |
| Liens problématiques | Aucun ✅ |

---

### `dashboard/DashboardSidebar.jsx`
| Critère | Résultat |
|---------|----------|
| "use client" | **DOUBLE "use client"** aux lignes 1 et 3 ⚠️ — justifié (usePathname, useAuth) |
| Images sans alt | Aucune ✅ |
| Liens problématiques | Aucun ✅ |

> **Problème structurel** : Bug JSX — `</div>` orphelin à la ligne 67 sans `<div>` ouvrant correspondant autour du premier `<Link>`. Le composant est probablement partiellement non fonctionnel. À corriger immédiatement.

---

### `dashboard/PropertyForm.jsx`
| Critère | Résultat |
|---------|----------|
| "use client" | Présent, justifié (useRef, useMemo, useEffect, Leaflet map events) ✅ |
| Images sans alt | Aperçus d'images avec `alt` générique `"Aperçu ${index + 1}"` — faiblement descriptif ⚠️ |
| Liens problématiques | Aucun ✅ |

---

### `dashboard/QuoteEditor.jsx`
| Critère | Résultat |
|---------|----------|
| "use client" | Présent, justifié (useState, framer-motion) ✅ |
| Images sans alt | Aucune ✅ |
| Liens problématiques | Aucun ✅ |

---

### `layout/Footer.jsx`
| Critère | Résultat |
|---------|----------|
| "use client" | **ABSENT** — mais utilise `onMouseEnter`/`onMouseLeave` (event handlers inline) ⚠️ |
| Images sans alt | Aucune (icônes SVG avec aria-label sur les liens) ✅ |
| Liens problématiques | Tous valides (Facebook, Instagram, WhatsApp, routes internes) ✅ |

> **Note** : Les handlers `onMouseEnter`/`onMouseLeave` sur des balises `<a>` dans un composant serveur fonctionnent côté client en Next.js App Router (les event handlers HTML natifs sont sérialisés). Toutefois, si l'intention est d'utiliser des états React, `"use client"` serait nécessaire. Ici, les handlers modifient directement `e.currentTarget.style` (DOM API) ce qui nécessite du JavaScript côté client. En production avec SSR, cette interaction ne fonctionnera pas sans `"use client"`. **Recommandation : ajouter `"use client"`**.

---

### `layout/DashboardLayout.jsx`
| Critère | Résultat |
|---------|----------|
| "use client" | **DOUBLE "use client"** aux lignes 1 et 3 ⚠️ — justifié (usePathname, useRouter) |
| Images sans alt | Aucune ✅ |
| Liens problématiques | Aucun ✅ |

> **Note** : Ce composant est un layout legacy (gris, basique) potentiellement remplacé par `DashboardSidebar`. Il importe `getCurrentUser` depuis `authService` directement plutôt que depuis le contexte Auth.

---

### `layout/DashboardSidebar.jsx`
| Critère | Résultat |
|---------|----------|
| "use client" | **DOUBLE "use client"** aux lignes 1 et 3 ⚠️ — justifié (usePathname, useRouter) |
| Images sans alt | Aucune ✅ |
| Liens problématiques | Aucun ✅ |

> **Note** : Composant legacy avec l'ancien design gris. À distinguer de `dashboard/DashboardSidebar.jsx` qui est le composant actif (design bleu). Risque de confusion dans les imports.

---

### `layout/Navbar.jsx`
| Critère | Résultat |
|---------|----------|
| "use client" | **ABSENT** ❌ |
| Images sans alt | `<img alt="Altitude-Vision">` ✅ |
| Liens problématiques | Aucun ✅ |

> **Problème critique** : Utilise **React Router** (`NavLink`, `useNavigate`) — incompatible avec Next.js App Router. Ce composant est du code legacy non migré. Il utilise `useState` sans `"use client"`. **Ce composant ne doit pas être utilisé dans le projet App Router** — utiliser `Header.jsx` à la place.

---

### `layout/Spinner.jsx`
| Critère | Résultat |
|---------|----------|
| "use client" | Absent — JSX pur ✅ |
| Images sans alt | Aucune ✅ |
| Liens problématiques | Aucun ✅ |

---

### `likes/FavoritesList.jsx`
| Critère | Résultat |
|---------|----------|
| "use client" | Fichier vide (1 ligne) ⚠️ |
| Images sans alt | N/A ✅ |
| Liens problématiques | N/A ✅ |

> **Note** : Fichier vide non implémenté.

---

### `likes/LikeButton.jsx`
| Critère | Résultat |
|---------|----------|
| "use client" | Présent, justifié (useState, useEffect, useAuth, onClick) ✅ |
| Images sans alt | Aucune ✅ |
| Liens problématiques | Aucun ✅ |

---

### `messaging/ChatWindow.jsx`
| Critère | Résultat |
|---------|----------|
| "use client" | Présent, justifié (useState, useEffect, useRef, useAuth, polling) ✅ |
| Images sans alt | `<img src={...} alt={otherParticipant.name}>` ✅ |
| Liens problématiques | Aucun ✅ |

---

### `messaging/ContactAgencyButton.jsx`
| Critère | Résultat |
|---------|----------|
| "use client" | **DOUBLE "use client"** aux lignes 1 et 3 ⚠️ — justifié (useState, useRouter, useAuth) |
| Images sans alt | Aucune ✅ |
| Liens problématiques | Aucun ✅ |

> **Note** : Contient un ID admin hardcodé de fallback (`'60d5ec49f1b2c72b8c8e4f1a'`) et un `console.log` de debug à retirer en production.

---

### `messaging/ConversationList.jsx`
| Critère | Résultat |
|---------|----------|
| "use client" | **ABSENT** — mais utilise `onClick` (event handler) ⚠️ |
| Images sans alt | `<img alt={otherParticipant.name}>` ✅ |
| Liens problématiques | Aucun ✅ |

> **Problème** : Le composant utilise `onClick` sur un `<div>`. En Next.js App Router, les event handlers nécessitent `"use client"`. Ce composant devrait avoir `"use client"` ou être rendu dans un contexte client.

---

### `messaging/MessageBubble.jsx`
| Critère | Résultat |
|---------|----------|
| "use client" | Présent, justifié (useState, framer-motion, onMouseEnter/Leave) ✅ |
| Images sans alt | `<img src={photo} alt={name}>` dans MiniAvatar ✅ |
| Liens problématiques | Liens pièces jointes vers URLs externes valides ✅ |

---

### `messaging/MessageInput.jsx`
| Critère | Résultat |
|---------|----------|
| "use client" | Présent, justifié (useState, useRef, onChange, onSubmit) ✅ |
| Images sans alt | Aucune ✅ |
| Liens problématiques | Aucun ✅ |

---

### `messaging/ScrollToBottomButton.jsx`
| Critère | Résultat |
|---------|----------|
| "use client" | **ABSENT** — importe un `.css` local et utilise `onClick` ⚠️ |
| Images sans alt | Aucune ✅ |
| Liens problématiques | Aucun ✅ |

> **Problème** : `onClick` nécessite `"use client"`. L'import CSS local (`./ScrollToBottomButton.css`) n'est pas une bonne pratique en App Router (préférer Tailwind ou CSS modules). Ajouter `"use client"`.

---

### `messaging/UnreadMessagesBadge.jsx`
| Critère | Résultat |
|---------|----------|
| "use client" | Absent — JSX pur sans hooks ✅ |
| Images sans alt | Aucune ✅ |
| Liens problématiques | Aucun ✅ |

---

### `modals/AltcomProjectModal.jsx`
| Critère | Résultat |
|---------|----------|
| "use client" | Présent, justifié (onSubmit) ✅ |
| Images sans alt | Aucune ✅ |
| Liens problématiques | Aucun ✅ |

> **Note** : Modal très basique avec `alert()` de debug. Non finalisé (pas de state management réel).

---

### `modals/AltcomQuoteRequestModal.jsx`
| Critère | Résultat |
|---------|----------|
| "use client" | Présent, justifié (onSubmit) ✅ |
| Images sans alt | Aucune ✅ |
| Liens problématiques | Aucun ✅ |

> **Note** : Modal basique avec `alert()` de debug. Non finalisé.

---

### `modals/PortfolioFormModal.jsx`
| Critère | Résultat |
|---------|----------|
| "use client" | Présent, justifié (useState, useEffect, framer-motion) ✅ |
| Images sans alt | `<img alt={`Aperçu ${index + 1}`}>` — générique ⚠️ |
| Liens problématiques | Aucun ✅ |

> **Problème** : `console.log` de debug présents (lignes 107, 175, 397, 401). À retirer avant production.

---

### `modals/ServiceFormModal.jsx`
| Critère | Résultat |
|---------|----------|
| "use client" | Présent, justifié (useState, useEffect, framer-motion) ✅ |
| Images sans alt | `<img alt="Aperçu">` — générique ⚠️ |
| Liens problématiques | Aucun ✅ |

---

### `routing/AdminRoute.jsx`
| Critère | Résultat |
|---------|----------|
| "use client" | Absent — wrapper vide qui passe `children` ✅ |
| Images sans alt | Aucune ✅ |
| Liens problématiques | Aucun ✅ |

> **Note** : Ce composant est un stub vide sans logique de protection réelle. La vraie protection devrait être implémentée ici ou dans un middleware Next.js.

---

### `routing/OwnerRoute.jsx`
| Critère | Résultat |
|---------|----------|
| "use client" | Présent, justifié (useAuth, localStorage) ✅ |
| Images sans alt | Aucune ✅ |
| Liens problématiques | Aucun ✅ |

> **Note** : Affiche un spinner de chargement mais ne redirige pas réellement (retourne `<>{children}</>` après le chargement sans vérifier le rôle). Protection incomplète.

---

### `routing/PrivateRoute.jsx`
| Critère | Résultat |
|---------|----------|
| "use client" | Absent — wrapper vide qui passe `children` ✅ |
| Images sans alt | Aucune ✅ |
| Liens problématiques | Aucun ✅ |

> **Note** : Stub vide sans logique de protection.

---

### `routing/ProtectedRoute.jsx` (routing/)
| Critère | Résultat |
|---------|----------|
| "use client" | Absent — wrapper vide qui passe `children` ✅ |
| Images sans alt | Aucune ✅ |
| Liens problématiques | Aucun ✅ |

> **Note** : Stub vide. À distinguer de `lib/components/ProtectedRoute.jsx` qui implémente réellement la protection.

---

### `routing/PublicAuthRoute.jsx`
| Critère | Résultat |
|---------|----------|
| "use client" | Absent — wrapper vide qui passe `children` ✅ |
| Images sans alt | Aucune ✅ |
| Liens problématiques | Aucun ✅ |

> **Note** : Stub vide sans logique de redirection.

---

### `layout/Header.jsx`
| Critère | Résultat |
|---------|----------|
| "use client" | **DOUBLE "use client"** aux lignes 1 et 3 ⚠️ — justifié (useState, useEffect, useRef, usePathname, useRouter, useAuth) |
| Images sans alt | `<img alt={user.name \|\| 'Avatar'}>` ✅ |
| Liens problématiques | Tous les liens de navigation valides ✅ |

---

## SECTION 3 — Problèmes Prioritaires

### PRIORITÉ 1 — Bloquants (risque de crash en production)

| # | Fichier | Problème | Correction |
|---|---------|----------|------------|
| 1 | `lib/components/ReviewCard.jsx` | `"use client"` manquant — utilise `motion` framer-motion | Ajouter `"use client"` en première ligne |
| 2 | `lib/components/WhyChooseUs.jsx` | `"use client"` manquant — utilise `motion` framer-motion | Ajouter `"use client"` en première ligne |
| 3 | `lib/components/layout/Navbar.jsx` | Utilise React Router (`NavLink`, `useNavigate`) — incompatible Next.js App Router | Ne pas importer/utiliser ce composant. Supprimer ou migrer vers Next.js `Link` + `useRouter`. |
| 4 | `app/reset-password/[token]/page.jsx` | `params.token` accédé sans `await` (Next.js 15 breaking change) | `const { token } = await params;` |
| 5 | `app/verify-email/[token]/page.jsx` | `params.token` accédé sans `await` (Next.js 15 breaking change) | `const { token } = await params;` |
| 6 | `lib/components/dashboard/DashboardSidebar.jsx` | Bug JSX structurel : `</div>` orphelin ligne 67 | Ajouter un `<div>` ouvrant autour du premier bloc `<Link>` ou supprimer le `</div>` en trop |

---

### PRIORITÉ 2 — Importants (qualité du code et maintenabilité)

| # | Fichier | Problème | Correction |
|---|---------|----------|------------|
| 7 | `lib/components/SEOHead.jsx` | `react-helmet-async` incompatible App Router — composant inutilisé | Supprimer le fichier |
| 8 | `lib/components/CtaCommission.jsx` | `document.createElement` au rendu sans `"use client"` | Ajouter `"use client"` ou remplacer par CSS module/Tailwind |
| 9 | `lib/components/messaging/ConversationList.jsx` | `onClick` sur `<div>` sans `"use client"` | Ajouter `"use client"` |
| 10 | `lib/components/messaging/ScrollToBottomButton.jsx` | `onClick` sans `"use client"` + import CSS local | Ajouter `"use client"` + migrer vers Tailwind |
| 11 | `app/dashboard/layout.jsx` | `"use client"` dans le layout sans hooks propres | Déplacer `"use client"` dans `AdminDashboard` |
| 12 | `app/mes-biens/layout.jsx` | `"use client"` dans le layout sans hooks propres | Déplacer `"use client"` dans `OwnerDashboard` |
| 13 | `lib/components/layout/Footer.jsx` | `onMouseEnter`/`onMouseLeave` DOM directs sans `"use client"` | Ajouter `"use client"` ou utiliser des classes Tailwind hover: |
| 14 | `lib/components/routing/OwnerRoute.jsx` | Route protégée incomplete — ne redirige pas si rôle invalide | Implémenter la redirection vers `/unauthorized` |
| 15 | `lib/components/routing/AdminRoute.jsx`, `PrivateRoute.jsx`, `ProtectedRoute.jsx` (routing/), `PublicAuthRoute.jsx` | Stubs vides sans logique de protection | Implémenter ou supprimer — utiliser middleware Next.js |

---

### PRIORITÉ 3 — Améliorations (bonnes pratiques)

| # | Fichier | Problème | Correction |
|---|---------|----------|------------|
| 16 | `EventCard.jsx`, `PortfolioCard.jsx`, `PropertyCard.jsx`, `ServiceCard.jsx`, `ContactAgencyButton.jsx`, `dashboard/DashboardSidebar.jsx`, `layout/DashboardLayout.jsx`, `layout/DashboardSidebar.jsx`, `layout/Header.jsx` | Double `"use client"` (lignes 1 et 3) | Supprimer le duplicata — garder uniquement la première occurrence |
| 17 | `lib/components/FacebookFeed.jsx` | `alt="Publication"` générique | Utiliser le contenu du post comme alt : `alt={post.message?.substring(0, 80) \|\| 'Publication Facebook'}` |
| 18 | `app/home/page.jsx` | Route dupliquée `/home` ~ `/` | Supprimer `app/home/` ou faire une redirection 301 vers `/` |
| 19 | `app/altcom/portfolio/[portfolioId]/page.jsx`, `app/altcom/service/[serviceId]/page.jsx`, `app/altimmo/property/[propertyId]/page.jsx`, `app/mila-events/event/[eventId]/page.jsx` | URL API hardcodée dans `generateMetadata` | Remplacer par `process.env.NEXT_PUBLIC_API_URL` |
| 20 | `lib/components/PortfolioCard.jsx`, `modals/PortfolioFormModal.jsx`, `messaging/ContactAgencyButton.jsx` | `console.log` de debug restants | Supprimer tous les `console.log` de debug |
| 21 | `lib/components/likes/FavoritesList.jsx` | Fichier vide | Implémenter ou supprimer |
| 22 | `modals/AltcomProjectModal.jsx`, `modals/AltcomQuoteRequestModal.jsx` | Modals non fonctionnels avec `alert()` de debug | Implémenter la logique réelle ou supprimer |

---

## SECTION 4 — Récapitulatif des Scores

### Pages par score

| Score | Nombre | Pages |
|-------|--------|-------|
| 10/10 | 63 | Toutes les pages standard |
| 9/10 | 4 | altcom/portfolio/[portfolioId], altcom/service/[serviceId], altimmo/property/[propertyId], mila-events/event/[eventId] |
| 8/10 | 2 | reset-password/[token], verify-email/[token] |
| 7/10 | 3 | dashboard/layout, mes-biens/layout, home/page |

**Score moyen pages : 9.8/10**

---

*Rapport généré le 2026-05-19 — Altitude-Vision Frontend Audit*
