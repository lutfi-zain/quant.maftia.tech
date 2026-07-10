/**
 * Utility to export an array of chart subplot containers into a single merged PNG.
 * Handles high-DPI (devicePixelRatio) and composites absolute-positioned canvas layers correctly.
 */
export function exportChartsToPng(
	containers: HTMLElement[],
	filename: string,
) {
	if (!containers || containers.length === 0) return;

	const dpr = window.devicePixelRatio || 1;
	const footerHeight = 40; // 40px watermark area

	// 1. Calculate dimensions
	// Filter out containers with 0 height (collapsed panes)
	const activeContainers = containers.filter(c => c && c.clientHeight > 0);
	if (activeContainers.length === 0) return;

	const width = activeContainers[0].clientWidth;
	let totalHeight = 0;
	for (const c of activeContainers) {
		totalHeight += c.clientHeight;
	}
	totalHeight += footerHeight;

	// 2. Create composite canvas
	const composite = document.createElement("canvas");
	composite.width = width * dpr;
	composite.height = totalHeight * dpr;

	const ctx = composite.getContext("2d");
	if (!ctx) return;

	// Draw dark background (#0B1220)
	ctx.fillStyle = "#0B1220";
	ctx.fillRect(0, 0, composite.width, composite.height);

	let currentY = 0;

	// 3. Render each subplot's canvases
	for (const container of activeContainers) {
		const containerRect = container.getBoundingClientRect();
		const canvases = container.querySelectorAll("canvas");

		for (const canvas of Array.from(canvases)) {
			if (canvas.width === 0 || canvas.height === 0) continue;

			const rect = canvas.getBoundingClientRect();
			// Calculate relative coordinates in CSS pixels
			const relX = rect.left - containerRect.left;
			const relY = rect.top - containerRect.top;

			// Draw onto composite canvas
			ctx.drawImage(
				canvas,
				relX * dpr,
				(currentY + relY) * dpr,
				rect.width * dpr,
				rect.height * dpr
			);
		}

		currentY += container.clientHeight;
	}

	// 4. Draw branded watermark footer
	const today = new Date().toISOString().split("T")[0];
	const footerMiddleY = (totalHeight - footerHeight / 2) * dpr;

	ctx.fillStyle = "#64748B";
	ctx.font = `${11 * dpr}px "JetBrains Mono", monospace`;
	ctx.textBaseline = "middle";

	// Left alignment
	ctx.textAlign = "left";
	ctx.fillText("QUANT UNIFIED PLATFORM // VALUATION", 16 * dpr, footerMiddleY);

	// Right alignment
	ctx.textAlign = "right";
	ctx.fillText(`DATE: ${today}`, (width - 16) * dpr, footerMiddleY);

	// 5. Trigger download
	try {
		const dataUrl = composite.toDataURL("image/png");
		const link = document.createElement("a");
		link.download = filename;
		link.href = dataUrl;
		document.body.appendChild(link);
		link.click();
		document.body.removeChild(link);
	} catch (e) {
		console.error("Failed to generate chart PNG export:", e);
	}
}
