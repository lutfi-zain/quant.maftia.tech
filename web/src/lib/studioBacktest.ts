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

	const initialPrice = filtered[0].close || 1.0;
	const feeRate = (feeBps || 0) / 10000.0;

	// Trade tracking state
	let currentPos = 0; // 0, 1, -1
	let entryDate = "";
	let entryPrice = 0;
	let tradeCount = 0;

	const dailyReturns: number[] = [];
	let peakStrat = 1.0;
	let maxDd = 0.0;

	for (let i = 0; i < filtered.length; i++) {
		const row = filtered[i];
		const prevRow = i > 0 ? filtered[i - 1] : null;

		// Causal t-1 execution: active position during day i is the position signal from day i-1
		const activePos = prevRow ? prevRow.position || 0 : 0;

		// Check position transition at the open/start of day i (or end of day i-1)
		if (activePos !== currentPos) {
			// If closing or flipping an existing position
			if (currentPos !== 0 && prevRow) {
				const exitPrice = row.close;
				const holdDays =
					(new Date(row.date).getTime() - new Date(entryDate).getTime()) /
					(1000 * 3600 * 24);
				const rawRet =
					currentPos === 1
						? (exitPrice - entryPrice) / entryPrice
						: (entryPrice - exitPrice) / entryPrice;
				const netRet = rawRet - feeRate; // round-trip fee deducted on trade completion

				// Determine exact causal exit reason
				let exitReason = "Signal Exit / Neutral";
				if (
					prevRow.lttd_regime === "SIDEWAYS" &&
					(prevRow.lttd_prob_sideways || 0) > 0.6
				) {
					exitReason = "Circuit Breaker: LTTD Sideways";
				} else if ((prevRow.valuation_composite || 0) >= 1.5) {
					exitReason = "Circuit Breaker: Valuation Bubble";
				} else if (
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
					holdDays: Math.max(1, Math.round(holdDays)),
					exitReason,
				});

				markers.push({
					time: row.date,
					position: currentPos === 1 ? "aboveBar" : "belowBar",
					color: currentPos === 1 ? "#ef4444" : "#22c55e",
					shape: currentPos === 1 ? "arrowDown" : "arrowUp",
					text: currentPos === 1 ? "SELL (Exit)" : "BUY (Cover)",
				});
			}

			// If opening a new position
			if (activePos !== 0) {
				entryDate = row.date;
				entryPrice = row.close;
				markers.push({
					time: row.date,
					position: activePos === 1 ? "belowBar" : "aboveBar",
					color: activePos === 1 ? "#22c55e" : "#ef4444",
					shape: activePos === 1 ? "arrowUp" : "arrowDown",
					text: activePos === 1 ? "BUY (Long)" : "SELL (Short)",
				});
			}

			currentPos = activePos;
		}

		// Calculate daily market return
		const marketRet =
			prevRow && prevRow.close > 0
				? (row.close - prevRow.close) / prevRow.close
				: 0;

		// Calculate daily strategy return based on causal active position
		let stratRet = activePos * marketRet;

		// Apply transaction fee friction if position changed on this bar
		if (activePos !== (prevRow ? prevRow.position || 0 : 0)) {
			stratRet -= feeRate / 2.0;
		}

		stratEquity *= 1 + stratRet;
		marketEquity = row.close / initialPrice;

		dailyReturns.push(stratRet);

		if (stratEquity > peakStrat) {
			peakStrat = stratEquity;
		}
		const dd = (peakStrat - stratEquity) / peakStrat;
		if (dd > maxDd) {
			maxDd = dd;
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

	// Annualized Sharpe Ratio = (Mean Daily Return / Std Dev Daily Return) * sqrt(365)
	let sharpeRatio = 0;
	if (dailyReturns.length > 1) {
		const meanRet =
			dailyReturns.reduce((acc, val) => acc + val, 0) / dailyReturns.length;
		const variance =
			dailyReturns.reduce((acc, val) => acc + Math.pow(val - meanRet, 2), 0) /
			(dailyReturns.length - 1);
		const stdDev = Math.sqrt(variance);
		if (stdDev > 0) {
			sharpeRatio = Number(((meanRet / stdDev) * Math.sqrt(365)).toFixed(2));
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
		},
		markers,
	};
}
