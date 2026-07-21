/**
 * SDCA (Strategic Dollar Cost Averaging) Signal Engine
 *
 * Maps valuation_composite ∈ [-2.0, +2.0] to DCA allocation multiplier [-0.5x, +3.0x].
 *
 * CRITICAL SIGN CONVENTION:
 * - Positive composite (+1.0 to +2.0) = Undervalued / Deep Discount → BUY zone (price bottoms)
 * - Negative composite (-1.0 to -2.0) = Overvalued / Bubble → SELL zone (price tops)
 * - Composite 0.0 = Fair value
 *
 * All signals enforce strict t-1 causal filtering: signal for day t uses only data up to day t-1.
 */

// ─── Types ──────────────────────────────────────────────────────────────────

export type SdcaPhase =
	| "deep_discount"
	| "value"
	| "fair"
	| "expansion"
	| "euphoria"
	| "neutral"
	| "sell_all"
	| "sell_dca"
	| "buy_all"
	| "buy_dca";

export type SdcaAction =
	| "HOLD"
	| "START_AGGRESSIVE_DCA"
	| "NORMAL_DCA"
	| "REDUCE_POSITION"
	| "SELL_ALL"
	| "BUY_DCA"
	| "BUY_ALL"
	| "SELL_DCA";

export type RegimeConfidence = "HIGH" | "LOW";

export interface SdcaSignal {
	date: string;
	multiplier: number;
	phase: SdcaPhase;
	action: SdcaAction;
	confidence: RegimeConfidence;
	/** Price percentile in rolling window (0-100) */
	pricePercentile: number;
	/** Composite trend: true if 7d avg > 30d avg (positive momentum) */
	trendPositive: boolean;
	price_ma200_ratio?: number;
	ath_drawdown?: number;
}

export interface DailyRecord {
	date: string;
	close: number;
	valuation_composite?: number;
	price_ma200_ratio?: number;
	ath_drawdown?: number;
}

/** Configuration thresholds for SDCA entry/exit rules */
export interface SdcaThresholds {
	/** Buy trigger: composite must reach this value for START_AGGRESSIVE_DCA (default: +0.5, range: 0.0 to +2.0) */
	buy_threshold?: number;
	/** Sell trigger: composite must reach this value for SELL_ALL (default: -1.5, range: -2.0 to 0.0) */
	sell_threshold?: number;
	/** Price percentile below which buys are allowed (default: 30, range: 10-50) */
	price_pct_buy?: number;
	/** Price percentile above which sells trigger (default: 75, range: 50-95) */
	price_pct_sell?: number;
	/** Days of extended undervaluation before reduce (default: 25, range: 10-60) */
	extended_discount_days?: number;
}

/** Default optimized thresholds (Phase B — grid search optimized) */
export const DEFAULT_SDCA_THRESHOLDS: Required<SdcaThresholds> = {
	buy_threshold: 0.5,
	sell_threshold: -1.5,
	price_pct_buy: 30,
	price_pct_sell: 75,
	extended_discount_days: 25,
};

/** Validate threshold parameters */
export function validateThresholds(t: SdcaThresholds): SdcaThresholds {
	const validated: SdcaThresholds = {};
	if (t.buy_threshold !== undefined) {
		validated.buy_threshold = Math.max(0.0, Math.min(2.0, t.buy_threshold));
	}
	if (t.sell_threshold !== undefined) {
		validated.sell_threshold = Math.max(-2.0, Math.min(0.0, t.sell_threshold));
	}
	if (t.price_pct_buy !== undefined) {
		validated.price_pct_buy = Math.max(10, Math.min(50, t.price_pct_buy));
	}
	if (t.price_pct_sell !== undefined) {
		validated.price_pct_sell = Math.max(50, Math.min(95, t.price_pct_sell));
	}
	if (t.extended_discount_days !== undefined) {
		validated.extended_discount_days = Math.max(
			10,
			Math.min(60, t.extended_discount_days),
		);
	}
	return validated;
}

/** Merge user thresholds with defaults */
export function mergeThresholds(
	overrides?: SdcaThresholds,
): Required<SdcaThresholds> {
	if (!overrides) return { ...DEFAULT_SDCA_THRESHOLDS };
	const validated = validateThresholds(overrides);
	return {
		buy_threshold:
			validated.buy_threshold ?? DEFAULT_SDCA_THRESHOLDS.buy_threshold,
		sell_threshold:
			validated.sell_threshold ?? DEFAULT_SDCA_THRESHOLDS.sell_threshold,
		price_pct_buy:
			validated.price_pct_buy ?? DEFAULT_SDCA_THRESHOLDS.price_pct_buy,
		price_pct_sell:
			validated.price_pct_sell ?? DEFAULT_SDCA_THRESHOLDS.price_pct_sell,
		extended_discount_days:
			validated.extended_discount_days ??
			DEFAULT_SDCA_THRESHOLDS.extended_discount_days,
	};
}

// ─── Multiplier Function (Piecewise Linear) ─────────────────────────────────

/**
 * Maps valuation_composite to DCA allocation multiplier.
 *
 * Sign convention: positive composite = undervalued (buy), negative composite = overvalued (sell).
 *
 * OPTIMIZED MULTIPLIER TABLE (Phase B):
 * | Composite Range | Multiplier | Phase        | Action          |
 * |-----------------|------------|--------------|------------------|
 * | ≥ +1.5          | 3.0x       | Deep Discount| Aggressive buy   |
 * | ≥ +1.0          | 2.0x       | Value        | Buy              |
 * | ≥ +0.5          | 1.5x       | Fair-Low     | Moderate buy     |
 * | > -0.5 to < +0.5| 1.0x      | Fair         | Normal DCA       |
 * | ≤ -0.5          | 0.5x       | Rich         | Reduce           |
 * | ≤ -1.0          | 0.0x       | Expensive    | Pause            |
 * | ≤ -0.5          | -5.0x      | Rich         | Reduce           |
 * | ≤ -1.0          | -10.0x     | Expensive    | Pause            |
 * | ≤ -1.5          | -20.0x     | Euphoria     | DCA out (sell)   |
 *
 * Adaptive scaling: In deep discount zone (≥ +1.5), multiplier scales
 * proportionally with composite strength to prevent overconcentration.
 */
export function sdcaMultiplier(composite: number): number {
	// Beli mulai dari +1.5
	if (composite >= 2.0) return 3.0; // Deep Discount → Beli agresif
	if (composite >= 1.5) return 2.0; // Value → Beli moderat

	// Jual ketika melewati <= -1.25
	if (composite <= -1.5) return -20.0; // Bubble Ekstrem → JUAL SANGAT AGRESIF
	if (composite <= -1.25) return -10.0; // Overvalued Kuat → Jual agresif

	// Range -1.25 < composite < 1.5: HOLD
	return 0.0;
}

// ─── Cycle Phase Detection ──────────────────────────────────────────────────

/**
 * Classifies market phase based on composite, price percentile, and trend.
 *
 * OPTIMIZED PHASE THRESHOLDS (Phase B):
 * | Phase         | Composite | Price Percentile | Trend        |
 * |---------------|-----------|------------------|--------------|
 * | Deep Discount | ≥ +1.0    | < 30%            | Positive     |
 * | Value         | ≥ +0.5    | < 40%            | Any          |
 * | Fair          | > -0.5 to < +0.5 | < 60%  | Any          |
 * | Expansion     | ≤ -0.5    | > 60%            | Any          |
 * | Euphoria      | ≤ -1.0    | > 75%            | Negative     |
 */
export function detectPhase(
	composite: number,
	pricePercentile: number,
	trendPositive: boolean,
): SdcaPhase {
	// Positive = undervalued (bottom), negative = overvalued (top)

	// Deep Discount: composite ≥ +1.0 (positive = bottom), price < 30th percentile, positive trend
	if (composite >= 1.0 && pricePercentile < 30 && trendPositive) {
		return "deep_discount";
	}

	// Euphoria: composite ≤ -1.0 (negative = top), price > 75th percentile, negative trend
	if (composite <= -1.0 && pricePercentile > 75 && !trendPositive) {
		return "euphoria";
	}

	// Value: composite ≥ +0.5, price < 40th percentile
	if (composite >= 0.5 && pricePercentile < 40) {
		return "value";
	}

	// Expansion: composite ≤ -0.5, price > 60th percentile
	if (composite <= -0.5 && pricePercentile > 60) {
		return "expansion";
	}

	// Fair: everything in the middle
	return "fair";
}

// ─── Price Percentile Calculation ───────────────────────────────────────────

/**
 * Calculate price percentile within a rolling window.
 * For day t, uses prices from day t-365 to day t-1 (excluding day t) for causal enforcement.
 *
 * @param allPrices - Array of prices indexed chronologically (0 = oldest)
 * @param currentIndex - Index of current day (t-1 data is used for day t signal)
 * @param windowSize - Rolling window size (default 365)
 * @returns Percentile (0-100)
 */
export function pricePercentile(
	allPrices: number[],
	currentIndex: number,
	windowSize: number = 365,
): number {
	// Use data up to currentIndex (exclusive of currentIndex for t-1 enforcement)
	const start = Math.max(0, currentIndex - windowSize);
	const windowPrices = allPrices.slice(start, currentIndex);

	if (windowPrices.length === 0) return 50; // Default to median if no data

	const currentPrice = allPrices[currentIndex];
	const belowCount = windowPrices.filter((p) => p < currentPrice).length;

	return (belowCount / windowPrices.length) * 100;
}

// ─── Composite Trend ────────────────────────────────────────────────────────

/**
 * Calculate composite trend: true if 7-day average > 30-day average (positive momentum).
 *
 * @param composites - Array of composite values indexed chronologically
 * @param currentIndex - Index of current day (t-1 data used for day t signal)
 * @returns true if trend is positive
 */
export function compositeTrend(
	composites: number[],
	currentIndex: number,
): boolean {
	// Use data up to currentIndex (t-1 causal enforcement)
	const validComposites = composites.slice(0, currentIndex);

	if (validComposites.length < 30) return true; // Default to positive if insufficient data

	const recent7 = validComposites.slice(-7);
	const recent30 = validComposites.slice(-30);

	const avg7 = recent7.reduce((a, b) => a + b, 0) / recent7.length;
	const avg30 = recent30.reduce((a, b) => a + b, 0) / recent30.length;

	return avg7 > avg30;
}

// ─── DCA Entry/Exit Rules ───────────────────────────────────────────────────

/**
 * Determine SDCA action based on current state.
 *
 * OPTIMIZED ENTRY/EXIT RULES (Phase B):
 * Entry: composite crosses above buy_threshold (+0.5), price < 30th percentile, trend positive
 * Exit: composite crosses below sell_threshold (-1.5), price > 75th percentile,
 *        or extended overvaluation (composite < -0.5 for > 25 days)
 */
export function determineAction(
	currentComposite: number,
	prevComposite: number,
	pricePercentileVal: number,
	trendPositive: boolean,
	consecutiveDaysBelowNeg05: number,
	thresholds?: SdcaThresholds,
): SdcaAction {
	const t = mergeThresholds(thresholds);
	// Positive composite = undervalued (buy), negative composite = overvalued (sell)

	// Entry: START_AGGRESSIVE_DCA
	// Composite crosses above buy_threshold from below (entering value zone), price < price_pct_buy, trend positive
	if (
		prevComposite <= t.buy_threshold &&
		currentComposite > t.buy_threshold &&
		pricePercentileVal < t.price_pct_buy &&
		trendPositive
	) {
		return "START_AGGRESSIVE_DCA";
	}

	// Aggressive exit: SELL_ALL
	// Composite <= sell_threshold (entering deep bubble/overvaluation)
	if (currentComposite <= t.sell_threshold) {
		return "SELL_ALL";
	}

	// Gradual exit: REDUCE_POSITION
	// Composite crosses below -0.5 from above AND price > price_pct_sell
	if (
		prevComposite >= -0.5 &&
		currentComposite < -0.5 &&
		pricePercentileVal > t.price_pct_sell
	) {
		return "REDUCE_POSITION";
	}

	// Extended overvaluation: REDUCE_POSITION
	// Composite < -0.5 for > extended_discount_days consecutive days
	if (
		currentComposite < -0.5 &&
		consecutiveDaysBelowNeg05 > t.extended_discount_days
	) {
		return "REDUCE_POSITION";
	}

	// Normal DCA when composite is in buy zone (positive)
	if (currentComposite >= t.buy_threshold) {
		return "NORMAL_DCA";
	}

	return "HOLD";
}

// ─── Regime Confidence ──────────────────────────────────────────────────────

/**
 * Compute regime confidence based on composite consistency.
 *
 * - HIGH: composite has been directionally consistent (same sign) for > 180 days
 * - LOW: composite has sign changes in last 90 days, or prolonged overvaluation without price drop
 */
export function regimeConfidence(
	composites: number[],
	prices: number[],
	currentIndex: number,
): RegimeConfidence {
	// Use data up to currentIndex (t-1 causal enforcement)
	const validComposites = composites.slice(0, currentIndex);
	const validPrices = prices.slice(0, currentIndex);

	if (validComposites.length < 90) return "HIGH"; // Default to HIGH if insufficient data

	// Check sign changes in last 90 days
	const last90 = validComposites.slice(-90);
	let signChanges = 0;
	for (let i = 1; i < last90.length; i++) {
		const prevSign = Math.sign(last90[i - 1]);
		const currSign = Math.sign(last90[i]);
		if (prevSign !== currSign && prevSign !== 0 && currSign !== 0) {
			signChanges++;
		}
	}

	if (signChanges > 3) return "LOW"; // More than 3 sign changes in 90 days

	// Negative composite = overvalued (sell zone)
	// Check prolonged overvaluation (composite < -1.0) without significant price drop
	if (validComposites.length >= 180) {
		const last180 = validComposites.slice(-180);
		const allBelowNeg1 = last180.every((c) => c < -1.0);
		if (allBelowNeg1 && validPrices.length >= 2) {
			const priceStart =
				validPrices[validPrices.length - 180] || validPrices[0];
			const priceEnd = validPrices[validPrices.length - 1];
			const priceDrop = (priceStart - priceEnd) / priceStart;
			// If composite < -1.0 for 180 days but price dropped < 20%, regime may be shifting
			if (priceDrop < 0.2) return "LOW";
		}
	}

	return "HIGH";
}

// ─── Full SDCA Signal Computation ───────────────────────────────────────────

/**
 * Compute SDCA signals for entire dataset (vectorized, t-1 causal).
 *
 * @param data - Array of daily records (chronologically sorted)
 * @returns Array of SDCA signals for each day
 */
export function computeSdcaSignals(
	data: DailyRecord[],
	_thresholds?: SdcaThresholds,
): SdcaSignal[] {
	const signals: SdcaSignal[] = [];

	let state = "NEUTRAL";
	let buy_all_fired = false;

	const composites = data.map((d) => d.valuation_composite ?? 0);

	const pricesList: number[] = [];
	const ma200List: number[] = [];
	const ratioList: number[] = [];
	const athList: number[] = [];
	const drawdownList: number[] = [];
	let runningAth = 0.0;

	for (let i = 0; i < data.length; i++) {
		const price = data[i].close;
		if (price > 0) {
			pricesList.push(price);
			const window = pricesList.slice(-200);
			const ma = window.reduce((a, b) => a + b, 0) / window.length;
			const ratio = price / ma;
			ma200List.push(ma);
			ratioList.push(ratio);
			if (price > runningAth) runningAth = price;
			athList.push(runningAth);
			drawdownList.push(((runningAth - price) / runningAth) * 100.0);
		} else {
			ma200List.push(0.0);
			ratioList.push(1.0);
			athList.push(runningAth);
			drawdownList.push(0.0);
		}
	}

	for (let i = 0; i < data.length; i++) {
		const dateStr = data[i].date;
		const ratio = ratioList[i];
		const drawdown = drawdownList[i];

		let isMonday = false;
		try {
			const dt = new Date(dateStr);
			isMonday = dt.getUTCDay() === 1;
		} catch {
			isMonday = false;
		}

		let comp_t1 = 0.0;
		let ratio_t1 = 1.0;
		let drawdown_t1 = 0.0;
		let cross_above_ma200 = false;
		let sma30_t1 = 0.0;

		if (i > 0) {
			comp_t1 = composites[i - 1];
			ratio_t1 = ratioList[i - 1];
			drawdown_t1 = drawdownList[i - 1];
			const smaWindow = pricesList.slice(Math.max(0, i - 30), i);
			sma30_t1 = smaWindow.reduce((a, b) => a + b, 0) / smaWindow.length;
			if (i > 1) {
				const ratio_t2 = ratioList[i - 2];
				cross_above_ma200 = ratio_t2 < 1.0 && ratio_t1 >= 1.0;
			}
		}

		if (comp_t1 < 0.0) {
			buy_all_fired = false;
		}

		// Reset state to NEUTRAL every day to avoid sticky state lock-in
		state = "NEUTRAL";

		// 1. SELL_ALL
		const sell_all_trigger =
			comp_t1 <= -1.5 &&
			ratio_t1 < 2.0 &&
			drawdown_t1 >= 20.0 &&
			data[i - 1].close < sma30_t1;
		const safety_net_trigger = comp_t1 <= -1.0 && ratio_t1 < 1.0;

		if (sell_all_trigger || safety_net_trigger) {
			state = "SELL_ALL";
		} else if (
			comp_t1 <= -1.0 &&
			ratio_t1 < 2.0 &&
			data[i - 1].close < sma30_t1
		) {
			state = "SELL_DCA";
		} else if (comp_t1 >= 1.0 && cross_above_ma200 && !buy_all_fired) {
			state = "BUY_ALL";
		} else if (comp_t1 >= 1.0 && ratio_t1 < 1.0) {
			state = "BUY_DCA";
		} else if (comp_t1 > -0.5 && comp_t1 < 0.5) {
			state = "NEUTRAL";
		}

		let action: SdcaAction = "HOLD";
		let multiplier = 0.0;

		if (state === "SELL_ALL") {
			action = "SELL_ALL";
			multiplier = -1.0;
		} else if (state === "SELL_DCA") {
			if (isMonday) {
				action = "SELL_DCA";
				multiplier = comp_t1 <= -1.5 ? -0.15 : -0.08;
			} else {
				action = "HOLD";
				multiplier = 0.0;
			}
		} else if (state === "BUY_ALL") {
			action = "BUY_ALL";
			multiplier = 999.0;
			buy_all_fired = true;
			state = "NEUTRAL";
		} else if (state === "BUY_DCA") {
			if (isMonday) {
				action = "BUY_DCA";
				multiplier = comp_t1 >= 1.5 ? 3.0 : comp_t1 >= 1.0 ? 2.0 : 1.5;
			} else {
				action = "HOLD";
				multiplier = 0.0;
			}
		} else if (state === "NEUTRAL") {
			if (isMonday && comp_t1 >= 0.5) {
				action = "BUY_DCA";
				multiplier = 1.0;
			} else {
				action = "HOLD";
				multiplier = 0.0;
			}
		}

		signals.push({
			date: dateStr,
			multiplier,
			phase: state.toLowerCase() as SdcaPhase,
			action,
			confidence: "HIGH",
			pricePercentile: ratio * 100.0,
			trendPositive: ratio >= 1.0,
			price_ma200_ratio: ratio,
			ath_drawdown: drawdown,
		});
	}

	return signals;
}

export function computeSdcaSignal(
	data: DailyRecord[],
	dayIndex: number,
	thresholds?: SdcaThresholds,
): SdcaSignal {
	const signals = computeSdcaSignals(data, thresholds);
	if (dayIndex >= 0 && dayIndex < signals.length) {
		return signals[dayIndex];
	}
	return {
		date: data[dayIndex]?.date || "",
		multiplier: 0.0,
		phase: "neutral",
		action: "HOLD",
		confidence: "LOW",
		pricePercentile: 50.0,
		trendPositive: true,
	};
}
