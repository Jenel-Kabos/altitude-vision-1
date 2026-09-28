# Altimmo Product Storytelling Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild `/altimmo/application` as a ten-section premium product story using the ten official transparent device mockups and only verified Altimmo capabilities.

**Architecture:** Keep the route-level metadata/JSON-LD entry point and implement the experience in the existing page component plus its page-local CSS module. Model the narrative and official assets as immutable page-local data, render direct `next/image` compositions, and reuse existing public motion primitives without creating a generic component framework.

**Tech Stack:** Next.js App Router, React, `next/image`, CSS Modules, existing PublicMotion primitives, Vitest, Testing Library.

**Spec:** `docs/superpowers/specs/2026-09-28-altimmo-product-storytelling-design.md`

## Global Constraints

- Preserve the dirty worktree; do not reset, checkout, clean or stash it.
- Do not modify backend, mobile, dashboards, multi-tenant code or dependencies.
- Do not use `git add`, commit, push, tag or deploy.
- Use only the ten official PNGs in `client/public/images/altimmo-app/mockups/`; do not invent or reconstruct UI.
- Do not recreate phone shells, add white PNG backgrounds, distort images or create double frames.
- Keep ivory, deep ink/green, brass, Altimmo orange, Cormorant Garamond and DM Sans.
- Use `/immobilier/annonces` for listings and `/properties/submit` for publication.
- Keep the apporteur wording qualified: up to 30% only for eligible apporteurs after an admissible completed transaction and under network rules.
- Hero only may use image priority; all lower images remain lazy.

## Review Focus

- A filename containing spaces, an em dash and decomposed accents must remain a valid encoded Next image source and render in production.
- Repeated assets must not create duplicate informative alt text; decorative repeats use `alt=""`.
- Mobile composition at 375px must not overflow or shrink the dominant mockup below useful legibility.
- Reduced-motion users must receive visible content without persistent transforms or hidden reveal states.
- Existing header/footer spacing and route metadata must remain valid after the much longer page is introduced.

---

### Task 1: Lock the official asset and narrative contract in tests

**Files:**
- Modify: `client/lib/__tests__/AltimmoAppPage.test.jsx`

**Interfaces:**
- Consumes: exported default `AltimmoAppPage` React component.
- Produces: regression contract for all sections, assets, links and forbidden legacy treatment.

- [ ] **Step 1: Replace the old Sprint 1 assertions with failing Sprint 2 tests**

Add focused tests named for: ten-section rendering; exact ten official asset paths; hero copy; map, hospitality, messaging, owner and account sections; listings/publication CTA routes; qualified commission wording; no store badge; no old WEBP screenshots; and no legacy `phone`/`phoneFrame` shell hooks.

- [ ] **Step 2: Add accessibility and performance contract assertions**

Assert one level-one heading, meaningful unique alt text for informative assets, empty alt on decorative repeats, `priority` only on the three hero images, and `sizes` on every official image.

- [ ] **Step 3: Run the targeted test and confirm the intended red state**

Run: `cd client && npx vitest run lib/__tests__/AltimmoAppPage.test.jsx`

Expected: FAIL because the current seven-section Sprint 1 page uses old WEBP images and CSS device shells.

### Task 2: Implement the ten-section product narrative

**Files:**
- Modify: `client/lib/pages/AltimmoAppPage.jsx`
- Test: `client/lib/__tests__/AltimmoAppPage.test.jsx`

**Interfaces:**
- Consumes: `Image`, `Link`, PublicMotion primitives, CSS module class names, and the ten paths defined by Task 1.
- Produces: the complete semantic page DOM and all section/CTA/image contracts.

- [ ] **Step 1: Define immutable page-local content and asset metadata**

Create constants for the exact ten paths, intrinsic dimensions `1024 × 1536`, alt text, hierarchy and responsive `sizes`. Preserve the actual filenames, including `04-altimmo-hotel..png`, the descriptive 06 filename and `09-altimmo-owner-properties.png.png`.

- [ ] **Step 2: Replace the Sprint 1 hero with direct official mockups**

Render 01 as the dominant image with 02 and 04 as decorative support, the approved hero heading and copy, and CTAs to `/immobilier/annonces` and the on-page application story anchor. Set `priority` only on these three images.

- [ ] **Step 3: Implement sections 02–06**

Render Discover with 01, Map with 02, Buy/Rent with 03 and 06, Hospitality with 04 and 05, and Messaging/Visits with 07. Use coherent section ids and `aria-labelledby`, and avoid generic four-card SaaS layouts.

- [ ] **Step 4: Implement sections 07–10**

Render Owners with 09/08 and exact qualified commission copy, Personal Space with 10 and only audited features, Ecosystem with restrained decorative repeats, and the final CTA with `/immobilier/annonces` plus `/properties/submit`.

- [ ] **Step 5: Remove legacy page-only structures**

Delete old CSS-shell markup, old WEBP references, generic locality artwork and seven-section content from this component only. Do not delete shared assets from disk.

- [ ] **Step 6: Run the targeted test to expose styling-only or contract gaps**

Run: `cd client && npx vitest run lib/__tests__/AltimmoAppPage.test.jsx`

Expected: all DOM/asset/route assertions PASS.

### Task 3: Build the responsive editorial composition

**Files:**
- Modify: `client/lib/pages/AltimmoAppPage.module.css`
- Test: `client/lib/__tests__/AltimmoAppPage.test.jsx`

**Interfaces:**
- Consumes: class names emitted by Task 2.
- Produces: desktop, tablet and mobile visual hierarchy with no reconstructed devices or overflow.

- [ ] **Step 1: Replace legacy phone-shell CSS with editorial layout primitives**

Implement page container, alternating ivory/ink bands, content grids, hero three-mockup composition, single/double mockup compositions, use-step list, service list, CTA group and final editorial band. Do not define bezel, notch, screen or device-frame pseudo-elements.

- [ ] **Step 2: Implement desktop and tablet breakpoints**

At wide widths preserve intentional overlap and alternating direction; at 1024/768 reduce overlap, keep mockups contained and maintain header/footer clearance.

- [ ] **Step 3: Implement image-first mobile ordering**

At 430/390/375, position the visual before long copy in product sections, keep the principal mockup between roughly 70–90vw, stack CTAs, prevent horizontal overflow and avoid clipping.

- [ ] **Step 4: Add accessibility-state CSS**

Provide `:focus-visible` treatment and a `prefers-reduced-motion: reduce` block that removes nonessential transitions/transforms while leaving all content visible.

- [ ] **Step 5: Run the targeted test**

Run: `cd client && npx vitest run lib/__tests__/AltimmoAppPage.test.jsx`

Expected: PASS.

### Task 4: Route metadata and integration verification

**Files:**
- Modify only if required: `client/app/altimmo/application/page.jsx`
- Test: `client/lib/__tests__/AltimmoAppPage.test.jsx`

**Interfaces:**
- Consumes: completed `AltimmoAppPage`.
- Produces: accurate public metadata/structured data without unverified store or platform claims.

- [ ] **Step 1: Audit metadata against the finished page**

Remove or correct only claims contradicted by the repository audit; retain the route component and JSON-LD shape when accurate. Do not add store availability claims or badges.

- [ ] **Step 2: Re-run the targeted test**

Run: `cd client && npx vitest run lib/__tests__/AltimmoAppPage.test.jsx`

Expected: PASS.

### Task 5: Automated verification

**Files:**
- No planned production edits; fix only sprint-owned regressions if a command identifies one.

**Interfaces:**
- Consumes: Tasks 1–4.
- Produces: recorded evidence for the final report.

- [ ] **Step 1: Run the complete frontend test suite**

Run: `cd client && npm test`

Expected: PASS with no hidden failures.

- [ ] **Step 2: Run lint**

Run: `cd client && npm run lint`

Expected: exit 0; report any pre-existing warning separately.

- [ ] **Step 3: Run the production build**

Run: `cd client && npm run build`

Expected: exit 0 and `/altimmo/application` builds successfully, including the 06 filename.

- [ ] **Step 4: Validate patch hygiene**

Run: `git diff --check`

Expected: no output, exit 0.

### Task 6: Visual QA and final evidence

**Files:**
- Create: `artifacts/altimmo-product-storytelling/` screenshots only if this repository’s ignored artifact policy allows it; otherwise use a temporary directory and report absolute paths.

**Interfaces:**
- Consumes: locally running Next application from Tasks 1–5.
- Produces: required desktop/tablet/mobile screenshots and final audit evidence.

- [ ] **Step 1: Start the existing frontend dev server without dependency changes**

Run: `cd client && npm run dev`

Expected: `/altimmo/application` responds locally.

- [ ] **Step 2: Capture required desktop views at 1440px**

Capture hero, discover, map, buy/rent, hospitality, owner, account and final CTA.

- [ ] **Step 3: Capture required tablet views at 768px**

Capture hero and owner/account.

- [ ] **Step 4: Capture required mobile views at 390px**

Capture hero, map, buy/rent, hospitality, owner, account and final CTA.

- [ ] **Step 5: Inspect all required widths**

Verify 1440, 1280, 1024, 768, 430, 390 and 375 for transparent backgrounds, no double frames, image-first mobile order, readable scale, no collisions/clipping and no horizontal overflow.

- [ ] **Step 6: Record final Git evidence**

Run: `git status --short && git diff --stat && git diff --check`

Expected: only approved sprint/baseline files and documentation are changed; diff check passes.

- [ ] **Step 7: Produce the exact `SPRINT_2_PRODUCT_STORYTELLING_REPORT` format**

Populate every required field from command and visual evidence, list any baseline/pre-existing issue honestly, provide screenshot paths, set the evidence-based verdict, and stop without staging or committing.
