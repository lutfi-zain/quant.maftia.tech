/**
 * SDCA (Strategic Dollar Cost Averaging) Signal Engine
 *
 * Maps valuation_composite ∈ [-2.0, +2.0] to DCA allocation multiplier [-0.5x, +3.0x].
 *
 * CRITICAL SIGN CONVENTION (confirmed from codebase):
 * - Positive composite (+1.0 to +2.0) = Overvalued / Bubble → SELL zone
 * - Negative composite (-1.0 to -2.0) = Undervalued / Deep Discount → BUY zone
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
 * Sign convention: negative composite → high multiplier (buy), positive composite → low multiplier (sell).
 *
 * | Composite Range | Multiplier | Phase        | Action         |
 * |-----------------|------------|--------------|----------------|
 * | ≤ -1.5          | 3.0x       | Deep Discount| Aggressive buy |
 * | ≤ -1.0          | 2.0x       | Value        | Buy            |
 * | ≤ -0.5          | 1.5x       | Fair-Low     | Moderate buy   |
 * | > -0.5 to < +0.5| 1.0x      | Fair         | Normal DCA     |
 * | ≥ +0.5          | 0.5x       | Rich         | Reduce         |
 * | ≥ +1.0          | 0.0x       | Expensive    | Pause          |
 * | ≥ +1.5          | -0.5x      | Euphoria     | DCA out (sell) |
 */
export function sdcaMultiplier(composite: number): number {
	if (composite <= -1.5) return 3.0;
	if (composite <= -1.0) return 2.0;
	if (composite <= -0.5) return 1.5;
	if (composite < 0.5) return 1.0;
	if (composite < 1.0) return 0.5;
	if (composite < 1.5) return 0.0;
	return -0.5;
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
	// Deep Discount: composite ≤ -1.0, price < 25th percentile, positive trend
	if (composite <= -1.0 && pricePercentile < 25 && trendPositive) {
		return "deep_discount";
	}

	// Euphoria: composite ≥ +1.0, price > 80th percentile, negative trend
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
	consecutiveDaysAbove05: number,
): SdcaAction {
	// Entry: START_AGGRESSIVE_DCA
	// Composite crosses below -1.0 from above, price < 25th percentile, trend positive
	if (
		prevComposite > -1.0 &&
		currentComposite <= -1.0 &&
		pricePercentileVal < 25 &&
		trendPositive
	) {
		return "START_AGGRESSIVE_DCA";
	}

	// Aggressive exit: SELL_ALL
	// Composite ≥ +1.0 (entering euphoria)
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
	if (currentComposite > 0.5 && consecutiveDaysAbove05 > 30) {
		return "REDUCE_POSITION";
	}

	// Normal DCA when composite is in buy zone
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

	// Check prolonged euphoria without significant price drop
	if (validComposites.length >= 180) {
		const last180 = validComposites.slice(-180);
		const allAbove1 = last180.every((c) => c > 1.0);
		if (allAbove1 && validPrices.length >= 2) {
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

	// Extract arrays for causal computation (only data before dayIndex)
	const closes = data.map((d) => d.close);
	const composites = data.map((d) => d.valuation_composite ?? 0);

	// t-1 enforcement: use data up to dayIndex - 1 for signal on day dayIndex
	const prevComposite = dayIndex > 0 ? composites[dayIndex - 1] : 0;
	const currentComposite = composites[dayIndex]; // Current composite for multiplier

	// Price percentile using t-1 data
	const pricePct = pricePercentile(closes, dayIndex);

	// Composite trend using t-1 data
	const trend = compositeTrend(composites, dayIndex);

	// Multiplier
	const multiplier = sdcaMultiplier(currentComposite);

	// Phase
	const phase = detectPhase(currentComposite, pricePct, trend);

	// Consecutive days above +0.5
	let consecutiveDays = 0;
	for (let i = dayIndex - 1; i >= 0; i--) {
		if (composites[i] > 0.5) {
			consecutiveDays++;
		} else {
			break;
		}
	}

	// Action
	const action = determineAction(
		currentComposite,
		prevComposite,
		pricePct,
		trend,
		consecutiveDays,
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
