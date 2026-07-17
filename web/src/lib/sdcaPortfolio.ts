/**
 * SDCA Portfolio Tracker
 *
 * Manages cumulative BTC accumulation, cost basis, cash balance,
 * and transaction logging for the Strategic DCA strategy.
 *
 * Persistence: localStorage (source of truth is transaction log for recovery).
 */

import type { SdcaPhase } from "./sdcaEngine";

// ─── Types ──────────────────────────────────────────────────────────────────

export type TransactionAction = "BUY" | "SELL" | "SELL_ALL";

export interface Transaction {
	/** ISO 8601 date string */
	timestamp: string;
	action: TransactionAction;
	/** SDCA multiplier at time of transaction */
	multiplier: number;
	/** Market phase at time of transaction */
	phase: SdcaPhase;
	/** USD amount transacted (before fees) */
	amountUsd: number;
	/** Transaction fee in USD */
	feeUsd: number;
	/** Net USD amount (for sells) or cost (for buys) */
	proceedsUsd: number;
	/** BTC amount transacted */
	btcAmount: number;
	/** BTC price at transaction */
	price: number;
	/** BTC balance after transaction */
	btcBalanceAfter: number;
	/** Cash balance after transaction */
	cashBalanceAfter: number;
}

export interface PortfolioState {
	btcBalance: number;
	cashBalance: number;
	avgCostBasis: number;
	totalInvested: number;
	totalFeesPaid: number;
	transactionLog: Transaction[];
}

export interface PortfolioMetrics {
	unrealizedPnl: number;
	unrealizedPnlPct: number;
	portfolioValue: number;
	totalReturn: number;
	totalReturnPct: number;
	totalFeesPaid: number;
	accumulationEfficiency: number;
}

export interface PortfolioConfig {
	/** Initial USD cash balance (default: 10,000) */
	initialCashBalance: number;
	/** Base DCA amount per period in USD (default: 100) */
	baseDcaAmount: number;
	/** Transaction fee rate as decimal (default: 0.001 = 10 bps) */
	feeRate: number;
	/** localStorage key for persistence */
	storageKey: string;
}

const DEFAULT_CONFIG: PortfolioConfig = {
	initialCashBalance: 10000,
	baseDcaAmount: 100,
	feeRate: 0.001,
	storageKey: "sdca_portfolio_state",
};

// ─── Factory ────────────────────────────────────────────────────────────────

export function createInitialState(
	config: Partial<PortfolioConfig> = {},
): PortfolioState {
	const cfg = { ...DEFAULT_CONFIG, ...config };
	return {
		btcBalance: 0,
		cashBalance: cfg.initialCashBalance,
		avgCostBasis: 0,
		totalInvested: 0,
		totalFeesPaid: 0,
		transactionLog: [],
	};
}

// ─── Buy Execution ──────────────────────────────────────────────────────────

/**
 * Execute a DCA buy with multiplier-based amount calculation.
 *
 * @param state - Current portfolio state (mutated)
 * @param price - Current BTC price
 * @param multiplier - SDCA multiplier (> 0 to buy)
 * @param phase - Current market phase
 * @param config - Portfolio configuration
 * @returns Updated state (same reference, mutated)
 */
export function executeBuy(
	state: PortfolioState,
	price: number,
	multiplier: number,
	phase: SdcaPhase,
	config: Partial<PortfolioConfig> = {},
): PortfolioState {
	const cfg = { ...DEFAULT_CONFIG, ...config };
	const buyAmount = cfg.baseDcaAmount * Math.max(0, multiplier);
	if (buyAmount <= 0 || price <= 0) return state;

	// Calculate fee
	const fee = buyAmount * cfg.feeRate;
	const netSpend = buyAmount + fee;

	// Check cash availability
	const actualSpend = Math.min(netSpend, state.cashBalance);
	if (actualSpend <= 0) return state;

	// Calculate BTC purchased (proportional if insufficient cash)
	const ratio = netSpend > state.cashBalance ? state.cashBalance / netSpend : 1;
	const actualBuy = buyAmount * ratio;
	const actualFee = fee * ratio;
	const btcPurchased = actualBuy / price;

	// Update state
	const previousTotalCost = state.avgCostBasis * state.btcBalance;
	state.btcBalance += btcPurchased;
	state.cashBalance -= actualBuy + actualFee;
	state.avgCostBasis =
		state.btcBalance > 0
			? (previousTotalCost + actualBuy) / state.btcBalance
			: 0;
	state.totalInvested += actualBuy;
	state.totalFeesPaid += actualFee;

	// Log transaction
	state.transactionLog.push({
		timestamp: new Date().toISOString(),
		action: "BUY",
		multiplier,
		phase,
		amountUsd: actualBuy,
		feeUsd: actualFee,
		proceedsUsd: actualBuy,
		btcAmount: btcPurchased,
		price,
		btcBalanceAfter: state.btcBalance,
		cashBalanceAfter: state.cashBalance,
	});

	return state;
}

// ─── Sell Execution ─────────────────────────────────────────────────────────

/**
 * Execute a DCA sell (USD-amount-based, NOT percentage of holdings).
 *
 * @param state - Current portfolio state (mutated)
 * @param price - Current BTC price
 * @param multiplier - SDCA multiplier (< 0 to sell)
 * @param phase - Current market phase
 * @param sellAll - If true, sell entire BTC balance
 * @param config - Portfolio configuration
 * @returns Updated state (same reference, mutated)
 */
export function executeSell(
	state: PortfolioState,
	price: number,
	multiplier: number,
	phase: SdcaPhase,
	sellAll: boolean = false,
	config: Partial<PortfolioConfig> = {},
): PortfolioState {
	const cfg = { ...DEFAULT_CONFIG, ...config };

	if (state.btcBalance <= 0 || price <= 0) return state;

	let sellValueUsd: number;
	if (sellAll) {
		sellValueUsd = state.btcBalance * price;
	} else {
		// Sell USD-amount based on multiplier (NOT percentage of holdings)
		sellValueUsd = cfg.baseDcaAmount * Math.abs(multiplier);
	}

	// Cap at actual BTC value
	const maxSell = state.btcBalance * price;
	sellValueUsd = Math.min(sellValueUsd, maxSell);

	// Calculate BTC to sell and fee
	const btcToSell = sellValueUsd / price;
	const fee = sellValueUsd * cfg.feeRate;
	const proceeds = sellValueUsd - fee;

	// Update state
	state.btcBalance -= btcToSell;
	state.cashBalance += proceeds;
	if (sellAll || state.btcBalance < 1e-10) {
		state.avgCostBasis = 0;
		state.btcBalance = 0;
	}
	state.totalFeesPaid += fee;

	// Log transaction
	state.transactionLog.push({
		timestamp: new Date().toISOString(),
		action: sellAll ? "SELL_ALL" : "SELL",
		multiplier,
		phase,
		amountUsd: sellValueUsd,
		feeUsd: fee,
		proceedsUsd: proceeds,
		btcAmount: btcToSell,
		price,
		btcBalanceAfter: state.btcBalance,
		cashBalanceAfter: state.cashBalance,
	});

	return state;
}

// ─── Metrics Calculation ────────────────────────────────────────────────────

export function computeMetrics(
	state: PortfolioState,
	currentPrice: number,
	initialCashBalance: number = DEFAULT_CONFIG.initialCashBalance,
): PortfolioMetrics {
	const btcValue = state.btcBalance * currentPrice;
	const portfolioValue = btcValue + state.cashBalance;
	const unrealizedPnl = btcValue - state.totalInvested;
	const unrealizedPnlPct =
		state.totalInvested > 0 ? (unrealizedPnl / state.totalInvested) * 100 : 0;
	const totalReturn = portfolioValue - initialCashBalance;
	const totalReturnPct =
		initialCashBalance > 0 ? (totalReturn / initialCashBalance) * 100 : 0;
	const accumulationEfficiency =
		state.totalInvested > 0 ? state.btcBalance / state.totalInvested : 0;

	return {
		unrealizedPnl,
		unrealizedPnlPct,
		portfolioValue,
		totalReturn,
		totalReturnPct,
		totalFeesPaid: state.totalFeesPaid,
		accumulationEfficiency,
	};
}

// ─── Persistence ────────────────────────────────────────────────────────────

export function savePortfolioState(
	state: PortfolioState,
	config: Partial<PortfolioConfig> = {},
): void {
	const cfg = { ...DEFAULT_CONFIG, ...config };
	try {
		localStorage.setItem(cfg.storageKey, JSON.stringify(state));
	} catch {
		// localStorage full or unavailable — silently fail
	}
}

export function loadPortfolioState(
	config: Partial<PortfolioConfig> = {},
): PortfolioState | null {
	const cfg = { ...DEFAULT_CONFIG, ...config };
	try {
		const raw = localStorage.getItem(cfg.storageKey);
		if (!raw) return null;
		const parsed = JSON.parse(raw) as PortfolioState;
		// Validate shape
		if (
			typeof parsed.btcBalance === "number" &&
			typeof parsed.cashBalance === "number" &&
			Array.isArray(parsed.transactionLog)
		) {
			return parsed;
		}
	} catch {
		// Corrupted data — treat as fresh
	}
	return null;
}

// ─── CSV Export ─────────────────────────────────────────────────────────────

export function exportTransactionsCsv(state: PortfolioState): void {
	const headers = [
		"Date",
		"Action",
		"Multiplier",
		"Phase",
		"Amount USD",
		"Fee USD",
		"Proceeds USD",
		"BTC Amount",
		"Price",
		"BTC Balance After",
		"Cash Balance After",
	];

	const rows = state.transactionLog.map((t) => [
		t.timestamp,
		t.action,
		t.multiplier.toFixed(2),
		t.phase,
		t.amountUsd.toFixed(2),
		t.feeUsd.toFixed(4),
		t.proceedsUsd.toFixed(2),
		t.btcAmount.toFixed(8),
		t.price.toFixed(2),
		t.btcBalanceAfter.toFixed(8),
		t.cashBalanceAfter.toFixed(2),
	]);

	const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
	const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
	const url = URL.createObjectURL(blob);
	const a = document.createElement("a");
	a.href = url;
	a.download = `sdca-transactions-${new Date().toISOString().slice(0, 10)}.csv`;
	a.click();
	URL.revokeObjectURL(url);
}
