/**
 * Export multiple Lightweight Charts subplot canvases into a single merged PNG.
 * Uses devicePixelRatio for high-DPI output and adds a branding watermark.
 */

export function exportChartPng(
  containers: (HTMLDivElement | null)[],
  options?: {
    filename?: string;
    footerLeft?: string;
    footerRight?: string;
  },
): void {
  const validContainers = containers.filter(
    (c): c is HTMLDivElement => c !== null && c.querySelector('canvas') !== null,
  );

  if (validContainers.length === 0) return;

  const dpr = window.devicePixelRatio || 1;
  const footerHeight = 40;
  const panelGap = 2;

  const allCanvases: { canvas: HTMLCanvasElement; x: number; y: number }[] = [];
  let totalWidth = 0;
  let totalHeight = 0;

  for (const container of validContainers) {
    const canvases = container.querySelectorAll<HTMLCanvasElement>('canvas');
    const containerRect = container.getBoundingClientRect();

    for (const canvas of canvases) {
      const rect = canvas.getBoundingClientRect();
      const x = rect.left - containerRect.left;
      const y = rect.top - containerRect.top + totalHeight;
      allCanvases.push({ canvas, x, y });
      totalWidth = Math.max(totalWidth, containerRect.width);
    }
    totalHeight += containerRect.height + panelGap;
  }

  totalHeight += footerHeight;

  // Create merged canvas
  const mergedCanvas = document.createElement('canvas');
  mergedCanvas.width = totalWidth * dpr;
  mergedCanvas.height = totalHeight * dpr;

  const ctx = mergedCanvas.getContext('2d');
  if (!ctx) return;

  ctx.scale(dpr, dpr);

  // Dark background
  ctx.fillStyle = '#0B1220';
  ctx.fillRect(0, 0, totalWidth, totalHeight);

  // Draw each canvas
  for (const { canvas, x, y } of allCanvases) {
    ctx.drawImage(canvas, x, y + 2, canvas.width, canvas.height);
  }

  // Footer watermark
  const footerY = totalHeight - footerHeight;
  ctx.fillStyle = '#0B1220';
  ctx.fillRect(0, footerY, totalWidth, footerHeight);

  ctx.fillStyle = '#64748B';
  ctx.font = '11px "JetBrains Mono", monospace';
  ctx.textAlign = 'left';
  ctx.fillText(
    options?.footerLeft || 'QUANT UNIFIED PLATFORM // VALUATION',
    16,
    footerY + 24,
  );

  ctx.textAlign = 'right';
  const dateStr = new Date().toISOString().split('T')[0];
  ctx.fillText(
    options?.footerRight || `DATE: ${dateStr}`,
    totalWidth - 16,
    footerY + 24,
  );

  // Trigger download
  const dataUrl = mergedCanvas.toDataURL('image/png');
  const link = document.createElement('a');
  link.download = options?.filename || `btc-valuation-${dateStr}.png`;
  link.href = dataUrl;
  link.click();
}
