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
): BacktestResult {
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
			},
			markers: [],
		};
	}

	// Sort data ascending by date
	const sorted = [...data].sort((a, b) => a.date.localeCompare(b.date));

	// Filter by window
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

	// Build map from date to index in sorted for exact O(1) causal lookup
	const dateToIndex = new Map<string, number>();
	sorted.forEach((r, idx) => dateToIndex.set(r.date, idx));

	for (let i = 0; i < filtered.length; i++) {
		const row = filtered[i];
		const sortedIdx = dateToIndex.get(row.date) ?? 0;
		const prevRow = sortedIdx > 0 ? sorted[sortedIdx - 1] : null;

		// Causal t-1 execution: Active_Pos[t] = Pos[t-1]
		const activePos = prevRow ? prevRow.position || 0 : 0;
		const prevActivePos =
			sortedIdx > 1 ? sorted[sortedIdx - 2].position || 0 : 0;

		// Calculate daily market return: Market_Ret[t] = (Close[t] - Close[t-1]) / Close[t-1]
		const marketRet =
			prevRow && prevRow.close > 0
				? (row.close - prevRow.close) / prevRow.close
				: 0;

		// Transaction cost when Active_Pos changes: TC = abs(Active_Pos[t] - Active_Pos[t-1]) * transaction_cost
		const tc = Math.abs(activePos - prevActivePos) * feeRate;

		// Strategy Net Return: Strat_Net_Ret = Active_Pos * Market_Ret - TC
		const stratRet = activePos * marketRet - tc;

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
				} else if (prevRow && (prevRow.valuation_composite || 0) >= 1.5) {
					exitReason = "Circuit Breaker: Valuation Bubble";
				} else if (
					prevRow &&
					prevRow.ichimoku_er !== undefined &&
					prevRow.ichimoku_er !== null &&
					prevRow.ichimoku_er < 0.20
				) {
					exitReason = "Gate Exit: Efficiency Ratio (< 0.20)";
				} else if (
					prevRow &&
					prevRow.ichimoku_entropy !== undefined &&
					prevRow.ichimoku_entropy !== null &&
					prevRow.ichimoku_entropy > 2.30
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
		cumMarket.push({ time: row.date, value: Number(marketEquity.toFixed(4)) });
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
			sharpeRatio = Number(((meanRet / stdDev) * Math.sqrt(annFactor)).toFixed(2));
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
			sharpeRatioMarket = Number(((meanMkt / stdMkt) * Math.sqrt(annFactor)).toFixed(2));
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
		},
		markers,
	};
}
