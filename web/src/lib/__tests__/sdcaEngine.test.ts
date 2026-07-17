import { describe, it, expect } from "bun:test";
import {
	sdcaMultiplier,
	detectPhase,
	pricePercentile,
	compositeTrend,
	determineAction,
	regimeConfidence,
	computeSdcaSignal,
	computeSdcaSignals,
	type DailyRecord,
} from "../sdcaEngine";

// ─── sdcaMultiplier ─────────────────────────────────────────────────────────
// DATABASE CONVENTION: negative = overvalued (sell), positive = undervalued (buy)

describe("sdcaMultiplier", () => {
	it("returns 3.0x for deep discount (composite >= +1.5)", () => {
		expect(sdcaMultiplier(1.6)).toBe(3.0);
		expect(sdcaMultiplier(2.0)).toBe(3.0);
		expect(sdcaMultiplier(10)).toBe(3.0);
	});

	it("returns 2.0x for value zone (composite >= +1.0)", () => {
		expect(sdcaMultiplier(1.0)).toBe(2.0);
		expect(sdcaMultiplier(1.2)).toBe(2.0);
		expect(sdcaMultiplier(1.49)).toBe(2.0);
	});

	it("returns 1.5x for fair-low zone (composite >= +0.5)", () => {
		expect(sdcaMultiplier(0.5)).toBe(1.5);
		expect(sdcaMultiplier(0.7)).toBe(1.5);
		expect(sdcaMultiplier(0.99)).toBe(1.5);
	});

	it("returns 1.0x for fair zone (composite > -0.5 to < +0.5)", () => {
		expect(sdcaMultiplier(0.0)).toBe(1.0);
		expect(sdcaMultiplier(0.2)).toBe(1.0);
		expect(sdcaMultiplier(-0.3)).toBe(1.0);
		expect(sdcaMultiplier(-0.49)).toBe(1.0);
	});

	it("returns 0.5x for rich zone (composite <= -0.5)", () => {
		expect(sdcaMultiplier(-0.5)).toBe(0.5);
		expect(sdcaMultiplier(-0.7)).toBe(0.5);
		expect(sdcaMultiplier(-0.99)).toBe(0.5);
	});

	it("returns 0.0x for expensive zone (composite <= -1.0)", () => {
		expect(sdcaMultiplier(-1.0)).toBe(0.0);
		expect(sdcaMultiplier(-1.2)).toBe(0.0);
		expect(sdcaMultiplier(-1.49)).toBe(0.0);
	});

	it("returns -0.5x for euphoria zone (composite <= -1.5)", () => {
		expect(sdcaMultiplier(-1.5)).toBe(-0.5);
		expect(sdcaMultiplier(-1.7)).toBe(-0.5);
		expect(sdcaMultiplier(-2.0)).toBe(-0.5);
	});

	it("handles exact boundary values", () => {
		expect(sdcaMultiplier(1.5)).toBe(3.0);
		expect(sdcaMultiplier(1.0)).toBe(2.0);
		expect(sdcaMultiplier(0.5)).toBe(1.5);
		expect(sdcaMultiplier(-0.5)).toBe(0.5);
		expect(sdcaMultiplier(-1.0)).toBe(0.0);
		expect(sdcaMultiplier(-1.5)).toBe(-0.5);
	});
});

// ─── detectPhase ────────────────────────────────────────────────────────────

describe("detectPhase", () => {
	it("detects Deep Discount (composite >= +1.0, pctile < 25, trend+)", () => {
		expect(detectPhase(1.2, 20, true)).toBe("deep_discount");
		expect(detectPhase(1.5, 10, true)).toBe("deep_discount");
	});

	it("does NOT detect Deep Discount if trend is negative", () => {
		expect(detectPhase(1.2, 20, false)).not.toBe("deep_discount");
	});

	it("does NOT detect Deep Discount if price percentile too high", () => {
		expect(detectPhase(1.2, 30, true)).not.toBe("deep_discount");
	});

	it("detects Euphoria (composite <= -1.0, pctile > 80, trend-)", () => {
		expect(detectPhase(-1.2, 85, false)).toBe("euphoria");
		expect(detectPhase(-1.5, 95, false)).toBe("euphoria");
	});

	it("does NOT detect Euphoria if trend is positive", () => {
		expect(detectPhase(-1.2, 85, true)).not.toBe("euphoria");
	});

	it("detects Value (composite >= +0.5, pctile < 40)", () => {
		expect(detectPhase(0.7, 35, true)).toBe("value");
		expect(detectPhase(0.5, 20, false)).toBe("value");
	});

	it("detects Expansion (composite <= -0.5, pctile > 60)", () => {
		expect(detectPhase(-0.7, 70, true)).toBe("expansion");
		expect(detectPhase(-0.5, 65, false)).toBe("expansion");
	});

	it("defaults to Fair for middle range", () => {
		expect(detectPhase(0.1, 50, true)).toBe("fair");
		expect(detectPhase(-0.3, 45, false)).toBe("fair");
		expect(detectPhase(0.0, 50, true)).toBe("fair");
	});
});

// ─── pricePercentile ────────────────────────────────────────────────────────

describe("pricePercentile", () => {
	it("calculates percentile correctly", () => {
		const prices = [100, 200, 300, 400, 500];
		// At index 4 (price=500), window is [100,200,300,400]
		// All 4 prices are below 500 → 100th percentile
		expect(pricePercentile(prices, 4)).toBe(100);
	});

	it("returns 50 for empty window (cold start)", () => {
		expect(pricePercentile([100], 0)).toBe(50);
	});

	it("handles partial window", () => {
		const prices = [100, 200, 300];
		// At index 2 (price=300), window is [100, 200]
		// Both below 300 → 100th percentile
		expect(pricePercentile(prices, 2)).toBe(100);
	});

	it("calculates percentile correctly", () => {
		const prices = [100, 200, 300, 400, 500];
		// At index 3 (price=400), window is [100, 200, 300]
		// All 3 prices below 400 → 100th percentile
		expect(pricePercentile(prices, 3)).toBe(100);
	});
});

// ─── compositeTrend ─────────────────────────────────────────────────────────

describe("compositeTrend", () => {
	it("returns true when 7d avg > 30d avg (positive momentum)", () => {
		// Recent 7 days higher than 30-day average
		const composites = [
			...Array(23).fill(-1.0), // 23 days at -1.0
			...Array(7).fill(-0.5), // 7 recent days at -0.5 (higher)
		];
		expect(compositeTrend(composites, 30)).toBe(true);
	});

	it("returns false when 7d avg < 30d avg (negative momentum)", () => {
		// Recent 7 days lower than 30-day average
		const composites = [
			...Array(23).fill(-0.5), // 23 days at -0.5
			...Array(7).fill(-1.0), // 7 recent days at -1.0 (lower)
		];
		expect(compositeTrend(composites, 30)).toBe(false);
	});

	it("returns true for insufficient data (default positive)", () => {
		expect(compositeTrend([0.1, 0.2], 2)).toBe(true);
	});
});

// ─── determineAction ────────────────────────────────────────────────────────

describe("determineAction", () => {
	it("START_AGGRESSIVE_DCA on entry signal (composite crosses +1.0)", () => {
		expect(determineAction(1.1, 0.9, 20, true, 0)).toBe("START_AGGRESSIVE_DCA");
	});

	it("does NOT trigger entry if trend is negative", () => {
		expect(determineAction(1.1, 0.9, 20, false, 0)).not.toBe(
			"START_AGGRESSIVE_DCA",
		);
	});

	it("does NOT trigger entry if percentile too high", () => {
		expect(determineAction(1.1, 0.9, 30, true, 0)).not.toBe(
			"START_AGGRESSIVE_DCA",
		);
	});

	it("SELL_ALL on composite <= -1.0 (euphoria/top)", () => {
		expect(determineAction(-1.2, -0.9, 90, false, 0)).toBe("SELL_ALL");
		expect(determineAction(-1.0, -0.8, 50, true, 0)).toBe("SELL_ALL");
	});

	it("REDUCE_POSITION on gradual exit (cross -0.5, high percentile)", () => {
		expect(determineAction(-0.6, -0.4, 85, false, 0)).toBe("REDUCE_POSITION");
	});

	it("REDUCE_POSITION on extended euphoria (< -0.5 for > 30 days)", () => {
		expect(determineAction(-0.7, -0.6, 75, false, 35)).toBe("REDUCE_POSITION");
	});

	it("NORMAL_DCA in buy zone (composite >= +0.5)", () => {
		expect(determineAction(0.6, 0.5, 30, true, 0)).toBe("NORMAL_DCA");
	});

	it("HOLD in neutral zone", () => {
		expect(determineAction(0.2, 0.1, 50, true, 0)).toBe("HOLD");
	});
});

// ─── regimeConfidence ───────────────────────────────────────────────────────

describe("regimeConfidence", () => {
	it("returns HIGH for consistent composite (no sign changes)", () => {
		const composites = Array(200).fill(-1.0); // All negative
		const prices = Array(200)
			.fill(0)
			.map((_, i) => 50000 - i * 100); // Declining prices
		expect(regimeConfidence(composites, prices, 200)).toBe("HIGH");
	});

	it("returns LOW for volatile composite (> 3 sign changes in 90 days)", () => {
		// Create composites that change sign frequently
		const composites = [];
		for (let i = 0; i < 100; i++) {
			composites.push(i % 10 < 5 ? 0.5 : -0.5); // Changes sign every 5 days
		}
		const prices = Array(100).fill(50000);
		expect(regimeConfidence(composites, prices, 100)).toBe("LOW");
	});

	it("returns HIGH for insufficient data (default)", () => {
		expect(regimeConfidence([0.1, 0.2], [50000, 51000], 2)).toBe("HIGH");
	});
});

// ─── computeSdcaSignal ──────────────────────────────────────────────────────

describe("computeSdcaSignal", () => {
	it("computes full signal for a given day", () => {
		const data: DailyRecord[] = Array.from({ length: 60 }, (_, i) => ({
			date: `2024-${String(Math.floor(i / 28) + 1).padStart(2, "0")}-${String((i % 28) + 1).padStart(2, "0")}`,
			close: 50000 + i * 100,
			valuation_composite: 1.2 - i * 0.02, // Falling from deep discount
		}));

		const signal = computeSdcaSignal(data, 59);
		expect(signal.date).toContain("2024-");
		expect(signal.multiplier).toBeGreaterThanOrEqual(-0.5);
		expect(signal.multiplier).toBeLessThanOrEqual(3.0);
		expect([
			"deep_discount",
			"value",
			"fair",
			"expansion",
			"euphoria",
		]).toContain(signal.phase);
	});

	it("enforces t-1 causal filtering", () => {
		const data: DailyRecord[] = [
			{ date: "2024-01-01", close: 50000, valuation_composite: 1.5 }, // Deep discount
			{ date: "2024-01-02", close: 51000, valuation_composite: 1.5 },
			{ date: "2024-01-03", close: 52000, valuation_composite: -1.5 }, // Spike to euphoria at t=2
		];

		// Signal for day 3 (index 2) should use day 2 data (composite 1.5 → multiplier 3.0)
		// NOT day 3 data (composite -1.5 → multiplier -0.5)
		const signal = computeSdcaSignal(data, 2);
		expect(signal.multiplier).toBe(3.0); // Based on day 2 composite, NOT day 3
	});
});

// ─── computeSdcaSignals (vectorized) ────────────────────────────────────────

describe("computeSdcaSignals", () => {
	it("computes signals for entire dataset", () => {
		const data: DailyRecord[] = Array.from({ length: 30 }, (_, i) => ({
			date: `2024-01-${String(i + 1).padStart(2, "0")}`,
			close: 50000,
			valuation_composite: 0.0,
		}));

		const signals = computeSdcaSignals(data);
		expect(signals).toHaveLength(30);
		signals.forEach((s) => {
			expect(s.multiplier).toBe(1.0); // Fair zone → 1.0x
			expect(s.phase).toBe("fair");
		});
	});
});
