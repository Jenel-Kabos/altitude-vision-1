import { test, expect } from './external-network.fixture';
import { loginThroughUi } from './support/auth';
import { selectAdministeredTenant } from './support/platformContext';

const sizes = [{ name: 'desktop', width: 1440, height: 1000 }, { name: 'tablet', width: 900, height: 1100 }, { name: 'mobile', width: 390, height: 844 }];

test('comparaison visuelle Ventes, Locations et Hébergements', async ({ page }) => {
  test.setTimeout(120000);
  // F-U2.14 : connexion partagée robuste (hydratation + compilation `next dev`).
  await loginThroughUi(page, { email: 'owner-e2e@example.test', password: 'E2eOwner!2026' });
  await expect(page).toHaveURL('/dashboard');
  // F-U2.14 : l'administrateur E2E est un opérateur plateforme ; les modules
  // Vente/Location/Hébergements d'organisation s'affichent dans le tenant
  // sélectionné (sélection persistée) — sinon la vue plateforme s'affiche.
  await page.goto('/dashboard/sales');
  await selectAdministeredTenant(page, 'Tenant E2E');
  // F-U2.14 : Ventes/Locations sont servies par PropertyRegistry (38001d0), dont le
  // titre nomme le contexte administré (« Ventes — <tenant> »).
  for (const size of sizes) {
    await page.setViewportSize(size);
    for (const [module, path, title] of [['ventes','/dashboard/sales','Ventes — Tenant E2E'], ['locations','/dashboard/rentals','Locations — Tenant E2E'], ['hebergements','/dashboard/hebergements','Hébergements']]) {
      await page.goto(path);
      await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();
      await expect(page.locator('body')).not.toHaveCSS('overflow-x', 'scroll');
      await page.screenshot({ path: `test-results/dashboard-${module}-${size.name}.png`, fullPage: true });
    }
  }
  await page.goto('/dashboard/hebergements');
  await expect(page.getByText('Villa E2E Brazzaville')).toBeVisible();
  // F-U2.14 : plusieurs hébergements de l'organisation exposent « Réservations » ;
  // on ouvre celui de la villa (lien de sa carte).
  await page.locator('a[href="/dashboard/hebergements/66e200000000000000000004?view=reservations"]').click();
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
