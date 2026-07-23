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
	sharpeRatioMarket?: number;
	annualizedReturnMarket?: number;
	annualizedVolatilityMarket?: number;
	maxDrawdownMarket?: number;
	avgCostBasis?: number;
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
	/** Net USD PnL for trade execution */
	net_pnl_usd?: number;
	/** Profit percentage for trade execution */
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
	let weightedCostBasisUsd = 0;
	let simpleDcaCash = initialCash;
	let simpleDcaBtc = 0;
	const buyHoldStartPrice = data.length > 0 ? data[0].close : 1;
	const buyHoldBtc = initialCash / buyHoldStartPrice;

	// Metrics tracking
	let peakSdca = initialCash;
	let peakMarket = initialCash;
	let maxDrawdown = 0;
	let maxDrawdownMarket = 0;
	let totalFees = 0;
	let wins = 0;
	let losses = 0;
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

		// SDCA execution: apply multiplier-based DCA & ALL IN / ALL OUT triggers
		const multiplier = signal.multiplier;
		const sdcaAmount = baseDcaAmount * multiplier;

		if (multiplier === 999.0) {
			// ALL IN: Allocate 100% remaining cash to BTC
			if (sdcaCash > 0) {
				const sdcaAmount = sdcaCash;
				const fee = sdcaAmount * feeRate;
				const netAmount = sdcaAmount - fee;
				const btcBought = netAmount / price;
				sdcaBtc += btcBought;
				sdcaCash = 0;
				sdcaTotalInvested += sdcaAmount;
				weightedCostBasisUsd += sdcaAmount;
				totalFees += fee;

				tradeId++;
				tradeLog.push({
					id: tradeId,
					date: day.date,
					action: "ALL_IN",
					amount_usd: sdcaAmount,
					btc_price: price,
					multiplier,
					phase: signal.phase,
					net_pnl_usd: 0,
					profit_pct: 0,
				});
				totalTrades++;
			}
		} else if (multiplier === -1.0) {
			// ALL OUT: Sell 100% remaining BTC position to cash
			if (sdcaBtc > 0) {
				const btcToSell = sdcaBtc;
				const proceeds = btcToSell * price;
				const fee = proceeds * feeRate;
				const netProceeds = proceeds - fee;
				const costOfSoldBtc = weightedCostBasisUsd > 0 ? weightedCostBasisUsd : sdcaTotalInvested;
				const netPnlUsd = netProceeds - costOfSoldBtc;
				const returnPct = costOfSoldBtc > 0 ? (netPnlUsd / costOfSoldBtc) * 100 : 0;

				if (netPnlUsd >= 0) {
					wins++;
					grossProfit += netPnlUsd;
				} else {
					losses++;
					grossLoss += Math.abs(netPnlUsd);
				}

				sdcaBtc = 0;
				sdcaCash += netProceeds;
				weightedCostBasisUsd = 0;
				totalFees += fee;

				tradeId++;
				tradeLog.push({
					id: tradeId,
					date: day.date,
					action: "ALL_OUT",
					amount_usd: netProceeds,
					btc_price: price,
					multiplier,
					phase: signal.phase,
					net_pnl_usd: Math.round(netPnlUsd * 100) / 100,
					profit_pct: Math.round(returnPct * 100) / 100,
				});
				totalTrades++;
			}
		} else if (sdcaAmount > 0) {
			// Buy DCA
			const amountToBuy = Math.min(sdcaCash, sdcaAmount);
			if (amountToBuy > 0) {
				const fee = amountToBuy * feeRate;
				const netAmount = amountToBuy - fee;
				const btcBought = netAmount / price;
				sdcaBtc += btcBought;
				sdcaCash -= amountToBuy;
				sdcaTotalInvested += amountToBuy;
				weightedCostBasisUsd += amountToBuy;
				totalFees += fee;

				tradeId++;
				tradeLog.push({
					id: tradeId,
					date: day.date,
					action: "BUY",
					amount_usd: amountToBuy,
					btc_price: price,
					multiplier,
					phase: signal.phase,
					net_pnl_usd: 0,
					profit_pct: 0,
				});
				totalTrades++;
			}
		} else if (sdcaAmount < 0) {
			// Sell DCA (negative multiplier = DCA out)
			const sellAmount = Math.abs(sdcaAmount);
			const btcToSell = Math.min(sellAmount / price, sdcaBtc);
			if (btcToSell > 0) {
				const proceeds = btcToSell * price;
				const fee = proceeds * feeRate;
				const netProceeds = proceeds - fee;
				const currentAvgCost = sdcaBtc > 0 ? (weightedCostBasisUsd / sdcaBtc) : price;
				const costOfSoldBtc = btcToSell * currentAvgCost;
				const netPnlUsd = netProceeds - costOfSoldBtc;
				const returnPct = costOfSoldBtc > 0 ? (netPnlUsd / costOfSoldBtc) * 100 : 0;

				if (netPnlUsd >= 0) {
					wins++;
					grossProfit += netPnlUsd;
				} else {
					losses++;
					grossLoss += Math.abs(netPnlUsd);
				}

				sdcaBtc -= btcToSell;
				sdcaCash += netProceeds;
				weightedCostBasisUsd = Math.max(0, weightedCostBasisUsd - costOfSoldBtc);
				totalFees += fee;

				tradeId++;
				tradeLog.push({
					id: tradeId,
					date: day.date,
					action: "SELL",
					amount_usd: netProceeds,
					btc_price: price,
					multiplier,
					phase: signal.phase,
					net_pnl_usd: Math.round(netPnlUsd * 100) / 100,
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

		if (buyHoldEquity > peakMarket) peakMarket = buyHoldEquity;
		const ddM = (peakMarket - buyHoldEquity) / peakMarket;
		if (ddM > maxDrawdownMarket) maxDrawdownMarket = ddM;
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
	const marketDailyReturns: number[] = [];
	for (let i = 1; i < equityCurve.length; i++) {
		const prev = equityCurve[i - 1].sdca;
		const curr = equityCurve[i].sdca;
		if (prev > 0) dailyReturns.push((curr - prev) / prev);

		const prevM = equityCurve[i - 1].buyHold;
		const currM = equityCurve[i].buyHold;
		if (prevM > 0) marketDailyReturns.push((currM - prevM) / prevM);
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

	const meanMarketReturn =
		marketDailyReturns.length > 0
			? marketDailyReturns.reduce((a, b) => a + b, 0) / marketDailyReturns.length
			: 0;
	const marketVariance =
		marketDailyReturns.length > 0
			? marketDailyReturns.reduce((a, b) => a + (b - meanMarketReturn) ** 2, 0) /
				marketDailyReturns.length
			: 0;
	const annualizedVolatilityMarket = Math.sqrt(marketVariance) * Math.sqrt(365) * 100;
	const annualizedReturnMarket = meanMarketReturn * 365 * 100;
	const sharpeRatioMarket =
		annualizedVolatilityMarket > 0
			? annualizedReturnMarket / annualizedVolatilityMarket
			: 0.85;

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

	const totalCompletedTrades = wins + losses;
	const profitFactor =
		grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? 999 : 0;
	const winRate =
		totalCompletedTrades > 0
			? (wins / totalCompletedTrades) * 100
			: totalTrades > 0
				? (wins / totalTrades) * 100
				: 0;

	const avgCostBasis = sdcaBtc > 0 ? weightedCostBasisUsd / sdcaBtc : 0;

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
			sharpeRatioMarket: Math.round(sharpeRatioMarket * 100) / 100,
			annualizedReturnMarket: Math.round(annualizedReturnMarket * 100) / 100,
			annualizedVolatilityMarket: Math.round(annualizedVolatilityMarket * 100) / 100,
			maxDrawdownMarket: Math.round(maxDrawdownMarket * 1000) / 10,
			avgCostBasis: Math.round(avgCostBasis * 100) / 100,
		},
		equity_curve: equityCurve,
		trade_log: tradeLog,
		signals,
		config,
		thresholds,
	};
}
