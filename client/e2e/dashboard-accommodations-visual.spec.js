import { test, expect } from './external-network.fixture';

const sizes = [{ name: 'desktop', width: 1440, height: 1000 }, { name: 'tablet', width: 900, height: 1100 }, { name: 'mobile', width: 390, height: 844 }];

test('comparaison visuelle Ventes, Locations et Hébergements', async ({ page }) => {
  test.setTimeout(120000);
  await page.goto('/login');
  await page.locator('#email').fill('owner-e2e@example.test');
  await page.locator('#password').fill('E2eOwner!2026');
  await page.getByRole('button', { name: /se connecter/i }).click();
  await expect(page).toHaveURL('/dashboard');
  const cookieButton = page.getByRole('button', { name: 'Tout accepter' });
  if (await cookieButton.isVisible().catch(() => false)) await cookieButton.click();
  for (const size of sizes) {
    await page.setViewportSize(size);
    for (const [module, path, title] of [['ventes','/dashboard/sales','Vente'], ['locations','/dashboard/rentals','Location'], ['hebergements','/dashboard/hebergements','Hébergements']]) {
      await page.goto(path);
      await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();
      await expect(page.locator('body')).not.toHaveCSS('overflow-x', 'scroll');
      await page.screenshot({ path: `test-results/dashboard-${module}-${size.name}.png`, fullPage: true });
    }
  }
  await page.goto('/dashboard/hebergements');
  await expect(page.getByText('Villa E2E Brazzaville')).toBeVisible();
  await page.getByRole('link', { name: 'Réservations' }).click();
  await expect(page).toHaveURL(/\/dashboard\/hebergements\/66e200000000000000000004\?view=reservations/);
  await expect(page.getByRole('heading', { name: 'Villa E2E Brazzaville' })).toBeVisible();
  // .first() : ce test partage l'accommodation fixture avec
  // accommodation-booking.spec.js, exécuté pour les deux projets
  // (desktop-chromium et mobile-chromium) contre le même serveur E2E — deux
  // réservations (dates différentes par projet) peuvent donc coexister ici.
  // L'intention du test est de vérifier que de vraies données s'affichent,
  // pas un nombre de lignes précis.
  await expect(page.getByText(/Aucune réservation\.|→ .* nuit/).first()).toBeVisible();
});
