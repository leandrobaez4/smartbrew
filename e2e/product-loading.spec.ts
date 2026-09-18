import { test, expect } from '@playwright/test';
import { build } from 'esbuild';
test.use({ channel: process.env.PW_CHANNEL === 'chrome' ? 'chrome' : undefined });

// Isolated real-browser fixture: no database, credentials or external requests.
let bundle: string;
test.beforeAll(async () => {
  const result = await build({
    stdin: {
      resolveDir: process.cwd(), loader: 'tsx',
      contents: `
        import React, { useState } from 'react';
        import { createRoot } from 'react-dom/client';
        import ProductLoading, { useProductLoading } from './src/app/admin/(dashboard)/products/ProductLoading';
        function Actions() {
          const [busy, setBusy] = useState(false);
          const [message, setMessage] = useState('');
          const router = useProductLoading(busy);
          async function run() {
            setBusy(true);
            try {
              await new Promise((resolve, reject) => { window.finishAction = resolve; window.failAction = reject; });
              router.refresh();
            } catch { setMessage('Error controlado'); }
            finally { setBusy(false); }
          }
          return <><button onClick={run}>Ejecutar acción</button><p>{message}</p>
            <form method="GET"><input name="search" defaultValue="café" /><select name="status" defaultValue="ACTIVE"><option>ACTIVE</option></select><button>Filtrar</button></form>
            <a href="/admin/products?page=2">Página 2</a>
          </>;
        }
        createRoot(document.getElementById('root')).render(<ProductLoading><Actions /></ProductLoading>);
      `,
    },
    bundle: true, write: false, format: 'iife', jsx: 'automatic',
    plugins: [{
      name: 'router-fixture',
      setup(builder) {
        builder.onResolve({ filter: /^next\/navigation$/ }, () => ({ path: 'router', namespace: 'fixture' }));
        builder.onLoad({ filter: /.*/, namespace: 'fixture' }, () => ({
          contents: `const router = {
            push: url => { window.lastNavigation = url; return new Promise(resolve => { window.finishNavigation = resolve; }); },
            refresh: () => new Promise(resolve => { window.finishNavigation = resolve; })
          }; export const useRouter = () => router;`,
        }));
      },
    }],
  });
  bundle = result.outputFiles[0].text;
});

test.beforeEach(async ({ page }) => {
  await page.route('http://localhost:4193/admin/products', route => route.fulfill({ contentType: 'text/html', body: '<html><body><div id="root"></div></body></html>' }));
  await page.goto('/admin/products');
  await page.addScriptTag({ content: bundle });
});

test('blocks background and stays open until action AND refresh finish', async ({ page }) => {
  await page.getByRole('button', { name: 'Ejecutar acción' }).click();
  const modal = page.getByRole('dialog', { name: 'Cargando' });
  await expect(modal).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(modal).toBeVisible();
  expect(await modal.evaluate(element => element.matches(':modal'))).toBe(true);
  await page.evaluate(() => (window as any).finishAction());
  await expect(modal).toBeVisible();
  await page.evaluate(() => (window as any).finishNavigation());
  await expect(modal).not.toBeVisible();
});

test('clears loading after a handled failure', async ({ page }) => {
  await page.getByRole('button', { name: 'Ejecutar acción' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.evaluate(() => (window as any).failAction(Error('test')));
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await expect(page.getByText('Error controlado')).toBeVisible();
});

test('filters through a pending client navigation preserving form values', async ({ page }) => {
  await page.getByRole('button', { name: 'Filtrar' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  expect(await page.evaluate(() => (window as any).lastNavigation)).toBe('/admin/products?search=caf%C3%A9&status=ACTIVE');
  await page.evaluate(() => (window as any).finishNavigation());
  await expect(page.getByRole('dialog')).not.toBeVisible();
});

test('pagination uses the same loading layer', async ({ page }) => {
  await page.getByRole('link', { name: 'Página 2' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  expect(await page.evaluate(() => (window as any).lastNavigation)).toBe('/admin/products?page=2');
  await page.evaluate(() => (window as any).finishNavigation());
  await expect(page.getByRole('dialog')).not.toBeVisible();
});
