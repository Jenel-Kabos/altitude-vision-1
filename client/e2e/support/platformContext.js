// F-U2.14 — Parcours réel d'un opérateur plateforme : les pages d'administration
// limitées à une organisation (« Sélectionnez un tenant à administrer »)
// exigent de choisir explicitement le tenant via le sélecteur de contexte du
// tableau de bord — jamais par contournement d'autorisation.
import { expect } from '@playwright/test';

export async function selectAdministeredTenant(page, tenantName) {
  const selector = page.getByRole('combobox', { name: 'Sélectionner le tenant à administrer' });
  const menuButton = page.getByRole('button', { name: 'Ouvrir le menu' });
  // Attendre le rendu du shell : sur desktop le sélecteur est visible ; sur
  // mobile il vit dans le menu latéral replié (aria-hidden/inert tant qu'il est
  // fermé) et seul le bouton « Ouvrir le menu » l'est.
  await expect(selector.or(menuButton).first()).toBeVisible();
  const openedMenu = !(await selector.isVisible());
  if (openedMenu) {
    // L'en-tête mobile collant est re-positionné en continu sous `next dev`
    // (contrôle « stable » de Playwright jamais satisfait) : clic forcé, l'issue
    // réelle (sélecteur rendu accessible) étant vérifiée juste après.
    // Un clic antérieur à l'hydratation React reste sans effet : on réitère
    // jusqu'à ouverture effective (le bouton ne fait qu'OUVRIR — idempotent).
    await expect(async () => {
      await menuButton.click({ force: true });
      await expect(selector).toBeVisible({ timeout: 2000 });
    }).toPass({ timeout: 30000 });
  }
  await expect(selector).toBeVisible();
  await selector.selectOption({ label: tenantName });
  if (openedMenu) await page.keyboard.press('Escape');
  await expect(page.getByRole('heading', { name: 'Sélectionnez un tenant à administrer' })).toHaveCount(0);
}
