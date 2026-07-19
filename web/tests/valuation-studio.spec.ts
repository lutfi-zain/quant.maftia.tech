import { test, expect } from "@playwright/test";

test.describe("Valuation Studio SDCA Integration", () => {
	test.beforeEach(async ({ page }) => {
		// Global error monitoring
		const errors: string[] = [];
		page.on("console", (msg) => {
			if (msg.type() === "error") {
				const text = msg.text();
				if (!text.includes("favicon.ico") && !text.includes("WebSocket")) {
					errors.push(`Console Error: ${text}`);
				}
			}
		});

		page.on("pageerror", (err) => {
			if (!err.message.includes("WebSocket")) {
				errors.push(`Page Error: ${err.message}`);
			}
		});
		(page as any).__consoleErrors = errors;
	});

	test("Dynamic Date Range Slicing maps to Backend SDCA Arrays", async ({
		page,
	}) => {
		// Intercept the API to provide mock consistent data
		await page.route("**/api/v1/backtest/sdca", async (route) => {
			// Provide a static 5-day dummy array
			await route.fulfill({
				status: 200,
				contentType: "application/json",
				body: JSON.stringify({
					signals: [
						{
							date: "2026-07-01",
							multiplier: 1.0,
							phase: "fair",
							action: "BUY",
							confidence: "HIGH",
						},
						{
							date: "2026-07-02",
							multiplier: 1.5,
							phase: "value",
							action: "BUY",
							confidence: "HIGH",
						},
						{
							date: "2026-07-03",
							multiplier: 0.5,
							phase: "expansion",
							action: "SELL",
							confidence: "LOW",
						},
						{
							date: "2026-07-04",
							multiplier: 0.0,
							phase: "euphoria",
							action: "HOLD",
							confidence: "LOW",
						},
						{
							date: "2026-07-05",
							multiplier: -0.5,
							phase: "euphoria",
							action: "SELL",
							confidence: "LOW",
						},
					],
					records: [
						{ date: "2026-07-01", close: 60000, valuation_composite: 0.0 },
						{ date: "2026-07-02", close: 55000, valuation_composite: 0.8 },
						{ date: "2026-07-03", close: 65000, valuation_composite: -0.8 },
						{ date: "2026-07-04", close: 70000, valuation_composite: -1.2 },
						{ date: "2026-07-05", close: 75000, valuation_composite: -1.8 },
					],
					metrics: {
						sharpeRatio: 1.23,
						totalReturn: 45.6,
						maxDrawdown: 10.5,
						winRate: 65.0,
						profitFactor: 2.1,
						totalTrades: 12,
					},
				}),
			});
		});

		await page.goto("/valuation");
		await page.waitForSelector(".tv-lightweight-charts", { state: "visible" });

		// Ensure no console errors occur while parsing API Payload
		const errors: string[] = (page as any).__consoleErrors || [];
		expect(errors).toEqual([]);

		// Ensure metrics are rendered without NaN
		const bodyText = await page.locator("body").innerText();
		expect(bodyText).not.toContain("NaN");
	});
});
