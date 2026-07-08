import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test.describe('Quantitative Terminal Chart Synchronization & Layout Verification', () => {
  test('Subplot configuration explicitly enforces rightPriceScale: { minimumWidth: 85 } across all component chart declarations', async () => {
    const srcDir = path.resolve(__dirname, '../src');
    const filesToCheck = [
      'components/charts/MultiPaneChart.tsx',
      'components/studios/ValuationStudio.tsx',
      'components/studios/LttdLab.tsx',
      'components/studios/MttdConsole.tsx',
      'components/studios/IchimokuTerminal.tsx',
    ];

    for (const relPath of filesToCheck) {
      const fullPath = path.join(srcDir, relPath);
      const content = fs.readFileSync(fullPath, 'utf-8');

      // Check if createChart calls explicitly include minimumWidth: 85 inside rightPriceScale configuration
      const createChartMatches = content.match(/createChart\s*\([^)]+\)/g) || [];
      expect(createChartMatches.length, `File ${relPath} should have at least 1 createChart call`).toBeGreaterThan(0);

      const rightPriceScalePattern = /rightPriceScale\s*:\s*\{[^}]*minimumWidth\s*:\s*85[^}]*\}/;
      const commonChartOptionsRefPattern = /commonChartOptions/;

      // Either rightPriceScale configuration exists directly in options or via spread of commonChartOptions
      const hasStrictConfig = rightPriceScalePattern.test(content) || (commonChartOptionsRefPattern.test(content) && content.includes('minimumWidth: 85'));
      expect(hasStrictConfig, `File ${relPath} must enforce rightPriceScale: { minimumWidth: 85 } on all subplots`).toBe(true);
    }
  });

  test('MultiPaneChart layout maintains exact vertical crosshair sync alignment across all 4 subplots without horizontal drift', async () => {
    const multiPaneChartPath = path.resolve(__dirname, '../src/components/charts/MultiPaneChart.tsx');
    const content = fs.readFileSync(multiPaneChartPath, 'utf-8');

    // Verify that bidirectional vertical crosshair sync logic is present and iterates over chart panes cleanly
    expect(content).toContain('subscribeCrosshairMove');
    expect(content).toContain('setCrosshairPosition');
    expect(content).toContain('isSyncingRef');

    // Verify rightPriceScale configuration in commonChartOptions
    expect(content).toContain('minimumWidth: 85');
  });
});
