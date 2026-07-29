import { test, expect } from '@playwright/test';

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
  await page.getByRole('button', { name: 'Réservations' }).last().click();
  await expect(page.getByText(/Filtre actif : Villa E2E Brazzaville/)).toBeVisible();
});
