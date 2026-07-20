import { describe, it, expect, beforeEach } from "bun:test";

// Mock localStorage for Node.js/Bun test environment
const localStorageMock = {
	_store: new Map<string, string>(),
	getItem(key: string) {
		return this._store.get(key) || null;
	},
	setItem(key: string, value: string) {
		this._store.set(key, value);
	},
	removeItem(key: string) {
		this._store.delete(key);
	},
	clear() {
		this._store.clear();
	},
};

globalThis.localStorage = localStorageMock as any;
import {
	createInitialState,
	executeBuy,
	executeSell,
	computeMetrics,
	savePortfolioState,
	loadPortfolioState,
	type PortfolioState,
	type PortfolioConfig,
} from "../sdcaPortfolio";

// ─── Test Config ────────────────────────────────────────────────────────────

const TEST_CONFIG: PortfolioConfig = {
	initialCashBalance: 10000,
	baseDcaAmount: 100,
	feeRate: 0.001, // 10 bps
	storageKey: "sdca_test_portfolio",
};

// ─── createInitialState ─────────────────────────────────────────────────────

describe("createInitialState", () => {
	it("creates portfolio with default values", () => {
		const state = createInitialState();
		expect(state.btcBalance).toBe(0);
		expect(state.cashBalance).toBe(10000);
		expect(state.avgCostBasis).toBe(0);
		expect(state.totalInvested).toBe(0);
		expect(state.totalFeesPaid).toBe(0);
		expect(state.transactionLog).toHaveLength(0);
	});

	it("creates portfolio with custom config", () => {
		const state = createInitialState({ initialCashBalance: 50000 });
		expect(state.cashBalance).toBe(50000);
	});
});

// ─── executeBuy ─────────────────────────────────────────────────────────────

describe("executeBuy", () => {
	let state: PortfolioState;

	beforeEach(() => {
		state = createInitialState(TEST_CONFIG);
	});

	it("executes normal DCA buy (1.0x multiplier)", () => {
		executeBuy(state, 60000, 1.0, "fair", TEST_CONFIG);

		// buyAmount = 100 * 1.0 = 100
		// fee = 100 * 0.001 = 0.10
		// netSpend = 100 + 0.10 = 100.10
		// btcPurchased = 100 / 60000 = 0.001666...
		expect(state.btcBalance).toBeCloseTo(0.00167, 4);
		expect(state.cashBalance).toBeCloseTo(9899.9, 2);
		expect(state.totalInvested).toBeCloseTo(100, 2);
		expect(state.totalFeesPaid).toBeCloseTo(0.1, 4);
		expect(state.transactionLog).toHaveLength(1);
		expect(state.transactionLog[0].action).toBe("BUY");
	});

	it("executes aggressive DCA buy (3.0x multiplier)", () => {
		executeBuy(state, 60000, 3.0, "deep_discount", TEST_CONFIG);

		// buyAmount = 100 * 3.0 = 300
		// fee = 300 * 0.001 = 0.30
		// btcPurchased = 300 / 60000 = 0.005
		expect(state.btcBalance).toBeCloseTo(0.005, 6);
		expect(state.cashBalance).toBeCloseTo(9699.7, 2);
		expect(state.totalInvested).toBeCloseTo(300, 2);
	});

	it("handles insufficient cash gracefully", () => {
		state.cashBalance = 50; // Only $50 available
		executeBuy(state, 60000, 1.0, "fair", TEST_CONFIG);

		// Can only buy what cash allows after fees
		expect(state.btcBalance).toBeGreaterThan(0);
		expect(state.cashBalance).toBeGreaterThanOrEqual(0);
		expect(state.cashBalance).toBeLessThan(0.01); // Nearly zero
	});

	it("updates average cost basis correctly", () => {
		executeBuy(state, 60000, 1.0, "fair", TEST_CONFIG);
		expect(state.avgCostBasis).toBeCloseTo(60000, 0); // First buy sets cost basis

		executeBuy(state, 80000, 1.0, "fair", TEST_CONFIG);

		// Avg cost should be weighted average (between 60k and 80k)
		expect(state.avgCostBasis).toBeGreaterThan(60000);
		expect(state.avgCostBasis).toBeLessThan(80000);
	});

	it("does nothing with zero price", () => {
		executeBuy(state, 0, 1.0, "fair", TEST_CONFIG);
		expect(state.btcBalance).toBe(0);
		expect(state.transactionLog).toHaveLength(0);
	});

	it("does nothing with negative multiplier", () => {
		executeBuy(state, 60000, -0.5, "euphoria", TEST_CONFIG);
		expect(state.btcBalance).toBe(0);
		expect(state.transactionLog).toHaveLength(0);
	});
});

// ─── executeSell ────────────────────────────────────────────────────────────

describe("executeSell", () => {
	let state: PortfolioState;

	beforeEach(() => {
		state = createInitialState(TEST_CONFIG);
		// Buy some BTC first
		executeBuy(state, 60000, 3.0, "deep_discount", TEST_CONFIG);
	});

	it("executes partial sell (REDUCE_POSITION)", () => {
		const btcBeforeSell = state.btcBalance;
		executeSell(state, 100000, -0.5, "euphoria", false, TEST_CONFIG);

		// btcBeforeSell = 0.005
		// sellFraction = 0.5
		// btcToSell = 0.0025
		// proceeds = 250 - 0.25 = 249.75
		expect(state.btcBalance).toBeCloseTo(btcBeforeSell - 0.0025, 6);
		expect(state.cashBalance).toBeCloseTo(9699.7 + 249.75, 2);
		expect(state.totalFeesPaid).toBeCloseTo(0.3 + 0.25, 4);
		expect(state.transactionLog).toHaveLength(2);
		expect(state.transactionLog[1].action).toBe("SELL");
		expect(state.transactionLog[1].proceedsUsd).toBeCloseTo(249.75, 2);
	});

	it("executes full sell (SELL_ALL)", () => {
		executeSell(state, 100000, -0.5, "euphoria", true, TEST_CONFIG);

		// All BTC sold, balance should be zero
		expect(state.btcBalance).toBe(0);
		expect(state.avgCostBasis).toBe(0);
		expect(state.transactionLog[1].action).toBe("SELL_ALL");
	});

	it("does nothing with zero BTC balance", () => {
		const freshState = createInitialState(TEST_CONFIG);
		executeSell(freshState, 100000, -0.5, "euphoria", false, TEST_CONFIG);
		expect(freshState.transactionLog).toHaveLength(0);
	});

	it("does nothing with zero price", () => {
		executeSell(state, 0, -0.5, "euphoria", false, TEST_CONFIG);
		expect(state.transactionLog).toHaveLength(1); // Only the buy
	});
});

// ─── computeMetrics ─────────────────────────────────────────────────────────

describe("computeMetrics", () => {
	it("calculates metrics for profitable portfolio", () => {
		const state = createInitialState(TEST_CONFIG);
		executeBuy(state, 60000, 3.0, "deep_discount", TEST_CONFIG);

		const metrics = computeMetrics(state, 80000, 10000);

		// btcBalance ~ 0.005, value = 0.005 * 80000 = 400
		// totalInvested = 300
		// unrealizedPnl = 400 - 300 = 100
		expect(metrics.unrealizedPnl).toBeGreaterThan(0);
		expect(metrics.unrealizedPnlPct).toBeGreaterThan(0);
		expect(metrics.portfolioValue).toBeGreaterThan(10000);
		expect(metrics.totalReturn).toBeGreaterThan(0);
	});

	it("calculates metrics for underwater portfolio", () => {
		const state = createInitialState(TEST_CONFIG);
		executeBuy(state, 60000, 3.0, "deep_discount", TEST_CONFIG);

		const metrics = computeMetrics(state, 40000, 10000);

		// btcBalance ~ 0.005, value = 0.005 * 40000 = 200
		// totalInvested = 300
		// unrealizedPnl = 200 - 300 = -100
		expect(metrics.unrealizedPnl).toBeLessThan(0);
		expect(metrics.unrealizedPnlPct).toBeLessThan(0);
	});

	it("tracks total fees paid", () => {
		const state = createInitialState(TEST_CONFIG);
		executeBuy(state, 60000, 1.0, "fair", TEST_CONFIG);
		executeBuy(state, 70000, 1.0, "fair", TEST_CONFIG);

		const metrics = computeMetrics(state, 65000);
		expect(metrics.totalFeesPaid).toBeCloseTo(0.2, 4);
	});

	it("calculates accumulation efficiency", () => {
		const state = createInitialState(TEST_CONFIG);
		executeBuy(state, 60000, 3.0, "deep_discount", TEST_CONFIG);

		const metrics = computeMetrics(state, 60000);
		// accumulationEfficiency = btcBalance / totalInvested
		expect(metrics.accumulationEfficiency).toBeGreaterThan(0);
	});
});

// ─── Persistence ────────────────────────────────────────────────────────────

describe("savePortfolioState / loadPortfolioState", () => {
	beforeEach(() => {
		localStorage.removeItem(TEST_CONFIG.storageKey);
	});

	it("saves and loads portfolio state", () => {
		const state = createInitialState(TEST_CONFIG);
		executeBuy(state, 60000, 1.0, "fair", TEST_CONFIG);

		savePortfolioState(state, TEST_CONFIG);
		const loaded = loadPortfolioState(TEST_CONFIG);

		expect(loaded).not.toBeNull();
		expect(loaded!.btcBalance).toBeCloseTo(state.btcBalance, 6);
		expect(loaded!.cashBalance).toBeCloseTo(state.cashBalance, 2);
		expect(loaded!.transactionLog).toHaveLength(1);
	});

	it("returns null for missing state", () => {
		const loaded = loadPortfolioState(TEST_CONFIG);
		expect(loaded).toBeNull();
	});

	it("handles corrupted data gracefully", () => {
		localStorage.setItem(TEST_CONFIG.storageKey, "invalid json");
		const loaded = loadPortfolioState(TEST_CONFIG);
		expect(loaded).toBeNull();
	});
});

// ─── Transaction Log ────────────────────────────────────────────────────────

describe("transaction log", () => {
	it("logs all required fields on buy", () => {
		const state = createInitialState(TEST_CONFIG);
		executeBuy(state, 60000, 1.5, "value", TEST_CONFIG);

		const tx = state.transactionLog[0];
		expect(tx.timestamp).toBeTruthy();
		expect(tx.action).toBe("BUY");
		expect(tx.multiplier).toBe(1.5);
		expect(tx.phase).toBe("value");
		expect(tx.amountUsd).toBeCloseTo(150, 2);
		expect(tx.feeUsd).toBeCloseTo(0.15, 4);
		expect(tx.proceedsUsd).toBeCloseTo(150, 2);
		expect(tx.btcAmount).toBeCloseTo(0.0025, 6);
		expect(tx.price).toBe(60000);
		expect(tx.btcBalanceAfter).toBeCloseTo(0.0025, 6);
		expect(tx.cashBalanceAfter).toBeCloseTo(9849.85, 2);
	});

	it("logs all required fields on sell", () => {
		const state = createInitialState(TEST_CONFIG);
		executeBuy(state, 60000, 3.0, "deep_discount", TEST_CONFIG);
		executeSell(state, 100000, -0.5, "euphoria", false, TEST_CONFIG);

		const tx = state.transactionLog[1];
		expect(tx.action).toBe("SELL");
		expect(tx.proceedsUsd).toBeCloseTo(249.75, 2);
		expect(tx.feeUsd).toBeCloseTo(0.25, 4);
	});
});
