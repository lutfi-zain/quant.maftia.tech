import { test, expect } from '@playwright/test';

test.describe('Valuation Studio Parity', () => {
  test.beforeEach(async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        const text = msg.text();
        if (!text.includes('favicon.ico') && !text.includes('ERR_BLOCKED_BY_CLIENT')) {
          errors.push(`Console Error: ${text}`);
        }
      }
    });
    page.on('pageerror', (err) => { errors.push(`Page Error: ${err.message}`); });
    (page as any).__consoleErrors = errors;

    await page.goto('/');
    await page.waitForSelector('aside', { state: 'visible', timeout: 10000 });
  });

  const assertNoCriticalErrors = (page: any) => {
    const errs: string[] = (page as any).__consoleErrors || [];
    const critical = errs.filter(e => !e.includes('Encountered two children with the same key') && !e.includes('Value is null'));
    expect(critical).toEqual([]);
  };

  const assertNoNaNOrUndefined = async (page: any) => {
    const bodyText = await page.locator('body').innerText();
    expect(bodyText).not.toContain('NaN');
    expect(bodyText).not.toContain('undefined');
  };

  test('Valuation Studio renders component matrix with sparklines', async ({ page }) => {
    await page.getByRole('button', { name: /Valuation Studio/i }).click();
    await expect(page.getByText('Piecewise Linear Component Matrix')).toBeVisible({ timeout: 10000 });

    await page.waitForSelector('table tbody tr', { state: 'attached', timeout: 10000 });
    const rows = page.locator('table tbody tr');
    const rowCount = await rows.count();
    expect(rowCount).toBeGreaterThan(0);

    // Verify sparklines render as SVG elements
    const svgs = page.locator('table tbody tr svg');
    const svgCount = await svgs.count();
    expect(svgCount).toBeGreaterThanOrEqual(1);

    await assertNoNaNOrUndefined(page);
    assertNoCriticalErrors(page);
  });

  test('Clicking a metric row opens the metric detail chart', async ({ page }) => {
    await page.getByRole('button', { name: /Valuation Studio/i }).click();
    await expect(page.getByText('Piecewise Linear Component Matrix')).toBeVisible({ timeout: 10000 });

    // Click first indicator row
    await page.locator('table tbody tr').first().click();
    await page.waitForTimeout(3000);

    // Should show metric detail chart with threshold editor
    const numInputs = page.locator('input[type="number"]');
    const inputCount = await numInputs.count();
    expect(inputCount).toBeGreaterThanOrEqual(1);

    await assertNoNaNOrUndefined(page);
    assertNoCriticalErrors(page);
  });

  test('PNG export button is visible', async ({ page }) => {
    await page.getByRole('button', { name: /Valuation Studio/i }).click();
    await expect(page.getByText('SAVE PNG', { exact: false })).toBeVisible({ timeout: 10000 });
    assertNoCriticalErrors(page);
  });

  test('LOG/LIN toggle works', async ({ page }) => {
    await page.getByRole('button', { name: /Valuation Studio/i }).click();
    await expect(page.getByText('Piecewise Linear Component Matrix')).toBeVisible({ timeout: 10000 });

    const linBtn = page.locator('.toggle-group button:first-child');
    const logBtn = page.locator('.toggle-group button:last-child');

    // LIN should be active when log is false
    await linBtn.click();
    await expect(linBtn).toHaveClass(/active/);

    // Click LOG back
    await logBtn.click();
    await expect(logBtn).toHaveClass(/active/);

    assertNoCriticalErrors(page);
  });
});
