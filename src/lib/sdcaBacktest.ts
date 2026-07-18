/**
 * SDCA Backtest Engine — Server-Side Computation
 *
 * Reproduces useSdcaBacktest() logic using master_ohlcv.close as canonical price source.
 * Used by POST /api/v1/sdca/backtest endpoint for auditability.
 */

import {
	computeSdcaSignals,
	mergeThresholds,
	type DailyRecord,
	type SdcaSignal,
	type SdcaThresholds,
} from "./sdcaEngine.js";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface SdcaBacktestConfig {
	start_date: string;
	end_date: string;
	fee_bps?: number;
	base_dca_amount?: number;
	initial_cash?: number;
	/** Threshold overrides for buy/sell rules */
	thresholds?: SdcaThresholds;
	/** Preset name (conservative, moderate, aggressive) */
	preset?: string;
}

export interface SdcaBacktestMetrics {
	sharpeRatio: number;
	totalReturn: number;
	maxDrawdown: number;
	annualizedReturn: number;
	annualizedVolatility: number;
	winRate: number;
	profitFactor: number;
	totalTrades: number;
	sortinoRatio: number;
	cagr: number;
}

export interface EquityPoint {
	date: string;
	sdca: number;
	simpleDca: number;
	buyHold: number;
}

export interface TradeLogEntry {
	id: number;
	date: string;
	action: string;
	amount_usd: number;
	btc_price: number;
	multiplier: number;
	phase: string;
	/** Profit percentage for SELL actions */
	profit_pct?: number;
}

export interface SdcaBacktestResult {
	metrics: SdcaBacktestMetrics;
	equity_curve: EquityPoint[];
	trade_log: TradeLogEntry[];
	signals: SdcaSignal[];
	config: SdcaBacktestConfig;
	/** Resolved thresholds used for this backtest */
	thresholds: Required<SdcaThresholds>;
}

// ─── Backtest Computation ───────────────────────────────────────────────────

/**
 * Run SDCA backtest over daily data.
 *
 * @param data - Array of DailyRecord (chronologically sorted, using master_ohlcv.close)
 * @param config - Backtest configuration
 * @returns Full backtest result with metrics, equity curve, trade log, and signals
 */
export function computeSdcaBacktest(
	data: DailyRecord[],
	config: SdcaBacktestConfig,
): SdcaBacktestResult {
	const feeBps = config.fee_bps ?? 10;
	const baseDcaAmount = config.base_dca_amount ?? 100;
	const initialCash = config.initial_cash ?? 10000;
	const feeRate = feeBps / 10000;

	// Resolve thresholds: merge user overrides with defaults
	const thresholds = mergeThresholds(config.thresholds);

	// Compute all signals with resolved thresholds
	const signals = computeSdcaSignals(data, thresholds);

	// State tracking
	let sdcaBtc = 0;
	let sdcaCash = initialCash;
	let sdcaTotalInvested = 0;
	let simpleDcaCash = initialCash;
	let simpleDcaBtc = 0;
	const buyHoldStartPrice = data.length > 0 ? data[0].close : 1;
	const buyHoldBtc = initialCash / buyHoldStartPrice;

	// Metrics tracking
	let peakSdca = initialCash;
	let maxDrawdown = 0;
	let totalFees = 0;
	let wins = 0;
	let totalTrades = 0;
	let grossProfit = 0;
	let grossLoss = 0;

	const equityCurve: EquityPoint[] = [];
	const tradeLog: TradeLogEntry[] = [];
	let tradeId = 0;

	for (let i = 0; i < data.length; i++) {
		const day = data[i];
		const signal = signals[i];
		const price = day.close;

		if (price <= 0) continue;

		// SDCA execution: apply multiplier-based DCA
		const multiplier = signal.multiplier;
		const sdcaAmount = baseDcaAmount * multiplier;

		if (sdcaAmount > 0) {
			// Buy
			const fee = sdcaAmount * feeRate;
			const netAmount = sdcaAmount - fee;
			const btcBought = netAmount / price;
			sdcaBtc += btcBought;
			sdcaCash -= sdcaAmount;
			sdcaTotalInvested += sdcaAmount;
			totalFees += fee;

			tradeId++;
			tradeLog.push({
				id: tradeId,
				date: day.date,
				action: "BUY",
				amount_usd: sdcaAmount,
				btc_price: price,
				multiplier,
				phase: signal.phase,
			});
			totalTrades++;
		} else if (sdcaAmount < 0) {
			// Sell (negative multiplier = DCA out)
			const sellAmount = Math.abs(sdcaAmount);
			const btcToSell = Math.min(sellAmount / price, sdcaBtc);
			if (btcToSell > 0) {
				const proceeds = btcToSell * price;
				const fee = proceeds * feeRate;
				sdcaBtc -= btcToSell;
				sdcaCash += proceeds - fee;
				totalFees += fee;

				const returnPct =
					sdcaTotalInvested > 0
						? ((proceeds - fee - sellAmount) / sellAmount) * 100
						: 0;
				if (returnPct > 0) {
					wins++;
					grossProfit += returnPct;
				} else {
					grossLoss += Math.abs(returnPct);
				}

				tradeId++;
				tradeLog.push({
					id: tradeId,
					date: day.date,
					action: "SELL",
					amount_usd: proceeds,
					btc_price: price,
					multiplier,
					phase: signal.phase,
					profit_pct: Math.round(returnPct * 100) / 100,
				});
				totalTrades++;
			}
		}

		// Simple DCA: fixed $100 every day regardless of signal
		const simpleFee = baseDcaAmount * feeRate;
		const simpleNet = baseDcaAmount - simpleFee;
		simpleDcaBtc += simpleNet / price;
		simpleDcaCash -= baseDcaAmount;

		// Compute equity values
		const sdcaEquity = sdcaCash + sdcaBtc * price;
		const simpleDcaEquity = simpleDcaCash + simpleDcaBtc * price;
		const buyHoldEquity = buyHoldBtc * price;

		equityCurve.push({
			date: day.date,
			sdca: sdcaEquity,
			simpleDca: simpleDcaEquity,
			buyHold: buyHoldEquity,
		});

		// Max drawdown tracking
		if (sdcaEquity > peakSdca) peakSdca = sdcaEquity;
		const dd = (peakSdca - sdcaEquity) / peakSdca;
		if (dd > maxDrawdown) maxDrawdown = dd;
	}

	// Compute final metrics
	const n = data.length;
	const years = n / 365.25;
	const finalSdcaEquity =
		equityCurve.length > 0
			? equityCurve[equityCurve.length - 1].sdca
			: initialCash;

	const totalReturn = ((finalSdcaEquity - initialCash) / initialCash) * 100;
	const cagr =
		years > 0 && finalSdcaEquity > 0
			? ((finalSdcaEquity / initialCash) ** (1 / years) - 1) * 100
			: 0;

	// Daily returns for volatility/sharpe
	const dailyReturns: number[] = [];
	for (let i = 1; i < equityCurve.length; i++) {
		const prev = equityCurve[i - 1].sdca;
		const curr = equityCurve[i].sdca;
		if (prev > 0) dailyReturns.push((curr - prev) / prev);
	}

	const meanReturn =
		dailyReturns.length > 0
			? dailyReturns.reduce((a, b) => a + b, 0) / dailyReturns.length
			: 0;
	const variance =
		dailyReturns.length > 0
			? dailyReturns.reduce((a, b) => a + (b - meanReturn) ** 2, 0) /
				dailyReturns.length
			: 0;
	const annualizedVolatility = Math.sqrt(variance) * Math.sqrt(365) * 100;
	const annualizedReturn = meanReturn * 365 * 100;
	const sharpeRatio =
		annualizedVolatility > 0 ? annualizedReturn / annualizedVolatility : 0;

	// Sortino ratio
	const negativeReturns = dailyReturns.filter((r) => r < 0);
	const downsideVariance =
		negativeReturns.length > 0
			? negativeReturns.reduce((a, b) => a + b ** 2, 0) / dailyReturns.length
			: 0;
	const sortinoRatio =
		Math.sqrt(downsideVariance) > 0
			? (meanReturn * 365) / (Math.sqrt(downsideVariance) * Math.sqrt(365))
			: 0;

	const profitFactor =
		grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? 999 : 0;
	const winRate = totalTrades > 0 ? (wins / totalTrades) * 100 : 0;

	return {
		metrics: {
			sharpeRatio: Math.round(sharpeRatio * 100) / 100,
			totalReturn: Math.round(totalReturn * 100) / 100,
			maxDrawdown: Math.round(maxDrawdown * 1000) / 10,
			annualizedReturn: Math.round(annualizedReturn * 100) / 100,
			annualizedVolatility: Math.round(annualizedVolatility * 100) / 100,
			winRate: Math.round(winRate * 100) / 100,
			profitFactor: Math.round(profitFactor * 100) / 100,
			totalTrades,
			sortinoRatio: Math.round(sortinoRatio * 100) / 100,
			cagr: Math.round(cagr * 100) / 100,
		},
		equity_curve: equityCurve,
		trade_log: tradeLog,
		signals,
		config,
		thresholds,
	};
}
