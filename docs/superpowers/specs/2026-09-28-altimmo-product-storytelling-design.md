# Altimmo Product Storytelling Design

## Objective

Transform `/altimmo/application` from a seven-section, CSS-device showcase into a ten-part premium product journey using only the ten official transparent PNG mockups already present in `client/public/images/altimmo-app/mockups/`.

## Approved direction

Use an editorial product journey rather than a uniform gallery or a dense advertising collage. Preserve the existing ivory, deep ink/green, brass and Altimmo orange palette, Cormorant Garamond/DM Sans typography, generous spacing and understated motion.

## Narrative and asset mapping

1. **Promise / Hero** — 01 dominates; 02 and 04 sit behind it. Copy and CTAs follow the sprint brief.
2. **Discover** — 01 supports the search/listings story and the lightweight Acheter/Louer/Séjourner/Investir usage list.
3. **Map** — 02 is the dominant visual on deep ink.
4. **Buy / Rent** — 03 introduces a property detail and 06 completes the examination/contact/visit journey.
5. **Hotels / Accommodation** — 04 and 05 explain hotel discovery, room selection and accommodation booking.
6. **Messaging / Visits** — 07 anchors agency contact, conversations and visit follow-up.
7. **Owners** — 09 dominates; 08 supports owner activity and profile context. The apporteur statement remains qualified exactly as specified.
8. **Personal space** — 10 anchors verified services: tenant space, documents, favorites, transactions, applications, hotel/accommodation reservations, profile, account security and notifications.
9. **Ecosystem** — a restrained composition of 01, 07 and 08 presents the multi-role platform without statistics.
10. **Final CTA** — editorial close with `/immobilier/annonces` and the audited publication route `/properties/submit`.

## Composition rules

- Render each official PNG directly with `next/image`; never place it inside a reconstructed phone shell.
- Preserve alpha, aspect ratio and `object-fit: contain`.
- Hero uses no more than three mockups and is the only area whose images may use `priority`.
- Below-fold images remain lazy and receive responsive `sizes` values.
- Reuse a small set of page-local composition primitives rather than ten identical cards.
- Keep rotations extremely slight and disable nonessential transforms for reduced motion.

## Responsive behavior

- Desktop alternates text/visual alignment and dark/ivory bands.
- Tablet reduces overlaps while retaining hierarchy.
- Mobile uses image-first ordering in product sections, with one dominant mockup around 70–90vw and no horizontal overflow.
- Hero order on mobile is heading, mockup composition, supporting copy and CTAs.
- Decorative support mockups may be hidden only where keeping them would make the principal screen unreadable; every product capability remains represented elsewhere in the page.

## Accessibility and motion

- One `h1`; section headings use coherent `h2` hierarchy and named `aria-labelledby` sections.
- Informative mockups receive subject-specific French alt text; repeated decorative instances use empty alt text.
- Links retain visible focus states and sufficient contrast.
- Existing public motion primitives provide small reveal/stagger effects; content remains visible and static under `prefers-reduced-motion`.

## Validation

- Component tests protect the ten official paths, ten narrative sections, audited CTA routes, qualified commission wording, absence of store badges, and absence of CSS phone-shell reconstruction.
- Run the targeted test first, then frontend tests, lint, production build and `git diff --check`.
- Perform visual QA at 1440, 1280, 1024, 768, 430, 390 and 375 pixels, capturing the views required by the sprint.

## Constraints

No backend, mobile application, dashboards, multi-tenant architecture, dependencies, deployment, staging, commit or push changes are permitted. Existing dirty-worktree changes are the baseline and must be preserved.
