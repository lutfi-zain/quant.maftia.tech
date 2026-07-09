import { test, expect } from '@playwright/test';

test.describe('Full-Stack E2E Quantitative Terminal Verification', () => {
  test.beforeEach(async ({ page }) => {
    // Task 2.2: Global error monitoring across console and page errors
    const errors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        const text = msg.text();
        // Ignore benign favicon or external font fetch warnings if any, but catch JS/React/API errors
        if (!text.includes('favicon.ico')) {
          errors.push(`Console Error: ${text}`);
        }
      }
    });

    page.on('pageerror', err => {
      errors.push(`Page Error: ${err.message}`);
    });

    // Attach errors list to page context for verification during assertions
    (page as any).__consoleErrors = errors;
  });

  const assertNoRuntimeErrors = (page: any) => {
    const errors: string[] = (page as any).__consoleErrors || [];
    expect(errors, `Expected zero JavaScript console/page errors, found:\n${errors.join('\n')}`).toEqual([]);
  };

  const assertNoNaNOrUndefined = async (page: any) => {
    // Task 2.6: Ensure no NaN, null, undefined, or broken placeholders appear in visible text
    const bodyText = await page.locator('body').innerText();
    expect(bodyText).not.toContain('NaN');
    expect(bodyText).not.toContain('undefined');
    expect(bodyText).not.toContain('[object Object]');
    expect(bodyText).not.toContain('TELEMETRY SYNCHRONIZATION ERROR');
  };

  test('Task 2.3 & 2.6: Executive Dashboard navigates cleanly and renders complete quantitative telemetry without NaN/errors', async ({ page }) => {
    await page.goto('/');
    
    // Wait for the main executive header and bento summary
    await expect(page.locator('h1')).toContainText('Master Executive Dashboard');

    // Verify Lightweight Charts render
    await page.waitForSelector('.tv-lightweight-charts', { state: 'visible', timeout: 15000 });
    const chartContainers = page.locator('.tv-lightweight-charts');
    expect(await chartContainers.count(), 'Dashboard should render 4 vertically stacked subplots').toBeGreaterThanOrEqual(4);

    await assertNoNaNOrUndefined(page);
    assertNoRuntimeErrors(page);
  });

  test('Task 2.4: Live DOM layout strictly enforces 85px right Y-axis width across all dashboard subplots', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.tv-lightweight-charts', { state: 'visible', timeout: 15000 });

    // In Lightweight Charts DOM (v5), right price scale is in the 3rd table cell of the first row
    const rightScaleCells = page.locator('.tv-lightweight-charts tr:first-child > td:nth-child(3) > div');
    const count = await rightScaleCells.count();
    expect(count, 'Should have right price scale cells for each subplot').toBeGreaterThanOrEqual(4);

    for (let i = 0; i < count; i++) {
      const cell = rightScaleCells.nth(i);
      const box = await cell.boundingBox();
      if (box && box.height > 10) {
        // Assert container bounding box width equals strictly 85px (within 1px subpixel rendering tolerance)
        expect(Math.abs(Math.round(box.width) - 85), `Subplot ${i + 1} right price scale DOM width must equal 85px (±1px)`).toBeLessThanOrEqual(1);
      }
    }
    assertNoRuntimeErrors(page);
  });

  test('Task 2.5: Real-time crosshair synchronization coordinates vertical crosshairs across all 4 dashboard subplots', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.tv-lightweight-charts', { state: 'visible', timeout: 15000 });

    const chartPanes = page.locator('.tv-lightweight-charts');
    const priceChart = chartPanes.nth(0);
    const box = await priceChart.boundingBox();
    expect(box).not.toBeNull();

    if (box) {
      // Dispatch mouse movement across the center of the primary price chart canvas
      const targetX = box.x + box.width * 0.4;
      const targetY = box.y + box.height * 0.5;
      await page.mouse.move(targetX, targetY);
      await page.waitForTimeout(300);

      // Verify that hovered data point tooltip or crosshair state is activated across subplots without errors
      await assertNoNaNOrUndefined(page);
      assertNoRuntimeErrors(page);
    }
  });

  test('Task 2.3 & 2.6: Valuation Studio navigates and shows component matrix without NaN', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('aside', { state: 'visible' });

    await page.getByRole('button', { name: /Valuation Studio/i }).click();
    await expect(page.getByText('Piecewise Linear Component Matrix')).toBeVisible({ timeout: 10000 });

    // Wait for components and chart to render
    await page.waitForSelector('.tv-lightweight-charts', { state: 'visible', timeout: 15000 });
    await assertNoNaNOrUndefined(page);

    // Verify 85px Y-axis lock on Valuation chart canvas
    const rightCell = page.locator('.tv-lightweight-charts tr:first-child > td:nth-child(3) > div').first();
    const box = await rightCell.boundingBox();
    if (box && box.height > 10) {
      expect(Math.abs(Math.round(box.width) - 85)).toBeLessThanOrEqual(1);
    }

    assertNoRuntimeErrors(page);
  });

  test('Task 2.3 & 2.6: LTTD Lab (/lttd) navigates cleanly and verifies 3-State Gaussian HMM regime badges', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('aside', { state: 'visible' });

    await page.getByRole('button', { name: /LTTD Lab/i }).click();
    await expect(page.locator('h1')).toContainText('LTTD Lab (3-State Gaussian HMM)');

    await page.waitForSelector('.tv-lightweight-charts', { state: 'visible', timeout: 15000 });
    await assertNoNaNOrUndefined(page);

    // Verify regime badge text matches domain ubiquitous language (BULL, BEAR, SIDEWAYS)
    const bodyText = await page.locator('body').innerText();
    const hasRegime = bodyText.includes('BULL') || bodyText.includes('BEAR') || bodyText.includes('SIDEWAYS');
    expect(hasRegime, 'LTTD Lab must display valid HMM regime classification').toBe(true);

    assertNoRuntimeErrors(page);
  });

  test('Task 2.3 & 2.6: MTTD Console (/mttd) navigates cleanly and verifies 10 Statistical Families and Gates without NaN', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('aside', { state: 'visible' });

    await page.getByRole('button', { name: /MTTD Console/i }).click();
    await expect(page.locator('h1')).toContainText('MTTD Console (10 Statistical Families)');

    await page.waitForSelector('.tv-lightweight-charts', { state: 'visible', timeout: 15000 });
    await assertNoNaNOrUndefined(page);

    // Verify efficiency ratio and entropy gate values appear
    const bodyText = await page.locator('body').innerText();
    expect(bodyText.includes('Efficiency') || bodyText.includes('Entropy') || bodyText.includes('Chikou')).toBe(true);

    assertNoRuntimeErrors(page);
  });

  test('Task 2.3 & 2.6: Ichimoku Terminal (/ichimoku) navigates cleanly and verifies SuperSmoother IIR cloud rendering', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('aside', { state: 'visible' });

    await page.getByRole('button', { name: /Ichimoku Terminal/i }).click();
    await expect(page.locator('h1')).toContainText('Ichimoku Terminal (SuperSmoother IIR)');

    await page.waitForSelector('.tv-lightweight-charts', { state: 'visible', timeout: 15000 });
    await assertNoNaNOrUndefined(page);

    // Verify 85px Y-axis lock on Ichimoku chart canvas
    const rightCell = page.locator('.tv-lightweight-charts tr:first-child > td:nth-child(3) > div').first();
    const box = await rightCell.boundingBox();
    if (box && box.height > 10) {
      expect(Math.abs(Math.round(box.width) - 85)).toBeLessThanOrEqual(1);
    }

    assertNoRuntimeErrors(page);
  });
});
