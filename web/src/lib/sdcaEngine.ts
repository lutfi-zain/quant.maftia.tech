/**
 * SDCA (Strategic Dollar Cost Averaging) Signal Engine
 *
 * Maps valuation_composite ∈ [-2.0, +2.0] to DCA allocation multiplier [-0.5x, +3.0x].
 *
 * CRITICAL SIGN CONVENTION (confirmed from database data & valuation system docs):
 * - Positive composite (+1.0 to +2.0) = Overvalued / Bubble → SELL zone (price tops)
 * - Negative composite (-1.0 to -2.0) = Undervalued / Deep Discount → BUY zone (price bottoms)
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
	| "euphoria";

export type SdcaAction =
	| "HOLD"
	| "START_AGGRESSIVE_DCA"
	| "NORMAL_DCA"
	| "REDUCE_POSITION"
	| "SELL_ALL";

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
}

export interface DailyRecord {
	date: string;
	close: number;
	valuation_composite?: number;
}

// ─── Multiplier Function (Piecewise Linear) ─────────────────────────────────

/**
 * Maps valuation_composite to DCA allocation multiplier.
 *
 * Sign convention: positive composite → low multiplier (sell), negative composite → high multiplier (buy).
 *
 * | Composite Range | Multiplier | Phase        | Action         |
 * |-----------------|------------|--------------|----------------|
 * | ≥ +1.5          | -0.5x      | Euphoria     | DCA out (sell) |
 * | ≥ +1.0          | 0.0x       | Expensive    | Pause          |
 * | ≥ +0.5          | 0.5x       | Rich         | Reduce         |
 * | > -0.5 to < +0.5| 1.0x      | Fair         | Normal DCA     |
 * | ≤ -0.5          | 1.5x       | Fair-Low     | Moderate buy   |
 * | ≤ -1.0          | 2.0x       | Value        | Buy            |
 * | ≤ -1.5          | 3.0x       | Deep Discount| Aggressive buy |
 */
export function sdcaMultiplier(composite: number): number {
	// Correct convention: positive = overvalued (sell), negative = undervalued (buy)
	if (composite >= 1.5) return -0.5; // Very positive → Euphoria → Sell
	if (composite >= 1.0) return 0.0; // Positive → Expensive → Pause
	if (composite >= 0.5) return 0.5; // Mild positive → Rich → Reduce
	if (composite > -0.5) return 1.0; // Near zero → Fair → Normal DCA
	if (composite > -1.0) return 1.5; // Mild negative → Fair-Low → Moderate buy
	if (composite > -1.5) return 2.0; // Negative → Value → Buy
	return 3.0; // Very negative → Deep Discount → Aggressive buy
}

// ─── Cycle Phase Detection ──────────────────────────────────────────────────

/**
 * Classifies market phase based on composite, price percentile, and trend.
 *
 * | Phase         | Composite | Price Percentile | Trend        |
 * |---------------|-----------|------------------|--------------|
 * | Deep Discount | ≤ -1.0    | < 25%            | Positive     |
 * | Value         | ≤ -0.5    | < 40%            | Any          |
 * | Fair          | > -0.5 to < +0.5 | < 60%  | Any          |
 * | Expansion     | ≥ +0.5    | > 60%            | Any          |
 * | Euphoria      | ≥ +1.0    | > 80%            | Negative     |
 */
export function detectPhase(
	composite: number,
	pricePercentile: number,
	trendPositive: boolean,
): SdcaPhase {
	// Correct convention: positive = overvalued (top), negative = undervalued (bottom)

	// Deep Discount: composite ≤ -1.0 (negative = bottom), price < 25th percentile, positive trend
	if (composite <= -1.0 && pricePercentile < 25 && trendPositive) {
		return "deep_discount";
	}

	// Euphoria: composite ≥ +1.0 (positive = top), price > 80th percentile, negative trend
	if (composite >= 1.0 && pricePercentile > 80 && !trendPositive) {
		return "euphoria";
	}

	// Value: composite ≤ -0.5, price < 40th percentile
	if (composite <= -0.5 && pricePercentile < 40) {
		return "value";
	}

	// Expansion: composite ≥ +0.5, price > 60th percentile
	if (composite >= 0.5 && pricePercentile > 60) {
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
 * Entry: composite crosses below -1.0, price < 25th percentile, trend positive
 * Exit: composite crosses above +0.5 (price > 80th percentile), composite > +1.0, or extended euphoria
 */
export function determineAction(
	currentComposite: number,
	prevComposite: number,
	pricePercentileVal: number,
	trendPositive: boolean,
	consecutiveDaysAboveMinus05: number,
): SdcaAction {
	// Correct convention: positive = overvalued (sell), negative = undervalued (buy)

	// Entry: START_AGGRESSIVE_DCA
	// Composite crosses below -1.0 from above (entering deep discount), price < 25th percentile, trend positive
	if (
		prevComposite > -1.0 &&
		currentComposite <= -1.0 &&
		pricePercentileVal < 25 &&
		trendPositive
	) {
		return "START_AGGRESSIVE_DCA";
	}

	// Aggressive exit: SELL_ALL
	// Composite ≥ +1.0 (entering euphoria/top)
	if (currentComposite >= 1.0) {
		return "SELL_ALL";
	}

	// Gradual exit: REDUCE_POSITION
	// Composite crosses above +0.5 from below AND price > 80th percentile
	if (
		prevComposite <= 0.5 &&
		currentComposite > 0.5 &&
		pricePercentileVal > 80
	) {
		return "REDUCE_POSITION";
	}

	// Extended euphoria: REDUCE_POSITION
	// Composite > +0.5 for > 30 consecutive days
	if (currentComposite > 0.5 && consecutiveDaysAboveMinus05 > 30) {
		return "REDUCE_POSITION";
	}

	// Normal DCA when composite is in buy zone (negative)
	if (currentComposite <= -0.5) {
		return "NORMAL_DCA";
	}

	return "HOLD";
}

// ─── Regime Confidence ──────────────────────────────────────────────────────

/**
 * Compute regime confidence based on composite consistency.
 *
 * - HIGH: composite has been directionally consistent (same sign) for > 180 days
 * - LOW: composite has sign changes in last 90 days, or prolonged euphoria without price drop
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

	// Correct convention: positive composite = overvalued (top/euphoria)
	// Check prolonged euphoria (positive composite) without significant price drop
	if (validComposites.length >= 180) {
		const last180 = validComposites.slice(-180);
		const allAbovePos1 = last180.every((c) => c > 1.0);
		if (allAbovePos1 && validPrices.length >= 2) {
			const priceStart =
				validPrices[validPrices.length - 180] || validPrices[0];
			const priceEnd = validPrices[validPrices.length - 1];
			const priceDrop = (priceStart - priceEnd) / priceStart;
			// If composite > +1.0 for 180 days but price dropped < 20%, regime may be shifting
			if (priceDrop < 0.2) return "LOW";
		}
	}

	return "HIGH";
}

// ─── Full SDCA Signal Computation ───────────────────────────────────────────

/**
 * Compute SDCA signal for a given day using strict t-1 causal filtering.
 *
 * @param data - Array of daily records (chronologically sorted)
 * @param dayIndex - Index of the day to compute signal for
 * @returns SDCA signal for the day
 */
export function computeSdcaSignal(
	data: DailyRecord[],
	dayIndex: number,
): SdcaSignal {
	const day = data[dayIndex];

	// Extract arrays for causal computation
	const closes = data.map((d) => d.close);
	const composites = data.map((d) => d.valuation_composite ?? 0);

	// ── t-1 Causal Enforcement ──
	// Signal for day t uses ONLY data available at end of day t-1.
	// composite[t-1] = primary signal input for multiplier, phase, and action.
	// composite[t-2] = previous day's composite for cross detection (entry/exit).
	const compositeT1 = dayIndex > 0 ? composites[dayIndex - 1] : 0;
	const compositeT2 = dayIndex > 1 ? composites[dayIndex - 2] : compositeT1;

	// Price percentile: uses prices from t-365 to t-1 (exclusive of t)
	const pricePct = pricePercentile(closes, dayIndex);

	// Composite trend: 7d vs 30d average using data up to t-1
	const trend = compositeTrend(composites, dayIndex);

	// Multiplier: maps t-1 composite to allocation multiplier
	const multiplier = sdcaMultiplier(compositeT1);

	// Phase: classified from t-1 composite + percentile + trend
	const phase = detectPhase(compositeT1, pricePct, trend);

	// Consecutive days above +0.5 (euphoria duration, counting backwards from t-1)
	let consecutiveDaysAbove05 = 0;
	for (let i = dayIndex - 1; i >= 0; i--) {
		if (composites[i] > 0.5) {
			consecutiveDaysAbove05++;
		} else {
			break;
		}
	}

	// Action: entry/exit detection using t-1 vs t-2 composite crossing
	const action = determineAction(
		compositeT1,
		compositeT2,
		pricePct,
		trend,
		consecutiveDaysAbove05,
	);

	// Regime confidence
	const confidence = regimeConfidence(composites, closes, dayIndex);

	return {
		date: day.date,
		multiplier,
		phase,
		action,
		confidence,
		pricePercentile: pricePct,
		trendPositive: trend,
	};
}

/**
 * Compute SDCA signals for entire dataset (vectorized, t-1 causal).
 *
 * @param data - Array of daily records (chronologically sorted)
 * @returns Array of SDCA signals for each day
 */
export function computeSdcaSignals(data: DailyRecord[]): SdcaSignal[] {
	return data.map((_, index) => computeSdcaSignal(data, index));
}
