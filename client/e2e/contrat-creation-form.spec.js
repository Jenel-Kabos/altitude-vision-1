import { expect, test } from '@playwright/test';

// REG-GL-1.1 — Deux incompatibilités frontend/backend empêchaient toute
// création de contrat manuelle depuis GestionLocativePage.jsx :
// (1) sélectionner un "bien propre" (Proprietaire.biensPropres[], sans
//     document Property réel) laissait `bien` vide → 400
//     INVALID_CONTRACT_INPUT ("Le bien et le type de contrat sont
//     requis.") — cette option n'est plus sélectionnable dans le formulaire.
// (2) sélectionner un bien réel du portefeuille copiait Property.address
//     (un objet {street, neighborhood, arrondissement, city}) tel quel
//     dans Contrat.adresseBien (un champ String) → CastError Mongoose.
const admin = { email: 'owner-e2e@example.test', password: 'E2eOwner!2026' };
test.setTimeout(120000);

async function login(page) {
  await page.goto('/login');
  await page.locator('#email').fill(admin.email);
  await page.locator('#password').fill(admin.password);
  await page.getByRole('button', { name: /se connecter/i }).click();
  await expect(page).not.toHaveURL(/\/login/);
  const consent = page.getByRole('button', { name: 'Tout accepter', exact: true });
  if (await consent.isVisible().catch(() => false)) await consent.click();
}

// GL-ARCH-1.1/1.2 — flux complet Phase 12/13 : un bien propre n'apparaît
// jamais comme option sélectionnable du portefeuille tant qu'il n'est pas
// intégré ; le staff peut l'intégrer à la Gestion locative (Property réel +
// RentalManagement actif créés, arrondissement/latitude/longitude complétés
// puisque jamais présents sur biensPropres[]), la sélection se fait
// automatiquement, et un contrat peut être créé dessus sans aucune exigence
// de publication.
//
// GL-ARCH-1.2 — desktop-chromium et mobile-chromium partagent la même base
// éphémère (un seul webServer Playwright pour tout le run) : l'import
// biensPropres→Property crée un état PERMANENT (Property.sourceOwnerAssetId
// unique + RentalManagement actif), jamais nettoyé entre projets par
// conception. Réutiliser le même Proprietaire/bien source pour les deux
// projets rendait donc le second projet à s'exécuter dépendant du premier
// (bien déjà importé) — cause exacte du `skip` précédent. Correction : deux
// fiches Proprietaire.biensPropres[] entièrement distinctes (mêmes
// conventions que "Maison Location E2E" / "Maison Location E2E Mobile" du
// test suivant), chacune avec son propre `_id` → sa propre clé
// `sourceOwnerAssetId` unique. Chaque projet importe SON propre bien,
// indépendamment de l'autre, dans n'importe quel ordre, sans collision.
test('intégrer un bien propre à la Gestion locative puis créer un contrat dessus', async ({ page }, testInfo) => {
  const isMobile = testInfo.project.name === 'mobile-chromium';
  const proprietaireLabel = isMobile ? /^BienPropreMobile PropriétaireE2E$/ : /^BienPropre PropriétaireE2E$/;
  const bienTitre = isMobile ? 'Bien propre E2E Mobile' : 'Bien propre E2E';
  const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // GL-ARCH-1.2 — "Bien propre E2E" est un préfixe exact de "Bien propre E2E
  // Mobile" : desktop-chromium et mobile-chromium partagent la même base, et
  // selon l'ordre d'exécution le bien de L'AUTRE projet peut déjà avoir été
  // importé (donc visible dans le <select> Portefeuille Altimmo ET dans la
  // liste des contrats) au moment où ce test s'exécute. `getByText`/`hasText`
  // en sous-chaîne matcheraient alors aussi cet autre bien — une
  // correspondance exacte est donc nécessaire partout, y compris pour la
  // ligne biensPropres[] (dont le texte combine titre + adresse : on ancre
  // sur "titre + tiret" pour ne matcher que cette ligne précise, jamais
  // l'option/la cellule de contrat de l'autre projet qui n'ont pas de tiret).
  const bienTitreOptionExact = new RegExp(`^${escapeRegExp(bienTitre)}$`);
  const bienRowLabel = new RegExp(`^${escapeRegExp(bienTitre)} —`);

  await login(page);
  await page.goto('/dashboard/gestion-locative');
  await page.getByRole('button', { name: /nouveau contrat/i }).click();

  const proprietaireSelect = page.locator('label:text("Propriétaire")').locator('xpath=following-sibling::select');
  const proprietaireOptionText = await proprietaireSelect.locator('option', { hasText: proprietaireLabel }).textContent();
  await proprietaireSelect.selectOption({ label: proprietaireOptionText });

  const bienSelect = page.locator('label:text("Bien immobilier")').locator('xpath=following-sibling::select');
  await expect(bienSelect.locator('option', { hasText: bienTitreOptionExact })).toHaveCount(0);
  await expect(page.getByText(bienRowLabel)).toBeVisible();
  await page.getByRole('button', { name: /ajouter à la gestion locative/i }).click();
  await page.getByPlaceholder('Arrondissement').fill('Bacongo');
  await page.getByPlaceholder('Latitude').fill('-4.26');
  await page.getByPlaceholder('Longitude').fill('15.24');

  const [importResponse] = await Promise.all([
    page.waitForResponse((r) => r.url().includes('/importer-gestion') && r.request().method() === 'POST'),
    page.getByRole('button', { name: /confirmer l.import/i }).click(),
  ]);
  expect(importResponse.status()).toBe(201);
  const importedPropertyId = (await importResponse.json()).data.property._id;

  await expect(page.getByText('Intégré ✓')).toBeVisible();
  await expect(bienSelect).toHaveValue(importedPropertyId);

  await page.locator('label:text("Loyer/mois")').locator('xpath=following-sibling::input').fill('275000');
  const [contratResponse] = await Promise.all([
    page.waitForResponse((r) => r.url().includes('/api/contrats') && r.request().method() === 'POST'),
    page.getByRole('button', { name: /enregistrer/i }).click(),
  ]);
  expect(contratResponse.status()).toBe(201);
  const body = await contratResponse.json();
  expect(String(body.data.contrat.bien._id)).toBe(String(importedPropertyId));
  await expect(page.getByText(/Contrat créé/i)).toBeVisible();
});

test('création de contrat avec un bien du portefeuille Altimmo réussit et le contrat apparaît dans la liste', async ({ page }, testInfo) => {
  // desktop-chromium et mobile-chromium partagent la même base ; un bien
  // distinct par projet évite le conflit d'index "un contrat ouvert par bien".
  const bienTitre = testInfo.project.name === 'mobile-chromium' ? 'Maison Location E2E Mobile' : 'Maison Location E2E';

  await login(page);
  await page.goto('/dashboard/gestion-locative');
  await page.getByRole('button', { name: /nouveau contrat/i }).click();

  // GL-ARCH-1.2 — deux fiches "BienPropre*" existent désormais (desktop et
  // mobile, voir le test précédent) : ce scénario ne dépend pas du contenu
  // biensPropres[] du propriétaire (seul le bien du portefeuille Altimmo
  // compte ici), donc peu importe laquelle — la correspondance doit
  // toutefois rester non ambiguë (`hasText` substring matcherait les deux).
  const proprietaireSelect = page.locator('label:text("Propriétaire")').locator('xpath=following-sibling::select');
  const proprietaireOptionText = await proprietaireSelect.locator('option', { hasText: /^BienPropre PropriétaireE2E$/ }).textContent();
  await proprietaireSelect.selectOption({ label: proprietaireOptionText });

  const bienSelect = page.locator('label:text("Bien immobilier")').locator('xpath=following-sibling::select');
  const bienOptionText = await bienSelect.locator('option', { hasText: new RegExp(`^${bienTitre}$`) }).textContent();
  await bienSelect.selectOption({ label: bienOptionText });

  await page.locator('label:text("Loyer/mois")').locator('xpath=following-sibling::input').fill('250000');

  const [response] = await Promise.all([
    page.waitForResponse((r) => r.url().includes('/api/contrats') && r.request().method() === 'POST'),
    page.getByRole('button', { name: /enregistrer/i }).click(),
  ]);

  expect(response.status()).toBe(201);
  const body = await response.json();
  expect(body.data.contrat.bien).toBeTruthy();
  expect(body.data.contrat.adresseBien).toBe('Moungali');
  expect(body.data.contrat.villeBien).toBe('Brazzaville');

  await expect(page.getByText(/Contrat créé/i)).toBeVisible();
  // GL-ARCH-1.2 — correspondance exacte : "Maison Location E2E" est un
  // préfixe de "Maison Location E2E Mobile", et les deux contrats (un par
  // projet) coexistent désormais dans la même liste partagée.
  await expect(page.getByText(bienTitre, { exact: true })).toBeVisible();
});
