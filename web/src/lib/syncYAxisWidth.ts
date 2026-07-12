import type { IChartApi } from "lightweight-charts";

/**
 * After all charts in a studio are initialized and rendered, measure the BTC
 * chart's actual right price scale width from the DOM and apply the same
 * minimumWidth to all other subplot charts. This ensures consistent Y-axis
 * width across all panes regardless of label content length, since
 * Lightweight Charts' `minimumWidth` is only a floor — the scale can still
 * auto-expand for wider labels (e.g. BTC price numbers vs oscillator values).
 *
 * Call once after all charts are created and data is populated, then again
 * inside the ResizeObserver callback and the maximize resize effect.
 *
 * @param btcContainer - The container element of the BTC (first/candlestick) chart
 * @param allCharts    - Array of all subplot charts (including BTC)
 * @param yWidth       - Fallback width from CSS variable if DOM read fails
 */
export function syncYAxisWidth(
	btcContainer: HTMLElement | null,
	allCharts: (IChartApi | null)[],
	yWidth: number,
): void {
	if (!btcContainer || allCharts.length === 0) return;

	// Find the price axis pane — Lightweight Charts creates it as a child div
	// positioned at the right side of the container. Look for the rightmost
	// child element that isn't a canvas and has a non-zero offsetWidth.
	let axisWidth = yWidth;
	for (let i = 0; i < btcContainer.children.length; i++) {
		const child = btcContainer.children[i] as HTMLElement;
		if (
			child.tagName !== "CANVAS" &&
			child.offsetWidth > 0 &&
			child.offsetWidth < btcContainer.offsetWidth // not full-width
		) {
			axisWidth = Math.max(child.offsetWidth, yWidth);
			break;
		}
	}

	// If still can't determine, estimate from container vs canvas size
	if (axisWidth === yWidth) {
		const canvases = btcContainer.querySelectorAll("canvas");
		if (canvases.length > 0) {
			const firstCanvas = canvases[0] as HTMLElement;
			const estimated = btcContainer.offsetWidth - firstCanvas.offsetWidth;
			if (estimated > 0) {
				axisWidth = Math.max(estimated, yWidth);
			}
		}
	}

	// Apply to all subplots
	for (const chart of allCharts) {
		if (!chart) continue;
		try {
			chart.priceScale("right").applyOptions({ minimumWidth: axisWidth });
		} catch {
			// ignore if price scale not ready
		}
	}
}
