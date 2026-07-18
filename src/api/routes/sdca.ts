import { Hono } from "hono";
import { executeQuery } from "../db.js";
import { mergeThresholds, type SdcaThresholds } from "../../lib/sdcaEngine.js";
import { computeSdcaBacktest } from "../../lib/sdcaBacktest.js";
import { computeSdcaSignals } from "../../lib/sdcaEngine.js";
import type { DailyRecord } from "../../lib/sdcaEngine.js";

export const sdcaRouter = new Hono();

const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

// ─── Parameter Presets ──────────────────────────────────────────────

interface SdcaPreset {
	buy_threshold: number;
	sell_threshold: number;
	description: string;
}

const SDCA_PRESETS: Record<string, SdcaPreset> = {
	conservative: {
		buy_threshold: 0.5,
		sell_threshold: -1.5,
		description: "Optimized for lower drawdown",
	},
	moderate: {
		buy_threshold: 1.0,
		sell_threshold: -1.0,
		description: "Balanced risk/return",
	},
	aggressive: {
		buy_threshold: 1.5,
		sell_threshold: -0.5,
		description: "Higher risk, higher potential return",
	},
};

/**
 * Fetch daily records from unified_daily_analytics + master_ohlcv for SDCA computation.
 */
function fetchDailyRecords(startDate: string, endDate: string): DailyRecord[] {
	const sql = `
		SELECT
			u.date,
			COALESCE(m.close, u.btc_price) as close,
			u.valuation_composite
		FROM unified_daily_analytics u
		LEFT JOIN master_ohlcv m ON u.date = m.date
		WHERE u.date >= ? AND u.date <= ?
		  AND COALESCE(m.close, u.btc_price) IS NOT NULL
		ORDER BY u.date ASC
	`;
	return executeQuery<DailyRecord>(sql, [startDate, endDate]);
}

// ─── POST /api/v1/sdca/signal ──────────────────────────────────────
sdcaRouter.post("/signal", async (c) => {
	try {
		const body = await c.req.json();
		const today = new Date().toISOString().split("T")[0];

		// Resolve thresholds from preset or custom overrides
		let thresholds: SdcaThresholds | undefined;
		if (body.preset && SDCA_PRESETS[body.preset]) {
			thresholds = SDCA_PRESETS[body.preset];
		} else if (
			body.buy_threshold !== undefined ||
			body.sell_threshold !== undefined
		) {
			thresholds = {
				buy_threshold: body.buy_threshold,
				sell_threshold: body.sell_threshold,
				price_pct_buy: body.price_pct_buy,
				price_pct_sell: body.price_pct_sell,
				extended_discount_days: body.extended_discount_days,
			};
		}

		// Single date lookup
		if (body.date) {
			if (!dateRegex.test(body.date)) {
				return c.json(
					{ error: "Invalid date format. Expected YYYY-MM-DD." },
					400,
				);
			}
			if (body.date > today) {
				return c.json(
					{ error: "Cannot query future dates (CausalFilter)." },
					400,
				);
			}

			// Fetch data up to and including the target date
			const records = fetchDailyRecords("2010-01-01", body.date);
			if (records.length === 0) {
				return c.json({ error: "No data found for the specified date." }, 404);
			}

			const signals = computeSdcaSignals(records, thresholds);
			const lastSignal = signals[signals.length - 1];
			return c.json(lastSignal);
		}

		// Date range query
		const startDate = body.start_date || "2010-01-01";
		const endDate = body.end_date || today;

		if (!dateRegex.test(startDate) || !dateRegex.test(endDate)) {
			return c.json(
				{ error: "Invalid date format. Expected YYYY-MM-DD." },
				400,
			);
		}
		if (startDate > endDate) {
			return c.json({ error: "start_date must be <= end_date" }, 400);
		}
		if (endDate > today) {
			return c.json(
				{ error: "Cannot query future dates (CausalFilter)." },
				400,
			);
		}

		const records = fetchDailyRecords(startDate, endDate);
		if (records.length === 0) {
			return c.json([]);
		}

		const signals = computeSdcaSignals(records, thresholds);
		return c.json(signals);
	} catch (err: any) {
		console.error("Error in POST /api/v1/sdca/signal:", err);
		return c.json({ error: err.message || "Internal server error" }, 500);
	}
});

// ─── POST /api/v1/sdca/backtest ─────────────────────────────────────
sdcaRouter.post("/backtest", async (c) => {
	try {
		const body = await c.req.json();
		const today = new Date().toISOString().split("T")[0];

		const startDate = body.start_date || "2010-01-01";
		const endDate = body.end_date || today;

		if (!dateRegex.test(startDate) || !dateRegex.test(endDate)) {
			return c.json(
				{ error: "Invalid date format. Expected YYYY-MM-DD." },
				400,
			);
		}
		if (startDate > endDate) {
			return c.json({ error: "start_date must be <= end_date" }, 400);
		}
		if (endDate > today) {
			return c.json(
				{ error: "Cannot query future dates (CausalFilter)." },
				400,
			);
		}

		const records = fetchDailyRecords(startDate, endDate);
		if (records.length === 0) {
			// Resolve thresholds for empty result config
			let emptyThresholds: SdcaThresholds | undefined;
			if (body.preset && SDCA_PRESETS[body.preset]) {
				emptyThresholds = SDCA_PRESETS[body.preset];
			} else if (
				body.buy_threshold !== undefined ||
				body.sell_threshold !== undefined
			) {
				emptyThresholds = {
					buy_threshold: body.buy_threshold,
					sell_threshold: body.sell_threshold,
				};
			}
			const resolvedEmpty = mergeThresholds(emptyThresholds);

			return c.json({
				metrics: {
					sharpeRatio: 0,
					totalReturn: 0,
					maxDrawdown: 0,
					annualizedReturn: 0,
					annualizedVolatility: 0,
					winRate: 0,
					profitFactor: 0,
					totalTrades: 0,
					sortinoRatio: 0,
					cagr: 0,
				},
				equity_curve: [],
				trade_log: [],
				signals: [],
				config: {
					start_date: startDate,
					end_date: endDate,
					fee_bps: body.fee_bps ?? 10,
					base_dca_amount: body.base_dca_amount ?? 100,
					initial_cash: body.initial_cash ?? 10000,
				},
				thresholds: resolvedEmpty,
			});
		}

		// Resolve thresholds from preset or custom overrides
		let resolvedThresholds: SdcaThresholds | undefined;
		if (body.preset && SDCA_PRESETS[body.preset]) {
			resolvedThresholds = SDCA_PRESETS[body.preset];
		} else if (
			body.buy_threshold !== undefined ||
			body.sell_threshold !== undefined
		) {
			resolvedThresholds = {
				buy_threshold: body.buy_threshold,
				sell_threshold: body.sell_threshold,
				price_pct_buy: body.price_pct_buy,
				price_pct_sell: body.price_pct_sell,
				extended_discount_days: body.extended_discount_days,
			};
		}

		const result = computeSdcaBacktest(records, {
			start_date: startDate,
			end_date: endDate,
			fee_bps: body.fee_bps,
			base_dca_amount: body.base_dca_amount,
			initial_cash: body.initial_cash,
			thresholds: resolvedThresholds,
			preset: body.preset,
		});

		return c.json(result);
	} catch (err: any) {
		console.error("Error in POST /api/v1/sdca/backtest:", err);
		return c.json({ error: err.message || "Internal server error" }, 500);
	}
});
