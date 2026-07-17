export interface TradeLogItem {
	id: string;
	entryDate: string;
	entryPrice: number;
	exitDate: string;
	exitPrice: number;
	returnPct: number;
	holdDays: number;
	exitReason: string;
}

export interface BacktestMetrics {
	winRate: number;
	profitFactor: number;
	totalTrades: number;
	sharpeRatio: number;
	maxDrawdown: number;
	totalReturnStrat: number;
	totalReturnMarket: number;
	annReturnStrat: number;
	annVolatilityStrat: number;
	maxDrawdownMarket: number;
	sharpeRatioMarket: number;
	annReturnMarket: number;
	annVolatilityMarket: number;
	source: "reference" | "computed";
}

export interface ChartSeriesPoint {
	time: string;
	value: number;
}

export interface ChartMarkerPoint {
	time: string;
	position: "aboveBar" | "belowBar";
	color: string;
	shape: "arrowUp" | "arrowDown";
	text: string;
}

export interface BacktestResult {
	cumStrat: ChartSeriesPoint[];
	cumMarket: ChartSeriesPoint[];
	trades: TradeLogItem[];
	metrics: BacktestMetrics;
	markers: ChartMarkerPoint[];
}

export interface StudioDailyRecord {
	date: string;
	close: number;
	position: number; // -1, 0, +1
	lttd_regime?: string;
	lttd_prob_sideways?: number;
	valuation_composite?: number;
	ichimoku_chikou?: number | null;
	ichimoku_entropy?: number | null;
	ichimoku_er?: number | null;
	ichimoku_active_pos?: number;
	ichimoku_strat_net_ret?: number;
}

/**
 * Pure TypeScript vectorized client-side backtest engine (`useStudioBacktest`).
 * Enforces strict t-1 causal execution boundary: Active_Pos[i] = pos[i-1].
 * Calculates dynamic compounding curves, trade logs, and metrics instantaneously
 * as the user adjusts date ranges or fee friction (bps).
 */
export function useStudioBacktest(
	data: StudioDailyRecord[],
	startDate: string,
	endDate: string,
	feeBps: number = 10,
	referenceMode: boolean = false,
): BacktestResult {
	let usedReference = false;

	if (!data || data.length === 0) {
		return {
			cumStrat: [],
			cumMarket: [],
			trades: [],
			metrics: {
				winRate: 0,
				profitFactor: 0,
				totalTrades: 0,
				sharpeRatio: 0,
				maxDrawdown: 0,
				totalReturnStrat: 0,
				totalReturnMarket: 0,
				annReturnStrat: 0,
				annVolatilityStrat: 0,
				maxDrawdownMarket: 0,
				sharpeRatioMarket: 0,
				annReturnMarket: 0,
				annVolatilityMarket: 0,
				source: "computed" as const,
			},
			markers: [],
		};
	}

	// Sort data ascending by date
	const sorted = [...data].sort((a, b) => a.date.localeCompare(b.date));

	// Filter by window to ensure we have data inside the requested date range
	const filtered = sorted.filter(
		(r) => r.date >= startDate && r.date <= endDate,
	);

	if (filtered.length === 0) {
		return {
			cumStrat: [],
			cumMarket: [],
			trades: [],
			metrics: {
				winRate: 0,
				profitFactor: 0,
				totalTrades: 0,
				sharpeRatio: 0,
				maxDrawdown: 0,
				totalReturnStrat: 0,
				totalReturnMarket: 0,
				annReturnStrat: 0,
				annVolatilityStrat: 0,
				maxDrawdownMarket: 0,
				sharpeRatioMarket: 0,
				annReturnMarket: 0,
				annVolatilityMarket: 0,
				source: "computed" as const,
			},
			markers: [],
		};
	}

	const cumStrat: ChartSeriesPoint[] = [];
	const cumMarket: ChartSeriesPoint[] = [];
	const markers: ChartMarkerPoint[] = [];
	const trades: TradeLogItem[] = [];

	let stratEquity = 1.0;
	let marketEquity = 1.0;

	const feeRate = (feeBps || 0) / 10000.0;

	// Trade tracking state matching backtest.py in_trade (when activePos === 1)
	let currentPos = 0;
	let entryDate = "";
	let entryPrice = 0;
	let tradeCount = 0;
	let tradeCompoundedReturn = 1.0;

	const dailyReturns: number[] = [];
	const marketReturns: number[] = [];
	let peakStrat = 1.0;
	let maxDd = 0.0;
	let peakMarket = 1.0;
	let maxDdMarket = 0.0;

	for (let i = 0; i < sorted.length; i++) {
		const row = sorted[i];
		const date = row.date;

		if (date < startDate) {
			// Prior to backtest startDate: curves are flat at 1.0
			cumStrat.push({ time: date, value: 1.0 });
			cumMarket.push({ time: date, value: 1.0 });
		} else if (date >= startDate && date <= endDate) {
			// Inside backtest window: compound and calculate returns/metrics/trades
			const prevRow = i > 0 ? sorted[i - 1] : null;

			// Check if we can use reference mode: referenceMode flag is true AND reference fields are non-null
			const useReference =
				referenceMode &&
				typeof row.ichimoku_strat_net_ret === "number" &&
				typeof row.ichimoku_active_pos === "number";

			let activePos: number;
			let prevActivePos: number;
			let marketRet: number;
			let stratRet: number;
			let tc: number;

			if (useReference) {
				usedReference = true;
				// REFERENCE MODE: use authoritative daily returns and active position from Python backend
				activePos = row.ichimoku_active_pos!;
				prevActivePos =
					prevRow && typeof prevRow.ichimoku_active_pos === "number"
						? prevRow.ichimoku_active_pos!
						: 0;
				marketRet =
					prevRow && prevRow.close > 0
						? (row.close - prevRow.close) / prevRow.close
						: 0;
				stratRet = row.ichimoku_strat_net_ret!; // Already includes fees (10 bps from pipeline)
				tc = 0; // Fee already baked into strat_net_ret
			} else {
				// COMPUTED MODE: recompute from position x close (existing logic)
				activePos = prevRow ? prevRow.position || 0 : 0;
				prevActivePos = i > 1 ? sorted[i - 2].position || 0 : 0;
				marketRet =
					prevRow && prevRow.close > 0
						? (row.close - prevRow.close) / prevRow.close
						: 0;
				tc = Math.abs(activePos - prevActivePos) * feeRate;
				stratRet = activePos * marketRet - tc;
			}

			// Track position transitions and trade compounding matching backtest.py
			if (activePos !== currentPos) {
				if (currentPos === 1) {
					// Trade exited (or flipped)
					const exitPrice = row.close;
					const holdDays = Math.max(
						1,
						Math.round(
							(new Date(row.date).getTime() - new Date(entryDate).getTime()) /
								(1000 * 3600 * 24),
						),
					);
					const netRet = tradeCompoundedReturn - 1.0;

					let exitReason = "Signal Exit / Neutral";
					if (
						prevRow &&
						prevRow.lttd_regime === "SIDEWAYS" &&
						(prevRow.lttd_prob_sideways || 0) > 0.6
					) {
						exitReason = "Circuit Breaker: LTTD Sideways";
						// Database convention: negative = overvalued (bubble)
					} else if (prevRow && (prevRow.valuation_composite || 0) <= -1.5) {
						exitReason = "Circuit Breaker: Valuation Bubble";
					} else if (
						prevRow &&
						prevRow.ichimoku_er !== undefined &&
						prevRow.ichimoku_er !== null &&
						prevRow.ichimoku_er < 0.2
					) {
						exitReason = "Gate Exit: Efficiency Ratio (< 0.20)";
					} else if (
						prevRow &&
						prevRow.ichimoku_entropy !== undefined &&
						prevRow.ichimoku_entropy !== null &&
						prevRow.ichimoku_entropy > 2.3
					) {
						exitReason = "Gate Exit: Shannon Entropy (> 2.30)";
					} else if (
						prevRow &&
						prevRow.ichimoku_chikou !== undefined &&
						prevRow.ichimoku_chikou !== null &&
						prevRow.ichimoku_chikou < prevRow.close
					) {
						exitReason = "Chikou Momentum Exit (< Price)";
					}

					tradeCount++;
					trades.push({
						id: `trade-${tradeCount}`,
						entryDate,
						entryPrice,
						exitDate: row.date,
						exitPrice,
						returnPct: netRet * 100,
						holdDays,
						exitReason,
					});

					markers.push({
						time: row.date,
						position: "aboveBar",
						color: "#ef4444",
						shape: "arrowDown",
						text: "SELL (Exit)",
					});
				}

				if (activePos === 1) {
					// Trade entered
					entryDate = row.date;
					entryPrice = row.close;
					tradeCompoundedReturn = 1.0;
					markers.push({
						time: row.date,
						position: "belowBar",
						color: "#22c55e",
						shape: "arrowUp",
						text: "BUY (Long)",
					});
				}

				currentPos = activePos;
			}

			if (activePos === 1) {
				tradeCompoundedReturn *= 1.0 + stratRet;
			}

			stratEquity *= 1.0 + stratRet;
			marketEquity *= 1.0 + marketRet;

			dailyReturns.push(stratRet);
			marketReturns.push(marketRet);

			if (stratEquity > peakStrat) {
				peakStrat = stratEquity;
			}
			const dd = (peakStrat - stratEquity) / peakStrat;
			if (dd > maxDd) {
				maxDd = dd;
			}
			if (marketEquity > peakMarket) {
				peakMarket = marketEquity;
			}
			const ddMarket = (peakMarket - marketEquity) / peakMarket;
			if (ddMarket > maxDdMarket) {
				maxDdMarket = ddMarket;
			}

			cumStrat.push({ time: row.date, value: Number(stratEquity.toFixed(4)) });
			cumMarket.push({
				time: row.date,
				value: Number(marketEquity.toFixed(4)),
			});
		} else {
			// After backtest endDate: curves remain flat at final values
			cumStrat.push({ time: row.date, value: Number(stratEquity.toFixed(4)) });
			cumMarket.push({
				time: row.date,
				value: Number(marketEquity.toFixed(4)),
			});
		}
	}

	// Calculate metrics
	let wins = 0;
	let totalGain = 0;
	let totalLoss = 0;

	for (const t of trades) {
		if (t.returnPct > 0) {
			wins++;
			totalGain += t.returnPct;
		} else {
			totalLoss += Math.abs(t.returnPct);
		}
	}

	const winRate =
		trades.length > 0 ? Number(((wins / trades.length) * 100).toFixed(1)) : 0;
	const profitFactor =
		totalLoss > 0
			? Number((totalGain / totalLoss).toFixed(2))
			: totalGain > 0
				? 99.99
				: 0;

	// Annualized Sharpe Ratio = (Mean Daily Return / Std Dev Daily Return) * sqrt(365.25)
	let sharpeRatio = 0;
	let annReturnStrat = 0;
	let annVolatilityStrat = 0;
	let sharpeRatioMarket = 0;
	let annReturnMarket = 0;
	let annVolatilityMarket = 0;

	if (dailyReturns.length > 1) {
		const annFactor = 365.25;
		const meanRet =
			dailyReturns.reduce((acc, val) => acc + val, 0) / dailyReturns.length;
		const variance =
			dailyReturns.reduce((acc, val) => acc + (val - meanRet) ** 2, 0) /
			(dailyReturns.length - 1);
		const stdDev = Math.sqrt(variance);
		annReturnStrat = meanRet * annFactor * 100;
		annVolatilityStrat = stdDev * Math.sqrt(annFactor) * 100;
		if (stdDev > 0) {
			sharpeRatio = Number(
				((meanRet / stdDev) * Math.sqrt(annFactor)).toFixed(2),
			);
		}

		const meanMkt =
			marketReturns.reduce((acc, val) => acc + val, 0) / marketReturns.length;
		const varMkt =
			marketReturns.reduce((acc, val) => acc + (val - meanMkt) ** 2, 0) /
			(marketReturns.length - 1);
		const stdMkt = Math.sqrt(varMkt);
		annReturnMarket = meanMkt * annFactor * 100;
		annVolatilityMarket = stdMkt * Math.sqrt(annFactor) * 100;
		if (stdMkt > 0) {
			sharpeRatioMarket = Number(
				((meanMkt / stdMkt) * Math.sqrt(annFactor)).toFixed(2),
			);
		}
	}

	return {
		cumStrat,
		cumMarket,
		trades: trades.reverse(), // most recent first for UI table
		metrics: {
			winRate,
			profitFactor,
			totalTrades: trades.length,
			sharpeRatio,
			maxDrawdown: Number((maxDd * 100).toFixed(1)),
			totalReturnStrat: Number(((stratEquity - 1.0) * 100).toFixed(1)),
			totalReturnMarket: Number(((marketEquity - 1.0) * 100).toFixed(1)),
			annReturnStrat: Number(annReturnStrat.toFixed(1)),
			annVolatilityStrat: Number(annVolatilityStrat.toFixed(1)),
			maxDrawdownMarket: Number((maxDdMarket * 100).toFixed(1)),
			sharpeRatioMarket,
			annReturnMarket: Number(annReturnMarket.toFixed(1)),
			annVolatilityMarket: Number(annVolatilityMarket.toFixed(1)),
			source: usedReference ? ("reference" as const) : ("computed" as const),
		},
		markers,
	};
}

// ─── SDCA Backtest Types ───────────────────────────────────────────────────

export interface SdcaBacktestMetrics extends BacktestMetrics {
	/** SDCA Sharpe ratio (fee-adjusted) */
	sharpeRatioSdca: number;
	/** Simple DCA Sharpe ratio */
	sharpeRatioSimpleDca: number;
	/** Buy & Hold Sharpe ratio */
	sharpeRatioBuyHold: number;
	/** Total fees paid in USD */
	totalFeesPaid: number;
	/** Average cost basis */
	avgCostBasis: number;
	/** Total BTC accumulated */
	totalBtcAccumulated: number;
	/** Final portfolio value */
	finalPortfolioValue: number;
}

export interface SdcaBacktestResult {
	cumStrat: ChartSeriesPoint[];
	cumMarket: ChartSeriesPoint[];
	cumSimpleDca: ChartSeriesPoint[];
	trades: TradeLogItem[];
	metrics: SdcaBacktestMetrics;
	markers: ChartMarkerPoint[];
}

export interface SdcaDailyRecord {
	date: string;
	close: number;
	valuation_composite: number;
}

// ─── SDCA Multiplier Function ──────────────────────────────────────────────

/**
 * Maps valuation_composite to DCA allocation multiplier.
 * Correct convention: positive = overvalued (sell), negative = undervalued (buy).
 */
function sdcaMultiplierLocal(composite: number): number {
	if (composite >= 1.5) return -0.5; // Euphoria → Sell
	if (composite >= 1.0) return 0.0; // Expensive → Pause
	if (composite >= 0.5) return 0.5; // Rich → Reduce
	if (composite > -0.5) return 1.0; // Fair → Normal DCA
	if (composite > -1.0) return 1.5; // Fair-Low → Moderate buy
	if (composite > -1.5) return 2.0; // Value → Buy
	return 3.0; // Deep Discount → Aggressive buy
}

// ─── SDCA Backtest Engine ──────────────────────────────────────────────────

/**
 * SDCA-specific backtest with multiplier-based position sizing.
 * Simulates DCA with variable allocation based on valuation composite.
 *
 * @param data - Daily records with close price and valuation_composite
 * @param startDate - Backtest start date
 * @param endDate - Backtest end date
 * @param feeBps - Transaction fee in basis points (default 10)
 * @param baseDcaAmount - Base DCA amount per period in USD (default 100)
 * @param initialCash - Starting cash balance (default 10000)
 */
export function useSdcaBacktest(
	data: SdcaDailyRecord[],
	startDate: string,
	endDate: string,
	feeBps: number = 10,
	baseDcaAmount: number = 100,
	initialCash: number = 10000,
): SdcaBacktestResult {
	if (!data || data.length === 0) {
		return {
			cumStrat: [],
			cumMarket: [],
			cumSimpleDca: [],
			trades: [],
			metrics: {
				winRate: 0,
				profitFactor: 0,
				totalTrades: 0,
				sharpeRatio: 0,
				maxDrawdown: 0,
				totalReturnStrat: 0,
				totalReturnMarket: 0,
				annReturnStrat: 0,
				annVolatilityStrat: 0,
				maxDrawdownMarket: 0,
				sharpeRatioMarket: 0,
				annReturnMarket: 0,
				annVolatilityMarket: 0,
				source: "computed" as const,
				sharpeRatioSdca: 0,
				sharpeRatioSimpleDca: 0,
				sharpeRatioBuyHold: 0,
				totalFeesPaid: 0,
				avgCostBasis: 0,
				totalBtcAccumulated: 0,
				finalPortfolioValue: 0,
			},
			markers: [],
		};
	}

	const sorted = [...data].sort((a, b) => a.date.localeCompare(b.date));
	const feeRate = feeBps / 10000;

	// Portfolio state
	let sdcaCash = initialCash;
	let sdcaBtc = 0;
	let sdcaTotalInvested = 0;
	let sdcaTotalFees = 0;

	// Simple DCA state (1.0x fixed allocation)
	let simpleDcaCash = initialCash;
	let simpleDcaBtc = 0;

	// Buy & Hold state (all-in at start)
	let buyHoldBtc = 0;

	const cumStrat: ChartSeriesPoint[] = [];
	const cumMarket: ChartSeriesPoint[] = [];
	const cumSimpleDca: ChartSeriesPoint[] = [];
	const markers: ChartMarkerPoint[] = [];
	const trades: TradeLogItem[] = [];

	let stratEquity = 1.0;
	let marketEquity = 1.0;
	let simpleDcaEquity = 1.0;
	let buyHoldEquity = 1.0;

	let peakStrat = 1.0;
	let maxDd = 0;
	let peakMarket = 1.0;
	let maxDdMarket = 0;

	const dailyReturns: number[] = [];

	// Buy & Hold: invest all at start
	const firstPrice = sorted[0]?.close || 1;
	buyHoldBtc = initialCash / firstPrice;

	for (let i = 0; i < sorted.length; i++) {
		const row = sorted[i];
		const date = row.date;

		if (date < startDate) {
			cumStrat.push({ time: date, value: 1.0 });
			cumMarket.push({ time: date, value: 1.0 });
			cumSimpleDca.push({ time: date, value: 1.0 });
			continue;
		}

		if (date > endDate) break;

		const prevRow = i > 0 ? sorted[i - 1] : null;
		const prevPrice = prevRow?.close || row.close;
		const marketRet = prevRow ? (row.close - prevPrice) / prevPrice : 0;

		// SDCA: use t-1 composite for day t signal (causal)
		const prevComposite = prevRow?.valuation_composite ?? 0;
		const sdcaMultiplier = sdcaMultiplierLocal(prevComposite);

		// Execute SDCA DCA
		if (sdcaMultiplier > 0 && sdcaCash > 0) {
			const buyAmount = Math.min(baseDcaAmount * sdcaMultiplier, sdcaCash);
			const fee = buyAmount * feeRate;
			const netSpend = buyAmount + fee;
			if (netSpend <= sdcaCash) {
				sdcaCash -= netSpend;
				sdcaBtc += buyAmount / row.close;
				sdcaTotalInvested += buyAmount;
				sdcaTotalFees += fee;

				markers.push({
					time: date,
					position: "belowBar",
					color: "#22c55e",
					shape: "arrowUp",
					text: `BUY $${buyAmount.toFixed(0)} (${sdcaMultiplier.toFixed(1)}x)`,
				});
			}
		} else if (sdcaMultiplier < 0 && sdcaBtc > 0) {
			// Sell: USD-amount based
			const sellValueUsd = baseDcaAmount * Math.abs(sdcaMultiplier);
			const btcToSell = Math.min(sellValueUsd / row.close, sdcaBtc);
			const proceeds = btcToSell * row.close;
			const fee = proceeds * feeRate;

			sdcaBtc -= btcToSell;
			sdcaCash += proceeds - fee;
			sdcaTotalFees += fee;

			markers.push({
				time: date,
				position: "aboveBar",
				color: "#ef4444",
				shape: "arrowDown",
				text: `SELL $${proceeds.toFixed(0)} (${sdcaMultiplier.toFixed(1)}x)`,
			});

			trades.push({
				id: `trade-${trades.length + 1}`,
				entryDate: date,
				entryPrice: row.close,
				exitDate: date,
				exitPrice: row.close,
				returnPct: 0,
				holdDays: 0,
				exitReason: `SDCA SELL (${sdcaMultiplier.toFixed(1)}x)`,
			});
		}

		// Simple DCA: fixed 1.0x allocation
		if (simpleDcaCash >= baseDcaAmount) {
			const fee = baseDcaAmount * feeRate;
			simpleDcaCash -= baseDcaAmount + fee;
			simpleDcaBtc += baseDcaAmount / row.close;
		}

		// Calculate equity curves
		const sdcaPortfolioValue = sdcaBtc * row.close + sdcaCash;
		const simpleDcaValue = simpleDcaBtc * row.close + simpleDcaCash;
		const buyHoldValue = buyHoldBtc * row.close;

		stratEquity = sdcaPortfolioValue / initialCash;
		simpleDcaEquity = simpleDcaValue / initialCash;
		buyHoldEquity = buyHoldValue / initialCash;
		marketEquity = row.close / firstPrice;

		// Track drawdown
		if (stratEquity > peakStrat) peakStrat = stratEquity;
		const dd = (peakStrat - stratEquity) / peakStrat;
		if (dd > maxDd) maxDd = dd;

		if (marketEquity > peakMarket) peakMarket = marketEquity;
		const ddMarket = (peakMarket - marketEquity) / peakMarket;
		if (ddMarket > maxDdMarket) maxDdMarket = ddMarket;

		dailyReturns.push(marketRet);

		cumStrat.push({ time: date, value: Number(stratEquity.toFixed(4)) });
		cumMarket.push({ time: date, value: Number(marketEquity.toFixed(4)) });
		cumSimpleDca.push({
			time: date,
			value: Number(simpleDcaEquity.toFixed(4)),
		});
	}

	// Calculate metrics
	let wins = 0;
	let totalGain = 0;
	let totalLoss = 0;
	for (const t of trades) {
		if (t.returnPct > 0) {
			wins++;
			totalGain += t.returnPct;
		} else {
			totalLoss += Math.abs(t.returnPct);
		}
	}

	const winRate =
		trades.length > 0 ? Number(((wins / trades.length) * 100).toFixed(1)) : 0;
	const profitFactor =
		totalLoss > 0
			? Number((totalGain / totalLoss).toFixed(2))
			: totalGain > 0
				? 99.99
				: 0;

	// Sharpe ratios
	const annFactor = 365.25;
	let sharpeRatio = 0;
	let sharpeRatioMarket = 0;
	let annReturnStrat = 0;
	let annVolatilityStrat = 0;
	let annReturnMarket = 0;
	let annVolatilityMarket = 0;

	if (dailyReturns.length > 1) {
		const meanRet =
			dailyReturns.reduce((a, b) => a + b, 0) / dailyReturns.length;
		const variance =
			dailyReturns.reduce((a, b) => a + (b - meanRet) ** 2, 0) /
			(dailyReturns.length - 1);
		const stdDev = Math.sqrt(variance);
		annReturnMarket = meanRet * annFactor * 100;
		annVolatilityMarket = stdDev * Math.sqrt(annFactor) * 100;
		if (stdDev > 0)
			sharpeRatioMarket = Number(
				((meanRet / stdDev) * Math.sqrt(annFactor)).toFixed(2),
			);

		// SDCA returns (approximated from equity curve)
		const sdcaReturns: number[] = [];
		for (let i = 1; i < cumStrat.length; i++) {
			if (cumStrat[i - 1].value > 0) {
				sdcaReturns.push(
					(cumStrat[i].value - cumStrat[i - 1].value) / cumStrat[i - 1].value,
				);
			}
		}
		if (sdcaReturns.length > 1) {
			const sdcaMean =
				sdcaReturns.reduce((a, b) => a + b, 0) / sdcaReturns.length;
			const sdcaVar =
				sdcaReturns.reduce((a, b) => a + (b - sdcaMean) ** 2, 0) /
				(sdcaReturns.length - 1);
			const sdcaStd = Math.sqrt(sdcaVar);
			annReturnStrat = sdcaMean * annFactor * 100;
			annVolatilityStrat = sdcaStd * Math.sqrt(annFactor) * 100;
			if (sdcaStd > 0)
				sharpeRatio = Number(
					((sdcaMean / sdcaStd) * Math.sqrt(annFactor)).toFixed(2),
				);
		}
	}

	// Final portfolio value
	const finalSdcaValue =
		sdcaBtc * (sorted[sorted.length - 1]?.close || 0) + sdcaCash;
	const avgCostBasis = sdcaTotalInvested > 0 ? sdcaTotalInvested / sdcaBtc : 0;

	return {
		cumStrat,
		cumMarket,
		cumSimpleDca,
		trades: trades.reverse(),
		metrics: {
			winRate,
			profitFactor,
			totalTrades: trades.length,
			sharpeRatio,
			maxDrawdown: Number((maxDd * 100).toFixed(1)),
			totalReturnStrat: Number(((stratEquity - 1.0) * 100).toFixed(1)),
			totalReturnMarket: Number(((marketEquity - 1.0) * 100).toFixed(1)),
			annReturnStrat: Number(annReturnStrat.toFixed(1)),
			annVolatilityStrat: Number(annVolatilityStrat.toFixed(1)),
			maxDrawdownMarket: Number((maxDdMarket * 100).toFixed(1)),
			sharpeRatioMarket,
			annReturnMarket: Number(annReturnMarket.toFixed(1)),
			annVolatilityMarket: Number(annVolatilityMarket.toFixed(1)),
			source: "computed" as const,
			sharpeRatioSdca: sharpeRatio,
			sharpeRatioSimpleDca: 0, // Computed separately if needed
			sharpeRatioBuyHold: 0, // Computed separately if needed
			totalFeesPaid: sdcaTotalFees,
			avgCostBasis: Number(avgCostBasis.toFixed(2)),
			totalBtcAccumulated: Number(sdcaBtc.toFixed(8)),
			finalPortfolioValue: Number(finalSdcaValue.toFixed(2)),
		},
		markers,
	};
}
