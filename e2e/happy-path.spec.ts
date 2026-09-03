import { test, expect } from '@playwright/test';

test('MVP happy path flow', async ({ page }) => {
  // Test basic routes loading (skip DB auth for simple testing if offline)
  await page.goto('/admin/login');
  await expect(page).toHaveTitle(/Create Next App|Affiliate/i);

  // We won't test full login in this skeleton since we need the DB running in Playwright,
  // but we can check the public page.
  await page.goto('/productos');
  await expect(page.locator('h1')).toContainText('Productos Recomendados');
});
